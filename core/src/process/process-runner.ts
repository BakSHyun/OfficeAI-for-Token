import { spawn } from "node:child_process";

type RunOptions = {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  stdin?: string;
  maxOutputBytes?: number;
  environment?: NodeJS.ProcessEnv;
};

function quoteCmdArgument(value: string) {
  if (!/[\s"&|<>^]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function processInvocation(command: string, args: string[]) {
  if (process.platform !== "win32") return { command, args };
  const commandLine = [command, ...args].map(quoteCmdArgument).join(" ");
  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", commandLine],
  };
}

export async function runProcess(options: RunOptions) {
  const invocation = processInvocation(options.command, options.args);
  const maxOutputBytes = options.maxOutputBytes ?? 40_000;
  const startedAt = Date.now();

  return new Promise<{
    exitCode: number | null;
    durationMs: number;
    stdout: string;
    stderr: string;
    timedOut: boolean;
  }>((resolvePromise, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd,
      env: options.environment ?? process.env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < maxOutputBytes) stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < maxOutputBytes) stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolvePromise({
        exitCode,
        durationMs: Date.now() - startedAt,
        stdout: stdout.slice(0, maxOutputBytes),
        stderr: stderr.slice(0, maxOutputBytes),
        timedOut,
      });
    });

    if (options.stdin) child.stdin.end(options.stdin);
    else child.stdin.end();

  });
}
