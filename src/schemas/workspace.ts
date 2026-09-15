import * as z from "zod";

export const whoAmIInputSchema = z.object({});

export const listWorkspacesInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().describe("Maximum workspaces to return (default 50)"),
  after: z.string().min(1).optional().describe("Pagination cursor returned by a previous call"),
});
