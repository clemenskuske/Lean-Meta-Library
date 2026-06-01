import { commandExists, shell } from "./process.js";

export function ensureGitHubCli() {
  if (commandExists("gh")) {
    console.log("GitHub CLI found.");
    return;
  }

  console.log("GitHub CLI not found. Attempting installation.");
  installGitHubCli();

  if (!commandExists("gh")) {
    throw new Error("GitHub CLI installation did not make `gh` available on PATH.");
  }
}

function installGitHubCli() {
  if (process.platform === "darwin") {
    if (commandExists("brew")) {
      shell("brew install gh");
      return;
    }
    throw new Error("Install Homebrew or install GitHub CLI manually: https://cli.github.com/");
  }

  if (process.platform === "win32") {
    if (commandExists("winget")) {
      shell("winget install --id GitHub.cli");
      return;
    }
    throw new Error("Install GitHub CLI manually: https://cli.github.com/");
  }

  if (commandExists("brew")) {
    shell("brew install gh");
    return;
  }

  if (commandExists("apt-get")) {
    shell("sudo apt-get update && sudo apt-get install -y gh");
    return;
  }

  throw new Error("No supported package manager found for installing GitHub CLI.");
}
