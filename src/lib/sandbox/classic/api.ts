import type { ClassicReply, ClassicRequest } from "./route";

// What the classic handlers see: a fetch-shaped API client, one call per
// request, a Promise of the server's answer. It rejects with a
// `ClassicHttpError` (`route.ts`): a null status for a network error, 4xx
// for a refusal the server decided. No timeout and no retry, as most
// hand-written API clients have none.
export interface ClassicApi {
  get(path: "/items"): Promise<ClassicReply>;
  post(path: "/items", body: { name: string }): Promise<ClassicReply>;
  patch(
    path: `/items/${string}`,
    body: { checked: boolean },
  ): Promise<ClassicReply>;
  delete(path: `/items/${string}`): Promise<ClassicReply>;
}

// `send` carries one request over the world's network and settles when the
// route's Effect does.
export const makeClassicApi = (
  send: (request: ClassicRequest) => Promise<ClassicReply>,
): ClassicApi => ({
  get: (path) => send({ method: "GET", path }),
  post: (path, body) => send({ method: "POST", path, body }),
  patch: (path, body) => send({ method: "PATCH", path, body }),
  delete: (path) => send({ method: "DELETE", path }),
});
