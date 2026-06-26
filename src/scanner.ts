import type {
  TextCodePointRange,
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
  const text = normalizeTextInput(value);
  return {
    text,
    codePoints: Array.from(text),
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
  const input = createTextScanInput(value);
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
