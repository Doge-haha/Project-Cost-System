import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  getRuntimeConfig,
  onRuntimeConfigChange,
  resetRuntimeConfig,
  saveRuntimeConfig,
} from "../src/lib/config";

describe("runtime config", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetRuntimeConfig();
  });

  test("uses env defaults when local overrides are absent", () => {
    expect(getRuntimeConfig()).toEqual({
      apiBaseUrl: "http://localhost:3000",
      apiBearerToken: undefined,
    });
  });

  test("persists and returns local overrides", () => {
    saveRuntimeConfig({
      apiBaseUrl: "http://localhost:3100",
      apiBearerToken: "token-123",
    });

    expect(getRuntimeConfig()).toEqual({
      apiBaseUrl: "http://localhost:3100",
      apiBearerToken: "token-123",
    });
  });

  test("ignores stale localhost defaults when env config is explicit", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:3300");
    window.localStorage.setItem(
      "saas-pricing-frontend.runtime-config",
      JSON.stringify({
        apiBaseUrl: "http://localhost:3000",
        apiBearerToken: "stale-token",
      }),
    );

    const { getRuntimeConfig: readFreshConfig } = await import("../src/lib/config");

    expect(readFreshConfig()).toEqual({
      apiBaseUrl: "http://127.0.0.1:3300",
      apiBearerToken: undefined,
    });
  });

  test("ignores stored overrides after env defaults change", async () => {
    saveRuntimeConfig({
      apiBaseUrl: "http://localhost:3000",
      apiBearerToken: "stale-token",
    });
    vi.resetModules();
    vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:3300");
    vi.stubEnv("VITE_API_BEARER_TOKEN", "fresh-token");

    const { getRuntimeConfig: readFreshConfig } = await import("../src/lib/config");

    expect(readFreshConfig()).toEqual({
      apiBaseUrl: "http://127.0.0.1:3300",
      apiBearerToken: "fresh-token",
    });
  });

  test("notifies subscribers after saving runtime config", () => {
    const listener = vi.fn();
    const stop = onRuntimeConfigChange(listener);
    saveRuntimeConfig({
      apiBaseUrl: "http://localhost:3200",
      apiBearerToken: "token-456",
    });

    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });
});
