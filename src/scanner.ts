import type {
  AllocationAwareRangeScanner,
  PreparedText,
  RangeMatch,
  RangeMatchSink,
  TextCodePointRange,
  TextHints,
  TextRangePipeline,
  TextRangePipelineCensorResult,
  TextRangePipelineScanResult,
  TextRangeScanner,
  TextRangeScannerOutput,
  TextRangeScanMetadata,
  TextRangeScanResult,
  TextScanInput,
} from "./contracts.js";
import { normalizeTextInput } from "./input.js";
import { censorCodePointRanges } from "./masking.js";
import { mergeCodePointRanges } from "./ranges.js";

export function createTextScanInput(value: unknown): TextScanInput {
  const prepared = createPreparedText(value);
  return {
    text: prepared.text,
    codePoints: prepared.codePoints,
  };
}

export function createPreparedText(value: unknown): PreparedText {
  const text = normalizeTextInput(value);
  const codePoints = Array.from(text);
  return {
    text,
    codePoints,
    hints: createTextHints(text, codePoints),
  };
}

export function createTextHints(
  text: string,
  codePoints: readonly string[] = Array.from(text),
): TextHints {
  let digitCount = 0;
  let punctuationCount = 0;
  let hasAsciiLetter = false;
  let hasWhitespace = false;
  let hasNonAscii = false;
  let hasAtSign = false;
  let hasDot = false;
  let hasSlash = false;
  let hasColon = false;
  let hasPlus = false;

  for (const codePoint of codePoints) {
    const code = codePoint.codePointAt(0) ?? 0;

    if (code > 0x7f) {
      hasNonAscii = true;
      continue;
    }

    if (code >= 0x30 && code <= 0x39) {
      digitCount++;
      continue;
    }

    if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
      hasAsciiLetter = true;
      continue;
    }

    if (
      code === 0x20 ||
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      code === 0x0b ||
      code === 0x0c
    ) {
      hasWhitespace = true;
      continue;
    }

    if (code >= 0x21 && code <= 0x7e) {
      punctuationCount++;
    }

    hasAtSign ||= code === 0x40;
    hasDot ||= code === 0x2e;
    hasSlash ||= code === 0x2f;
    hasColon ||= code === 0x3a;
    hasPlus ||= code === 0x2b;
  }

  return {
    textLength: text.length,
    codePointLength: codePoints.length,
    isEmpty: text.length === 0,
    hasAsciiOnly: !hasNonAscii,
    hasNonAscii,
    hasDigit: digitCount > 0,
    digitCount,
    hasAsciiLetter,
    hasWhitespace,
    hasPunctuation: punctuationCount > 0,
    punctuationCount,
    hasAtSign,
    hasDot,
    hasSlash,
    hasColon,
    hasPlus,
  };
}

export function createTextRangeScanResult(
  ranges: readonly TextCodePointRange[],
  metadata?: TextRangeScanMetadata,
): TextRangeScanResult {
  return metadata === undefined
    ? { ranges: mergeCodePointRanges(ranges) }
    : { ranges: mergeCodePointRanges(ranges), metadata };
}

export function runTextRangeScanner(
  scanner: TextRangeScanner,
  input: TextScanInput,
): TextRangeScanResult {
  const prepared = ensurePreparedText(input);
  if (isAllocationAwareRangeScanner(scanner)) {
    const matches: RangeMatch[] = [];
    scanPreparedTextRanges(scanner, prepared, (match) => {
      matches.push(match);
    });
    return createTextRangeScanResult(matches.map((match) => match.range));
  }

  const output =
    typeof scanner === "function" ? scanner(input) : scanner.scan(input);
  return normalizeTextRangeScannerOutput(output);
}

export function createTextRangePipeline(): TextRangePipeline {
  const scanners: TextRangeScanner[] = [];

  const pipeline: TextRangePipeline = {
    use(scanner) {
      if (!isTextRangeScanner(scanner)) {
        throw new TypeError("scanner must be a function or scanner object");
      }

      scanners.push(scanner);
      return pipeline;
    },

    scan(value) {
      return scanTextRanges(value, scanners);
    },

    check(value) {
      return checkTextRanges(value, scanners);
    },

    censor(value, mask) {
      const result = pipeline.scan(value);
      return censorCodePointRanges(result.codePoints, result.ranges, mask);
    },

    process(value, mask) {
      const result = pipeline.scan(value);
      return {
        text: censorCodePointRanges(result.codePoints, result.ranges, mask),
        ranges: result.ranges,
        scanResults: result.scanResults,
      };
    },
  };

  return pipeline;
}

export function scanTextRanges(
  value: unknown,
  scanners: readonly TextRangeScanner[],
): TextRangePipelineScanResult {
  const input = createPreparedText(value);
  const scanResults = scanners.map((scanner) =>
    runTextRangeScanner(scanner, input),
  );
  const ranges = mergeCodePointRanges(
    scanResults.flatMap((result) => [...result.ranges]),
  );

  return {
    text: input.text,
    codePoints: input.codePoints,
    ranges,
    scanResults,
  };
}

export function checkTextRanges(
  value: unknown,
  scanners: readonly TextRangeScanner[],
): boolean {
  const input = createPreparedText(value);

  for (const scanner of scanners) {
    if (isAllocationAwareRangeScanner(scanner)) {
      if (scanner.check(input)) return true;
      continue;
    }

    if (runTextRangeScanner(scanner, input).ranges.length > 0) return true;
  }

  return false;
}

export function scanPreparedTextRanges(
  scanner: AllocationAwareRangeScanner,
  input: PreparedText,
  sink: RangeMatchSink,
): boolean {
  if (!scanner.check(input)) return true;

  let shouldContinue = true;
  const stoppingSink: RangeMatchSink = (match) => {
    const result = sink(match);
    shouldContinue = result !== false;
    return shouldContinue;
  };

  const result = scanner.scan(input, stoppingSink);
  return result === false ? false : shouldContinue;
}

function normalizeTextRangeScannerOutput(
  output: TextRangeScannerOutput,
): TextRangeScanResult {
  if (Array.isArray(output)) {
    return createTextRangeScanResult(output);
  }

  const result = output as TextRangeScanResult;
  return createTextRangeScanResult(result.ranges, result.metadata);
}

function isTextRangeScanner(scanner: unknown): scanner is TextRangeScanner {
  return (
    typeof scanner === "function" ||
    (typeof scanner === "object" &&
      scanner !== null &&
      "scan" in scanner &&
      typeof scanner.scan === "function")
  );
}

function isAllocationAwareRangeScanner(
  scanner: TextRangeScanner,
): scanner is AllocationAwareRangeScanner {
  return (
    typeof scanner === "object" &&
    scanner !== null &&
    "check" in scanner &&
    typeof scanner.check === "function" &&
    "scan" in scanner &&
    typeof scanner.scan === "function" &&
    scanner.scan.length >= 2
  );
}

function ensurePreparedText(input: TextScanInput): PreparedText {
  if ("hints" in input) return input as PreparedText;

  return {
    ...input,
    hints: createTextHints(input.text, input.codePoints),
  };
}
