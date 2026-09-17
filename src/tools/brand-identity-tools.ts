import {
  listBrandIdentitiesSchema,
  getBrandIdentitySchema,
  updateBrandIdentitySchema,
  deleteBrandIdentitySchema,
  generateBrandIdentitySchema,
  getBrandIdentityGenerationStatusSchema,
} from "../schemas/brand-identity.js";
import type { McpServer } from "@modelcontextprotocol/server";
import { shareJsonSchema } from "../utils/json-schema-cache.js";

import type { NotraClient } from "../notra-client.js";
import { handleError } from "../utils/mcp.js";

export function registerBrandIdentityTools(server: McpServer, client: NotraClient) {
  server.registerTool(
    "list_brand_identities",
    {
      description: "List all brand identities configured for your organization",
      annotations: { title: "List Brand Identities", readOnlyHint: true },
      inputSchema: shareJsonSchema(listBrandIdentitiesSchema),
    },
    () => handleError(() => client.listBrandIdentities()),
  );

  server.registerTool(
    "get_brand_identity",
    {
      description: "Get a single brand identity by its ID, including tone, audience, and language settings",
      annotations: { title: "Get Brand Identity", readOnlyHint: true },
      inputSchema: shareJsonSchema(getBrandIdentitySchema),
    },
    ({ brandIdentityId }) => handleError(() => client.getBrandIdentity(brandIdentityId)),
  );

  server.registerTool(
    "update_brand_identity",
    {
      description: "Update a brand identity's settings including name, tone, audience, language, and more",
      annotations: { title: "Update Brand Identity", destructiveHint: true, idempotentHint: true },
      inputSchema: shareJsonSchema(updateBrandIdentitySchema),
    },
    ({ brandIdentityId, ...body }) => handleError(() => client.updateBrandIdentity(brandIdentityId, body)),
  );

  server.registerTool(
    "delete_brand_identity",
    {
      description: "Delete a brand identity. Returns any schedules or events that were disabled as a result.",
      annotations: { title: "Delete Brand Identity", destructiveHint: true, idempotentHint: true },
      inputSchema: shareJsonSchema(deleteBrandIdentitySchema),
    },
    ({ brandIdentityId }) => handleError(() => client.deleteBrandIdentity(brandIdentityId)),
  );

  server.registerTool(
    "generate_brand_identity",
    {
      description:
        "Queue async brand identity generation from a website URL. Notra will scrape the site and extract brand info. Use get_brand_identity_generation_status to poll for completion.",
      annotations: { title: "Generate Brand Identity", destructiveHint: false },
      inputSchema: shareJsonSchema(generateBrandIdentitySchema),
    },
    (params) => handleError(() => client.generateBrandIdentity(params)),
  );

  server.registerTool(
    "get_brand_identity_generation_status",
    {
      description: "Check the status of an async brand identity generation job",
      annotations: { title: "Get Brand Identity Generation Status", readOnlyHint: true },
      inputSchema: shareJsonSchema(getBrandIdentityGenerationStatusSchema),
    },
    ({ jobId }) => handleError(() => client.getBrandIdentityGenerationStatus(jobId)),
  );
}
