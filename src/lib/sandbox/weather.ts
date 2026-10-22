import { Duration, Effect } from "effect";
import type { RecordedInput } from "./inputs";
import type { ClientName } from "./trace";
import type { WorldHandle } from "./world";

// The weather is not an input of its own: it is every reader's phone's link
// set at once, with the network's own Latency and Offline inputs, so a replay
// and the readout both read it off the recorded inputs.

export type Weather = "office" | "cafe" | "train" | "tunnel";

// One-way link latency; the tunnel is offline.
export const WEATHERS: Record<
  Weather,
  { readonly label: string; readonly latencyMillis: number | null }
> = {
  office: { label: "office", latencyMillis: 80 },
  cafe: { label: "café", latencyMillis: 300 },
  train: { label: "train", latencyMillis: 900 },
  tunnel: { label: "tunnel", latencyMillis: null },
};

// Sets every named phone's link to `weather`, in one instant: into the
// tunnel, each goes offline; anywhere else, each gets the weather's latency
// and then, if it was in the tunnel, comes back online, so the first message
// out travels at the new latency. The tunnel keeps each link's latency.
export const setWeather =
  (clients: ReadonlyArray<ClientName>, weather: Weather) =>
  (world: WorldHandle): Effect.Effect<void> =>
    Effect.gen(function* () {
      const { offline } = yield* world.snapshot;
      const { latencyMillis } = WEATHERS[weather];
      for (const client of clients) {
        if (latencyMillis === null) {
          if (!offline.has(client)) yield* world.net.offline(client, true);
          continue;
        }
        yield* world.net.latency(client, Duration.millis(latencyMillis));
        if (offline.has(client)) yield* world.net.offline(client, false);
      }
    });

// The weather a link's latency names, if any (the tunnel is named by being
// offline, not by a latency).
const named = (latencyMillis: number): Weather | null =>
  (["office", "cafe", "train"] as const).find(
    (weather) => WEATHERS[weather].latencyMillis === latencyMillis,
  ) ?? null;

interface Link {
  readonly latencyMillis: number;
  readonly offline: boolean;
}

// The weather the named phones share at `at`, read off the recorded inputs:
// each phone's last latency (`startMillis`, the world's starting latency,
// until its first Latency input) and whether it is offline (the tunnel).
// "mixed" when they disagree, or when a phone's latency names no weather.
export const weatherAt = (
  inputs: ReadonlyArray<RecordedInput>,
  clients: ReadonlyArray<ClientName>,
  at: number,
  startMillis: number,
): Weather | "mixed" => {
  const links = new Map<ClientName, Link>(
    clients.map((client) => [
      client,
      { latencyMillis: startMillis, offline: false },
    ]),
  );
  for (const { at: time, input } of inputs) {
    if (time > at) break;
    if (input._tag !== "Latency" && input._tag !== "Offline") continue;
    const link = links.get(input.client);
    if (link === undefined) continue;
    links.set(
      input.client,
      input._tag === "Latency"
        ? { ...link, latencyMillis: input.millis }
        : { ...link, offline: input.offline },
    );
  }
  const weathers = new Set(
    [...links.values()].map((link): Weather | null =>
      link.offline ? "tunnel" : named(link.latencyMillis),
    ),
  );
  const [only] = weathers;
  return weathers.size === 1 && only !== null && only !== undefined
    ? only
    : "mixed";
};
