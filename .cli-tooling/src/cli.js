#!/usr/bin/env node
import { createPaper } from "./commands/create-paper.js";
import { init } from "./commands/init.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { test } from "./commands/test.js";
import { update } from "./commands/update.js";

const commands = new Map([
  ["login", login],
  ["logout", logout],
  ["init", init],
  ["update", update],
  ["test", test],
  ["create-paper", createPaper]
]);

const usage = `Lean Meta Library CLI

Usage:
  lml <command> [options]
  lean-meta-library <command> [options]

Commands:
  login                 Login to GitHub with the GitHub CLI.
  logout                Logout from GitHub with the GitHub CLI.
  init                  Check local tooling and sync repository metadata.
  update                Run the same checks and sync as init.
  test [meta.yaml]      Run submission checks from .github-actions/test.
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
