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
