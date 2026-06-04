export interface TextCensor {
  readonly name?: string;
  censor(value: string): string;
}

export interface TextGuardInput {
  readonly actorKey?: string;
  readonly text: string;
  readonly nowMs?: number;
}

export type TextGuardReason = string;

export type TextGuardAllowedResult = {
  readonly allowed: true;
};

export type TextGuardBlockedResult = {
  readonly allowed: false;
  readonly reason: TextGuardReason;
};

export type TextGuardResult = TextGuardAllowedResult | TextGuardBlockedResult;

export interface TextGuard {
  readonly name?: string;
  check(input: TextGuardInput): TextGuardResult;
}

export type TextPipelineProcessedResult = {
  readonly allowed: true;
  readonly text: string;
};

export type TextPipelineProcessResult =
  | TextPipelineProcessedResult
  | TextGuardBlockedResult;

/**
 * Composes guards and censors in deterministic registration order.
 */
export interface TextPipeline {
  use(censor: TextCensor): TextPipeline;
  guard(guard: TextGuard): TextPipeline;
  censor(text: string): string;
  check(input: TextGuardInput): TextGuardResult;
  process(input: TextGuardInput): TextPipelineProcessResult;
}

export type TextRange = readonly [start: number, end: number];
export type TextCodePointRange = readonly [start: number, end: number];

const ZERO_WIDTH_RE = /[\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Normalizes arbitrary input for case-insensitive matching with compatibility
 * forms such as fullwidth Latin letters folded to their canonical shape.
 */
export function lowerNfkc(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase();
}

/**
 * Removes invisible joiner-like characters before filters compare user text.
 */
export function stripZeroWidth(value: unknown): string {
  return String(value ?? "").replace(ZERO_WIDTH_RE, "");
}

/**
 * Keeps masking length stable by using exactly one user-visible code point.
 */
export function normalizeMaskChar(maskChar?: unknown): string {
  return Array.from(String(maskChar ?? "*"))[0] ?? "*";
}

/**
 * Builds a small in-order moderation pipeline: guards can block the original
 * input before registered censors transform the text.
 */
export function createTextPipeline(): TextPipeline {
  const censors: TextCensor[] = [];
  const guards: TextGuard[] = [];

  const pipeline: TextPipeline = {
    use(censor) {
      censors.push(censor);
      return pipeline;
    },

    guard(guard) {
      guards.push(guard);
      return pipeline;
    },

    censor(text) {
      return censors.reduce((current, censor) => censor.censor(current), text);
    },

    check(input) {
      for (const guard of guards) {
        const result = guard.check(input);
        if (!result.allowed) return result;
      }
      return { allowed: true };
    },

    process(input) {
      const result = pipeline.check(input);
      if (!result.allowed) return result;
      return {
        allowed: true,
        text: pipeline.censor(input.text),
      };
    },
  };

  return pipeline;
}

export function toCodePoints(value: unknown): string[] {
  return Array.from(String(value ?? ""));
}

/**
 * Drops invalid UTF-16 string-index ranges before callers merge or mask spans.
 */
function normalizeRange(range: TextRange): TextRange | null {
  const start = Math.trunc(Number(range[0]));
  const end = Math.trunc(Number(range[1]));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end <= start) return null;
  return [start, end];
}

export function mergeRanges(ranges: readonly TextRange[]): TextRange[] {
  const sorted = ranges
    .map(normalizeRange)
    .filter((range): range is TextRange => range !== null)
    .sort((left, right) => left[0] - right[0]);

  const merged: Array<[number, number]> = [];

  for (const [start, end] of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || start > previous[1]) {
      merged.push([start, end]);
      continue;
    }
    previous[1] = Math.max(previous[1], end);
  }

  return merged;
}

/**
 * Merges ranges that are already expressed in code point indexes.
 */
export function mergeCodePointRanges(
  ranges: readonly TextCodePointRange[],
): readonly TextCodePointRange[] {
  if (ranges.length === 0) return [];

  const sorted = ranges
    .map(normalizeRange)
    .filter((range): range is TextCodePointRange => range !== null)
    .sort((left, right) => left[0] - right[0]);
  if (sorted.length === 0) return [];
  const merged: Array<[number, number]> = [[sorted[0][0], sorted[0][1]]];

  for (let i = 1; i < sorted.length; i++) {
    const [start, end] = sorted[i];
    const previous = merged[merged.length - 1];
    if (start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}

export function maskRange(value: string, range: TextRange, mask = "*"): string {
  return maskRanges(value, [range], mask);
}

/**
 * Masks code point ranges without splitting surrogate pairs.
 */
export function maskCodePointRanges(
  codePoints: readonly string[],
  ranges: readonly TextCodePointRange[],
  mask = "*",
): string {
  if (ranges.length === 0) return codePoints.join("");

  const maskChar = normalizeMaskChar(mask);
  const masked = new Array<boolean>(codePoints.length).fill(false);
  for (const [start, end] of mergeCodePointRanges(ranges)) {
    const left = Math.max(0, start);
    const right = Math.min(codePoints.length, end);
    for (let i = left; i < right; i++) masked[i] = true;
  }

  return codePoints
    .map((codePoint, index) => (masked[index] ? maskChar : codePoint))
    .join("");
}

export function maskRanges(
  value: string,
  ranges: readonly TextRange[],
  maskChar?: unknown,
): string {
  const source = String(value ?? "");
  if (source.length === 0 || ranges.length === 0) return source;

  const merged = mergeRanges(ranges);
  if (merged.length === 0) return source;

  const mask = normalizeMaskChar(maskChar);
  let offset = 0;
  let rangeIndex = 0;

  // Iterate by code point while tracking UTF-16 offsets, because TextRange
  // callers use string indexes but masking must not split astral characters.
  return Array.from(source)
    .map((codePoint) => {
      const start = offset;
      const end = start + codePoint.length;
      offset = end;

      while (rangeIndex < merged.length && merged[rangeIndex][1] <= start) {
        rangeIndex++;
      }

      const range = merged[rangeIndex];
      return range && range[0] < end && range[1] > start ? mask : codePoint;
    })
    .join("");
}
