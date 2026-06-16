#!/usr/bin/env node
// Checks that the submission includes a licensePath and that its content matches a recognized license.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import lmlEnv from "../../../../lml-env.json" with { type: "json" };
import { loadContext } from "./meta-context.mjs";
import { report } from "../common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const allowedLicenseIdentifiers = lmlEnv.submission?.allowedLicenseIdentifiers ?? [];

if (!meta.licensePath) {
  errors.push("licensePath is missing from metadata: submission must include a license file");
} else {
  const absolute = join(packageRoot, meta.licensePath);
  if (!existsSync(absolute)) {
    errors.push(`license file missing: ${meta.licensePath}`);
  } else {
    const content = readFileSync(absolute, "utf8");
    const recognized = allowedLicenseIdentifiers.some((id) => content.includes(id));
    if (!recognized) {
      errors.push(
        `license file does not contain a recognized license identifier. Allowed identifiers: ${allowedLicenseIdentifiers.join(", ")}`
      );
    }
  }
}

report("check license", errors);
