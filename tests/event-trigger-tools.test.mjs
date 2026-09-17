import { expect, test, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { createServer } from "../src/server.ts";
import { updateEventTriggerSchema } from "../src/schemas/event-trigger.ts";

// Shape returned by get_event_trigger for a trigger without output configuration.
const storedTrigger = {
  id: "trigger-1",
  organizationId: "org-1",
  name: "Release notes",
  sourceType: "github_webhook",
  sourceConfig: { eventTypes: ["release"], includePreReleases: false },
  targets: { repositoryIds: ["repo-1"] },
  outputType: "changelog",
  outputConfig: null,
  enabled: true,
  autoPublish: true,
  createdAt: "2026-09-17T00:00:00.000Z",
  updatedAt: "2026-09-17T00:00:00.000Z",
};

function replacementFrom(trigger) {
  const { id, sourceType, sourceConfig, targets, outputType, outputConfig, enabled, autoPublish } = trigger;
  return { triggerId: id, sourceType, sourceConfig, targets, outputType, outputConfig, enabled, autoPublish };
}

test("update_event_trigger accepts a get_event_trigger result sent back unchanged", () => {
  expect(updateEventTriggerSchema.safeParse(replacementFrom(storedTrigger)).success).toBe(true);
});

test("update_event_trigger requires autoPublish so omitting it cannot silently disable publishing", () => {
  const { autoPublish: _, ...withoutAutoPublish } = replacementFrom(storedTrigger);
  const result = updateEventTriggerSchema.safeParse(withoutAutoPublish);
  expect(result.success).toBe(false);
  expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(["autoPublish"]);
});

test("update_event_trigger omits a null outputConfig from the PATCH body", async () => {
  const handlers = new Map();
  vi.spyOn(McpServer.prototype, "registerTool").mockImplementation((name, _config, handler) => {
    handlers.set(name, handler);
  });
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => Response.json({ eventTrigger: storedTrigger, organization: { id: "org-1" } }));
  createServer("key");

  const { triggerId, ...body } = replacementFrom(storedTrigger);
  const result = await handlers.get("update_event_trigger")(updateEventTriggerSchema.parse({ triggerId, ...body }));
  expect(result.isError).toBeUndefined();
  const [url, init] = fetch.mock.calls[0];
  expect(init.method).toBe("PATCH");
  expect(new URL(url).pathname).toBe("/v1/event-triggers/trigger-1");
  const { outputConfig: _, ...expected } = body;
  expect(JSON.parse(init.body)).toEqual(expected);

  const withConfig = { ...body, outputConfig: { brandVoiceId: "brand-1" } };
  await handlers.get("update_event_trigger")({ triggerId, ...withConfig });
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(withConfig);
});
