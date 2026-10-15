import { describe, expect, it, vi } from "vitest";

// Every page shares the root shell, the series' included, and none of them
// may start the app's sync engine or write a clientId: the shell must not
// even load them.
vi.mock("#/lib/sync", () => {
  throw new Error("the root shell loaded the sync engine");
});
vi.mock("#/app/grocery-runtime", () => {
  throw new Error("the root shell loaded the app's runtime");
});

describe("the root shell", () => {
  it("loads without the app's sync engine", async () => {
    await expect(import("#/routes/__root")).resolves.toHaveProperty("Route");
  });
});
