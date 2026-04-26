import test from "node:test";
import assert from "node:assert/strict";

import { createGatewayTestApp } from "./helpers/http-gateway-harness.js";
import {
  createGatewayTestApiApp,
  createGatewayTestToken,
} from "./helpers/project-seeds.js";

test("preview-knowledge-extraction returns synchronous API result over HTTP", async () => {
  const apiApp = createGatewayTestApiApp({
    appOptions: {
      aiRuntimePreviewService: {
        processEventBatch: async (input: {
          source: string;
          events: Array<Record<string, unknown>>;
        }) => ({
          runtime: "test-runtime",
          source: input.source,
          result: {
            summary: {
              eventCount: input.events.length,
              knowledgeCount: 1,
              memoryCount: 1,
            },
          },
        }),
      } as never,
    },
  });
  const gatewayApp = createGatewayTestApp(apiApp);
  const token = await createGatewayTestToken();

  try {
    const response = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/preview-knowledge-extraction",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        source: "audit_log",
        events: [
          {
            projectId: "project-001",
            resourceType: "review_submission",
            action: "reject",
          },
        ],
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().type, "tool_result");
    assert.equal(response.json().tool, "preview_knowledge_extraction");
    assert.equal(response.json().mode, "synchronous");
    assert.deepEqual(response.json().target, {
      source: "audit_log",
      eventCount: 1,
    });
    assert.deepEqual(response.json().result, {
      runtime: "test-runtime",
      source: "audit_log",
      result: {
        summary: {
          eventCount: 1,
          knowledgeCount: 1,
          memoryCount: 1,
        },
      },
    });
    assert.equal(response.json().execution, null);
  } finally {
    await gatewayApp.close();
    await apiApp.close();
  }
});
