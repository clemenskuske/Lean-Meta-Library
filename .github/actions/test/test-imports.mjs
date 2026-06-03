#!/usr/bin/env node
// Runs negative import fixtures and verifies each one fails for its intended reason.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");
const fixtureTimeoutMs = Number(process.env.LML_TEST_IMPORT_TIMEOUT_MS ?? 10 * 60 * 1000);

const fixtures = [
  {
    name: "missing-proof-file-package",
    checker: "files-present.mjs",
    expected: /proof file missing/
  },
  {
    name: "mismatched-proof-type-package",
    checker: "declarations-to-proofs.mjs",
    expected: /proof theorem type does not match surface declaration/
  },
  {
    name: "sorry-proof-package",
    checker: "proofs-axioms-sorrys.mjs",
    expected: /sorryAx|depends on sorryAx/
  },
  {
    name: "extra-surface-declaration-package",
    checker: "surface-declarations.mjs",
    expected: /introduces extra declaration|should introduce exactly one direct declaration/
  },
  {
    name: "unauthorized-surface-import-package",
    checker: "dependency-check.mjs",
    expected: /only allows its own surface statement module/
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

function runFixture({ name, checker, expected }) {
  const checkerPath = join(here, checker);
  const metaPath = join(repoRoot, "test-imports", name, "meta.yaml");
  const child = spawnSync(process.execPath, [checkerPath, `--meta=${metaPath}`], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
    timeout: fixtureTimeoutMs
  });
  const output = `${child.stdout ?? ""}${child.stderr ?? ""}`;

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

function indent(text) {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
