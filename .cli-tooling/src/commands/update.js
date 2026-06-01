import { runSetup } from "../lib/setup.js";

export async function update({ cwd }) {
  await runSetup({ cwd, label: "update" });
}
