import { Effect, Layer, Random } from "effect";

// A generator seeded with `seed`: `Random.withSeed` provides one, and reading
// `Random.Random` inside it hands that generator back. `withSeed` builds the
// stateful generator when it is called, so suspend to get a fresh one (at the
// start of the sequence) every time the effect runs.
const generator = (seed: string) =>
  Effect.suspend(() => Random.withSeed(Effect.service(Random.Random), seed));

// The engine's randomness for one world (retry jitter), from its seed: the
// same seed replays the same backoff.
export const seededRandom = (seed: string) =>
  Layer.effect(Random.Random, generator(seed));

const toUuid = (next: () => number): string => {
  const bytes = Array.from({ length: 16 }, () => Math.floor(next() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

// v4 UUIDs for one world, drawn from a stream of their own so that minting an
// id never moves the engine's jitter (see the plan: replay re-applies intents
// that already carry their ids).
export const makeIds = (seed: string): Effect.Effect<() => string> =>
  Effect.map(
    generator(`${seed}:ids`),
    (random) => () => toUuid(() => random.nextDoubleUnsafe()),
  );
