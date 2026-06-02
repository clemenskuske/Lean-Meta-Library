import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lmlEnv } from "../lib/project-env.js";
import { run } from "../lib/process.js";

const cliRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const defaultMetadataPath = String(lmlEnv.submission?.defaultMetadataPath ?? "meta.yaml");

export async function test({ args, cwd }) {
  const metaPath = parseMetaArg(args, cwd);

  const workspaceRoot = findWorkspaceRoot(cwd) ?? join(cliRoot, "..");
  const runner = join(workspaceRoot, ".github/actions", "test", "run-all.mjs");

  if (!existsSync(runner)) {
    throw new Error(`Could not find submission test runner at ${runner}.`);
  }

  validateMetaPath(metaPath);
  run(process.execPath, [runner, `--meta=${metaPath}`], { cwd: workspaceRoot, stdio: "inherit" });
}

function parseMetaArg(args, cwd) {
  const positional = [];
  let metaPath = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--meta") {
      if (metaPath) {
        throw new Error("Use one metadata file argument: lml test --meta=path/to/meta.yaml");
      }
      metaPath = args[index + 1];
      index += 1;
      if (!metaPath) {
        throw new Error("Missing metadata path after --meta.");
      }
      continue;
    }
    if (arg.startsWith("--meta=")) {
      if (metaPath) {
        throw new Error("Use one metadata file argument: lml test --meta=path/to/meta.yaml");
      }
      metaPath = arg.slice("--meta=".length);
      if (!metaPath) {
        throw new Error("Missing metadata path after --meta=.");
      }
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown test option: ${arg}`);
    }
    positional.push(arg);
  }

  if (positional.length > 1 || (metaPath && positional.length > 0)) {
    throw new Error("Use one metadata file argument: lml test --meta=path/to/meta.yaml");
  }

  const selected = metaPath ?? positional[0] ?? defaultMetadataPath;
  return resolveMetaArgument(cwd, selected);
}

function resolveMetaArgument(cwd, metaPath) {
  return isAbsolute(metaPath) ? metaPath : resolve(cwd, metaPath);
}

function validateMetaPath(metaPath) {
  if (!/\.ya?ml$/i.test(metaPath)) {
    throw new Error("Use a metadata .yaml or .yml file argument: lml test --meta=path/to/meta.yaml");
  }
  if (!existsSync(metaPath)) {
    throw new Error(`Metadata file not found: ${metaPath}`);
  }
  if (!statSync(metaPath).isFile()) {
    throw new Error(`Metadata path must be a file: ${metaPath}`);
  }
}

function findWorkspaceRoot(start) {
  let current = start;

  while (current && current !== dirname(current)) {
    const runner = join(current, ".github/actions", "test", "run-all.mjs");
    if (existsSync(runner)) {
      return current;
    }
    current = dirname(current);
  }

  return null;
}
