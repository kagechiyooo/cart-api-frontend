import "dotenv/config";
import pg from "pg";
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (
  process.env.DATABASE_SSL === "false" &&
  process.env.NODE_ENV === "production"
)
  throw new Error("TLS is required in production");
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : {
          rejectUnauthorized: true,
          ...(process.env.DATABASE_CA_FILE
            ? { ca: readFileSync(process.env.DATABASE_CA_FILE, "utf8") }
            : {}),
        },
});
let queue: Promise<unknown> = Promise.resolve();
export function transaction<T>(
  fn: (db: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const run = queue.then(async () => {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await db.query("SELECT pg_advisory_xact_lock(73400218)");
      const result = await fn(db);
      await db.query("COMMIT");
      return result;
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    } finally {
      db.release();
    }
  });
  queue = run.catch(() => {});
  return run;
}
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, hash: string): boolean {
  const [algorithm, salt, key] = hash.split(":");
  if (algorithm !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const originalProducts = [
  ["p-1", "Wireless Headphones", "Over-ear noise cancelling headphones with 30-hour battery life.", "Electronics", 12999, 300, 15, "/products/headphones.png"],
  ["p-2", "Mechanical Keyboard", "Compact 75% layout with hot-swappable tactile switches.", "Electronics", 8950, 900, 8, "/products/keyboard.png"],
  ["p-3", "Ceramic Coffee Mug", "Hand-glazed 350ml stoneware mug. Dishwasher safe.", "Home", 1499, 400, 40, "/products/mug.png"],
  ["p-4", "Canvas Backpack", "Water-resistant waxed canvas with a padded laptop sleeve.", "Accessories", 5900, 700, 12, "/products/backpack.png"],
  ["p-5", "Minimal Desk Lamp", "Adjustable LED desk lamp with three color temperatures.", "Home", 3995, 1200, 0, "/products/lamp.png"],
  ["p-6", "Running Sneakers", "Lightweight breathable mesh with responsive foam cushioning.", "Apparel", 7499, 800, 20, "/products/sneakers.png"],
  ["p-7", "Insulated Water Bottle", "Keeps drinks cold for 24 hours or hot for 12. 750ml.", "Accessories", 2400, 450, 30, "/products/bottle.png"],
  ["p-8", "Cotton Hoodie", "Heavyweight brushed-fleece hoodie in heather gray.", "Apparel", 4999, 600, 3, "/products/hoodie.png"],
] as const;

export async function seed(db: pg.PoolClient) {
  for (const [username, password, role, tier] of [
    ["cus_normal", "password123", "Customer", "normal"],
    ["cus_prime", "password123", "Customer", "prime"],
    ["admin01", "admin123", "Admin", "normal"],
  ]) {
    await db.query(
      "INSERT INTO cart_api.users(id,username,password_hash,role,member_tier) VALUES($1,$1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [username, hashPassword(password), role, tier],
    );
    await db.query(
      "INSERT INTO cart_api.carts(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [username],
    );
  }
  for (const product of originalProducts)
    await db.query(
      "INSERT INTO cart_api.products(id,name,description,category,price,weight_gram,stock,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET image_url=EXCLUDED.image_url",
      [...product],
    );
  // Lock legacy rows before checking references so concurrent FK inserts cannot race deletion.
  await db.query("SELECT id FROM cart_api.products WHERE id IN ('P1','P2','P3') FOR UPDATE");
  await db.query(`DELETE FROM cart_api.products p WHERE p.id IN ('P1','P2','P3')
    AND NOT EXISTS (SELECT 1 FROM cart_api.cart_lines c WHERE c.product_id=p.id)
    AND NOT EXISTS (SELECT 1 FROM cart_api.order_lines o WHERE o.product_id=p.id)`);
  await db.query("UPDATE cart_api.products SET image_url='' WHERE id IN ('P1','P2','P3') AND image_url ~* '\\.svg([?#].*)?$'");
  const legacy = await db.query(`SELECT p.id,p.name,
    (SELECT count(*)::int FROM cart_api.cart_lines c WHERE c.product_id=p.id) AS cart_lines,
    (SELECT count(*)::int FROM cart_api.order_lines o WHERE o.product_id=p.id) AS order_lines
    FROM cart_api.products p WHERE p.id IN ('P1','P2','P3') ORDER BY p.id`);
  if (legacy.rows.length)
    console.warn("Legacy products retained: user decision required; no cart/order substitutions or retirement applied.", legacy.rows);
  await db.query(
    "INSERT INTO cart_api.coupons(code,percent,min_spend) VALUES('SAVE10',10,1000) ON CONFLICT DO NOTHING",
  );
}
export async function reset(db: pg.PoolClient) {
  await db.query(
    "TRUNCATE cart_api.sessions,cart_api.order_lines,cart_api.orders,cart_api.cart_lines,cart_api.carts,cart_api.coupons,cart_api.products,cart_api.users CASCADE",
  );
  await seed(db);
}
