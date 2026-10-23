import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect, it as plain } from "vitest";
import { payloadOf, shownLabel } from "#/lib/director/payload";
import { runHeadless } from "#/lib/sandbox/scene";
import { EMPTY_TIMELINE, type Message } from "#/lib/sandbox/trace";
import {
  entryWhere,
  MILK_SCENE,
  REMOVE_FIRST_SCENE,
  recordClassicLife,
} from "./director-helpers";

describe("payloadOf", () => {
  it.effect("reads what a message carries from the world as it left", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(MILK_SCENE);
      const sent = (found: (m: Message) => boolean): Message => {
        const { entry } = entryWhere(
          timeline,
          (e) => e._tag === "Sent" && found(e.message),
        );
        if (entry.event._tag !== "Sent") throw new Error("not a send");
        return entry.event.message;
      };
      expect(
        payloadOf(
          sent((m) => m.kind === "push" && m.client === "A"),
          timeline,
        ),
      ).toEqual(["push #1", "#1 add Milk", "base v0"]);
      expect(
        payloadOf(
          sent((m) => m.kind === "push" && m.client === "B"),
          timeline,
        ),
      ).toEqual(["push #1", "#1 check Milk", "base v1"]);
      expect(
        payloadOf(
          sent((m) => m.kind === "ack"),
          timeline,
        ),
      ).toEqual(["ack #1", "decided, not yet pulled"]);
      expect(
        payloadOf(
          sent((m) => m.kind === "poke" && m.client === "B"),
          timeline,
        ),
      ).toEqual(["poke v1", "something changed"]);
      expect(
        payloadOf(
          sent((m) => m.kind === "pull" && m.client === "B"),
          timeline,
        ),
      ).toEqual(["pull v0", "asks for what came after"]);
      expect(
        payloadOf(
          sent(
            (m) =>
              m.kind === "pullResponse" && m.client === "B" && m.label === "v1",
          ),
          timeline,
        ),
      ).toEqual(["response v1", "Milk · new"]);
      expect(
        payloadOf(
          sent(
            (m) =>
              m.kind === "pullResponse" && m.client === "A" && m.label === "v2",
          ),
          timeline,
        ),
      ).toEqual(["response v2", "Milk · changed"]);
    }),
  );

  it.effect(
    "lists the rows a pull's response takes away, and not the rows renumbered after them",
    () =>
      Effect.gen(function* () {
        const { timeline, beats } = yield* runHeadless(REMOVE_FIRST_SCENE);
        const removal = beats[1];
        const { entry } = entryWhere(
          timeline,
          (e) =>
            e._tag === "Sent" &&
            e.message.kind === "pullResponse" &&
            e.message.client === "B" &&
            e.seq >= (removal?.firstSeq ?? 0),
        );
        if (entry.event._tag !== "Sent") throw new Error("not a send");
        expect(payloadOf(entry.event.message, timeline)).toEqual([
          "response v4",
          "Bananas · gone",
        ]);
      }),
  );

  plain("says only its label for a message the timeline never sent", () => {
    const message: Message = {
      id: 999,
      client: "A",
      kind: "push",
      label: "#9",
      sentAt: 0,
      departedAt: 0,
      arriveAt: 100,
      fate: "inFlight",
    };
    expect(payloadOf(message, EMPTY_TIMELINE)).toEqual(["push #9"]);
  });
});

describe("a classic phone's messages", () => {
  it.effect(
    "carry the request's body, and the reply's whole list, with item ids cut short",
    () =>
      Effect.gen(function* () {
        const timeline = yield* recordClassicLife;
        const cards = timeline.entries.flatMap(({ event }) =>
          event._tag === "Sent" &&
          (event.message.kind === "request" ||
            event.message.kind === "response")
            ? [payloadOf(event.message, timeline)]
            : [],
        );
        expect(cards[0]).toEqual(["GET /items", "asks for the list"]);
        expect(cards[1]).toEqual(["200 · v0", "0 items, the whole list"]);
        expect(cards[2]).toEqual(["POST /items", '{ name: "Eggs" }']);
        expect(cards[3]).toEqual(["200 · v2", "2 items, the whole list"]);
        const removal = cards.find((card) => card[0]?.startsWith("DELETE"));
        expect(removal?.[0]).toMatch(/^DELETE \/items\/[0-9a-f]{4}…$/);
        expect(removal?.[1]).toBe("Eggs");
      }),
  );

  plain(
    "cuts an item path's id to four characters, and leaves other labels",
    () => {
      expect(
        shownLabel("PATCH /items/3f2a9c1e-0b5d-4a2e-8f00-123456789abc"),
      ).toBe("PATCH /items/3f2a…");
      expect(shownLabel("POST /items")).toBe("POST /items");
      expect(shownLabel("200 · v7")).toBe("200 · v7");
      expect(shownLabel("#3–#5")).toBe("#3–#5");
    },
  );
});
