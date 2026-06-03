#!/usr/bin/env node
// Shared helper library for the first-run submission checks.
// It loads package metadata, walks files, parses the small metadata subset we need, and formats pass/fail output.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import YAML from "yaml";
import lmlEnv from "../../../lml-env.json" with { type: "json" };

export const defaultMetadataPath = String(lmlEnv.submission?.defaultMetadataPath ?? "meta.yaml");
export const maxBuildOutputBytes = Number(lmlEnv.checks?.maxBuildOutputBytes ?? 1024 * 1024 * 20);

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
    proofs: [],
    paper: {},
    ...parsed
  };
}

export function inferNamespaceRoot(meta) {
  if (meta.namespaceSlug) {
    return slugToPascal(String(meta.namespaceSlug));
  }
  const fromEntry = meta.declarations?.find((entry) => entry.name)?.name?.split(".")?.[0];
  if (fromEntry) {
    return fromEntry;
  }
  return null;
}

export function slugToPascal(slug) {
  return String(slug)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
}

export function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

export function walkFiles(root, options = {}) {
  const ignoreDirs = new Set(options.ignoreDirs ?? [".git", ".lake", "node_modules"]);
  const files = [];

  function visit(dir) {
    if (!existsSync(dir)) {
      return;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          visit(join(dir, entry.name));
        }
        continue;
      }
      if (entry.isFile()) {
        files.push(join(dir, entry.name));
      }
    }
  }

  visit(root);
  return files;
}

export function leanFiles(root) {
  return walkFiles(root).filter((path) => extname(path) === ".lean");
}

export function relativePath(root, path) {
  return relative(root, path).split(sep).join("/");
}

export function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function declarationNamespaceForEntry(entry) {
  return entry.name;
}

export function proofNamespaceForDeclaration(declarationName) {
  const parts = declarationName.split(".");
  const root = parts[0];
  const statementIndex = parts.indexOf("Statement");
  if (statementIndex === -1 || statementIndex + 1 >= parts.length) {
    return null;
  }
  return `${root}.Proofs.Statement.${parts[statementIndex + 1]}`;
}

export function proofConstantForDeclaration(declarationName) {
  return declarationName.split(".").at(-1);
}

export function fileSize(path) {
  return statSync(path).size;
}

export function report(title, errors, warnings = []) {
  for (const warning of warnings) {
    console.warn(`WARN ${warning}`);
  }

  if (errors.length > 0) {
    console.error(`FAIL ${title}`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`PASS ${title}`);
}

export function requireMeta(context, errors) {
  if (!existsSync(context.metaPath)) {
    errors.push(`metadata file not found: ${context.metaPath}`);
  }
}
