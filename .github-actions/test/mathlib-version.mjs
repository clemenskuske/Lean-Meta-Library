#!/usr/bin/env node
// Checks that submitted packages use the repository-pinned Lean toolchain and mathlib revision.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import lmlEnv from "../../lml-env.json" with { type: "json" };
import { loadContext, readIfExists, report, requireMeta } from "./common.mjs";

const context = loadContext();
const { packageRoot, meta } = context;
const errors = [];

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
checkMathlibRequire(join(packageRoot, "lakefile.lean"), "root lakefile");
checkMathlibRequire(join(packageRoot, "surface-package/lakefile.lean"), "surface lakefile");

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

function checkMathlibRequire(path, label) {
  const source = readIfExists(path);
  if (!source) {
    return;
  }

  const requires = [...source.matchAll(/\brequire\s+mathlib\s+from\s+git\s+"([^"]+)"(?:\s+@\s+"([^"]+)")?/g)];
  if (requires.length !== 1) {
    errors.push(`${label} should have exactly one mathlib git dependency`);
    return;
  }

  const [, url, revision] = requires[0];
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
