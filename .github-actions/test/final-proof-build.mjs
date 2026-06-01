#!/usr/bin/env node
// Final import-stage check: build the proof package in an isolated copy after
// rewriting Surface namespace references to Proofs references.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, relative, sep } from "node:path";
import {
  isConjectureProofEntry,
  loadContext,
  maxBuildOutputBytes,
  proofConstantForTheorem,
  proofNamespaceForTheorem,
  report,
  stripLeanCommentsAndStrings,
  walkFiles
} from "./common.mjs";

const context = loadContext();
const errors = [];
const warnings = [];
const tmpRoot = mkdtempSync(join(tmpdir(), "lml-final-proof-build-"));
const isolatedPackageRoot = join(tmpRoot, "package");
const keepTemp = process.env.LML_KEEP_FINAL_PROOF_BUILD_TMP === "1";

try {
  copyPackage(context.packageRoot, isolatedPackageRoot);

  if (spawnSync("lake", ["--version"], { encoding: "utf8" }).error) {
    errors.push("lake executable not found on PATH");
  } else {
    runLake(["update"], "lake update");
    rewriteSurfaceReferences();
    runLake(["clean"], "lake clean");
    const build = runLake(["build"], "lake build");
    checkBuildOutputForSorry(build);
    checkRewrittenSources();
    if (errors.length === 0) {
      checkCompiledAxioms();
    }
  }
} finally {
  if (keepTemp) {
    warnings.push(`kept isolated final proof build tree at ${isolatedPackageRoot}`);
  } else {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

report("final rewritten proof build", errors, warnings);

function copyPackage(from, to) {
  cpSync(from, to, {
    recursive: true,
    filter: (source) => {
      const name = basename(source);
      return name !== ".git" && name !== ".lake" && name !== "node_modules";
    }
  });
}

function runLake(args, label) {
  const result = spawnSync("lake", args, {
    cwd: isolatedPackageRoot,
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });

  if (result.error) {
    errors.push(`${label} failed to start: ${result.error.message}`);
    return result;
  }

  if (result.status !== 0) {
    errors.push(`${label} failed\n${result.stdout}${result.stderr}`.trim());
  }

  return result;
}

function rewriteSurfaceReferences() {
  let changed = 0;
  for (const file of walkFilesIncludingLake(isolatedPackageRoot)) {
    if (!isRewritableTextFile(file)) {
      continue;
    }

    const before = readFileSync(file, "utf8");
    const after = before.replace(/\.Surface\./g, ".Proofs.");
    if (after !== before) {
      writeFileSync(file, after, "utf8");
      changed += 1;
    }
  }

  if (changed === 0) {
    warnings.push("no literal .Surface. references were rewritten before the final proof build");
  }
}

function walkFilesIncludingLake(root) {
  return walkFiles(root, { ignoreDirs: new Set([".git", "node_modules"]) }).filter((file) => {
    const rel = relativePath(root, file);
    return !rel.startsWith(".lake/build/");
  });
}

function isRewritableTextFile(file) {
  const extension = extname(file);
  return (
    [".lean", ".json", ".toml", ".yaml", ".yml", ".md", ".txt"].includes(extension) ||
    basename(file) === "lakefile.lean" ||
    basename(file) === "lean-toolchain"
  );
}

function checkBuildOutputForSorry(result) {
  const output = `${result?.stdout ?? ""}${result?.stderr ?? ""}`;
  if (/\bdeclaration uses ['`]sorry['`]/i.test(output) || /\bsorryAx\b/.test(output)) {
    errors.push("rewritten proof build output reports a sorry");
  }
}

function checkRewrittenSources() {
  for (const file of checkedLeanSourceFiles()) {
    const source = readFileSync(file, "utf8");
    const stripped = stripLeanCommentsAndStrings(source);
    const label = relativePath(isolatedPackageRoot, file);

    if (/\bsorry\b/.test(stripped)) {
      errors.push(`rewritten build source contains sorry: ${label}`);
    }
    if (/\badmit\b/.test(stripped)) {
      errors.push(`rewritten build source contains admit: ${label}`);
    }
  }
}

function checkedLeanSourceFiles() {
  return walkFilesIncludingLake(isolatedPackageRoot).filter((file) => {
    if (extname(file) !== ".lean") {
      return false;
    }
    const rel = relativePath(isolatedPackageRoot, file);
    if (!rel.startsWith(".lake/packages/")) {
      return true;
    }
    return !isIgnoredLakePackage(rel.split("/")[2] ?? "");
  });
}

function isIgnoredLakePackage(packageName) {
  return new Set([
    "aesop",
    "batteries",
    "cli",
    "importgraph",
    "leansearchclient",
    "mathlib",
    "plausible",
    "proofwidgets",
    "qq",
    "std"
  ]).has(String(packageName).toLowerCase());
}

function checkCompiledAxioms() {
  const proofTargets = proofTargetNames();
  const declaredAxioms = declaredAxiomNames();
  if (proofTargets.length === 0 && declaredAxioms.length === 0) {
    warnings.push("no proof targets or declared axioms were found for final axiom inspection");
    return;
  }

  const modules = builtModuleNames();
  const inspector = join(isolatedPackageRoot, "FinalProofBuildInspect.lean");
  writeFileSync(inspector, finalProofBuildInspector({ modules, proofTargets, declaredAxioms }), "utf8");

  const result = spawnSync("lake", ["lean", inspector], {
    cwd: isolatedPackageRoot,
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });

  if (result.error) {
    errors.push(`could not run final axiom inspector: ${result.error.message}`);
    return;
  }
  if (result.status !== 0) {
    errors.push(`final rewritten proof build has forbidden axioms or sorries\n${result.stdout}${result.stderr}`.trim());
  }
}

function proofTargetNames() {
  return (context.meta.proofs ?? [])
    .filter((proof) => !isConjectureProofEntry(proof))
    .map((proof) => {
      const namespace = proofNamespaceForTheorem(proof.theorem ?? "");
      const constant = proofConstantForTheorem(proof.theorem ?? "");
      return namespace && constant ? `${namespace}.${constant}` : null;
    })
    .filter(isLeanName);
}

function declaredAxiomNames() {
  const names = new Set();
  for (const file of checkedLeanSourceFiles()) {
    const stripped = stripLeanCommentsAndStrings(readFileSync(file, "utf8"));
    for (const name of declaredAxiomsInSource(stripped)) {
      if (isLeanName(name)) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

function declaredAxiomsInSource(source) {
  const names = [];
  const namespaces = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const namespace = line.match(/^namespace\s+(.+?)\s*$/);
    if (namespace) {
      namespaces.push(namespace[1].trim());
      continue;
    }

    const axiom = line.match(/^(?:protected\s+|private\s+)?axiom\s+([A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*)\b/);
    if (axiom) {
      const name = axiom[1];
      names.push(name.includes(".") || namespaces.length === 0 ? name : `${namespaces.join(".")}.${name}`);
      continue;
    }

    if (/^end(?:\s+.+)?\s*$/.test(line) && namespaces.length > 0) {
      namespaces.pop();
    }
  }

  return names;
}

function builtModuleNames() {
  const names = new Set();
  for (const root of buildLibraryRoots()) {
    for (const file of walkFiles(root, { ignoreDirs: new Set() })) {
      if (!file.endsWith(".olean")) {
        continue;
      }
      const moduleName = relativePath(root, file).replace(/\.olean$/i, "").split("/").join(".");
      if (isLeanName(moduleName) && !isIgnoredModule(moduleName)) {
        names.add(moduleName);
      }
    }
  }
  return [...names].sort();
}

function buildLibraryRoots() {
  const roots = [];
  const rootBuild = join(isolatedPackageRoot, ".lake/build/lib/lean");
  if (existsSync(rootBuild)) {
    roots.push(rootBuild);
  }

  const packagesRoot = join(isolatedPackageRoot, ".lake/packages");
  if (existsSync(packagesRoot)) {
    for (const packageRoot of walkDirs(packagesRoot)) {
      const buildRoot = join(packageRoot, ".lake/build/lib/lean");
      if (existsSync(buildRoot)) {
        roots.push(buildRoot);
      }
    }
  }

  return roots;
}

function walkDirs(root) {
  const dirs = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      dirs.push(join(root, entry.name));
    }
  }
  return dirs;
}

function isIgnoredModule(moduleName) {
  return [
    "Aesop",
    "Batteries",
    "Cli",
    "ImportGraph",
    "Init",
    "Lake",
    "Lean",
    "LeanSearchClient",
    "Mathlib",
    "Plausible",
    "ProofWidgets",
    "Qq",
    "Std"
  ].some((prefix) => moduleName === prefix || moduleName.startsWith(`${prefix}.`));
}

function finalProofBuildInspector({ modules, proofTargets, declaredAxioms }) {
  const imports = modules.map((moduleName) => `import ${moduleName}`).join("\n");
  return `import Lean
import Lean.Util.CollectAxioms
${imports}

open Lean

def allowedBaseAxioms : Array Name := #[\`propext, \`Quot.sound, \`Classical.choice]
def checkedProofTargets : Array Name := ${leanNameArray(proofTargets)}
def checkedDeclaredAxioms : Array Name := ${leanNameArray(declaredAxioms)}

def sameAxiomType (candidate allowed : ConstantInfo) : CoreM Bool := do
  if candidate.levelParams.length != allowed.levelParams.length then
    return false
  let levels := (List.range candidate.levelParams.length).map (fun index => Level.param (Name.mkSimple s!"u{index}"))
  let candidateType := candidate.type.instantiateLevelParams candidate.levelParams levels
  let allowedType := allowed.type.instantiateLevelParams allowed.levelParams levels
  Meta.MetaM.run' do
    Meta.isExprDefEq candidateType allowedType

def isAllowedBaseAxiomByType (name : Name) : CoreM Bool := do
  let info <- getConstInfo name
  match info with
  | .axiomInfo _ =>
      for allowedName in allowedBaseAxioms do
        let allowedInfo <- getConstInfo allowedName
        if (← sameAxiomType info allowedInfo) then
          return true
      return false
  | _ => return false

def checkAxiom (label : String) (owner : Name) (axiomName : Name) : CoreM Bool := do
  if (← isAllowedBaseAxiomByType axiomName) then
    return false
  let axiomInfo <- getConstInfo axiomName
  let typeText <- Meta.MetaM.run' do
    Meta.ppExpr axiomInfo.type
  IO.eprintln s!"FORBIDDEN_AXIOM\\t{label}\\t{owner}\\t{axiomName}\\t{typeText}"
  return true

#eval show CoreM Unit from do
  let mut failed := false

  for axiomName in checkedDeclaredAxioms do
    try
      let info <- getConstInfo axiomName
      match info with
      | .axiomInfo _ =>
          if (← checkAxiom "declared" axiomName axiomName) then
            failed := true
      | _ =>
          IO.eprintln s!"DECLARED_AXIOM_NOT_AXIOM\\t{axiomName}"
          failed := true
    catch error =>
      let message <- error.toMessageData.toString
      IO.eprintln s!"DECLARED_AXIOM_NOT_FOUND\\t{axiomName}\\t{message}"
      failed := true

  for proofName in checkedProofTargets do
    try
      let _ <- getConstInfo proofName
      let axioms <- collectAxioms proofName
      for axiomName in axioms do
        if (← checkAxiom "dependency" proofName axiomName) then
          failed := true
    catch error =>
      let message <- error.toMessageData.toString
      IO.eprintln s!"PROOF_TARGET_NOT_FOUND\\t{proofName}\\t{message}"
      failed := true

  if failed then
    throwError "final rewritten proof build has forbidden axioms or missing proof targets"
`;
}

function leanNameArray(names) {
  return `#[${names.filter(isLeanName).map((name) => `\`${name}`).join(", ")}]`;
}

function isLeanName(name) {
  return /^[A-Za-z_][A-Za-z0-9_']*(\.[A-Za-z_][A-Za-z0-9_']*)*$/.test(String(name ?? ""));
}

function relativePath(root, path) {
  return relative(root, path).split(sep).join("/");
}
