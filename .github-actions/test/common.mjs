#!/usr/bin/env node
// Shared helper library for the first-run submission checks.
// It loads package metadata, walks files, parses the small metadata subset we need, and formats pass/fail output.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

export function loadContext(argv = process.argv.slice(2)) {
  const args = [...argv];
  let explicitMeta = null;
  const positional = [];

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--meta") {
      explicitMeta = args[i + 1] ?? null;
      i += 1;
      continue;
    }
    positional.push(args[i]);
  }

  const packageRoot = resolve(positional[0] ?? process.cwd());
  const metaPath = resolveMetaPath({ packageRoot, explicitMeta });
  const metaText = existsSync(metaPath) ? readFileSync(metaPath, "utf8") : "";
  const meta = parseMetaYaml(metaText);
  const namespaceRoot = inferNamespaceRoot(meta);

  return { packageRoot, metaPath, metaText, meta, namespaceRoot };
}

export function resolveMetaPath({ packageRoot, explicitMeta }) {
  if (explicitMeta) {
    return isAbsolute(explicitMeta) ? explicitMeta : resolve(process.cwd(), explicitMeta);
  }

  const packageMeta = join(packageRoot, "meta.yaml");
  if (existsSync(packageMeta)) {
    return packageMeta;
  }

  return resolve(process.cwd(), "meta.yaml");
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
  const fromEntry = meta.surfaceEntries?.find((entry) => entry.name)?.name?.split(".")?.[0];
  if (fromEntry) {
    return fromEntry;
  }
  if (meta.namespaceSlug) {
    return slugToPascal(String(meta.namespaceSlug));
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

export function proofNamespaceForTheorem(theoremName) {
  const parts = theoremName.split(".");
  const root = parts[0];
  const theoremIndex = parts.indexOf("Theorem");
  if (theoremIndex === -1 || theoremIndex + 1 >= parts.length) {
    return null;
  }
  return `${root}.Proof.Theorem.${parts[theoremIndex + 1]}`;
}

export function proofConstantForTheorem(theoremName) {
  return theoremName.split(".").at(-1);
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
