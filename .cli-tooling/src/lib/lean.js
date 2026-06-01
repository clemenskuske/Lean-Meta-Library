import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mathlibStable from "../../config/mathlib-stable.json" with { type: "json" };
import { commandExists, run } from "./process.js";

export function checkLeanAndLake({ cwd }) {
  const leanFound = commandExists("lean");
  const lakeFound = commandExists("lake");

  if (!leanFound) {
    throw new Error("Lean is not installed or is not available on PATH.");
  }

  if (!lakeFound) {
    throw new Error("Lake is not installed or is not available on PATH.");
  }

  console.log(run("lean", ["--version"]));
  console.log(run("lake", ["--version"]));
  checkLeanToolchain({ cwd });
  checkMathlibInstallation({ cwd });
}

function checkLeanToolchain({ cwd }) {
  const toolchainPath = join(cwd, "lean-toolchain");

  if (!existsSync(toolchainPath)) {
    console.log(`No lean-toolchain found. Expected ${mathlibStable.leanToolchain} for current stable mathlib.`);
    return;
  }

  const actual = readFileSync(toolchainPath, "utf8").trim();
  if (actual !== mathlibStable.leanToolchain) {
    throw new Error(
      `lean-toolchain is ${actual}, expected ${mathlibStable.leanToolchain} for current stable mathlib.`
    );
  }

  console.log(`lean-toolchain matches ${mathlibStable.leanToolchain}.`);
}

function checkMathlibInstallation({ cwd }) {
  const manifestPath = join(cwd, "lake-manifest.json");
  const lakefileLeanPath = join(cwd, "lakefile.lean");
  const lakefileTomlPath = join(cwd, "lakefile.toml");

  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const mathlibPackage = manifest.packages?.find((pkg) => pkg.name === "mathlib");
    if (!mathlibPackage) {
      console.log("lake-manifest.json does not list mathlib yet.");
      return;
    }

    console.log(`mathlib package found at ${mathlibPackage.url}#${mathlibPackage.rev ?? mathlibPackage.inputRev}`);
    return;
  }

  if (existsSync(lakefileLeanPath) || existsSync(lakefileTomlPath)) {
    console.log("Lake package found. Mathlib installation policy is not finalized yet.");
    return;
  }

  console.log("No Lake package found in this folder. Mathlib installation policy is not finalized yet.");
}
