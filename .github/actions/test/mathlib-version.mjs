#!/usr/bin/env node
// Checks that submitted packages use the repository-pinned Lean toolchain and mathlib revision.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import lmlEnv from "../../../lml-env.json" with { type: "json" };
import { loadContext, report, requireMeta } from "./common.mjs";
import { lakeDependencies, loadLakeConfig } from "./lake-config.mjs";

const context = loadContext();
const { packageRoot, meta } = context;
const errors = [];
const proofLakeConfig = loadLakeConfig(packageRoot, "root lakefile", errors);
const surfaceLakeConfig = loadLakeConfig(join(packageRoot, "surface-package"), "surface lakefile", errors);

requireMeta(context, errors);

const expectedToolchain = String(lmlEnv.lean.toolchain ?? "").trim();
const expectedMathlibUrl = normalizeGitUrl(`https://github.com/${lmlEnv.mathlib.repository}.git`);
const expectedMathlibRevision = String(lmlEnv.mathlib.revision ?? "").trim();

if (!expectedToolchain) {
  errors.push("lml-env.json is missing lean.toolchain");
}
if (!expectedMathlibRevision) {
  errors.push("lml-env.json is missing mathlib.revision");
}

if (meta.pinnedLeanToolchain && String(meta.pinnedLeanToolchain).trim() !== expectedToolchain) {
  errors.push(
    `metadata pinnedLeanToolchain must be ${expectedToolchain}, found ${String(meta.pinnedLeanToolchain).trim()}`
  );
}

checkLeanToolchainFile(join(packageRoot, "lean-toolchain"), "root lean-toolchain");
checkLeanToolchainFile(join(packageRoot, "surface-package/lean-toolchain"), "surface lean-toolchain");
checkMathlibRequire(proofLakeConfig, "root lakefile");
checkMathlibRequire(surfaceLakeConfig, "surface lakefile");

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
  if (requires.length !== 1) {
    errors.push(`${label} should have exactly one mathlib git dependency`);
    return;
  }

  const { url, ref: revision } = requires[0];
  if (normalizeGitUrl(url) !== expectedMathlibUrl) {
    errors.push(`${label} mathlib URL must be https://github.com/${lmlEnv.mathlib.repository}.git, found ${url}`);
  }
  if (String(revision ?? "").trim() !== expectedMathlibRevision) {
    errors.push(`${label} mathlib revision must be ${expectedMathlibRevision}, found ${revision ?? "(missing)"}`);
  }
}

function normalizeGitUrl(url) {
  return String(url ?? "")
    .trim()
    .replace(/\.git$/i, "")
    .replace(/\/$/g, "");
}

report("mathlib version", errors);
