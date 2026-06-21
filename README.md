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
import { createTextPipeline, type TextCensor } from "@textfilters/core";

const censor: TextCensor = {
  name: "example",
  censor: (text) => text.replaceAll("secret", "******"),
};

const safeText = createTextPipeline().use(censor).censor("secret message");
```

## API

- `createTextPipeline()`
- `lowerNfkc(value)`
- `stripZeroWidth(value)`
- `normalizeMaskChar(maskChar)`
- `toCodePoints(value)`
- `mergeRanges(ranges)`
- `mergeCodePointRanges(ranges)`
- `maskRange(value, range, maskChar)`
- `maskRanges(value, ranges, maskChar)`
- `maskCodePointRanges(codePoints, ranges, maskChar)`
- `maskCodePointRangesPreservingLength(codePoints, ranges, maskChar)`

`maskCodePointRanges()` masks each covered code point with one normalized mask
code point and does not split surrogate pairs. This keeps existing callers
stable when code point counts are the intended unit.

`maskCodePointRangesPreservingLength()` is for filters that collect code point
ranges but need censored output to preserve the source UTF-16 string length. It
repeats a BMP mask character by the UTF-16 width of each covered source code
point, so an astral source symbol is replaced by two BMP mask characters. Empty
mask values use `*`. Astral mask characters also fall back to `*` because using
them for BMP source code points would expand the output length.

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
