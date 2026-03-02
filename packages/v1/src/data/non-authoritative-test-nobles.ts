import type { NobleTileDefinition } from "../types.ts";

export const NON_AUTHORITATIVE_TEST_NOBLES: NobleTileDefinition[] = [
  {
    id: "test-noble-black-a",
    name: "Test Noble Black A",
    requirements: { white: 0, blue: 0, green: 0, red: 0, black: 1 },
    authoritative: false,
  },
  {
    id: "test-noble-black-b",
    name: "Test Noble Black B",
    requirements: { white: 0, blue: 0, green: 0, red: 0, black: 1 },
    authoritative: false,
  },
  {
    id: "test-noble-blue",
    name: "Test Noble Blue",
    requirements: { white: 0, blue: 2, green: 0, red: 0, black: 0 },
    authoritative: false,
  },
  {
    id: "test-noble-green",
    name: "Test Noble Green",
    requirements: { white: 0, blue: 0, green: 2, red: 0, black: 0 },
    authoritative: false,
  },
  {
    id: "test-noble-rainbow",
    name: "Test Noble Rainbow",
    requirements: { white: 1, blue: 1, green: 1, red: 1, black: 1 },
    authoritative: false,
  },
];
