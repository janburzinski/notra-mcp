import type { McpServer } from "@modelcontextprotocol/server";
import { registerTool } from "../utils/register-tool.js";
import type { NotraClient } from "../notra-client.js";
import {
  createEventTriggerSchema,
  deleteEventTriggerSchema,
  getEventTriggerSchema,
  listEventTriggersSchema,
  updateEventTriggerSchema,
} from "../schemas/event-trigger.js";
import { handleError } from "../utils/mcp.js";

export function registerEventTriggerTools(server: McpServer, client: NotraClient) {
  registerTool(
    server,
    "list_event_triggers",
    {
      description:
        "List event triggers that generate content automatically from GitHub releases or pushes. repositoryMap labels each targeted GitHub integration ID with its owner/repo.",
      annotations: { title: "List Event Triggers", readOnlyHint: true },
      inputSchema: listEventTriggersSchema,
    },
    (params) => handleError(() => client.listEventTriggers(params)),
  );

  registerTool(
    server,
    "get_event_trigger",
    {
      description: "Get a single event trigger by its ID",
      annotations: { title: "Get Event Trigger", readOnlyHint: true },
      inputSchema: getEventTriggerSchema,
    },
    ({ triggerId }) => handleError(() => client.getEventTrigger(triggerId)),
  );

  registerTool(
    server,
    "create_event_trigger",
    {
      description:
        "Create an event trigger that generates content whenever a GitHub release or push happens in the targeted repositories. Generated content uses AI credits each time the trigger fires.",
      annotations: { title: "Create Event Trigger", destructiveHint: false },
      inputSchema: createEventTriggerSchema,
    },
    (body) => handleError(() => client.createEventTrigger(body)),
  );

  registerTool(
    server,
    "update_event_trigger",
    {
      description:
        "Replace an event trigger's configuration. The API takes the full definition, so read it with get_event_trigger first and send every field back.",
      annotations: { title: "Update Event Trigger", destructiveHint: true, idempotentHint: true },
      inputSchema: updateEventTriggerSchema,
    },
    // The API rejects outputConfig: null, which get_event_trigger returns for triggers without one.
    ({ triggerId, outputConfig, ...body }) =>
      handleError(() => client.updateEventTrigger(triggerId, { ...body, ...(outputConfig && { outputConfig }) })),
  );

  registerTool(
    server,
    "delete_event_trigger",
    {
      description: "Delete an event trigger",
      annotations: { title: "Delete Event Trigger", destructiveHint: true, idempotentHint: true },
      inputSchema: deleteEventTriggerSchema,
    },
    ({ triggerId }) => handleError(() => client.deleteEventTrigger(triggerId)),
  );
}
