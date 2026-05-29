import { describe, expect, it } from "vitest";

import {
  createTextPipeline,
  lowerNfkc,
  maskRanges,
  mergeRanges,
  normalizeMaskChar,
  stripZeroWidth,
  toCodePoints,
  type TextCensor,
  type TextGuard,
} from "../src/index.js";

describe("core utilities", () => {
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
  });

  it("normalizes mask char to one code point", () => {
    expect(normalizeMaskChar()).toBe("*");
    expect(normalizeMaskChar("##")).toBe("#");
    expect(normalizeMaskChar("😀x")).toBe("😀");
  });

  it("merges overlapping and touching ranges", () => {
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

  it("masks ranges while preserving surrounding text", () => {
    expect(maskRanges("hello world", [[6, 11]])).toBe("hello *****");
    expect(maskRanges("a😀b", [[1, 2]], "#")).toBe("a#b");
  });

  it("clamps ranges to text boundaries", () => {
    expect(maskRanges("abc", [[-10, 2]])).toBe("**c");
    expect(maskRanges("abc", [[1, 10]])).toBe("a**");
  });
});

describe("text pipeline", () => {
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

    createTextPipeline().guard(guard).check({ actorKey: "user-1", text: "hi" });

    expect(seen).toEqual(["user-1"]);
  });
});
