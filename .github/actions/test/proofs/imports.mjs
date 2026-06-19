#!/usr/bin/env node
// Checks proof-package Lake dependencies on referenced statement submissions.
import { report } from "../common.mjs";
import { loadContext } from "../general/manifest-context.mjs";
import { validateProofLakefileStatementDependencies } from "./augment-proof-lakefile.mjs";

const { packageRoot, manifest } = loadContext();
const errors = [];

validateProofLakefileStatementDependencies({ packageRoot, manifest, errors });

report("proof import check", errors);
