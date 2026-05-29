export type TextRange = readonly [start: number, end: number];

export type TextCensor = {
  readonly name?: string;
  censor(text: string): string;
};

export type TextGuardInput = {
  readonly actorKey?: string;
  readonly text: string;
  readonly nowMs?: number;
};

export type TextGuardAllowedResult = {
  readonly allowed: true;
};

export type TextGuardBlockedResult = {
  readonly allowed: false;
  readonly reason: string;
};

export type TextGuardResult = TextGuardAllowedResult | TextGuardBlockedResult;

export type TextGuard = {
  readonly name?: string;
  check(input: TextGuardInput): TextGuardResult;
};

export type TextPipelineProcessedResult = {
  readonly allowed: true;
  readonly text: string;
};

export type TextPipelineProcessResult =
  | TextPipelineProcessedResult
  | TextGuardBlockedResult;

export type TextPipeline = {
  use(censor: TextCensor): TextPipeline;
  guard(guard: TextGuard): TextPipeline;
  censor(text: string): string;
  check(input: TextGuardInput): TextGuardResult;
  process(input: TextGuardInput): TextPipelineProcessResult;
};

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;

export function toCodePoints(value: unknown): string[] {
  return Array.from(String(value ?? ""));
}

export function lowerNfkc(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase();
}

export function stripZeroWidth(value: unknown): string {
  return String(value ?? "").replace(ZERO_WIDTH_RE, "");
}

export function normalizeMaskChar(maskChar?: unknown): string {
  return toCodePoints(maskChar ?? "*")[0] ?? "*";
}

function normalizeRange(range: TextRange): TextRange | null {
  const rawStart = Math.trunc(Number(range[0]));
  const rawEnd = Math.trunc(Number(range[1]));
  if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return null;
  if (rawEnd <= rawStart) return null;
  return [rawStart, rawEnd];
}

export function mergeRanges(ranges: readonly TextRange[]): TextRange[] {
  const sorted = ranges
    .map(normalizeRange)
    .filter((range): range is TextRange => range !== null)
    .sort((a, b) => a[0] - b[0]);

  const first = sorted[0];
  if (!first) return [];

  const merged: Array<[number, number]> = [[first[0], first[1]]];
  for (const [start, end] of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (!last) continue;
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}

export function maskRanges(
  text: string,
  ranges: readonly TextRange[],
  maskChar?: unknown,
): string {
  const codePoints = toCodePoints(text);
  if (codePoints.length === 0 || ranges.length === 0) {
    return codePoints.join("");
  }

  const mask = normalizeMaskChar(maskChar);
  const masked = new Array<boolean>(codePoints.length).fill(false);

  for (const [start, end] of mergeRanges(ranges)) {
    const left = Math.max(0, start);
    const right = Math.min(codePoints.length, end);
    for (let index = left; index < right; index += 1) {
      masked[index] = true;
    }
  }

  return codePoints
    .map((char, index) => (masked[index] ? mask : char))
    .join("");
}

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
