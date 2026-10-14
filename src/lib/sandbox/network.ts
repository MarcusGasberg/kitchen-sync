import {
  Clock,
  Deferred,
  Duration,
  Effect,
  Ref,
  Stream,
  SubscriptionRef,
} from "effect";
import { TransportFailure } from "#/domain/errors";
import type { Recorder } from "./recorder";
import type { ClientName, Message, MessageKind } from "./trace";

export interface MessageRule {
  readonly client: ClientName;
  readonly kind: MessageKind;
  // How many matching messages the rule catches; 1 by default.
  readonly times?: number;
}

export type Arrival = "delivered" | "dropped";

export interface Network {
  // Carries one message. Resolves when it arrives, or half-way when a rule
  // drops it; fails at once, or mid-flight, when its client is offline.
  readonly carry: (
    client: ClientName,
    kind: MessageKind,
    label: string,
  ) => Effect.Effect<Arrival, TransportFailure>;
  readonly setOffline: (
    client: ClientName,
    offline: boolean,
  ) => Effect.Effect<void>;
  readonly isOffline: (client: ClientName) => Effect.Effect<boolean>;
  // Resolves once the client is offline, at once if it already is.
  readonly awaitOffline: (client: ClientName) => Effect.Effect<void>;
  readonly setLatency: (
    client: ClientName,
    latency: Duration.Input,
  ) => Effect.Effect<void>;
  readonly drop: (rule: MessageRule) => Effect.Effect<void>;
  readonly hold: (rule: MessageRule) => Effect.Effect<void>;
  readonly release: (messageId: number) => Effect.Effect<void>;
}

// What a browser's fetch gives you with no network: fast, and worth retrying.
export const networkError = () =>
  new TransportFailure({ retryable: true, reason: "network error" });

interface Link {
  readonly offline: boolean;
  readonly latencyMillis: number;
}

interface ActiveRule {
  readonly client: ClientName;
  readonly kind: MessageKind;
  readonly times: number;
  readonly action: "drop" | "hold";
}

export const makeNetwork = (options: {
  readonly clients: ReadonlyArray<ClientName>;
  readonly latency: Duration.Input;
  readonly recorder: Recorder;
}): Effect.Effect<Network> =>
  Effect.gen(function* () {
    const { recorder } = options;
    const links = yield* SubscriptionRef.make<ReadonlyMap<ClientName, Link>>(
      new Map(
        options.clients.map((client) => [
          client,
          { offline: false, latencyMillis: Duration.toMillis(options.latency) },
        ]),
      ),
    );
    const rules = yield* Ref.make<ReadonlyArray<ActiveRule>>([]);
    const held = new Map<number, Deferred.Deferred<void>>();
    let nextId = 1;

    const link = (client: ClientName) =>
      Effect.flatMap(SubscriptionRef.get(links), (all) => {
        const found = all.get(client);
        return found === undefined
          ? Effect.die(new Error(`no client named ${client} in this world`))
          : Effect.succeed(found);
      });

    // Takes the first matching rule, using up one of its catches.
    const takeRule = (client: ClientName, kind: MessageKind) =>
      Ref.modify(rules, (all) => {
        const index = all.findIndex(
          (rule) => rule.client === client && rule.kind === kind,
        );
        if (index === -1) return [undefined, all] as const;
        const rule = all[index];
        const rest =
          rule.times > 1
            ? all.map((r, i) =>
                i === index ? { ...r, times: r.times - 1 } : r,
              )
            : all.filter((_, i) => i !== index);
        return [rule.action, rest] as const;
      });

    const awaitOffline = (client: ClientName) =>
      SubscriptionRef.changes(links).pipe(
        Stream.filter((all) => all.get(client)?.offline === true),
        Stream.take(1),
        Stream.runDrain,
      );

    const carry = (client: ClientName, kind: MessageKind, label: string) =>
      Effect.gen(function* () {
        const { offline, latencyMillis } = yield* link(client);
        if (offline) return yield* networkError();

        const action = yield* takeRule(client, kind);
        const sentAt = yield* Clock.currentTimeMillis;
        const id = nextId++;
        let current: Message = {
          id,
          client,
          kind,
          label,
          sentAt,
          arriveAt: action === "hold" ? null : sentAt + latencyMillis,
          fate: action === "hold" ? "held" : "inFlight",
        };
        yield* recorder.record({ _tag: "Sent", message: current });

        const travel = Effect.gen(function* () {
          if (action === "hold") {
            const release = yield* Deferred.make<void>();
            held.set(id, release);
            yield* recorder.record({ _tag: "Held", message: current });
            yield* Deferred.await(release);
            const releasedAt = yield* Clock.currentTimeMillis;
            current = {
              ...current,
              fate: "inFlight",
              arriveAt: releasedAt + latencyMillis,
            };
            yield* recorder.record({ _tag: "Released", message: current });
          }
          if (action === "drop") {
            yield* Effect.sleep(Duration.millis(latencyMillis / 2));
            yield* recorder.record({
              _tag: "Dropped",
              message: { ...current, fate: "dropped" },
            });
            return "dropped" as const;
          }
          yield* Effect.sleep(Duration.millis(latencyMillis));
          yield* recorder.record({
            _tag: "Delivered",
            message: { ...current, fate: "delivered" },
          });
          return "delivered" as const;
        });

        // The link going down takes everything on it.
        const cutOff = awaitOffline(client).pipe(
          Effect.andThen(
            Effect.suspend(() =>
              recorder.record({
                _tag: "Dropped",
                message: { ...current, fate: "dropped" },
              }),
            ),
          ),
          Effect.andThen(Effect.fail(networkError())),
        );

        return yield* Effect.raceFirst(travel, cutOff).pipe(
          Effect.onInterrupt(() =>
            Effect.suspend(() => {
              held.delete(id);
              return recorder.record({
                _tag: "Abandoned",
                message: { ...current, fate: "abandoned" },
              });
            }),
          ),
        );
      });

    const addRule = (rule: MessageRule, action: ActiveRule["action"]) =>
      Effect.flatMap(link(rule.client), () =>
        Ref.update(rules, (all) => [
          ...all,
          {
            client: rule.client,
            kind: rule.kind,
            times: rule.times ?? 1,
            action,
          },
        ]),
      );

    const network: Network = {
      carry,
      awaitOffline,
      isOffline: (client) => Effect.map(link(client), (l) => l.offline),
      setOffline: (client, offline) =>
        Effect.gen(function* () {
          const current = yield* link(client);
          if (current.offline === offline) return;
          // Going offline is recorded first: the update wakes the cut-off
          // fibers that record Dropped, and the cause must precede the effect.
          if (offline) yield* recorder.record({ _tag: "WentOffline", client });
          yield* SubscriptionRef.update(links, (all) =>
            new Map(all).set(client, { ...current, offline }),
          );
          if (!offline) yield* recorder.record({ _tag: "CameOnline", client });
        }),
      setLatency: (client, latency) =>
        Effect.gen(function* () {
          const current = yield* link(client);
          yield* SubscriptionRef.update(links, (all) =>
            new Map(all).set(client, {
              ...current,
              latencyMillis: Duration.toMillis(latency),
            }),
          );
        }),
      drop: (rule) => addRule(rule, "drop"),
      hold: (rule) => addRule(rule, "hold"),
      release: (messageId) =>
        Effect.suspend(() => {
          const release = held.get(messageId);
          if (release === undefined) return Effect.void;
          held.delete(messageId);
          return Deferred.succeed(release, undefined).pipe(Effect.asVoid);
        }),
    };
    return network;
  });
