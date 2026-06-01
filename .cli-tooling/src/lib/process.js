import { spawnSync } from "node:child_process";

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    shell: options.shell ?? false,
    cwd: options.cwd
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr.trim()}` : "";
    throw new Error(`Command failed: ${command} ${args.join(" ")}${stderr}`);
  }

  return result.stdout?.trim() ?? "";
}

export function commandExists(command) {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    stdio: "ignore"
  });

  return result.status === 0;
}

export function shell(command, options = {}) {
  return run(command, [], { ...options, shell: true, stdio: options.stdio ?? "inherit" });
}
