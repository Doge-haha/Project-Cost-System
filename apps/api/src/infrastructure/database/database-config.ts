export type DatabaseSslMode = "disable" | "require";

export type DatabaseConfig = {
  url: string;
  maxConnections: number;
  sslMode: DatabaseSslMode;
};

export function parseDatabaseConfig(
  env: Record<string, string | undefined>,
): DatabaseConfig {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const maxConnectionsRaw = env.DATABASE_MAX_CONNECTIONS?.trim();
  const maxConnections =
    maxConnectionsRaw === undefined || maxConnectionsRaw === ""
      ? 10
      : Number.parseInt(maxConnectionsRaw, 10);
  if (!Number.isInteger(maxConnections) || maxConnections <= 0) {
    throw new Error("DATABASE_MAX_CONNECTIONS must be a positive integer");
  }

  const sslModeRaw = env.DATABASE_SSL_MODE?.trim() ?? "disable";
  if (sslModeRaw !== "disable" && sslModeRaw !== "require") {
    throw new Error("DATABASE_SSL_MODE must be one of: disable, require");
  }

  return {
    url,
    maxConnections,
    sslMode: sslModeRaw,
  };
}
