export const GEM_COLORS = ["white", "blue", "green", "red", "black"] as const;

export const TOKEN_COLORS = [...GEM_COLORS, "gold"] as const;

export type GemColor = (typeof GEM_COLORS)[number];
export type TokenColor = (typeof TOKEN_COLORS)[number];
export type CardLevel = 1 | 2 | 3;

export type GemCountInput = Partial<Record<GemColor, number>>;
export type TokenCountInput = Partial<Record<TokenColor, number>>;

export type GemCounts = Record<GemColor, number>;
export type TokenCounts = Record<TokenColor, number>;

export interface DevelopmentCardDefinition {
  id: string;
  level: CardLevel;
  bonusColor: GemColor;
  points: number;
  cost: GemCounts;
}

export interface NobleTileDefinition {
  id: string;
  name: string;
  requirements: GemCounts;
  points?: number;
  authoritative?: boolean;
}

export interface PlayerDefinition {
  id: string;
  name: string;
}

export type PlayerInput = string | { id?: string; name: string };

export type DevelopmentCardSnapshot = DevelopmentCardDefinition;

export interface NobleTileSnapshot {
  id: string;
  name: string;
  requirements: GemCounts;
  points: number;
  authoritative: boolean;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  points: number;
  tokenCount: number;
  tokens: TokenCounts;
  bonuses: GemCounts;
  purchasedCardCount: number;
  purchasedCards: DevelopmentCardSnapshot[];
  reservedCards: DevelopmentCardSnapshot[];
  nobles: NobleTileSnapshot[];
}

export interface CardMarketLevelSnapshot {
  deckCount: number;
  faceUpCards: DevelopmentCardSnapshot[];
}

export interface CardMarketSnapshot {
  level1: CardMarketLevelSnapshot;
  level2: CardMarketLevelSnapshot;
  level3: CardMarketLevelSnapshot;
}

export interface AwaitingTokenReturnResolution {
  phase: "awaitingTokenReturn";
  requiredReturnCount: number;
}

export interface AwaitingNobleChoiceResolution {
  phase: "awaitingNobleChoice";
  eligibleNobleIds: string[];
}

export type PendingResolutionSnapshot =
  | AwaitingTokenReturnResolution
  | AwaitingNobleChoiceResolution;

export type GamePhase =
  | "awaitingTurnAction"
  | "awaitingTokenReturn"
  | "awaitingNobleChoice"
  | "gameOver";

export interface PublicGameState {
  phase: GamePhase;
  currentPlayerId: string | null;
  currentPlayerIndex: number | null;
  startingPlayerIndex: number;
  completedTurns: number;
  round: number;
  finalRoundTriggeredByPlayerId: string | null;
  pendingResolution: PendingResolutionSnapshot | null;
  winnerIds: string[];
  bank: TokenCounts;
  market: CardMarketSnapshot;
  availableNobles: NobleTileSnapshot[];
  players: PlayerSnapshot[];
}

export interface TakeTokensAction {
  type: "takeTokens";
  colors: GemColor[];
}

export type ReserveCardAction =
  | {
      type: "reserveCard";
      source: "table";
      cardId: string;
    }
  | {
      type: "reserveCard";
      source: "deck";
      level: CardLevel;
    };

export interface PurchaseCardAction {
  type: "purchaseCard";
  source: "table" | "reserved";
  cardId: string;
}

export interface ReturnTokensAction {
  type: "returnTokens";
  tokens: TokenCountInput;
}

export interface ChooseNobleAction {
  type: "chooseNoble";
  nobleId: string;
}

export type GameAction =
  | TakeTokensAction
  | ReserveCardAction
  | PurchaseCardAction
  | ReturnTokensAction
  | ChooseNobleAction;

export type GameEvent =
  | {
      type: "tokensTaken";
      playerId: string;
      tokens: TokenCounts;
    }
  | {
      type: "cardReserved";
      playerId: string;
      card: DevelopmentCardSnapshot;
      source: "table" | "deck";
      receivedGold: boolean;
    }
  | {
      type: "cardPurchased";
      playerId: string;
      card: DevelopmentCardSnapshot;
      source: "table" | "reserved";
      payment: TokenCounts;
    }
  | {
      type: "tokensReturned";
      playerId: string;
      tokens: TokenCounts;
    }
  | {
      type: "nobleClaimed";
      playerId: string;
      noble: NobleTileSnapshot;
    }
  | {
      type: "turnEnded";
      playerId: string;
      nextPlayerId: string | null;
      finalRoundTriggered: boolean;
    }
  | {
      type: "gameEnded";
      winnerIds: string[];
    };

export interface ActionResult {
  events: GameEvent[];
  state: PublicGameState;
}
