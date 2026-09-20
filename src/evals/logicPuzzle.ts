/**
 * Constraint-assignment puzzles for the eval suite.
 *
 * Each puzzle assigns agents to modules as a bijection, constrained by clues. A
 * small CSP solver verifies that exactly one assignment satisfies every clue, so
 * a graded answer is never ambiguous.
 *
 * Two puzzles are defined:
 *
 * - `core` (3x3) is the regression fixture. The deterministic solver must keep
 *   solving it, and it is small enough to be readable.
 * - `hard` (5x5) exists because the 3x3 was saturated: every model variant
 *   scored 1.000 on it, so it could not distinguish reasoning-on from
 *   reasoning-off. It requires chained elimination plus two ordering
 *   constraints, which a model cannot shortcut by guessing.
 *
 * Deduction steps are produced by actual constraint propagation rather than
 * narrated after the fact, so the recorded reasoning matches the search.
 */

export interface LogicPuzzleSolution {
  solved: boolean;
  assignment: Record<string, string>;
  steps: string[];
}

export type PuzzleTier = "core" | "hard";

export interface LogicPuzzle {
  id: string;
  tier: PuzzleTier;
  agents: readonly string[];
  modules: readonly string[];
  /**
   * Pipeline order used by "earlier/later" clues. Stated to the model so an
   * ordering clue is decidable without guessing an implicit convention.
   */
  pipelineOrder: readonly string[];
  clues: readonly PuzzleClue[];
  /**
   * The answer, declared by the fixture rather than taken from the solver, so
   * the offline benchmark is a real regression test: if the solver drifts, the
   * comparison fails instead of silently agreeing with itself.
   */
  expectedAssignment: Readonly<Record<string, string>>;
}

export interface PuzzleClue {
  id: number;
  text: string;
  /**
   * Must return true only when the partial assignment *definitely* breaks the
   * clue. Returning true on an undecided assignment would prune valid branches.
   */
  violated: (assignment: ReadonlyMap<string, string | null>) => boolean;
}

/** Position of a module in the pipeline, or null when not yet assigned. */
function position(
  puzzle: LogicPuzzle,
  assignment: ReadonlyMap<string, string | null>,
  agent: string,
): number | null {
  const mod = assignment.get(agent);
  if (!mod) return null;
  const index = puzzle.pipelineOrder.indexOf(mod);
  return index === -1 ? null : index;
}

/** "`earlier`'s module comes before `later`'s in the pipeline." */
function orderedClue(
  puzzle: () => LogicPuzzle,
  id: number,
  earlier: string,
  later: string,
): PuzzleClue {
  return {
    id,
    text: `${earlier}'s module comes earlier in the pipeline than ${later}'s`,
    violated: (a) => {
      const first = position(puzzle(), a, earlier);
      const second = position(puzzle(), a, later);
      if (first === null || second === null) return false;
      return first >= second;
    },
  };
}

function isClue(id: number, agent: string, mod: string): PuzzleClue {
  return {
    id,
    text: `${agent} is assigned ${mod}`,
    violated: (a) => {
      const assigned = a.get(agent);
      return assigned !== null && assigned !== undefined && assigned !== mod;
    },
  };
}

function isNotClue(id: number, agent: string, mods: string[]): PuzzleClue {
  return {
    id,
    text:
      mods.length === 1
        ? `${agent} is not assigned ${mods[0]}`
        : `${agent} is assigned neither ${mods.slice(0, -1).join(", ")} nor ${mods.at(-1)}`,
    violated: (a) => {
      const assigned = a.get(agent);
      return assigned != null && mods.includes(assigned);
    },
  };
}

const CORE_AGENTS = ["Alpha", "Beta", "Gamma"] as const;
const CORE_MODULES = ["Understanding", "Reasoning", "Orchestration"] as const;

/** The original 3x3 fixture, kept as a regression check. */
export const CORE_PUZZLE: LogicPuzzle = {
  id: "wing-assignment-3",
  tier: "core",
  agents: CORE_AGENTS,
  modules: CORE_MODULES,
  pipelineOrder: CORE_MODULES,
  clues: [
    isNotClue(1, "Alpha", ["Understanding"]),
    isClue(2, "Beta", "Reasoning"),
    isNotClue(3, "Gamma", ["Orchestration"]),
    isNotClue(4, "Beta", ["Orchestration"]),
  ],
  expectedAssignment: {
    Alpha: "Orchestration",
    Beta: "Reasoning",
    Gamma: "Understanding",
  },
};

const HARD_AGENTS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"] as const;
/** Declared in pipeline order, which the ordering clues refer to. */
const HARD_MODULES = [
  "Understanding",
  "Retrieval",
  "Reasoning",
  "Orchestration",
  "Routing",
] as const;

/**
 * 5x5 puzzle with a unique solution reachable only by chained elimination:
 * Gamma is pinned by exclusion, which frees Alpha, which leaves an ordering
 * constraint to separate Delta from Epsilon.
 */
export const HARD_PUZZLE: LogicPuzzle = {
  id: "wing-assignment-5",
  tier: "hard",
  agents: HARD_AGENTS,
  modules: HARD_MODULES,
  pipelineOrder: HARD_MODULES,
  clues: [
    isClue(1, "Beta", "Reasoning"),
    orderedClue(() => HARD_PUZZLE, 2, "Alpha", "Beta"),
    isNotClue(3, "Gamma", ["Retrieval"]),
    orderedClue(() => HARD_PUZZLE, 4, "Epsilon", "Delta"),
    isNotClue(5, "Gamma", ["Orchestration", "Routing"]),
  ],
  expectedAssignment: {
    Alpha: "Retrieval",
    Beta: "Reasoning",
    Gamma: "Understanding",
    Delta: "Routing",
    Epsilon: "Orchestration",
  },
};

export const LOGIC_PUZZLES: readonly LogicPuzzle[] = [CORE_PUZZLE, HARD_PUZZLE];

type PartialAssignment = Map<string, string | null>;

function emptyAssignment(puzzle: LogicPuzzle): PartialAssignment {
  return new Map(puzzle.agents.map((agent) => [agent, null]));
}

function violatesAnyClue(
  puzzle: LogicPuzzle,
  assignment: PartialAssignment,
): boolean {
  return puzzle.clues.some((clue) => clue.violated(assignment));
}

function availableModules(
  puzzle: LogicPuzzle,
  assignment: PartialAssignment,
): string[] {
  const used = new Set<string>();
  for (const mod of assignment.values()) {
    if (mod) used.add(mod);
  }
  return puzzle.modules.filter((mod) => !used.has(mod));
}

function enumerateSolutions(
  puzzle: LogicPuzzle,
  limit: number,
): Record<string, string>[] {
  const solutions: Record<string, string>[] = [];
  const assignment = emptyAssignment(puzzle);

  function search(): void {
    if (violatesAnyClue(puzzle, assignment)) return;

    const agent = puzzle.agents.find((a) => assignment.get(a) === null) ?? null;
    if (!agent) {
      solutions.push(
        Object.fromEntries(puzzle.agents.map((a) => [a, assignment.get(a)!])),
      );
      return;
    }

    for (const mod of availableModules(puzzle, assignment)) {
      assignment.set(agent, mod);
      search();
      assignment.set(agent, null);
      if (solutions.length >= limit) return;
    }
  }

  search();
  return solutions;
}

/**
 * Candidate modules for an agent given what is already assigned: every module
 * that does not immediately violate a clue and can still complete to a full
 * solution.
 */
function candidatesFor(
  puzzle: LogicPuzzle,
  assignment: PartialAssignment,
  agent: string,
): string[] {
  const candidates: string[] = [];
  for (const mod of availableModules(puzzle, assignment)) {
    assignment.set(agent, mod);
    const feasible =
      !violatesAnyClue(puzzle, assignment) && completable(puzzle, assignment);
    assignment.set(agent, null);
    if (feasible) candidates.push(mod);
  }
  return candidates;
}

/** Whether the partial assignment extends to at least one full solution. */
function completable(
  puzzle: LogicPuzzle,
  assignment: PartialAssignment,
): boolean {
  if (violatesAnyClue(puzzle, assignment)) return false;
  const agent = puzzle.agents.find((a) => assignment.get(a) === null) ?? null;
  if (!agent) return true;

  for (const mod of availableModules(puzzle, assignment)) {
    assignment.set(agent, mod);
    const ok = completable(puzzle, assignment);
    assignment.set(agent, null);
    if (ok) return true;
  }
  return false;
}

/**
 * Real constraint propagation: repeatedly assign whichever agent has exactly
 * one feasible module, recording why. Falls back to reporting the remaining
 * candidates when no agent is forced.
 */
function deriveSteps(puzzle: LogicPuzzle): string[] {
  const steps: string[] = [];
  const assignment = emptyAssignment(puzzle);
  const unassigned = new Set(puzzle.agents);

  while (unassigned.size > 0) {
    let forcedAgent: string | null = null;
    let forcedModule: string | null = null;

    for (const agent of unassigned) {
      const candidates = candidatesFor(puzzle, assignment, agent);
      if (candidates.length === 1) {
        forcedAgent = agent;
        forcedModule = candidates[0]!;
        break;
      }
    }

    if (!forcedAgent || !forcedModule) {
      const remaining = [...unassigned]
        .map(
          (agent) =>
            `${agent} ∈ {${candidatesFor(puzzle, assignment, agent).join(", ")}}`,
        )
        .join("; ");
      steps.push(
        `No further agent is forced; remaining options: ${remaining}.`,
      );
      break;
    }

    assignment.set(forcedAgent, forcedModule);
    unassigned.delete(forcedAgent);
    steps.push(
      `${forcedAgent} must take ${forcedModule} — it is the only module left that satisfies every clue.`,
    );
  }

  return steps;
}

/** Statement text shared with the model-in-the-loop benchmark. */
export function puzzleStatement(puzzle: LogicPuzzle): string {
  return [
    `Assign each agent (${puzzle.agents.join(", ")}) exactly one module ` +
      `(${puzzle.modules.join(", ")}). Each module is used exactly once.`,
    `Pipeline order, earliest first: ${puzzle.pipelineOrder.join(" → ")}.`,
    ...puzzle.clues.map((clue) => `Clue ${clue.id}: ${clue.text}`),
  ].join("\n");
}

/**
 * Solve a puzzle offline. Returns the unique satisfying assignment when exactly
 * one exists; `solved` is false for an unsatisfiable or ambiguous puzzle so a
 * badly specified fixture fails loudly instead of grading against a guess.
 */
export function solvePuzzle(puzzle: LogicPuzzle): LogicPuzzleSolution {
  const preamble = [puzzleStatement(puzzle)];
  const solutions = enumerateSolutions(puzzle, 2);

  if (solutions.length === 0) {
    return {
      solved: false,
      assignment: {},
      steps: [...preamble, "No assignment satisfies all clues."],
    };
  }

  if (solutions.length > 1) {
    return {
      solved: false,
      assignment: {},
      steps: [
        ...preamble,
        "Puzzle is ambiguous — multiple assignments satisfy the clues.",
      ],
    };
  }

  const assignment = solutions[0]!;
  return {
    solved: true,
    assignment,
    steps: [
      ...preamble,
      ...deriveSteps(puzzle),
      `Unique solution: ${puzzle.agents
        .map((a) => `${a}→${assignment[a]}`)
        .join(", ")}.`,
    ],
  };
}

/** Back-compat: the original 3x3 puzzle. */
export function solveBleuLabPuzzle(): LogicPuzzleSolution {
  return solvePuzzle(CORE_PUZZLE);
}
