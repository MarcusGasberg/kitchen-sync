import { createFileRoute } from "@tanstack/react-router";
import { GroceryApp } from "#/app/grocery-app";
import { groceryRuntime } from "#/app/grocery-runtime";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <GroceryApp runtime={groceryRuntime()} />;
}
