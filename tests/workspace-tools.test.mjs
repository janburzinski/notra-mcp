import assert from "node:assert/strict";
import { test } from "vitest";
import { createServer } from "../src/server.ts";
import { getWhoAmI } from "../src/tools/workspace-tools.ts";

const workspace = {
  id: "org_123",
  slug: "acme",
  name: "Acme",
  logo: null,
};

test("whoami returns the current workspace without exposing the API key", async () => {
  let params;
  const client = {
    listPosts: async (receivedParams) => {
      params = receivedParams;
      return { organization: workspace, posts: [], pagination: {} };
    },
  };

  const result = await getWhoAmI(client, { kind: "apiKey", token: "secret" });

  assert.deepEqual(params, { limit: 1 });
  assert.deepEqual(result, {
    workspace,
    authentication: { type: "apiKey" },
  });
  assert.doesNotMatch(JSON.stringify(result), /secret/);
});

test("whoami identifies the authenticated OAuth account and scopes", async () => {
  const client = {
    listPosts: async () => ({ organization: workspace, posts: [], pagination: {} }),
  };

  const result = await getWhoAmI(client, {
    kind: "oauth",
    token: "secret",
    userId: "user_123",
    organizationId: "workos_org_123",
    scopes: ["posts.read"],
  });

  assert.deepEqual(result, {
    workspace,
    authentication: {
      type: "oauth",
      accountId: "user_123",
      scopes: ["posts.read"],
    },
  });
  assert.doesNotMatch(JSON.stringify(result), /secret|workos_org_123/);
});

test("the MCP server registers whoami as a read-only tool", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).pathname, "/v1/posts");
    assert.equal(new URL(url).searchParams.get("limit"), "1");
    assert.equal(options.headers.Authorization, "Bearer secret");
    return Response.json({ organization: workspace, posts: [], pagination: {} });
  };

  try {
    const server = createServer({
      kind: "oauth",
      token: "secret",
      userId: "user_123",
      organizationId: "workos_org_123",
      scopes: ["posts.read"],
    });
    const tool = server._registeredTools.whoami;

    assert.equal(tool.annotations.readOnlyHint, true);
    assert.deepEqual(await tool.handler({}), {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              workspace,
              authentication: {
                type: "oauth",
                accountId: "user_123",
                scopes: ["posts.read"],
              },
            },
            null,
            2,
          ),
        },
      ],
      structuredContent: {
        workspace,
        authentication: {
          type: "oauth",
          accountId: "user_123",
          scopes: ["posts.read"],
        },
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
