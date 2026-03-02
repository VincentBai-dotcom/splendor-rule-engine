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

## Prompt

Use the following prompt for the `v1` one-shot Codex run:

```text
Build an end-to-end rule engine for the board game Splendor in this package in one shot.

Context:
- This repository is a Codex evaluation sandbox.
- You are working inside `packages/v1`.
- The source materials live in the repo-level `static-assets/` directory.
- Use `static-assets/base__en__splendor-rulebook.pdf` as the rule reference.
- Use `static-assets/Splendor Cards.csv` as the source of development card data.

Goals:
- Implement a complete TypeScript rule engine for Splendor.
- Model the full game flow end to end: setup, turns, legal actions, reservations, purchases, token collection, gold jokers, discounts from purchased cards, nobles, victory points, turn progression, and game end conditions.
- Parse or otherwise load the card data from the CSV into the engine.
- Keep the implementation self-contained inside this package unless there is a strong reason not to.

Design requirements:
- Use object-oriented design for the key abstractions.
- Favor explicit domain models over loosely structured objects.
- Create classes for the core game concepts such as game, player, bank, card, deck, reserved cards, purchased cards, and action resolution.
- Keep rules enforcement inside the engine instead of pushing validation to callers.
- Make the design easy to extend and test.

Important data constraint:
- Noble tile data is not present in `static-assets/`.
- Do not invent a fake authoritative noble dataset and do not block on missing noble asset files.
- Instead, create the abstraction and engine support for noble tiles cleanly, so noble data can be plugged in later.
- If you need placeholder noble data for compilation or tests, isolate it clearly and mark it as non-authoritative.

Implementation expectations:
- Add the package structure, source files, and any supporting types needed for a usable engine.
- Expose a clear public API for creating a game, applying actions, querying legal moves, and inspecting game state.
- Include tests that cover the main rule flows and edge cases.
- Add or update package scripts if needed so the package can be run and tested with Bun.
- Document any assumptions or intentionally deferred details in this package README.

Output quality bar:
- Prefer correctness and maintainability over cleverness.
- Do not build only a partial sketch; deliver a working engine skeleton with meaningful rule coverage.
- Use the rulebook and card CSV as the grounding source for game behavior and card definitions.
```
