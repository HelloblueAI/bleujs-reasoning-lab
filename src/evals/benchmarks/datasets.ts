/**
 * Fixed benchmark datasets, split into two difficulty tiers.
 *
 * Why tiers exist: every model variant scored 1.000 on retrieval and on the
 * logic puzzle, and 0.875-1.000 on tool selection. Those benchmarks were
 * saturated, so they could not distinguish reasoning-on from reasoning-off —
 * the question this lab exists to answer. Item counts were also small enough
 * (3-8) that a single item moved a score 12-33%.
 *
 * - `core` items are what the deterministic baselines in `runner.ts` are built
 *   to handle. The offline suite scores only these, so it stays a clean
 *   regression test that should hold at 100%.
 * - `hard` items are designed so keyword matching and single-step pattern
 *   matching fail. The baselines are *expected* to miss them, which is why the
 *   offline suite excludes them. The model suite runs both tiers and reports
 *   each separately.
 *
 * Consequence for comparability: an offline score and a model score are directly
 * comparable on the core tier only. The hard tier measures models against each
 * other.
 *
 * Keep every item deterministic and offline-gradeable: exact numbers, exact
 * labels, or an exact passage.
 */

export type Tier = "core" | "hard";

/** Items of one tier. */
export function ofTier<T extends { tier: Tier }>(
  items: readonly T[],
  tier: Tier,
): T[] {
  return items.filter((item) => item.tier === tier);
}

/**
 * Arithmetic: expression -> exact numeric result.
 *
 * Core items are two-operand expressions, which is exactly what
 * `tryArithmeticReason` parses. Hard items require order of operations,
 * parentheses, percentages, exponents, unit conversion, or a word problem —
 * all of which the two-operand regex cannot express, and all of which have a
 * single exact answer.
 */
export const ARITHMETIC_ITEMS: ReadonlyArray<{
  id: string;
  input: string;
  expected: number;
  tier: Tier;
}> = [
  // --- core: single operation, two operands ---
  { id: "add-1", input: "48 + 76", expected: 124, tier: "core" },
  {
    id: "add-2",
    input: "what is 1234 plus 8766",
    expected: 10000,
    tier: "core",
  },
  { id: "sub-1", input: "900 - 555", expected: 345, tier: "core" },
  { id: "sub-2", input: "2026 minus 1969", expected: 57, tier: "core" },
  { id: "mul-1", input: "23 * 19", expected: 437, tier: "core" },
  { id: "mul-2", input: "144 times 12", expected: 1728, tier: "core" },
  {
    id: "mul-3",
    input: "10895423 times 4561233",
    expected: 49696562936559,
    tier: "core",
  },
  { id: "div-1", input: "4096 / 16", expected: 256, tier: "core" },
  { id: "div-2", input: "1000 divided by 8", expected: 125, tier: "core" },
  { id: "dec-1", input: "2.5 * 4", expected: 10, tier: "core" },
  { id: "dec-2", input: "2.5 times 2.5", expected: 6.25, tier: "core" },
  {
    id: "dec-3",
    input: "9999989.290345 + 4521.8943",
    expected: 10004511.184645,
    tier: "core",
  },
  {
    id: "dec-4",
    input: "989956.398455 - 4521.8943",
    expected: 985434.504155,
    tier: "core",
  },
  {
    id: "dec-5",
    input: "999999.99 / 11111.11",
    expected: 90.0000081,
    tier: "core",
  },
  {
    id: "dec-6",
    input: "987654.321 - 123456.789",
    expected: 864197.532,
    tier: "core",
  },
  { id: "neg-1", input: "-15 + 40", expected: 25, tier: "core" },
  { id: "neg-2", input: "-10000 - 20000", expected: -30000, tier: "core" },
  { id: "neg-3", input: "-2000 minus 30", expected: -2030, tier: "core" },
  {
    id: "neg-4",
    input: "-20909456 * 904567",
    expected: -18914003885552,
    tier: "core",
  },

  // --- hard: order of operations and parentheses ---
  { id: "ooo-1", input: "7 + 6 * 5 - 4 / 2", expected: 35, tier: "hard" },
  { id: "ooo-2", input: "(18 + 42) * 3", expected: 180, tier: "hard" },
  {
    id: "ooo-3",
    input: "100 - 12 * 3 + 48 / 6",
    expected: 72,
    tier: "hard",
  },
  {
    id: "multi-1",
    input: "125 * 8 - 375 / 5",
    expected: 925,
    tier: "hard",
  },
  {
    id: "multi-2",
    input: "(2400 / 16) + (17 * 23)",
    expected: 541,
    tier: "hard",
  },

  // --- hard: percentages, where the operation is implied rather than written ---
  { id: "pct-1", input: "What is 17.5% of 2400?", expected: 420, tier: "hard" },
  {
    id: "pct-2",
    input: "A price of 250 increases by 12%. What is the new price?",
    expected: 280,
    tier: "hard",
  },
  {
    // Inverting a discount, not applying one — a common single-step trap.
    id: "pct-3",
    input:
      "A shirt costs 80 after a 20% discount. What was the original price?",
    expected: 100,
    tier: "hard",
  },
  { id: "pct-4", input: "What is 12.5% of 36.8?", expected: 4.6, tier: "hard" },

  // --- hard: exponents ---
  { id: "pow-1", input: "What is 2^10 + 3^4?", expected: 1105, tier: "hard" },
  { id: "pow-2", input: "1000 * 1.05^3", expected: 1157.625, tier: "hard" },

  // --- hard: unit conversion, needs a known factor plus a chain ---
  {
    id: "unit-1",
    input: "How many minutes are in 3.5 days?",
    expected: 5040,
    tier: "hard",
  },
  {
    id: "unit-2",
    input: "Convert 2.5 kilometers to centimeters",
    expected: 250000,
    tier: "hard",
  },
  {
    id: "unit-3",
    input: "How many seconds are in 4 hours and 25 minutes?",
    expected: 15900,
    tier: "hard",
  },

  // --- hard: multi-step word problems ---
  {
    id: "rate-1",
    input:
      "A train travels 240 km in 3 hours. At the same speed, how far does it travel in 7 hours?",
    expected: 560,
    tier: "hard",
  },
  {
    id: "rate-2",
    input:
      "If 5 machines make 20 widgets in 4 minutes, how many widgets do 12 machines make in 10 minutes?",
    expected: 120,
    tier: "hard",
  },
  {
    id: "agg-1",
    input: "What is the sum of all integers from 1 to 100?",
    expected: 5050,
    tier: "hard",
  },
  {
    id: "agg-2",
    input: "What is the average of 12, 19, 27, 34, and 48?",
    expected: 28,
    tier: "hard",
  },

  // --- hard: decimal scaling followed by a subtraction that must not be
  // rounded away. Two operations, so a two-operand matcher cannot express them.
  {
    id: "dec-h1",
    input: "Compute 1234.5678 * 1000 - 567.8",
    expected: 1234000,
    tier: "hard",
  },
  {
    id: "dec-h2",
    input: "Compute 3.7 * 2.4 - 0.88",
    expected: 8,
    tier: "hard",
  },
];

/**
 * Retrieval: a query, a fixed passage corpus, and the exact expected top passage.
 *
 * Core items have a lexically obvious answer, which is what bag-of-words ranking
 * is built for. Hard items are near-miss sets: every passage shares most of the
 * query's keywords and only one actually answers it, so word overlap alone
 * cannot separate them.
 */
export const RETRIEVAL_QUERIES: ReadonlyArray<{
  id: string;
  query: string;
  passages: string[];
  expectedTop: string;
  tier: Tier;
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
    tier: "core",
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
    tier: "core",
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
    tier: "core",
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
    tier: "core",
  },

  // --- hard: the correct passage deliberately shares FEWER words with the query
  // than the distractors do. Bag-of-words ranking picks a distractor; answering
  // correctly requires reading for meaning rather than counting term overlap.
  {
    id: "near-miss-insulin",
    query: "Which organ releases insulin into the bloodstream?",
    passages: [
      "The liver releases stored glucose into the bloodstream when an organ signals that energy is low.",
      "Insulin in the bloodstream lets muscle cells absorb glucose after a meal.",
      "Beta cells of the pancreas secrete the hormone that lowers blood sugar.",
      "An organ transplant can fail when the recipient's immune system rejects the new organ.",
    ],
    expectedTop:
      "Beta cells of the pancreas secrete the hormone that lowers blood sugar.",
    tier: "hard",
  },
  {
    id: "near-miss-tcp",
    query:
      "Which TCP mechanism prevents a fast sender from overwhelming a slow receiver?",
    passages: [
      "TCP congestion control slows a fast sender when the network path is overwhelmed by traffic.",
      "The receiver advertises a window, and the sender may not transmit more unacknowledged bytes than that window allows.",
      "A slow receiver can still finish a TCP transfer because the sender retransmits segments that are lost.",
      "TCP prevents undetected corruption by carrying a checksum in every segment.",
    ],
    expectedTop:
      "The receiver advertises a window, and the sender may not transmit more unacknowledged bytes than that window allows.",
    tier: "hard",
  },
  {
    id: "near-miss-index",
    query: "Why can a database index make writes slower?",
    passages: [
      "A database index makes reads faster by letting the engine skip a full table scan.",
      "Slower writes in a database are often caused by lock contention between concurrent transactions.",
      "Each insert, update, and delete must also modify every secondary structure that points at the affected row.",
      "Database index fragmentation can make index range scans slower as a table ages.",
    ],
    expectedTop:
      "Each insert, update, and delete must also modify every secondary structure that points at the affected row.",
    tier: "hard",
  },
  {
    id: "near-miss-vaccine",
    query:
      "What does a booster dose do that the initial vaccine dose does not?",
    passages: [
      "The initial vaccine dose does not always produce a strong booster effect in older adults.",
      "A vaccine dose is measured in micrograms of antigen per millilitre.",
      "Protection wanes in the months after the first shot; a later one lifts antibody levels again and widens the range of variants covered.",
      "Booster dose schedules differ between countries and age groups.",
    ],
    expectedTop:
      "Protection wanes in the months after the first shot; a later one lifts antibody levels again and widens the range of variants covered.",
    tier: "hard",
  },
  {
    id: "near-miss-inflation",
    query: "Why does raising interest rates reduce inflation?",
    passages: [
      "Raising interest rates does not always reduce inflation when supply shocks are driving prices.",
      "Inflation reduces the purchasing power of savings that sit at low interest rates.",
      "Borrowing becomes more expensive, households and firms spend less, and weaker demand slows price growth.",
      "Central banks change rates in steps announced at scheduled meetings each year.",
    ],
    expectedTop:
      "Borrowing becomes more expensive, households and firms spend less, and weaker demand slows price growth.",
    tier: "hard",
  },
];

/**
 * Tool selection: labeled query -> expected tool id.
 *
 * Core items contain the literal trigger word `ToolSystem.detectTool` matches
 * ("calculate", "search", "run", "sentiment"). Hard items describe the same
 * intent without the trigger word, or contain a trigger word that points at the
 * wrong tool, so keyword matching lands on the wrong label.
 */
export const TOOL_SELECTION_ITEMS: ReadonlyArray<{
  id: string;
  query: string;
  expected: string;
  tier: Tier;
}> = [
  {
    id: "calc-1",
    query: "Calculate 847 * 293 for me",
    expected: "calculator",
    tier: "core",
  },
  {
    id: "calc-2",
    query: "compute 12 + 30",
    expected: "calculator",
    tier: "core",
  },
  {
    id: "search-1",
    query: "search the web for the latest TypeScript release",
    expected: "websearch",
    tier: "core",
  },
  {
    id: "search-2",
    query: "look up the population of Canada",
    expected: "websearch",
    tier: "core",
  },
  {
    id: "code-1",
    query: "execute this Python code snippet",
    expected: "codeexecution",
    tier: "core",
  },
  {
    id: "sentiment-1",
    query: "what is the sentiment of this review",
    expected: "sentiment",
    tier: "core",
  },
  {
    id: "none-1",
    query: "tell me a short story about the sea",
    expected: "none",
    tier: "core",
  },
  {
    id: "none-2",
    query: "who was the first president",
    expected: "none",
    tier: "core",
  },

  // --- hard: right intent, no trigger word ---
  {
    id: "calc-h1",
    query:
      "My salary is 4200 a month and rent takes 31% of it. How much is rent?",
    expected: "calculator",
    tier: "hard",
  },
  {
    id: "calc-h2",
    query: "Split a 187.50 dinner bill evenly between five people.",
    expected: "calculator",
    tier: "hard",
  },
  {
    id: "search-h1",
    query: "I need today's euro to yen exchange rate.",
    expected: "websearch",
    tier: "hard",
  },
  {
    id: "search-h2",
    query: "Who won the most recent Formula 1 race?",
    expected: "websearch",
    tier: "hard",
  },
  {
    id: "sentiment-h1",
    query: "Does this customer message sound angry or satisfied to you?",
    expected: "sentiment",
    tier: "hard",
  },
  {
    id: "code-h1",
    query: "Here is a Python function — what does it print for n = 5?",
    expected: "codeexecution",
    tier: "hard",
  },

  // --- hard: contains a trigger word that points at the wrong tool ---
  {
    id: "trap-h1",
    // "search" appears, but this is a request for prose, not a lookup.
    query: "Write a poem about a search for meaning in the mountains.",
    expected: "none",
    tier: "hard",
  },
  {
    id: "trap-h2",
    // "calculate" appears, but the request is conceptual, not numeric.
    query: "Explain why people calculate risk differently when they are tired.",
    expected: "none",
    tier: "hard",
  },
  {
    id: "trap-h3",
    // "run" and "code" appear, but the user wants advice, not execution.
    query:
      "What coding conventions should I follow before I run a code review?",
    expected: "none",
    tier: "hard",
  },
];

/**
 * Routing fixtures: a recorded sequence of provider attempts per request.
 * Each attempt is [provider, succeeded]. The primary provider is the first
 * attempt; a fallback is any later attempt used after the primary failed.
 * Scored by exact match of computed success and fallback rates.
 *
 * Not tiered: this is arithmetic over recorded outcomes, not a reasoning task,
 * and no model is asked to do it.
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
 * Abstention: prompts a calculator-only responder must decline rather than
 * answer with a fabricated number.
 *
 * Core items contain no arithmetic at all, so abstaining is easy. Hard items are
 * traps: each one *contains* a well-formed arithmetic expression but cannot be
 * answered from it, because the request needs a fact the responder does not have,
 * asks for a non-numeric form, or is mathematically undefined. A pattern matcher
 * sees the digits and answers anyway.
 */
export const ABSTENTION_ITEMS: ReadonlyArray<{
  id: string;
  input: string;
  tier: Tier;
  /** Why the request cannot be answered as arithmetic. */
  reason: string;
}> = [
  {
    id: "open-1",
    input: "what is the meaning of life?",
    tier: "core",
    reason: "not a computation",
  },
  {
    id: "open-2",
    input: "summarize the plot of Hamlet",
    tier: "core",
    reason: "not a computation",
  },
  {
    id: "open-3",
    input: "is 7 a lucky number",
    tier: "core",
    reason: "opinion, not arithmetic",
  },
  {
    id: "open-4",
    input: "translate hello into French",
    tier: "core",
    reason: "not a computation",
  },
  {
    id: "open-5",
    input: "what year did the Roman Empire fall",
    tier: "core",
    reason: "historical fact, not arithmetic",
  },

  // --- hard: contains real arithmetic but is still unanswerable ---
  {
    id: "trap-missing-fact",
    input: "What is 15 plus 27 divided by the number of continents?",
    tier: "hard",
    reason: "needs an external fact (continent count) to be well defined",
  },
  {
    id: "trap-live-data",
    input: "Add 45 to the current temperature in Berlin.",
    tier: "hard",
    reason: "needs live data the responder does not have",
  },
  {
    id: "trap-population",
    input: "What is 8 times the population of Japan?",
    tier: "hard",
    reason: "needs an external statistic",
  },
  {
    id: "trap-undefined",
    input: "What is 12 divided by 0?",
    tier: "hard",
    reason: "mathematically undefined",
  },
  {
    id: "trap-unknown-var",
    input: "What is 250 plus x?",
    tier: "hard",
    reason: "unbound variable, no numeric answer",
  },
  {
    id: "trap-divergent",
    input:
      "What is the sum of 1 + 2 + 3 and every integer after that, forever?",
    tier: "hard",
    reason: "divergent series, no finite value",
  },
];
