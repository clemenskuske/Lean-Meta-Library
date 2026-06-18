import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const commandDir = dirname(fileURLToPath(import.meta.url));

export async function submissionInstruction() {
  const candidates = [
    join(commandDir, "../../../agent-info/submission-guide.md"),
    join(process.cwd(), "agent-info/submission-guide.md")
  ];

  for (const path of candidates) {
    try {
      process.stdout.write(readFileSync(path, "utf8"));
      return;
    } catch {
      // Try the next known repository-relative location.
    }
  }

  throw new Error("Could not find agent-info/submission-guide.md.");
}
