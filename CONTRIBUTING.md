# Contributing to kinring

Thanks for the interest. A few notes to make a contribution land smoothly.

## Dev setup

```sh
git clone https://github.com/supaku/kinring.git
cd kinring
pnpm install
pnpm test          # vitest, no network, no database
pnpm build         # tsup → dist/, plus dist/embed.js
```

`pnpm ci` runs typecheck, tests, and build, which is what CI runs.

## Project layout

See [README.md → Layout](./README.md#layout).

## Ground rules

- The core (`src/core`) has no runtime dependencies and must stay that way.
- `src/payload` may import types from `payload` but must not require it at
  runtime for people who don't use it.
- The embed script is a plain string (`src/embed/script.ts`) so it can be
  served without a bundler. Keep it dependency-free and small.
- Every behaviour change comes with a test.

## Filing an issue

- For a bug: the ring JSON (redacted if you like), the request you made, and
  the observed vs. expected response.
- For a feature: lead with the use case.

## Pull requests

- Open against `main`. One change per PR.
- `pnpm ci` must pass.
