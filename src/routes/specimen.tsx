import { createFileRoute, notFound } from "@tanstack/react-router";
import { Specimen } from "#/app/specimen";

export const Route = createFileRoute("/specimen")({
  // Development only: every component in every state on one page, for the
  // finish review's screenshots and for anyone restyling a component.
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: Specimen,
});
