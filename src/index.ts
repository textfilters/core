export type {
  CachedTextProcessor,
  CachedTextProcessorOptions,
  TextCensor,
  TextCodePointRange,
  TextGuard,
  TextGuardAllowedResult,
  TextGuardBlockedResult,
  TextGuardInput,
  TextGuardReason,
  TextGuardResult,
  TextPipeline,
  TextPipelineProcessedResult,
  TextPipelineProcessResult,
  TextRange,
} from "./contracts.js";
export { createCachedTextProcessor } from "./cache.js";
export {
  lowerNfkc,
  normalizeLengthPreservingMaskChar,
  normalizeMaskChar,
  normalizeTextInput,
  normalizeVisibleMaskChar,
  stripZeroWidth,
  toCodePoints,
} from "./input.js";
export {
  censorCodePointRanges,
  maskCodePointRanges,
  maskCodePointRangesPreservingLength,
  maskRange,
  maskRanges,
} from "./masking.js";
export { createTextPipeline } from "./pipeline.js";
export { mergeCodePointRanges, mergeRanges } from "./ranges.js";
