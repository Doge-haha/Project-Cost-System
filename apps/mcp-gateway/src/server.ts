import { createGatewayApp } from "./app/create-app.js";

export type GatewayServerConfig = {
  host: string;
  port: number;
  jwtSecret: string;
  apiBaseUrl: string;
};

export function parseGatewayServerConfig(
  env: Record<string, string | undefined>,
): GatewayServerConfig {
  const jwtSecret = env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }
  if (jwtSecret.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters long");
  }

  const apiBaseUrl = env.API_BASE_URL?.trim();
  if (!apiBaseUrl) {
    throw new Error("API_BASE_URL is required");
  }

  const host = env.MCP_GATEWAY_HOST?.trim() || "0.0.0.0";
  const portRaw = env.MCP_GATEWAY_PORT?.trim();
  const port =
    portRaw === undefined || portRaw === "" ? 3100 : Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("MCP_GATEWAY_PORT must be a positive integer");
  }

  return {
    host,
    port,
    jwtSecret,
    apiBaseUrl,
  };
}

export async function startGatewayServer(
  env: Record<string, string | undefined> = process.env,
) {
  const config = parseGatewayServerConfig(env);
  const app = createGatewayApp({
    jwtSecret: config.jwtSecret,
    apiBaseUrl: config.apiBaseUrl,
  });

  await app.listen({
    host: config.host,
    port: config.port,
  });

  return {
    app,
    config,
  };
}

async function main() {
  try {
    const { config } = await startGatewayServer(process.env);
    console.log(`mcp-gateway listening on ${config.host}:${config.port}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown mcp gateway failure";
    console.error(message);
    process.exitCode = 1;
  }
}

if (
  typeof process.argv[1] === "string" &&
  /(?:^|[\\/])server\.ts$/.test(process.argv[1])
) {
  void main();
}
