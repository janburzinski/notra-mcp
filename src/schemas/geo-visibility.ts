import * as z from "zod";
import { geoResourceIdSchema, geoShortTextSchema, geoWindowShape, projectIdSchema } from "./geo-fields.js";

export const getGeoVisibilityOverviewSchema = z.object({
  projectId: projectIdSchema,
  ...geoWindowShape,
});

export const getGeoVisibilityTimeseriesSchema = z.object({
  projectId: projectIdSchema,
  ...geoWindowShape,
});

export const getGeoPromptResultsSchema = z.object({
  projectId: projectIdSchema,
  ...geoWindowShape,
});

export const listGeoPromptResultSummariesSchema = z.object({
  projectId: projectIdSchema,
  ...geoWindowShape,
  cursor: z.string().regex(/^\d+$/).optional().describe("Cursor returned by the previous page"),
  limit: z.number().int().min(1).max(100).default(20),
  engine: geoShortTextSchema.optional(),
  mentioned: z.boolean().optional(),
  query: z.string().trim().min(1).max(300).optional(),
});

export const getGeoPromptResultDetailSchema = z.object({
  projectId: projectIdSchema,
  checkId: geoResourceIdSchema.describe("Check ID returned by a prompt summary or history row"),
});

export const getGeoCompetitorShareSchema = z.object({
  projectId: projectIdSchema,
  ...geoWindowShape,
});

export const getGeoLanguageShareSchema = z.object({
  projectId: projectIdSchema,
  ...geoWindowShape,
});

export const getGeoCompetitorDetailSchema = z.object({
  projectId: projectIdSchema,
  brand: geoShortTextSchema.describe("Competitor brand name as reported by get_geo_competitor_share"),
  ...geoWindowShape,
});
