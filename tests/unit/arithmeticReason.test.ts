import { stripMarkdownEmphasis, tryArithmeticReason } from '../../src/lab/arithmeticReason';

describe('tryArithmeticReason', () => {
  it('multiplies with "times" phrasing', () => {
    const result = tryArithmeticReason('what is 2 times 4333');
    expect(result).not.toBeNull();
    expect(result!.answer).toBe('2 × 4,333 = 8,666');
    expect(result!.confidence).toBe(1);
  });

  it('multiplies with × symbol', () => {
    const result = tryArithmeticReason('What is 17 × 23?');
    expect(result!.answer).toBe('17 × 23 = 391');
  });

  it('adds and subtracts', () => {
    expect(tryArithmeticReason('2 plus 3')!.answer).toBe('2 + 3 = 5');
    expect(tryArithmeticReason('10 minus 4')!.answer).toBe('10 − 4 = 6');
  });

  it('divides', () => {
    expect(tryArithmeticReason('100 divided by 4')!.answer).toBe('100 ÷ 4 = 25');
  });

  it('returns null for non-arithmetic', () => {
    expect(tryArithmeticReason('explain quantum entanglement')).toBeNull();
  });

  it('returns null for division by zero', () => {
    expect(tryArithmeticReason('5 divided by 0')).toBeNull();
  });
});

describe('stripMarkdownEmphasis', () => {
  it('removes bold markers', () => {
    expect(stripMarkdownEmphasis('2 times 4333 = **8,666**')).toBe('2 times 4333 = 8,666');
  });
});
