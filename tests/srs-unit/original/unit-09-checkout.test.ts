
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateCheckout,
} from "../../../backend/api/business/pricing.js";

// ข้อมูลตั้งต้นที่ผ่านทุกเงื่อนไข
const validInput = {
  zone: "inCity",
  speed: "standard",
  lines: [
    {
      productId: "P1",
      quantity: 1,
      available: true,
      availableStock: 20,
    },
  ],
  totalWeightGram: 300,
};

// ทดสอบตาม FR-5.1 และ FR-5.2.1
const checkoutCases = [
  {
    id: "UT-120",
    name: "valid checkout",
    input: {},
    expected: { result: "OK" },
  },
  {
    id: "UT-121",
    name: "invalid zone",
    input: { zone: "invalid" },
    expected: { result: "VALIDATION_ERROR" },
  },
  {
    id: "UT-122",
    name: "invalid speed",
    input: { speed: "invalid" },
    expected: { result: "VALIDATION_ERROR" },
  },
  {
    id: "UT-123",
    name: "missing zone",
    input: { zone: undefined },
    expected: { result: "VALIDATION_ERROR" },
  },
  {
    id: "UT-124",
    name: "missing speed",
    input: { speed: undefined },
    expected: { result: "VALIDATION_ERROR" },
  },
  {
    id: "UT-125",
    name: "empty cart",
    input: { lines: [] },
    expected: { result: "CART_EMPTY" },
  },
  {
    id: "UT-126",
    name: "unavailable product",
    input: {
      lines: [
        {
          productId: "P1",
          quantity: 1,
          available: false,
          availableStock: 20,
        },
      ],
    },
    expected: {
      result: "ITEMS_UNAVAILABLE",
      productIds: ["P1"],
    },
  },
  {
    id: "UT-127",
    name: "quantity exceeds available stock",
    input: {
      lines: [
        {
          productId: "P2",
          quantity: 4,
          available: true,
          availableStock: 3,
        },
      ],
    },
    expected: {
      result: "ITEMS_UNAVAILABLE",
      productIds: ["P2"],
    },
  },
  {
    id: "UT-128",
    name: "all unavailable product IDs are returned",
    input: {
      lines: [
        {
          productId: "P1",
          quantity: 1,
          available: false,
          availableStock: 20,
        },
        {
          productId: "P2",
          quantity: 4,
          available: true,
          availableStock: 3,
        },
        {
          productId: "P3",
          quantity: 1,
          available: true,
          availableStock: 5,
        },
      ],
    },
    expected: {
      result: "ITEMS_UNAVAILABLE",
      productIds: ["P1", "P2"],
    },
  },
  {
    id: "UT-129",
    name: "weight exactly 20000 grams",
    input: { totalWeightGram: 20000 },
    expected: { result: "OK" },
  },
  {
    id: "UT-130",
    name: "weight 20001 grams",
    input: { totalWeightGram: 20001 },
    expected: { result: "WEIGHT_LIMIT_EXCEEDED" },
  },
  {
    id: "UT-131",
    name: "invalid zone before empty cart",
    input: {
      zone: "invalid",
      lines: [],
    },
    expected: { result: "VALIDATION_ERROR" },
  },
  {
    id: "UT-132",
    name: "empty cart before weight limit",
    input: {
      lines: [],
      totalWeightGram: 20001,
    },
    expected: { result: "CART_EMPTY" },
  },
  {
    id: "UT-133",
    name: "unavailable items before weight limit",
    input: {
      lines: [
        {
          productId: "P1",
          quantity: 1,
          available: false,
          availableStock: 20,
        },
      ],
      totalWeightGram: 20001,
    },
    expected: {
      result: "ITEMS_UNAVAILABLE",
      productIds: ["P1"],
    },
  },
  {
    id: "UT-134",
    name: "multiple valid products",
    input: {
      lines: [
        {
          productId: "P1",
          quantity: 2,
          available: true,
          availableStock: 20,
        },
        {
          productId: "P2",
          quantity: 1,
          available: true,
          availableStock: 3,
        },
      ],
      totalWeightGram: 1500,
    },
    expected: { result: "OK" },
  },
] as const;

for (const tc of checkoutCases) {
  test(`${tc.id}: ${tc.name}`, () => {
    const actual = validateCheckout({
      ...validInput,
      ...tc.input,
      lines: [...("lines" in tc.input ? tc.input.lines : validInput.lines)],
    });

    assert.deepEqual(actual, tc.expected);
  });
}
