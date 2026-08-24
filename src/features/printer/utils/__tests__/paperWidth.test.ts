import { PAPER_WIDTH_CHARS, PAPER_IMAGE_WIDTH_PX, formatRow } from '../paperWidth';

describe('PAPER_WIDTH_CHARS', () => {
  it('maps 58mm to 32 characters', () => {
    expect(PAPER_WIDTH_CHARS['58mm']).toBe(32);
  });

  it('maps 80mm to 48 characters', () => {
    expect(PAPER_WIDTH_CHARS['80mm']).toBe(48);
  });
});

describe('PAPER_IMAGE_WIDTH_PX', () => {
  it('maps 58mm to 384px and 80mm to 576px', () => {
    expect(PAPER_IMAGE_WIDTH_PX['58mm']).toBe(384);
    expect(PAPER_IMAGE_WIDTH_PX['80mm']).toBe(576);
  });
});

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
