
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateSubtotal } from "../../../backend/api/business/pricing.js";

const subtotalCases = [
  {
    id: "UT-031",
    name: "empty cart returns zero",
    items: [],
    expected: 0,
  },
  {
    id: "UT-032",
    name: "single item quantity 1",
    items: [{ price: 450, quantity: 1 }],
    expected: 450,
  },
  {
    id: "UT-033",
    name: "single item quantity 2",
    items: [{ price: 450, quantity: 2 }],
    expected: 900,
  },
  {
    id: "UT-034",
    name: "two different products",
    items: [
      { price: 450, quantity: 1 },
      { price: 1200, quantity: 1 },
    ],
    expected: 1650,
  },
  {
    id: "UT-035",
    name: "multiple products and quantities",
    items: [
      { price: 450, quantity: 2 },
      { price: 1200, quantity: 3 },
    ],
    expected: 4500,
  },
  {
    id: "UT-036",
    name: "high price product",
    items: [{ price: 15000, quantity: 5 }],
    expected: 75000,
  },
  {
    id: "UT-037",
    name: "maximum quantity per item",
    items: [{ price: 450, quantity: 10 }],
    expected: 4500,
  },
  {
    id: "UT-038",
    name: "updated product price",
    items: [{ price: 500, quantity: 1 }],
    expected: 500,
  },
];

for (const tc of subtotalCases) {
  test(`${tc.id}: ${tc.name}`, () => {
    const actual = calculateSubtotal(tc.items);
    assert.equal(actual, tc.expected);
  });
}
