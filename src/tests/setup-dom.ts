import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library unmounts after each test on its own only when the test
// globals are on; this project imports them instead.
afterEach(cleanup);

// React warns about `act` unless the environment says it supports it.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// jsdom has no modal dialogs: open and close them by their attribute, as a
// browser's `showModal` and `close` do.
if (!("showModal" in HTMLDialogElement.prototype)) {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
    close(this: HTMLDialogElement) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  });
}
