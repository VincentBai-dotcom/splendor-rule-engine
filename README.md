# splendor-rule-engine

This repository is an evaluation sandbox for testing Codex's ability to build a rule engine for the board game Splendor end-to-end.

The repo is organized as a Bun workspace monorepo. Each package under `packages/` is a separate version of the Splendor rule engine produced by Codex using a specific strategy. A strategy can vary by prompt, workflow, constraints, review process, or any other method used to generate the code.

## Purpose

- Compare different Codex generation strategies against the same Splendor rule-engine goal.
- Keep each generated version isolated in its own package.
- Document how each version was produced so the code can be evaluated in context, not just by its output.

## Package convention

Every package in `packages/` should include its own `README.md` that explains:

- what the package contains
- what strategy was used to generate it
- what prompt or workflow differences define that version
- any notable assumptions, limitations, or follow-up work

## Current packages

- `packages/v1`: initial version generated with a minimal bootstrap workflow
