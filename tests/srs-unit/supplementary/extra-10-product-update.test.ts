
import { test } from "vitest";
import assert from "node:assert/strict";
import { validateProductUpdate } from "../../../backend/api/business/pricing.js";

const extraCases = [
  {
    id: "UT-165",
    name: "null price",
    input: { price: null },
    expected: ["price"],
  },
  {
    id: "UT-166",
    name: "NaN price",
    input: { price: NaN },
    expected: ["price"],
  },
  {
    id: "UT-167",
    name: "Infinity price",
    input: { price: Infinity },
    expected: ["price"],
  },
  {
    id: "UT-168",
    name: "null stock",
    input: { stock: null },
    expected: ["stock"],
  },
  {
    id: "UT-169",
    name: "NaN stock",
    input: { stock: NaN },
    expected: ["stock"],
  },
  {
    id: "UT-170",
    name: "Infinity stock",
    input: { stock: Infinity },
    expected: ["stock"],
  },
  {
    id: "UT-171",
    name: "negative Infinity price",
    input: { price: -Infinity },
    expected: ["price"],
  },
  {
    id: "UT-172",
    name: "both fields invalid with special values",
    input: { price: null, stock: NaN },
    expected: ["price", "stock"],
  },
] as const;

for (const tc of extraCases) {
  test(`${tc.id}: ${tc.name}`, () => {
    const actual = validateProductUpdate(tc.input);
    assert.deepEqual(actual, tc.expected);
  });
}
