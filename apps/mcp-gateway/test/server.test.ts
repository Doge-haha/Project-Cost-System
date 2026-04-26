import test from "node:test";
import assert from "node:assert/strict";

import { parseGatewayServerConfig } from "../src/server.js";

test("parseGatewayServerConfig requires JWT_SECRET", () => {
  assert.throws(
    () =>
      parseGatewayServerConfig({
        JWT_SECRET: undefined,
        API_BASE_URL: "http://localhost:3000",
      }),
    /JWT_SECRET is required/,
  );
});

test("parseGatewayServerConfig requires API_BASE_URL", () => {
  assert.throws(
    () =>
      parseGatewayServerConfig({
        JWT_SECRET: "1234567890abcdef",
      }),
    /API_BASE_URL is required/,
  );
});

test("parseGatewayServerConfig applies defaults", () => {
  assert.deepEqual(
    parseGatewayServerConfig({
      JWT_SECRET: "1234567890abcdef",
      API_BASE_URL: "http://localhost:3000",
    }),
    {
      host: "0.0.0.0",
      port: 3100,
      jwtSecret: "1234567890abcdef",
      apiBaseUrl: "http://localhost:3000",
    },
  );
});

test("parseGatewayServerConfig rejects insecure JWT secret values", () => {
  assert.throws(
    () =>
      parseGatewayServerConfig({
        JWT_SECRET: "short-secret",
        API_BASE_URL: "http://localhost:3000",
      }),
    /JWT_SECRET must be at least 16 characters long/,
  );
});

test("parseGatewayServerConfig parses explicit host and port", () => {
  assert.deepEqual(
    parseGatewayServerConfig({
      JWT_SECRET: "1234567890abcdef",
      API_BASE_URL: "http://localhost:3000",
      MCP_GATEWAY_HOST: "127.0.0.1",
      MCP_GATEWAY_PORT: "3200",
    }),
    {
      host: "127.0.0.1",
      port: 3200,
      jwtSecret: "1234567890abcdef",
      apiBaseUrl: "http://localhost:3000",
    },
  );
});
