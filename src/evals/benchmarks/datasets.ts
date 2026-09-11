/**
 * Fixed benchmark datasets. Held out from component/smoke evaluations so scores
 * reflect generalization, not the exact examples used elsewhere in the codebase.
 *
 * Keep these deterministic and offline-runnable. Add items over time and record
 * results in `src/evals/results/`.
 */

/** Arithmetic: expression -> exact numeric result (as produced by the reasoner). */
export const ARITHMETIC_ITEMS: ReadonlyArray<{
  id: string;
  input: string;
  expected: number;
}> = [
  { id: "add-1", input: "48 + 76", expected: 124 },
  { id: "add-2", input: "what is 1234 plus 8766", expected: 10000 },
  { id: "sub-1", input: "900 - 555", expected: 345 },
  { id: "sub-2", input: "2026 minus 1969", expected: 57 },
  { id: "mul-1", input: "23 * 19", expected: 437 },
  { id: "mul-2", input: "144 times 12", expected: 1728 },
  { id: "mul-3", input: "10895423 times 4561233", expected: 49696562936559 },
  { id: "div-1", input: "4096 / 16", expected: 256 },
  { id: "div-2", input: "1000 divided by 8", expected: 125 },
  { id: "dec-1", input: "2.5 * 4", expected: 10 },
  { id: "dec-2", input: "2.5 times 2.5", expected: 6.25 },
  {
    id: "dec-3",
    input: "9999989.290345 + 4521.8943",
    expected: 10004511.184645,
  },
  { id: "dec-4", input: "989956.398455 - 4521.8943", expected: 985434.504155 },
  { id: "dec-5", input: "999999.99 / 11111.11", expected: 90.0000081 },
  { id: "dec-6", input: "987654.321 - 123456.789", expected: 864197.532 },
  { id: "neg-1", input: "-15 + 40", expected: 25 },
  { id: "neg-2", input: "-10000 - 20000", expected: -30000 },
  { id: "neg-3", input: "-2000 minus 30", expected: -2030 },
  { id: "neg-4", input: "-20909456 * 904567", expected: -18914003885552 },
];

/**
 * Retrieval: one query with a fixed passage corpus and the exact expected
 * top-1 passage. Scored by top-1 accuracy over all queries.
 */
export const RETRIEVAL_QUERIES: ReadonlyArray<{
  id: string;
  query: string;
  passages: string[];
  expectedTop: string;
}> = [
  {
    id: "capital-iran",
    query: "What is the capital city of Iran?",
    passages: [
      "Paris is the capital of France and a major European city.",
      "Tehran is the capital city of Iran.",
      "XOR is a binary logic operation used in neural learning tests.",
    ],
    expectedTop: "Tehran is the capital city of Iran.",
  },
  {
    id: "photosynthesis",
    query: "How do plants convert sunlight into energy?",
    passages: [
      "Photosynthesis lets plants convert sunlight into chemical energy.",
      "The mitochondria is the powerhouse of the cell.",
      "Tehran is the capital city of Iran.",
    ],
    expectedTop:
      "Photosynthesis lets plants convert sunlight into chemical energy.",
  },
  {
    id: "http-status",
    query: "What does HTTP status code 404 mean?",
    passages: [
      "HTTP status code 404 means the requested resource was not found.",
      "HTTP status code 200 means the request succeeded.",
      "TCP is a connection-oriented transport protocol.",
    ],
    expectedTop:
      "HTTP status code 404 means the requested resource was not found.",
  },
  {
    id: "largest-planet",
    query: "Which planet is the largest in our solar system?",
    passages: [
      "Earth is the third planet from the Sun and the only known planet with life.",
      "Jupiter is the largest planet in our solar system.",
      "Mars is known as the Red Planet because of its iron-rich surface.",
    ],
    expectedTop: "Jupiter is the largest planet in our solar system.",
  },
];

/** Tool selection: labeled query -> expected tool id from ToolSystem.detectTool. */
export const TOOL_SELECTION_ITEMS: ReadonlyArray<{
  id: string;
  query: string;
  expected: string;
}> = [
  { id: "calc-1", query: "Calculate 847 * 293 for me", expected: "calculator" },
  { id: "calc-2", query: "compute 12 + 30", expected: "calculator" },
  {
    id: "search-1",
    query: "search the web for the latest TypeScript release",
    expected: "websearch",
  },
  {
    id: "search-2",
    query: "look up the population of Canada",
    expected: "websearch",
  },
  {
    id: "code-1",
    query: "execute this Python code snippet",
    expected: "codeexecution",
  },
  {
    id: "sentiment-1",
    query: "what is the sentiment of this review",
    expected: "sentiment",
  },
  {
    id: "none-1",
    query: "tell me a short story about the sea",
    expected: "none",
  },
  { id: "none-2", query: "who was the first president", expected: "none" },
];

/**
 * Routing fixtures: a recorded sequence of provider attempts per request.
 * Each attempt is [provider, succeeded]. The primary provider is the first
 * attempt; a fallback is any later attempt used after the primary failed.
 * Scored by exact match of computed success and fallback rates.
 */
export const ROUTING_FIXTURES: ReadonlyArray<{
  id: string;
  attempts: Array<[string, boolean]>;
}> = [
  { id: "req-1", attempts: [["bleujs", true]] },
  {
    id: "req-2",
    attempts: [
      ["bleujs", false],
      ["nvidia", true],
    ],
  },
  {
    id: "req-3",
    attempts: [
      ["bleujs", false],
      ["nvidia", false],
      ["anthropic", true],
    ],
  },
  { id: "req-4", attempts: [["bleujs", true]] },
  {
    id: "req-5",
    attempts: [
      ["bleujs", false],
      ["nvidia", false],
      ["openai", false],
    ],
  },
];

/** Expected routing metrics for ROUTING_FIXTURES (exact). */
export const ROUTING_EXPECTED = {
  /** requests that produced an answer / total requests */
  successRate: 0.8, // 4 of 5 solved
  /** requests solved by a fallback provider / total requests */
  fallbackRate: 0.4, // req-2 and req-3
};

/**
 * Abstention: prompts that are NOT solvable by the local arithmetic reasoner.
 * The reasoner must abstain (return null) rather than fabricate a number.
 */
export const ABSTENTION_ITEMS: ReadonlyArray<{ id: string; input: string }> = [
  { id: "open-1", input: "what is the meaning of life?" },
  { id: "open-2", input: "summarize the plot of Hamlet" },
  { id: "open-3", input: "is 7 a lucky number" },
  { id: "open-4", input: "translate hello into French" },
  { id: "open-5", input: "what year did the Roman Empire fall" },
];
