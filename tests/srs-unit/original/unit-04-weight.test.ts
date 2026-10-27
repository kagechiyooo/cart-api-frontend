
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTotalWeight } from "../../../business/pricing.js";

const weightCases = [
  {
    id: "UT-039",
    name: "empty cart returns zero",
    items: [],
    expected: 0,
  },
  {
    id: "UT-040",
    name: "single product quantity 1",
    items: [{ weightGram: 300, quantity: 1 }],
    expected: 300,
  },
  {
    id: "UT-041",
    name: "single product quantity 3",
    items: [{ weightGram: 300, quantity: 3 }],
    expected: 900,
  },
  {
    id: "UT-042",
    name: "two different products",
    items: [
      { weightGram: 300, quantity: 1 },
      { weightGram: 900, quantity: 1 },
    ],
    expected: 1200,
  },
  {
    id: "UT-043",
    name: "multiple products and quantities",
    items: [
      { weightGram: 300, quantity: 2 },
      { weightGram: 900, quantity: 3 },
    ],
    expected: 3300,
  },
  {
    id: "UT-044",
    name: "heavy product quantity 2",
    items: [{ weightGram: 8000, quantity: 2 }],
    expected: 16000,
  },
  {
    id: "UT-045",
    name: "maximum quantity per item",
    items: [{ weightGram: 300, quantity: 10 }],
    expected: 3000,
  },
  {
    id: "UT-046",
    name: "weight above checkout limit still calculates",
    items: [{ weightGram: 8000, quantity: 3 }],
    expected: 24000,
  },
];

for (const tc of weightCases) {
  test(`${tc.id}: ${tc.name}`, () => {
    const actual = calculateTotalWeight(tc.items);
    assert.equal(actual, tc.expected);
  });
}
