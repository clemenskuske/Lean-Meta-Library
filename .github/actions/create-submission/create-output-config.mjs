#!/usr/bin/env node
// Step 1 of the submission pipeline: writes an enriched copy of manifest.yaml to
// output.config.<key>.yaml in the same directory.
//
// Later pipeline steps will augment this file with repo information and run the
// full build suite against it. Keeping the file around on failure lets you
// inspect exactly what input was handed to the checker.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

/**
 * Creates output.config.<key>.yaml next to manifestPath by enriching it.
 * Returns the path of the created file.
 */
export function createOutputConfig(manifestPath, key) {
  const outputPath = join(dirname(manifestPath), `output.config.${key}.yaml`);
  writeOutputConfig(manifestPath, outputPath);
  return outputPath;
}

export function writeOutputConfig(manifestPath, outputPath) {
  const source = readFileSync(manifestPath, "utf8");
  const manifestRoot = dirname(manifestPath);
  let manifest;

  try {
    manifest = YAML.parse(source || "") ?? {};
  } catch {
    writeFileSync(outputPath, source, "utf8");
    return;
  }

  const enriched = enrichSubmissionConfig(manifest, manifestRoot);
  writeFileSync(outputPath, YAML.stringify(enriched, { lineWidth: 0 }), "utf8");
}

export function enrichSubmissionConfig(manifest, manifestRoot) {
  const statementSubmissions = manifest.StatementSubmissions;
  if (!statementSubmissions || !Array.isArray(statementSubmissions.statements)) {
    return manifest;
  }

  return {
    ...manifest,
    StatementSubmissions: {
      ...statementSubmissions,
      statements: statementSubmissions.statements.map((entry) =>
        enrichStatementEntry(entry, statementSubmissions.rootFolder, manifestRoot)
      )
    }
  };
}

function enrichStatementEntry(entry, statementRoot, manifestRoot) {
  if (!entry || typeof entry !== "object") {
    return entry;
  }

  const next = { ...entry };
  const paths = statementPathsForEntry(entry, statementRoot);

  if (!hasText(next.InlineTexReference)) {
    const tex = readManifestRelativeFile(manifestRoot, entry.Statement?.LatexDefinition ?? paths.tex);
    if (hasText(tex)) {
      next.InlineTexReference = tex.trim();
    }
  }

  if (!hasText(next.InlineLeanStatement)) {
    const lean = readManifestRelativeFile(manifestRoot, entry.Statement?.LeanStatement ?? paths.lean);
    const declaration = hasText(lean) ? extractLeanDeclaration(lean, entry.Name) : null;
    if (hasText(declaration)) {
      next.InlineLeanStatement = declaration.trim();
    }
  }

  return next;
}

function statementPathsForEntry(entry, statementRoot) {
  const name = String(entry?.Name ?? "");
  const segments = name.split(".").filter(Boolean);
  const modulePath = segments.length > 1 ? segments.slice(0, -1).join("/") : null;
  const prefix = rootPathPrefix(statementRoot);

  return {
    lean: modulePath ? `${prefix}${modulePath}.lean` : null,
    tex: modulePath ? `${prefix}${modulePath}.tex` : null
  };
}

function rootPathPrefix(statementRoot) {
  if (!statementRoot || statementRoot === ".") {
    return "";
  }
  const normalized = String(statementRoot).trim().replace(/^\.\//, "").replace(/\/$/, "");
  return normalized ? `${normalized}/` : "";
}

function readManifestRelativeFile(manifestRoot, relativePath) {
  if (!relativePath || typeof relativePath !== "string") {
    return null;
  }

  const absolute = resolve(manifestRoot, relativePath);
  const root = resolve(manifestRoot);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
    return null;
  }
  if (!existsSync(absolute)) {
    return null;
  }
  return readFileSync(absolute, "utf8");
}

function extractLeanDeclaration(source, fullName) {
  if (!fullName) {
    return null;
  }

  const sanitized = maskLeanNonCode(source);
  const commands = leanCommandRanges(sanitized, source.length);
  const scopes = [];
  let fallback = null;

  for (const command of commands) {
    const text = sanitized.slice(command.start, command.end);
    const kind = firstCommandKind(text);

    if (kind === "namespace") {
      const namespaceName = commandName(text, "namespace");
      if (namespaceName) {
        scopes.push({ kind: "namespace", name: namespaceName });
      }
      continue;
    }

    if (kind === "section") {
      scopes.push({ kind: "section", name: commandName(text, "section") });
      continue;
    }

    if (kind === "end") {
      closeScope(scopes, commandName(text, "end"));
      continue;
    }

    if (!isDeclarationKind(kind)) {
      continue;
    }

    const declarationName = commandName(text, kind);
    if (!declarationName) {
      continue;
    }

    const resolvedName = resolveDeclarationName(scopes, declarationName);
    const exact = declarationName === fullName || resolvedName === fullName;
    const suffix = fullName.endsWith(`.${declarationName}`);
    if (exact) {
      return source.slice(command.start, command.end).trim();
    }
    if (!fallback && suffix) {
      fallback = source.slice(command.start, command.end).trim();
    }
  }

  return fallback;
}

function maskLeanNonCode(source) {
  const chars = source.split("");
  let index = 0;
  let blockDepth = 0;
  let inString = false;

  while (index < chars.length) {
    const current = chars[index];
    const next = chars[index + 1];

    if (blockDepth > 0) {
      if (current === "/" && next === "-") {
        chars[index] = " ";
        chars[index + 1] = " ";
        blockDepth += 1;
        index += 2;
        continue;
      }
      if (current === "-" && next === "/") {
        chars[index] = " ";
        chars[index + 1] = " ";
        blockDepth -= 1;
        index += 2;
        continue;
      }
      if (current !== "\n") {
        chars[index] = " ";
      }
      index += 1;
      continue;
    }

    if (inString) {
      if (current === "\\" && next) {
        chars[index] = " ";
        if (next !== "\n") {
          chars[index + 1] = " ";
        }
        index += 2;
        continue;
      }
      if (current === "\"") {
        inString = false;
      }
      if (current !== "\n") {
        chars[index] = " ";
      }
      index += 1;
      continue;
    }

    if (current === "-" && next === "-") {
      while (index < chars.length && chars[index] !== "\n") {
        chars[index] = " ";
        index += 1;
      }
      continue;
    }
    if (current === "/" && next === "-") {
      chars[index] = " ";
      chars[index + 1] = " ";
      blockDepth = 1;
      index += 2;
      continue;
    }
    if (current === "\"") {
      chars[index] = " ";
      inString = true;
    }
    index += 1;
  }

  return chars.join("");
}

function leanCommandRanges(sanitized, sourceLength) {
  const starts = [];
  const startPattern = /(^|\n)[ \t]*(?:@\[[\s\S]*?\][ \t]*(?:\n[ \t]*)?)*(?:(?:noncomputable|unsafe|protected|private|partial)\s+)*(namespace|section|end|axiom|def|theorem|opaque|abbrev|instance|inductive|structure|class)\b/g;
  let match;
  while ((match = startPattern.exec(sanitized)) !== null) {
    starts.push(match.index + match[1].length);
  }

  return starts.map((start, index) => ({
    start,
    end: starts[index + 1] ?? sourceLength
  }));
}

function firstCommandKind(commandText) {
  return commandText.match(/\b(namespace|section|end|axiom|def|theorem|opaque|abbrev|instance|inductive|structure|class)\b/)?.[1] ?? null;
}

function commandName(commandText, kind) {
  const afterKind = commandText.slice(commandText.indexOf(kind) + kind.length);
  return afterKind.match(/\s+([A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*)/)?.[1] ?? null;
}

function isDeclarationKind(kind) {
  return ["axiom", "def", "theorem", "opaque", "abbrev", "instance", "inductive", "structure", "class"].includes(kind);
}

function resolveDeclarationName(scopes, declarationName) {
  const prefix = scopes
    .filter((scope) => scope.kind === "namespace")
    .map((scope) => scope.name)
    .filter(Boolean)
    .join(".");
  return prefix ? `${prefix}.${declarationName}` : declarationName;
}

function closeScope(scopes, name) {
  if (scopes.length === 0) {
    return;
  }
  if (!name || scopes.at(-1)?.name === name) {
    scopes.pop();
    return;
  }
  const index = scopes.findLastIndex((scope) => scope.name === name);
  if (index >= 0) {
    scopes.splice(index);
  } else {
    scopes.pop();
  }
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Standalone:
//   node create-output-config.mjs --manifest=<path> --key=<key>
//   node create-output-config.mjs --manifest=<path> --output=<path>
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let manifestPath = null;
  let key = null;
  let outputPath = null;

  for (const arg of args) {
    if (arg.startsWith("--manifest=")) {
      manifestPath = arg.slice("--manifest=".length);
    } else if (arg.startsWith("--key=")) {
      key = arg.slice("--key=".length);
    } else if (arg.startsWith("--output=")) {
      outputPath = arg.slice("--output=".length);
    }
  }

  if (!manifestPath || (!key && !outputPath)) {
    console.error("Usage: create-output-config.mjs --manifest=<path> (--key=<key>|--output=<path>)");
    process.exit(1);
  }

  const output = outputPath ?? createOutputConfig(manifestPath, key);
  if (outputPath) {
    writeOutputConfig(manifestPath, outputPath);
  }
  console.log(`Created: ${output}`);
}
