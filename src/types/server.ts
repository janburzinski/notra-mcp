import type { Toolset } from "./toolset.js";

export type CreateServerOptions = {
  /** Tool groups to expose. Defaults to `NOTRA_MCP_TOOLSETS`, or every toolset. */
  toolsets?: ReadonlySet<Toolset>;
};

export type ToolHandlerContext = { mcpReq?: { signal?: AbortSignal } };
