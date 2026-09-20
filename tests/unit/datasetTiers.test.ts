/**
 * Guards the property that makes the hard tier worth paying for.
 *
 * The hard tier exists because every model variant scored 1.000 on retrieval and
 * on the 3x3 puzzle, so those benchmarks could not distinguish reasoning-on from
 * reasoning-off. A hard item only earns its place if pattern matching fails it:
 * otherwise it is a core item with extra words, and it adds eval cost without
 * adding information.
 *
 * These tests therefore assert both directions — the baselines must pass core and
 * must fail hard.
 */

import { describe, expect, it } from "vitest";
import {
  ABSTENTION_ITEMS,
  ARITHMETIC_ITEMS,
  ofTier,
  RETRIEVAL_QUERIES,
  type Tier,
  TOOL_SELECTION_ITEMS,
} from "@/evals/benchmarks/datasets";
import { LOGIC_PUZZLES, solvePuzzle } from "@/evals/logicPuzzle";
import { rankTextsByOverlap } from "@/retrieval/semanticRetrieval";
import { tryArithmeticReason } from "@/routing/arithmeticReason";
import { ToolSystem } from "@/tools/ToolSystem";

function baselineArithmetic(input: string): number | null {
  const result = tryArithmeticReason(input);
  if (!result) return null;
  const tail = result.answer.split("=").pop();
  if (!tail) return null;
  const value = Number(tail.replace(/,/g, "").trim());
  return Number.isFinite(value) ? value : null;
}

const tools = new ToolSystem();

describe("dataset hygiene", () => {
  const datasets: Array<[string, ReadonlyArray<{ id: string; tier: Tier }>]> = [
    ["arithmetic", ARITHMETIC_ITEMS],
    ["retrieval", RETRIEVAL_QUERIES],
    ["tool-selection", TOOL_SELECTION_ITEMS],
    ["abstention", ABSTENTION_ITEMS],
  ];

  for (const [name, items] of datasets) {
    it(`${name} has unique ids and both tiers populated`, () => {
      const ids = items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ofTier(items, "core").length).toBeGreaterThan(0);
      expect(ofTier(items, "hard").length).toBeGreaterThan(0);
    });
  }

  it("retrieval expectedTop is always one of the passages", () => {
    for (const query of RETRIEVAL_QUERIES) {
      expect(query.passages).toContain(query.expectedTop);
    }
  });
});

describe("core tier: the deterministic baselines must solve it", () => {
  it("solves every core arithmetic item exactly", () => {
    for (const item of ofTier(ARITHMETIC_ITEMS, "core")) {
      expect(baselineArithmetic(item.input), item.id).toBe(item.expected);
    }
  });

  it("ranks the right passage first for every core retrieval query", () => {
    for (const query of ofTier(RETRIEVAL_QUERIES, "core")) {
      const top = rankTextsByOverlap(query.query, query.passages)[0];
      expect(top?.text, query.id).toBe(query.expectedTop);
    }
  });

  it("labels every core tool-selection item correctly", () => {
    for (const item of ofTier(TOOL_SELECTION_ITEMS, "core")) {
      expect(tools.detectTool(item.query), item.id).toBe(item.expected);
    }
  });

  it("abstains on every core abstention item", () => {
    for (const item of ofTier(ABSTENTION_ITEMS, "core")) {
      expect(tryArithmeticReason(item.input), item.id).toBeNull();
    }
  });
});

describe("hard tier: pattern matching must not be enough", () => {
  it("defeats the two-operand parser on every hard arithmetic item", () => {
    for (const item of ofTier(ARITHMETIC_ITEMS, "hard")) {
      // Either the parser cannot express the expression, or it produces the
      // wrong number. Both mean the item requires more than one step.
      expect(baselineArithmetic(item.input), item.id).not.toBe(item.expected);
    }
  });

  it("defeats bag-of-words ranking on every hard retrieval query", () => {
    for (const query of ofTier(RETRIEVAL_QUERIES, "hard")) {
      const top = rankTextsByOverlap(query.query, query.passages)[0];
      expect(top?.text, query.id).not.toBe(query.expectedTop);
    }
  });

  it("defeats the keyword router on every hard tool-selection item", () => {
    for (const item of ofTier(TOOL_SELECTION_ITEMS, "hard")) {
      expect(tools.detectTool(item.query), item.id).not.toBe(item.expected);
    }
  });

  it("includes abstention traps that contain real arithmetic", () => {
    // At least some hard abstention items must fool the parser into answering,
    // otherwise the tier is not testing the trap it claims to test.
    const fooled = ofTier(ABSTENTION_ITEMS, "hard").filter(
      (item) => tryArithmeticReason(item.input) !== null,
    );
    expect(fooled.length).toBeGreaterThan(0);
  });

  it("documents why each hard abstention item is unanswerable", () => {
    for (const item of ofTier(ABSTENTION_ITEMS, "hard")) {
      expect(item.reason.length, item.id).toBeGreaterThan(10);
    }
  });
});

describe("logic puzzles are unambiguous fixtures", () => {
  for (const puzzle of LOGIC_PUZZLES) {
    it(`${puzzle.id} has exactly one solution matching its declared answer`, () => {
      const solved = solvePuzzle(puzzle);
      expect(solved.solved, puzzle.id).toBe(true);
      expect(solved.assignment).toEqual(puzzle.expectedAssignment);
    });

    it(`${puzzle.id} assigns every module exactly once`, () => {
      const assigned = Object.values(puzzle.expectedAssignment);
      expect(new Set(assigned).size).toBe(puzzle.modules.length);
      expect(assigned).toHaveLength(puzzle.agents.length);
    });
  }

  it("covers both tiers so the puzzle benchmark can discriminate", () => {
    const tiers = LOGIC_PUZZLES.map((p) => p.tier);
    expect(tiers).toContain("core");
    expect(tiers).toContain("hard");
  });

  it("derives deduction steps by propagation, not narration", () => {
    // Every agent should appear in a forced-assignment step; a hardcoded
    // narrative would not scale to the 5x5 puzzle.
    const hard = LOGIC_PUZZLES.find((p) => p.tier === "hard")!;
    const steps = solvePuzzle(hard).steps.join(" ");
    for (const agent of hard.agents) {
      expect(steps, agent).toContain(agent);
    }
  });
});
