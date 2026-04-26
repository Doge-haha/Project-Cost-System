import { createApp } from "./app/create-app.js";
import { createRuntimeAppOptions } from "./app/create-runtime-app-options.js";
import type { CreateAppOptions } from "./app/create-app-options.js";

export type ApiServerConfig = {
  host: string;
  port: number;
  jwtSecret: string;
};

export function parseApiServerConfig(
  env: Record<string, string | undefined>,
): ApiServerConfig {
  const jwtSecret = env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }
  if (jwtSecret.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters long");
  }

  const host = env.API_HOST?.trim() || "0.0.0.0";
  const portRaw = env.API_PORT?.trim();
  const port =
    portRaw === undefined || portRaw === "" ? 3000 : Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("API_PORT must be a positive integer");
  }

  return {
    host,
    port,
    jwtSecret,
  };
}

export async function startApiServer(
  env: Record<string, string | undefined> = process.env,
  dependencies: {
    createApp?: (options: CreateAppOptions) => {
      addHook: (name: string, handler: () => Promise<void>) => void;
      listen: (input: { host: string; port: number }) => Promise<unknown>;
    };
    createRuntimeAppOptions?: typeof createRuntimeAppOptions;
  } = {},
) {
  const config = parseApiServerConfig(env);
  const runtimeOptions =
    dependencies.createRuntimeAppOptions?.(env) ?? createRuntimeAppOptions(env);
  const app = (dependencies.createApp ?? createApp)({
    jwtSecret: config.jwtSecret,
    ...runtimeOptions.appOptions,
  });
  if (runtimeOptions.close) {
    app.addHook("onClose", async () => {
      await runtimeOptions.close!();
    });
  }

  await app.listen({
    host: config.host,
    port: config.port,
  });

  return {
    app,
    config,
    runtimeMode: runtimeOptions.mode,
  };
}

async function main() {
  try {
    const { config, runtimeMode } = await startApiServer(process.env);
    console.log(`api listening on ${config.host}:${config.port} mode=${runtimeMode}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown api server failure";
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
