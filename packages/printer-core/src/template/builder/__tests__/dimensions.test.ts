import { fixed, fill, auto } from '../dimensions';

describe('dimension factories', () => {
  it('fixed(value) returns a fixed Dimension', () => {
    expect(fixed(120)).toEqual({ type: 'fixed', value: 120 });
  });
  it('fill() returns a fill Dimension', () => {
    expect(fill()).toEqual({ type: 'fill' });
  });
  it('auto() returns an auto Dimension', () => {
    expect(auto()).toEqual({ type: 'auto' });
  });
});
