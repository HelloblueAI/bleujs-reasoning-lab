/**
 * Bleu Lab wing assignment — offline logic puzzle for the eval suite.
 *
 * Three pipeline agents each own exactly one module. Clues constrain the
 * bijection; a small CSP solver verifies uniqueness and records deductions.
 */

export interface LogicPuzzleSolution {
  solved: boolean;
  assignment: Record<string, string>;
  steps: string[];
}

const AGENTS = ['Alpha', 'Beta', 'Gamma'] as const;
const MODULES = ['Understanding', 'Reasoning', 'Orchestration'] as const;

type Agent = (typeof AGENTS)[number];
type Module = (typeof MODULES)[number];

type PartialAssignment = Map<Agent, Module | null>;

interface Clue {
  id: number;
  text: string;
  violated: (assignment: PartialAssignment) => boolean;
}

const CLUES: Clue[] = [
  {
    id: 1,
    text: 'Alpha is not assigned Understanding',
    violated: (a) => a.get('Alpha') === 'Understanding',
  },
  {
    id: 2,
    text: 'Beta is assigned Reasoning',
    violated: (a) => a.get('Beta') !== null && a.get('Beta') !== 'Reasoning',
  },
  {
    id: 3,
    text: 'Gamma is not assigned Orchestration',
    violated: (a) => a.get('Gamma') === 'Orchestration',
  },
  {
    id: 4,
    text: 'Orchestration is not assigned to Beta',
    violated: (a) => a.get('Beta') === 'Orchestration',
  },
];

function cloneAssignment(assignment: PartialAssignment): PartialAssignment {
  return new Map(assignment);
}

function usedModules(assignment: PartialAssignment): Set<Module> {
  const used = new Set<Module>();
  for (const mod of assignment.values()) {
    if (mod) used.add(mod);
  }
  return used;
}

function violatesAnyClue(assignment: PartialAssignment): boolean {
  return CLUES.some((clue) => clue.violated(assignment));
}

function availableModules(assignment: PartialAssignment): Module[] {
  const used = usedModules(assignment);
  return MODULES.filter((mod) => !used.has(mod));
}

function nextUnassignedAgent(assignment: PartialAssignment): Agent | null {
  return AGENTS.find((agent) => assignment.get(agent) === null) ?? null;
}

function enumerateSolutions(limit: number): Record<string, string>[] {
  const solutions: Record<string, string>[] = [];
  const assignment: PartialAssignment = new Map(
    AGENTS.map((agent) => [agent, null])
  );

  function search(): void {
    if (violatesAnyClue(assignment)) return;

    const agent = nextUnassignedAgent(assignment);
    if (!agent) {
      solutions.push(
        Object.fromEntries(AGENTS.map((a) => [a, assignment.get(a)!]))
      );
      return;
    }

    for (const mod of availableModules(assignment)) {
      assignment.set(agent, mod);
      search();
      assignment.set(agent, null);
      if (solutions.length >= limit) return;
    }
  }

  search();
  return solutions;
}

function explainSolution(assignment: Record<string, string>): string[] {
  const steps: string[] = [];

  steps.push('Clue 2 fixes Beta on Reasoning (only valid module for Beta).');

  const remainingForGamma = MODULES.filter(
    (mod) => mod !== assignment.Beta && mod !== 'Orchestration'
  );
  steps.push(
    `Clue 3 rules out Orchestration for Gamma; Reasoning is taken → Gamma must handle ${remainingForGamma[0]}.`
  );

  const alphaModule = MODULES.find(
    (mod) => mod !== assignment.Beta && mod !== assignment.Gamma
  );
  steps.push(`Only ${alphaModule} remains for Alpha.`);

  if (assignment.Alpha !== 'Understanding') {
    steps.push('Clue 1 satisfied: Alpha is not on Understanding.');
  }
  if (assignment.Beta !== 'Orchestration') {
    steps.push('Clue 4 satisfied: Orchestration is not assigned to Beta.');
  }

  return steps;
}

/**
 * Solve the Bleu Lab wing-assignment puzzle offline.
 * Returns the unique satisfying assignment when exactly one exists.
 */
export function solveBleuLabPuzzle(): LogicPuzzleSolution {
  const preamble = [
    'Bleu Lab puzzle: assign Alpha, Beta, Gamma to Understanding, Reasoning, Orchestration.',
    ...CLUES.map((c) => `Clue ${c.id}: ${c.text}`),
  ];

  const solutions = enumerateSolutions(2);

  if (solutions.length === 0) {
    return {
      solved: false,
      assignment: {},
      steps: [...preamble, 'No assignment satisfies all clues.'],
    };
  }

  if (solutions.length > 1) {
    return {
      solved: false,
      assignment: {},
      steps: [
        ...preamble,
        'Puzzle is ambiguous — multiple assignments satisfy the clues.',
      ],
    };
  }

  const assignment = solutions[0]!;

  return {
    solved: true,
    assignment,
    steps: [
      ...preamble,
      ...explainSolution(assignment),
      `Unique solution: ${AGENTS.map((a) => `${a}→${assignment[a]}`).join(', ')}.`,
    ],
  };
}
