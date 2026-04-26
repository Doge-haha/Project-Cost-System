export type RuntimeConfig = {
  apiBaseUrl: string;
  apiBearerToken?: string;
};

function readEnv(name: string): string | undefined {
  const value = import.meta.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

const defaultConfig: RuntimeConfig = {
  apiBaseUrl: readEnv("VITE_API_BASE_URL") ?? "http://localhost:3000",
  apiBearerToken: readEnv("VITE_API_BEARER_TOKEN"),
};

const storageKey = "saas-pricing-frontend.runtime-config";
const listeners = new Set<(config: RuntimeConfig) => void>();

function normalizeConfig(input: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    apiBaseUrl: input.apiBaseUrl?.trim() || defaultConfig.apiBaseUrl,
    apiBearerToken: input.apiBearerToken?.trim() || undefined,
  };
}

function readStoredConfig(): RuntimeConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) {
    return null;
  }

  try {
    return normalizeConfig(JSON.parse(rawValue) as Partial<RuntimeConfig>);
  } catch {
    return null;
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  return readStoredConfig() ?? defaultConfig;
}

export function saveRuntimeConfig(input: RuntimeConfig): RuntimeConfig {
  const normalized = normalizeConfig(input);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(normalized));
  }
  listeners.forEach((listener) => {
    listener(normalized);
  });
  return normalized;
}

export function resetRuntimeConfig() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(storageKey);
  }
  listeners.forEach((listener) => {
    listener(defaultConfig);
  });
}

export function onRuntimeConfigChange(listener: (config: RuntimeConfig) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const appConfig = defaultConfig;
