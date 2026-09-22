import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGitSha } from "@/evals/gitSha";

describe("recorded gitSha reflects whether the tree matched the commit", () => {
  let repo: string;
  const git = (cmd: string) =>
    execSync(`git ${cmd}`, { cwd: repo, encoding: "utf8" }).trim();

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "gitsha-"));
    git("init -q");
    git("config user.email test@example.com");
    git("config user.name test");
    git("config commit.gpgsign false");
    mkdirSync(join(repo, "src/evals/results"), { recursive: true });
    writeFileSync(join(repo, "datasets.ts"), "export const items = [];\n");
    writeFileSync(join(repo, "src/evals/results/latest.json"), "{}\n");
    git("add -A");
    git("commit -q --no-verify -m init");
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("returns the bare SHA for a clean tree", () => {
    expect(getGitSha(repo)).toBe(git("rev-parse --short HEAD"));
  });

  it("marks uncommitted source changes as dirty", () => {
    writeFileSync(join(repo, "datasets.ts"), "export const items = [1];\n");
    expect(getGitSha(repo)).toBe(`${git("rev-parse --short HEAD")}-dirty`);
  });

  it("ignores rewritten result files", () => {
    writeFileSync(join(repo, "src/evals/results/latest.json"), '{"a":1}\n');
    expect(getGitSha(repo)).toBe(git("rev-parse --short HEAD"));
  });

  it("returns null outside a git repository", () => {
    const plain = mkdtempSync(join(tmpdir(), "nogit-"));
    try {
      expect(getGitSha(plain)).toBeNull();
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });
});
