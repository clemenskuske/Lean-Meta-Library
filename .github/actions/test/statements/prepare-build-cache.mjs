#!/usr/bin/env node
// Prepares the submitted statement package before statement-facing checks run.
// Cache fetch is best-effort, but Lake update and package build must pass.
import { loadContext } from "../general/meta-context.mjs";
import { ensureLakeAvailable, prepareLakePackage } from "../general/prepare-lake-package.mjs";
import { report, statementLakefilePath } from "../common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const warnings = [];

if (ensureLakeAvailable(errors)) {
  prepareLakePackage({
    packageRoot,
    lakefilePath: statementLakefilePath(meta),
    label: "statement package",
    errors,
    warnings
  });
}

report("prepare statement Lean build/cache", errors, warnings);
