import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../lib/process.js";

const cliRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export async function test({ args, cwd }) {
  if (args.includes("--meta")) {
    throw new Error("Use a single metadata file argument: lml test path/to/meta.yaml");
  }

  if (args.length > 1) {
    throw new Error("Use one metadata file argument: lml test path/to/meta.yaml");
  }

  const workspaceRoot = findWorkspaceRoot(cwd) ?? join(cliRoot, "..");
  const runner = join(workspaceRoot, ".github-actions", "test", "run-all.mjs");

  if (!existsSync(runner)) {
    throw new Error(`Could not find submission test runner at ${runner}.`);
  }

  const runnerArgs = args.length === 1 ? [resolveMetaArgument(cwd, args[0])] : [];
  run(process.execPath, [runner, ...runnerArgs], { cwd: workspaceRoot, stdio: "inherit" });
}

function resolveMetaArgument(cwd, metaPath) {
  return isAbsolute(metaPath) ? metaPath : resolve(cwd, metaPath);
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
