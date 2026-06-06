#!/usr/bin/env node
// Final import-stage check: build the proof package in an isolated copy and inspect compiled proof targets.
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
import { basename, join, relative, sep } from "node:path";
import lmlEnv from "../../../lml-env.json" with { type: "json" };
import {
  loadContext,
  maxBuildOutputBytes,
  proofConstantForDeclaration,
  proofNamespaceForDeclaration,
  report,
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
    runLake(["clean"], "lake clean");
    fetchBuildCache();
    runLake(["build"], "lake build");
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

report("final proof build", errors, warnings);

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

function checkCompiledAxioms() {
  const proofTargets = proofTargetNames();
  if (proofTargets.length === 0) {
    warnings.push("no proof targets were found for final axiom inspection");
    return;
  }

  const modules = builtModuleNames();
  const inspector = join(isolatedPackageRoot, "FinalProofBuildInspect.lean");
  writeFileSync(
    inspector,
    finalProofBuildInspector({ modules, proofTargets, allowedMathlibAxioms }),
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
    errors.push(`final proof build has forbidden axioms or sorries\n${result.stdout}${result.stderr}`.trim());
  }
}

function proofTargetNames() {
  return (context.meta.proofs ?? [])
    .map((proof) => {
      const namespace = proofNamespaceForDeclaration(proof.declaration ?? "");
      const constant = proofConstantForDeclaration(proof.declaration ?? "");
      return namespace && constant ? `${namespace}.${constant}` : null;
    })
    .filter(isLeanName);
}

function builtModuleNames() {
  const lakeModules = lakeEmittedModuleNames();
  if (lakeModules.length > 0) {
    return lakeModules;
  }

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

function lakeEmittedModuleNames() {
  const outFile = join(isolatedPackageRoot, ".lake-build-mapping.json");
  const result = spawnSync("lake", ["build", "-o", outFile], {
    cwd: isolatedPackageRoot,
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });
  if (result.error || result.status !== 0 || !existsSync(outFile)) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(outFile, "utf8"));
  } catch {
    return [];
  }

  const artifactPaths = [];
  collectStrings(parsed, artifactPaths);
  return [...new Set(
    artifactPaths
      .filter((value) => value.endsWith(".olean"))
      .map((value) => moduleNameFromOleanPath(value))
      .filter(isLeanName)
      .filter((moduleName) => !isIgnoredModule(moduleName))
  )].sort();
}

function collectStrings(value, out) {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStrings(item, out);
    }
  }
}

function moduleNameFromOleanPath(path) {
  const normalized = String(path ?? "").split(sep).join("/");
  const marker = "/lib/lean/";
  const index = normalized.lastIndexOf(marker);
  const rel = index >= 0 ? normalized.slice(index + marker.length) : normalized;
  return rel.replace(/\.olean$/i, "").split("/").join(".");
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

function finalProofBuildInspector({ modules, proofTargets, allowedMathlibAxioms }) {
  const imports = modules.map((moduleName) => `import ${moduleName}`).join("\n");
  return `import Lean
import Lean.Util.CollectAxioms
${imports}

open Lean

def allowedBaseAxioms : Array Name := ${leanNameArray(allowedMathlibAxioms)}
def checkedProofTargets : Array Name := ${leanNameArray(proofTargets)}

def hasSurfaceStatementParts : List String -> Bool
  | "Surface" :: "Statement" :: _ => true
  | _ :: rest => hasSurfaceStatementParts rest
  | [] => false

def isSurfaceStatementName (name : Name) : Bool :=
  hasSurfaceStatementParts (name.components.map Name.toString)

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
  if isSurfaceStatementName axiomName then
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
    throwError "final proof build has forbidden axioms or missing proof targets"
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
