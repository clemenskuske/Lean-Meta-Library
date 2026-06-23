#!/usr/bin/env node
import { agentIntroduction } from "./commands/agent-introduction.js";
import { submissionInstruction } from "./commands/submission-instruction.js";
import { createPaper } from "./commands/create-paper.js";
import { init } from "./commands/init.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { submit } from "./commands/submit.js";
import { submissionStatus } from "./commands/submission-status.js";
import { test } from "./commands/test.js";
import { update } from "./commands/update.js";

const commands = new Map([
  ["agent-introduction", agentIntroduction],
  ["submission-instruction", submissionInstruction],
  ["login", login],
  ["logout", logout],
  ["init", init],
  ["update", update],
  ["test", test],
  ["submit", submit],
  ["submission-status", submissionStatus],
  ["create-paper", createPaper],
]);

const usage = `Lean Meta Library CLI

Usage:
  lml <command> [options]
  lean-meta-library <command> [options]

Commands:
  agent-introduction    Print the Lean Meta Library startup guide for agents.
  submission-instruction
                        Print the step-by-step guide for making a submission.
  login                 Login to GitHub with the GitHub CLI.
  logout                Logout from GitHub with the GitHub CLI.
  init                  Check local tooling and sync repository manifest.
  update                Run the same checks and sync as init.
  test --manifest=manifest.yaml
                         Run submission checks from .github/actions/test.
  submit --manifest=manifest.yaml
                         Run checks and dispatch the submit GitHub workflow.
                         Use --no-prior-test to skip checks.
  submission-status <issue-id-or-url>
                         Show submission issue, workflow, commit, and surface status.
  create-paper [slug]   Create a starter submission package.

Options:
  -h, --help            Show this help text.
`;

async function main(argv) {
  const [commandName, ...args] = argv;

  if (!commandName || commandName === "--help" || commandName === "-h") {
    console.log(usage);
    return;
  }

  const command = commands.get(commandName);
  if (!command) {
    throw new Error(`Unknown command "${commandName}". Run "lml --help" for available commands.`);
  }

  await command({ args, cwd: process.cwd() });
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
