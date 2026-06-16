#!/usr/bin/env node
// Runs negative import fixtures and verifies each one fails for its intended reason.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
    name: "metadata-disk-state-failure-package",
    checker: "statements/no-extra-files.mjs",
    expected: /statement file is present on disk but not listed in metadata/
  },
  {
    name: "metadata-check-failure-package",
    checker: "general/metadata-check.mjs",
    expected: /metadata schema .*must have required property 'bibtex-entries'|metadata schema .*must NOT have additional properties/
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
    name: "extra-statement-declaration-package",
    checker: "statements/introduced-declarations.mjs",
    expected: /introduces extra declaration|should introduce exactly one direct declaration/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "final-proof-build-failure-package",
    checker: "final-proof-build.mjs",
    expected: /UNDECLARED_AXIOM|final proof composition failed|FORBIDDEN_AXIOM|final proof build has forbidden axioms/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "unused-sorry-proof-package",
    checker: "final-proof-build.mjs",
    expected: /final proof build output reports a sorry/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "unauthorized-statement-import-package",
    checker: "statements/imports.mjs",
    expected: /statement lakefile does not declare an authorized dependency|not listed in that statement entry's DeclarationReferences metadata/
  },
  {
    name: "manifest-version-mismatch-package",
    checker: "general/metadata-check.mjs",
    expected: /leanVersion must match|mathlibVersion must match/
  },
  {
    name: "missing-license-package",
    checker: "general/license.mjs",
    expected: /licensePath is missing from metadata/
  },
  {
    name: "bad-license-content-package",
    checker: "general/license.mjs",
    expected: /license file does not contain a recognized license identifier/
  }
];

let failed = false;

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

if (failed) {
  process.exit(1);
}

console.log(`All ${fixtures.length} negative import fixtures failed as expected.`);

function runFixture({ name, checker, expected, stripMathlibDependencyForCheck }) {
  const checkerPath = join(here, checker);
  const fixture = materializeFixture({ name, stripMathlibDependencyForCheck });
  let child;

  try {
    child = spawnSync(process.execPath, [checkerPath, `--meta=${fixture.metaPath}`], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
      timeout: fixtureTimeoutMs
    });
  } finally {
    fixture.cleanup();
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

  return { ok: true, output };
}

function materializeFixture({ name, stripMathlibDependencyForCheck }) {
  const sourceDir = join(repoRoot, "test-imports", name);
  if (!stripMathlibDependencyForCheck) {
    return {
      metaPath: join(sourceDir, "manifest.yaml"),
      cleanup() {}
    };
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), "lml-test-import-"));
  const fixtureDir = join(tmpRoot, basename(sourceDir));
  cpSync(sourceDir, fixtureDir, { recursive: true });

  for (const lakefile of candidateLakefiles(fixtureDir)) {
    if (existsSync(lakefile)) {
      stripMathlibRequire(lakefile);
    }
  }

  return {
    metaPath: join(fixtureDir, "manifest.yaml"),
    cleanup() {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  };
}

function candidateLakefiles(fixtureDir) {
  return [
    join(fixtureDir, "lakefile.lean"),
    join(fixtureDir, "statements", "lakefile.lean"),
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
