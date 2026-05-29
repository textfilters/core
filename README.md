# @textfilters/core

Core primitives and pipeline utilities for composable text filters.

This package contains only shared building blocks. It does not include URL detection, phone detection, profanity dictionaries, spam rules, network calls, databases, or external services.

## Installation

```sh
npm install @textfilters/core
```

## Usage

```ts
import { createTextPipeline } from "@textfilters/core";

const filter = createTextPipeline()
  .guard({
    check: ({ text }) =>
      text.trim() ? { allowed: true } : { allowed: false, reason: "empty" },
  })
  .use({
    censor: (text) => text.replaceAll("secret", "******"),
  });

const result = filter.process({
  actorKey: "user-1",
  text: "my secret message",
});

if (result.allowed) {
  console.log(result.text);
} else {
  console.log(result.reason);
}
```

## API

### `createTextPipeline()`

Creates a mutable pipeline with:

- `.guard(guard)` — registers a blocking guard such as a spam guard;
- `.use(censor)` — registers a text censor;
- `.check(input)` — runs guards only;
- `.censor(text)` — runs censors only;
- `.process(input)` — runs guards first, then censors.

### Utilities

- `toCodePoints(value)`
- `lowerNfkc(value)`
- `stripZeroWidth(value)`
- `normalizeMaskChar(maskChar?)`
- `mergeRanges(ranges)`
- `maskRanges(text, ranges, maskChar?)`

## Package boundaries

`@textfilters/core` should stay small and generic.

Domain-specific logic belongs in separate packages:

- `@textfilters/url`
- `@textfilters/phone`
- `@textfilters/profanity`
- `@textfilters/spam`
- `@textfilters/textfilters`

## Status

Early bootstrap. Public API may change before the first stable release.
