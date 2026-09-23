import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Provenance disclosures are part of the research record. If one of these
 * fails, restore the README note; do not delete the assertion. Corrections are
 * added alongside the original disclosure, never in place of it.
 */
const readme = readFileSync(resolve(__dirname, "../../README.md"), "utf8");

describe("README keeps the reproducibility record", () => {
  it("discloses that the Nemotron 3 Super results are labelled 519a226a but were produced at 97fc486c", () => {
    const note = readme.match(
      /\*\*Provenance of the committed files:\*\*[\s\S]*?\n\n/,
    );
    expect(
      note,
      "README 'Provenance of the committed files' section is missing",
    ).not.toBeNull();
    expect(note![0]).toContain("519a226a");
    expect(note![0]).toContain("97fc486c");
    expect(note![0]).toContain("-dirty");
  });
});
