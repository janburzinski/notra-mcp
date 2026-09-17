import * as z from "zod";

export const listAgentChatsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().describe("Maximum sessions to return"),
});
