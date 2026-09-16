#!/usr/bin/env node
/**
 * Compares the Notra OpenAPI spec against the routes this MCP server exposes.
 *
 * Run `npm run build` first. The script instantiates the built `NotraClient`
 * against a recording `fetch`, calls every public method with placeholder
 * arguments, and collects the `METHOD /path` pairs it produces. Those are
 * matched against the spec and against `client.<method>(` references in
 * `src/tools` and `src/utils`, so a route only counts as covered when a
 * registered tool can actually reach it.
 *
 * Exit code 1 when a spec route has no tool, or when the client calls a route
 * the spec does not know (unless listed in PENDING_API_ROUTES).
 *
 * Environment:
 *   NOTRA_OPENAPI_URL   spec URL (default: `${NOTRA_API_BASE}/openapi.json`)
 *   NOTRA_OPENAPI_FILE  read the spec from a local file instead of fetching it
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NotraClient } from "../build/notra-client.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLACEHOLDER = "__P__";
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];
const CLIENT_INTERNALS = new Set(["constructor", "request", "requestText", "geoPath"]);

/** Spec routes deliberately not exposed as MCP tools. */
const EXCLUDED_SPEC_ROUTES = {
  "GET /v1/status": "unauthenticated reachability probe, no value inside an authenticated MCP session",
  "POST /v1/feedback":
    "API-key variant; the spec directs agents to the organization feedback URL used by submit_feedback",
  "POST /v2/eve/v1/session":
    "eve session protocol needs the NDJSON event stream to read replies; create_chat covers conversational use",
  "POST /v2/eve/v1/session/{sessionId}":
    "eve session protocol needs the NDJSON event stream to read replies; post_chat_message covers conversational use",
  "GET /v2/eve/v1/session/{sessionId}/stream":
    "NDJSON event stream, cannot be surfaced through a request/response tool",
};

/** Routes covered by code that does not go through NotraClient. */
const MANUAL_COVERAGE = {
  "POST /v1/feedback/{organizationSlug}": ["submit_feedback"],
};

/** Client routes the production API has not shipped yet. Remove entries once they appear in the spec. */
const PENDING_API_ROUTES = {};

function normalizeSpecPath(specPath) {
  return specPath.replace(/\{[^}]+\}/g, PLACEHOLDER);
}

async function loadSpec() {
  if (process.env.NOTRA_OPENAPI_FILE) {
    return JSON.parse(await readFile(process.env.NOTRA_OPENAPI_FILE, "utf8"));
  }
  const base = process.env.NOTRA_API_BASE ?? "https://api.usenotra.com";
  const url = process.env.NOTRA_OPENAPI_URL ?? `${base}/openapi.json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

function listSpecRoutes(spec) {
  const routes = new Map();
  for (const [specPath, item] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (!operation) continue;
      const key = `${method.toUpperCase()} ${specPath}`;
      routes.set(`${method.toUpperCase()} ${normalizeSpecPath(specPath)}`, {
        key,
        tag: operation.tags?.[0] ?? "untagged",
        operationId: operation.operationId ?? "",
        summary: operation.summary ?? "",
      });
    }
  }
  return routes;
}

async function recordClientRoutes() {
  const originalFetch = globalThis.fetch;
  const recorded = new Map();
  let current;
  let hit = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const key = `${(init?.method ?? "GET").toUpperCase()} ${decodeURIComponent(url.pathname)}`;
    if (!recorded.has(key)) recorded.set(key, new Set());
    recorded.get(key).add(current);
    hit = true;
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const client = new NotraClient("coverage-token", "http://coverage.invalid");
    const methods = Object.getOwnPropertyNames(NotraClient.prototype).filter(
      (name) => !CLIENT_INTERNALS.has(name) && typeof client[name] === "function",
    );
    for (const name of methods) {
      current = name;
      const arity = client[name].length;
      // Path params want strings, query/body params want objects. Start with all
      // strings and swap trailing arguments for objects until a request is made.
      for (let objectArgs = 0; objectArgs <= arity; objectArgs++) {
        hit = false;
        const args = Array.from({ length: arity }, (_, i) => (i >= arity - objectArgs ? {} : PLACEHOLDER));
        try {
          await client[name](...args);
        } catch {
          // Response-shape errors are irrelevant; only the recorded request matters.
        }
        if (hit) break;
      }
      if (!hit) throw new Error(`NotraClient.${name} never issued a request with placeholder arguments`);
    }
    return { recorded, methods };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? collectSourceFiles(full) : entry.name.endsWith(".ts") ? [full] : [];
    }),
  );
  return files.flat();
}

/** Maps each `client.<method>` reference to the tool names (or util files) that use it. */
async function mapMethodsToTools() {
  const usage = new Map();
  const add = (method, user) => {
    if (!usage.has(method)) usage.set(method, new Set());
    usage.get(method).add(user);
  };

  for (const file of await collectSourceFiles(path.join(ROOT, "src", "tools"))) {
    const source = await readFile(file, "utf8");
    const blocks = source.split(/registerTool\(\s*"/).slice(1);
    for (const block of blocks) {
      const toolName = block.slice(0, block.indexOf('"'));
      for (const match of block.matchAll(/client\.(\w+)\(/g)) add(match[1], toolName);
    }
  }
  for (const file of await collectSourceFiles(path.join(ROOT, "src", "utils"))) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/client\.(\w+)\(/g)) add(match[1], `utils/${path.basename(file)}`);
  }
  return usage;
}

function printGroup(title, rows) {
  if (rows.length === 0) return;
  console.log(`\n${title} (${rows.length})`);
  for (const row of rows) console.log(`  ${row}`);
}

async function main() {
  // Load the spec before recordClientRoutes swaps out globalThis.fetch.
  const spec = await loadSpec();
  const [{ recorded, methods }, usage] = await Promise.all([recordClientRoutes(), mapMethodsToTools()]);
  const specRoutes = listSpecRoutes(spec);

  const covered = [];
  const missingTool = [];
  const clientOnly = [];
  const unknownRoutes = [];
  const stalePending = [];
  const excludedButCovered = [];

  for (const [normalized, route] of specRoutes) {
    const clientMethods = [...(recorded.get(normalized) ?? [])];
    const tools = new Set(MANUAL_COVERAGE[route.key] ?? []);
    for (const method of clientMethods) for (const user of usage.get(method) ?? []) tools.add(user);

    if (route.key in PENDING_API_ROUTES) stalePending.push(route.key);
    if (tools.size > 0) {
      covered.push(route.key);
      if (route.key in EXCLUDED_SPEC_ROUTES) excludedButCovered.push(route.key);
    } else if (clientMethods.length > 0) {
      clientOnly.push(`${route.key}  client: ${clientMethods.join(", ")}`);
    } else if (!(route.key in EXCLUDED_SPEC_ROUTES)) {
      missingTool.push(`${route.key}  [${route.tag}] ${route.operationId || route.summary}`);
    }
  }

  const pendingNormalized = new Map(Object.keys(PENDING_API_ROUTES).map((key) => [normalizeSpecPath(key), key]));
  for (const [normalized, clientMethods] of recorded) {
    if (specRoutes.has(normalized) || pendingNormalized.has(normalized)) continue;
    unknownRoutes.push(`${normalized.replaceAll(PLACEHOLDER, "{…}")}  client: ${[...clientMethods].join(", ")}`);
  }

  const unusedMethods = methods.filter((name) => !usage.has(name));

  console.log(`Notra API coverage: ${covered.length}/${specRoutes.size} spec routes reachable through MCP tools`);
  console.log(
    `Excluded on purpose: ${Object.keys(EXCLUDED_SPEC_ROUTES).length}, pending API routes: ${Object.keys(PENDING_API_ROUTES).length}`,
  );
  printGroup("Spec routes without an MCP tool", missingTool);
  printGroup("Spec routes reached by NotraClient but not by any tool", clientOnly);
  printGroup("NotraClient routes unknown to the spec", unknownRoutes);
  printGroup("NotraClient methods no tool or util references", unusedMethods);
  printGroup("PENDING_API_ROUTES entries now in the spec, remove them", stalePending);
  printGroup("EXCLUDED_SPEC_ROUTES entries that already have a tool, remove them", excludedButCovered);

  const failed =
    missingTool.length + clientOnly.length + unknownRoutes.length + stalePending.length + excludedButCovered.length > 0;
  console.log(failed ? "\nFAIL: MCP tools and API routes are out of sync." : "\nOK: every spec route has an MCP tool.");
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
