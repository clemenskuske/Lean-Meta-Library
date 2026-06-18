#!/usr/bin/env node
// Lean-backed inspectors used by the submission checks.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { maxBuildOutputBytes } from "./common.mjs";

export function runLeanJson({ source, args = [], label, errors, cwd = null, lakeDir = null }) {
  const tmp = mkdtempSync(join(tmpdir(), "lml-lean-json-"));
  const inspector = join(tmp, "Inspect.lean");

  try {
    writeFileSync(inspector, source, "utf8");
    const command = lakeDir ? "lake" : "lean";
    const commandArgs = lakeDir
      ? ["--dir", lakeDir, "env", "lean", "--run", inspector, ...args]
      : ["--run", inspector, ...args];
    const result = spawnSync(command, commandArgs, {
      cwd: cwd ?? lakeDir ?? undefined,
      encoding: "utf8",
      env: { ...process.env, MATHLIB_NO_CACHE_ON_UPDATE: "1" },
      maxBuffer: maxBuildOutputBytes
    });

    if (result.error) {
      errors.push(`could not run Lean inspector for ${label}: ${result.error.message}`);
      return null;
    }
    if (result.status !== 0) {
      errors.push(`Lean inspector failed for ${label}\n${result.stdout}${result.stderr}`.trim());
      return null;
    }

    try {
      return JSON.parse(jsonPayload(result.stdout));
    } catch (error) {
      errors.push(`Lean inspector for ${label} did not return valid JSON: ${error.message}\n${result.stdout}`.trim());
      return null;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function jsonPayload(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return "null";
  }
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return [...lines].reverse().find((line) => line.startsWith("{") || line.startsWith("[")) ?? trimmed;
}

export function inspectIntroducedDeclarations({ packageDir, moduleName, imports, label, errors, build = true }) {
  if (!isLeanName(moduleName) || !imports.every(isLeanName)) {
    errors.push(`invalid Lean module name while inspecting ${label}`);
    return null;
  }

  if (build) {
    const result = spawnSync("lake", ["--dir", packageDir, "build", moduleName], {
      encoding: "utf8",
      maxBuffer: maxBuildOutputBytes
    });
    if (result.error) {
      errors.push(`could not build ${moduleName} before inspecting ${label}: ${result.error.message}`);
      return null;
    }
    if (result.status !== 0) {
      errors.push(`Lean failed to build ${moduleName} before inspecting ${label}\n${result.stdout}${result.stderr}`.trim());
      return null;
    }
  }

  return runLeanJson({
    source: introducedDeclarationsSource({ moduleName, imports }),
    label,
    errors,
    lakeDir: packageDir
  });
}

export function inspectCommandSyntax({ file, label, errors, lakeDir = null }) {
  return runLeanJson({
    source: commandSyntaxSource(),
    args: [file],
    label,
    errors,
    lakeDir
  });
}

export function isLeanName(name) {
  return /^[A-Za-z_][A-Za-z0-9_']*(\.[A-Za-z_][A-Za-z0-9_']*)*$/.test(String(name ?? ""));
}

function introducedDeclarationsSource({ moduleName, imports }) {
  const beforeImports = unique(imports).map(leanImportLiteral).join(", ");
  const afterImports = unique([...imports, moduleName]).map(leanImportLiteral).join(", ");

  return `import Lean
import Lean.Meta.Instances
import Lean.Util.CollectAxioms
open Lean

def kindOf : ConstantInfo -> String
  | .axiomInfo _ => "axiom"
  | .defnInfo _ => "definition"
  | .thmInfo _ => "theorem"
  | .opaqueInfo _ => "opaque"
  | .quotInfo _ => "quot"
  | .inductInfo _ => "inductive"
  | .ctorInfo _ => "constructor"
  | .recInfo _ => "recursor"

def isAbbrev : ConstantInfo -> Bool
  | .defnInfo val => val.hints == ReducibilityHints.abbrev
  | _ => false

def isUnsafe : ConstantInfo -> Bool
  | .defnInfo val => val.safety == DefinitionSafety.unsafe
  | _ => false

def nameJson (name : Name) : Json := Json.str (toString name)

def stringArrayJson (items : Array String) : Json :=
  Json.arr (items.map Json.str)

def declarationJson (env : Environment) (name : Name) (info : ConstantInfo) : CoreM Json := do
  let axioms <- collectAxioms name
  return Json.mkObj [
    ("name", nameJson name),
    ("kind", Json.str (kindOf info)),
    ("isInstance", Json.bool (Lean.Meta.isInstanceCore env name)),
    ("isAbbrev", Json.bool (isAbbrev info)),
    ("isUnsafe", Json.bool (isUnsafe info)),
    ("axioms", Json.arr (axioms.map nameJson))
  ]

def main : IO UInt32 := do
  let before <- importModules #[${beforeImports}] {}
  let after <- importModules #[${afterImports}] {}
  let coreCtx : Core.Context := { fileName := "Inspect.lean", fileMap := default }
  let coreState : Core.State := { env := after }
  let (rows, _) <- Core.CoreM.toIO (ctx := coreCtx) (s := coreState) do
    let mut rows := #[]
    for (name, info) in after.constants.toList do
      if !before.constants.contains name then
        rows := rows.push (← declarationJson after name info)
    return rows
  IO.println (Json.compress (Json.arr rows))
  return 0
`;
}

function commandSyntaxSource() {
  return `import Lean
open Lean

partial def collectSyntax (stx : Syntax) : Array Json :=
  let current := Json.mkObj [
    ("kind", Json.str (toString stx.getKind)),
    ("ident", if stx.isIdent then Json.str (toString stx.getId) else Json.null),
    ("atom", if stx.isAtom then Json.str stx.getAtomVal else Json.null)
  ]
  #[current] ++ stx.getArgs.flatMap collectSyntax

def main (args : List String) : IO UInt32 := do
  let mut rows := #[]
  for file in args do
    let source <- IO.FS.readFile file
    let inputCtx := Parser.mkInputContext source file
    let (_, parserState, messages) <- Parser.parseHeader inputCtx
    let header <- Lean.parseImports' source file
    let env <- try
      importModules header.imports {} 0
    catch _ =>
      importModules #[] {} 0
    let pmctx : Parser.ParserModuleContext := {env := env, options := {}}
    let mut state := parserState
    let mut log := messages
    let mut commands := #[]
    let mut syntaxNodes := #[]
    while state.pos < source.rawEndPos do
      let (command, nextState, nextLog) := Parser.parseCommand inputCtx pmctx state log
      if !Parser.isTerminalCommand command then
        commands := commands.push (Json.str (toString command.getKind))
        syntaxNodes := syntaxNodes ++ collectSyntax command
      state := nextState
      log := nextLog
    rows := rows.push (Json.mkObj [
      ("file", Json.str file),
      ("commands", Json.arr commands),
      ("syntax", Json.arr syntaxNodes),
      ("messages", Json.num log.toList.length)
    ])
  IO.println (Json.compress (Json.arr rows))
  return 0
`;
}

function leanImportLiteral(moduleName) {
  return `{module := \`${moduleName}}`;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
