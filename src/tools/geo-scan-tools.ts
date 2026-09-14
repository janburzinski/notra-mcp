import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { NotraClient } from "../notra-client.js";
import { geoResourceIdSchema, projectIdSchema } from "../schemas/geo-fields.js";
import { handleError } from "../utils/mcp.js";

export function registerGeoScanTools(server: McpServer, client: NotraClient) {
  server.registerTool(
    "create_geo_scan",
    {
      description:
        "Trigger a GEO visibility scan. The scan runs asynchronously and checks every enabled prompt against every configured answer engine; poll get_geo_scan with the returned scanId for status, progress, mentions, and safe failure details. This uses AI credits.",
      annotations: { title: "Create GEO Scan", destructiveHint: false },
      inputSchema: z.object({
        projectId: projectIdSchema,
      }),
    },
    async ({ projectId }) => {
      return handleError(() => client.createGeoScan(projectId));
    },
  );

  server.registerTool(
    "list_geo_scans",
    {
      description:
        "List a project's GEO scans, newest first, with pagination, check totals by engine, and safe failure details",
      annotations: { title: "List GEO Scans", readOnlyHint: true },
      inputSchema: z.object({
        projectId: projectIdSchema,
        limit: z.number().int().min(1).max(100).optional().describe("Items per page (1-100, default 20)"),
        page: z.number().int().min(1).optional().describe("Page number (default 1)"),
      }),
    },
    async ({ projectId, ...params }) => {
      return handleError(() => client.listGeoScans(projectId, params));
    },
  );

  server.registerTool(
    "get_geo_scan",
    {
      description:
        "Get a GEO scan's status, planned and completed checks, mentions and explicit failures by engine, plus safe failure details when the scan failed",
      annotations: { title: "Get GEO Scan", readOnlyHint: true },
      inputSchema: z.object({
        projectId: projectIdSchema,
        scanId: geoResourceIdSchema.describe("The scan ID to retrieve"),
      }),
    },
    async ({ projectId, scanId }) => {
      return handleError(() => client.getGeoScan(projectId, scanId));
    },
  );
}
