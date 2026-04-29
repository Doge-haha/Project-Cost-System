#!/usr/bin/env node
import { spawn } from "node:child_process";
import { SignJWT } from "jose";

const jwtSecret = process.env.JWT_SECRET || "1234567890abcdef";
const apiPort = process.env.API_PORT || "3000";
const gatewayPort = process.env.MCP_GATEWAY_PORT || "3100";
const frontendPort = process.env.FRONTEND_PORT || "5173";
const apiBaseUrl = process.env.API_BASE_URL || `http://localhost:${apiPort}`;

const token = await new SignJWT({
  displayName: "本地演示 Owner",
  roleCodes: ["project_owner", "system_admin"],
})
  .setProtectedHeader({ alg: "HS256" })
  .setSubject("user-001")
  .setIssuedAt()
  .setExpirationTime("8h")
  .sign(new TextEncoder().encode(jwtSecret));

const processes = [
  start("api", "npm", ["--workspace", "@saas-pricing/api", "run", "start"], {
    APP_STORAGE_MODE: "memory",
    APP_DEMO_SEED: "1",
    API_PORT: apiPort,
    JWT_SECRET: jwtSecret,
  }),
  start(
    "mcp",
    "npm",
    ["--workspace", "@saas-pricing/mcp-gateway", "run", "start"],
    {
      API_BASE_URL: apiBaseUrl,
      MCP_GATEWAY_PORT: gatewayPort,
      JWT_SECRET: jwtSecret,
    },
  ),
  start("worker", "npm", ["--workspace", "@saas-pricing/worker", "run", "start"], {
    API_BASE_URL: apiBaseUrl,
    WORKER_TOKEN: token,
    POLL_INTERVAL_MS: "1500",
  }),
  start(
    "web",
    "npm",
    [
      "--workspace",
      "saas-pricing-frontend",
      "run",
      "dev",
      "--",
      "--host",
      "0.0.0.0",
      "--port",
      frontendPort,
    ],
    {
      VITE_API_BASE_URL: apiBaseUrl,
      VITE_API_BEARER_TOKEN: token,
    },
  ),
];

console.log(`local web: http://localhost:${frontendPort}`);
console.log(`local api: ${apiBaseUrl}`);
console.log(`demo token: ${token}`);

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}

function start(label, command, args, env) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => write(label, chunk));
  child.stderr.on("data", (chunk) => write(label, chunk));
  child.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[${label}] exited code=${code} signal=${signal ?? ""}`);
      shutdown("child-exit");
    }
  });

  return child;
}

function write(label, chunk) {
  for (const line of String(chunk).split(/\r?\n/)) {
    if (line.trim()) {
      console.log(`[${label}] ${line}`);
    }
  }
}

function shutdown(reason) {
  shuttingDown = true;
  console.log(`stopping local dev (${reason})`);
  for (const child of processes) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}
