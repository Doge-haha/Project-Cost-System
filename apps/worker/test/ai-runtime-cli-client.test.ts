import test from "node:test";
import assert from "node:assert/strict";

import { AiRuntimeCliClient } from "../src/main.js";

test("AiRuntimeCliClient executes python cli and parses structured output", async () => {
  const calls: Array<{
    file: string;
    args: string[];
    input: string | undefined;
  }> = [];
  const client = new AiRuntimeCliClient({
    pythonExecutable: "python3",
    cliPath: "/tmp/ai-runtime-cli.py",
    commandRunner: async (file, args, input) => {
      calls.push({
        file,
        args,
        input,
      });
      return {
        stdout: JSON.stringify({
          runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
          source: "audit_log",
          result: {
            summary: {
              inputCount: 1,
            },
          },
        }),
        stderr: "",
      };
    },
  });

  const result = await client.processEventBatch({
    source: "audit_log",
    events: [{ projectId: "project-001", resourceType: "review_submission" }],
  });

  assert.equal(
    calls[0]?.file,
    "python3",
  );
  assert.deepEqual(calls[0]?.args, ["/tmp/ai-runtime-cli.py"]);
  assert.match(calls[0]?.input ?? "", /"source":"audit_log"/);
  assert.equal(result.runtime, "saas-pricing-ai-runtime:knowledge-memory-agent-runtime");
});

test("AiRuntimeCliClient surfaces stderr as an error", async () => {
  const client = new AiRuntimeCliClient({
    pythonExecutable: "python3",
    cliPath: "/tmp/ai-runtime-cli.py",
    commandRunner: async () => ({
      stdout: "",
      stderr: "events must be a list\n",
    }),
  });

  await assert.rejects(
    () =>
      client.processEventBatch({
        source: "audit_log",
        events: [],
      }),
    /events must be a list/,
  );
});

test("AiRuntimeCliClient sends semantic reference quota task", async () => {
  const calls: Array<{ input: string }> = [];
  const client = new AiRuntimeCliClient({
    pythonExecutable: "python3",
    cliPath: "/tmp/ai-runtime-cli.py",
    commandRunner: async (_file, _args, input) => {
      calls.push({ input });
      return {
        stdout: JSON.stringify({
          source: "reference_quota",
          result: { matchMode: "semantic_text_fallback", items: [] },
        }),
        stderr: "",
      };
    },
  });

  const result = await client.processReferenceQuotaSemanticSearch({
    query: "挖土",
    records: [],
    limit: 3,
  });

  assert.match(calls[0]?.input ?? "", /"task":"reference_quota_semantic_search"/);
  assert.match(calls[0]?.input ?? "", /"query":"挖土"/);
  assert.equal(result.source, "reference_quota");
});

test("AiRuntimeCliClient sends LLM chat task", async () => {
  const calls: Array<{ input: string }> = [];
  const client = new AiRuntimeCliClient({
    pythonExecutable: "python3",
    cliPath: "/tmp/ai-runtime-cli.py",
    commandRunner: async (_file, _args, input) => {
      calls.push({ input });
      return {
        stdout: JSON.stringify({
          source: "llm_provider",
          result: { content: "ok" },
        }),
        stderr: "",
      };
    },
  });

  const result = await client.processLlmChat({
    model: "cost-model",
    messages: [{ role: "user", content: "hello" }],
  });

  assert.match(calls[0]?.input ?? "", /"task":"llm_chat"/);
  assert.match(calls[0]?.input ?? "", /"model":"cost-model"/);
  assert.deepEqual(result.result, { content: "ok" });
});
