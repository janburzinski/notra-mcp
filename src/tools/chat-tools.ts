import {
  listChatsSchema,
  getChatSchema,
  getChatByExternalChannelSchema,
  sendChatMessageSchema,
  postChatMessageSchema,
} from "../schemas/chat.js";
import type { McpServer } from "@modelcontextprotocol/server";
import { shareJsonSchema } from "../utils/json-schema-cache.js";

import type { NotraClient } from "../notra-client.js";
import { handleError } from "../utils/mcp.js";

export function registerChatTools(server: McpServer, client: NotraClient) {
  server.registerTool(
    "list_chats",
    {
      description: "List chat sessions for your organization",
      annotations: { title: "List Chats", readOnlyHint: true },
      inputSchema: shareJsonSchema(listChatsSchema),
    },
    () => handleError(() => client.listChats()),
  );

  server.registerTool(
    "get_chat",
    {
      description: "Get a single chat session with its messages",
      annotations: { title: "Get Chat", readOnlyHint: true },
      inputSchema: shareJsonSchema(getChatSchema),
    },
    ({ chatId }) => handleError(() => client.getChat(chatId)),
  );

  server.registerTool(
    "get_chat_by_external_channel",
    {
      description: "Get a chat session by Discord or Slack external channel ID",
      annotations: { title: "Get Chat by External Channel", readOnlyHint: true },
      inputSchema: shareJsonSchema(getChatByExternalChannelSchema),
    },
    ({ source, id }) => handleError(() => client.getChatByExternalChannel(source, id)),
  );

  server.registerTool(
    "create_chat",
    {
      description: "Start a new chat and return the assistant's reply text with the chat ID when available",
      annotations: { title: "Create Chat", destructiveHint: false },
      inputSchema: shareJsonSchema(sendChatMessageSchema),
    },
    (params) => handleError(() => client.createChat(params)),
  );

  server.registerTool(
    "post_chat_message",
    {
      description: "Post a message to an existing chat and return the assistant's reply text",
      annotations: { title: "Post Chat Message", destructiveHint: false },
      inputSchema: shareJsonSchema(postChatMessageSchema),
    },
    ({ chatId, ...body }) => handleError(() => client.postChatMessage(chatId, body)),
  );
}
