import express from "express";
import cors from "cors";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  transaction,
  verifyPassword,
  reset,
} from "../database-server/store.js";
import * as p from "./business/pricing.js";
export class DomainError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}
const reject = (
  code: string,
  status = 400,
  details: Record<string, unknown> = {},
): never => {
  throw new DomainError(code, status, details);
};
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const product = (r: any) => ({
  productId: r.id,
  name: r.name,
  price: r.price,
  weightGram: r.weight_gram,
  stock: r.stock,
  status: r.status,
  description: r.description,
  category: r.category,
  imageUrl: r.image_url,
});
const coupon = (r: any) =>
  r
    ? {
        code: r.code,
        percent: r.percent,
        minSpend: r.min_spend,
        status: r.status,
      }
    : null;
const order = (r: any) => ({
  ...r.snapshot,
  orderId: r.id,
  userId: r.user_id,
  status: r.status,
  createdAt: r.created_at.toISOString(),
});
async function one(db: PoolClient, sql: string, args: unknown[] = []) {
  return (await db.query(sql, args)).rows[0];
}
async function cartRow(db: PoolClient, uid: string) {
  return one(db, "SELECT * FROM cart_api.carts WHERE user_id=$1 FOR UPDATE", [
    uid,
  ]);
}
async function lines(db: PoolClient, uid: string) {
  return (
    await db.query(
      "SELECT p.*,l.quantity FROM cart_api.cart_lines l JOIN cart_api.products p ON p.id=l.product_id WHERE l.user_id=$1 ORDER BY p.id FOR UPDATE OF p,l",
      [uid],
    )
  ).rows.map((r) => ({
    ...product(r),
    quantity: r.quantity,
    available: p.isProductAvailable(r.status === "เปิดขาย", r.stock),
  }));
}
async function cart(db: PoolClient, uid: string) {
  const c = await cartRow(db, uid);
  const items = await lines(db, uid);
  return {
    stage: c.stage,
    items,
    count: items.length,
    total: p.calculateSubtotal(items),
    couponCode: c.coupon_code,
    coupon: coupon(
      await one(db, "SELECT * FROM cart_api.coupons WHERE code=$1", [
        c.coupon_code,
      ]),
    ),
    currentOrderId: c.current_order_id,
    notices: c.notices,
  };
}
function requireStage(c: any, stage = "ตะกร้า") {
  if (c.stage !== stage) reject("OPERATION_NOT_ALLOWED");
}
export const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json({ limit: "32kb" }));
type Handler = (
  db: PoolClient,
  req: express.Request,
  user: any,
) => Promise<unknown>;
function route(
  method: "get" | "post" | "patch" | "put" | "delete",
  path: string,
  role: "Customer" | "Admin" | "any" | null,
  fn: Handler,
) {
  app[method](path, async (req, res, next) => {
    try {
      const data = await transaction(async (db) => {
        let user: any = null;
        if (role) {
          const auth = req.headers.authorization;
          if (!auth?.startsWith("Bearer ")) reject("AUTH_REQUIRED", 401);
          user = await one(
            db,
            "SELECT u.* FROM cart_api.sessions s JOIN cart_api.users u ON u.id=s.user_id WHERE s.token_hash=$1",
            [digest(auth!.slice(7))],
          );
          if (!user) reject("AUTH_REQUIRED", 401);
          if (role !== "any" && user.role !== role)
            reject("AUTH_FORBIDDEN", 403);
        }
        return fn(db, req, user);
      });
      res.json(data);
    } catch (e) {
      next(e);
    }
  });
}
route("post", "/auth/login", null, async (db, req) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string")
    reject("VALIDATION_ERROR");
  const u = await one(db, "SELECT * FROM cart_api.users WHERE username=$1", [
    username,
  ]);
  if (!u || !verifyPassword(password, u.password_hash))
    reject("AUTH_INVALID_CREDENTIALS", 401);
  const token = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO cart_api.sessions(token_hash,user_id) VALUES($1,$2)",
    [digest(token), u.id],
  );
  return { token, role: u.role, memberTier: u.member_tier };
});
route("get", "/products", "any", async (db, req, u) =>
  (
    await db.query(
      u.role === "Admin"
        ? "SELECT * FROM cart_api.products ORDER BY id"
        : "SELECT * FROM cart_api.products WHERE status='เปิดขาย' AND stock>=1 ORDER BY id",
    )
  ).rows.map(product),
);
route("get", "/cart", "Customer", async (db, req, u) => cart(db, u.id));
for (const method of ["post", "patch"] as const)
  route(
    method,
    method === "post" ? "/cart/items" : "/cart/items/:id",
    "Customer",
    async (db, req, u) => {
      requireStage(await cartRow(db, u.id));
      const id = method === "post" ? req.body?.productId : req.params.id;
      const q = req.body?.quantity;
      const r =
        typeof id === "string"
          ? await one(
              db,
              "SELECT * FROM cart_api.products WHERE id=$1 FOR UPDATE",
              [id],
            )
          : null;
      const l = await one(
        db,
        "SELECT * FROM cart_api.cart_lines WHERE user_id=$1 AND product_id=$2",
        [u.id, typeof id === "string" ? id : null],
      );
      const result = p.validateQuantityChange({
        operation: method === "post" ? "add" : "update",
        quantity: q,
        productExists: !!r,
        inCart: !!l,
        available: !!r && p.isProductAvailable(r.status === "เปิดขาย", r.stock),
        currentQtyInCart: l?.quantity ?? 0,
        availableStock: r?.stock ?? 0,
      });
      if (result !== "OK")
        reject(
          result,
          ["PRODUCT_NOT_FOUND", "ITEM_NOT_IN_CART"].includes(result)
            ? 404
            : 400,
        );
      await db.query(
        "INSERT INTO cart_api.cart_lines(user_id,product_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity",
        [u.id, id, method === "post" ? (l?.quantity ?? 0) + q : q],
      );
      return cart(db, u.id);
    },
  );
route("delete", "/cart/items/:id", "Customer", async (db, req, u) => {
  requireStage(await cartRow(db, u.id));
  const r = await db.query(
    "DELETE FROM cart_api.cart_lines WHERE user_id=$1 AND product_id=$2",
    [u.id, req.params.id],
  );
  if (!r.rowCount) reject("ITEM_NOT_IN_CART", 404);
  return cart(db, u.id);
});
route("put", "/cart/coupon", "Customer", async (db, req, u) => {
  requireStage(await cartRow(db, u.id));
  const code = req.body?.code;
  if (typeof code !== "string") reject("VALIDATION_ERROR");
  const c = await one(db, "SELECT * FROM cart_api.coupons WHERE code=$1", [
    code,
  ]);
  if (!c) reject("COUPON_NOT_FOUND", 404);
  if (c.status !== "เปิดใช้") reject("COUPON_INVALID");
  await db.query("UPDATE cart_api.carts SET coupon_code=$2 WHERE user_id=$1", [
    u.id,
    code,
  ]);
  return cart(db, u.id);
});
route("post", "/checkout", "Customer", async (db, req, u) => {
  const c = await cartRow(db, u.id);
  requireStage(c);
  const items = await lines(db, u.id);
  const totalWeightGram = p.calculateTotalWeight(items);
  const { zone, speed } = req.body ?? {};
  const validation = p.validateCheckout({
    zone,
    speed,
    lines: items.map((i) => ({ ...i, availableStock: i.stock })),
    totalWeightGram,
  });
  if (validation.result !== "OK")
    reject(
      validation.result,
      400,
      "productIds" in validation ? { productIds: validation.productIds } : {},
    );
  const subtotal = p.calculateSubtotal(items);
  const co = await one(db, "SELECT * FROM cart_api.coupons WHERE code=$1", [
    c.coupon_code,
  ]);
  const discount = p.calculateDiscount(
    subtotal,
    u.member_tier,
    co
      ? {
          percent: co.percent,
          minSpend: co.min_spend,
          active: co.status === "เปิดใช้",
        }
      : null,
  );
  const notices = discount.couponRemoved
    ? [
        {
          code: "COUPON_NOT_APPLICABLE",
          message: "คูปองไม่สามารถใช้กับคำสั่งซื้อนี้",
        },
      ]
    : [];
  const shippingFee = p.calculateShippingFee(
    p.classifyWeight(totalWeightGram) as "light" | "medium" | "heavy",
    zone,
    speed,
    u.member_tier,
  );
  const snapshot = {
    items: items.map(({ productId, name, price, weightGram, quantity }) => ({
      productId,
      name,
      price,
      weightGram,
      quantity,
    })),
    subtotal,
    discount: discount.discount,
    shippingFee,
    netTotal: p.calculateNetTotal(subtotal, discount.discount, shippingFee),
    zone,
    speed,
    couponCode: discount.couponRemoved ? null : c.coupon_code,
    totalWeightGram,
    discountSource: discount.source,
    notices,
  };
  const id = randomUUID();
  await db.query(
    "INSERT INTO cart_api.orders(id,user_id,snapshot) VALUES($1,$2,$3)",
    [id, u.id, JSON.stringify(snapshot)],
  );
  for (const i of items) {
    await db.query("UPDATE cart_api.products SET stock=stock-$2 WHERE id=$1", [
      i.productId,
      i.quantity,
    ]);
    await db.query(
      "INSERT INTO cart_api.order_lines(order_id,product_id,name,price,weight_gram,quantity) VALUES($1,$2,$3,$4,$5,$6)",
      [id, i.productId, i.name, i.price, i.weightGram, i.quantity],
    );
  }
  await db.query(
    "UPDATE cart_api.carts SET stage='ชำระเงิน',current_order_id=$2,coupon_code=$3,notices=$4 WHERE user_id=$1",
    [u.id, id, snapshot.couponCode, JSON.stringify(notices)],
  );
  return order(
    await one(db, "SELECT * FROM cart_api.orders WHERE id=$1", [id]),
  );
});
route("post", "/checkout/cancel", "Customer", async (db, req, u) => {
  const c = await cartRow(db, u.id);
  requireStage(c, "ชำระเงิน");
  const o = await one(
    db,
    "SELECT * FROM cart_api.orders WHERE id=$1 AND user_id=$2 FOR UPDATE",
    [c.current_order_id, u.id],
  );
  if (!o || o.status !== "รอชำระเงิน") reject("OPERATION_NOT_ALLOWED");
  for (const i of o.snapshot.items)
    await db.query("UPDATE cart_api.products SET stock=stock+$2 WHERE id=$1", [
      i.productId,
      i.quantity,
    ]);
  await db.query("UPDATE cart_api.orders SET status='ยกเลิก' WHERE id=$1", [
    o.id,
  ]);
  await db.query(
    "UPDATE cart_api.carts SET stage='ตะกร้า',current_order_id=NULL WHERE user_id=$1",
    [u.id],
  );
  return {
    order: order({ ...o, status: "ยกเลิก" }),
    cart: await cart(db, u.id),
  };
});
route("post", "/checkout/continue-shopping", "Customer", async (db, req, u) => {
  requireStage(await cartRow(db, u.id), "สำเร็จ");
  await db.query(
    "UPDATE cart_api.carts SET stage='ตะกร้า',current_order_id=NULL,notices='[]' WHERE user_id=$1",
    [u.id],
  );
  return cart(db, u.id);
});
route("get", "/orders", "Customer", async (db, req, u) =>
  (
    await db.query(
      "SELECT * FROM cart_api.orders WHERE user_id=$1 ORDER BY created_at DESC,id DESC",
      [u.id],
    )
  ).rows.map(order),
);
route("get", "/orders/:id", "Customer", async (db, req, u) => {
  const r = await one(
    db,
    "SELECT * FROM cart_api.orders WHERE id=$1 AND user_id=$2",
    [req.params.id, u.id],
  );
  if (!r) reject("ORDER_NOT_FOUND", 404);
  return order(r);
});
route("patch", "/admin/products/:id", "Admin", async (db, req) => {
  const r = await one(
    db,
    "SELECT * FROM cart_api.products WHERE id=$1 FOR UPDATE",
    [req.params.id],
  );
  if (!r) reject("PRODUCT_NOT_FOUND", 404);
  const fields = p.validateProductUpdate(req.body ?? {});
  if (fields.length) reject("VALIDATION_ERROR", 400, { fields });
  return product(
    await one(
      db,
      "UPDATE cart_api.products SET price=COALESCE($2,price),stock=COALESCE($3,stock) WHERE id=$1 RETURNING *",
      [r.id, req.body.price, req.body.stock],
    ),
  );
});
route("patch", "/admin/products/:id/status", "Admin", async (db, req) => {
  const r = await one(
    db,
    "SELECT * FROM cart_api.products WHERE id=$1 FOR UPDATE",
    [req.params.id],
  );
  if (!r) reject("PRODUCT_NOT_FOUND", 404);
  if (!["เปิดขาย", "ปิดขาย"].includes(req.body?.status))
    reject("VALIDATION_ERROR");
  return product(
    await one(
      db,
      "UPDATE cart_api.products SET status=$2 WHERE id=$1 RETURNING *",
      [r.id, req.body.status],
    ),
  );
});
route("get", "/admin/coupons", "Admin", async (db) =>
  (await db.query("SELECT * FROM cart_api.coupons ORDER BY code")).rows.map(
    coupon,
  ),
);
route("patch", "/admin/coupons/:code/status", "Admin", async (db, req) => {
  const r = await one(
    db,
    "SELECT * FROM cart_api.coupons WHERE code=$1 FOR UPDATE",
    [req.params.code],
  );
  if (!r) reject("COUPON_NOT_FOUND", 404);
  if (!["เปิดใช้", "ปิดใช้"].includes(req.body?.status))
    reject("VALIDATION_ERROR");
  return coupon(
    await one(
      db,
      "UPDATE cart_api.coupons SET status=$2 WHERE code=$1 RETURNING *",
      [r.code, req.body.status],
    ),
  );
});
for (const action of ["success", "fail"])
  route("post", `/payments/:id/${action}`, null, async (db, req) => {
    const o = await one(
      db,
      "SELECT * FROM cart_api.orders WHERE id=$1 FOR UPDATE",
      [req.params.id],
    );
    if (!o) reject("ORDER_NOT_FOUND", 404);
    const c = await cartRow(db, o.user_id);

    if (
      o.status !== "รอชำระเงิน" ||
      c.stage !== "ชำระเงิน" ||
      c.current_order_id !== o.id
    )
      reject("OPERATION_NOT_ALLOWED");
    if (action === "fail")
      return { orderId: o.id, message: "การชำระเงินล้มเหลว กรุณาลองใหม่" };
    await db.query(
      "UPDATE cart_api.orders SET status='ชำระเงินแล้ว' WHERE id=$1",
      [o.id],
    );
    await db.query("DELETE FROM cart_api.cart_lines WHERE user_id=$1", [
      o.user_id,
    ]);
    await db.query(
      "UPDATE cart_api.carts SET stage='สำเร็จ',coupon_code=NULL WHERE user_id=$1",
      [o.user_id],
    );
    return { orderId: o.id, status: "ชำระเงินแล้ว" };
  });
if (
  process.env.NODE_ENV === "test" &&
  process.env.ENABLE_TEST_ROUTES === "true"
)
  route("post", "/test/reset", null, async (db) => {
    await reset(db);
    return { reset: true };
  });
app.use((req, res) =>
  res.status(404).json({ code: "NOT_FOUND", message: "ไม่พบรายการ" }),
);
const messages: Record<string, string> = {
  VALIDATION_ERROR: "ข้อมูลไม่ถูกต้อง",
  QTY_OUT_OF_RANGE: "จำนวนต้องอยู่ระหว่าง 1 ถึง 10",
  PRODUCT_NOT_FOUND: "ไม่พบสินค้า",
  ITEM_NOT_IN_CART: "ไม่พบสินค้าในตะกร้า",
  PRODUCT_UNAVAILABLE: "สินค้าไม่พร้อมขาย",
  INSUFFICIENT_STOCK: "สินค้าในสต็อกไม่เพียงพอ",
  CART_EMPTY: "ตะกร้าว่าง",
  ITEMS_UNAVAILABLE: "สินค้าบางรายการไม่พร้อมขายหรือสต็อกไม่เพียงพอ",
  WEIGHT_LIMIT_EXCEEDED: "น้ำหนักเกิน 20000 กรัม",
  COUPON_INVALID: "คูปองไม่ถูกต้องหรือปิดใช้",
  OPERATION_NOT_ALLOWED: "สถานะไม่อนุญาตให้ดำเนินการ",
  ORDER_NOT_FOUND: "ไม่พบคำสั่งซื้อ",
  COUPON_NOT_FOUND: "ไม่พบคูปอง",
  AUTH_REQUIRED: "กรุณาเข้าสู่ระบบ",
  AUTH_FORBIDDEN: "ไม่มีสิทธิ์ดำเนินการ",
  AUTH_INVALID_CREDENTIALS: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
};
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err instanceof DomainError)
      res.status(err.status).json({
        code: err.code,
        message: messages[err.code] ?? err.code,
        ...err.details,
      });
    else if (
      err.type === "entity.parse.failed" ||
      err.type === "entity.too.large"
    )
      res
        .status(400)
        .json({ code: "VALIDATION_ERROR", message: messages.VALIDATION_ERROR });
    else {
      console.error("Request failed", err.code ?? err.name);
      res
        .status(500)
        .json({ code: "INTERNAL_ERROR", message: "เกิดข้อผิดพลาดภายในระบบ" });
    }
  },
);
