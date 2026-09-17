import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import type { JsonSchemaConverter, JsonSchemaOptions } from "../types/json-schema.js";
import { deepFreeze } from "./deep-freeze.js";

const cachedSchemas = new WeakSet<object>();

/**
 * The SDK converts a tool's zod schema to JSON Schema on every registration and
 * every `tools/list`, and HTTP builds a server per request. Tool schemas are
 * module-level constants, so convert each one once per process. The result is
 * frozen because every server shares it, and `$schema` is dropped because MCP
 * already defaults tool schemas to draft 2020-12.
 */
export function cacheJsonSchema<S extends StandardSchemaWithJSON>(schema: S): S {
  if (cachedSchemas.has(schema)) {
    return schema;
  }

  const standard = schema["~standard"];
  const converted = new Map<string, Record<string, unknown>>();
  const convert =
    (io: keyof JsonSchemaConverter) =>
    (options: JsonSchemaOptions): Record<string, unknown> => {
      const key = `${io}:${options.target}`;
      let json = converted.get(key);
      if (!json) {
        const { $schema: _, ...rest } = standard.jsonSchema[io](options);
        json = deepFreeze(rest);
        converted.set(key, json);
      }
      return json;
    };

  Object.defineProperty(schema, "~standard", {
    value: { ...standard, jsonSchema: { input: convert("input"), output: convert("output") } },
    configurable: true,
    writable: true,
  });
  cachedSchemas.add(schema);
  return schema;
}
