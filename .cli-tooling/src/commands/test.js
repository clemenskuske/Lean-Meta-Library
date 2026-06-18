import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lmlEnv } from "../lib/project-env.js";
import { run } from "../lib/process.js";

const cliRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const defaultManifestPath = String(lmlEnv.submission?.defaultManifestPath ?? "manifest.yaml");

export async function test({ args, cwd }) {
  const manifestPath = parseManifestArg(args, cwd);

  const workspaceRoot = findWorkspaceRoot(cwd) ?? join(cliRoot, "..");
  const runner = join(workspaceRoot, ".github/actions", "test", "run-all.mjs");

  if (!existsSync(runner)) {
    throw new Error(`Could not find submission test runner at ${runner}.`);
  }

  validateManifestPath(manifestPath);
  run(process.execPath, [runner, `--manifest=${manifestPath}`], { cwd: workspaceRoot, stdio: "inherit" });
}

function parseManifestArg(args, cwd) {
  const positional = [];
  let manifestPath = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--manifest") {
      if (manifestPath) {
        throw new Error("Use one manifest file argument: lml test --manifest=path/to/manifest.yaml");
      }
      manifestPath = args[index + 1];
      index += 1;
      if (!manifestPath) {
        throw new Error("Missing manifest path after --manifest.");
      }
      continue;
    }
    if (arg.startsWith("--manifest=")) {
      if (manifestPath) {
        throw new Error("Use one manifest file argument: lml test --manifest=path/to/manifest.yaml");
      }
      manifestPath = arg.slice("--manifest=".length);
      if (!manifestPath) {
        throw new Error("Missing manifest path after --manifest=.");
      }
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown test option: ${arg}`);
    }
    positional.push(arg);
  }

  if (positional.length > 1 || (manifestPath && positional.length > 0)) {
    throw new Error("Use one manifest file argument: lml test --manifest=path/to/manifest.yaml");
  }

  const selected = manifestPath ?? positional[0] ?? defaultManifestPath;
  return resolveMetaArgument(cwd, selected);
}

function resolveMetaArgument(cwd, manifestPath) {
  return isAbsolute(manifestPath) ? manifestPath : resolve(cwd, manifestPath);
}

function validateManifestPath(manifestPath) {
  if (!/\.ya?ml$/i.test(manifestPath)) {
    throw new Error("Use a manifest .yaml or .yml file argument: lml test --manifest=path/to/manifest.yaml");
  }
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }
  if (!statSync(manifestPath).isFile()) {
    throw new Error(`Manifest path must be a file: ${manifestPath}`);
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
