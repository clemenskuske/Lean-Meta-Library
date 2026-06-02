#!/usr/bin/env node
// Lake-backed helpers for tests that need package configuration facts.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { maxBuildOutputBytes } from "./common.mjs";

export function loadLakeConfig(packageDir, label, errors) {
  const tmp = mkdtempSync(join(tmpdir(), "lml-lake-config-"));
  const workDir = join(tmp, "package");
  const outFile = join(tmp, "lakefile.toml");

  try {
    prepareConfigCopy(packageDir, workDir);
    const result = spawnSync("lake", ["--dir", workDir, "translate-config", "toml", outFile], {
      encoding: "utf8",
      maxBuffer: maxBuildOutputBytes
    });

    if (result.error) {
      errors.push(`could not run Lake config translation for ${label}: ${result.error.message}`);
      return null;
    }
    if (result.status !== 0) {
      errors.push(`Lake failed to elaborate ${label}\n${result.stdout}${result.stderr}`.trim());
      return null;
    }

    return parseLakeToml(readFileSync(outFile, "utf8"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function prepareConfigCopy(packageDir, workDir) {
  mkdirSync(workDir, { recursive: true });

  const leanLakefile = join(packageDir, "lakefile.lean");
  const tomlLakefile = join(packageDir, "lakefile.toml");
  const toolchain = join(packageDir, "lean-toolchain");

  if (existsSync(leanLakefile)) {
    copyFileSync(leanLakefile, join(workDir, "lakefile.lean"));
  } else if (existsSync(tomlLakefile)) {
    copyFileSync(tomlLakefile, join(workDir, "lakefile.toml"));
  }

  if (existsSync(toolchain)) {
    copyFileSync(toolchain, join(workDir, "lean-toolchain"));
  }
}

export function lakeDependencies(config) {
  return (config?.requires ?? []).map((dependency) => {
    if (dependency.git) {
      return {
        kind: "git",
        name: dependency.name,
        url: dependency.git,
        ref: dependency.rev,
        subDir: dependency.subDir
      };
    }
    return {
      kind: "local",
      name: dependency.name,
      path: dependency.path
    };
  });
}

export function lakeModuleForFile(config, packageDir, file) {
  const absPackageDir = resolve(packageDir);
  const absFile = resolveFileForPackage(absPackageDir, packageDir, file);
  const rel = normalizePath(relative(absPackageDir, absFile));
  if (!rel.endsWith(".lean")) {
    return null;
  }

  for (const lib of config?.leanLibs ?? []) {
    const srcDir = normalizePath(lib.srcDir ?? ".");
    const relToSrc = stripPrefixPath(rel, srcDir);
    if (relToSrc === null) {
      continue;
    }

    const moduleName = relToSrc.replace(/\.lean$/i, "").split("/").join(".");
    if (moduleBelongsToLib(moduleName, lib)) {
      return moduleName;
    }
  }

  return null;
}

function resolveFileForPackage(absPackageDir, packageDir, file) {
  if (isAbsolute(file)) {
    return file;
  }

  const normalizedFile = normalizePath(file);
  const normalizedPackageDir = normalizePath(packageDir);
  if (normalizedPackageDir && normalizedFile.startsWith(`${normalizedPackageDir}/`)) {
    return resolve(file);
  }

  return resolve(absPackageDir, file);
}

export function hasLeanLib(config, predicate) {
  return (config?.leanLibs ?? []).some(predicate);
}

function parseLakeToml(source) {
  const config = {
    name: null,
    defaultTargets: [],
    requires: [],
    leanLibs: []
  };
  let section = config;

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    if (line === "[[require]]") {
      section = {};
      config.requires.push(section);
      continue;
    }
    if (line === "[[lean_lib]]") {
      section = {};
      config.leanLibs.push(section);
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }
    section[match[1]] = parseTomlValue(match[2]);
  }

  return config;
}

function parseTomlValue(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return [...trimmed.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => unescapeTomlString(match[1]));
  }
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return unescapeTomlString(trimmed.slice(1, -1));
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  return trimmed;
}

function unescapeTomlString(value) {
  return value.replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
}

export function normalizePath(path) {
  const normalized = String(path ?? "").trim().split(sep).join("/");
  return normalized.replace(/^\.?\//, "").replace(/\/$/g, "");
}

function stripPrefixPath(path, prefix) {
  if (!prefix || prefix === ".") {
    return path;
  }
  if (path === prefix) {
    return "";
  }
  if (path.startsWith(`${prefix}/`)) {
    return path.slice(prefix.length + 1);
  }
  return null;
}

function moduleBelongsToLib(moduleName, lib) {
  const roots = lib.roots ?? [];
  if (roots.length > 0) {
    return roots.some((root) => moduleName === root || moduleName.startsWith(`${root}.`));
  }

  const globs = lib.globs ?? [];
  if (globs.length > 0) {
    return globs.some((glob) => moduleMatchesGlob(moduleName, glob));
  }

  return moduleName === lib.name || moduleName.startsWith(`${lib.name}.`);
}

function moduleMatchesGlob(moduleName, glob) {
  if (glob.endsWith(".+")) {
    const prefix = glob.slice(0, -2);
    return moduleName === prefix || moduleName.startsWith(`${prefix}.`);
  }
  if (glob.endsWith(".*")) {
    const prefix = glob.slice(0, -2);
    return moduleName.startsWith(`${prefix}.`) && !moduleName.slice(prefix.length + 1).includes(".");
  }
  return moduleName === glob;
}
