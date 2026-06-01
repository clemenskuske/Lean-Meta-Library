import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../lib/process.js";

const cliRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export async function test({ args, cwd }) {
  const workspaceRoot = findWorkspaceRoot(cwd) ?? join(cliRoot, "..");
  const runner = join(workspaceRoot, ".github-actions", "test", "run-all.mjs");

  if (!existsSync(runner)) {
    throw new Error(`Could not find submission test runner at ${runner}.`);
  }

  run(process.execPath, [runner, ...args], { cwd: workspaceRoot, stdio: "inherit" });
}

function findWorkspaceRoot(start) {
  let current = start;

  while (current && current !== dirname(current)) {
    const runner = join(current, ".github-actions", "test", "run-all.mjs");
    if (existsSync(runner)) {
      return current;
    }
    current = dirname(current);
  }

  return null;
}
