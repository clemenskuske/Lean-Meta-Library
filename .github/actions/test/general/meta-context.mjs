// Metadata path parsing and context loading for submission checks.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import YAML from "yaml";
import lmlEnv from "../../../../lml-env.json" with { type: "json" };

export const defaultMetadataPath = String(lmlEnv.submission?.defaultMetadataPath ?? "meta.yaml");

export function loadContext(argv = process.argv.slice(2)) {
  const metaPath = resolveMetaPath(parseMetaArg(argv));
  if (existsSync(metaPath) && !statSync(metaPath).isFile()) {
    throw new Error(`Metadata path must be a file: ${metaPath}`);
  }

  const packageRoot = dirname(metaPath);
  const metaText = existsSync(metaPath) ? readFileSync(metaPath, "utf8") : "";
  const meta = parseMetaYaml(metaText);
  const namespaceRoot = inferNamespaceRoot(meta);

  return { packageRoot, metaPath, metaText, meta, namespaceRoot };
}

function parseMetaArg(argv) {
  const args = [...argv];
  const positional = [];
  let metaPath = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--meta") {
      if (metaPath) {
        throw new Error("Use one metadata file argument, for example: --meta=path/to/meta.yaml.");
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
        throw new Error("Use one metadata file argument, for example: --meta=path/to/meta.yaml.");
      }
      metaPath = arg.slice("--meta=".length);
      if (!metaPath) {
        throw new Error("Missing metadata path after --meta=.");
      }
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown checker option: ${arg}`);
    }
    positional.push(arg);
  }

  if (positional.length > 1 || (metaPath && positional.length > 0)) {
    throw new Error("Use one metadata file argument, for example: --meta=path/to/meta.yaml.");
  }

  const selected = metaPath ?? positional[0] ?? defaultMetadataPath;
  if (!isMetadataFile(selected)) {
    throw new Error("Use a metadata .yaml or .yml file path.");
  }
  return selected;
}

export function resolveMetaPath(metaPath) {
  return isAbsolute(metaPath) ? metaPath : resolve(process.cwd(), metaPath);
}

function isMetadataFile(path) {
  return /\.ya?ml$/i.test(path);
}

export function parseMetaYaml(text) {
  const parsed = YAML.parse(text || "") ?? {};
  return {
    declarations: [],
    statements: [],
    proofs: [],
    paper: {},
    ...parsed
  };
}

export function inferNamespaceRoot(meta) {
  const slug = meta.submissionSlug ?? meta.packageSlug ?? meta.namespaceSlug;
  if (slug) {
    return slugToPascal(String(slug));
  }

  const fromEntry = rawStatementNames(meta).find(Boolean)?.split(".")?.[0];
  return fromEntry ?? null;
}

export function slugToPascal(slug) {
  return String(slug)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
}

function rawStatementNames(meta) {
  if (Array.isArray(meta.statements) && meta.statements.length > 0) {
    return meta.statements.map((entry) => entry.Statement?.Name ?? entry.name ?? entry.Name ?? null);
  }
  return (meta.declarations ?? []).map((entry) => entry.name ?? entry.Name ?? null);
}
