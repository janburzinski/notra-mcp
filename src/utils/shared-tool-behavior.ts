import type { McpServer } from "@modelcontextprotocol/server";
import type { ToolConfig, ToolHandler, ToolHandlerContext } from "../types/server.js";
import { cacheJsonSchema } from "./json-schema-cache.js";
import { runWithRequestSignal } from "./request-signal.js";

/**
 * Applies process-wide behavior to every tool: JSON Schemas are converted once
 * instead of per server, and Notra API calls inherit the MCP request's
 * cancellation signal.
 */
export function useSharedToolBehavior(server: McpServer) {
  const registerTool = server.registerTool.bind(server) as (
    name: string,
    config: ToolConfig,
    handler: ToolHandler,
  ) => ReturnType<McpServer["registerTool"]>;

  server.registerTool = ((name: string, config: ToolConfig, handler: ToolHandler) =>
    registerTool(
      name,
      {
        ...config,
        ...(config.inputSchema && { inputSchema: cacheJsonSchema(config.inputSchema) }),
        ...(config.outputSchema && { outputSchema: cacheJsonSchema(config.outputSchema) }),
      },
      (...args: unknown[]) => {
        // Handlers receive (args, ctx), or only (ctx) when a tool has no input schema.
        const ctx = args.at(-1) as ToolHandlerContext | undefined;
        return runWithRequestSignal(ctx?.mcpReq?.signal, () => handler(...args));
      },
    )) as McpServer["registerTool"];
}
