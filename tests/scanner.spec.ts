import { describe, expect, it } from "vitest";
import {
  checkTextRanges,
  createPreparedText,
  createTextHints,
  createTextRangePipeline,
  createTextRangeScanResult,
  createTextScanInput,
  runTextRangeScanner,
  scanPreparedTextRanges,
  scanTextRanges,
  type AllocationAwareRangeScanner,
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

  it("creates prepared text with reusable generic hints", () => {
    expect(createPreparedText("A+9@example.com/path:tail.")).toEqual({
      text: "A+9@example.com/path:tail.",
      codePoints: Array.from("A+9@example.com/path:tail."),
      hints: {
        textLength: 26,
        codePointLength: 26,
        isEmpty: false,
        hasAsciiOnly: true,
        hasNonAscii: false,
        hasDigit: true,
        digitCount: 1,
        hasAsciiLetter: true,
        hasWhitespace: false,
        hasPunctuation: true,
        punctuationCount: 6,
        hasAtSign: true,
        hasDot: true,
        hasSlash: true,
        hasColon: true,
        hasPlus: true,
      },
    });

    expect(createTextHints("a😀")).toMatchObject({
      textLength: 3,
      codePointLength: 2,
      hasAsciiOnly: false,
      hasNonAscii: true,
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

  it("runs allocation-aware scanner objects through a sink", () => {
    const input = createPreparedText("abc hit");
    const scanner: AllocationAwareRangeScanner = {
      check: (prepared) => prepared.hints.hasWhitespace,
      scan: (_prepared, sink) => {
        sink({ range: [4, 7] });
      },
    };

    expect(runTextRangeScanner(scanner, input)).toEqual({
      ranges: [[4, 7]],
    });
  });

  it("stops allocation-aware scanning when the sink returns false", () => {
    const input = createPreparedText("one two");
    const seen: string[] = [];
    const scanner: AllocationAwareRangeScanner = {
      check: () => true,
      scan: (_prepared, sink) => {
        seen.push("first");
        if (sink({ range: [0, 3] }) === false) return false;
        seen.push("second");
        sink({ range: [4, 7] });
      },
    };

    const completed = scanPreparedTextRanges(scanner, input, () => false);

    expect(completed).toBe(false);
    expect(seen).toEqual(["first"]);
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

    expect(pipeline.check("clean")).toBe(false);
    expect(pipeline.censor("clean")).toBe("clean");
    expect(pipeline.scan("clean")).toMatchObject({
      text: "clean",
      codePoints: ["c", "l", "e", "a", "n"],
      ranges: [],
      scanResults: [{ ranges: [] }],
    });
  });

  it("checks allocation-aware scanners without collecting matches", () => {
    const events: string[] = [];
    const scanner: AllocationAwareRangeScanner = {
      check: (input) => {
        events.push(`check:${input.hints.hasDot}`);
        return input.hints.hasDot;
      },
      scan: () => {
        events.push("scan");
      },
    };

    const pipeline = createTextRangePipeline().use(scanner);

    expect(pipeline.check("plain")).toBe(false);
    expect(pipeline.check("has.dot")).toBe(true);
    expect(events).toEqual(["check:false", "check:true"]);
  });

  it("reuses prepared text hints across registered scanners", () => {
    const seenHints: unknown[] = [];
    const first: AllocationAwareRangeScanner = {
      check: (input) => input.hints.hasDot,
      scan: (input, sink) => {
        seenHints.push(input.hints);
        sink({ range: [0, 1] });
      },
    };
    const second: AllocationAwareRangeScanner = {
      check: (input) => input.hints.hasDot,
      scan: (input, sink) => {
        seenHints.push(input.hints);
        sink({ range: [2, 3] });
      },
    };

    expect(scanTextRanges("a.b", [first, second]).ranges).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(seenHints[0]).toBe(seenHints[1]);
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
