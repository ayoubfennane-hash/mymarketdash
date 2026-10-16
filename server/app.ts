import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import { createHash } from "node:crypto";
import { parseWorkbook } from "../src/data";
import { MAX_WORKBOOK_BYTES } from "../src/xlsxLimits";
import {
  readSession,
  checkCsrf,
  startOAuth,
  finishOAuth,
  clearSession,
  type AuthConfig,
  type Session,
} from "./auth";
import { WorkbookConflict, type WorkbookRepository } from "./repository";

export function createApp(
  repository: WorkbookRepository,
  config: AuthConfig,
  fetcher: typeof fetch = fetch,
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  const asyncRoute =
    (handler: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => {
      void handler(req, res).catch(next);
    };
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get(
    "/api/auth/me",
    asyncRoute(async (req, res) => {
      const session = await readSession(req, config);
      if (!session) {
        res.json({ user: null });
        return;
      }
      res.json({
        user: { name: session.name, email: session.email },
        csrfToken: session.csrfToken,
      });
    }),
  );
  app.post(
    "/api/auth/start",
    express.json({ limit: "4kb" }),
    asyncRoute(async (req, res) => startOAuth(req, res, config)),
  );
  app.get(
    "/api/auth/login",
    asyncRoute(async (req, res) => startOAuth(req, res, config, true)),
  );
  app.get(
    "/api/auth/callback",
    asyncRoute(async (req, res) => finishOAuth(req, res, config, fetcher)),
  );
  async function sessionOr401(
    req: Request,
    res: Response,
    write = false,
  ): Promise<Session | null> {
    const session = await readSession(req, config);
    if (!session) {
      res.status(401).json({
        error:
          "Connectez-vous à votre compte Manus pour accéder à votre classeur privé.",
      });
      return null;
    }
    if (write && !checkCsrf(req, session)) {
      res.status(403).json({
        error: "Votre session doit être actualisée avant l’enregistrement.",
      });
      return null;
    }
    return session;
  }
  app.post(
    "/api/auth/logout",
    asyncRoute(async (req, res) => {
      const s = await sessionOr401(req, res, true);
      if (!s) return;
      clearSession(res);
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/workbook/meta",
    asyncRoute(async (req, res) => {
      const s = await sessionOr401(req, res);
      if (!s) return;
      res.json({ workbook: await repository.meta(s.openId) });
    }),
  );
  app.get(
    "/api/workbook",
    asyncRoute(async (req, res) => {
      const s = await sessionOr401(req, res);
      if (!s) return;
      const record = await repository.get(s.openId);
      if (!record) {
        res.status(404).json({
          error: "Votre compte ne contient pas encore de classeur enregistré.",
        });
        return;
      }
      res.set(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.set(
        "Content-Disposition",
        `attachment; filename="MYMARKET-import.xlsx"; filename*=UTF-8''${encodeURIComponent(record.name)}`,
      );
      res.set("X-Workbook-Name", encodeURIComponent(record.name));
      res.set("X-Workbook-Saved-At", record.savedAt);
      res.set("X-Workbook-Sha256", record.sha256);
      res.send(record.buffer);
    }),
  );
  // Authentifier avant même de recevoir et parser les octets privés.
  app.post(
    "/api/workbook",
    asyncRoute(async (req, res) => {
      const s = await sessionOr401(req, res, true);
      if (!s) return;
      const expected = req.get("X-Workbook-Revision");
      if (!expected || !/^(none|[a-f0-9]{64})$/.test(expected)) {
        res.status(400).json({
          error:
            "Chargez d’abord l’état du classeur cloud avant l’enregistrement.",
        });
        return;
      }
      let name: string;
      try {
        name = decodeURIComponent(req.get("X-Workbook-Name") || "").replace(
          /[\\/]/g,
          "_",
        );
      } catch {
        res.status(400).json({ error: "Nom de fichier invalide." });
        return;
      }
      if (
        !name ||
        name.length > 200 ||
        /[\x00-\x1f]/.test(name) ||
        !/\.xlsx?$/i.test(name)
      ) {
        res.status(400).json({
          error:
            "Sélectionnez un classeur Excel .xlsx ou .xls avec un nom valide.",
        });
        return;
      }
      await new Promise<void>((resolve, reject) => {
        express.raw({ type: () => true, limit: MAX_WORKBOOK_BYTES })(
          req,
          res,
          (e) => (e ? reject(e) : resolve()),
        );
      });
      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || !buffer.length) {
        res.status(400).json({ error: "Le fichier Excel est vide." });
        return;
      }
      try {
        parseWorkbook(Uint8Array.from(buffer).buffer, name);
      } catch (e) {
        res.status(400).json({
          error: e instanceof Error ? e.message : "Classeur non compatible.",
        });
        return;
      }
      const record = {
        name,
        size: buffer.length,
        buffer,
        savedAt: new Date().toISOString(),
        sha256: createHash("sha256").update(buffer).digest("hex"),
      };
      const workbook = await repository.save(s.openId, record, expected);
      res.status(201).json({ workbook });
    }),
  );
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof WorkbookConflict) {
        res.status(409).json({ error: error.message });
        return;
      }
      if (
        error &&
        typeof error === "object" &&
        "type" in error &&
        error.type === "entity.too.large"
      ) {
        res.status(413).json({
          error:
            "Le fichier dépasse 10 Mo. Le précédent import cloud est conservé.",
        });
        return;
      }
      // Ne jamais renvoyer le DSN, le token OAuth ou la pile d’erreur au navigateur.
      res.status(503).json({
        error:
          "L’espace cloud est temporairement indisponible. Votre précédent import est conservé. Réessayez.",
      });
    },
  );
  return app;
}
