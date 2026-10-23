import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import type pg from "pg";

// Importing the store creates a lazy pool; these tests never connect to a database.
process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost/unused";
const { seed, originalProducts, pool } = await import("./store.js");

test("standalone PNG catalog matches frontend whole-baht values and assets", () => {
  const source = readFileSync(new URL("../../lib/api/mock/seed.ts", import.meta.url), "utf8");
  const blocks = [...source.matchAll(/\{\s*id: '(p-\d+)',([\s\S]*?)active: true,\s*\}/g)];
  assert.equal(blocks.length, 8);
  const expected = blocks.map(([ , id, body]) => {
    const text = (key: string) => body.match(new RegExp(`${key}: '([^']*)'`))![1];
    const number = (key: string) => Number(body.match(new RegExp(`${key}: (\\d+)`))![1]);
    return [id, text("name"), text("description"), text("category"), number("priceCents"), number("weightGram"), number("stock"), text("imageUrl")];
  });
  assert.deepEqual(originalProducts, expected);
  for (const product of originalProducts) {
    assert.match(product[7], /[.]png$/);
    assert.ok(existsSync(new URL(`../../public${product[7]}`, import.meta.url)));
  }
});

test("seed preserves commerce data and guards legacy deletion by both references", async () => {
  const queries: { sql: string; values?: unknown[] }[] = [];
  const db = { query: async (sql: string, values?: unknown[]) => {
    queries.push({ sql, values });
    return { rows: [] };
  } } as unknown as pg.PoolClient;
  await seed(db);
  const inserts = queries.filter(q => q.sql.startsWith("INSERT INTO cart_api.products"));
  assert.equal(inserts.length, 8);
  for (const q of inserts) {
    assert.equal(q.sql.split("DO UPDATE SET ")[1], "image_url=EXCLUDED.image_url");
  }
  const deletion = queries.find(q => q.sql.startsWith("DELETE"))!.sql;
  assert.match(deletion, /NOT EXISTS .*cart_api.cart_lines/);
  assert.match(deletion, /NOT EXISTS .*cart_api.order_lines/);
  assert.ok(queries.findIndex(q => q.sql.endsWith("FOR UPDATE")) < queries.findIndex(q => q.sql === deletion));
  assert.ok(queries.every(q => !/TRUNCATE|UPDATE cart_api\.(cart_lines|orders|order_lines)|DELETE FROM cart_api\.(cart_lines|orders|order_lines)/.test(q.sql)));
  await pool.end();
});
