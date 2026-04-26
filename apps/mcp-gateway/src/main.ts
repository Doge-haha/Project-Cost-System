export const mcpGatewayDescriptor = {
  name: "@saas-pricing/mcp-gateway",
  role: "mcp-gateway",
  capabilities: [
    "resource",
    "tool",
    "context-aggregation",
    "permission-trimming"
  ]
} as const;

export function describeMcpGateway(): string {
  return `${mcpGatewayDescriptor.name}:${mcpGatewayDescriptor.role}`;
}

export * from "./app/create-app.js";
export * from "./runtime/api-client.js";
export * from "./shared/auth.js";
export * from "./shared/app-error.js";
