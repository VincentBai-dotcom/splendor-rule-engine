export * from "./src/types.ts";
export * from "./src/models.ts";
export * from "./src/game.ts";
export * from "./src/data/standard-development-cards.ts";
export * from "./src/data/non-authoritative-test-nobles.ts";

if (import.meta.main) {
  const { createStandardGame } = await import("./src/game.ts");

  const game = createStandardGame({
    players: ["Player 1", "Player 2"],
    shuffle: false,
  });

  console.log(
    JSON.stringify(
      {
        phase: game.phase,
        currentPlayerId: game.getState().currentPlayerId,
        bank: game.getState().bank,
        market: {
          level1FaceUp: game
            .getState()
            .market.level1.faceUpCards.map((card) => card.id),
          level2FaceUp: game
            .getState()
            .market.level2.faceUpCards.map((card) => card.id),
          level3FaceUp: game
            .getState()
            .market.level3.faceUpCards.map((card) => card.id),
        },
      },
      null,
      2,
    ),
  );
}
