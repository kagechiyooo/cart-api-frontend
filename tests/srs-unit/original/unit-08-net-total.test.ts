
import { test } from "vitest";
import assert from "node:assert/strict";
import { calculateNetTotal } from "../../../backend/api/business/pricing.js";

const netTotalCases = [
  {
    id: "UT-110",
    name: "normal customer with shipping",
    subtotal: 450,
    discount: 0,
    shippingFee: 30,
    expected: 480,
  },
  {
    id: "UT-111",
    name: "prime customer with coupon and free shipping",
    subtotal: 1650,
    discount: 165,
    shippingFee: 0,
    expected: 1485,
  },
  {
    id: "UT-112",
    name: "prime member discount and free shipping",
    subtotal: 1650,
    discount: 82,
    shippingFee: 0,
    expected: 1568,
  },
  {
    id: "UT-113",
    name: "prime discount with express shipping",
    subtotal: 900,
    discount: 45,
    shippingFee: 25,
    expected: 880,
  },
  {
    id: "UT-114",
    name: "heavy remote express shipping",
    subtotal: 15000,
    discount: 0,
    shippingFee: 270,
    expected: 15270,
  },
  {
    id: "UT-115",
    name: "coupon discount with standard shipping",
    subtotal: 1200,
    discount: 120,
    shippingFee: 30,
    expected: 1110,
  },
  {
    id: "UT-116",
    name: "no discount and free shipping",
    subtotal: 1000,
    discount: 0,
    shippingFee: 0,
    expected: 1000,
  },
  {
    id: "UT-117",
    name: "discount equals subtotal",
    subtotal: 1000,
    discount: 1000,
    shippingFee: 0,
    expected: 0,
  },
  {
    id: "UT-118",
    name: "combined discount and shipping",
    subtotal: 2000,
    discount: 100,
    shippingFee: 80,
    expected: 1980,
  },
  {
    id: "UT-119",
    name: "single item without discount or shipping",
    subtotal: 450,
    discount: 0,
    shippingFee: 0,
    expected: 450,
  },
] as const;

for (const tc of netTotalCases) {
  test(`${tc.id}: ${tc.name}`, () => {
    const actual = calculateNetTotal(
      tc.subtotal,
      tc.discount,
      tc.shippingFee,
    );

    assert.equal(actual, tc.expected);
  });
}
