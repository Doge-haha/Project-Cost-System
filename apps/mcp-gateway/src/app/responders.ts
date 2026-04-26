export function resourceEnvelope(input: {
  resourceType: string;
  scope: Record<string, unknown>;
  data: Record<string, unknown>;
}) {
  return {
    type: "resource",
    resourceType: input.resourceType,
    scope: input.scope,
    data: input.data,
  } as const;
}

export function toolEnvelope(input: {
  tool: string;
  mode: "accepted" | "synchronous";
  target: Record<string, unknown>;
  result: Record<string, unknown>;
  execution?: {
    kind: "async_job";
    jobId: string;
    statusResource: {
      resourceType: "job_status";
      query: {
        jobId: string;
      };
    };
  };
  related?: Record<string, unknown> | null;
}) {
  return {
    type: "tool_result",
    tool: input.tool,
    mode: input.mode,
    target: input.target,
    result: input.result,
    execution: input.execution ?? null,
    related: input.related ?? null,
  } as const;
}
