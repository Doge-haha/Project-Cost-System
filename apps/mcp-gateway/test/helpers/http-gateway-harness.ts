import { GatewayApiClient } from "../../src/runtime/api-client.js";
import { createGatewayApp } from "../../src/main.js";
import { gatewayTestJwtSecret } from "./project-seeds.js";

type ApiAppLike = {
  inject: (input: {
    method: string;
    url: string;
    headers?: Record<string, string> | undefined;
    payload?: unknown;
  }) => Promise<{
    body: string;
    statusCode: number;
    headers: Record<string, string>;
  }>;
  close: () => Promise<void>;
};

export function createGatewayApiClient(apiApp: ApiAppLike) {
  return new GatewayApiClient({
    apiBaseUrl: "http://api.local",
    fetchImpl: async (input, init) => {
      const requestUrl =
        typeof input === "string"
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL(input.url);
      const response = await apiApp.inject({
        method: init?.method ?? "GET",
        url: `${requestUrl.pathname}${requestUrl.search}`,
        headers: init?.headers as Record<string, string> | undefined,
        payload: init?.body,
      });

      return new Response(response.body, {
        status: response.statusCode,
        headers: response.headers as HeadersInit,
      });
    },
  });
}

export function createGatewayTestApp(apiApp: ApiAppLike) {
  return createGatewayApp({
    jwtSecret: gatewayTestJwtSecret,
    apiBaseUrl: "http://api.local",
    apiClient: createGatewayApiClient(apiApp),
  });
}
