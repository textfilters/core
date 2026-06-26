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

export interface CachedTextProcessorOptions {
  readonly maxEntries?: number;
}

export interface CachedTextProcessor<T> {
  readonly maxEntries: number;
  readonly size: number;
  process(value: unknown): T;
  clear(): void;
}

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

export interface TextScanInput {
  readonly text: string;
  readonly codePoints: readonly string[];
}

export type TextRangeScanMetadata = Readonly<Record<string, unknown>>;

export interface TextRangeScanResult {
  readonly ranges: readonly TextCodePointRange[];
  readonly metadata?: TextRangeScanMetadata;
}

export type TextRangeScannerOutput =
  | readonly TextCodePointRange[]
  | TextRangeScanResult;

export type TextRangeScannerFunction = (
  input: TextScanInput,
) => TextRangeScannerOutput;

export type TextRangeScanner =
  | TextRangeScannerFunction
  | {
      readonly name?: string;
      scan(input: TextScanInput): TextRangeScannerOutput;
    };

export interface TextRangePipelineScanResult {
  readonly text: string;
  readonly codePoints: readonly string[];
  readonly ranges: readonly TextCodePointRange[];
  readonly scanResults: readonly TextRangeScanResult[];
}

export interface TextRangePipelineCensorResult {
  readonly text: string;
  readonly ranges: readonly TextCodePointRange[];
  readonly scanResults: readonly TextRangeScanResult[];
}

export interface TextRangePipeline {
  use(scanner: TextRangeScanner): TextRangePipeline;
  scan(value: unknown): TextRangePipelineScanResult;
  censor(value: unknown, mask?: string): string;
  process(value: unknown, mask?: string): TextRangePipelineCensorResult;
}
