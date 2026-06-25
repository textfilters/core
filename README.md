# @textfilters/core

Core TypeScript primitives for composable text filtering, content moderation,
censoring, redaction, normalization, range masking, and moderation pipelines.

Use `@textfilters/core` as the shared foundation for a TypeScript text filtering
library, chat moderation workflow, UGC moderation service, or custom pipeline
that combines URL detection, email detection, phone number detection, profanity
filtering, and anti-spam checks.

## Installation

The initial `@textfilters/core` release is published as a public package in GitHub Packages.

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires authentication for npm installs, including public packages.

```sh
npm install @textfilters/core
```

## Use Cases

- Compose multiple content moderation filters into one ordered pipeline.
- Apply consistent censoring and redaction over UTF-16 and code point ranges.
- Normalize user-generated text before package-specific matching.
- Share filter contracts across chat moderation and UGC moderation features.

## Usage

```ts
import {
  createCachedTextProcessor,
  createTextPipeline,
  lowerNfkc,
  type TextCensor,
} from "@textfilters/core";

const censor: TextCensor = {
  name: "example",
  censor: (text) => text.replaceAll("secret", "******"),
};

const safeText = createTextPipeline().use(censor).censor("secret message");

const normalizeRepeatedText = createCachedTextProcessor(
  (text) => lowerNfkc(text),
  { maxEntries: 256 },
);

const normalized = normalizeRepeatedText.process("ＨＥＬＬＯ");
```

## API

- `createTextPipeline()`
- `createCachedTextProcessor(processor, options)`
- `normalizeTextInput(value)`
- `lowerNfkc(value)`
- `stripZeroWidth(value)`
- `normalizeVisibleMaskChar(maskChar)`
- `normalizeLengthPreservingMaskChar(maskChar)`
- `normalizeMaskChar(maskChar)`
- `toCodePoints(value)`
- `mergeRanges(ranges)`
- `mergeCodePointRanges(ranges)`
- `maskRange(value, range, maskChar)`
- `maskRanges(value, ranges, maskChar)`
- `maskCodePointRanges(codePoints, ranges, maskChar)`
- `maskCodePointRangesPreservingLength(codePoints, ranges, maskChar)`
- `censorCodePointRanges(codePoints, ranges, maskChar)`

### Public Input Normalization

`normalizeTextInput()` converts public text-like input to a string while mapping
`null` and `undefined` to an empty string. This is the shared public input
contract for textfilters packages: public censor, analyze, and check helpers
should normalize raw caller input with `normalizeTextInput()` before matching or
masking. Non-nullish values use JavaScript string conversion, so numbers,
booleans, symbols, and objects keep the same behavior as `String(value)`.

Matching helpers such as `lowerNfkc()`, `stripZeroWidth()`, and `toCodePoints()`
use the same nullish input behavior.

`createCachedTextProcessor()` creates an opt-in, per-instance bounded cache for
pure repeated text processing. Use it when the same text is normalized, parsed,
or transformed repeatedly with the same configuration. Each helper owns its own
cache, `maxEntries` bounds the retained text entries, and `clear()` drops cached
results without changing configuration.

Do not use `createCachedTextProcessor()` for stateful guard checks, actor-aware
rate limits, time-dependent decisions, or processors whose result depends on
external mutable state. It has no hidden global behavior and does not affect
existing filters unless callers explicitly opt in.

`normalizeVisibleMaskChar()` keeps visible masking to one user-visible code
point. `normalizeMaskChar()` remains a backwards-compatible alias for that
behavior. `normalizeLengthPreservingMaskChar()` is stricter and returns one
UTF-16 code unit, falling back to `*` for empty or astral mask values.

`maskCodePointRanges()` masks each covered code point with one normalized mask
code point and does not split surrogate pairs. This keeps existing callers
stable when code point counts are the intended unit.

`maskCodePointRangesPreservingLength()` is for filters that collect code point
ranges but need censored output to preserve the source UTF-16 string length. It
repeats a BMP mask character by the UTF-16 width of each covered source code
point, so an astral source symbol is replaced by two BMP mask characters. Empty
mask values use `*`. Astral mask characters also fall back to `*` because using
them for BMP source code points would expand the output length.

`censorCodePointRanges()` is the small shared helper for packages that already
collect code point ranges and only need length-preserving censored output. It
returns the original code points joined when there are no ranges and otherwise
delegates to `maskCodePointRangesPreservingLength()`.

## Related Textfilters Packages

- `@textfilters/url` for URL detection, obfuscated links, and safe link
  censoring.
- `@textfilters/email` for email detection and contact redaction.
- `@textfilters/phone` for phone number detection and contact redaction.
- `@textfilters/profanity` for Russian profanity filtering and taxonomy-backed
  moderation.
- `@textfilters/spam` for actor-based anti-spam guard checks.

## Release

Releases are managed by Release Please from Conventional Commit history on `main`. When a Release Please release is created, the workflow runs `npm run check` and publishes the package to GitHub Packages. Release tags keep the `v*` pattern.

The package is prepared for publication to GitHub Packages, not the public npm registry.

## License

MIT
