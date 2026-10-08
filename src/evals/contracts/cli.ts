#!/usr/bin/env tsx
/**
 * Qualify recorded NVIDIA configurations against the Reasoning Lab MVP contract.
 *
 *   pnpm run contract
 *
 * Reads committed comparison files and writes
 * src/evals/results/capability-contract-mvp.json. It does not call a provider.
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContractReport } from "./mvp";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, "../results/capability-contract-mvp.json");

const report = buildContractReport();
writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");

console.log(`${report.contractId}`);
console.log(
  `baseline: ${report.baseline.model} thinking ${report.baseline.reasoning}`,
);
for (const requirement of report.requirements) {
  console.log(`  requirement ${requirement.id}: ${requirement.rule}`);
}
for (const result of report.results) {
  const name = result.model.split("/").pop();
  console.log(
    `\n${result.status}  ${name} thinking ${result.reasoning}  (${result.basis})`,
  );
  console.log(`  ${result.summary}`);
  for (const requirement of result.requirements) {
    const mark = requirement.pass
      ? "pass"
      : requirement.compared
        ? "fail"
        : "not compared";
    const measured =
      requirement.measured === null
        ? "not recorded"
        : String(requirement.measured);
    console.log(
      `  ${mark}  ${requirement.id}: ${measured} — ${requirement.detail}`,
    );
  }
}
console.log(`\nWrote ${outPath}`);
