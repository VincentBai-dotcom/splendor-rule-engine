# v1

`v1` is a Bun-based TypeScript Splendor rule engine with full turn flow, rule enforcement, card data, and tests inside this package.

## What it implements

- setup for 2 to 4 players
- standard bank sizing by player count
- development card decks, face-up market rows, and immediate refill
- legal action generation for taking tokens, reserving, buying, token returns, and noble choice
- gold jokers and permanent discounts from purchased cards
- reserved-card limits and hidden deck reservations
- noble support, including forced claim and player choice when multiple nobles qualify
- end-game trigger at 15 prestige points and round-complete winner resolution
- winner tiebreak by fewest purchased development cards

## Public API

Main exports from [index.ts](/home/vincent-bai/Documents/github/splendor-rule-engine/packages/v1/index.ts):

- `SplendorGame`
- `createStandardGame`
- domain classes such as `Player`, `Bank`, `DevelopmentCard`, `NobleTile`, and `CardMarket`
- `STANDARD_DEVELOPMENT_CARD_DEFINITIONS`
- `parseDevelopmentCardsCsv`
- `NON_AUTHORITATIVE_TEST_NOBLES`

Example:

```ts
import { createStandardGame } from "v1";

const game = createStandardGame({
  players: ["Ada", "Grace"],
  shuffle: false,
});

const legalActions = game.getLegalActions();
const result = game.applyAction(legalActions[0]!);
console.log(result.state.phase);
```

## Card data

The development card catalog is embedded in-package as CSV text derived from `static-assets/Splendor Cards.csv`, then parsed by `parseDevelopmentCardsCsv()` into `STANDARD_DEVELOPMENT_CARD_DEFINITIONS`.

This keeps the package self-contained while preserving the original CSV structure as the source format used by the engine.

## Noble data

The repository does not include an authoritative noble dataset, so the engine does not invent one.

- Production callers should pass `nobleDefinitions` into `SplendorGame` or `createStandardGame`.
- If no noble data is supplied, the game runs with zero nobles available.
- `NON_AUTHORITATIVE_TEST_NOBLES` exists only for tests and examples and is explicitly non-authoritative.

## Scripts

From the repo root:

```bash
bun run --cwd packages/v1 start
bun run --cwd packages/v1 test
```

## Assumptions

- If multiple players remain tied after both prestige points and purchased-card tiebreakers, the engine returns multiple winner ids.
- When fewer noble definitions are provided than `playerCount + 1`, the engine reveals all provided nobles instead of failing setup.
- Callers interact through the engine API; rule validation is enforced internally and invalid actions throw errors.
