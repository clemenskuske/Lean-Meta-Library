import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { run } from "./process.js";
import { getRepoConfig } from "./repo.js";

export function syncRepositoryFiles({ cwd }) {
  const { repo, branch } = getRepoConfig({ cwd });
  console.log(`Syncing metadata from ${repo}@${branch}.`);

  downloadFile({ cwd, repo, branch, sourcePath: "submissions.jsonl", targetPath: "submissions.jsonl" });
  downloadFolder({ cwd, repo, branch, sourceDir: "agent-info", targetDir: "agent-info" });
}

function downloadFile({ cwd, repo, branch, sourcePath, targetPath }) {
  const json = ghJson(["api", "--method", "GET", `repos/${repo}/contents/${sourcePath}`, "--field", `ref=${branch}`]);
  const content = Buffer.from(json.content, "base64").toString("utf8");
  const target = join(cwd, targetPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  console.log(`Downloaded ${targetPath}.`);
}

function downloadFolder({ cwd, repo, branch, sourceDir, targetDir }) {
  const tree = ghJson(["api", "--method", "GET", `repos/${repo}/git/trees/${branch}`, "--field", "recursive=1"]);
  const entries = tree.tree.filter((entry) => entry.type === "blob" && entry.path.startsWith(`${sourceDir}/`));
  const targetRoot = join(cwd, targetDir);

  rmSync(targetRoot, { force: true, recursive: true });
  mkdirSync(targetRoot, { recursive: true });

  for (const entry of entries) {
    downloadFile({ cwd, repo, branch, sourcePath: entry.path, targetPath: entry.path });
  }

  console.log(`Downloaded ${entries.length} file(s) into ${targetDir}.`);
}

function ghJson(args) {
  return JSON.parse(run("gh", args));
}
