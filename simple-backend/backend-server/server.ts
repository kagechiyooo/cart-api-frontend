import { app } from "./app.js";
import { pool } from "../database-server/store.js";
const server = app.listen(Number(process.env.PORT ?? 3001), () =>
  console.log("Cart API listening"),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      void pool.end();
    }),
  );
