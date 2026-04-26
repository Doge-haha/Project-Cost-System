import type { WorkerProcessorResult } from "./contracts.js";
import { AiRuntimeCliClient } from "../runtime/ai-runtime-cli-client.js";

export async function processKnowledgeExtractionPreview(
  input: {
    source: string;
    events: Array<Record<string, unknown>>;
  },
  dependencies: {
    aiRuntimeClient: AiRuntimeCliClient;
  },
): Promise<WorkerProcessorResult> {
  const result = await dependencies.aiRuntimeClient.processEventBatch({
    source: input.source,
    events: input.events,
  });

  return {
    status: "completed",
    result,
  };
}
