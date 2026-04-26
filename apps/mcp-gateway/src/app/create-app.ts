import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { GatewayApiClient } from "../runtime/api-client.js";
import {
  extractBearerToken,
  verifyAccessToken,
  type AuthenticatedUser,
} from "../shared/auth.js";
import { isAppError } from "../shared/app-error.js";
import { RESOURCE_DEFINITIONS, TOOL_DEFINITIONS } from "./capabilities.js";
import { registerResourceRoutes } from "./register-resource-routes.js";
import { registerToolRoutes } from "./register-tool-routes.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
    bearerToken?: string;
  }
}

export type CreateGatewayAppOptions = {
  jwtSecret: string;
  apiBaseUrl: string;
  apiClient?: GatewayApiClient;
};

export function createGatewayApp(
  options: CreateGatewayAppOptions,
): FastifyInstance {
  const app = Fastify();
  const apiClient =
    options.apiClient ?? new GatewayApiClient({ apiBaseUrl: options.apiBaseUrl });

  app.addHook("onRequest", async (request) => {
    if (request.url === "/health") {
      return;
    }

    const bearerToken = extractBearerToken(request.headers.authorization);
    request.bearerToken = bearerToken;
    request.currentUser = await verifyAccessToken(bearerToken, options.jwtSecret);
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.issues,
        },
      });
      return;
    }

    if (isAppError(error)) {
      reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected gateway error",
      },
    });
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/v1/capabilities", async () => ({
    type: "capabilities",
    resources: RESOURCE_DEFINITIONS,
    tools: TOOL_DEFINITIONS,
  }));

  registerResourceRoutes(app, {
    apiClient,
  });

  registerToolRoutes(app, {
    apiClient,
  });

  return app;
}
