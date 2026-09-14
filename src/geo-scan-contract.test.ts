import { afterEach, describe, expect, test, vi } from "vitest";

import { NotraClient } from "./notra-client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GEO scan contract", () => {
  test("preserves scan summaries and safe failure metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          scan: {
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
          },
          organization: {
            id: "org-1",
            slug: "example",
            name: "Example",
            logo: null,
          },
        }),
      ),
    );

    const response = await new NotraClient("token", "https://api.example.com").getGeoScan("project-1", "scan-1");

    expect(response.scan.summary).toEqual({
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
    });
    expect(response.scan).toMatchObject({
      errorCode: "geo_scan_error",
      errorMessage: "The scan could not be completed.",
      failedStage: "execution",
      retryable: null,
    });
  });
});
