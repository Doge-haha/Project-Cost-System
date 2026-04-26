import type { CreateAppOptions } from "./create-app-options.js";
import { createDatabaseAppOptions } from "../infrastructure/database/create-database-app-options.js";

export function createRuntimeAppOptions(
  env: Record<string, string | undefined>,
): {
  mode: "memory" | "database";
  appOptions: Partial<CreateAppOptions>;
  close?: () => Promise<void>;
} {
  const storageMode = env.APP_STORAGE_MODE?.trim();
  if (
    storageMode !== undefined &&
    storageMode !== "" &&
    storageMode !== "memory" &&
    storageMode !== "database"
  ) {
    throw new Error("APP_STORAGE_MODE must be one of: memory, database");
  }

  if (storageMode === "memory") {
    return {
      mode: "memory",
      appOptions: {
        appRuntimeMode: "memory",
      },
    };
  }

  if (storageMode === "database") {
    if (!env.DATABASE_URL || env.DATABASE_URL.trim() === "") {
      throw new Error("DATABASE_URL is required when APP_STORAGE_MODE=database");
    }
    return {
      mode: "database",
      ...createDatabaseAppOptions(env),
    };
  }

  if (env.DATABASE_URL && env.DATABASE_URL.trim() !== "") {
    return {
      mode: "database",
      ...createDatabaseAppOptions(env),
    };
  }

  return {
    mode: "memory",
    appOptions: {
      appRuntimeMode: "memory",
    },
  };
}
