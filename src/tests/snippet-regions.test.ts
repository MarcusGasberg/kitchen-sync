import { describe, expect, it } from "vitest";
import { dedent, extractRegion, sliceLines } from "#/build/regions";

// A file with a region, two spans inside it, and code on either side.
const SOURCE = [
  "const before = 1;",
  "export const loop = () => {",
  "  // #region loop",
  "  const a = 1;",
  "  // #region wake",
  "  wake();",
  "  // #endregion",
  "",
  "  // #region send",
  "  send(a);",
  "  settle();",
  "  // #endregion",
  "  // #endregion",
  "};",
].join("\n");

describe("extractRegion", () => {
  it("keeps the region's lines without their markers, dedented", () => {
    expect(extractRegion(SOURCE, "loop", "src/f.ts").code).toBe(
      ["const a = 1;", "wake();", "", "send(a);", "settle();"].join("\n"),
    );
  });

  it("names the lines of each region inside it as a span", () => {
    expect(extractRegion(SOURCE, "loop", "src/f.ts").spans).toEqual({
      wake: { from: 1, to: 2 },
      send: { from: 3, to: 5 },
    });
  });

  it("reads a span as a snippet of its own", () => {
    expect(extractRegion(SOURCE, "send", "src/f.ts")).toEqual({
      code: "send(a);\nsettle();",
      spans: {},
    });
  });

  it("reads a file with Windows line ends", () => {
    expect(
      extractRegion(SOURCE.replaceAll("\n", "\r\n"), "send", "src/f.ts").code,
    ).toBe("send(a);\nsettle();");
  });

  it("names the file and the region it cannot find", () => {
    expect(() => extractRegion(SOURCE, "push", "src/f.ts")).toThrow(
      'src/f.ts has no region "push"',
    );
  });

  it("refuses two regions of one name", () => {
    const twice = `${SOURCE}\n// #region loop\nx();\n// #endregion`;
    expect(() => extractRegion(twice, "loop", "src/f.ts")).toThrow(
      'src/f.ts has 2 regions named "loop"',
    );
  });

  it("refuses a region with no end", () => {
    const open = "// #region loop\nx();\n// #region wake\ny();\n// #endregion";
    expect(() => extractRegion(open, "loop", "src/f.ts")).toThrow(
      'src/f.ts: region "loop" has no #endregion',
    );
  });

  it("refuses an empty region and an empty span", () => {
    expect(() =>
      extractRegion("// #region loop\n\n// #endregion", "loop", "src/f.ts"),
    ).toThrow('src/f.ts: region "loop" is empty');
    expect(() =>
      extractRegion(
        "// #region loop\nx();\n// #region wake\n// #endregion\n// #endregion",
        "loop",
        "src/f.ts",
      ),
    ).toThrow('src/f.ts: span "wake" in region "loop" is empty');
  });

  it("refuses two spans of one name", () => {
    const twice = [
      "// #region loop",
      "// #region send",
      "x();",
      "// #endregion",
      "// #region send",
      "y();",
      "// #endregion",
      "// #endregion",
    ].join("\n");
    expect(() => extractRegion(twice, "loop", "src/f.ts")).toThrow(
      'src/f.ts: region "loop" has two spans named "send"',
    );
  });

  // A span is looked up as an own property, so a name an object inherits
  // is a span like any other.
  it("takes a span named like an object's inherited property", () => {
    const named =
      "// #region loop\n// #region toString\nx();\n// #endregion\n// #endregion";
    const { spans } = extractRegion(named, "loop", "src/f.ts");
    expect(Object.keys(spans)).toEqual(["toString"]);
  });
});

describe("sliceLines", () => {
  it("takes a file's lines, markers out, dedented", () => {
    expect(sliceLines(SOURCE, 4, 6, "src/f.ts at 7622158")).toBe(
      "const a = 1;\nwake();",
    );
  });

  it("names the lines a file lacks", () => {
    expect(() => sliceLines(SOURCE, 10, 20, "src/f.ts at 7622158")).toThrow(
      "src/f.ts at 7622158 has no lines 10–20 (it has 14)",
    );
    expect(() => sliceLines(SOURCE, 6, 4, "src/f.ts at 7622158")).toThrow(
      "src/f.ts at 7622158 has no lines 6–4",
    );
  });
});

describe("dedent", () => {
  it("takes off the indent every line shares, and empties blank lines", () => {
    expect(dedent(["    a", "      b", "  ", "    c"])).toEqual([
      "a",
      "  b",
      "",
      "c",
    ]);
  });
});
