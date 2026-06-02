import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const commandDir = dirname(fileURLToPath(import.meta.url));

export async function agentReadme({ cwd }) {
  const candidates = [
    join(commandDir, "../../../agent-info/README.md"),
    join(cwd, "agent-info/README.md")
  ];

  for (const path of candidates) {
    try {
      process.stdout.write(readFileSync(path, "utf8"));
      return;
    } catch {
      // Try the next known repository-relative location.
    }
  }

  throw new Error("Could not find agent-info/README.md.");
}
