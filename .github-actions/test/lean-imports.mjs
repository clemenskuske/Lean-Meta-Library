#!/usr/bin/env node
// Direct import parser backed by Lean's parseImports' implementation, the same fast parser Lake uses.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { maxBuildOutputBytes } from "./common.mjs";

export function parseLeanImports(files, errors) {
  const importsByFile = new Map(files.map((file) => [file, []]));
  if (files.length === 0) {
    return importsByFile;
  }

  const tmp = mkdtempSync(join(tmpdir(), "lml-import-parser-"));
  const inspector = join(tmp, "ImportInspector.lean");

  try {
    writeFileSync(inspector, importInspectorSource(), "utf8");
    const result = spawnSync("lean", ["--run", inspector, ...files], {
      encoding: "utf8",
      maxBuffer: maxBuildOutputBytes
    });

    if (result.error) {
      errors.push(`could not run Lean import parser: ${result.error.message}`);
      return importsByFile;
    }
    if (result.status !== 0) {
      errors.push(`Lean import parser failed\n${result.stdout}${result.stderr}`.trim());
      return importsByFile;
    }

    for (const line of result.stdout.split(/\r?\n/)) {
      if (!line.startsWith("IMPORT\t")) {
        continue;
      }
      const [, file, imported] = line.split("\t");
      if (imported !== "Init") {
        importsByFile.get(file)?.push(imported);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  return importsByFile;
}

function importInspectorSource() {
  return `import Lean
open Lean

def main (args : List String) : IO UInt32 := do
  for file in args do
    let header <- Lean.parseImports' (<- IO.FS.readFile file) file
    for imp in header.imports do
      IO.println s!"IMPORT\\t{file}\\t{imp.module}"
  return 0
`;
}
