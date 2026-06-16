import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const shortReadme = `Lean Meta Library — quick reference

Install:
  npm install && npm link

Commands:
  lml agent-introduction          Print the agent startup guide.
  lml agent-submission-guide      Print the agent submission guide.
  lml login / logout              Authenticate with GitHub.
  lml init / update               Check tooling and sync repository manifest.
  lml create-paper [slug]         Create a starter submission package.
  lml test --manifest=manifest.yaml       Run all submission checks locally.
  lml submit --manifest=manifest.yaml     Run checks and dispatch the submit workflow.
    --no-prior-test               Skip checks before submitting.
  lml submission-status manifest.yaml Show submission issue, workflow, and commit status.
  lml readme                      Print this README.
  lml readme --short              Print this quick reference.

Flags:
  -h, --help                      Show CLI help text.
`;

export async function readme({ args }) {
  const isShort = args.includes("--short") || args.includes("-s");

  if (isShort) {
    console.log(shortReadme);
    return;
  }

  const readmePath = join(cliRoot, "..", "README.md");
  const content = readFileSync(readmePath, "utf8");
  console.log(content);
}
