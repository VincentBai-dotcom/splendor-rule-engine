import type {
  CardLevel,
  DevelopmentCardDefinition,
  GemColor,
  GemCounts,
} from "../types.ts";

const CSV_COLOR_MAP = {
  White: "white",
  Blue: "blue",
  Green: "green",
  Red: "red",
  Black: "black",
} as const satisfies Record<string, GemColor>;

export const STANDARD_DEVELOPMENT_CARDS_CSV = `Level,Color,PV,Black,Blue,Green,Red,White
1,Black,0,0,1,1,1,1
1,Black,0,0,2,1,1,1
1,Black,0,0,2,0,1,2
1,Black,0,1,0,1,3,0
1,Black,0,0,0,2,1,0
1,Black,0,0,0,2,0,2
1,Black,0,0,0,3,0,0
1,Black,1,0,4,0,0,0
1,Blue,0,1,0,1,1,1
1,Blue,0,1,0,1,2,1
1,Blue,0,0,0,2,2,1
1,Blue,0,0,1,3,1,0
1,Blue,0,2,0,0,0,1
1,Blue,0,2,0,2,0,0
1,Blue,0,3,0,0,0,0
1,Blue,1,0,0,0,4,0
1,White,0,1,1,1,1,0
1,White,0,1,1,2,1,0
1,White,0,1,2,2,0,0
1,White,0,1,1,0,0,3
1,White,0,1,0,0,2,0
1,White,0,2,2,0,0,0
1,White,0,0,3,0,0,0
1,White,1,0,0,4,0,0
1,Green,0,1,1,0,1,1
1,Green,0,2,1,0,1,1
1,Green,0,2,1,0,2,0
1,Green,0,0,3,1,0,1
1,Green,0,0,1,0,0,2
1,Green,0,0,2,0,2,0
1,Green,0,0,0,0,3,0
1,Green,1,4,0,0,0,0
1,Red,0,1,1,1,0,1
1,Red,0,1,1,1,0,2
1,Red,0,2,0,1,0,2
1,Red,0,3,0,0,1,1
1,Red,0,0,2,1,0,0
1,Red,0,0,0,0,2,2
1,Red,0,0,0,0,0,3
1,Red,1,0,0,0,0,4
2,Black,1,0,2,2,0,3
2,Black,1,2,0,3,0,3
2,Black,2,0,1,4,2,0
2,Black,2,0,0,5,3,0
2,Black,2,0,0,0,0,5
2,Black,3,6,0,0,0,0
2,Blue,1,0,2,2,3,0
2,Blue,1,3,2,3,0,0
2,Blue,2,0,3,0,0,5
2,Blue,2,4,0,0,1,2
2,Blue,2,0,5,0,0,0
2,Blue,3,0,6,0,0,0
2,White,1,2,0,3,2,0
2,White,1,0,3,0,3,2
2,White,2,2,0,1,4,0
2,White,2,3,0,0,5,0
2,White,2,0,0,0,5,0
2,White,3,0,0,0,0,6
2,Green,1,0,0,2,3,3
2,Green,1,2,3,0,0,2
2,Green,2,1,2,0,0,4
2,Green,2,0,5,3,0,0
2,Green,2,0,0,5,0,0
2,Green,3,0,0,6,0,0
2,Red,1,3,0,0,2,2
2,Red,1,3,3,0,2,0
2,Red,2,0,4,2,0,1
2,Red,2,5,0,0,0,3
2,Red,2,5,0,0,0,0
2,Red,3,0,0,0,6,0
3,Black,3,0,3,5,3,3
3,Black,4,0,0,0,7,0
3,Black,4,3,0,3,6,0
3,Black,5,3,0,0,7,0
3,Blue,3,5,0,3,3,3
3,Blue,4,0,0,0,0,7
3,Blue,4,3,3,0,0,6
3,Blue,5,0,3,0,0,7
3,White,3,3,3,3,5,0
3,White,4,7,0,0,0,0
3,White,4,6,0,0,3,3
3,White,5,7,0,0,0,3
3,Green,3,3,3,0,3,5
3,Green,4,0,7,0,0,0
3,Green,4,0,6,3,0,3
3,Green,5,0,7,3,0,0
3,Red,3,3,5,3,0,3
3,Red,4,0,0,7,0,0
3,Red,4,0,3,6,3,0
3,Red,5,0,0,7,3,0`;

function createEmptyGemCounts(): GemCounts {
  return {
    white: 0,
    blue: 0,
    green: 0,
    red: 0,
    black: 0,
  };
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const character of line) {
    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCardLevel(rawLevel: string): CardLevel {
  const level = Number.parseInt(rawLevel, 10);
  if (level !== 1 && level !== 2 && level !== 3) {
    throw new Error(`Invalid card level "${rawLevel}".`);
  }

  return level;
}

function parseGemColor(rawColor: string): GemColor {
  const color = CSV_COLOR_MAP[rawColor as keyof typeof CSV_COLOR_MAP];
  if (!color) {
    throw new Error(`Invalid gem color "${rawColor}".`);
  }

  return color;
}

function parseCount(rawCount: string, fieldName: string): number {
  const count = Number.parseInt(rawCount, 10);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Invalid count "${rawCount}" in ${fieldName}.`);
  }

  return count;
}

export function parseDevelopmentCardsCsv(
  csvText: string,
): DevelopmentCardDefinition[] {
  const lines = csvText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("The development card CSV must include a header and rows.");
  }

  const [header, ...rows] = lines;
  const expectedHeader = "Level,Color,PV,Black,Blue,Green,Red,White";
  if (header !== expectedHeader) {
    throw new Error(`Unexpected CSV header "${header}".`);
  }

  return rows.map((row, index) => {
    const fields = parseCsvLine(row);
    if (fields.length !== 8) {
      throw new Error(
        `Expected 8 CSV fields on row ${index + 2}, received ${fields.length}.`,
      );
    }

    const [level, color, points, black, blue, green, red, white] = fields;
    const cost = createEmptyGemCounts();
    cost.black = parseCount(black, "Black");
    cost.blue = parseCount(blue, "Blue");
    cost.green = parseCount(green, "Green");
    cost.red = parseCount(red, "Red");
    cost.white = parseCount(white, "White");

    return {
      id: String(index + 1).padStart(2, "0"),
      level: parseCardLevel(level),
      bonusColor: parseGemColor(color),
      points: parseCount(points, "PV"),
      cost,
    };
  });
}

export const STANDARD_DEVELOPMENT_CARD_DEFINITIONS = parseDevelopmentCardsCsv(
  STANDARD_DEVELOPMENT_CARDS_CSV,
);
