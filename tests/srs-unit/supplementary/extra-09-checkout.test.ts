
import { test } from "vitest";
import assert from "node:assert/strict";
import { validateCheckout } from "../../../backend/api/business/pricing.js";

const validInput = {
  zone: "inCity",
  speed: "standard",
  lines: [
    {
      productId: "P1",
      quantity: 1,
      available: true,
      availableStock: 5,
    },
  ],
  totalWeightGram: 300,
};

const extraCases = [
  {
    id: "UT-159",
    name: "quantity exactly equals available stock",
    input: {
      lines: [
        {
          productId: "P1",
          quantity: 5,
          available: true,
          availableStock: 5,
        },
      ],
    },
    expected: { result: "OK" },
  },
  {
    id: "UT-160",
    name: "quantity exceeds stock by one",
    input: {
      lines: [
        {
          productId: "P1",
          quantity: 6,
          available: true,
          availableStock: 5,
        },
      ],
    },
    expected: {
      result: "ITEMS_UNAVAILABLE",
      productIds: ["P1"],
    },
  },
  {
    id: "UT-161",
    name: "unavailable item at end of cart",
    input: {
      lines: [
        {
          productId: "P1",
          quantity: 1,
          available: true,
          availableStock: 5,
        },
        {
          productId: "P2",
          quantity: 2,
          available: false,
          availableStock: 5,
        },
      ],
    },
    expected: {
      result: "ITEMS_UNAVAILABLE",
      productIds: ["P2"],
    },
  },
  {
    id: "UT-162",
    name: "unavailable items at first and last positions",
    input: {
      lines: [
        {
          productId: "P1",
          quantity: 1,
          available: false,
          availableStock: 5,
        },
        {
          productId: "P2",
          quantity: 1,
          available: true,
          availableStock: 5,
        },
        {
          productId: "P3",
          quantity: 6,
          available: true,
          availableStock: 5,
        },
      ],
    },
    expected: {
      result: "ITEMS_UNAVAILABLE",
      productIds: ["P1", "P3"],
    },
  },
  {
    id: "UT-163",
    name: "invalid speed takes precedence over unavailable item",
    input: {
      speed: "invalid",
      lines: [
        {
          productId: "P1",
          quantity: 1,
          available: false,
          availableStock: 5,
        },
      ],
    },
    expected: { result: "VALIDATION_ERROR" },
  },
  {
    id: "UT-164",
    name: "same item fails availability and stock checks",
    input: {
      lines: [
        {
          productId: "P1",
          quantity: 6,
          available: false,
          availableStock: 5,
        },
      ],
    },
    expected: {
      result: "ITEMS_UNAVAILABLE",
      productIds: ["P1"],
    },
  },
];

for (const tc of extraCases) {
  test(`${tc.id}: ${tc.name}`, () => {
    const actual = validateCheckout({
      ...validInput,
      ...tc.input,
      lines: [...(tc.input.lines ?? validInput.lines)],
    });

    assert.deepEqual(actual, tc.expected);
  });
}
