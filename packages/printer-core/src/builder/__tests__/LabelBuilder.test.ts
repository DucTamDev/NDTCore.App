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

  it('pushes a diagonal element when line coordinates are not axis-aligned', () => {
    const doc = new LabelBuilder({ width: 40, height: 30 })
      .line({ x1: 0, y1: 0, x2: 10, y2: 20 })
      .resolve();
    expect(doc.elements[0]?.type).toBe('diagonal');
  });

  it('pushes a plain line element when coordinates are axis-aligned', () => {
    const doc = new LabelBuilder({ width: 40, height: 30 })
      .line({ x1: 0, y1: 0, x2: 10, y2: 0 })
      .resolve();
    expect(doc.elements[0]?.type).toBe('line');
  });

  it('chains all 7 newly-wired element methods', () => {
    const doc = new LabelBuilder({ width: 40, height: 30 })
      .cut({ mode: 'full' })
      .table({ columns: [{ width: 10 }], rows: [['a']] })
      .pageBreak()
      .spacer({ size: 5 })
      .row()
      .column()
      .resolve();
    expect(doc.elements.map((e) => e.type)).toEqual(['cut', 'table', 'pageBreak', 'spacer', 'row', 'column']);
  });
});
