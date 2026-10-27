import { test } from "node:test";
import assert from "node:assert/strict";

import { isProductAvailable } from "../../../backend/api/business/pricing.js";

// UT-001: เปิดขายและมีสต็อก
test("UT-001: active product with stock is available", () => {
  const actual = isProductAvailable(true, 5);
  assert.equal(actual, true);
});

// UT-002: มีสต็อกเท่ากับ 1
test("UT-002: stock 1 is available", () => {
  const actual = isProductAvailable(true, 1);
  assert.equal(actual, true);
});

// UT-003: มีสต็อกเท่ากับ 0
test("UT-003: stock 0 is unavailable", () => {
  const actual = isProductAvailable(true, 0);
  assert.equal(actual, false);
});

// UT-004: ปิดขายแต่มีสต็อก
test("UT-004: inactive product with stock is unavailable", () => {
  const actual = isProductAvailable(false, 5);
  assert.equal(actual, false);
});

// UT-005: ปิดขายและไม่มีสต็อก
test("UT-005: inactive product without stock is unavailable", () => {
  const actual = isProductAvailable(false, 0);
  assert.equal(actual, false);
});