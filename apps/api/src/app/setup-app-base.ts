import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { verifyAccessToken } from "../shared/auth/jwt.js";
import { AppError, isAppError } from "../shared/errors/app-error.js";

export function extractBearerToken(authorizationHeader?: string): string {
  if (!authorizationHeader) {
    throw new AppError(401, "UNAUTHENTICATED", "Missing bearer token");
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "UNAUTHENTICATED", "Missing bearer token");
  }

  return token;
}

export function setupAppBase(
  app: FastifyInstance,
  input: { jwtSecret: string },
) {
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("access-control-allow-origin", "*");
    reply.header(
      "access-control-allow-headers",
      "authorization, content-type",
    );
    reply.header(
      "access-control-allow-methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
  });

  app.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
      return;
    }

    if (error instanceof ZodError) {
      reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
      return;
    }

    app.log.error(error);
    reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    });
  });

  app.decorateRequest("currentUser", undefined);

  app.get("/health", async () => ({
    ok: true,
    service: "@saas-pricing/api",
    status: "up",
    checkedAt: new Date().toISOString(),
  }));

  app.options("/*", async (_request, reply) => reply.status(204).send());

  app.addHook("preHandler", async (request) => {
    if (request.method === "OPTIONS") {
      return;
    }
    if (!request.url.startsWith("/v1/")) {
      return;
    }

    const token = extractBearerToken(request.headers.authorization);
    request.currentUser = await verifyAccessToken(token, input.jwtSecret);
  });

  app.get("/v1/me", async (request) => {
    if (!request.currentUser) {
      throw new AppError(401, "UNAUTHENTICATED", "Missing authenticated user");
    }

    return request.currentUser;
  });
}
