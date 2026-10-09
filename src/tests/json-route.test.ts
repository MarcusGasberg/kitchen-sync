import { afterAll, describe, expect, it } from "vitest";
import { PullRequest, PullResponse } from "../domain/mutation";
import { jsonRoute } from "../lib/json-route";
import { runtime } from "../lib/runtime";
import { SyncServerService } from "../lib/sync-server";

const handler = jsonRoute(
  { request: PullRequest, response: PullResponse },
  ({ clientId, lastAppliedVersion }) =>
    SyncServerService.use((server) =>
      server.pull(clientId, lastAppliedVersion),
    ),
);

const post = (body: string) =>
  handler({
    request: new Request("http://localhost/api/pull", {
      method: "POST",
      body,
    }),
  });

describe("jsonRoute", () => {
  afterAll(() => runtime.dispose());

  it("answers a valid request with 200 and the encoded response", async () => {
    const response = await post(
      JSON.stringify({ clientId: crypto.randomUUID(), lastAppliedVersion: 0 }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ lastMutationId: 0 });
  });

  it("answers a body that is not JSON with 400", async () => {
    expect((await post("{nope")).status).toBe(400);
  });

  it("answers a body that fails the schema with 400", async () => {
    const response = await post(
      JSON.stringify({ clientId: "not-a-uuid", lastAppliedVersion: 0 }),
    );

    expect(response.status).toBe(400);
  });
});
