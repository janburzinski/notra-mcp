import "zod/compile";
import "dotenv/config";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport, toNodeHandler, toWebRequest } from "@modelcontextprotocol/node";
import { createMcpHandler, isInitializeRequest, isLegacyRequest, type AuthInfo } from "@modelcontextprotocol/server";
import type { NextFunction, Request, Response } from "express";
import {
  DEFAULT_MAX_SESSIONS,
  MCP_JSON_BODY_LIMIT_BYTES,
  SESSION_SWEEP_INTERVAL_MS,
  SESSION_TTL_MS,
} from "./constants/http.js";
import { OAUTH_AUTHORIZATION_SERVER_METADATA_PATH, OAUTH_PROTECTED_RESOURCE_METADATA_PATH } from "./constants/oauth.js";
import { createServer } from "./server.js";
import type { AuthContext } from "./types/auth.js";
import type { BodyParserError, Session } from "./types/http.js";
import type { Toolset } from "./types/toolset.js";
import { authenticateBearerToken, parseBearerToken } from "./utils/auth.js";
import { getMcpResourceUrl, getOAuthConfig, getProtectedResourceMetadata } from "./utils/oauth-config.js";
import { parseToolsets } from "./utils/toolsets.js";

const app = createMcpExpressApp({ host: "0.0.0.0", jsonLimit: String(MCP_JSON_BODY_LIMIT_BYTES) });

const SESSION_TOKEN_DIGEST_KEY = randomBytes(32);
const configuredMaxSessions = Number.parseInt(process.env.NOTRA_MCP_MAX_SESSIONS ?? "", 10);
const MAX_SESSIONS = configuredMaxSessions > 0 ? configuredMaxSessions : DEFAULT_MAX_SESSIONS;
const oauthConfig = getOAuthConfig();

const modernHandler = createMcpHandler(
  ({ authInfo }) => {
    if (!authInfo) {
      throw new Error("Authenticated MCP request is missing auth context");
    }
    return createServer(fromMcpAuthInfo(authInfo), { toolsets: authInfo.extra?.toolsets as ReadonlySet<Toolset> });
  },
  {
    legacy: "reject",
    onerror: (error) => {
      console.error("MCP HTTP handler error:", error);
    },
  },
);

const sessions = new Map<string, Session>();

function digestToken(token: string): Buffer {
  return createHmac("sha256", SESSION_TOKEN_DIGEST_KEY).update(token).digest();
}

async function getAuthenticatedSession(req: Request) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const token = parseBearerToken(req.headers["authorization"]);

  if (!sessionId) {
    return undefined;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return undefined;
  }

  if (Date.now() - session.lastSeen > SESSION_TTL_MS) {
    closeSession(sessionId, session);
    return undefined;
  }

  if (!token && session.auth.kind !== "oauth") {
    return undefined;
  }

  if (token && session.auth.kind === "oauth") {
    try {
      const nextAuth = await authenticateBearerToken(token, oauthConfig);
      if (
        nextAuth.kind !== "oauth" ||
        nextAuth.userId !== session.auth.userId ||
        nextAuth.organizationId !== session.auth.organizationId
      ) {
        sessions.delete(sessionId);
        return undefined;
      }
      // The session's client shares this object and must see refreshed credentials.
      Object.assign(session.auth, nextAuth);
      session.tokenDigest = digestToken(token);
    } catch {
      sessions.delete(sessionId);
      return undefined;
    }
  } else if (token && !timingSafeEqual(digestToken(token), session.tokenDigest)) {
    return undefined;
  }

  session.lastSeen = Date.now();
  // Map order doubles as LRU order: move the session to the most recent end.
  sessions.delete(sessionId);
  sessions.set(sessionId, session);
  return session;
}

function closeSession(sessionId: string, session: Session) {
  sessions.delete(sessionId);
  session.transport.close().catch((error: unknown) => {
    console.error("Error closing MCP session:", error);
  });
}

function addSession(sessionId: string, session: Session) {
  while (sessions.size >= MAX_SESSIONS) {
    const [oldestId, oldest] = sessions.entries().next().value!;
    closeSession(oldestId, oldest);
  }
  sessions.set(sessionId, session);
}

function setBearerChallenge(res: Response, error?: string, description?: string) {
  const metadataUrl = new URL(OAUTH_PROTECTED_RESOURCE_METADATA_PATH, oauthConfig.resource).toString();
  const params = [`resource_metadata="${metadataUrl}"`, `resource="${oauthConfig.resource}"`];

  if (error) {
    params.push(`error="${error}"`);
  }

  if (description) {
    params.push(`error_description="${description.replace(/"/g, "'")}"`);
  }

  res.setHeader("WWW-Authenticate", `Bearer ${params.join(", ")}`);
}

function sendUnauthorizedJson(res: Response, description = "Unauthorized") {
  setBearerChallenge(res, "invalid_token", description);
  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message: "Unauthorized" },
    id: null,
  });
}

function sendUnauthorizedText(res: Response, description = "Unauthorized") {
  setBearerChallenge(res, "invalid_token", description);
  res.status(401).send("Unauthorized");
}

function toMcpAuthInfo(auth: AuthContext, toolsets: ReadonlySet<Toolset>): AuthInfo {
  if (auth.kind === "oauth") {
    return {
      token: auth.token,
      clientId: oauthConfig.clientId ?? auth.userId,
      scopes: auth.scopes,
      resource: new URL(oauthConfig.resource),
      extra: {
        kind: auth.kind,
        userId: auth.userId,
        organizationId: auth.organizationId,
        toolsets,
      },
    };
  }

  return {
    token: auth.token,
    clientId: "notra-api-key",
    scopes: ["*"],
    resource: new URL(oauthConfig.resource),
    extra: { kind: auth.kind, toolsets },
  };
}

function fromMcpAuthInfo(authInfo: AuthInfo): AuthContext {
  const extra = authInfo.extra ?? {};
  if (extra.kind === "oauth") {
    return {
      kind: "oauth",
      token: authInfo.token,
      userId: String(extra.userId),
      organizationId: String(extra.organizationId),
      scopes: authInfo.scopes,
    };
  }
  return { kind: "apiKey", token: authInfo.token };
}

/** Reads `?toolsets=content,geo`, falling back to `NOTRA_MCP_TOOLSETS`. */
function requestToolsets(req: Request, res: Response): ReadonlySet<Toolset> | undefined {
  const query = req.query?.toolsets;
  try {
    return parseToolsets(typeof query === "string" ? query : process.env.NOTRA_MCP_TOOLSETS);
  } catch (error) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32602, message: error instanceof Error ? error.message : "Invalid toolsets" },
      id: null,
    });
    return undefined;
  }
}

async function authenticateRequest(req: Request, res: Response): Promise<AuthContext | undefined> {
  const token = parseBearerToken(req.headers["authorization"]);
  if (!token) {
    sendUnauthorizedJson(res, "Missing bearer token");
    return undefined;
  }

  try {
    return await authenticateBearerToken(token, oauthConfig);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid bearer token";
    sendUnauthorizedJson(res, message);
    return undefined;
  }
}

async function handleModernRequest(req: Request, res: Response, auth: AuthContext, toolsets: ReadonlySet<Toolset>) {
  const authInfo = toMcpAuthInfo(auth, toolsets);
  const nodeHandler = toNodeHandler({
    fetch: (request, options) => modernHandler.fetch(request, { ...options, authInfo }),
  });
  await nodeHandler(req, res, req.body);
}

setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastSeen > SESSION_TTL_MS) {
      closeSession(sessionId, session);
    }
  }
}, SESSION_SWEEP_INTERVAL_MS).unref();

let authServerMetadataCache: { metadata: unknown; expiresAt: number } | undefined;

async function fetchAuthorizationServerMetadata(): Promise<unknown> {
  const now = Date.now();
  if (authServerMetadataCache && now < authServerMetadataCache.expiresAt) {
    return authServerMetadataCache.metadata;
  }

  try {
    const response = await fetch(oauthConfig.authorizationServerMetadataUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Authorization server metadata request failed with HTTP ${response.status}`);
    }

    const metadata: unknown = await response.json();
    authServerMetadataCache = { metadata, expiresAt: now + 5 * 60 * 1000 };
    return metadata;
  } catch (error) {
    // Serve stale metadata rather than failing discovery when AuthKit is
    // briefly unreachable.
    if (authServerMetadataCache) {
      return authServerMetadataCache.metadata;
    }
    throw error;
  }
}

async function handleAuthorizationServerMetadata(_req: Request, res: Response) {
  try {
    res.json(await fetchAuthorizationServerMetadata());
  } catch (error) {
    console.error("Error fetching authorization server metadata:", error);
    res.status(502).json({ error: "authorization_server_metadata_unavailable" });
  }
}

app.get(OAUTH_AUTHORIZATION_SERVER_METADATA_PATH, handleAuthorizationServerMetadata);
app.get("/.well-known/oauth-authorization-server/mcp", handleAuthorizationServerMetadata);

app.get(OAUTH_PROTECTED_RESOURCE_METADATA_PATH, (_req, res) => {
  res.json(getProtectedResourceMetadata(oauthConfig));
});

app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
  res.json(getProtectedResourceMetadata(oauthConfig, getMcpResourceUrl(oauthConfig)));
});

app.post("/register", (_req, res) => {
  res.status(404).end();
});

app.post("/mcp", async (req, res) => {
  try {
    const webRequest = await toWebRequest(req, req.body);
    if (!(await isLegacyRequest(webRequest, req.body))) {
      const toolsets = requestToolsets(req, res);
      if (!toolsets) {
        return;
      }
      const auth = await authenticateRequest(req, res);
      if (auth) {
        await handleModernRequest(req, res, auth, toolsets);
      }
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: NodeStreamableHTTPServerTransport;

    if (sessionId) {
      const session = await getAuthenticatedSession(req);
      if (!session) {
        sendUnauthorizedJson(res);
        return;
      }
      transport = session.transport;
    } else if (isInitializeRequest(req.body)) {
      const toolsets = requestToolsets(req, res);
      if (!toolsets) {
        return;
      }
      const auth = await authenticateRequest(req, res);
      if (!auth) {
        return;
      }

      const tokenDigest = digestToken(auth.token);
      const server = createServer(auth, { toolsets });

      transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: randomUUID,
        onsessioninitialized: (id: string) => {
          addSession(id, { transport, tokenDigest, auth, lastSeen: Date.now() });
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          sessions.delete(sid);
        }
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling POST /mcp:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req, res) => {
  const session = await getAuthenticatedSession(req);
  if (!session) {
    sendUnauthorizedText(res);
    return;
  }
  await session.transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const session = await getAuthenticatedSession(req);
  if (!session) {
    sendUnauthorizedText(res);
    return;
  }
  try {
    await session.transport.handleRequest(req, res);
  } catch (error) {
    console.error("Error handling session termination:", error);
    if (!res.headersSent) {
      res.status(500).send("Error processing session termination");
    }
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Body parser failures (oversized or malformed JSON) would otherwise be answered
// with Express's HTML error page, which MCP clients cannot surface.
app.use((error: BodyParserError, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent || !error.status || error.status >= 500) {
    next(error);
    return;
  }
  const rpcError =
    error.type === "entity.too.large"
      ? { code: -32600, message: `Request body exceeds the ${MCP_JSON_BODY_LIMIT_BYTES / (1024 * 1024)} MB limit` }
      : error.type === "entity.parse.failed"
        ? { code: -32700, message: "Parse error: invalid JSON" }
        : { code: -32600, message: "Invalid request body" };
  res.status(error.status).json({ jsonrpc: "2.0", error: rpcError, id: null });
});

const PORT = parseInt(process.env.PORT || "3000", 10);
const listener = app.listen(PORT, () => {
  const address = listener.address();
  console.log(`Notra MCP HTTP server listening on port ${typeof address === "object" ? address?.port : PORT}`);
});
