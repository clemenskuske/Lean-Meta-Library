const DEFAULT_REPO = "clemenskuske/Lean-Meta-Library";
const DEFAULT_BRANCH = "main";

export function getRepoConfig() {
  return {
    repo: process.env.LML_REPO || DEFAULT_REPO,
    branch: process.env.LML_BRANCH || DEFAULT_BRANCH
  };
}
