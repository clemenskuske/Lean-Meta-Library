import { runSetup } from "../lib/setup.js";

export async function init({ cwd }) {
  await runSetup({ cwd, label: "init" });
}
