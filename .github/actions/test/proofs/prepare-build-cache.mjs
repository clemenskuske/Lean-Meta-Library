#!/usr/bin/env node
// Prepares the submitted proof package before proof-facing checks run.
// Cache fetch is best-effort, but Lake update and package build must pass.
import { loadContext } from "../general/meta-context.mjs";
import { ensureLakeAvailable, prepareLakePackage } from "../general/prepare-lake-package.mjs";
import { proofLakefilePath, report } from "../common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const warnings = [];

if (ensureLakeAvailable(errors)) {
  prepareLakePackage({
    packageRoot,
    lakefilePath: proofLakefilePath(meta),
    label: "proof package",
    errors,
    warnings
  });
}

report("prepare proof Lean build/cache", errors, warnings);
