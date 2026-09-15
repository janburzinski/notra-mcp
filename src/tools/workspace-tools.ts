import type { McpServer } from "@modelcontextprotocol/server";
import type { NotraClient } from "../notra-client.js";
import { whoAmIInputSchema } from "../schemas/workspace.js";
import type { AuthContext } from "../types/auth.js";
import type { AuthenticationIdentity, WhoAmIResponse } from "../types/workspace.js";
import { handleError } from "../utils/mcp.js";

function getAuthenticationIdentity(auth: AuthContext): AuthenticationIdentity {
  if (auth.kind === "oauth") {
    return {
      type: auth.kind,
      accountId: auth.userId,
      scopes: auth.scopes,
    };
  }

  return { type: auth.kind };
}

export async function getWhoAmI(client: NotraClient, auth: AuthContext): Promise<WhoAmIResponse> {
  const { organization } = await client.listPosts({ limit: 1 });

  return {
    workspace: organization,
    authentication: getAuthenticationIdentity(auth),
  };
}

export function registerWorkspaceTools(server: McpServer, client: NotraClient, auth: AuthContext) {
  server.registerTool(
    "whoami",
    {
      description:
        "Show the current Notra workspace and authenticated account. Use this to confirm which workspace this MCP connection operates against.",
      annotations: { title: "Who Am I", readOnlyHint: true },
      inputSchema: whoAmIInputSchema,
    },
    async () => {
      return handleError(() => getWhoAmI(client, auth));
    },
  );
}
