import { expect, test, vi } from "vitest";
import * as z from "zod";
import { McpServer } from "@modelcontextprotocol/server";
import { TOOLSET_VALUES } from "../src/constants/toolsets.ts";
import { createServer } from "../src/server.ts";
import { cacheJsonSchema } from "../src/utils/json-schema-cache.ts";
import { parseToolsets } from "../src/utils/toolsets.ts";

function registeredToolNames(options) {
  const names = [];
  const register = vi.spyOn(McpServer.prototype, "registerTool").mockImplementation((name) => names.push(name));
  createServer("key", options);
  register.mockRestore();
  return names;
}

test("JSON Schema conversion runs once per schema and keeps zod validation", () => {
  const schema = z.object({ id: z.string().describe("ID") });
  const convert = vi.spyOn(schema["~standard"].jsonSchema, "input");
  cacheJsonSchema(schema);
  cacheJsonSchema(schema);

  const first = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
  const second = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
  expect(convert).toHaveBeenCalledTimes(1);
  expect(second).toBe(first);
  expect(Object.isFrozen(first.properties.id)).toBe(true);
  expect(first).not.toHaveProperty("$schema");
  expect(first.properties.id).toEqual({ type: "string", description: "ID" });
  expect(schema["~standard"].validate({ id: "a" })).toEqual({ value: { id: "a" } });
  expect(schema["~standard"].validate({ id: 1 }).issues).toHaveLength(1);
});

test("servers built per request share converted tool schemas", () => {
  const [first, second] = [createServer("key-a"), createServer("key-b")];
  for (const name of ["list_posts", "import_geo_prompts", "get_geo_snapshot", "submit_feedback"]) {
    const schema = first.toolInputSchemaJson(name);
    expect(schema?.type).toBe("object");
    // The SDK wraps the root in a fresh object; the converted body is shared.
    expect(second.toolInputSchemaJson(name).properties).toBe(schema.properties);
  }
});

test("per-request server construction stays cheap after warmup", () => {
  createServer("warmup");
  const started = performance.now();
  for (let i = 0; i < 100; i++) createServer(`key-${i}`);
  const averageMs = (performance.now() - started) / 100;
  // Uncached construction costs about 2.5 ms on an M-series Mac; keep a wide CI margin.
  expect(averageMs).toBeLessThan(1);
});

test("tool handlers expose the MCP request signal to Notra API calls", async () => {
  const handlers = new Map();
  vi.spyOn(McpServer.prototype, "registerTool").mockImplementation((name, _config, handler) => {
    handlers.set(name, handler);
  });
  const signals = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    signals.push(init.signal);
    return Response.json({ projects: [] });
  });
  createServer("key");
  const controller = new AbortController();
  await handlers.get("list_projects")({}, { mcpReq: { signal: controller.signal } });
  expect(signals[0].aborted).toBe(false);
  controller.abort();
  expect(signals[0].aborted).toBe(true);
});

test("toolsets default to everything and filter registered tools", () => {
  expect([...parseToolsets(undefined)]).toEqual([...TOOLSET_VALUES]);
  expect([...parseToolsets(" GEO , content ")]).toEqual(["geo", "content"]);
  expect(() => parseToolsets("content,geos")).toThrow("Unknown toolset: geos. Valid toolsets: content, geo");

  const all = registeredToolNames();
  const content = registeredToolNames({ toolsets: parseToolsets("content") });
  const geo = registeredToolNames({ toolsets: parseToolsets("geo") });
  expect(all).toHaveLength(97);
  expect(new Set([...content, ...geo])).toEqual(new Set(all));
  expect(content).toContain("create_chat");
  expect(content).not.toContain("list_projects");
  expect(geo).toContain("list_projects");
  expect(geo.filter((name) => content.includes(name)).sort()).toEqual(["list_workspaces", "submit_feedback", "whoami"]);
});

test("NOTRA_MCP_TOOLSETS configures stdio servers", () => {
  vi.stubEnv("NOTRA_MCP_TOOLSETS", "geo");
  expect(registeredToolNames()).not.toContain("list_posts");
});
