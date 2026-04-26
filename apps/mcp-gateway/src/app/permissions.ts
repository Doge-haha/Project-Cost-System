import type { AuthenticatedUser } from "../shared/auth.js";
import { AppError } from "../shared/app-error.js";

export function assertCanInvokeWriteTool(user: AuthenticatedUser): void {
  const allowedRoles = new Set(["system_admin", "project_owner", "cost_engineer"]);
  if (user.roleCodes.some((roleCode) => allowedRoles.has(roleCode))) {
    return;
  }

  throw new AppError(
    403,
    "FORBIDDEN",
    "Current user cannot invoke gateway write tools",
  );
}

export function assertCanPreviewKnowledgeTool(user: AuthenticatedUser): void {
  const allowedRoles = new Set(["system_admin", "project_owner"]);
  if (user.roleCodes.some((roleCode) => allowedRoles.has(roleCode))) {
    return;
  }

  throw new AppError(
    403,
    "FORBIDDEN",
    "Current user cannot preview knowledge extraction",
  );
}

export function assertCanInvokeWorkflowTool(user: AuthenticatedUser): void {
  const allowedRoles = new Set([
    "system_admin",
    "project_owner",
    "cost_engineer",
    "reviewer",
  ]);
  if (user.roleCodes.some((roleCode) => allowedRoles.has(roleCode))) {
    return;
  }

  throw new AppError(
    403,
    "FORBIDDEN",
    "Current user cannot invoke gateway workflow tools",
  );
}
