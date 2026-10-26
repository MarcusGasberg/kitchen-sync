import { createFileRoute } from "@tanstack/react-router";
import {
  PROLOGUE_CODE,
  PROLOGUE_PHONES,
  PROLOGUE_SCENE,
} from "#/app/prologue-scene";
import { Presentation } from "#/ui/presentation";

export const Route = createFileRoute("/present/prologue")({
  head: () => ({ meta: [{ title: "Prologue · Kitchen Sync Presentation" }] }),
  component: ProloguePresentation,
});

function ProloguePresentation() {
  return (
    <Presentation
      name="Prologue"
      scene={PROLOGUE_SCENE}
      title="A classic phone beside a Kitchen Sync phone"
      code={PROLOGUE_CODE}
      weather={PROLOGUE_PHONES}
    />
  );
}
