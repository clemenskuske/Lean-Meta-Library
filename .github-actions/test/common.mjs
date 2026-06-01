#!/usr/bin/env node
// Shared helper library for the first-run submission checks.
// It loads package metadata, walks files, parses the small metadata subset we need, and formats pass/fail output.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import lmlEnv from "../../lml-env.json" with { type: "json" };

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
  const meta = {
    surfaceEntries: [],
    proofs: [],
    paper: {}
  };

  let listName = null;
  let current = null;
  let nestedListName = null;
  let nested = null;
  let objectName = null;

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) {
      continue;
    }

    const top = rawLine.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (top) {
      const [, key, value] = top;
      listName = null;
      current = null;
      nestedListName = null;
      nested = null;
      objectName = null;

      if (key === "surfaceEntries" || key === "proofs") {
        listName = key;
        meta[key] = [];
        continue;
      }

      if (value === "") {
        objectName = key;
        meta[key] = meta[key] ?? {};
        continue;
      }

      meta[key] = parseScalar(value);
      continue;
    }

    if (objectName) {
      const objectField = rawLine.match(/^  ([A-Za-z0-9_]+):\s*(.*)$/);
      if (objectField) {
        const [, key, value] = objectField;
        meta[objectName][key] = parseScalar(value);
      }
      continue;
    }

    if (listName) {
      const listItem = rawLine.match(/^  -\s+([A-Za-z0-9_]+):\s*(.*)$/);
      if (listItem) {
        current = {};
        nestedListName = null;
        nested = null;
        meta[listName].push(current);
        current[listItem[1]] = parseScalar(listItem[2]);
        continue;
      }

      const field = rawLine.match(/^    ([A-Za-z0-9_]+):\s*(.*)$/);
      if (field && current) {
        const [, key, value] = field;
        if (value === "") {
          nestedListName = key;
          current[key] = [];
        } else {
          current[key] = parseScalar(value);
        }
        continue;
      }

      const nestedItem = rawLine.match(/^      -\s+([A-Za-z0-9_]+):\s*(.*)$/);
      if (nestedItem && current && nestedListName) {
        nested = {};
        current[nestedListName].push(nested);
        nested[nestedItem[1]] = parseScalar(nestedItem[2]);
        continue;
      }

      const nestedField = rawLine.match(/^        ([A-Za-z0-9_]+):\s*(.*)$/);
      if (nestedField && nested) {
        nested[nestedField[1]] = parseScalar(nestedField[2]);
      }
    }
  }

  return meta;
}

export function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "[]") {
    return [];
  }
  if (/^true$/i.test(trimmed)) {
    return true;
  }
  if (/^false$/i.test(trimmed)) {
    return false;
  }
  if (trimmed === "\"\"" || trimmed === "''") {
    return "";
  }
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function inferNamespaceRoot(meta) {
  if (meta.namespaceSlug) {
    return slugToPascal(String(meta.namespaceSlug));
  }
  const fromEntry = meta.surfaceEntries?.find((entry) => entry.name)?.name?.split(".")?.[0];
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

export function stripLeanCommentsAndStrings(source) {
  return source
    .replace(/\/-[\s\S]*?-\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/"([^"\\]|\\.)*"/g, "\"\"");
}

export function declarationNames(source, keyword) {
  const stripped = stripLeanCommentsAndStrings(source);
  const matches = [...stripped.matchAll(new RegExp(`\\b${keyword}\\s+([A-Za-z_][A-Za-z0-9_']*)`, "g"))];
  return matches.map((match) => match[1]);
}

export function surfaceNamespaceForEntry(entry) {
  return entry.name;
}

export function surfaceModuleForEntry(entry) {
  const folder = String(entry.folder ?? "").split("/").filter(Boolean).at(-1);
  return folder ? `${folder}.Surface` : null;
}

export function proofNamespaceForTheorem(theoremName) {
  const parts = theoremName.split(".");
  const root = parts[0];
  const theoremIndex = parts.indexOf("Theorem");
  if (theoremIndex === -1 || theoremIndex + 1 >= parts.length) {
    return null;
  }
  return `${root}.Proofs.Theorem.${parts[theoremIndex + 1]}`;
}

export function proofConstantForTheorem(theoremName) {
  return theoremName.split(".").at(-1);
}

export function proofModuleForFile(proofFile) {
  const parts = String(proofFile ?? "").split(/[\\/]/).filter(Boolean);
  if (parts[0] === "proofs") {
    parts.shift();
  }
  if (parts.length === 0 || !parts.at(-1).endsWith(".lean")) {
    return null;
  }

  parts[parts.length - 1] = parts.at(-1).replace(/\.lean$/i, "");
  return parts.join(".");
}

export function isConjectureProofEntry(proof) {
  return proof?.conjecture === true || String(proof?.conjecture ?? "").toLowerCase() === "true";
}

export function theoremFolderName(theoremName) {
  const namespace = proofNamespaceForTheorem(theoremName);
  return namespace ? namespace.split(".").at(-1) : basename(dirname(theoremName));
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

export function listImports(source) {
  return stripLeanCommentsAndStrings(source)
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*import\s+(.+?)\s*$/)?.[1])
    .filter(Boolean);
}
