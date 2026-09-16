import * as z from "zod";
import { geoResourceIdSchema, geoWindowShape, projectIdSchema } from "./geo-fields.js";

export const getGeoSnapshotSchema = z.object({
  projectId: projectIdSchema,
  ...geoWindowShape,
});

export const getGeoChangesSchema = z.object({ projectId: projectIdSchema });

export const getGeoPromptHistorySchema = z.object({
  projectId: projectIdSchema,
  promptId: geoResourceIdSchema,
  scanId: geoResourceIdSchema.optional(),
});

export const getGeoSentimentSchema = z.object({
  projectId: projectIdSchema,
  ...geoWindowShape,
});

export const getGeoSentimentAnalysisSchema = getGeoSentimentSchema;

export const listGeoSentimentEvidenceSchema = z.object({
  projectId: projectIdSchema,
  ...geoWindowShape,
  cursor: z.string().min(1).max(4096).optional(),
});

export const listGeoShelfSourcesSchema = z.object({
  projectId: projectIdSchema,
  offset: z.number().int().min(0).max(100_000).default(0),
  limit: z.number().int().min(1).max(100).default(20),
});
