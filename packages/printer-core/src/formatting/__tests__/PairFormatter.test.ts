import { formatPair } from '../PairFormatter';

describe('formatPair', () => {
  it('right-aligns the second value with padding between', () => {
    const line = formatPair('Hamburger x2', '$25.98', 48);
    expect(line).toHaveLength(48);
    expect(line.endsWith('$25.98')).toBe(true);
    expect(line.startsWith('Hamburger x2')).toBe(true);
  });
});
