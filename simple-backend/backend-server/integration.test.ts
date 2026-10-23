import { test } from "node:test";
import assert from "node:assert/strict";
const enabled =
  process.env.NODE_ENV === "test" &&
  process.env.ENABLE_TEST_ROUTES === "true" &&
  process.env.ISOLATED_TEST_DATABASE === "true" &&
  !!process.env.DATABASE_URL;
test(
  "isolated PostgreSQL service acceptance: reservation, rollback, cancel, payment, snapshots",
  { skip: !enabled },
  async () => {
    const { app } = await import("./app.js");
    const { pool } = await import("../database-server/store.js");
    const server = app.listen(0);
    await new Promise<void>((r) => server.once("listening", r));
    const address = server.address() as { port: number };
    const base = `http://127.0.0.1:${address.port}`;
    async function call(
      path: string,
      method = "GET",
      body?: unknown,
      token?: string,
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: (await response.json()) as any };
    }
    async function databaseState() {
      const state: Record<string, unknown> = {};
      for (const table of [
        "products",
        "coupons",
        "carts",
        "cart_lines",
        "orders",
        "order_lines",
        "sessions",
        "users",
      ]) {
        state[table] = (
          await pool.query(
            `SELECT to_jsonb(t) AS row FROM cart_api.${table} t ORDER BY to_jsonb(t)::text`,
          )
        ).rows;
      }
      return state;
    }
    async function rejectedCallbacks(
      orderId: string,
      status = 400,
      code = "OPERATION_NOT_ALLOWED",
    ) {
      const before = await databaseState();
      for (const action of ["success", "fail"]) {
        const result = await call(`/payments/${orderId}/${action}`, "POST");
        assert.equal(result.status, status);
        assert.equal(result.data.code, code);
        assert.deepEqual(await databaseState(), before);
      }
    }
    try {
      assert.equal((await call("/test/reset", "POST")).status, 200);
      const catalog = (await call("/products")).data;
      assert.equal(catalog.length, 8);
      assert.ok(catalog.every((p: any) => /^\/products\/.+[.]png$/.test(p.imageUrl)));
      // SRS arithmetic fixtures belong only to this explicitly isolated, reset database.
      for (const fixture of [
        ["P1", "Coffee Beans 250g", 450, 300, 20],
        ["P2", "Drip Kettle", 1200, 900, 3],
        ["P3", "Espresso Machine", 15000, 8000, 5],
      ]) {
        await pool.query(
          "INSERT INTO cart_api.products(id,name,price,weight_gram,stock) VALUES($1,$2,$3,$4,$5)",
          fixture,
        );
      }
      const user = (
        await call("/auth/login", "POST", {
          username: "cus_prime",
          password: "password123",
        })
      ).data.token;
      const admin = (
        await call("/auth/login", "POST", {
          username: "admin01",
          password: "admin123",
        })
      ).data.token;
      assert.equal((await call("/cart")).status, 401);
      assert.equal(
        (await call("/admin/coupons", "GET", undefined, user)).status,
        403,
      );
      await rejectedCallbacks("missing-order", 404, "ORDER_NOT_FOUND");
      const emptyCheckout = await call(
        "/checkout",
        "POST",
        { zone: "inCity", speed: "standard" },
        user,
      );
      assert.equal(emptyCheckout.status, 400);
      assert.equal(emptyCheckout.data.code, "CART_EMPTY");
      const beforeStatusValidation = await databaseState();
      for (const [path, code, status] of [
        ["/admin/products/missing/status", "PRODUCT_NOT_FOUND", 404],
        ["/admin/coupons/missing/status", "COUPON_NOT_FOUND", 404],
        ["/admin/products/P1/status", "VALIDATION_ERROR", 400],
        ["/admin/coupons/SAVE10/status", "VALIDATION_ERROR", 400],
      ] as const) {
        const result = await call(path, "PATCH", { status: "invalid" }, admin);
        assert.equal(result.status, status);
        assert.equal(result.data.code, code);
        assert.deepEqual(await databaseState(), beforeStatusValidation);
      }
      await call("/cart/items", "POST", { productId: "P2", quantity: 1 }, user);
      await call("/cart/coupon", "PUT", { code: "SAVE10" }, user);
      assert.equal(
        (
          await call(
            "/checkout",
            "POST",
            { zone: "bad", speed: "standard" },
            user,
          )
        ).status,
        400,
      );
      assert.equal(
        (await call("/cart", "GET", undefined, user)).data.couponCode,
        "SAVE10",
      );
      const first = (
        await call(
          "/checkout",
          "POST",
          { zone: "inCity", speed: "standard" },
          user,
        )
      ).data;
      assert.equal(first.netTotal, 1080);
      assert.equal(
        (await call("/products", "GET", undefined, admin)).data.find(
          (p: any) => p.productId === "P2",
        ).stock,
        2,
      );
      await call(
        "/admin/products/P2",
        "PATCH",
        { price: 1500, stock: 4 },
        admin,
      );
      assert.equal(
        (await call(`/orders/${first.orderId}`, "GET", undefined, user)).data
          .items[0].price,
        1200,
      );
      await call("/checkout/cancel", "POST", {}, user);
      assert.equal(
        (await call("/products", "GET", undefined, admin)).data.find(
          (p: any) => p.productId === "P2",
        ).stock,
        5,
      );
      await rejectedCallbacks(first.orderId);
      const second = (
        await call(
          "/checkout",
          "POST",
          { zone: "inCity", speed: "standard" },
          user,
        )
      ).data;
      for (const invalidContext of [
        { stage: "ตะกร้า", currentOrderId: second.orderId },
        { stage: "สำเร็จ", currentOrderId: second.orderId },
        { stage: "ชำระเงิน", currentOrderId: first.orderId },
        { stage: "ชำระเงิน", currentOrderId: null },
      ]) {
        await pool.query(
          "UPDATE cart_api.carts SET stage=$2,current_order_id=$3 WHERE user_id=$1",
          ["cus_prime", invalidContext.stage, invalidContext.currentOrderId],
        );
        await rejectedCallbacks(second.orderId);
      }
      await pool.query(
        "UPDATE cart_api.carts SET stage='ชำระเงิน',current_order_id=$2 WHERE user_id=$1",
        ["cus_prime", second.orderId],
      );
      const beforeFailure = await databaseState();
      const failure = await call(`/payments/${second.orderId}/fail`, "POST");
      assert.equal(failure.status, 200);
      assert.equal(failure.data.message, "การชำระเงินล้มเหลว กรุณาลองใหม่");
      assert.deepEqual(await databaseState(), beforeFailure);
      assert.equal(
        (await call("/cart", "GET", undefined, user)).data.stage,
        "ชำระเงิน",
      );
      assert.equal(
        (await call(`/payments/${second.orderId}/success`, "POST")).status,
        200,
      );
      await rejectedCallbacks(second.orderId);
      const cart = (await call("/cart", "GET", undefined, user)).data;
      assert.equal(cart.stage, "สำเร็จ");
      assert.equal(cart.count, 0);
      assert.equal(cart.couponCode, null);
      assert.equal(cart.currentOrderId, second.orderId);
      await call("/checkout/continue-shopping", "POST", {}, user);
      assert.equal(
        (await call("/cart", "GET", undefined, user)).data.currentOrderId,
        null,
      );
      await rejectedCallbacks(second.orderId);
      await call("/cart/items", "POST", { productId: "P1", quantity: 1 }, user);
      await call("/cart/coupon", "PUT", { code: "SAVE10" }, user);
      const removedCouponOrder = await call(
        "/checkout",
        "POST",
        { zone: "inCity", speed: "standard" },
        user,
      );
      assert.equal(removedCouponOrder.status, 200);
      const expectedNotices = [
        {
          code: "COUPON_NOT_APPLICABLE",
          message: "คูปองไม่สามารถใช้กับคำสั่งซื้อนี้",
        },
      ];
      assert.deepEqual(removedCouponOrder.data.notices, expectedNotices);
      assert.equal(removedCouponOrder.data.couponCode, null);
      assert.equal(removedCouponOrder.data.discountSource, "member");
      const removedCouponCart = (await call("/cart", "GET", undefined, user))
        .data;
      assert.deepEqual(removedCouponCart.notices, expectedNotices);
      assert.equal(removedCouponCart.couponCode, null);
    } finally {
      await new Promise<void>((r, e) =>
        server.close((err) => (err ? e(err) : r())),
      );
      await pool.end();
    }
  },
);
