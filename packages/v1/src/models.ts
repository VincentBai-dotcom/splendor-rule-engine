import {
  GEM_COLORS,
  TOKEN_COLORS,
  type CardLevel,
  type CardMarketSnapshot,
  type DevelopmentCardDefinition,
  type DevelopmentCardSnapshot,
  type GemColor,
  type GemCountInput,
  type GemCounts,
  type NobleTileDefinition,
  type NobleTileSnapshot,
  type PlayerDefinition,
  type PlayerSnapshot,
  type TokenColor,
  type TokenCountInput,
  type TokenCounts,
} from "./types.ts";

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

export function createEmptyGemCounts(): GemCounts {
  return {
    white: 0,
    blue: 0,
    green: 0,
    red: 0,
    black: 0,
  };
}

export function createEmptyTokenCounts(): TokenCounts {
  return {
    ...createEmptyGemCounts(),
    gold: 0,
  };
}

export function normalizeGemCounts(counts: GemCountInput = {}): GemCounts {
  const normalized = createEmptyGemCounts();

  for (const color of GEM_COLORS) {
    const value = counts[color] ?? 0;
    assertNonNegativeInteger(value, `Gem count for ${color}`);
    normalized[color] = value;
  }

  return normalized;
}

export function normalizeTokenCounts(
  counts: TokenCountInput = {},
): TokenCounts {
  const normalized = createEmptyTokenCounts();

  for (const color of TOKEN_COLORS) {
    const value = counts[color] ?? 0;
    assertNonNegativeInteger(value, `Token count for ${color}`);
    normalized[color] = value;
  }

  return normalized;
}

export function compactTokenCounts(counts: TokenCounts): TokenCountInput {
  const compact: TokenCountInput = {};

  for (const color of TOKEN_COLORS) {
    if (counts[color] > 0) {
      compact[color] = counts[color];
    }
  }

  return compact;
}

export function sumTokens(
  counts: TokenCounts,
  colors: readonly TokenColor[] = TOKEN_COLORS,
): number {
  return colors.reduce((total, color) => total + counts[color], 0);
}

export class TokenCollection {
  private readonly counts: TokenCounts;

  public constructor(initialCounts: TokenCountInput = {}) {
    this.counts = normalizeTokenCounts(initialCounts);
  }

  public static empty(): TokenCollection {
    return new TokenCollection();
  }

  public clone(): TokenCollection {
    return new TokenCollection(this.counts);
  }

  public get(color: TokenColor): number {
    return this.counts[color];
  }

  public total(): number {
    return sumTokens(this.counts);
  }

  public toObject(): TokenCounts {
    return { ...this.counts };
  }

  public toGemObject(): GemCounts {
    return {
      white: this.counts.white,
      blue: this.counts.blue,
      green: this.counts.green,
      red: this.counts.red,
      black: this.counts.black,
    };
  }

  public hasAtLeast(requiredCounts: TokenCountInput): boolean {
    const normalized = normalizeTokenCounts(requiredCounts);
    return TOKEN_COLORS.every(
      (color) => this.counts[color] >= normalized[color],
    );
  }

  public add(delta: TokenCountInput): void {
    const normalized = normalizeTokenCounts(delta);

    for (const color of TOKEN_COLORS) {
      this.counts[color] += normalized[color];
    }
  }

  public remove(delta: TokenCountInput): void {
    const normalized = normalizeTokenCounts(delta);

    for (const color of TOKEN_COLORS) {
      if (this.counts[color] < normalized[color]) {
        throw new Error(`Insufficient ${color} tokens.`);
      }
    }

    for (const color of TOKEN_COLORS) {
      this.counts[color] -= normalized[color];
    }
  }
}

export class DevelopmentCard {
  public readonly id: string;
  public readonly level: CardLevel;
  public readonly bonusColor: GemColor;
  public readonly points: number;
  public readonly cost: GemCounts;

  public constructor(definition: DevelopmentCardDefinition) {
    this.id = definition.id;
    this.level = definition.level;
    this.bonusColor = definition.bonusColor;
    this.points = definition.points;
    this.cost = normalizeGemCounts(definition.cost);
  }

  public toSnapshot(): DevelopmentCardSnapshot {
    return {
      id: this.id,
      level: this.level,
      bonusColor: this.bonusColor,
      points: this.points,
      cost: { ...this.cost },
    };
  }
}

export class NobleTile {
  public readonly id: string;
  public readonly name: string;
  public readonly requirements: GemCounts;
  public readonly points: number;
  public readonly authoritative: boolean;

  public constructor(definition: NobleTileDefinition) {
    this.id = definition.id;
    this.name = definition.name;
    this.requirements = normalizeGemCounts(definition.requirements);
    this.points = definition.points ?? 3;
    this.authoritative = definition.authoritative ?? false;
  }

  public isSatisfiedBy(bonuses: GemCounts): boolean {
    return GEM_COLORS.every(
      (color) => bonuses[color] >= this.requirements[color],
    );
  }

  public toSnapshot(): NobleTileSnapshot {
    return {
      id: this.id,
      name: this.name,
      requirements: { ...this.requirements },
      points: this.points,
      authoritative: this.authoritative,
    };
  }
}

export class Deck<T> {
  private readonly cards: T[];

  public constructor(
    cards: readonly T[],
    options?: { shuffle?: boolean; random?: () => number },
  ) {
    const mutableCards = [...cards];

    if (options?.shuffle ?? true) {
      const random = options?.random ?? Math.random;
      for (let index = mutableCards.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        const currentCard = mutableCards[index];
        mutableCards[index] = mutableCards[swapIndex] as T;
        mutableCards[swapIndex] = currentCard as T;
      }
    }

    this.cards = mutableCards;
  }

  public draw(): T | null {
    return this.cards.shift() ?? null;
  }

  public get size(): number {
    return this.cards.length;
  }

  public get isEmpty(): boolean {
    return this.cards.length === 0;
  }
}

export class ReservedCards {
  public static readonly MAX_RESERVED_CARDS = 3;

  private readonly cards: DevelopmentCard[] = [];

  public add(card: DevelopmentCard): void {
    if (this.cards.length >= ReservedCards.MAX_RESERVED_CARDS) {
      throw new Error("A player cannot reserve more than 3 cards.");
    }

    this.cards.push(card);
  }

  public getById(cardId: string): DevelopmentCard | null {
    return this.cards.find((card) => card.id === cardId) ?? null;
  }

  public removeById(cardId: string): DevelopmentCard {
    const index = this.cards.findIndex((card) => card.id === cardId);
    if (index === -1) {
      throw new Error(`Reserved card "${cardId}" was not found.`);
    }

    const [card] = this.cards.splice(index, 1);
    return card as DevelopmentCard;
  }

  public list(): DevelopmentCard[] {
    return [...this.cards];
  }

  public get size(): number {
    return this.cards.length;
  }
}

export class PurchasedCards {
  private readonly cardsByColor: Record<GemColor, DevelopmentCard[]> = {
    white: [],
    blue: [],
    green: [],
    red: [],
    black: [],
  };

  public add(card: DevelopmentCard): void {
    this.cardsByColor[card.bonusColor].push(card);
  }

  public getDiscount(color: GemColor): number {
    return this.cardsByColor[color].length;
  }

  public getBonuses(): GemCounts {
    return {
      white: this.cardsByColor.white.length,
      blue: this.cardsByColor.blue.length,
      green: this.cardsByColor.green.length,
      red: this.cardsByColor.red.length,
      black: this.cardsByColor.black.length,
    };
  }

  public getAllCards(): DevelopmentCard[] {
    return GEM_COLORS.flatMap((color) => this.cardsByColor[color]);
  }

  public get count(): number {
    return this.getAllCards().length;
  }

  public get points(): number {
    return this.getAllCards().reduce((total, card) => total + card.points, 0);
  }
}

export class Player {
  public readonly id: string;
  public readonly name: string;
  public readonly tokens = TokenCollection.empty();
  public readonly reservedCards = new ReservedCards();
  public readonly purchasedCards = new PurchasedCards();
  public readonly nobles: NobleTile[] = [];

  public constructor(definition: PlayerDefinition) {
    this.id = definition.id;
    this.name = definition.name;
  }

  public get bonuses(): GemCounts {
    return this.purchasedCards.getBonuses();
  }

  public get points(): number {
    const noblePoints = this.nobles.reduce(
      (total, noble) => total + noble.points,
      0,
    );
    return this.purchasedCards.points + noblePoints;
  }

  public get tokenCount(): number {
    return this.tokens.total();
  }

  public get purchasedCardCount(): number {
    return this.purchasedCards.count;
  }

  public canReserveMoreCards(): boolean {
    return this.reservedCards.size < ReservedCards.MAX_RESERVED_CARDS;
  }

  public getPurchasePlan(card: DevelopmentCard): TokenCollection | null {
    const bonuses = this.bonuses;
    const payment = TokenCollection.empty();
    let goldNeeded = 0;

    for (const color of GEM_COLORS) {
      const discountedCost = Math.max(0, card.cost[color] - bonuses[color]);
      const availableTokens = this.tokens.get(color);
      const spendColoredTokens = Math.min(discountedCost, availableTokens);
      const shortfall = discountedCost - spendColoredTokens;

      if (spendColoredTokens > 0) {
        payment.add({ [color]: spendColoredTokens });
      }

      goldNeeded += shortfall;
    }

    if (goldNeeded > this.tokens.get("gold")) {
      return null;
    }

    if (goldNeeded > 0) {
      payment.add({ gold: goldNeeded });
    }

    return payment;
  }

  public canAfford(card: DevelopmentCard): boolean {
    return this.getPurchasePlan(card) !== null;
  }

  public receiveTokens(tokens: TokenCountInput): void {
    this.tokens.add(tokens);
  }

  public spendTokens(tokens: TokenCountInput): void {
    this.tokens.remove(tokens);
  }

  public reserveCard(card: DevelopmentCard): void {
    this.reservedCards.add(card);
  }

  public acquirePurchasedCard(card: DevelopmentCard): void {
    this.purchasedCards.add(card);
  }

  public claimNoble(noble: NobleTile): void {
    this.nobles.push(noble);
  }

  public toSnapshot(): PlayerSnapshot {
    return {
      id: this.id,
      name: this.name,
      points: this.points,
      tokenCount: this.tokenCount,
      tokens: this.tokens.toObject(),
      bonuses: this.bonuses,
      purchasedCardCount: this.purchasedCardCount,
      purchasedCards: this.purchasedCards
        .getAllCards()
        .map((card) => card.toSnapshot()),
      reservedCards: this.reservedCards.list().map((card) => card.toSnapshot()),
      nobles: this.nobles.map((noble) => noble.toSnapshot()),
    };
  }
}

type FaceUpCardsByLevel = Record<CardLevel, DevelopmentCard[]>;
type DecksByLevel = Record<CardLevel, Deck<DevelopmentCard>>;

export class CardMarket {
  private readonly decks: DecksByLevel;
  private readonly faceUpCards: FaceUpCardsByLevel = {
    1: [],
    2: [],
    3: [],
  };

  public constructor(
    cardDefinitions: readonly DevelopmentCardDefinition[],
    options?: { shuffle?: boolean; random?: () => number },
  ) {
    const cardsByLevel: Record<CardLevel, DevelopmentCard[]> = {
      1: [],
      2: [],
      3: [],
    };

    for (const definition of cardDefinitions) {
      cardsByLevel[definition.level].push(new DevelopmentCard(definition));
    }

    this.decks = {
      1: new Deck(cardsByLevel[1], options),
      2: new Deck(cardsByLevel[2], options),
      3: new Deck(cardsByLevel[3], options),
    };

    for (const level of [1, 2, 3] as const) {
      this.refillLevel(level);
    }
  }

  private refillLevel(level: CardLevel): void {
    while (this.faceUpCards[level].length < 4 && !this.decks[level].isEmpty) {
      const nextCard = this.decks[level].draw();
      if (nextCard) {
        this.faceUpCards[level].push(nextCard);
      }
    }
  }

  public getFaceUpCards(level: CardLevel): DevelopmentCard[] {
    return [...this.faceUpCards[level]];
  }

  public getFaceUpCard(cardId: string): DevelopmentCard | null {
    for (const level of [1, 2, 3] as const) {
      const card = this.faceUpCards[level].find(
        (candidateCard) => candidateCard.id === cardId,
      );
      if (card) {
        return card;
      }
    }

    return null;
  }

  public takeFaceUpCard(cardId: string): DevelopmentCard {
    for (const level of [1, 2, 3] as const) {
      const index = this.faceUpCards[level].findIndex(
        (candidateCard) => candidateCard.id === cardId,
      );

      if (index !== -1) {
        const [card] = this.faceUpCards[level].splice(index, 1);
        this.refillLevel(level);
        return card as DevelopmentCard;
      }
    }

    throw new Error(`Face-up card "${cardId}" was not found.`);
  }

  public drawFromDeck(level: CardLevel): DevelopmentCard | null {
    return this.decks[level].draw();
  }

  public getDeckCount(level: CardLevel): number {
    return this.decks[level].size;
  }

  public toSnapshot(): CardMarketSnapshot {
    const level1 = this.getLevelSnapshot(1);
    const level2 = this.getLevelSnapshot(2);
    const level3 = this.getLevelSnapshot(3);

    return { level1, level2, level3 };
  }

  private getLevelSnapshot(level: CardLevel) {
    return {
      deckCount: this.getDeckCount(level),
      faceUpCards: this.faceUpCards[level].map((card) => card.toSnapshot()),
    };
  }
}

export class Bank {
  public readonly tokens: TokenCollection;

  public constructor(initialTokens: TokenCountInput) {
    this.tokens = new TokenCollection(initialTokens);
  }

  public static createStandard(playerCount: number): Bank {
    if (playerCount < 2 || playerCount > 4) {
      throw new Error("Splendor requires 2 to 4 players.");
    }

    const gemCount = playerCount === 2 ? 4 : playerCount === 3 ? 5 : 7;
    return new Bank({
      white: gemCount,
      blue: gemCount,
      green: gemCount,
      red: gemCount,
      black: gemCount,
      gold: 5,
    });
  }

  public available(color: TokenColor): number {
    return this.tokens.get(color);
  }

  public canTakeDistinct(colors: readonly GemColor[]): boolean {
    const uniqueColors = new Set(colors);
    if (colors.length !== 3 || uniqueColors.size !== 3) {
      return false;
    }

    return colors.every((color) => this.available(color) > 0);
  }

  public canTakePair(color: GemColor): boolean {
    return this.available(color) >= 4;
  }

  public take(tokens: TokenCountInput): void {
    this.tokens.remove(tokens);
  }

  public return(tokens: TokenCountInput): void {
    this.tokens.add(tokens);
  }

  public toSnapshot(): TokenCounts {
    return this.tokens.toObject();
  }
}
