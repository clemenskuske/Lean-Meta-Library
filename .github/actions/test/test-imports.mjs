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
    checker: "general/build-packages.mjs",
    expected: /proof package failed to build|unknown identifier/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "build-packages-failure-package",
    checker: "proofs/prepare-build-cache.mjs",
    expected: /proof package lake build failed|unknown identifier/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "prepare-build-cache-failure-package",
    checker: "statements/prepare-build-cache.mjs",
    expected: /statement package lake build failed|statement\/declaration package lake build failed|surface package lake build failed|Unknown identifier|MissingName|unexpected identifier/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "missing-proof-file-package",
    checker: "files-present.mjs",
    expected: /proof file missing/
  },
  {
    name: "metadata-disk-state-failure-package",
    checker: "files-present.mjs",
    expected: /statement\/declaration file is present on disk but not listed in metadata|declaration folder is present on disk but not listed in metadata/
  },
  {
    name: "metadata-check-failure-package",
    checker: "metadata-check.mjs",
    expected: /metadata schema .*must have required property 'bibtex-entries'|metadata schema .*must NOT have additional properties/
  },
  {
    name: "mathlib-version-failure-package",
    checker: "mathlib-version.mjs",
    expected: /proof package lean-toolchain must be|root lean-toolchain must be/
  },
  {
    name: "namespaces-correct-failure-package",
    checker: "namespaces-correct.mjs",
    expected: /proof lakefile should declare package|declaration namespace should start/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "folder-size-failure-package",
    checker: "folder-size.mjs",
    expected: /file is too large/
  },
  {
    name: "filetypes-failure-package",
    checker: "filetypes.mjs",
    expected: /file type is not allowed/
  },
  {
    name: "surface-file-context-failure-package",
    checker: "surface-file-context.mjs",
    expected: /forbidden eval commands/
  },
  {
    name: "mismatched-proof-type-package",
    checker: "declarations-to-proofs.mjs",
    expected: /proof theorem type does not match surface declaration/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "sorry-proof-package",
    checker: "proofs-axioms-sorrys.mjs",
    expected: /proof file proofs\/ConnectedIffReachableProof\.lean reports a sorry/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "unused-sorry-proof-package",
    checker: "proofs-axioms-sorrys.mjs",
    expected: /proof file proofs\/UnusedSorry\.lean reports a sorry/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "extra-surface-declaration-package",
    checker: "surface-declarations.mjs",
    expected: /introduces extra declaration|should introduce exactly one direct declaration/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "final-proof-build-failure-package",
    checker: "final-proof-build.mjs",
    expected: /FORBIDDEN_AXIOM|final proof build has forbidden axioms/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "unused-sorry-proof-package",
    checker: "final-proof-build.mjs",
    expected: /final proof build output reports a sorry/,
    stripMathlibDependencyForCheck: true
  },
  {
    name: "unauthorized-surface-import-package",
    checker: "dependency-check.mjs",
    expected: /not listed in that entry's DeclarationReferences metadata|only allows its own surface statement module/
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
      metaPath: join(sourceDir, "meta.yaml"),
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
    metaPath: join(fixtureDir, "meta.yaml"),
    cleanup() {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  };
}

function candidateLakefiles(fixtureDir) {
  return [
    join(fixtureDir, "lakefile.lean"),
    join(fixtureDir, "surface-package", "lakefile.lean"),
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
