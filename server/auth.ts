import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";

export const SESSION_COOKIE = "webdev_app_session";
const STATE_COOKIE = "mymarket_oauth_state";
export type AuthConfig = {
  projectId: string;
  secret: string;
  portalUrl: string;
  apiUrl: string;
};
export type Identity = { openId: string; name: string; email?: string };
export type Session = Identity & { token: string; csrfToken: string };
export function authConfig(): AuthConfig {
  const c = {
    projectId: process.env.MANUS_PROJECT_ID || "",
    secret: process.env.MANUS_JWT_SECRET || "",
    portalUrl: process.env.MANUS_OAUTH_PORTAL_URL || "",
    apiUrl: process.env.MANUS_OAUTH_API_URL || "",
  };
  if (Object.values(c).some((v) => !v))
    throw new Error("La configuration de connexion Manus est indisponible.");
  return c;
}
const key = (c: AuthConfig) => new TextEncoder().encode(c.secret);
export function csrfForToken(token: string, c: AuthConfig) {
  return createHmac("sha256", c.secret)
    .update("mymarket-csrf:" + token)
    .digest("hex");
}
export async function readSession(
  req: Request,
  c: AuthConfig,
): Promise<Session | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string") return null;
  try {
    const { payload } = await jwtVerify(token, key(c), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.exp !== "number" ||
      payload.appId !== c.projectId ||
      typeof payload.openId !== "string" ||
      !payload.openId ||
      payload.openId.length > 255
    )
      return null;
    return {
      openId: payload.openId,
      name: typeof payload.name === "string" ? payload.name : "Compte Manus",
      email: typeof payload.email === "string" ? payload.email : undefined,
      token,
      csrfToken: csrfForToken(token, c),
    };
  } catch {
    return null;
  }
}
export function checkCsrf(req: Request, session: Session) {
  const provided = req.get("X-Mymarket-CSRF") || "";
  return (
    provided.length === session.csrfToken.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(session.csrfToken))
  );
}
export async function signSession(identity: Identity, c: AuthConfig) {
  return new SignJWT({
    openId: identity.openId,
    name: identity.name,
    email: identity.email,
    appId: c.projectId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key(c));
}
function cookieOptions(secure = true) {
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    path: "/",
  };
}
export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export async function startOAuth(
  req: Request,
  res: Response,
  c: AuthConfig,
  redirect = false,
) {
  const supplied = redirect ? req.query.origin : req.body?.origin;
  let origin: string;
  try {
    const url = new URL(supplied);
    origin = url.origin;
    if (
      supplied !== origin ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        ))
    )
      throw new Error();
    // Le navigateur fournit son origine publique; on ne la déduit jamais de req.host.
    const requestOrigin =
      req.get("origin") ||
      (req.get("referer") ? new URL(req.get("referer")!).origin : "");
    const fetchSite = req.get("sec-fetch-site");
    if (
      (requestOrigin && requestOrigin !== origin) ||
      (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite))
    )
      throw new Error();
  } catch {
    res.status(400).json({
      error:
        "Adresse de connexion invalide. Ouvrez le site dans un onglet direct.",
    });
    return;
  }
  const nonce = randomBytes(32).toString("base64url");
  const redirectUri = `${origin}/api/auth/callback`;
  const stateCookie = await new SignJWT({
    nonce,
    redirectUri,
    appId: c.projectId,
    purpose: "oauth-state",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key(c));
  res.cookie(STATE_COOKIE, stateCookie, {
    ...cookieOptions(origin.startsWith("https:")),
    maxAge: 10 * 60 * 1000,
  });
  const url = new URL("/app-auth", c.portalUrl);
  url.searchParams.set("appId", c.projectId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set(
    "state",
    Buffer.from(JSON.stringify({ redirectUri, nonce })).toString("base64"),
  );
  url.searchParams.set("responseType", "code");
  if (redirect) res.redirect(url.toString());
  else res.json({ url: url.toString() });
}
export async function finishOAuth(
  req: Request,
  res: Response,
  c: AuthConfig,
  fetcher: typeof fetch = fetch,
) {
  try {
    const code = req.query.code,
      encoded = req.query.state,
      saved = req.cookies?.[STATE_COOKIE];
    if (
      typeof code !== "string" ||
      typeof encoded !== "string" ||
      typeof saved !== "string"
    )
      throw new Error();
    const { payload } = await jwtVerify(saved, key(c), {
      algorithms: ["HS256"],
    });
    const state = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    if (
      payload.appId !== c.projectId ||
      payload.purpose !== "oauth-state" ||
      state.nonce !== payload.nonce ||
      state.redirectUri !== payload.redirectUri ||
      typeof state.redirectUri !== "string"
    )
      throw new Error();
    // La valeur est signée, liée à ce navigateur et consommée dès le callback.
    const secure = state.redirectUri.startsWith("https:");
    res.clearCookie(STATE_COOKIE, cookieOptions(secure));
    async function rpc(method: string, body: object) {
      const response = await fetcher(
        `${c.apiUrl.replace(/\/$/, "")}/webdev.v1.WebDevAuthPublicService/${method}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "connect-protocol-version": "1",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.error) throw new Error();
      return result;
    }
    const exchanged = await rpc("ExchangeToken", {
      clientId: c.projectId,
      grantType: "authorization_code",
      code,
      redirectUri: state.redirectUri,
    });
    if (typeof exchanged.accessToken !== "string") throw new Error();
    const user = await rpc("GetUserInfo", {
      accessToken: exchanged.accessToken,
    });
    if (
      typeof user.openId !== "string" ||
      !user.openId ||
      user.openId.length > 255
    )
      throw new Error();
    const token = await signSession(
      {
        openId: user.openId,
        name: typeof user.name === "string" ? user.name : "Compte Manus",
        email: typeof user.email === "string" ? user.email : undefined,
      },
      c,
    );
    res.cookie(SESSION_COOKIE, token, {
      ...cookieOptions(secure),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.redirect(`${new URL(state.redirectUri).origin}/`);
  } catch {
    res.clearCookie(STATE_COOKIE, cookieOptions());
    res
      .status(400)
      .type("text")
      .send(
        "Connexion Manus non validée. Retournez au site et relancez la connexion depuis un onglet direct. Aucun fichier privé n’a été ouvert.",
      );
  }
}
