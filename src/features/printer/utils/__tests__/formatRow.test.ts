import { formatRow } from '../formatRow';

describe('formatRow', () => {
  it('pads the gap so right lands at the exact character width', () => {
    const row = formatRow('Mã đơn', '#001', 20);
    expect(row).toBe(`Mã đơn${' '.repeat(10)}#001`);
    expect(row.length).toBe(20);
  });

  it('keeps at least 1 space when left+right already fill the width', () => {
    expect(formatRow('AAAAAAAAAA', 'BBBBBBBBBB', 10)).toBe('AAAAAAAAAA BBBBBBBBBB');
  });

  it('keeps at least 1 space when left+right exceed the width', () => {
    expect(formatRow('AAAAAAAAAAAAAAA', 'BBBBBBBBBBBBBBB', 10)).toBe(
      'AAAAAAAAAAAAAAA BBBBBBBBBBBBBBB',
    );
  });
});
