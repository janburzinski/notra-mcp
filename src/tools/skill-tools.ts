import {
  listSkillsSchema,
  getSkillSchema,
  skillPayloadSchema,
  updateSkillSchema,
  deleteSkillSchema,
} from "../schemas/skill.js";
import type { McpServer } from "@modelcontextprotocol/server";
import { shareJsonSchema } from "../utils/json-schema-cache.js";

import type { NotraClient } from "../notra-client.js";
import { handleError } from "../utils/mcp.js";

export function registerSkillTools(server: McpServer, client: NotraClient) {
  server.registerTool(
    "list_skills",
    {
      description: "List reusable writing skills for your organization",
      annotations: { title: "List Skills", readOnlyHint: true },
      inputSchema: shareJsonSchema(listSkillsSchema),
    },
    () => handleError(() => client.listSkills()),
  );

  server.registerTool(
    "get_skill",
    {
      description: "Get a single reusable writing skill by name",
      annotations: { title: "Get Skill", readOnlyHint: true },
      inputSchema: shareJsonSchema(getSkillSchema),
    },
    ({ name }) => handleError(() => client.getSkill(name)),
  );

  server.registerTool(
    "create_skill",
    {
      description: "Create a reusable writing skill",
      annotations: { title: "Create Skill", destructiveHint: false },
      inputSchema: shareJsonSchema(skillPayloadSchema),
    },
    (params) => handleError(() => client.createSkill(params)),
  );

  server.registerTool(
    "update_skill",
    {
      description: "Update a reusable writing skill by name",
      annotations: { title: "Update Skill", destructiveHint: true, idempotentHint: true },
      inputSchema: shareJsonSchema(updateSkillSchema),
    },
    ({ currentName, ...body }) => handleError(() => client.updateSkill(currentName, body)),
  );

  server.registerTool(
    "delete_skill",
    {
      description: "Delete a reusable writing skill by name",
      annotations: { title: "Delete Skill", destructiveHint: true, idempotentHint: true },
      inputSchema: shareJsonSchema(deleteSkillSchema),
    },
    ({ name }) => handleError(() => client.deleteSkill(name)),
  );
}
