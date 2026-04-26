type Dependencies = {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
};

export class WorkerPlatformRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = "WorkerPlatformRequestError";
  }
}

type SummaryInput = {
  projectId: string;
  stageCode?: string;
  disciplineCode?: string;
  userId: string;
};

type VarianceInput = SummaryInput & {
  limit?: number;
};

type RecalculateInput = SummaryInput & {
  priceVersionId?: string;
  feeTemplateId?: string;
};

export class ApiWorkerPlatformClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly dependencies: Dependencies) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async fetchSummary(input: SummaryInput): Promise<Record<string, unknown>> {
    const query = this.buildQuery({
      projectId: input.projectId,
      stageCode: input.stageCode,
      disciplineCode: input.disciplineCode,
    });

    return this.requestJson(
      `${this.dependencies.baseUrl}/v1/reports/summary?${query.toString()}`,
    );
  }

  async fetchVariance(input: VarianceInput): Promise<Record<string, unknown>> {
    const query = this.buildQuery({
      projectId: input.projectId,
      stageCode: input.stageCode,
      disciplineCode: input.disciplineCode,
      limit: input.limit?.toString(),
    });

    return this.requestJson(
      `${this.dependencies.baseUrl}/v1/reports/summary/details?${query.toString()}`,
    );
  }

  async recalculateProject(
    input: RecalculateInput,
  ): Promise<Record<string, unknown>> {
    return this.requestJson(
      `${this.dependencies.baseUrl}/v1/projects/${input.projectId}/recalculate`,
      {
        method: "POST",
        body: JSON.stringify({
          stageCode: input.stageCode,
          disciplineCode: input.disciplineCode,
          priceVersionId: input.priceVersionId,
          feeTemplateId: input.feeTemplateId,
        }),
      },
    );
  }

  async completeJob(
    jobId: string,
    result: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.requestJson(
      `${this.dependencies.baseUrl}/v1/jobs/${jobId}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ result }),
      },
    );
  }

  async failJob(
    jobId: string,
    errorMessage: string,
  ): Promise<Record<string, unknown>> {
    return this.requestJson(`${this.dependencies.baseUrl}/v1/jobs/${jobId}/fail`, {
      method: "POST",
      body: JSON.stringify({ errorMessage }),
    });
  }

  private buildQuery(input: Record<string, string | undefined>): URLSearchParams {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
      if (value) {
        query.set(key, value);
      }
    }
    return query;
  }

  private async requestJson(
    input: string,
    init: RequestInit = {},
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(input, {
      ...init,
      headers: {
        authorization: `Bearer ${this.dependencies.token}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      const errorPayload = (payload as {
        error?: {
          code?: string;
          message?: string;
        };
      }).error;

      throw new WorkerPlatformRequestError(
        response.status,
        errorPayload?.code ?? null,
        errorPayload?.message ?? `Worker platform request failed: ${response.status}`,
      );
    }

    return payload as Record<string, unknown>;
  }
}
