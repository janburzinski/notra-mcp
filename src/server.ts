import "zod/compile";
import { McpServer } from "@modelcontextprotocol/server";
import { SERVER_INSTRUCTIONS } from "./constants/server.js";
import { NotraClient } from "./notra-client.js";
import { registerAgentTools } from "./tools/agent-tools.js";
import { registerBrandIdentityTools } from "./tools/brand-identity-tools.js";
import { registerChatTools } from "./tools/chat-tools.js";
import { registerEventTriggerTools } from "./tools/event-trigger-tools.js";
import { registerFeedbackInboxTools, registerFeedbackTools } from "./tools/feedback-tools.js";
import { registerGeoAgentReadinessTools } from "./tools/geo-agent-readiness-tools.js";
import { registerGeoBriefTools } from "./tools/geo-brief-tools.js";
import { registerGeoCompetitorTools } from "./tools/geo-competitor-tools.js";
import { registerGeoDiagnosticTools } from "./tools/geo-diagnostic-tools.js";
import { registerGeoPromptTools } from "./tools/geo-prompt-tools.js";
import { registerGeoScanTools } from "./tools/geo-scan-tools.js";
import { registerGeoSequenceTools } from "./tools/geo-sequence-tools.js";
import { registerGeoSettingsTools } from "./tools/geo-settings-tools.js";
import { registerGeoTrafficTools } from "./tools/geo-traffic-tools.js";
import { registerGeoVisibilityTools } from "./tools/geo-visibility-tools.js";
import { registerIntegrationTools } from "./tools/integration-tools.js";
import { registerPostTools } from "./tools/post-tools.js";
import { registerProjectTools } from "./tools/project-tools.js";
import { registerScheduleTools } from "./tools/schedule-tools.js";
import { registerSkillTools } from "./tools/skill-tools.js";
import { registerWorkspaceTools } from "./tools/workspace-tools.js";
import type { AuthContext } from "./types/auth.js";
import type { CreateServerOptions } from "./types/server.js";
import { parseToolsets } from "./utils/toolsets.js";

export const SERVER_VERSION = "1.1.0";

export function createServer(auth: string | AuthContext, options: CreateServerOptions = {}): McpServer {
  const client = new NotraClient(auth);
  const toolsets = options.toolsets ?? parseToolsets(process.env.NOTRA_MCP_TOOLSETS);

  const server = new McpServer(
    {
      name: "notra",
      version: SERVER_VERSION,
    },
    { instructions: SERVER_INSTRUCTIONS },
  );

  if (toolsets.has("content")) {
    registerPostTools(server, client);
    registerBrandIdentityTools(server, client);
    registerIntegrationTools(server, client);
    registerScheduleTools(server, client);
    registerEventTriggerTools(server, client);
    registerChatTools(server, client);
    registerAgentTools(server, client);
    registerSkillTools(server, client);
    registerFeedbackInboxTools(server, client);
  }
  if (toolsets.has("geo")) {
    registerProjectTools(server, client);
    registerGeoSettingsTools(server, client);
    registerGeoPromptTools(server, client);
    registerGeoSequenceTools(server, client);
    registerGeoCompetitorTools(server, client);
    registerGeoDiagnosticTools(server, client);
    registerGeoScanTools(server, client);
    registerGeoVisibilityTools(server, client);
    registerGeoBriefTools(server, client);
    registerGeoAgentReadinessTools(server, client);
    registerGeoTrafficTools(server, client);
  }
  registerWorkspaceTools(server, client);
  registerFeedbackTools(server, {
    url: "https://api.usenotra.com/v1/feedback/notra",
    productName: "Notra",
    defaults: { agentClient: "notra-mcp", toolVersion: SERVER_VERSION },
  });

  return server;
}
