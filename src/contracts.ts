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
