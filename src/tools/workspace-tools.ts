import type { McpServer } from "@modelcontextprotocol/server";
import type { NotraClient } from "../notra-client.js";
import { listWorkspacesInputSchema, whoAmIInputSchema } from "../schemas/workspace.js";
import type { WhoAmIResponse } from "../types/workspace.js";
import { handleError } from "../utils/mcp.js";

export async function getWhoAmI(client: NotraClient): Promise<WhoAmIResponse> {
  const context = await client.getWorkspaceContext();
  return {
    workspace: context.currentWorkspace,
    authentication: context.authentication,
  };
}

export function registerWorkspaceTools(server: McpServer, client: NotraClient) {
  server.registerTool(
    "whoami",
    {
      description:
        "Show the current Notra workspace and authenticated account. Use this to confirm which workspace this MCP connection operates against.",
      annotations: { title: "Who Am I", readOnlyHint: true },
      inputSchema: whoAmIInputSchema,
    },
    async () => {
      return handleError(() => getWhoAmI(client));
    },
  );

  server.registerTool(
    "list_workspaces",
    {
      description:
        "List accepted and pending Notra workspaces available to the authenticated account. Organization API keys only return their current workspace.",
      annotations: { title: "List Workspaces", readOnlyHint: true },
      inputSchema: listWorkspacesInputSchema,
    },
    async () => {
      return handleError(() => client.getWorkspaceContext(true));
    },
  );
}
