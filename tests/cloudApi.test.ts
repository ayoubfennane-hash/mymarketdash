import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { createApp } from "../server/app";
import {
  csrfForToken,
  signSession,
  SESSION_COOKIE,
  type AuthConfig,
} from "../server/auth";
import {
  WorkbookConflict,
  type WorkbookRepository,
  type WorkbookRecord,
} from "../server/repository";
const config: AuthConfig = {
  projectId: "test-project",
  secret: "isolated-test-session-key",
  portalUrl: "https://login.example.test",
  apiUrl: "https://api.example.test",
};
const bytes = readFileSync("public/MYMARKET_Tableau_de_bord.xlsx");
const sha = createHash("sha256").update(bytes).digest("hex");
let files: Map<string, WorkbookRecord>, repo: WorkbookRepository;
beforeEach(() => {
  files = new Map();
  repo = {
    async get(owner) {
      return files.get(owner) || null;
    },
    async meta(owner) {
      const f = files.get(owner);
      if (!f) return null;
      const { buffer: _, ...m } = f;
      return m;
    },
    async save(owner, f, previous) {
      if ((files.get(owner)?.sha256 || "none") !== previous)
        throw new WorkbookConflict("Un autre appareil a changé votre fichier.");
      files.set(owner, f);
      const { buffer: _, ...m } = f;
      return m;
    },
  };
});
async function client(owner = "alice") {
  const token = await signSession({ openId: owner, name: owner }, config);
  return {
    cookie: `${SESSION_COOKIE}=${token}`,
    csrf: csrfForToken(token, config),
  };
}
function record(name: string): WorkbookRecord {
  return {
    name,
    size: bytes.length,
    sha256: sha,
    savedAt: "2026-10-16T10:00:00.000Z",
    buffer: bytes,
  };
}
describe("Imports cloud privés", () => {
  it("n’ouvre aucune donnée sans authentification et refuse les écritures sans CSRF", async () => {
    const app = createApp(repo, config);
    expect((await request(app).get("/api/workbook")).status).toBe(401);
    expect((await request(app).post("/api/workbook").send(bytes)).status).toBe(
      401,
    );
    const a = await client();
    expect(
      (
        await request(app)
          .post("/api/workbook")
          .set("Cookie", a.cookie)
          .send(bytes)
      ).status,
    ).toBe(403);
    expect(files.size).toBe(0);
  });
  it("isole les lectures et les métadonnées de deux comptes, même avec un propriétaire dans l’URL", async () => {
    files.set("alice", record("Alice.xlsx"));
    files.set("bob", record("Bob.xlsx"));
    const app = createApp(repo, config),
      a = await client(),
      b = await client("bob");
    const ra = await request(app)
      .get("/api/workbook?owner=bob")
      .set("Cookie", a.cookie);
    expect(ra.status).toBe(200);
    expect(ra.headers["x-workbook-name"]).toBe("Alice.xlsx");
    expect(ra.headers["cache-control"]).toContain("private, no-store");
    const rb = await request(app)
      .get("/api/workbook/meta")
      .set("Cookie", b.cookie);
    expect(rb.body.workbook.name).toBe("Bob.xlsx");
    const c = await client("charlie");
    expect(
      (await request(app).get("/api/workbook").set("Cookie", c.cookie)).status,
    ).toBe(404);
  });
  it("enregistre un Excel valide et le retrouve avec une autre session du même compte", async () => {
    const app = createApp(repo, config),
      a = await client();
    const saved = await request(app)
      .post("/api/workbook")
      .set("Cookie", a.cookie)
      .set("X-Mymarket-CSRF", a.csrf)
      .set("X-Workbook-Name", "Mon-Excel.xlsx")
      .set("X-Workbook-Revision", "none")
      .set("Content-Type", "application/octet-stream")
      .send(bytes);
    expect(saved.status).toBe(201);
    expect(saved.body.workbook.sha256).toBe(sha);
    const second = await client();
    const restored = await request(app)
      .get("/api/workbook")
      .set("Cookie", second.cookie)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(restored.status).toBe(200);
    expect(restored.headers["x-workbook-name"]).toBe("Mon-Excel.xlsx");
    expect(restored.body.length).toBe(bytes.length);
    expect(files.has("bob")).toBe(false);
  });
  it("un classeur invalide ou trop gros ne remplace pas l’import du compte", async () => {
    files.set("alice", record("Conservé.xlsx"));
    const app = createApp(repo, config),
      a = await client();
    const send = (b: Buffer) =>
      request(app)
        .post("/api/workbook")
        .set("Cookie", a.cookie)
        .set("X-Mymarket-CSRF", a.csrf)
        .set("X-Workbook-Name", "Nouveau.xlsx")
        .set("X-Workbook-Revision", sha)
        .set("Content-Type", "application/octet-stream")
        .send(b);
    expect((await send(Buffer.from("pas un fichier Excel"))).status).toBe(400);
    expect((await send(Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(413);
    expect(files.get("alice")?.name).toBe("Conservé.xlsx");
  });
  it("refuse une écriture basée sur une ancienne version et protège le fichier plus récent", async () => {
    files.set("alice", record("Dernier-appareil.xlsx"));
    const app = createApp(repo, config),
      a = await client();
    const r = await request(app)
      .post("/api/workbook")
      .set("Cookie", a.cookie)
      .set("X-Mymarket-CSRF", a.csrf)
      .set("X-Workbook-Name", "Ancien-appareil.xlsx")
      .set("X-Workbook-Revision", "none")
      .set("Content-Type", "application/octet-stream")
      .send(bytes);
    expect(r.status).toBe(409);
    expect(files.get("alice")?.name).toBe("Dernier-appareil.xlsx");
  });
  it("refuse une session expirée, un autre projet et une signature incorrecte", async () => {
    const app = createApp(repo, config);
    const sign = async (
      appId: string,
      expiry: string,
      secret = config.secret,
    ) =>
      new SignJWT({ openId: "alice", appId })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime(expiry)
        .sign(new TextEncoder().encode(secret));
    for (const token of [
      await sign("other-project", "1h"),
      await sign(config.projectId, "-1h"),
      await sign(config.projectId, "1h", "not-the-project-key"),
    ]) {
      expect(
        (
          await request(app)
            .get("/api/workbook")
            .set("Cookie", `${SESSION_COOKIE}=${token}`)
        ).status,
      ).toBe(401);
    }
  });
  it("la déconnexion ne supprime aucune sauvegarde et expire le cookie exact", async () => {
    files.set("alice", record("Personnel.xlsx"));
    const a = await client();
    const r = await request(createApp(repo, config))
      .post("/api/auth/logout")
      .set("Cookie", a.cookie)
      .set("X-Mymarket-CSRF", a.csrf);
    expect(r.status).toBe(200);
    expect(r.headers["set-cookie"][0]).toContain("webdev_app_session=;");
    expect(files.get("alice")?.name).toBe("Personnel.xlsx");
  });
});
describe("Connexion OAuth réelle et état lié au navigateur", () => {
  it("utilise l’origine frontend explicite et vérifie l’état avant l’échange server-side", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: "test-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ openId: "alice", name: "Alice" }),
      });
    const app = createApp(repo, config, fetcher);
    const start = await request(app)
      .post("/api/auth/start")
      .set("Origin", "https://mymarket.example.test")
      .set("Host", "127.0.0.1:3000")
      .send({ origin: "https://mymarket.example.test" });
    expect(start.status).toBe(200);
    const url = new URL(start.body.url);
    expect(url.searchParams.get("redirectUri")).toBe(
      "https://mymarket.example.test/api/auth/callback",
    );
    expect(start.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(start.headers["set-cookie"][0]).toContain("Secure");
    expect(start.headers["set-cookie"][0]).toContain("SameSite=None");
    const callback = await request(app)
      .get("/api/auth/callback")
      .query({ code: "one-time-code", state: url.searchParams.get("state") })
      .set("Cookie", start.headers["set-cookie"][0].split(";")[0]);
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe("https://mymarket.example.test/");
    expect(fetcher).toHaveBeenCalledTimes(2);
    const sessionCookie = (
      callback.headers["set-cookie"] as unknown as string[]
    ).find((c) => c.startsWith(SESSION_COOKIE + "="))!;
    const who = await request(app)
      .get("/api/auth/me")
      .set("Cookie", sessionCookie.split(";")[0]);
    expect(who.body.user.name).toBe("Alice");
    expect(who.body.csrfToken).toHaveLength(64);
  });
  it("ouvre OAuth en navigation principale même si le proxy retire Referer", async () => {
    const app = createApp(repo, config);
    const result = await request(app)
      .get("/api/auth/login")
      .query({ origin: "https://mymarket.example.test" })
      .set("Sec-Fetch-Site", "same-origin");
    expect(result.status).toBe(302);
    expect(
      new URL(result.headers.location).searchParams.get("redirectUri"),
    ).toBe("https://mymarket.example.test/api/auth/callback");
    expect(result.headers["set-cookie"][0]).toContain("SameSite=None");
    const cross = await request(app)
      .get("/api/auth/login")
      .query({ origin: "https://other.example.test" })
      .set("Sec-Fetch-Site", "cross-site");
    expect(cross.status).toBe(400);
  });
  it("n’échange pas de code pour un nonce différent ou une origine non concordante", async () => {
    const fetcher = vi.fn();
    const app = createApp(repo, config, fetcher);
    expect(
      (
        await request(app)
          .post("/api/auth/start")
          .set("Origin", "https://other.example.test")
          .send({ origin: "https://mymarket.example.test" })
      ).status,
    ).toBe(400);
    const started = await request(app)
      .post("/api/auth/start")
      .set("Origin", "https://mymarket.example.test")
      .send({ origin: "https://mymarket.example.test" });
    const state = Buffer.from(
      JSON.stringify({
        nonce: "wrong",
        redirectUri: "https://mymarket.example.test/api/auth/callback",
      }),
    ).toString("base64");
    const denied = await request(app)
      .get("/api/auth/callback")
      .query({ code: "code", state })
      .set("Cookie", started.headers["set-cookie"][0].split(";")[0]);
    expect(denied.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    expect(files.size).toBe(0);
  });
});
