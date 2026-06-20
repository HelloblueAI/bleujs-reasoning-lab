/**
 * Local arithmetic for /reason — avoids LLM round-trips on simple math.
 */

export type ArithmeticResult = {
  answer: string;
  confidence: number;
  operands: [number, number];
  operator: '+' | '-' | '*' | '/';
};

const OPERATOR_ALIASES: Record<string, '+' | '-' | '*' | '/'> = {
  plus: '+',
  '+': '+',
  minus: '-',
  '-': '-',
  times: '*',
  'multiplied by': '*',
  '*': '*',
  '×': '*',
  x: '*',
  'divided by': '/',
  over: '/',
  '/': '/',
};

const ARITHMETIC_PATTERN =
  /(?:what\s+is\s+)?(-?\d[\d,]*(?:\.\d+)?)\s*(plus|\+|minus|-|times|multiplied\s+by|\*|×|\bx\b|divided\s+by|\/|over)\s*(-?\d[\d,]*(?:\.\d+)?)/i;

function parseNumber(raw: string): number | null {
  const value = Number(raw.replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString('en-US');
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 10 });
}

function operatorLabel(op: '+' | '-' | '*' | '/'): string {
  switch (op) {
    case '*':
      return '×';
    case '/':
      return '÷';
    case '-':
      return '−';
    default:
      return op;
  }
}

function compute(a: number, b: number, op: '+' | '-' | '*' | '/'): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? null : a / b;
  }
}

export function tryArithmeticReason(input: string): ArithmeticResult | null {
  const match = input.trim().match(ARITHMETIC_PATTERN);
  if (!match) return null;

  const left = parseNumber(match[1]!);
  const opKey = match[2]!.toLowerCase().trim();
  const right = parseNumber(match[3]!);
  const operator = OPERATOR_ALIASES[opKey];
  if (left === null || right === null || !operator) return null;

  const result = compute(left, right, operator);
  if (result === null) return null;

  const label = operatorLabel(operator);
  return {
    answer: `${formatNumber(left)} ${label} ${formatNumber(right)} = ${formatNumber(result)}`,
    confidence: 1,
    operands: [left, right],
    operator,
  };
}

/** Remove common markdown emphasis from LLM answers for plain JSON display. */
export function stripMarkdownEmphasis(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1');
}
