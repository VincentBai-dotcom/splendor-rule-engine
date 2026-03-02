import { describe, expect, test } from "bun:test";

import {
  DevelopmentCard,
  NON_AUTHORITATIVE_TEST_NOBLES,
  SplendorGame,
  STANDARD_DEVELOPMENT_CARD_DEFINITIONS,
  createStandardGame,
  parseDevelopmentCardsCsv,
} from "../index.ts";
import type { DevelopmentCardDefinition } from "./types.ts";

function createCard(
  id: string,
  level: 1 | 2 | 3,
  bonusColor: DevelopmentCardDefinition["bonusColor"],
  points: number,
  cost: DevelopmentCardDefinition["cost"],
): DevelopmentCardDefinition {
  return { id, level, bonusColor, points, cost };
}

function createZeroCostLevel(
  level: 1 | 2 | 3,
  prefix: string,
): DevelopmentCardDefinition[] {
  return Array.from({ length: 4 }, (_, index) =>
    createCard(`${prefix}-${index + 1}`, level, "black", 0, {
      white: 0,
      blue: 0,
      green: 0,
      red: 0,
      black: 0,
    }),
  );
}

describe("development card data", () => {
  test("parses the embedded CSV into the expected catalog", () => {
    const parsedCards = parseDevelopmentCardsCsv(
      `Level,Color,PV,Black,Blue,Green,Red,White
1,Black,0,0,1,1,1,1
2,Blue,3,0,6,0,0,0`,
    );

    expect(parsedCards).toHaveLength(2);
    expect(STANDARD_DEVELOPMENT_CARD_DEFINITIONS).toHaveLength(90);
    expect(
      STANDARD_DEVELOPMENT_CARD_DEFINITIONS.filter((card) => card.level === 1),
    ).toHaveLength(40);
    expect(
      STANDARD_DEVELOPMENT_CARD_DEFINITIONS.filter((card) => card.level === 2),
    ).toHaveLength(30);
    expect(
      STANDARD_DEVELOPMENT_CARD_DEFINITIONS.filter((card) => card.level === 3),
    ).toHaveLength(20);
    expect(STANDARD_DEVELOPMENT_CARD_DEFINITIONS[0]).toEqual({
      id: "01",
      level: 1,
      bonusColor: "black",
      points: 0,
      cost: { white: 1, blue: 1, green: 1, red: 1, black: 0 },
    });
  });
});

describe("standard setup", () => {
  test("creates the correct bank sizes and face-up cards for a 2-player game", () => {
    const game = createStandardGame({
      players: ["Ada", "Grace"],
      nobleDefinitions: NON_AUTHORITATIVE_TEST_NOBLES,
      shuffle: false,
    });

    const state = game.getState();

    expect(state.currentPlayerId).toBe("player-1");
    expect(state.bank).toEqual({
      white: 4,
      blue: 4,
      green: 4,
      red: 4,
      black: 4,
      gold: 5,
    });
    expect(state.market.level1.faceUpCards).toHaveLength(4);
    expect(state.market.level2.faceUpCards).toHaveLength(4);
    expect(state.market.level3.faceUpCards).toHaveLength(4);
    expect(state.availableNobles).toHaveLength(3);
  });
});

describe("token rules", () => {
  test("allows taking a pair only while at least 4 tokens of that color remain", () => {
    const game = createStandardGame({
      players: ["Ada", "Grace"],
      shuffle: false,
    });

    expect(game.getLegalActions()).toContainEqual({
      type: "takeTokens",
      colors: ["blue", "blue"],
    });

    game.applyAction({
      type: "takeTokens",
      colors: ["blue", "blue"],
    });

    expect(game.getCurrentPlayer().id).toBe("player-2");
    expect(game.getLegalActions()).not.toContainEqual({
      type: "takeTokens",
      colors: ["blue", "blue"],
    });
  });
});

describe("reservations", () => {
  test("reserving can grant gold and force a token return when the player exceeds 10 tokens", () => {
    const game = createStandardGame({
      players: ["Ada", "Grace"],
      shuffle: false,
    });

    const currentPlayer = game.getCurrentPlayer();
    currentPlayer.receiveTokens({
      white: 2,
      blue: 2,
      green: 2,
      red: 2,
      black: 2,
    });

    const reservedCardId = game.getState().market.level1.faceUpCards[0]!.id;
    const result = game.applyAction({
      type: "reserveCard",
      source: "table",
      cardId: reservedCardId,
    });

    expect(result.state.phase).toBe("awaitingTokenReturn");
    expect(result.state.pendingResolution).toEqual({
      phase: "awaitingTokenReturn",
      requiredReturnCount: 1,
    });
    expect(game.getCurrentPlayer().id).toBe("player-1");
    expect(game.getState().players[0]!.reservedCards).toHaveLength(1);
    expect(game.getState().players[0]!.tokens.gold).toBe(1);

    const afterReturn = game.applyAction({
      type: "returnTokens",
      tokens: { gold: 1 },
    });

    expect(afterReturn.state.phase).toBe("awaitingTurnAction");
    expect(afterReturn.state.currentPlayerId).toBe("player-2");
    expect(afterReturn.state.players[0]!.tokenCount).toBe(10);
    expect(afterReturn.state.bank.gold).toBe(5);
  });

  test("does not allow reserving a fourth card", () => {
    const cardDefinitions = [
      ...createZeroCostLevel(1, "reserve-l1"),
      ...createZeroCostLevel(1, "reserve-l1b"),
      ...createZeroCostLevel(2, "reserve-l2"),
      ...createZeroCostLevel(3, "reserve-l3"),
    ];
    const game = new SplendorGame({
      players: ["Ada", "Grace"],
      cardDefinitions,
      shuffle: false,
    });

    const playerOne = game.players[0]!;
    playerOne.reserveCard(game.market.takeFaceUpCard("reserve-l1-1"));
    playerOne.reserveCard(game.market.takeFaceUpCard("reserve-l1-2"));
    playerOne.reserveCard(game.market.takeFaceUpCard("reserve-l1-3"));

    expect(playerOne.reservedCards.size).toBe(3);
    expect(
      game.getLegalActions().some((action) => action.type === "reserveCard"),
    ).toBe(false);
    expect(() =>
      game.applyAction({
        type: "reserveCard",
        source: "table",
        cardId: "reserve-l1-4",
      }),
    ).toThrow("A player cannot reserve more than 3 cards.");
  });
});

describe("purchases", () => {
  test("uses discounts and gold when buying a reserved card", () => {
    const cardDefinitions = [
      createCard("bonus-blue", 1, "blue", 0, {
        white: 0,
        blue: 0,
        green: 0,
        red: 0,
        black: 0,
      }),
      createCard("reserved-target", 1, "red", 2, {
        white: 0,
        blue: 3,
        green: 0,
        red: 1,
        black: 0,
      }),
      ...createZeroCostLevel(1, "filler-l1"),
      ...createZeroCostLevel(2, "filler-l2"),
      ...createZeroCostLevel(3, "filler-l3"),
    ];

    const game = new SplendorGame({
      players: ["Ada", "Grace"],
      cardDefinitions,
      shuffle: false,
    });

    game
      .getCurrentPlayer()
      .acquirePurchasedCard(new DevelopmentCard(cardDefinitions[0]!));
    game
      .getCurrentPlayer()
      .reserveCard(new DevelopmentCard(cardDefinitions[1]!));
    game.getCurrentPlayer().receiveTokens({
      blue: 1,
      red: 1,
      gold: 1,
    });
    game.bank.take({
      blue: 1,
      red: 1,
      gold: 1,
    });

    const result = game.applyAction({
      type: "purchaseCard",
      source: "reserved",
      cardId: "reserved-target",
    });

    expect(result.events).toContainEqual({
      type: "cardPurchased",
      playerId: "player-1",
      card: {
        id: "reserved-target",
        level: 1,
        bonusColor: "red",
        points: 2,
        cost: { white: 0, blue: 3, green: 0, red: 1, black: 0 },
      },
      source: "reserved",
      payment: {
        white: 0,
        blue: 1,
        green: 0,
        red: 1,
        black: 0,
        gold: 1,
      },
    });
    expect(result.state.players[0]!.points).toBe(2);
    expect(result.state.players[0]!.bonuses.red).toBe(1);
    expect(result.state.players[0]!.reservedCards).toHaveLength(0);
    expect(result.state.bank.gold).toBe(5);
  });
});

describe("nobles", () => {
  test("requires a choice when a purchase qualifies for multiple nobles", () => {
    const cardDefinitions = [
      createCard("free-black", 1, "black", 0, {
        white: 0,
        blue: 0,
        green: 0,
        red: 0,
        black: 0,
      }),
      ...createZeroCostLevel(1, "noble-l1"),
      ...createZeroCostLevel(2, "noble-l2"),
      ...createZeroCostLevel(3, "noble-l3"),
    ];

    const game = new SplendorGame({
      players: ["Ada", "Grace"],
      cardDefinitions,
      nobleDefinitions: NON_AUTHORITATIVE_TEST_NOBLES.slice(0, 3),
      shuffle: false,
    });

    const purchaseResult = game.applyAction({
      type: "purchaseCard",
      source: "table",
      cardId: "free-black",
    });

    expect(purchaseResult.state.phase).toBe("awaitingNobleChoice");
    expect(purchaseResult.state.pendingResolution).toEqual({
      phase: "awaitingNobleChoice",
      eligibleNobleIds: ["test-noble-black-a", "test-noble-black-b"],
    });

    const choiceResult = game.applyAction({
      type: "chooseNoble",
      nobleId: "test-noble-black-b",
    });

    expect(choiceResult.state.phase).toBe("awaitingTurnAction");
    expect(choiceResult.state.currentPlayerId).toBe("player-2");
    expect(choiceResult.state.players[0]!.points).toBe(3);
    expect(choiceResult.state.players[0]!.nobles).toHaveLength(1);
  });
});

describe("game end", () => {
  test("finishes after the round where someone first reaches 15 points", () => {
    const cardDefinitions = [
      createCard("victory-15", 1, "black", 15, {
        white: 0,
        blue: 0,
        green: 0,
        red: 0,
        black: 0,
      }),
      ...createZeroCostLevel(1, "end-l1"),
      ...createZeroCostLevel(2, "end-l2"),
      ...createZeroCostLevel(3, "end-l3"),
    ];

    const game = new SplendorGame({
      players: ["Ada", "Grace"],
      cardDefinitions,
      shuffle: false,
    });

    const afterTrigger = game.applyAction({
      type: "purchaseCard",
      source: "table",
      cardId: "victory-15",
    });

    expect(afterTrigger.state.finalRoundTriggeredByPlayerId).toBe("player-1");
    expect(afterTrigger.state.phase).toBe("awaitingTurnAction");
    expect(afterTrigger.state.currentPlayerId).toBe("player-2");
    expect(afterTrigger.state.winnerIds).toHaveLength(0);

    const finished = game.applyAction({
      type: "takeTokens",
      colors: ["white", "blue", "green"],
    });

    expect(finished.state.phase).toBe("gameOver");
    expect(finished.state.currentPlayerId).toBeNull();
    expect(finished.state.winnerIds).toEqual(["player-1"]);
  });
});
