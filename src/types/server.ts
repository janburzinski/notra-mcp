import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import type { Toolset } from "./toolset.js";

export type CreateServerOptions = {
  /** Tool groups to expose. Defaults to `NOTRA_MCP_TOOLSETS`, or every toolset. */
  toolsets?: ReadonlySet<Toolset>;
};

export type ToolConfig = {
  inputSchema?: StandardSchemaWithJSON;
  outputSchema?: StandardSchemaWithJSON;
  [key: string]: unknown;
};

export type ToolHandler = (...args: unknown[]) => unknown;

export type ToolHandlerContext = { mcpReq?: { signal?: AbortSignal } };
