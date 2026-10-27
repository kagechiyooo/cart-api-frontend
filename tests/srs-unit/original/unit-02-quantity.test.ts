
import { test } from "vitest";
import assert from "node:assert/strict";
import { validateQuantityChange } from "../../../backend/api/business/pricing.js";

const validInput = {
  operation: "add" as const,
  quantity: 1,
  productExists: true,
  inCart: false,
  available: true,
  currentQtyInCart: 0,
  availableStock: 20,
};

const quantityCases = [
  { id: "UT-006", name: "add 1", input: {}, expected: "OK" },
  { id: "UT-007", name: "add 10", input: { quantity: 10 }, expected: "OK" },
  { id: "UT-008", name: "add 0", input: { quantity: 0 }, expected: "QTY_OUT_OF_RANGE" },
  { id: "UT-009", name: "add 11", input: { quantity: 11 }, expected: "QTY_OUT_OF_RANGE" },
  { id: "UT-010", name: "decimal quantity", input: { quantity: 1.5 }, expected: "VALIDATION_ERROR" },
  { id: "UT-011", name: "string quantity", input: { quantity: "2" }, expected: "VALIDATION_ERROR" },
  { id: "UT-012", name: "missing product", input: { productExists: false }, expected: "PRODUCT_NOT_FOUND" },
  { id: "UT-013", name: "unavailable product", input: { available: false }, expected: "PRODUCT_UNAVAILABLE" },
  { id: "UT-014", name: "combined quantity 10", input: { quantity: 2, currentQtyInCart: 8 }, expected: "OK" },
  { id: "UT-015", name: "combined quantity 11", input: { quantity: 3, currentQtyInCart: 8 }, expected: "QTY_OUT_OF_RANGE" },
  { id: "UT-016", name: "insufficient stock", input: { quantity: 4, availableStock: 3 }, expected: "INSUFFICIENT_STOCK" },
  { id: "UT-017", name: "update quantity", input: { operation: "update", inCart: true, quantity: 5 }, expected: "OK" },
  { id: "UT-018", name: "update item not in cart", input: { operation: "update", inCart: false }, expected: "ITEM_NOT_IN_CART" },
  { id: "UT-019", name: "update quantity 0", input: { operation: "update", inCart: true, quantity: 0 }, expected: "QTY_OUT_OF_RANGE" },
  { id: "UT-020", name: "validation precedence", input: { quantity: 1.5, productExists: false }, expected: "VALIDATION_ERROR" },
] as const;

for (const tc of quantityCases) {
  test(`${tc.id}: ${tc.name}`, () => {
    const actual = validateQuantityChange({
      ...validInput,
      ...tc.input,
    });

    assert.equal(actual, tc.expected);
  });
}

const additionalCases = [
  {
    id: "UT-021",
    name: "negative quantity -1",
    input: { quantity: -1 },
    expected: "QTY_OUT_OF_RANGE",
  },
  {
    id: "UT-022",
    name: "quantity missing",
    input: { quantity: undefined },
    expected: "VALIDATION_ERROR",
  },
  {
    id: "UT-023",
    name: "range error before missing product",
    input: { quantity: 11, productExists: false },
    expected: "QTY_OUT_OF_RANGE",
  },
  {
    id: "UT-024",
    name: "missing product before unavailable",
    input: { productExists: false, available: false },
    expected: "PRODUCT_NOT_FOUND",
  },
  {
    id: "UT-025",
    name: "unavailable before combined quantity",
    input: {
      available: false,
      currentQtyInCart: 10,
    },
    expected: "PRODUCT_UNAVAILABLE",
  },
  {
    id: "UT-026",
    name: "combined quantity before stock",
    input: {
      quantity: 2,
      currentQtyInCart: 9,
      availableStock: 3,
    },
    expected: "QTY_OUT_OF_RANGE",
  },
  {
    id: "UT-027",
    name: "update ignores old quantity when checking stock",
    input: {
      operation: "update",
      inCart: true,
      quantity: 3,
      currentQtyInCart: 9,
      availableStock: 3,
    },
    expected: "OK",
  },
  {
    id: "UT-028",
    name: "update stock boundary exceeded",
    input: {
      operation: "update",
      inCart: true,
      quantity: 4,
      availableStock: 3,
    },
    expected: "INSUFFICIENT_STOCK",
  },
  {
    id: "UT-029",
    name: "update missing item before unavailable",
    input: {
      operation: "update",
      inCart: false,
      available: false,
    },
    expected: "ITEM_NOT_IN_CART",
  },
  {
    id: "UT-030",
    name: "update unavailable before insufficient stock",
    input: {
      operation: "update",
      inCart: true,
      quantity: 4,
      available: false,
      availableStock: 3,
    },
    expected: "PRODUCT_UNAVAILABLE",
  },
] as const;

for (const tc of additionalCases) {
  test(`${tc.id}: ${tc.name}`, () => {
    const actual = validateQuantityChange({
      ...validInput,
      ...tc.input,
    });

    assert.equal(actual, tc.expected);
  });
}
