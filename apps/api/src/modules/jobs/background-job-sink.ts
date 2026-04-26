import type { BackgroundJobRecord } from "./background-job-repository.js";

export interface BackgroundJobSink {
  enqueue(job: BackgroundJobRecord): Promise<void>;
}

export class NoopBackgroundJobSink implements BackgroundJobSink {
  async enqueue(_job: BackgroundJobRecord): Promise<void> {}
}
