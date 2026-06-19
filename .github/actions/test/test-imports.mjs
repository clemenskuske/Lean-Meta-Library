#!/usr/bin/env node
// Runs negative import fixtures and verifies each one fails for its intended reason.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { createOutputConfig } from "../create-submission/create-output-config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");
const fixtureTimeoutMs = Number(process.env.LML_TEST_IMPORT_TIMEOUT_MS ?? 10 * 60 * 1000);

const fixtures = [
  {
    name: "build-packages-failure-package",
    checker: "proofs/prepare-build-cache.mjs",
    expected: /proof package lake build failed|unknown identifier/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "prepare-build-cache-failure-package",
    checker: "statements/prepare-build-cache.mjs",
    expected: /statement package lake build failed|Unknown identifier|MissingName|unexpected identifier/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "missing-proof-file-package",
    checker: "proofs/type-matches-statements.mjs",
    expected: /proof package lake build failed|no built proof modules|unknown (constant|identifier)/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "missing-abstract-file-package",
    checker: "general/files-present.mjs",
    expected: /abstractPath missing/
  },
  {
    name: "manifest-disk-state-failure-package",
    checker: "statements/no-extra-files.mjs",
    expected: /statement file is present on disk but not listed in manifest/
  },
  {
    name: "manifest-check-failure-package",
    checker: "general/manifest-check.mjs",
    expected: /manifest schema .*must NOT have additional properties/
  },
  {
    name: "mathlib-version-failure-package",
    checker: "general/base-import-versions.mjs",
    expected: /proof package lean-toolchain must be/
  },
  {
    name: "namespaces-correct-failure-package",
    checker: "general/namespaces-correct.mjs",
    expected: /proof lakefile should declare package|statement lakefile should declare package/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "folder-size-failure-package",
    checker: "general/folder-size.mjs",
    expected: /file is too large/
  },
  {
    name: "filetypes-failure-package",
    checker: "general/filetypes.mjs",
    expected: /file type is not allowed/
  },
  {
    name: "statement-file-context-failure-package",
    checker: "statements/file-context.mjs",
    expected: /forbidden eval commands/
  },
  {
    name: "mismatched-proof-type-package",
    checker: "proofs/type-matches-statements.mjs",
    expected: /proof theorem type does not match statement/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "sorry-proof-package",
    checker: "proofs/no-forbidden-axioms.mjs",
    expected: /FORBIDDEN_AXIOM|compiled proof theorem depends on forbidden axioms/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "undeclared-proof-obligation-package",
    checker: "proofs/no-forbidden-axioms.mjs",
    expected: /UNDECLARED_AXIOM/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "extra-statement-declaration-package",
    checker: "statements/introduced-declarations.mjs",
    expected: /introduces extra declaration/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "final-proof-build-failure-package",
    checker: "final-proof-build.mjs",
    expected: /UNDECLARED_AXIOM|final proof composition failed|FORBIDDEN_AXIOM|final proof build has forbidden axioms/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "unauthorized-statement-import-package",
    checker: "statements/imports.mjs",
    expected: /statement lakefile does not declare an authorized dependency|not listed in that statement entry's DeclarationReferences manifest/
  },
  {
    name: "statement-wrong-commit-package",
    checker: "statements/imports.mjs",
    expected: /statement lakefile dependency is not allowed by submissions\.jsonl/
  },
  {
    name: "proof-obligation-wrong-commit-package",
    checker: "proofs/imports.mjs",
    expected: /proof lakefile dependency is not allowed by submissions\.jsonl/
  },
  {
    name: "proof-statement-wrong-commit-package",
    checker: "proofs/imports.mjs",
    expected: /proof lakefile dependency is not allowed by submissions\.jsonl/
  },
  {
    name: "manifest-version-mismatch-package",
    checker: "general/manifest-check.mjs",
    expected: /leanVersion must match|mathlibVersion must match/
  },
  {
    name: "missing-license-package",
    checker: "general/license.mjs",
    expected: /licensePath is missing from manifest/
  },
  {
    name: "bad-license-content-package",
    checker: "general/license.mjs",
    expected: /license file does not contain a recognized license identifier/
  },
  {
    name: "commit-hash-failure-package",
    checker: "general/commit-is-hash.mjs",
    expected: /Commit must be a full SHA-1 hash/
  },
  {
    name: "duplicate-slug-package",
    checker: "general/slug-unique.mjs",
    expected: /SubmissionSlug "duplicate-slug" is already taken/
  }
];

const acceptedFixtures = [
  {
    name: "shared-statement-declarations-package",
    checker: "statements/introduced-declarations.mjs"
  },
  {
    name: "unused-sorry-proof-package",
    checker: "final-proof-build.mjs"
  }
];

let failed = false;

console.log("RUN output config enrichment");
try {
  testOutputConfigEnrichment();
  console.log("PASS output config enrichment");
} catch (error) {
  failed = true;
  console.error(`FAIL output config enrichment: ${error.message}`);
}

for (const fixture of fixtures) {
  console.log(`RUN ${fixture.name}: expecting rejection from ${fixture.checker}`);
  const result = runFixture(fixture);
  if (result.ok) {
    console.log(`PASS ${fixture.name}: rejected by ${fixture.checker}`);
    continue;
  }

  failed = true;
  console.error(`FAIL ${fixture.name}: ${result.reason}`);
  if (result.output) {
    console.error(indent(result.output.trimEnd()));
  }
}

for (const fixture of acceptedFixtures) {
  console.log(`RUN ${fixture.name}: expecting acceptance from ${fixture.checker}`);
  const result = runAcceptedFixture(fixture);
  if (result.ok) {
    console.log(`PASS ${fixture.name}: accepted by ${fixture.checker}`);
    continue;
  }

  failed = true;
  console.error(`FAIL ${fixture.name}: ${result.reason}`);
  if (result.output) {
    console.error(indent(result.output.trimEnd()));
  }
}

if (failed) {
  process.exit(1);
}

console.log(`All ${fixtures.length} negative import fixtures failed as expected, ${acceptedFixtures.length} acceptance fixtures passed, and output config enrichment passed.`);

function testOutputConfigEnrichment() {
  const sourceManifest = join(repoRoot, "test-imports", "shared-statement-declarations-package", "manifest.yaml");
  const outputPath = createOutputConfig(sourceManifest, "enrichment-test");

  try {
    const output = YAML.parse(readFileSync(outputPath, "utf8"));
    const statements = output?.StatementSubmissions?.statements ?? [];
    const first = statements.find((entry) => entry.Name === "SharedStatementDeclarations.Statements.Pair.first");
    const second = statements.find((entry) => entry.Name === "SharedStatementDeclarations.Statements.Pair.second");

    assert(first?.InlineTexReference?.includes("definition and an axiom"), "expected TeX reference to be read from the statement .tex file");
    assert(first?.InlineLeanStatement?.includes("def first"), "expected definition Lean declaration to be inlined");
    assert(!first?.InlineLeanStatement?.includes("axiom second"), "definition Lean inline should stop before the next declaration");
    assert(second?.InlineLeanStatement?.includes("axiom second"), "expected axiom Lean declaration to be inlined");
  } finally {
    rmSync(outputPath, { force: true });
  }

  testUnicodeDisplayTextManifestCheck();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function testUnicodeDisplayTextManifestCheck() {
  const tmpRoot = mkdtempSync(join(tmpdir(), "lml-display-text-"));
  const manifestPath = join(tmpRoot, "manifest.yaml");
  writeFileSync(manifestPath, [
    'manifestVersion: "1"',
    'leanVersion: "v4.30.0"',
    'mathlibVersion: "c5ea00351c28e24afc9f0f84379aa41082b1188f"',
    "AbstractPath: abstract.tex",
    "LicenseFile: LICENSE",
    "SubmissionName: Unicode Display Fixture",
    "SubmissionSlug: unicode-display",
    "BibEntries: []",
    "StatementSubmissions:",
    "  rootFolder: statements",
    "  statements:",
    "    - Name: UnicodeDisplay.Statements.Main.foo",
    "      Type: Axiom",
    '      InlineTexReference: "\\\\(x < y\\\\)"',
    "      InlineLeanStatement: \"axiom foo : p ↔ q\"",
    ""
  ].join("\n"));

  try {
    const result = spawnSync(process.execPath, [join(here, "general/manifest-check.mjs"), `--manifest=${manifestPath}`], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });
    assert(result.status === 0, `expected Unicode display manifest to pass manifest-check\n${result.stdout}${result.stderr}`.trim());
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function runFixture({ name, checker, expected, stripMathlibDependencyForCheck }) {
  const checkerPath = join(here, checker);
  const fixture = materializeFixture({ name, stripMathlibDependencyForCheck });
  let child;

  try {
    child = spawnSync(process.execPath, [checkerPath, `--manifest=${fixture.manifestPath}`], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
      timeout: fixtureTimeoutMs
    });
  } finally {
    fixture.cleanupAlways();
  }

  const output = `${child?.stdout ?? ""}${child?.stderr ?? ""}`;

  if (child.error) {
    return {
      ok: false,
      output,
      reason: `could not run ${checker}: ${child.error.message}`
    };
  }

  if (child.signal) {
    return {
      ok: false,
      output,
      reason: `${checker} exited after signal ${child.signal}`
    };
  }

  if (child.status === 0) {
    return {
      ok: false,
      output,
      reason: `${checker} accepted a fixture that should be rejected`
    };
  }

  if (!expected.test(output)) {
    return {
      ok: false,
      output,
      reason: `${checker} rejected the fixture for an unexpected reason`
    };
  }

  fixture.cleanupOutputConfig();
  return { ok: true, output };
}

function runAcceptedFixture({ name, checker, stripMathlibDependencyForCheck }) {
  const checkerPath = join(here, checker);
  const fixture = materializeFixture({ name, stripMathlibDependencyForCheck });
  let child;

  try {
    child = spawnSync(process.execPath, [checkerPath, `--manifest=${fixture.manifestPath}`], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
      timeout: fixtureTimeoutMs
    });
  } finally {
    fixture.cleanupAlways();
  }

  const output = `${child?.stdout ?? ""}${child?.stderr ?? ""}`;

  if (child.error) {
    return {
      ok: false,
      output,
      reason: `could not run ${checker}: ${child.error.message}`
    };
  }

  if (child.signal) {
    return {
      ok: false,
      output,
      reason: `${checker} exited after signal ${child.signal}`
    };
  }

  if (child.status !== 0) {
    return {
      ok: false,
      output,
      reason: `${checker} rejected a fixture that should be accepted`
    };
  }

  fixture.cleanupOutputConfig();
  return { ok: true, output };
}

/**
 * Prepares a fixture for testing:
 * - Creates a temp directory copy (if Mathlib stripping is needed) and strips the
 *   require from lakefiles so builds succeed locally.
 * - Calls createOutputConfig to produce output.config.<name>.yaml next to the
 *   manifest that the checker will receive.
 *
 * Returns:
 *   manifestPath       — path to the output config file handed to the checker
 *   cleanupAlways()    — always call after the checker exits (cleans temp dirs)
 *   cleanupOutputConfig() — call only when the test passes (deletes the output file)
 *
 * On test failure the output config is intentionally left in place so that the
 * failing input is visible in the fixture's source directory.
 */
function materializeFixture({ name, stripMathlibDependencyForCheck }) {
  const sourceDir = join(repoRoot, "test-imports", name);
  const sourceManifest = join(sourceDir, "manifest.yaml");

  if (!stripMathlibDependencyForCheck) {
    const outputConfigPath = createOutputConfig(sourceManifest, name);
    return {
      manifestPath: outputConfigPath,
      cleanupAlways() {},
      cleanupOutputConfig() {
        rmSync(outputConfigPath, { force: true });
      }
    };
  }

  // Build a temp copy with Mathlib stripped so the checker can run lake without
  // downloading Mathlib. The checker runs against the temp copy.
  // A second output config is also written to the source dir so that on failure
  // it remains visible in the test-imports tree rather than disappearing with the
  // temp directory.
  const tmpRoot = mkdtempSync(join(tmpdir(), "lml-test-import-"));
  const fixtureDir = join(tmpRoot, basename(sourceDir));
  cpSync(sourceDir, fixtureDir, { recursive: true });

  for (const lakefile of candidateLakefiles(fixtureDir)) {
    if (existsSync(lakefile)) {
      stripMathlibRequire(lakefile);
    }
  }

  const tmpOutputConfigPath = createOutputConfig(join(fixtureDir, "manifest.yaml"), name);
  const sourceOutputConfigPath = createOutputConfig(sourceManifest, name);

  return {
    manifestPath: tmpOutputConfigPath,
    cleanupAlways() {
      rmSync(tmpRoot, { recursive: true, force: true });
    },
    cleanupOutputConfig() {
      rmSync(sourceOutputConfigPath, { force: true });
    }
  };
}

function candidateLakefiles(fixtureDir) {
  return [
    join(fixtureDir, "lakefile.lean"),
    join(fixtureDir, "statements", "lakefile.lean"),
    join(fixtureDir, "proofs", "lakefile.lean")
  ];
}

function stripMathlibRequire(lakefile) {
  const source = readFileSync(lakefile, "utf8");
  const stripped = source.replace(
    /\nrequire mathlib from git\n\s+"https:\/\/github\.com\/leanprover-community\/mathlib4\.git" @ "[0-9a-fA-F]+"\n/g,
    "\n"
  );
  writeFileSync(lakefile, stripped, "utf8");
}

function indent(text) {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
