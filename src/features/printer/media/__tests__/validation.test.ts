import { dieCutRowOverflow, dieCutMediaError } from '../validation';
import { PrintMediaType } from '../../models/media/PrintMedia';
import type { PrintMedia } from '../../models/media/PrintMedia';

const die = (o: Partial<PrintMedia>): PrintMedia => ({
  type: PrintMediaType.dieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3, ...o,
});

describe('dieCutRowOverflow', () => {
  it('null khi hàng vừa khổ in (3×30 + 2×2 = 94 ≤ 96)', () => {
    expect(dieCutRowOverflow(die({}))).toBeNull();
  });
  it('message khi vượt (4×30 + 3×2 = 126 > 96)', () => {
    const msg = dieCutRowOverflow(die({ columns: 4 }));
    expect(msg).toContain('126');
    expect(msg).toContain('96');
  });
  it('null cho media continuous', () => {
    expect(dieCutRowOverflow({ type: PrintMediaType.continuous, paperSize: 80 })).toBeNull();
  });
  it('null khi die-cut thiếu field (chưa đủ để tính)', () => {
    expect(dieCutRowOverflow({ type: PrintMediaType.dieCut, paperSize: 100 })).toBeNull();
  });
});

describe('dieCutMediaError', () => {
  it('báo thiếu field khi die-cut thiếu columns', () => {
    const msg = dieCutMediaError({ type: PrintMediaType.dieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, horizontalGapMm: 2, verticalGapMm: 3 });
    expect(msg).toContain('columns');
  });
  it('trả message tràn khổ khi đủ field nhưng vượt', () => {
    const msg = dieCutMediaError(die({ columns: 4 }));
    expect(msg).toContain('126');
    expect(msg).toContain('96');
  });
  it('null khi die-cut đủ field và vừa khổ', () => {
    expect(dieCutMediaError(die({}))).toBeNull();
  });
  it('null cho media continuous', () => {
    expect(dieCutMediaError({ type: PrintMediaType.continuous, paperSize: 80 })).toBeNull();
  });
});
