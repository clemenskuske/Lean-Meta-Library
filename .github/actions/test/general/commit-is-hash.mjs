#!/usr/bin/env node
// Validates that the Commit field in the manifest is a full SHA-1 hash when present.
import { loadContext } from "./manifest-context.mjs";
import { report } from "../common.mjs";

const { manifest } = loadContext();
const errors = [];

const commit = manifest.Commit ?? null;
if (commit !== null && commit !== "") {
  if (!/^[0-9a-f]{40}$/.test(String(commit))) {
    errors.push(`Commit must be a full SHA-1 hash (40 lowercase hex chars), got: ${commit}`);
  }
}

report("commit is hash", errors);
