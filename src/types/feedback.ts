import type { FEEDBACK_KIND_VALUES, FEEDBACK_STATUS_VALUES } from "../constants/feedback.js";
import type { Pagination } from "./api.js";

export type FeedbackStatus = (typeof FEEDBACK_STATUS_VALUES)[number];
export type FeedbackKind = (typeof FEEDBACK_KIND_VALUES)[number];

export interface FeedbackEntry {
  id: string;
  projectId: string | null;
  source: "mcp" | "api" | "sdk";
  kind: FeedbackKind;
  sentiment: "negative" | "neutral" | "positive" | "";
  status: FeedbackStatus;
  title: string | null;
  message: string;
  agentClient: string | null;
  agentModel: string | null;
  toolVersion: string | null;
  userAgent: string | null;
  contextUrl: string | null;
  externalId: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown> | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListFeedbackParams {
  status?: FeedbackStatus;
  kind?: FeedbackKind;
  projectId?: string;
  limit?: number;
  page?: number;
}

export interface FeedbackListResponse {
  feedback: FeedbackEntry[];
  pagination: Pagination;
}

export interface FeedbackResponse {
  feedback: FeedbackEntry;
}

export interface UpdateFeedbackRequest {
  status: FeedbackStatus;
}
