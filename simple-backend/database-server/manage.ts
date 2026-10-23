import { readFile } from "node:fs/promises";
import { pool, transaction, seed } from "./store.js";
try {
  const command = process.argv[2];
  if (command === "migrate")
    await transaction(async (db) => {
      await db.query(
        await readFile(
          new URL("../migrations/001_initial.sql", import.meta.url),
          "utf8",
        ).catch(() =>
          readFile(
            new URL("./migrations/001_initial.sql", import.meta.url),
            "utf8",
          ),
        ),
      );
    });
  else if (command === "seed") await transaction(seed);
  else throw new Error("Usage: migrate | seed");
} finally {
  await pool.end();
}
