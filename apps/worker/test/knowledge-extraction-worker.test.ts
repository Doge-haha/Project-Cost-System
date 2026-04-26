import test from "node:test";
import assert from "node:assert/strict";

import {
  AiRuntimeCliClient,
  processKnowledgeExtractionPreview,
} from "../src/main.js";

test("processKnowledgeExtractionPreview returns completed result from ai runtime", async () => {
  const aiRuntimeClient = new AiRuntimeCliClient({
    pythonExecutable: "python3",
    cliPath: "/tmp/ai-runtime-cli.py",
    commandRunner: async () => ({
      stdout: JSON.stringify({
        runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
        result: {
          summary: {
            knowledgeCount: 1,
          },
        },
      }),
      stderr: "",
    }),
  });

  const result = await processKnowledgeExtractionPreview(
    {
      source: "audit_log",
      events: [{ projectId: "project-001", resourceType: "review_submission" }],
    },
    {
      aiRuntimeClient,
    },
  );

  assert.equal(result.status, "completed");
  assert.deepEqual(result.result, {
    runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
    result: {
      summary: {
        knowledgeCount: 1,
      },
    },
  });
});
