import assert from "node:assert/strict";
import { test, vi } from "vitest";

import { NotraClient } from "../src/notra-client.ts";

const organization = {
  id: "org-1",
  slug: "example",
  name: "Example",
  logo: null,
};

const scan = {
  id: "scan-1",
  projectId: "project-1",
  status: "failed",
  startedAt: "2026-09-14T10:00:00.000Z",
  finishedAt: "2026-09-14T10:01:00.000Z",
  createdAt: "2026-09-14T10:00:00.000Z",
  summary: {
    plannedChecks: 2,
    completedChecks: 1,
    mentionCount: 1,
    failedChecks: 1,
    engines: [
      {
        engine: "openai/gpt-5",
        plannedChecks: 2,
        completedChecks: 1,
        mentionCount: 1,
        failedChecks: 1,
      },
    ],
  },
  errorCode: "geo_scan_error",
  errorMessage: "The scan could not be completed.",
  failedStage: "execution",
  retryable: null,
};

test("getGeoScan preserves summaries and safe failure metadata", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ scan, organization }));

  const response = await new NotraClient("token", "https://api.example.com").getGeoScan("project-1", "scan-1");

  assert.deepEqual(response.scan, scan);
});

test("listGeoScans preserves summaries and safe failure metadata", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      scans: [scan],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      organization,
    }),
  );

  const response = await new NotraClient("token", "https://api.example.com").listGeoScans("project-1", {
    page: 1,
    limit: 20,
  });

  assert.deepEqual(response.scans, [scan]);
});
