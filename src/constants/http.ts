import { GEO_CSV_IMPORT_MAX_LENGTH } from "./geo.js";

export const SESSION_TTL_MS = 30 * 60 * 1000;
export const SESSION_SWEEP_INTERVAL_MS = 60 * 1000;
export const DEFAULT_MAX_SESSIONS = 1000;

// CSV imports accept up to 1 MB of text; JSON escaping and the JSON-RPC envelope
// add overhead, so allow twice that.
export const MCP_JSON_BODY_LIMIT_BYTES = GEO_CSV_IMPORT_MAX_LENGTH * 2;
