import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library unmounts after each test on its own only when the test
// globals are on; this project imports them instead.
afterEach(cleanup);

// React warns about `act` unless the environment says it supports it.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
