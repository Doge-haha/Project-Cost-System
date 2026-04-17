import { SignJWT, jwtVerify } from "jose";

import { AppError } from "../errors/app-error.js";

export type AuthenticatedUser = {
  id: string;
  displayName: string;
  roleCodes: string[];
};

type AccessTokenPayload = {
  sub: string;
  displayName: string;
  roleCodes: string[];
};

function createSecret(secret: string): Uint8Array {
  if (secret.length < 16) {
    throw new AppError(
      500,
      "INSECURE_CONFIGURATION",
      "JWT secret must be at least 16 characters long",
    );
  }

  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  secret: string,
): Promise<string> {
  return new SignJWT({
    displayName: payload.displayName,
    roleCodes: payload.roleCodes,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(createSecret(secret));
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AuthenticatedUser> {
  try {
    const { payload } = await jwtVerify(token, createSecret(secret), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.displayName !== "string" ||
      !Array.isArray(payload.roleCodes) ||
      payload.roleCodes.some((item) => typeof item !== "string")
    ) {
      throw new AppError(401, "UNAUTHENTICATED", "Invalid access token");
    }

    return {
      id: payload.sub,
      displayName: payload.displayName,
      roleCodes: payload.roleCodes,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, "UNAUTHENTICATED", "Invalid access token");
  }
}
