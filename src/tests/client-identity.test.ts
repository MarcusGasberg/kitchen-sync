import { describe, expect, it } from "vitest";
import { ensureClientId } from "#/lib/client-identity";

const fakeStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
};

describe("ensureClientId", () => {
  it("survives having no storage at all (this is SSR)", () => {
    expect(() => ensureClientId(undefined)).not.toThrow();
    expect(ensureClientId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("is stable across calls once stored", () => {
    const storage = fakeStorage();
    expect(ensureClientId(storage)).toBe(ensureClientId(storage));
  });

  it("does not leak one browser's id into another", () => {
    expect(ensureClientId(fakeStorage())).not.toBe(
      ensureClientId(fakeStorage()),
    );
  });
});
