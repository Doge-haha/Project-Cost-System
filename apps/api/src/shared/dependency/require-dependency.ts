import { AppError } from "../errors/app-error.js";

export function requireDependency<T>(
  dependency: T | null | undefined,
  name: string,
): T {
  if (dependency == null) {
    throw new AppError(
      500,
      "MISSING_DEPENDENCY",
      `Missing required dependency: ${name}`,
    );
  }

  return dependency;
}
