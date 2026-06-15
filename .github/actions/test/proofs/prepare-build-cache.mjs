#!/usr/bin/env node
// Prepares the submitted proof package before proof-facing checks run.
// Cache fetch is best-effort, but Lake update and package build must pass.
import { join } from "node:path";
import { loadContext } from "../general/meta-context.mjs";
import { ensurePreparedLakePackage } from "../general/prepare-lake-package.mjs";
import { proofPackageRoot, report } from "../common.mjs";
import { augmentProofLakefile } from "./augment-proof-lakefile.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const warnings = [];
const pRoot = proofPackageRoot(meta);

augmentProofLakefile({ packageRoot, meta, errors, warnings });

ensurePreparedLakePackage({
  packageRoot,
  lakefilePath: pRoot ? join(pRoot, "lakefile.lean") : null,
  kind: "proof",
  label: "proof package",
  errors,
  warnings
});

report("prepare proof Lean build/cache", errors, warnings);
