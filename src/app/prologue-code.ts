// The prologue's code: the classic phone's add handler, lit line by line as
// the classic phone runs it, and the app's own add beside it.
import addIntent from "#/app/grocery-app.tsx?region=add-intent&from=src/lib/sandbox/classic/handlers.ts:classic-add&morph";
import classicAdd from "#/lib/sandbox/classic/handlers.ts?region=classic-add&snippet";
import type { ClientName, TraceEvent } from "#/lib/sandbox/trace";
import type { FigureCode } from "#/ui/figure/figure";

const POST = "POST ";

// An event of `client`'s add: its handler's own events carry the request's
// label, which an add's starts with POST. A refresh's, a check's and a
// removal's run other handlers, not on screen, and light nothing.
const addOf = (event: TraceEvent, client: ClientName): boolean =>
  "client" in event &&
  event.client === client &&
  "label" in event &&
  event.label.startsWith(POST);

// The classic add, lit as `client` runs it: the saving flag up, the await on
// the wire, the rows set from the reply or the error kept, and the flag down.
// The handler's events land in its order, so the lights go down the lines.
export const classicAddCode = (client: ClientName): FigureCode => ({
  title: "A classic add",
  snippet: classicAdd,
  lights: [
    {
      span: "finally",
      when: (event) => event._tag === "SavingEnded" && addOf(event, client),
    },
    {
      span: "catch",
      when: (event) => event._tag === "SaveFailed" && addOf(event, client),
    },
    {
      span: "set-items",
      when: (event) => event._tag === "Saved" && addOf(event, client),
    },
    {
      span: "await",
      when: (event) =>
        event._tag === "Sent" &&
        event.message.kind === "request" &&
        event.message.client === client &&
        event.message.label.startsWith(POST),
    },
    {
      span: "start",
      when: (event) => event._tag === "SavingBegan" && addOf(event, client),
    },
  ],
});

// The app's own add beside the classic one: the handler morphs into the one
// line that applies an AddItem intent.
export const ADD_INTENT = addIntent;
