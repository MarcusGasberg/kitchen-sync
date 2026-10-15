import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { afterEach, describe, expect, it } from "vitest";
import { GroceryApp } from "#/app/grocery-app";
import { ensureClientId } from "#/lib/client-identity";
import type { ClientRuntime } from "#/lib/react";
import { StoreService } from "#/lib/store";
import { SyncEngineService } from "#/lib/sync";
import { SyncTransportService } from "#/lib/transport";

// The real engine and store over the in-memory server, on real timers: the
// screen as someone uses it.
const runtimes: Array<ClientRuntime> = [];
const fresh = (): ClientRuntime => {
  const runtime = ManagedRuntime.make(
    SyncEngineService.Live.pipe(
      Layer.provideMerge(
        Layer.mergeAll(
          StoreService.Live,
          SyncTransportService.Fake.pipe(
            Layer.provideMerge(FetchHttpClient.layer),
          ),
        ),
      ),
    ),
  );
  runtimes.push(runtime);
  return runtime;
};

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

const settle = { timeout: 3_000 };

const addItem = (name: string, category: string) => {
  fireEvent.change(screen.getByLabelText("Item"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Category"), {
    target: { value: category },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
};

const shelfEmpties = () =>
  waitFor(
    () =>
      expect(
        within(screen.getByRole("list", { name: "Outbox" })).queryAllByRole(
          "listitem",
        ),
      ).toHaveLength(0),
    settle,
  );

describe("the grocery app", () => {
  it("adds an item under its category, and the shelf empties as it syncs", async () => {
    render(<GroceryApp runtime={fresh()} />);
    addItem("Oat milk", "Dairy");

    const dairy = await screen.findByRole("region", { name: "Dairy" }, settle);
    expect(
      within(dairy).getByRole("checkbox", { name: "1 Oat milk" }),
    ).toBeTruthy();
    await shelfEmpties();
    expect(screen.getByText("Synced")).toBeTruthy();
  });

  it("checks one item off and removes another", async () => {
    render(<GroceryApp runtime={fresh()} />);
    addItem("Oat milk", "Dairy");
    addItem("Rye bread", "Bakery");

    fireEvent.click(
      await screen.findByRole("checkbox", { name: "1 Oat milk" }, settle),
    );
    await waitFor(
      () =>
        expect(
          screen.getByRole<HTMLInputElement>("checkbox", {
            name: "1 Oat milk",
          }).checked,
        ).toBe(true),
      settle,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove Rye bread" }, settle),
    );
    await waitFor(
      () => expect(screen.queryByRole("region", { name: "Bakery" })).toBeNull(),
      settle,
    );
    await shelfEmpties();
    expect(screen.getByRole("region", { name: "Dairy" }).textContent).toContain(
      "0 left",
    );
  });

  // The runtime outlives the route: leaving `/` and coming back keeps this
  // tab's list, and the engine runs again.
  it("shows this device's mark, and keeps the list when the app comes back", async () => {
    const runtime = fresh();
    const { unmount } = render(<GroceryApp runtime={runtime} />);
    const clientId = ensureClientId(localStorage);
    expect(
      await screen.findByTitle(`Device ${clientId}`, undefined, settle),
    ).toBeTruthy();
    addItem("Oat milk", "Dairy");
    await screen.findByRole("checkbox", { name: "1 Oat milk" }, settle);

    unmount();
    render(<GroceryApp runtime={runtime} />);
    expect(
      await screen.findByRole("checkbox", { name: "1 Oat milk" }, settle),
    ).toBeTruthy();
    await shelfEmpties();
  });
});
