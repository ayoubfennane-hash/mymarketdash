import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import { createApp } from "./app";
import { authConfig } from "./auth";
import { databasePool, migrate, mysqlRepository } from "./repository";
const pool = databasePool();
await migrate(pool);
const app = createApp(mysqlRepository(pool), authConfig());
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.NODE_ENV !== "production") {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(
    express.static(path.join(root, "dist"), { index: false, maxAge: "1h" }),
  );
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ error: "API introuvable." });
      return;
    }
    if (path.extname(req.path)) {
      res.status(404).end();
      return;
    }
    res
      .set("Cache-Control", "no-store")
      .sendFile(path.join(root, "dist/index.html"));
  });
}
const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () =>
  console.log(`MYMARKET server ready on ${port}`),
);
