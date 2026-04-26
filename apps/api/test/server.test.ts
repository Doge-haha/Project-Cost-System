import test from "node:test";
import assert from "node:assert/strict";

import { parseApiServerConfig, startApiServer } from "../src/server.js";

test("parseApiServerConfig requires JWT_SECRET", () => {
  assert.throws(
    () =>
      parseApiServerConfig({
        JWT_SECRET: undefined,
      }),
    /JWT_SECRET is required/,
  );
});

test("parseApiServerConfig applies defaults", () => {
  assert.deepEqual(
    parseApiServerConfig({
      JWT_SECRET: "1234567890abcdef",
    }),
    {
      host: "0.0.0.0",
      port: 3000,
      jwtSecret: "1234567890abcdef",
    },
  );
});

test("parseApiServerConfig rejects insecure JWT_SECRET values", () => {
  assert.throws(
    () =>
      parseApiServerConfig({
        JWT_SECRET: "short-secret",
      }),
    /JWT_SECRET must be at least 16 characters long/,
  );
});

test("parseApiServerConfig parses explicit host and port", () => {
  assert.deepEqual(
    parseApiServerConfig({
      JWT_SECRET: "1234567890abcdef",
      API_HOST: "127.0.0.1",
      API_PORT: "3100",
    }),
    {
      host: "127.0.0.1",
      port: 3100,
      jwtSecret: "1234567890abcdef",
    },
  );
});

test("parseApiServerConfig rejects invalid API_PORT", () => {
  assert.throws(
    () =>
      parseApiServerConfig({
        JWT_SECRET: "1234567890abcdef",
        API_PORT: "0",
      }),
    /API_PORT must be a positive integer/,
  );
});

test("startApiServer reports memory runtime mode", async () => {
  const calls: Array<Record<string, unknown>> = [];

  const result = await startApiServer(
    {
      JWT_SECRET: "1234567890abcdef",
      API_HOST: "127.0.0.1",
      API_PORT: "3001",
    },
    {
      createRuntimeAppOptions: () => ({
        mode: "memory",
        appOptions: {
          transactionRunner: {} as never,
        },
      }),
      createApp: (options) => {
        calls.push({ createApp: options });
        return {
          addHook: () => undefined,
          listen: async (config: Record<string, unknown>) => {
            calls.push({ listen: config });
          },
        } as never;
      },
    },
  );

  assert.equal(result.runtimeMode, "memory");
  assert.deepEqual(calls, [
    {
      createApp: {
        jwtSecret: "1234567890abcdef",
        transactionRunner: {},
      },
    },
    {
      listen: {
        host: "127.0.0.1",
        port: 3001,
      },
    },
  ]);
});

test("startApiServer wires database runtime close hook when database mode is selected", async () => {
  const calls: string[] = [];
  let registeredCloseHook: (() => Promise<void>) | null = null;

  const result = await startApiServer(
    {
      JWT_SECRET: "1234567890abcdef",
    },
    {
      createRuntimeAppOptions: () => ({
        mode: "database",
        appOptions: {
          transactionRunner: {} as never,
        },
        close: async () => {
          calls.push("close");
        },
      }),
      createApp: () =>
        ({
          addHook: (_name: string, handler: () => Promise<void>) => {
            registeredCloseHook = handler;
          },
          listen: async () => {
            calls.push("listen");
          },
        }) as never,
    },
  );

  assert.equal(result.runtimeMode, "database");
  assert.ok(registeredCloseHook);
  await registeredCloseHook?.();
  assert.deepEqual(calls, ["listen", "close"]);
});
