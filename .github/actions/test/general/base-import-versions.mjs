#!/usr/bin/env node
// Checks that submitted packages use the pinned base imports from lml-env.json.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import lmlEnv from "../../../../lml-env.json" with { type: "json" };
import { loadContext } from "./meta-context.mjs";
import {
  packageRootForLakefile,
  proofLeanToolchainPath,
  proofLakefilePath,
  report,
  requireMeta,
  statementLeanToolchainPath,
  statementLakefilePath
} from "../common.mjs";
import { lakeDependencies, loadLakeConfig } from "../lake-config.mjs";

const context = loadContext();
const { packageRoot, meta } = context;
const errors = [];
const packages = packageRoots();

requireMeta(context, errors);

const mathlib = lmlEnv.baseImports?.Mathlib ?? {};
const expectedToolchain = leanToolchainFromVersion(lmlEnv.lean?.version);
const expectedMathlibUrl = normalizeGitUrl(`https://github.com/${mathlib.repository}.git`);
const expectedMathlibRevision = String(mathlib.revision ?? "").trim();

if (!expectedToolchain) {
  errors.push("lml-env.json is missing lean.version");
}
if (!mathlib.repository) {
  errors.push("lml-env.json is missing baseImports.Mathlib.repository");
}
if (!expectedMathlibRevision) {
  errors.push("lml-env.json is missing baseImports.Mathlib.revision");
}

for (const item of packages) {
  checkLeanToolchainFile(item.toolchainPath ?? join(item.cwd, "lean-toolchain"), `${item.label} lean-toolchain`);
  checkMathlibRequire(loadLakeConfig(item.cwd, `${item.label} lakefile`, errors), `${item.label} lakefile`);
}

function packageRoots() {
  const items = [];
  const seen = new Set();
  addPackage("statement package", statementLakefilePath(meta), statementLeanToolchainPath(meta));
  addPackage("proof package", proofLakefilePath(meta), proofLeanToolchainPath(meta));
  return items;

  function addPackage(label, lakefilePath, leanToolchainPath) {
    if (!lakefilePath) {
      return;
    }
    const cwd = packageRootForLakefile(packageRoot, lakefilePath);
    if (!cwd || seen.has(cwd)) {
      return;
    }
    seen.add(cwd);
    items.push({
      label,
      cwd,
      lakefilePath,
      toolchainPath: leanToolchainPath ? join(packageRoot, leanToolchainPath) : null
    });
  }
}

function checkLeanToolchainFile(path, label) {
  if (!existsSync(path)) {
    errors.push(`${label} is missing`);
    return;
  }

  const actual = readFileSync(path, "utf8").trim();
  if (actual !== expectedToolchain) {
    errors.push(`${label} must be ${expectedToolchain}, found ${actual || "(empty)"}`);
  }
}

function checkMathlibRequire(config, label) {
  if (!config) {
    return;
  }

  const requires = lakeDependencies(config).filter((dependency) => dependency.kind === "git" && dependency.name === "mathlib");
  for (const { url, ref: revision } of requires) {
    if (normalizeGitUrl(url) !== expectedMathlibUrl) {
      errors.push(`${label} mathlib URL must be https://github.com/${mathlib.repository}.git, found ${url}`);
    }
    if (String(revision ?? "").trim() !== expectedMathlibRevision) {
      errors.push(`${label} mathlib revision must be ${expectedMathlibRevision}, found ${revision ?? "(missing)"}`);
    }
  }
}

function normalizeGitUrl(url) {
  return String(url ?? "")
    .trim()
    .replace(/\.git$/i, "")
    .replace(/\/$/g, "");
}

function leanToolchainFromVersion(version) {
  const normalized = String(version ?? "").trim();
  return normalized ? `leanprover/lean4:${normalized}` : "";
}

report("base import versions", errors);
