// Manifest path parsing and context loading for submission checks.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import YAML from "yaml";
import lmlEnv from "../../../../lml-env.json" with { type: "json" };

export const defaultManifestPath = String(lmlEnv.submission?.defaultManifestPath ?? "manifest.yaml");

export function loadContext(argv = process.argv.slice(2)) {
  const manifestPath = resolveManifestPath(parseManifestArg(argv));
  if (existsSync(manifestPath) && !statSync(manifestPath).isFile()) {
    throw new Error(`Manifest path must be a file: ${manifestPath}`);
  }

  const packageRoot = dirname(manifestPath);
  const manifestText = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : "";
  const manifest = parseManifestYaml(manifestText);
  const namespaceRoot = inferNamespaceRoot(manifest);

  return { packageRoot, manifestPath, manifestText, manifest, namespaceRoot };
}

function parseManifestArg(argv) {
  const args = [...argv];
  const positional = [];
  let manifestPath = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--manifest") {
      if (manifestPath) {
        throw new Error("Use one manifest file argument, for example: --manifest=path/to/manifest.yaml.");
      }
      manifestPath = args[index + 1];
      index += 1;
      if (!manifestPath) {
        throw new Error("Missing manifest path after --manifest.");
      }
      continue;
    }
    if (arg.startsWith("--manifest=")) {
      if (manifestPath) {
        throw new Error("Use one manifest file argument, for example: --manifest=path/to/manifest.yaml.");
      }
      manifestPath = arg.slice("--manifest=".length);
      if (!manifestPath) {
        throw new Error("Missing manifest path after --manifest=.");
      }
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown checker option: ${arg}`);
    }
    positional.push(arg);
  }

  if (positional.length > 1 || (manifestPath && positional.length > 0)) {
    throw new Error("Use one manifest file argument, for example: --manifest=path/to/manifest.yaml.");
  }

  const selected = manifestPath ?? positional[0] ?? defaultManifestPath;
  if (!isManifestFile(selected)) {
    throw new Error("Use a manifest .yaml or .yml file path.");
  }
  return selected;
}

export function resolveManifestPath(manifestPath) {
  return isAbsolute(manifestPath) ? manifestPath : resolve(process.cwd(), manifestPath);
}

function isManifestFile(path) {
  return /\.ya?ml$/i.test(path);
}

export function parseManifestYaml(text) {
  const parsed = YAML.parse(text || "") ?? {};
  const base = {
    declarations: [],
    statements: [],
    proofs: [],
    paper: {},
    ...parsed
  };

  // Normalize new-format fields (PascalCase / nested) to the internal camelCase
  // flat shape that checkers use. Old-format fields take precedence when present.
  if (parsed.SubmissionSlug && !parsed.submissionSlug) {
    base.submissionSlug = parsed.SubmissionSlug;
  }
  if (parsed.SubmissionName && !parsed.submissionName) {
    base.submissionName = parsed.SubmissionName;
  }
  if (parsed.AbstractPath && !parsed.abstractPath) {
    base.abstractPath = parsed.AbstractPath;
  }
  if (parsed.LicenseFile && !parsed.licensePath) {
    base.licensePath = parsed.LicenseFile;
  }

  const stmtSub = parsed.StatementSubmissions;
  if (stmtSub && !parsed.statementRoot) {
    base.statementRoot = stmtSub.rootFolder;
    if (!parsed.statements || parsed.statements.length === 0) {
      base.statements = (stmtSub.statements ?? []).map(
        (entry) => normalizeStatementEntry(entry, stmtSub.rootFolder)
      );
    }
  }

  const proofSub = parsed.ProofSubmissions;
  if (proofSub && !parsed.proofRoot) {
    base.proofRoot = proofSub.rootFolder;
    if (!parsed.proofs || parsed.proofs.length === 0) {
      base.proofs = (proofSub.proofs ?? []).map(normalizeProofEntry);
    }
  }

  return base;
}

function normalizeStatementEntry(entry, statementRoot) {
  const name = String(entry.Name ?? "");
  const segments = name.split(".");
  // Module = all segments except the last (the declaration name itself)
  const moduleRelPath = segments.slice(0, -1).join("/");
  const rootPrefix = rootPathPrefix(statementRoot);
  const leanFile = moduleRelPath ? `${rootPrefix}${moduleRelPath}.lean` : null;
  const texFile = moduleRelPath ? `${rootPrefix}${moduleRelPath}.tex` : null;

  // Map SemanticDependencies (array of names) to the DeclarationReferences
  // shape expected by checkers. External deps carry a SubmissionSlug so the
  // import checker can derive the allowed Lake package name.
  const namespaceRoot = segments[0] ?? "";
  const declarationReferences = (entry.SemanticDependencies ?? []).map((depName) => {
    const isCurrentSubmission = Boolean(namespaceRoot && depName.startsWith(`${namespaceRoot}.`));
    const depSegments = depName.split(".");
    const depModuleRelPath = depSegments.slice(0, -1).join("/");
    const depLeanFile = isCurrentSubmission && depModuleRelPath ? `${rootPrefix}${depModuleRelPath}.lean` : null;
    const depTexFile = isCurrentSubmission && depModuleRelPath ? `${rootPrefix}${depModuleRelPath}.tex` : null;
    return {
      Name: depName,
      SubmissionSlug: depSegments[0] ?? "",
      CurrentSubmission: isCurrentSubmission,
      LeanStatement: depLeanFile,
      LatexDefinition: depTexFile
    };
  });

  return {
    ...entry,
    Statement: {
      Name: name,
      LeanStatement: leanFile,
      LatexDefinition: texFile
    },
    DeclarationReferences: declarationReferences
  };
}

function normalizeProofEntry(entry) {
  return {
    ...entry,
    proof: entry.Name ?? "",
    axiom: entry.AxiomReference ?? ""
  };
}

function rootPathPrefix(statementRoot) {
  if (!statementRoot || statementRoot === ".") {
    return "";
  }
  const normalized = String(statementRoot).trim().replace(/^\.\//, "").replace(/\/$/, "");
  return normalized ? `${normalized}/` : "";
}

export function inferNamespaceRoot(manifest) {
  // submissionSlug is the normalized form; packageSlug and namespaceSlug are legacy field names.
  const slug = manifest.submissionSlug ?? manifest.packageSlug ?? manifest.namespaceSlug;
  if (slug) {
    return slugToPascal(String(slug));
  }

  const fromEntry = rawStatementNames(manifest).find(Boolean)?.split(".")?.[0];
  return fromEntry ?? null;
}

export function slugToPascal(slug) {
  return String(slug)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
}

function rawStatementNames(manifest) {
  if (Array.isArray(manifest.statements) && manifest.statements.length > 0) {
    return manifest.statements.map((entry) => entry.Statement?.Name ?? entry.name ?? entry.Name ?? null);
  }
  return (manifest.declarations ?? []).map((entry) => entry.name ?? entry.Name ?? null);
}
