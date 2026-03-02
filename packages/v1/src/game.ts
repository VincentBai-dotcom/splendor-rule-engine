import {
  GEM_COLORS,
  TOKEN_COLORS,
  type ActionResult,
  type AwaitingNobleChoiceResolution,
  type AwaitingTokenReturnResolution,
  type ChooseNobleAction,
  type DevelopmentCardDefinition,
  type GameAction,
  type GameEvent,
  type GamePhase,
  type GemColor,
  type NobleTileDefinition,
  type PendingResolutionSnapshot,
  type PlayerDefinition,
  type PlayerInput,
  type PublicGameState,
  type PurchaseCardAction,
  type ReserveCardAction,
  type ReturnTokensAction,
  type TakeTokensAction,
  type TokenCountInput,
  type TokenCounts,
} from "./types.ts";
import { STANDARD_DEVELOPMENT_CARD_DEFINITIONS } from "./data/standard-development-cards.ts";
import {
  Bank,
  CardMarket,
  NobleTile,
  Player,
  compactTokenCounts,
  createEmptyTokenCounts,
  normalizeTokenCounts,
} from "./models.ts";

export interface SplendorGameOptions {
  players: readonly PlayerInput[];
  cardDefinitions?: readonly DevelopmentCardDefinition[];
  nobleDefinitions?: readonly NobleTileDefinition[];
  shuffle?: boolean;
  random?: () => number;
  startingPlayerIndex?: number;
  victoryPointsToTriggerEnd?: number;
}

function assertCondition(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizePlayerInputs(
  players: readonly PlayerInput[],
): PlayerDefinition[] {
  assertCondition(
    players.length >= 2 && players.length <= 4,
    "Splendor requires 2 to 4 players.",
  );

  const normalizedPlayers = players.map((player, index) => {
    if (typeof player === "string") {
      return {
        id: `player-${index + 1}`,
        name: player,
      };
    }

    return {
      id: player.id ?? `player-${index + 1}`,
      name: player.name,
    };
  });

  const ids = new Set<string>();
  for (const player of normalizedPlayers) {
    assertCondition(
      player.name.trim().length > 0,
      "Player names must be non-empty.",
    );
    assertCondition(!ids.has(player.id), `Duplicate player id "${player.id}".`);
    ids.add(player.id);
  }

  return normalizedPlayers;
}

function shuffleDefinitions<T>(
  definitions: readonly T[],
  options?: { shuffle?: boolean; random?: () => number },
): T[] {
  const deck = [...definitions];

  if (!(options?.shuffle ?? true)) {
    return deck;
  }

  const random = options?.random ?? Math.random;
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const currentValue = deck[index];
    deck[index] = deck[swapIndex] as T;
    deck[swapIndex] = currentValue as T;
  }

  return deck;
}

function enumerateCombinations<T>(
  items: readonly T[],
  choose: number,
  startIndex = 0,
  prefix: T[] = [],
): T[][] {
  if (prefix.length === choose) {
    return [prefix];
  }

  const results: T[][] = [];
  for (let index = startIndex; index < items.length; index += 1) {
    results.push(
      ...enumerateCombinations(items, choose, index + 1, [
        ...prefix,
        items[index] as T,
      ]),
    );
  }

  return results;
}

function enumerateTokenReturnOptions(
  availableTokens: TokenCounts,
  requiredReturnCount: number,
): TokenCountInput[] {
  const options: TokenCountInput[] = [];
  const colors = [...TOKEN_COLORS];

  const backtrack = (
    colorIndex: number,
    remaining: number,
    current: TokenCounts,
  ): void => {
    if (remaining === 0) {
      options.push(compactTokenCounts(current));
      return;
    }

    if (colorIndex >= colors.length) {
      return;
    }

    const color = colors[colorIndex]!;
    const maxReturn = Math.min(availableTokens[color], remaining);
    for (let amount = 0; amount <= maxReturn; amount += 1) {
      current[color] = amount;
      backtrack(colorIndex + 1, remaining - amount, current);
    }
    current[color] = 0;
  };

  backtrack(0, requiredReturnCount, createEmptyTokenCounts());
  return options.filter((option) => {
    const normalized = normalizeTokenCounts(option);
    return Object.values(normalized).some((count) => count > 0);
  });
}

export class SplendorGame {
  public readonly players: Player[];
  public readonly bank: Bank;
  public readonly market: CardMarket;
  public readonly actionResolver: ActionResolver;
  public readonly startingPlayerIndex: number;
  public readonly victoryPointsToTriggerEnd: number;
  public readonly lastPlayerInRoundIndex: number;

  public availableNobles: NobleTile[];
  public currentPlayerIndex: number;
  public completedTurns = 0;
  public finalRoundTriggeredByPlayerId: string | null = null;
  public pendingResolution: PendingResolutionSnapshot | null = null;
  public winnerIds: string[] = [];
  public gameOver = false;

  public constructor(options: SplendorGameOptions) {
    const playerDefinitions = normalizePlayerInputs(options.players);
    const startingPlayerIndex = options.startingPlayerIndex ?? 0;
    assertCondition(
      startingPlayerIndex >= 0 &&
        startingPlayerIndex < playerDefinitions.length,
      "The starting player index is out of range.",
    );

    const cardDefinitions =
      options.cardDefinitions ?? STANDARD_DEVELOPMENT_CARD_DEFINITIONS;
    const nobleDefinitions = options.nobleDefinitions ?? [];
    this.players = playerDefinitions.map((player) => new Player(player));
    this.bank = Bank.createStandard(this.players.length);
    this.market = new CardMarket(cardDefinitions, options);
    this.availableNobles = shuffleDefinitions(nobleDefinitions, options)
      .slice(0, Math.min(nobleDefinitions.length, this.players.length + 1))
      .map((definition) => new NobleTile(definition));
    this.startingPlayerIndex = startingPlayerIndex;
    this.currentPlayerIndex = startingPlayerIndex;
    this.victoryPointsToTriggerEnd = options.victoryPointsToTriggerEnd ?? 15;
    this.lastPlayerInRoundIndex =
      (this.startingPlayerIndex + this.players.length - 1) %
      this.players.length;
    this.actionResolver = new ActionResolver(this);
  }

  public static createStandard(
    options: Omit<SplendorGameOptions, "cardDefinitions">,
  ): SplendorGame {
    return new SplendorGame({
      ...options,
      cardDefinitions: STANDARD_DEVELOPMENT_CARD_DEFINITIONS,
    });
  }

  public get phase(): GamePhase {
    if (this.gameOver) {
      return "gameOver";
    }

    if (this.pendingResolution?.phase === "awaitingTokenReturn") {
      return "awaitingTokenReturn";
    }

    if (this.pendingResolution?.phase === "awaitingNobleChoice") {
      return "awaitingNobleChoice";
    }

    return "awaitingTurnAction";
  }

  public getCurrentPlayer(): Player {
    return this.players[this.currentPlayerIndex] as Player;
  }

  public getLegalActions(): GameAction[] {
    return this.actionResolver.getLegalActions();
  }

  public applyAction(action: GameAction): ActionResult {
    return this.actionResolver.apply(action);
  }

  public getEligibleNobles(player: Player): NobleTile[] {
    return this.availableNobles.filter((noble) =>
      noble.isSatisfiedBy(player.bonuses),
    );
  }

  public removeAvailableNoble(nobleId: string): NobleTile {
    const index = this.availableNobles.findIndex(
      (noble) => noble.id === nobleId,
    );
    if (index === -1) {
      throw new Error(`Noble "${nobleId}" is not available.`);
    }

    const [noble] = this.availableNobles.splice(index, 1);
    return noble as NobleTile;
  }

  public completeCurrentTurn(events: GameEvent[]): ActionResult {
    const player = this.getCurrentPlayer();
    let finalRoundTriggered = false;

    if (
      this.finalRoundTriggeredByPlayerId === null &&
      player.points >= this.victoryPointsToTriggerEnd
    ) {
      this.finalRoundTriggeredByPlayerId = player.id;
      finalRoundTriggered = true;
    }

    this.completedTurns += 1;

    const gameShouldEnd =
      this.finalRoundTriggeredByPlayerId !== null &&
      this.currentPlayerIndex === this.lastPlayerInRoundIndex;

    if (gameShouldEnd) {
      this.gameOver = true;
      this.winnerIds = this.determineWinnerIds();
      events.push({
        type: "turnEnded",
        playerId: player.id,
        nextPlayerId: null,
        finalRoundTriggered,
      });
      events.push({
        type: "gameEnded",
        winnerIds: [...this.winnerIds],
      });
      return {
        events,
        state: this.getState(),
      };
    }

    this.currentPlayerIndex =
      (this.currentPlayerIndex + 1) % this.players.length;
    events.push({
      type: "turnEnded",
      playerId: player.id,
      nextPlayerId: this.getCurrentPlayer().id,
      finalRoundTriggered,
    });

    return {
      events,
      state: this.getState(),
    };
  }

  public getState(): PublicGameState {
    return {
      phase: this.phase,
      currentPlayerId: this.gameOver ? null : this.getCurrentPlayer().id,
      currentPlayerIndex: this.gameOver ? null : this.currentPlayerIndex,
      startingPlayerIndex: this.startingPlayerIndex,
      completedTurns: this.completedTurns,
      round: Math.floor(this.completedTurns / this.players.length) + 1,
      finalRoundTriggeredByPlayerId: this.finalRoundTriggeredByPlayerId,
      pendingResolution: this.pendingResolution
        ? JSON.parse(JSON.stringify(this.pendingResolution))
        : null,
      winnerIds: [...this.winnerIds],
      bank: this.bank.toSnapshot(),
      market: this.market.toSnapshot(),
      availableNobles: this.availableNobles.map((noble) => noble.toSnapshot()),
      players: this.players.map((player) => player.toSnapshot()),
    };
  }

  public determineWinnerIds(): string[] {
    const highestScore = Math.max(
      ...this.players.map((player) => player.points),
    );
    const scoreLeaders = this.players.filter(
      (player) => player.points === highestScore,
    );

    const fewestPurchasedCards = Math.min(
      ...scoreLeaders.map((player) => player.purchasedCardCount),
    );

    return scoreLeaders
      .filter((player) => player.purchasedCardCount === fewestPurchasedCards)
      .map((player) => player.id);
  }
}

export class ActionResolver {
  public constructor(private readonly game: SplendorGame) {}

  public getLegalActions(): GameAction[] {
    if (this.game.gameOver) {
      return [];
    }

    if (this.game.pendingResolution?.phase === "awaitingTokenReturn") {
      return enumerateTokenReturnOptions(
        this.game.getCurrentPlayer().tokens.toObject(),
        this.game.pendingResolution.requiredReturnCount,
      ).map((tokens) => ({
        type: "returnTokens",
        tokens,
      }));
    }

    if (this.game.pendingResolution?.phase === "awaitingNobleChoice") {
      return this.game.pendingResolution.eligibleNobleIds.map((nobleId) => ({
        type: "chooseNoble",
        nobleId,
      }));
    }

    return [
      ...this.getTakeTokenActions(),
      ...this.getReserveActions(),
      ...this.getPurchaseActions(),
    ];
  }

  public apply(action: GameAction): ActionResult {
    if (this.game.gameOver) {
      throw new Error("The game is already over.");
    }

    if (this.game.pendingResolution?.phase === "awaitingTokenReturn") {
      assertCondition(
        action.type === "returnTokens",
        "The current player must return tokens before taking another action.",
      );
      return this.resolveReturnTokens(action);
    }

    if (this.game.pendingResolution?.phase === "awaitingNobleChoice") {
      assertCondition(
        action.type === "chooseNoble",
        "The current player must choose a noble before taking another action.",
      );
      return this.resolveChooseNoble(action);
    }

    switch (action.type) {
      case "takeTokens":
        return this.resolveTakeTokens(action);
      case "reserveCard":
        return this.resolveReserveCard(action);
      case "purchaseCard":
        return this.resolvePurchaseCard(action);
      case "returnTokens":
      case "chooseNoble":
        throw new Error("That action is not available right now.");
      default:
        throw new Error("Unknown action.");
    }
  }

  private getTakeTokenActions(): TakeTokensAction[] {
    const actions: TakeTokensAction[] = [];
    const availableDistinctColors = GEM_COLORS.filter(
      (color) => this.game.bank.available(color) > 0,
    );

    for (const colors of enumerateCombinations(availableDistinctColors, 3)) {
      actions.push({
        type: "takeTokens",
        colors,
      });
    }

    for (const color of GEM_COLORS) {
      if (this.game.bank.canTakePair(color)) {
        actions.push({
          type: "takeTokens",
          colors: [color, color],
        });
      }
    }

    return actions;
  }

  private getReserveActions(): ReserveCardAction[] {
    const player = this.game.getCurrentPlayer();
    if (!player.canReserveMoreCards()) {
      return [];
    }

    const actions: ReserveCardAction[] = [];

    for (const level of [1, 2, 3] as const) {
      for (const card of this.game.market.getFaceUpCards(level)) {
        actions.push({
          type: "reserveCard",
          source: "table",
          cardId: card.id,
        });
      }

      if (this.game.market.getDeckCount(level) > 0) {
        actions.push({
          type: "reserveCard",
          source: "deck",
          level,
        });
      }
    }

    return actions;
  }

  private getPurchaseActions(): PurchaseCardAction[] {
    const player = this.game.getCurrentPlayer();
    const actions: PurchaseCardAction[] = [];

    for (const level of [1, 2, 3] as const) {
      for (const card of this.game.market.getFaceUpCards(level)) {
        if (player.canAfford(card)) {
          actions.push({
            type: "purchaseCard",
            source: "table",
            cardId: card.id,
          });
        }
      }
    }

    for (const card of player.reservedCards.list()) {
      if (player.canAfford(card)) {
        actions.push({
          type: "purchaseCard",
          source: "reserved",
          cardId: card.id,
        });
      }
    }

    return actions;
  }

  private resolveTakeTokens(action: TakeTokensAction): ActionResult {
    const player = this.game.getCurrentPlayer();
    const events: GameEvent[] = [];

    if (action.colors.length === 3) {
      const uniqueColors = new Set(action.colors);
      assertCondition(
        uniqueColors.size === 3,
        "Taking 3 gem tokens requires 3 different colors.",
      );
      assertCondition(
        this.game.bank.canTakeDistinct(action.colors),
        "Those 3 gem tokens are not available.",
      );

      const tokensToTake = createEmptyTokenCounts();
      for (const color of action.colors) {
        tokensToTake[color] += 1;
      }

      this.game.bank.take(tokensToTake);
      player.receiveTokens(tokensToTake);
      events.push({
        type: "tokensTaken",
        playerId: player.id,
        tokens: tokensToTake,
      });
    } else if (action.colors.length === 2) {
      const [firstColor, secondColor] = action.colors;
      assertCondition(
        firstColor === secondColor,
        "Taking 2 gem tokens requires both tokens to be the same color.",
      );
      assertCondition(
        this.game.bank.canTakePair(firstColor as GemColor),
        "You can only take 2 tokens of the same color when at least 4 are available.",
      );

      const tokensToTake = createEmptyTokenCounts();
      tokensToTake[firstColor as GemColor] = 2;
      this.game.bank.take(tokensToTake);
      player.receiveTokens(tokensToTake);
      events.push({
        type: "tokensTaken",
        playerId: player.id,
        tokens: tokensToTake,
      });
    } else {
      throw new Error(
        "Taking tokens requires either 3 different colors or 2 of the same color.",
      );
    }

    return this.finishAfterNonPurchase(events);
  }

  private resolveReserveCard(action: ReserveCardAction): ActionResult {
    const player = this.game.getCurrentPlayer();
    const events: GameEvent[] = [];
    assertCondition(
      player.canReserveMoreCards(),
      "A player cannot reserve more than 3 cards.",
    );

    const card =
      action.source === "table"
        ? this.game.market.takeFaceUpCard(action.cardId)
        : this.game.market.drawFromDeck(action.level);

    assertCondition(card !== null, "The selected deck is empty.");

    player.reserveCard(card);

    let receivedGold = false;
    if (this.game.bank.available("gold") > 0) {
      this.game.bank.take({ gold: 1 });
      player.receiveTokens({ gold: 1 });
      receivedGold = true;
    }

    events.push({
      type: "cardReserved",
      playerId: player.id,
      card: card.toSnapshot(),
      source: action.source,
      receivedGold,
    });

    return this.finishAfterNonPurchase(events);
  }

  private resolvePurchaseCard(action: PurchaseCardAction): ActionResult {
    const player = this.game.getCurrentPlayer();
    const events: GameEvent[] = [];

    const card =
      action.source === "table"
        ? this.game.market.getFaceUpCard(action.cardId)
        : player.reservedCards.getById(action.cardId);

    assertCondition(
      card !== null,
      `Card "${action.cardId}" cannot be purchased from ${action.source}.`,
    );

    const payment = player.getPurchasePlan(card);
    assertCondition(
      payment !== null,
      "The current player cannot afford that card.",
    );

    if (action.source === "table") {
      this.game.market.takeFaceUpCard(action.cardId);
    } else {
      player.reservedCards.removeById(action.cardId);
    }

    player.spendTokens(payment.toObject());
    this.game.bank.return(payment.toObject());
    player.acquirePurchasedCard(card);

    events.push({
      type: "cardPurchased",
      playerId: player.id,
      card: card.toSnapshot(),
      source: action.source,
      payment: payment.toObject(),
    });

    const eligibleNobles = this.game.getEligibleNobles(player);
    if (eligibleNobles.length > 1) {
      const pendingResolution: AwaitingNobleChoiceResolution = {
        phase: "awaitingNobleChoice",
        eligibleNobleIds: eligibleNobles.map((noble) => noble.id),
      };
      this.game.pendingResolution = pendingResolution;
      return {
        events,
        state: this.game.getState(),
      };
    }

    if (eligibleNobles.length === 1) {
      const noble = this.game.removeAvailableNoble(eligibleNobles[0]!.id);
      player.claimNoble(noble);
      events.push({
        type: "nobleClaimed",
        playerId: player.id,
        noble: noble.toSnapshot(),
      });
    }

    return this.game.completeCurrentTurn(events);
  }

  private resolveReturnTokens(action: ReturnTokensAction): ActionResult {
    const player = this.game.getCurrentPlayer();
    const events: GameEvent[] = [];
    const pendingResolution = this.game
      .pendingResolution as AwaitingTokenReturnResolution;
    const normalizedTokens = normalizeTokenCounts(action.tokens);
    const returnedTokenCount = Object.values(normalizedTokens).reduce(
      (total, count) => total + count,
      0,
    );

    assertCondition(
      returnedTokenCount === pendingResolution.requiredReturnCount,
      `You must return exactly ${pendingResolution.requiredReturnCount} tokens.`,
    );

    player.spendTokens(normalizedTokens);
    this.game.bank.return(normalizedTokens);
    this.game.pendingResolution = null;

    events.push({
      type: "tokensReturned",
      playerId: player.id,
      tokens: normalizedTokens,
    });

    return this.game.completeCurrentTurn(events);
  }

  private resolveChooseNoble(action: ChooseNobleAction): ActionResult {
    const player = this.game.getCurrentPlayer();
    const events: GameEvent[] = [];
    const pendingResolution = this.game
      .pendingResolution as AwaitingNobleChoiceResolution;

    assertCondition(
      pendingResolution.eligibleNobleIds.includes(action.nobleId),
      `Noble "${action.nobleId}" is not a valid choice.`,
    );

    const noble = this.game.removeAvailableNoble(action.nobleId);
    player.claimNoble(noble);
    this.game.pendingResolution = null;
    events.push({
      type: "nobleClaimed",
      playerId: player.id,
      noble: noble.toSnapshot(),
    });

    return this.game.completeCurrentTurn(events);
  }

  private finishAfterNonPurchase(events: GameEvent[]): ActionResult {
    const player = this.game.getCurrentPlayer();
    const excessTokens = player.tokenCount - 10;

    if (excessTokens > 0) {
      const pendingResolution: AwaitingTokenReturnResolution = {
        phase: "awaitingTokenReturn",
        requiredReturnCount: excessTokens,
      };
      this.game.pendingResolution = pendingResolution;
      return {
        events,
        state: this.game.getState(),
      };
    }

    return this.game.completeCurrentTurn(events);
  }
}

export function createStandardGame(
  options: Omit<SplendorGameOptions, "cardDefinitions">,
): SplendorGame {
  return SplendorGame.createStandard(options);
}
