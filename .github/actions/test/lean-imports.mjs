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

    let rows;
    try {
      rows = JSON.parse(result.stdout.trim() || "[]");
    } catch (error) {
      errors.push(`Lean import parser did not return valid JSON: ${error.message}\n${result.stdout}`.trim());
      return importsByFile;
    }

    for (const row of rows) {
      const file = row.file;
      for (const imported of row.imports ?? []) {
        if (imported !== "Init") {
          importsByFile.get(file)?.push(imported);
        }
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
  let mut rows := #[]
  for file in args do
    let header <- Lean.parseImports' (<- IO.FS.readFile file) file
    let imports := header.imports.map (fun imp => Json.str (toString imp.module))
    rows := rows.push (Json.mkObj [
      ("file", Json.str file),
      ("imports", Json.arr imports)
    ])
  IO.println (Json.compress (Json.arr rows))
  return 0
`;
}
