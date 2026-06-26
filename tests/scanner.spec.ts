import { describe, expect, it } from "vitest";
import {
  createTextRangePipeline,
  createTextRangeScanResult,
  createTextScanInput,
  runTextRangeScanner,
  scanTextRanges,
  type TextRangeScanner,
  type TextScanInput,
} from "../src/index.js";

describe("textfilters scanner contracts", () => {
  it("creates scan input with source text and code points", () => {
    expect(createTextScanInput("a😀b")).toEqual({
      text: "a😀b",
      codePoints: ["a", "😀", "b"],
    });
    expect(createTextScanInput(null)).toEqual({
      text: "",
      codePoints: [],
    });
  });

  it("normalizes scanner results and preserves metadata", () => {
    expect(
      createTextRangeScanResult(
        [
          [4, 6],
          [1, 3],
          [2, 5],
        ],
        { kind: "test" },
      ),
    ).toEqual({
      ranges: [[1, 6]],
      metadata: { kind: "test" },
    });
  });

  it("runs scanner functions and scanner objects", () => {
    const input = createTextScanInput("abc");
    const functionScanner = () => [[0, 1]] as const;
    const objectScanner: TextRangeScanner = {
      name: "object-scanner",
      scan: () => ({ ranges: [[2, 3]], metadata: { source: "object" } }),
    };

    expect(runTextRangeScanner(functionScanner, input)).toEqual({
      ranges: [[0, 1]],
    });
    expect(runTextRangeScanner(objectScanner, input)).toEqual({
      ranges: [[2, 3]],
      metadata: { source: "object" },
    });
  });
});

describe("textfilters range scanner pipeline", () => {
  it("combines ranges from scanners in registration order and masks once", () => {
    const seen: string[] = [];
    const first: TextRangeScanner = {
      name: "first",
      scan: (input) => {
        seen.push(`first:${input.text}`);
        return [
          [1, 3],
          [5, 6],
        ];
      },
    };
    const second: TextRangeScanner = {
      name: "second",
      scan: (input) => {
        seen.push(`second:${input.codePoints.length}`);
        return [[2, 5]];
      },
    };

    const pipeline = createTextRangePipeline().use(first).use(second);

    expect(pipeline.censor("abcdef", "#")).toBe("a#####");
    expect(seen).toEqual(["first:abcdef", "second:6"]);
    expect(pipeline.scan("abcdef").ranges).toEqual([[1, 6]]);
  });

  it("returns scan results and censored text from process", () => {
    const pipeline = createTextRangePipeline()
      .use(() => [[0, 1]])
      .use(() => ({ ranges: [[3, 4]], metadata: { token: "tail" } }));

    expect(pipeline.process("abcd", "#")).toEqual({
      text: "#bc#",
      ranges: [
        [0, 1],
        [3, 4],
      ],
      scanResults: [
        { ranges: [[0, 1]] },
        { ranges: [[3, 4]], metadata: { token: "tail" } },
      ],
    });
  });

  it("keeps clean text unchanged when scanners return no ranges", () => {
    const pipeline = createTextRangePipeline().use(() => []);

    expect(pipeline.censor("clean")).toBe("clean");
    expect(pipeline.scan("clean")).toMatchObject({
      text: "clean",
      codePoints: ["c", "l", "e", "a", "n"],
      ranges: [],
      scanResults: [{ ranges: [] }],
    });
  });

  it("collects ranges from scanner functions without constructing a pipeline", () => {
    const scanner = (input: TextScanInput) =>
      input.text.includes("hit") ? [[0, 3] as const] : [];

    expect(scanTextRanges("hit", [scanner])).toMatchObject({
      text: "hit",
      codePoints: ["h", "i", "t"],
      ranges: [[0, 3]],
      scanResults: [{ ranges: [[0, 3]] }],
    });
  });

  it("rejects invalid scanner registrations", () => {
    expect(() => createTextRangePipeline().use({} as TextRangeScanner)).toThrow(
      "scanner must be a function or scanner object",
    );
  });
});
