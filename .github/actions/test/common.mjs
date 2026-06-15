#!/usr/bin/env node
// Shared helper library for the first-run submission checks.
// It walks files, exposes small path helpers, and formats pass/fail output.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import lmlEnv from "../../../lml-env.json" with { type: "json" };

export { parseMetaYaml } from "./general/meta-context.mjs";

export const maxBuildOutputBytes = Number(lmlEnv.checks?.maxBuildOutputBytes ?? 1024 * 1024 * 20);

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

export function metadataPackageSlug(meta) {
  return meta.submissionSlug ?? meta.packageSlug ?? meta.namespaceSlug ?? null;
}

export function statementPackageRoot(meta) {
  return meta.statementRoot ?? null;
}

export function proofPackageRoot(meta) {
  return meta.proofRoot ?? null;
}

export function namespaceOfDeclaration(name) {
  const value = String(name ?? "");
  const index = value.lastIndexOf(".");
  return index === -1 ? value : value.slice(0, index);
}

export function isLeanName(name) {
  return /^[A-Za-z_][A-Za-z0-9_']*(\.[A-Za-z_][A-Za-z0-9_']*)*$/.test(String(name ?? ""));
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
