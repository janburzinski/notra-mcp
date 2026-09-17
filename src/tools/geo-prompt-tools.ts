import {
  listGeoPromptsSchema,
  createGeoPromptSchema,
  updateGeoPromptSchema,
  deleteGeoPromptSchema,
} from "../schemas/geo-prompt.js";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerTool } from "../utils/register-tool.js";

import type { NotraClient } from "../notra-client.js";

import { geoPromptImportSchema } from "../schemas/geo-import.js";
import { toImportSource } from "../utils/import-source.js";
import { handleError } from "../utils/mcp.js";

export function registerGeoPromptTools(server: McpServer, client: NotraClient) {
  registerTool(
    server,
    "list_geo_prompts",
    {
      description:
        "List the GEO prompts tracked for a project: custom prompts plus the ones derived automatically from the brand context",
      annotations: { title: "List GEO Prompts", readOnlyHint: true },
      inputSchema: listGeoPromptsSchema,
    },
    ({ projectId }) => handleError(() => client.listGeoPrompts(projectId)),
  );

  registerTool(
    server,
    "create_geo_prompt",
    {
      description: "Track a new GEO prompt so future scans check it against every configured answer engine",
      annotations: { title: "Create GEO Prompt", destructiveHint: false },
      inputSchema: createGeoPromptSchema,
    },
    ({ projectId, prompt }) => handleError(() => client.createGeoPrompt(projectId, prompt)),
  );

  registerTool(
    server,
    "update_geo_prompt",
    {
      description: "Enable or disable a tracked GEO prompt",
      annotations: { title: "Update GEO Prompt", destructiveHint: true, idempotentHint: true },
      inputSchema: updateGeoPromptSchema,
    },
    ({ projectId, promptId, enabled }) => handleError(() => client.updateGeoPrompt(projectId, promptId, enabled)),
  );

  registerTool(
    server,
    "delete_geo_prompt",
    {
      description: "Stop tracking a GEO prompt",
      annotations: { title: "Delete GEO Prompt", destructiveHint: true, idempotentHint: true },
      inputSchema: deleteGeoPromptSchema,
    },
    ({ projectId, promptId }) => handleError(() => client.deleteGeoPrompt(projectId, promptId)),
  );

  registerTool(
    server,
    "import_geo_prompts",
    {
      description:
        "Bulk import GEO prompts from structured rows or raw CSV text. Prompts that already exist are skipped, not duplicated.",
      annotations: { title: "Import GEO Prompts", destructiveHint: false },
      inputSchema: geoPromptImportSchema,
    },
    ({ projectId, rows, csv }) => handleError(() => client.importGeoPrompts(projectId, toImportSource(rows, csv))),
  );
}
