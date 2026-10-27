
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateQuantityChange } from "../../../business/pricing.js";

const validInput = {
  operation: "add" as const,
  quantity: 1,
  productExists: true,
  inCart: false,
  available: true,
  currentQtyInCart: 0,
  availableStock: 20,
};

const extraCases = [
  {
    id: "UT-155",
    name: "NaN quantity",
    input: { quantity: NaN },
    expected: "VALIDATION_ERROR",
  },
  {
    id: "UT-156",
    name: "null quantity",
    input: { quantity: null },
    expected: "VALIDATION_ERROR",
  },
  {
    id: "UT-157",
    name: "update quantity at maximum 10",
    input: {
      operation: "update",
      inCart: true,
      quantity: 10,
    },
    expected: "OK",
  },
  {
    id: "UT-158",
    name: "update quantity above maximum 11",
    input: {
      operation: "update",
      inCart: true,
      quantity: 11,
    },
    expected: "QTY_OUT_OF_RANGE",
  },
] as const;

for (const tc of extraCases) {
  test(`${tc.id}: ${tc.name}`, () => {
    const actual = validateQuantityChange({
      ...validInput,
      ...tc.input,
    });

    assert.equal(actual, tc.expected);
  });
}
