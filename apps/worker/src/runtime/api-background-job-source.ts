import type { BackgroundJobRecord } from "@saas-pricing/job-contracts";

type Dependencies = {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
};

export class ApiBackgroundJobSource {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly dependencies: Dependencies) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async claimNextQueuedJob(): Promise<BackgroundJobRecord | null> {
    const response = await this.fetchImpl(
      `${this.dependencies.baseUrl}/v1/jobs/pull-next`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.dependencies.token}`,
        },
      },
    );

    const payload = (await response.json()) as {
      job?: BackgroundJobRecord | null;
      error?: {
        message?: string;
      };
    };

    if (!response.ok) {
      throw new Error(
        payload.error?.message ?? `Failed to claim background job: ${response.status}`,
      );
    }

    return payload.job ?? null;
  }
}
