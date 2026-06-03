#!/usr/bin/env node
// Applies a conservative first-run policy to surface Lean files.
// It rejects macros, custom syntax, unsafe features, and other constructs outside the intended secure subset.
import { join } from "node:path";
import { loadContext, report } from "./common.mjs";
import { inspectCommandSyntax } from "./lean-inspect.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const warnings = [];

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

for (const entry of meta.declarations ?? []) {
  const path = join(packageRoot, entry.folder ?? "", "Surface.lean");
  const label = `${entry.folder}/Surface.lean`;
  const inspected = inspectCommandSyntax({ file: path, label, errors })?.[0];

  for (const [forbiddenLabel, kind] of forbiddenPatterns) {
    if (inspected?.syntax?.some((node) => node.kind === kind) || inspected?.commands?.includes(kind)) {
      errors.push(`surface file uses forbidden ${forbiddenLabel}: ${label}`);
    }
  }

  for (const [identifier, forbiddenLabel] of forbiddenIdentifiers) {
    if (inspected?.syntax?.some((node) => node.ident === identifier || node.atom === identifier)) {
      errors.push(`surface file uses forbidden ${forbiddenLabel}: ${label}`);
    }
  }

  for (const kind of inspected?.commands ?? []) {
    if (!allowedCommandKinds.has(kind)) {
      warnings.push(`surface file command is outside first-run whitelist: ${label}: ${kind}`);
    }
  }
}

warnings.push("Claude review is not automated in this first-run checker; keep this static whitelist small until a review step is wired in.");

report("check surface file context", errors, warnings);
