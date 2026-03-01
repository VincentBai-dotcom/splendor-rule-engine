# v1

`v1` is the first package in this repository's Codex evaluation flow for building a Splendor rule engine.

## Method

This version uses a minimal bootstrap strategy:

- start from a basic Bun package scaffold
- keep the setup lightweight so the package can serve as a clean baseline
- use that baseline as the first Codex-generated version to iterate from

In other words, `v1` captures the simplest starting point before introducing more opinionated prompts, workflows, or review loops in later versions.

## What this package contains

- a Bun-based TypeScript package scaffold
- the initial files Codex can build on for future Splendor rule-engine work

## How to use it

Install dependencies from the repo root:

```bash
bun install
```

Run the package directly:

```bash
bun run packages/v1/index.ts
```

## Notes

- This package is intentionally lightweight.
- Later packages should document how their Codex strategy differs from `v1`.
