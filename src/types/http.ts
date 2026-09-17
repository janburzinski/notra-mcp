import type { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import type { AuthContext } from "./auth.js";

export type Session = {
  transport: NodeStreamableHTTPServerTransport;
  tokenDigest: Buffer;
  auth: AuthContext;
  lastSeen: number;
};

/** The subset of Express body-parser errors the MCP endpoint maps to JSON-RPC. */
export type BodyParserError = {
  status?: number;
  type?: string;
};
