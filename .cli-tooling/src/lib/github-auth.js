import { run } from "./process.js";

export function isAuthenticated() {
  try {
    run("gh", ["auth", "status", "--hostname", "github.com"]);
    return true;
  } catch {
    return false;
  }
}

export function ensureAuthenticated() {
  if (isAuthenticated()) {
    console.log("GitHub login found.");
    return;
  }

  console.log("Starting GitHub login.");
  run("gh", ["auth", "login", "--hostname", "github.com", "--web"], { stdio: "inherit" });
}
