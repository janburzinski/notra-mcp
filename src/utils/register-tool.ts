import type {
  Icon,
  McpServer,
  RegisteredTool,
  StandardSchemaWithJSON,
  ToolAnnotations,
  ToolCallback,
} from "@modelcontextprotocol/server";
import type { ToolHandlerContext } from "../types/server.js";
import { shareJsonSchema } from "./json-schema-cache.js";
import { runWithRequestSignal } from "./request-signal.js";

type ToolRegistrationConfig<
  InputArgs extends StandardSchemaWithJSON | undefined,
  OutputArgs extends StandardSchemaWithJSON,
> = {
  title?: string;
  description?: string;
  inputSchema?: InputArgs;
  outputSchema?: OutputArgs;
  annotations?: ToolAnnotations;
  icons?: Icon[];
  _meta?: Record<string, unknown>;
};

/**
 * Registers a tool with the behavior every Notra tool shares: JSON Schemas are
 * converted once per process instead of per server (tool schemas are module-level
 * constants, so `shareJsonSchema` memoizes them), and the handler runs with the
 * MCP request's cancellation signal in AsyncLocalStorage so its Notra API calls
 * stop when the client cancels or disconnects. The signature mirrors
 * `McpServer.registerTool` so argument types keep flowing from the schemas.
 */
export function registerTool<
  InputArgs extends StandardSchemaWithJSON | undefined = undefined,
  OutputArgs extends StandardSchemaWithJSON = StandardSchemaWithJSON,
>(
  server: McpServer,
  name: string,
  config: ToolRegistrationConfig<InputArgs, OutputArgs>,
  handler: ToolCallback<InputArgs>,
): RegisteredTool {
  const wrappedHandler = ((...callArgs: unknown[]) => {
    // Handlers receive (args, ctx), or only (ctx) when a tool has no input schema.
    const ctx = callArgs.at(-1) as ToolHandlerContext | undefined;
    return runWithRequestSignal(ctx?.mcpReq?.signal, () => (handler as (...args: unknown[]) => unknown)(...callArgs));
  }) as ToolCallback<InputArgs>;

  return server.registerTool(
    name,
    {
      ...config,
      ...(config.inputSchema && { inputSchema: shareJsonSchema(config.inputSchema) }),
      ...(config.outputSchema && { outputSchema: shareJsonSchema(config.outputSchema) }),
    },
    wrappedHandler,
  );
}
