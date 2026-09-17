import type { McpServer } from "@modelcontextprotocol/server";
import { registerTool } from "../utils/register-tool.js";

import type { NotraClient } from "../notra-client.js";
import {
  getGeoChangesSchema,
  getGeoPromptHistorySchema,
  getGeoSentimentAnalysisSchema,
  getGeoSentimentSchema,
  getGeoSnapshotSchema,
  listGeoSentimentEvidenceSchema,
  listGeoShelfSourcesSchema,
} from "../schemas/geo-diagnostics.js";
import { loadGeoSnapshot } from "../utils/geo-snapshot.js";
import { handleError } from "../utils/mcp.js";

export function registerGeoDiagnosticTools(server: McpServer, client: NotraClient) {
  registerTool(
    server,
    "get_geo_snapshot",
    {
      description:
        "Get a compact GEO diagnosis across visibility, sentiment, scan changes, competitors, content gaps, shelf sources, readiness and AI traffic, with deterministic next actions",
      annotations: { title: "Get GEO Snapshot", readOnlyHint: true },
      inputSchema: getGeoSnapshotSchema,
    },
    ({ projectId, ...window }) => handleError(() => loadGeoSnapshot(client, projectId, window)),
  );

  registerTool(
    server,
    "get_geo_changes",
    {
      description: "Compare the two latest GEO scans and list gained or lost mentions, positions and citations",
      annotations: { title: "Get GEO Changes", readOnlyHint: true },
      inputSchema: getGeoChangesSchema,
    },
    ({ projectId }) => handleError(() => client.getGeoChanges(projectId)),
  );

  registerTool(
    server,
    "get_geo_prompt_history",
    {
      description:
        "Get compact historical checks for one prompt. Use a returned check id with get_geo_prompt_result_detail for the full answer.",
      annotations: { title: "Get GEO Prompt History", readOnlyHint: true },
      inputSchema: getGeoPromptHistorySchema,
    },
    ({ projectId, promptId, scanId }) => handleError(() => client.getGeoPromptHistory(projectId, promptId, scanId)),
  );

  registerTool(
    server,
    "get_geo_sentiment",
    {
      description: "Get aggregate GEO sentiment, engine breakdowns, timeseries and previous-period comparison",
      annotations: { title: "Get GEO Sentiment", readOnlyHint: true },
      inputSchema: getGeoSentimentSchema,
    },
    ({ projectId, ...window }) => handleError(() => client.getGeoSentiment(projectId, window)),
  );

  registerTool(
    server,
    "get_geo_sentiment_analysis",
    {
      description: "Get the stored thematic GEO sentiment analysis without starting a billed analysis run",
      annotations: { title: "Get GEO Sentiment Analysis", readOnlyHint: true },
      inputSchema: getGeoSentimentAnalysisSchema,
    },
    ({ projectId, ...window }) => handleError(() => client.getGeoSentimentAnalysis(projectId, window)),
  );

  registerTool(
    server,
    "list_geo_sentiment_evidence",
    {
      description: "List a bounded page of full answers used as sentiment evidence",
      annotations: { title: "List GEO Sentiment Evidence", readOnlyHint: true },
      inputSchema: listGeoSentimentEvidenceSchema,
    },
    ({ projectId, ...params }) => handleError(() => client.listGeoSentimentEvidence(projectId, params)),
  );

  registerTool(
    server,
    "list_geo_shelf_sources",
    {
      description: "List cited and manually tracked GEO shelf sources, including placements and opportunity state",
      annotations: { title: "List GEO Shelf Sources", readOnlyHint: true },
      inputSchema: listGeoShelfSourcesSchema,
    },
    ({ projectId, ...params }) => handleError(() => client.listGeoShelfSources(projectId, params)),
  );
}
