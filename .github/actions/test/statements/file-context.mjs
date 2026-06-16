#!/usr/bin/env node
// Applies a conservative first-run policy to statement Lean files.
// It rejects macros, custom syntax, unsafe features, and other constructs outside the intended secure subset.
import { join, resolve } from "node:path";
import { report, statementPackageRoot } from "../common.mjs";
import { loadContext } from "../general/manifest-context.mjs";
import { inspectCommandSyntax } from "../lean-inspect.mjs";

const { packageRoot, manifest } = loadContext();
const errors = [];
const warnings = [];
const stmtRootFolder = statementPackageRoot(manifest);
const statementRoot = stmtRootFolder ? resolve(packageRoot, stmtRootFolder) : null;

const forbiddenPatterns = [
  ["macro definitions", "Lean.Parser.Command.macro"],
  ["syntax extensions", "Lean.Parser.Command.syntax"],
  ["elaborators", "Lean.Parser.Command.elab"],
  ["custom commands", "Lean.Parser.Command.command"],
  ["unsafe code", "Lean.Parser.Command.unsafe"],
  ["run_cmd", "Lean.Parser.Command.runCmd"],
  ["eval commands", "Lean.Parser.Command.eval"],
  ["print commands", "Lean.Parser.Command.print"],
  ["compiled foreign code", "Lean.Parser.Command.extern"]
];

const forbiddenIdentifiers = new Map([
  ["IO", "IO usage"],
  ["run_cmd", "run_cmd"]
]);

const allowedCommandKinds = new Set([
  "Lean.Parser.Command.import",
  "Lean.Parser.Command.namespace",
  "Lean.Parser.Command.end",
  "Lean.Parser.Command.open",
  "Lean.Parser.Command.universe",
  "Lean.Parser.Command.variable",
  "Lean.Parser.Command.section",
  "Lean.Parser.Command.declaration",
  "Lean.Parser.Command.noncomputable"
]);

for (const entry of manifest.statements ?? []) {
  const leanFile = entry?.Statement?.LeanStatement;
  if (!leanFile) {
    continue;
  }
  const path = join(packageRoot, leanFile);
  const label = leanFile;
  const inspected = inspectCommandSyntax({ file: path, label, errors, lakeDir: statementRoot })?.[0];

  for (const [forbiddenLabel, kind] of forbiddenPatterns) {
    if (inspected?.syntax?.some((node) => node.kind === kind) || inspected?.commands?.includes(kind)) {
      errors.push(`statement file uses forbidden ${forbiddenLabel}: ${label}`);
    }
  }

  for (const [identifier, forbiddenLabel] of forbiddenIdentifiers) {
    if (inspected?.syntax?.some((node) => node.ident === identifier || node.atom === identifier)) {
      errors.push(`statement file uses forbidden ${forbiddenLabel}: ${label}`);
    }
  }

  for (const kind of inspected?.commands ?? []) {
    if (!allowedCommandKinds.has(kind)) {
      warnings.push(`statement file command is outside first-run whitelist: ${label}: ${kind}`);
    }
  }
}

warnings.push("Claude review is not automated in this first-run checker; keep this static whitelist small until a review step is wired in.");

report("check statement file context", errors, warnings);
