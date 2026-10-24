import { createFileRoute, notFound } from "@tanstack/react-router";
import { Lab } from "#/app/lab";

export const Route = createFileRoute("/lab")({
  // Development only: figures on synthetic scenes, for the finish review's
  // screenshots and for anyone working on the figure.
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: Lab,
});
