// Metadata path parsing and context loading for submission checks.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import YAML from "yaml";
import lmlEnv from "../../../../lml-env.json" with { type: "json" };

export const defaultManifestPath = String(lmlEnv.submission?.defaultManifestPath ?? "manifest.yaml");

export function loadContext(argv = process.argv.slice(2)) {
  const manifestPath = resolveManifestPath(parseManifestArg(argv));
  if (existsSync(manifestPath) && !statSync(manifestPath).isFile()) {
    throw new Error(`Metadata path must be a file: ${manifestPath}`);
  }

  const packageRoot = dirname(manifestPath);
  const manifestText = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : "";
  const manifest = parseManifestYaml(manifestText);
  const namespaceRoot = inferNamespaceRoot(manifest);

  return { packageRoot, manifestPath, manifestText, manifest, namespaceRoot };
}

function parseManifestArg(argv) {
  const args = [...argv];
  const positional = [];
  let manifestPath = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--manifest") {
      if (manifestPath) {
        throw new Error("Use one manifest file argument, for example: --manifest=path/to/manifest.yaml.");
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
        throw new Error("Use one manifest file argument, for example: --manifest=path/to/manifest.yaml.");
      }
      manifestPath = arg.slice("--manifest=".length);
      if (!manifestPath) {
        throw new Error("Missing manifest path after --manifest=.");
      }
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown checker option: ${arg}`);
    }
    positional.push(arg);
  }

  if (positional.length > 1 || (manifestPath && positional.length > 0)) {
    throw new Error("Use one manifest file argument, for example: --manifest=path/to/manifest.yaml.");
  }

  const selected = manifestPath ?? positional[0] ?? defaultManifestPath;
  if (!isManifestFile(selected)) {
    throw new Error("Use a manifest .yaml or .yml file path.");
  }
  return selected;
}

export function resolveManifestPath(manifestPath) {
  return isAbsolute(manifestPath) ? manifestPath : resolve(process.cwd(), manifestPath);
}

function isManifestFile(path) {
  return /\.ya?ml$/i.test(path);
}

export function parseManifestYaml(text) {
  const parsed = YAML.parse(text || "") ?? {};
  return {
    declarations: [],
    statements: [],
    proofs: [],
    paper: {},
    ...parsed
  };
}

export function inferNamespaceRoot(manifest) {
  const slug = manifest.submissionSlug ?? manifest.packageSlug ?? manifest.namespaceSlug;
  if (slug) {
    return slugToPascal(String(slug));
  }

  const fromEntry = rawStatementNames(manifest).find(Boolean)?.split(".")?.[0];
  return fromEntry ?? null;
}

export function slugToPascal(slug) {
  return String(slug)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
}

function rawStatementNames(manifest) {
  if (Array.isArray(manifest.statements) && manifest.statements.length > 0) {
    return manifest.statements.map((entry) => entry.Statement?.Name ?? entry.name ?? entry.Name ?? null);
  }
  return (manifest.declarations ?? []).map((entry) => entry.name ?? entry.Name ?? null);
}
