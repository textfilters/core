import { describe, expect, it } from "vitest";
import {
  createTextPipeline,
  lowerNfkc,
  maskCodePointRanges,
  maskRange,
  maskRanges,
  mergeCodePointRanges,
  mergeRanges,
  normalizeMaskChar,
  stripZeroWidth,
  toCodePoints,
  type TextCensor,
  type TextGuard,
  type TextGuardResult,
} from "./index";

describe("textfilters core contracts", () => {
  it("allows censors and guards to share stable shapes", () => {
    const censor: TextCensor = {
      name: "test-censor",
      censor: (value) => value.replace("secret", "******"),
    };
    const result: TextGuardResult = {
      allowed: false,
      reason: "blocked",
    };
    const guard: TextGuard = {
      name: "test-guard",
      check: () => result,
    };

    expect(censor.censor("secret")).toBe("******");
    expect(guard.check({ text: "value" })).toEqual(result);
  });
});

describe("textfilters core normalization helpers", () => {
  it("converts unknown values to code points", () => {
    expect(toCodePoints("a😀b")).toEqual(["a", "😀", "b"]);
    expect(toCodePoints(null)).toEqual([]);
    expect(toCodePoints(undefined)).toEqual([]);
  });

  it("normalizes with lower-case NFKC", () => {
    expect(lowerNfkc("ＨＥＬＬＯ")).toBe("hello");
  });

  it("strips zero-width characters", () => {
    expect(stripZeroWidth("he\u200bllo\ufeff")).toBe("hello");
    expect(stripZeroWidth("bad\u2060word")).toBe("badword");
  });

  it("normalizes mask char to one code point", () => {
    expect(normalizeMaskChar()).toBe("*");
    expect(normalizeMaskChar("##")).toBe("#");
    expect(normalizeMaskChar("😀x")).toBe("😀");
  });
});

describe("textfilters core code point helpers", () => {
  it("masks ranges without splitting surrogate pairs", () => {
    expect(maskRange("a😀z", [1, 2])).toBe("a*z");
  });

  it("masks code point index ranges", () => {
    expect(maskCodePointRanges(Array.from("a😀z"), [[1, 2]])).toBe("a*z");
    expect(maskCodePointRanges(Array.from("abc"), [[0.5, 2.5]])).toBe("**c");
    expect(maskCodePointRanges(Array.from("abc"), [[0, 2]], "")).toBe("**c");
    expect(maskCodePointRanges(Array.from("abc"), [[0, 2]], "##")).toBe("##c");
  });
});

describe("textfilters pipeline", () => {
  it("runs censors in registration order", () => {
    const replaceA: TextCensor = {
      censor: (text) => text.replaceAll("a", "b"),
    };
    const replaceB: TextCensor = {
      censor: (text) => text.replaceAll("b", "c"),
    };

    const pipeline = createTextPipeline().use(replaceA).use(replaceB);

    expect(pipeline.censor("a-b")).toBe("c-c");
  });

  it("runs guards before censoring", () => {
    const guard: TextGuard = {
      check: ({ text }) =>
        text === "blocked"
          ? { allowed: false, reason: "blocked" }
          : { allowed: true },
    };
    const censor: TextCensor = {
      censor: () => "censored",
    };

    const pipeline = createTextPipeline().guard(guard).use(censor);

    expect(pipeline.process({ text: "blocked" })).toEqual({
      allowed: false,
      reason: "blocked",
    });
    expect(pipeline.process({ text: "allowed" })).toEqual({
      allowed: true,
      text: "censored",
    });
  });

  it("passes actor metadata to guards", () => {
    const seen: Array<string | undefined> = [];
    const guard: TextGuard = {
      check: ({ actorKey }) => {
        seen.push(actorKey);
        return { allowed: true };
      },
    };

    createTextPipeline().guard(guard).check({
      actorKey: "user-1",
      text: "hi",
    });
    expect(seen).toEqual(["user-1"]);
  });
});

describe("textfilters core range helpers", () => {
  it("sorts and merges overlapping or adjacent ranges", () => {
    expect(
      mergeRanges([
        [5, 8],
        [1, 3],
        [3, 5],
        [20, 21],
      ]),
    ).toEqual([
      [1, 8],
      [20, 21],
    ]);
  });

  it("ignores invalid ranges", () => {
    expect(
      mergeRanges([
        [3, 3],
        [5, 1],
        [1, 2],
      ]),
    ).toEqual([[1, 2]]);
  });

  it("sorts and merges code point ranges", () => {
    expect(
      mergeCodePointRanges([
        [5, 7],
        [1, 3],
        [3, 4],
        [10.8, 10.2],
      ]),
    ).toEqual([
      [1, 4],
      [5, 7],
    ]);
  });

  it("masks merged ranges in one pass", () => {
    expect(
      maskRanges("call me now", [
        [0, 4],
        [5, 7],
      ]),
    ).toBe("**** ** now");
  });

  it("masks ranges while preserving surrounding text", () => {
    expect(maskRanges("hello world", [[6, 11]])).toBe("hello *****");
    expect(maskRanges("a😀b", [[1, 2]], "#")).toBe("a#b");
    expect(maskRanges("a😀b", [[3, 4]], "#")).toBe("a😀#");
    expect(maskRanges("a😀b", [[2, 3]], "#")).toBe("a#b");
  });

  it("clamps ranges to text boundaries", () => {
    expect(maskRanges("abc", [[-10, 2]])).toBe("**c");
    expect(maskRanges("abc", [[1, 10]])).toBe("a**");
  });

  it("keeps text unchanged for empty inputs, empty masks, and empty ranges", () => {
    expect(maskRanges("", [[0, 1]])).toBe("");
    expect(maskRanges("value", [])).toBe("value");
  });

  it("normalizes empty mask char to the default mask", () => {
    expect(maskRanges("value", [[0, 2]], "")).toBe("**lue");
    expect(maskRanges("value", [])).toBe("value");
  });
});
