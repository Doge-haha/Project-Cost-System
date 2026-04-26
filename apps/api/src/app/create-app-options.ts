import type { AuthenticatedUser } from "../shared/auth/jwt.js";
import type { CreateAppDependenciesOptions } from "./create-app-dependencies.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
  }
}

export type CreateAppOptions = CreateAppDependenciesOptions & {
  appRuntimeMode?: "memory" | "database";
  jwtSecret: string;
};
