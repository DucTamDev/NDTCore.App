import { validateTableColumns } from '../validateTableColumns';

describe('validateTableColumns', () => {
  it('throws a clear error for a zero-width column', () => {
    expect(() => validateTableColumns([{ width: 30 }, { width: 0 }])).toThrow(
      'TableElement requires every column to specify a positive width — auto-sizing columns (width <= 0) are not yet supported',
    );
  });

  it('throws a clear error for a negative-width column', () => {
    expect(() => validateTableColumns([{ width: -5 }])).toThrow(/positive width/);
  });

  it('does not throw when every column has a positive width', () => {
    expect(() => validateTableColumns([{ width: 30, align: 'left' }, { width: 5, align: 'center' }, { width: 13, align: 'right' }])).not.toThrow();
  });
});
