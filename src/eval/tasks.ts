/**
 * Autonomous Reasoning Lab — evaluation task definitions.
 * Each task is runnable offline (no LLM required unless noted).
 */

export type EvalCategory =
  | 'learning'
  | 'understanding'
  | 'reasoning'
  | 'goals'
  | 'orchestration';

export interface EvalTask {
  id: string;
  name: string;
  category: EvalCategory;
  description: string;
  requiresLlm?: boolean;
}

export const EVAL_TASKS: EvalTask[] = [
  {
    id: 'xor-learning',
    name: 'XOR neural learning',
    category: 'learning',
    description: 'Train on XOR and achieve >85% accuracy',
  },
  {
    id: 'concept-extraction',
    name: 'Concept extraction',
    category: 'understanding',
    description: 'Extract concepts from a multi-domain prompt',
  },
  {
    id: 'deductive-reasoning',
    name: 'Deductive reasoning',
    category: 'reasoning',
    description: 'Apply classical rules to reach a valid conclusion',
  },
  {
    id: 'autonomous-goals',
    name: 'Autonomous goals',
    category: 'goals',
    description: 'System maintains active self-generated goals',
  },
  {
    id: 'cross-domain-links',
    name: 'Cross-domain linking',
    category: 'understanding',
    description: 'Identify multiple knowledge domains in input',
  },
  {
    id: 'memory-recall',
    name: 'Memory recall',
    category: 'orchestration',
    description: 'Store and retrieve conversation context',
  },
  {
    id: 'tool-detection',
    name: 'Tool need detection',
    category: 'orchestration',
    description: 'Detect when a query needs external tools',
  },
  {
    id: 'chain-of-thought',
    name: 'Chain-of-thought structure',
    category: 'reasoning',
    description: 'Produce structured reasoning steps (LLM optional)',
    requiresLlm: true,
  },
  {
    id: 'logic-puzzle',
    name: 'Logic puzzle',
    category: 'reasoning',
    description: 'Solve a multi-step logic puzzle',
  },
];
