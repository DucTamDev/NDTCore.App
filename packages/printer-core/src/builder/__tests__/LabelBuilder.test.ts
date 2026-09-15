import { LabelBuilder } from '../LabelBuilder';

describe('LabelBuilder', () => {
  it('chains element calls and resolves dot measurements', () => {
    const doc = new LabelBuilder({ width: 40, height: 30, unit: 'mm', dpi: 203 })
      .text('Hello', { x: 10, y: 10 })
      .box({ x: 0, y: 0, width: 100, height: 50 })
      .resolve();
    expect(doc.elements).toHaveLength(2);
    expect(doc.widthDots).toBeGreaterThan(0);
  });

  it('defaults width/dpi from a known printer profile', () => {
    const doc = new LabelBuilder({ printer: 'tsc-te310' } as never).resolve();
    expect(doc.dpi).toBe(300);
  });

  it('throws when width is missing and no profile is given', () => {
    expect(() => new LabelBuilder({} as never)).toThrow();
  });
});
