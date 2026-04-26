import type { BackgroundJobRecord } from "@saas-pricing/job-contracts";

export interface BackgroundJobQueue {
  enqueue(job: BackgroundJobRecord): Promise<void>;
  dequeue(): Promise<BackgroundJobRecord | null>;
  peek(): Promise<BackgroundJobRecord | null>;
  list(): Promise<BackgroundJobRecord[]>;
}

export class InMemoryBackgroundJobQueue implements BackgroundJobQueue {
  private readonly jobs: BackgroundJobRecord[];

  constructor(seed: BackgroundJobRecord[] = []) {
    this.jobs = seed.map((job) => ({ ...job }));
  }

  async enqueue(job: BackgroundJobRecord): Promise<void> {
    this.jobs.push({ ...job });
  }

  async dequeue(): Promise<BackgroundJobRecord | null> {
    const job = this.jobs.shift();
    return job ? { ...job } : null;
  }

  async peek(): Promise<BackgroundJobRecord | null> {
    const job = this.jobs[0];
    return job ? { ...job } : null;
  }

  async list(): Promise<BackgroundJobRecord[]> {
    return this.jobs.map((job) => ({ ...job }));
  }
}
