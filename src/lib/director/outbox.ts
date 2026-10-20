import type { MutationIntent } from "#/domain/mutation";
import type { ClientName, Timeline } from "#/lib/sandbox/trace";
import type { AgeOf } from "./reveal";

// The outbox tray: each change a device holds for the server, as a slot. It
// drops in when the change enters the outbox, its ring half-fills when the
// server acks it, a copy of it rises to the wire with each push that carries
// it, and it leaves when a pull confirms it. Read off the trace, so a seek
// lands on its look at that instant.

// Screen milliseconds at 1×.
export const SLOT_MILLIS = 400;
export const GONE_MILLIS = 500;
export const COPY_MILLIS = 450;

export interface Slot {
  readonly clientMutationId: number;
  readonly intent: MutationIntent["_tag"];
  readonly acked: boolean;
  // Since it entered the outbox.
  readonly age: number;
  // Since its ack landed.
  readonly ackedAge: number | null;
  // Since a pull confirmed it: it is leaving.
  readonly goneAge: number | null;
  // Since the latest push carrying it left.
  readonly sentAge: number | null;
}

// One change's time in the outbox, as entry indices. -1 is before a trimmed
// timeline's first entry: what it held there came before it.
interface Life {
  readonly clientMutationId: number;
  readonly intent: MutationIntent["_tag"];
  readonly entered: number;
  acked: number | null;
  left: number | null;
  readonly sends: Array<number>;
}

const known = new WeakMap<Timeline, Map<ClientName, ReadonlyArray<Life>>>();

// Every change that passed through a client's outbox, in the order they
// entered it. A timeline never changes, so it is read once a client. A
// snapshot keeps an outbox by reference while it is the same, so only
// outboxes that moved are compared.
const livesOf = (
  timeline: Timeline,
  client: ClientName,
): ReadonlyArray<Life> => {
  let byClient = known.get(timeline);
  if (byClient === undefined) {
    byClient = new Map();
    known.set(timeline, byClient);
  }
  const cached = byClient.get(client);
  if (cached !== undefined) return cached;
  const lives: Array<Life> = [];
  const open = new Map<number, Life>();
  let outbox: unknown;
  for (const [index, { event, snapshot }] of timeline.entries.entries()) {
    const state = snapshot.clients.get(client);
    if (state === undefined) continue;
    const at = index === 0 && timeline.trimmed ? -1 : index;
    if (state.outbox !== outbox) {
      outbox = state.outbox;
      const held = new Set<number>();
      for (const { mutation } of state.outbox) {
        const id = mutation.clientMutationId;
        held.add(id);
        if (!open.has(id)) {
          const life: Life = {
            clientMutationId: id,
            intent: mutation._tag,
            entered: at,
            acked: null,
            left: null,
            sends: [],
          };
          open.set(id, life);
          lives.push(life);
        }
      }
      for (const [id, life] of open) {
        if (!held.has(id)) {
          life.left = index;
          open.delete(id);
        }
      }
    }
    for (const life of open.values()) {
      if (life.acked === null && life.clientMutationId <= state.ackedThrough) {
        life.acked = at;
      }
    }
    // A push carries every change the server has not decided.
    if (
      event._tag === "Sent" &&
      event.message.kind === "push" &&
      event.message.client === client
    ) {
      for (const life of open.values()) {
        if (life.clientMutationId > state.ackedThrough) life.sends.push(index);
      }
    }
  }
  byClient.set(client, lives);
  return lives;
};

const byId = (a: Slot, b: Slot) => a.clientMutationId - b.clientMutationId;

// The client's outbox at the frame's entry, in id order, then the slots a
// pull confirmed less than GONE_MILLIS ago. What a trimmed timeline no longer
// holds is long ago.
export const slotsAt = (
  timeline: Timeline,
  index: number,
  ageOf: AgeOf,
  client: ClientName,
): ReadonlyArray<Slot> => {
  const ageAt = (i: number) => (i < 0 ? Number.POSITIVE_INFINITY : ageOf(i));
  const held: Array<Slot> = [];
  const gone: Array<Slot> = [];
  for (const life of livesOf(timeline, client)) {
    if (life.entered > index) break;
    let sent: number | null = null;
    for (const send of life.sends) {
      if (send <= index) sent = send;
    }
    const acked =
      life.acked !== null && life.acked <= index ? life.acked : null;
    const slot: Slot = {
      clientMutationId: life.clientMutationId,
      intent: life.intent,
      acked: acked !== null,
      age: ageAt(life.entered),
      ackedAge: acked === null ? null : ageAt(acked),
      goneAge: null,
      sentAge: sent === null ? null : ageAt(sent),
    };
    if (life.left === null || life.left > index) {
      held.push(slot);
      continue;
    }
    const goneAge = ageAt(life.left);
    if (goneAge >= 0 && goneAge < GONE_MILLIS) gone.push({ ...slot, goneAge });
  }
  return [...held.sort(byId), ...gone.sort(byId)];
};
