
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateDiscount } from "../../../backend/api/business/pricing.js";

// คูปองตาม Seed Data ของ SRS
const activeCoupon = {
  percent: 10,
  minSpend: 1000,
  active: true,
};

const inactiveCoupon = {
  ...activeCoupon,
  active: false,
};

const discountCases = [
  {
    id: "UT-047",
    name: "R1 prime without coupon",
    subtotal: 1650,
    memberTier: "prime",
    coupon: null,
    expected: {
      discount: 82,
      source: "member",
      couponRemoved: false,
    },
  },
  {
    id: "UT-048",
    name: "R2 normal without coupon",
    subtotal: 1650,
    memberTier: "normal",
    coupon: null,
    expected: {
      discount: 0,
      source: "none",
      couponRemoved: false,
    },
  },
  {
    id: "UT-049",
    name: "R3 prime with inactive coupon",
    subtotal: 1650,
    memberTier: "prime",
    coupon: inactiveCoupon,
    expected: {
      discount: 82,
      source: "member",
      couponRemoved: true,
    },
  },
  {
    id: "UT-050",
    name: "R4 normal with inactive coupon",
    subtotal: 1650,
    memberTier: "normal",
    coupon: inactiveCoupon,
    expected: {
      discount: 0,
      source: "none",
      couponRemoved: true,
    },
  },
  {
    id: "UT-051",
    name: "R5 prime below minimum spend",
    subtotal: 900,
    memberTier: "prime",
    coupon: activeCoupon,
    expected: {
      discount: 45,
      source: "member",
      couponRemoved: true,
    },
  },
  {
    id: "UT-052",
    name: "R6 normal below minimum spend",
    subtotal: 900,
    memberTier: "normal",
    coupon: activeCoupon,
    expected: {
      discount: 0,
      source: "none",
      couponRemoved: true,
    },
  },
  {
    id: "UT-053",
    name: "R7 prime qualifying coupon no stacking",
    subtotal: 1650,
    memberTier: "prime",
    coupon: activeCoupon,
    expected: {
      discount: 165,
      source: "coupon",
      couponRemoved: false,
    },
  },
  {
    id: "UT-054",
    name: "R7 normal qualifying coupon",
    subtotal: 1200,
    memberTier: "normal",
    coupon: activeCoupon,
    expected: {
      discount: 120,
      source: "coupon",
      couponRemoved: false,
    },
  },
  {
    id: "UT-055",
    name: "subtotal exactly at coupon minimum",
    subtotal: 1000,
    memberTier: "normal",
    coupon: activeCoupon,
    expected: {
      discount: 100,
      source: "coupon",
      couponRemoved: false,
    },
  },
  {
    id: "UT-056",
    name: "subtotal one below coupon minimum",
    subtotal: 999,
    memberTier: "prime",
    coupon: activeCoupon,
    expected: {
      discount: 49,
      source: "member",
      couponRemoved: true,
    },
  },
  {
    id: "UT-057",
    name: "coupon discount rounds down",
    subtotal: 1001,
    memberTier: "normal",
    coupon: activeCoupon,
    expected: {
      discount: 100,
      source: "coupon",
      couponRemoved: false,
    },
  },
  {
    id: "UT-058",
    name: "prime discount rounds down",
    subtotal: 1001,
    memberTier: "prime",
    coupon: null,
    expected: {
      discount: 50,
      source: "member",
      couponRemoved: false,
    },
  },
  {
    id: "UT-059",
    name: "inactive coupon above minimum spend",
    subtotal: 1200,
    memberTier: "normal",
    coupon: inactiveCoupon,
    expected: {
      discount: 0,
      source: "none",
      couponRemoved: true,
    },
  },
] as const;

for (const tc of discountCases) {
  test(`${tc.id}: ${tc.name}`, () => {
    const actual = calculateDiscount(
      tc.subtotal,
      tc.memberTier,
      tc.coupon,
    );

    assert.deepEqual(actual, tc.expected);
  });
}
