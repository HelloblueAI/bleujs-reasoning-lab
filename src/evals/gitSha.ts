import { execSync } from "node:child_process";

/**
 * Short SHA of HEAD, suffixed with `-dirty` when tracked files outside
 * src/evals/results/ have uncommitted changes. A result recorded from a dirty
 * tree cannot be reproduced by checking out the bare SHA, so it must say so.
 * Result files are excluded because re-running a variant rewrites them.
 */
export function getGitSha(cwd: string = process.cwd()): string | null {
  try {
    const sha = execSync("git rev-parse --short HEAD", {
      cwd,
      encoding: "utf8",
    }).trim();
    const changes = execSync(
      "git status --porcelain --untracked-files=no -- . ':(exclude)src/evals/results'",
      { cwd, encoding: "utf8" },
    ).trim();
    return changes ? `${sha}-dirty` : sha;
  } catch {
    return null;
  }
}
