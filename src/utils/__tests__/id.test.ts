import { generateId } from '../id';

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('generates unique ids across repeated calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('matches the <base36 timestamp>-<random suffix> shape', () => {
    expect(generateId()).toMatch(/^[0-9a-z]+-[0-9a-z]{8}$/);
  });
});
