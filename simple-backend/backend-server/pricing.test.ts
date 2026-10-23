import { test } from "node:test";
import assert from "node:assert/strict";
import * as p from "./business/pricing.js";
test("quantity precedence and combined quantities", () => {
  const input = {
    operation: "add" as const,
    quantity: 1,
    productExists: true,
    inCart: true,
    available: true,
    currentQtyInCart: 9,
    availableStock: 20,
  };
  assert.equal(p.validateQuantityChange(input), "OK");
  assert.equal(
    p.validateQuantityChange({ ...input, quantity: 2 }),
    "QTY_OUT_OF_RANGE",
  );
  assert.equal(
    p.validateQuantityChange({ ...input, quantity: 1.5, productExists: false }),
    "VALIDATION_ERROR",
  );
  assert.equal(
    p.validateQuantityChange({ ...input, quantity: 11, productExists: false }),
    "QTY_OUT_OF_RANGE",
  );
  assert.equal(
    p.validateQuantityChange({ ...input, productExists: false }),
    "PRODUCT_NOT_FOUND",
  );
  assert.equal(
    p.validateQuantityChange({ ...input, operation: "update", inCart: false }),
    "ITEM_NOT_IN_CART",
  );
  assert.equal(
    p.validateQuantityChange({ ...input, available: false }),
    "PRODUCT_UNAVAILABLE",
  );
  assert.equal(
    p.validateQuantityChange({ ...input, availableStock: 9 }),
    "INSUFFICIENT_STOCK",
  );
});
test("weight boundaries, coupon replaces prime and integer baht", () => {
  for (const [w, t] of [
    [1000, "light"],
    [1001, "medium"],
    [5000, "medium"],
    [5001, "heavy"],
    [20000, "heavy"],
    [20001, "overLimit"],
  ] as const)
    assert.equal(p.classifyWeight(w), t);
  assert.deepEqual(
    p.calculateDiscount(1001, "prime", {
      percent: 10,
      minSpend: 1000,
      active: true,
    }),
    { discount: 100, source: "coupon", couponRemoved: false },
  );
  assert.deepEqual(
    p.calculateDiscount(999, "prime", {
      percent: 10,
      minSpend: 1000,
      active: true,
    }),
    { discount: 49, source: "member", couponRemoved: true },
  );
  assert.equal(p.calculateNetTotal(1200, 120, 30), 1110);
  assert.equal(p.calculateSubtotal([{ price: 450, quantity: 2 }]), 900);
  assert.equal(p.calculateTotalWeight([{ weightGram: 300, quantity: 2 }]), 600);
});
test("all shipping matrix combinations", () => {
  const tiers = ["light", "medium", "heavy"] as const;
  const zones = ["inCity", "upcountry", "remote"] as const;
  const bases = [
    [30, 50, 80],
    [50, 80, 120],
    [80, 120, 180],
  ];
  for (const [i, t] of tiers.entries())
    for (const [j, z] of zones.entries())
      for (const tier of ["normal", "prime"] as const)
        for (const speed of ["standard", "express"] as const)
          assert.equal(
            p.calculateShippingFee(t, z, speed, tier),
            tier === "prime"
              ? speed === "standard"
                ? 0
                : Math.floor(bases[i][j] * 0.5)
              : speed === "standard"
                ? bases[i][j]
                : Math.floor(bases[i][j] * 1.5),
          );
});
test("checkout validation precedence and all unavailable ids", () => {
  const input = {
    zone: "inCity",
    speed: "standard",
    lines: [],
    totalWeightGram: 20001,
  };
  assert.deepEqual(p.validateCheckout({ ...input, zone: "bad" }), {
    result: "VALIDATION_ERROR",
  });
  assert.deepEqual(p.validateCheckout(input), { result: "CART_EMPTY" });
  const lines = [
    { productId: "P1", quantity: 2, available: false, availableStock: 20 },
    { productId: "P2", quantity: 2, available: true, availableStock: 1 },
  ];
  assert.deepEqual(p.validateCheckout({ ...input, lines }), {
    result: "ITEMS_UNAVAILABLE",
    productIds: ["P1", "P2"],
  });
  assert.deepEqual(
    p.validateCheckout({ ...input, lines: [{ ...lines[0], available: true }] }),
    { result: "WEIGHT_LIMIT_EXCEEDED" },
  );
  assert.deepEqual(p.validateProductUpdate({ price: 0, stock: 10000 }), [
    "price",
    "stock",
  ]);
});
