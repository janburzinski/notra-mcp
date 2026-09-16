import type { Organization } from "./api.js";

export interface GeoShelfListResponse {
  sources: Array<{
    id: string;
    url: string;
    domain: string;
    title: string | null;
    kind: "listicle" | "review_site" | "community" | "news" | "docs" | "video" | "other";
    ownership: "third_party" | "own" | "competitor";
    origin: "scan" | "manual";
    fetchStatus: "pending" | "ok" | "blocked" | "failed";
    lastFetchedAt: string | null;
    citations: {
      windowCount: number;
      totalCount: number;
      promptCount: number;
      engines: string[];
      firstCitedAt: string | null;
      lastCitedAt: string | null;
    };
    placements: Array<{
      competitorId: string | null;
      brandName: string;
      brandDomain: string | null;
      status: "present" | "absent" | "unknown";
      position: number | null;
      hasLink: boolean;
      evidence: "fetch" | "scan" | "manual";
      excerpt: string | null;
      checkedAt: string;
    }>;
    opportunity: Record<string, unknown> | null;
    createdByUserId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  nextOffset: number | null;
  organization: Organization;
}
