# @textfilters/core

Core primitives and pipeline utilities for composable text filters.

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

## Release

Releases are managed by Release Please from Conventional Commit history on `main`. When a Release Please release is created, the workflow runs `npm run check` and publishes the package to GitHub Packages. Release tags keep the `v*` pattern.

The package is prepared for publication to GitHub Packages, not the public npm registry.

## License

MIT
