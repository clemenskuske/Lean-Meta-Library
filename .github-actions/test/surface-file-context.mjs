#!/usr/bin/env node
// Applies a conservative first-run policy to surface Lean files.
// It rejects macros, custom syntax, unsafe features, and other constructs outside the intended secure subset.
import { join } from "node:path";
import { loadContext, readIfExists, report, stripLeanCommentsAndStrings } from "./common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const warnings = [];

const forbiddenPatterns = [
  ["macro definitions", /\bmacro\b/],
  ["syntax extensions", /\bsyntax\b/],
  ["elaborators", /\belab\b/],
  ["custom commands", /\bcommand\b/],
  ["unsafe code", /\bunsafe\b/],
  ["run_cmd", /\brun_cmd\b/],
  ["eval commands", /^\s*#eval\b/m],
  ["print commands", /^\s*#print\b/m],
  ["compiled foreign code", /\bextern\b/],
  ["IO usage", /\bIO\b/]
];

const allowedFirstTokens = new Set([
  "import",
  "namespace",
  "end",
  "open",
  "universe",
  "variable",
  "section",
  "def",
  "abbrev",
  "structure",
  "class",
  "inductive",
  "axiom",
  "theorem",
  "lemma",
  "instance",
  "noncomputable"
]);

for (const entry of meta.surfaceEntries ?? []) {
  const path = join(packageRoot, entry.folder ?? "", "Surface.lean");
  const source = readIfExists(path);
  if (!source) {
    continue;
  }
  const stripped = stripLeanCommentsAndStrings(source);

  for (const [label, pattern] of forbiddenPatterns) {
    if (pattern.test(stripped)) {
      errors.push(`surface file uses forbidden ${label}: ${entry.folder}/Surface.lean`);
    }
  }

  for (const [index, line] of stripped.split(/\r?\n/).entries()) {
    if (/^\s/.test(line)) {
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("|") || trimmed.startsWith("where") || trimmed.startsWith(":=")) {
      continue;
    }
    const token = trimmed.match(/^[@#]?\[?[A-Za-z_][A-Za-z0-9_']*/)?.[0]?.replace(/^@?\[?/, "");
    if (token && /^[a-zA-Z_]/.test(token) && !allowedFirstTokens.has(token)) {
      warnings.push(`surface file line starts outside first-run whitelist: ${entry.folder}/Surface.lean:${index + 1}: ${token}`);
    }
  }
}

warnings.push("Claude review is not automated in this first-run checker; keep this static whitelist small until a review step is wired in.");

report("check surface file context", errors, warnings);
