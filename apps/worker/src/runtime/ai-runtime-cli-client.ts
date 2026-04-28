import { spawn } from "node:child_process";

type CommandResult = {
  stdout: string;
  stderr: string;
};

type CommandRunner = (
  command: string,
  args: string[],
  input: string,
) => Promise<CommandResult>;

export type AiRuntimeCliClientOptions = {
  pythonExecutable: string;
  cliPath: string;
  commandRunner?: CommandRunner;
};

async function defaultCommandRunner(
  command: string,
  args: string[],
  input: string,
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `command exited with code ${code}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

export class AiRuntimeCliClient {
  private readonly commandRunner: CommandRunner;

  constructor(private readonly options: AiRuntimeCliClientOptions) {
    this.commandRunner = options.commandRunner ?? defaultCommandRunner;
  }

  async processEventBatch(input: {
    source: string;
    events: Array<Record<string, unknown>>;
  }): Promise<Record<string, unknown>> {
    return this.processPayload(input);
  }

  async processReferenceQuotaSemanticSearch(input: {
    source?: string;
    query: string;
    records: Array<Record<string, unknown>>;
    snapshotPath?: string;
    qdrantUrl?: string;
    collection?: string;
    queryVector?: number[];
    limit?: number;
    timeoutSeconds?: number;
  }): Promise<Record<string, unknown>> {
    return this.processPayload({
      task: "reference_quota_semantic_search",
      source: input.source ?? "reference_quota",
      ...input,
    });
  }

  async processLlmChat(input: {
    source?: string;
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    temperature?: number;
    maxTokens?: number;
    timeoutSeconds?: number;
  }): Promise<Record<string, unknown>> {
    return this.processPayload({
      task: "llm_chat",
      source: input.source ?? "llm_provider",
      ...input,
    });
  }

  private async processPayload(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { stdout, stderr } = await this.commandRunner(
      this.options.pythonExecutable,
      [this.options.cliPath],
      JSON.stringify(input),
    );

    if (stderr && stderr.trim().length > 0) {
      throw new Error(stderr.trim());
    }

    return JSON.parse(stdout) as Record<string, unknown>;
  }
}
