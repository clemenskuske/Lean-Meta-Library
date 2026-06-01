#!/usr/bin/env node
// Final import-stage check: build the proof package in an isolated copy after
// removing theorem surface declarations and rewriting theorem references to proofs.
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
import { basename, dirname, extname, join, relative, sep } from "node:path";
import lmlEnv from "../../lml-env.json" with { type: "json" };
import {
  isConjectureProofEntry,
  loadContext,
  maxBuildOutputBytes,
  parseMetaYaml,
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
const configuredAllowedMathlibAxioms = (lmlEnv.checks?.allowedMathlibAxioms ?? []).map(String);
const allowedMathlibAxioms = configuredAllowedMathlibAxioms.filter(isLeanName);
const invalidAllowedMathlibAxioms = configuredAllowedMathlibAxioms.filter((name) => !isLeanName(name));

try {
  copyPackage(context.packageRoot, isolatedPackageRoot);

  if (spawnSync("lake", ["--version"], { encoding: "utf8" }).error) {
    errors.push("lake executable not found on PATH");
  } else if (invalidAllowedMathlibAxioms.length > 0) {
    errors.push(`lml-env.json checks.allowedMathlibAxioms contains invalid Lean names: ${invalidAllowedMathlibAxioms.join(", ")}`);
  } else if (allowedMathlibAxioms.length === 0) {
    errors.push("lml-env.json checks.allowedMathlibAxioms must list at least one Lean axiom name");
  } else {
    runLake(["update"], "lake update");
    removeSurfaceTheoremDeclarations();
    rewriteProofTheoremReferences();
    runLake(["clean"], "lake clean");
    fetchBuildCache();
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

function fetchBuildCache() {
  const result = spawnSync("lake", ["exe", "cache", "get"], {
    cwd: isolatedPackageRoot,
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });

  if (result.error) {
    warnings.push(`lake exe cache get failed to start; final proof build will build from source: ${result.error.message}`);
    return;
  }
  if (result.status !== 0) {
    warnings.push("lake exe cache get failed; final proof build will build from source");
  }
}

function removeSurfaceTheoremDeclarations() {
  let changed = 0;
  for (const { root, meta } of metadataContexts()) {
    for (const entry of meta.surfaceEntries ?? []) {
      if (entry.type !== "Theorem" || !entry.folder) {
        continue;
      }

      const surfaceFile = join(root, entry.folder, "Surface.lean");
      if (!existsSync(surfaceFile)) {
        continue;
      }

      const before = readFileSync(surfaceFile, "utf8");
      const after = stripTheoremDeclarations(before);
      if (after !== before) {
        writeFileSync(surfaceFile, after, "utf8");
        changed += 1;
      }
    }
  }

  if (changed === 0) {
    warnings.push("no Surface.Theorem declarations were removed before the final proof build");
  }
}

function rewriteProofTheoremReferences() {
  let changed = 0;
  for (const file of walkFilesIncludingLake(isolatedPackageRoot)) {
    if (!isProofSideLeanFile(file)) {
      continue;
    }

    const before = readFileSync(file, "utf8");
    const after = before.replace(/\.Surface\.Theorem\./g, ".Proofs.Theorem.");
    if (after !== before) {
      writeFileSync(file, after, "utf8");
      changed += 1;
    }
  }

  if (changed === 0) {
    warnings.push("no proof-side .Surface.Theorem. references were rewritten before the final proof build");
  }
}

function stripTheoremDeclarations(source) {
  const lines = source.split(/\r?\n/);
  const kept = [];
  let skipping = false;

  for (const line of lines) {
    if (!skipping && /^(?:\s*)(?:protected\s+|private\s+)?(?:axiom|theorem)\s+[A-Za-z_][A-Za-z0-9_']*\b/.test(line)) {
      while (kept.at(-1)?.trim().startsWith("@[")) {
        kept.pop();
      }
      skipping = true;
      continue;
    }

    if (skipping) {
      if (/^\s*end(?:\s+.+)?\s*$/.test(line)) {
        skipping = false;
        kept.push(line);
      }
      continue;
    }

    kept.push(line);
  }

  return kept.join("\n");
}

function walkFilesIncludingLake(root) {
  return walkFiles(root, { ignoreDirs: new Set([".git", "node_modules"]) }).filter((file) => {
    const rel = relativePath(root, file);
    return !rel.startsWith(".lake/build/");
  });
}

function isProofSideLeanFile(file) {
  if (extname(file) !== ".lean") {
    return false;
  }
  const rel = relativePath(isolatedPackageRoot, file);
  return !rel.split("/").includes("surface-package") && !isIgnoredLakePackage(rel.split("/")[2] ?? "");
}

function metadataContexts() {
  const contexts = [{ root: isolatedPackageRoot, meta: context.meta }];
  for (const file of walkFilesIncludingLake(isolatedPackageRoot)) {
    if (basename(file) !== "meta.yaml") {
      continue;
    }
    const root = dirname(file);
    if (root === isolatedPackageRoot) {
      continue;
    }
    contexts.push({ root, meta: parseMetaYaml(readFileSync(file, "utf8")) });
  }
  return contexts;
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
  const allowedConjectureAxioms = declaredAxioms.filter((name) => name.includes(".Surface.Conjecture."));
  if (proofTargets.length === 0 && declaredAxioms.length === 0) {
    warnings.push("no proof targets or declared axioms were found for final axiom inspection");
    return;
  }

  const modules = builtModuleNames();
  const inspector = join(isolatedPackageRoot, "FinalProofBuildInspect.lean");
  writeFileSync(
    inspector,
    finalProofBuildInspector({ modules, proofTargets, declaredAxioms, allowedMathlibAxioms, allowedConjectureAxioms }),
    "utf8"
  );

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
  for (const { root, dependency } of buildLibraryRoots()) {
    for (const file of walkFiles(root, { ignoreDirs: new Set() })) {
      if (!file.endsWith(".olean")) {
        continue;
      }
      const moduleName = relativePath(root, file).replace(/\.olean$/i, "").split("/").join(".");
      if (
        isLeanName(moduleName) &&
        !isIgnoredModule(moduleName) &&
        !(dependency && isIgnoredDependencyModule(moduleName))
      ) {
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
    roots.push({ root: rootBuild, dependency: false });
  }

  const packagesRoot = join(isolatedPackageRoot, ".lake/packages");
  if (existsSync(packagesRoot)) {
    for (const packageRoot of walkDirs(packagesRoot)) {
      const buildRoot = join(packageRoot, ".lake/build/lib/lean");
      if (existsSync(buildRoot)) {
        roots.push({ root: buildRoot, dependency: true });
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

function isIgnoredDependencyModule(moduleName) {
  return moduleName === "Cache" || moduleName.startsWith("Cache.");
}

function finalProofBuildInspector({ modules, proofTargets, declaredAxioms, allowedMathlibAxioms, allowedConjectureAxioms }) {
  const imports = modules.map((moduleName) => `import ${moduleName}`).join("\n");
  return `import Lean
import Lean.Util.CollectAxioms
${imports}

open Lean

def allowedBaseAxioms : Array Name := ${leanNameArray(allowedMathlibAxioms)}
def allowedConjectureAxioms : Array Name := ${leanNameArray(allowedConjectureAxioms)}
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
  if allowedConjectureAxioms.contains axiomName then
    return false
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
