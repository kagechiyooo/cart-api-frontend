
import { test } from "vitest";
import assert from "node:assert/strict";
import { validateProductUpdate } from "../../../backend/api/business/pricing.js";

// FR-9.1.1: Price 1–50000, Stock 0–9999
const productUpdateCases = [
  {
    id: "UT-135",
    name: "valid price only",
    input: { price: 500 },
    expected: [],
  },
  {
    id: "UT-136",
    name: "valid stock only",
    input: { stock: 20 },
    expected: [],
  },
  {
    id: "UT-137",
    name: "valid price and stock",
    input: { price: 500, stock: 20 },
    expected: [],
  },
  {
    id: "UT-138",
    name: "no fields provided",
    input: {},
    expected: ["price", "stock"],
  },
  {
    id: "UT-139",
    name: "price below minimum",
    input: { price: 0 },
    expected: ["price"],
  },
  {
    id: "UT-140",
    name: "price at minimum",
    input: { price: 1 },
    expected: [],
  },
  {
    id: "UT-141",
    name: "price at maximum",
    input: { price: 50000 },
    expected: [],
  },
  {
    id: "UT-142",
    name: "price above maximum",
    input: { price: 50001 },
    expected: ["price"],
  },
  {
    id: "UT-143",
    name: "negative price",
    input: { price: -1 },
    expected: ["price"],
  },
  {
    id: "UT-144",
    name: "decimal price",
    input: { price: 1.5 },
    expected: ["price"],
  },
  {
    id: "UT-145",
    name: "string price",
    input: { price: "500" },
    expected: ["price"],
  },
  {
    id: "UT-146",
    name: "stock below minimum",
    input: { stock: -1 },
    expected: ["stock"],
  },
  {
    id: "UT-147",
    name: "stock at minimum",
    input: { stock: 0 },
    expected: [],
  },
  {
    id: "UT-148",
    name: "stock at maximum",
    input: { stock: 9999 },
    expected: [],
  },
  {
    id: "UT-149",
    name: "stock above maximum",
    input: { stock: 10000 },
    expected: ["stock"],
  },
  {
    id: "UT-150",
    name: "decimal stock",
    input: { stock: 2.5 },
    expected: ["stock"],
  },
  {
    id: "UT-151",
    name: "string stock",
    input: { stock: "20" },
    expected: ["stock"],
  },
  {
    id: "UT-152",
    name: "both price and stock invalid",
    input: { price: 0, stock: 10000 },
    expected: ["price", "stock"],
  },
  {
    id: "UT-153",
    name: "valid price and invalid stock",
    input: { price: 500, stock: -1 },
    expected: ["stock"],
  },
  {
    id: "UT-154",
    name: "invalid price and valid stock",
    input: { price: 0, stock: 20 },
    expected: ["price"],
  },
];

for (const tc of productUpdateCases) {
  test(`${tc.id}: ${tc.name}`, () => {
    const actual = validateProductUpdate(tc.input);
    assert.deepEqual(actual, tc.expected);
  });
}
