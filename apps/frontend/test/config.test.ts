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
