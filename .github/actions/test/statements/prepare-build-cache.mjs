#!/usr/bin/env node
// Prepares the submitted statement package before statement-facing checks run.
// Cache fetch is best-effort, but Lake update and package build must pass.
import { join } from "node:path";
import { loadContext } from "../general/meta-context.mjs";
import { ensurePreparedLakePackage } from "../general/prepare-lake-package.mjs";
import { report, statementPackageRoot } from "../common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const warnings = [];
const stmtRoot = statementPackageRoot(meta);

ensurePreparedLakePackage({
  packageRoot,
  lakefilePath: stmtRoot ? join(stmtRoot, "lakefile.lean") : null,
  kind: "statement",
  label: "statement package",
  errors,
  warnings
});

report("prepare statement Lean build/cache", errors, warnings);
