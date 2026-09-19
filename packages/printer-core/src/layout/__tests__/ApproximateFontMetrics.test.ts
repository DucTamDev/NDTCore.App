import { ApproximateFontMetrics } from '../ApproximateFontMetrics';

describe('ApproximateFontMetrics', () => {
  const metrics = new ApproximateFontMetrics();

  it('measure() scales width with text length and fontSize', () => {
    const small = metrics.measure('AB', { fontSize: 10 });
    const long = metrics.measure('ABCD', { fontSize: 10 });
    expect(long.widthDots).toBeGreaterThan(small.widthDots);
  });

  it('measure() reports lineCount 1 for single-line text', () => {
    const result = metrics.measure('hello', { fontSize: 12 });
    expect(result.lineCount).toBe(1);
  });

  it('wrap() splits text into lines that each fit maxWidthDots', () => {
    const lines = metrics.wrap('one two three four', 60, { fontSize: 10 });
    for (const line of lines) {
      expect(metrics.measure(line, { fontSize: 10 }).widthDots).toBeLessThanOrEqual(60);
    }
  });

  it('wrap() hard-breaks a single word longer than maxWidthDots', () => {
    const lines = metrics.wrap('supercalifragilisticexpialidocious', 40, { fontSize: 10 });
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(metrics.measure(line, { fontSize: 10 }).widthDots).toBeLessThanOrEqual(40);
    }
  });

  it('wrap() returns the original text as one line when it already fits', () => {
    const lines = metrics.wrap('short', 1000, { fontSize: 10 });
    expect(lines).toEqual(['short']);
  });
});
