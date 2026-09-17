import {
  listSkillsSchema,
  getSkillSchema,
  skillPayloadSchema,
  updateSkillSchema,
  deleteSkillSchema,
} from "../schemas/skill.js";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerTool } from "../utils/register-tool.js";

import type { NotraClient } from "../notra-client.js";
import { handleError } from "../utils/mcp.js";

export function registerSkillTools(server: McpServer, client: NotraClient) {
  registerTool(
    server,
    "list_skills",
    {
      description: "List reusable writing skills for your organization",
      annotations: { title: "List Skills", readOnlyHint: true },
      inputSchema: listSkillsSchema,
    },
    () => handleError(() => client.listSkills()),
  );

  registerTool(
    server,
    "get_skill",
    {
      description: "Get a single reusable writing skill by name",
      annotations: { title: "Get Skill", readOnlyHint: true },
      inputSchema: getSkillSchema,
    },
    ({ name }) => handleError(() => client.getSkill(name)),
  );

  registerTool(
    server,
    "create_skill",
    {
      description: "Create a reusable writing skill",
      annotations: { title: "Create Skill", destructiveHint: false },
      inputSchema: skillPayloadSchema,
    },
    (params) => handleError(() => client.createSkill(params)),
  );

  registerTool(
    server,
    "update_skill",
    {
      description: "Update a reusable writing skill by name",
      annotations: { title: "Update Skill", destructiveHint: true, idempotentHint: true },
      inputSchema: updateSkillSchema,
    },
    ({ currentName, ...body }) => handleError(() => client.updateSkill(currentName, body)),
  );

  registerTool(
    server,
    "delete_skill",
    {
      description: "Delete a reusable writing skill by name",
      annotations: { title: "Delete Skill", destructiveHint: true, idempotentHint: true },
      inputSchema: deleteSkillSchema,
    },
    ({ name }) => handleError(() => client.deleteSkill(name)),
  );
}
