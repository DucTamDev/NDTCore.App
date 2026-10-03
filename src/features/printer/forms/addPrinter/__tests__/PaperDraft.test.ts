import { toPaperOptions, dieCutRowOverflow, dieCutMediaError } from '../PaperDraft';
import { CutterMode, PaperSize, PaperType } from '../../../models/paper/PaperOptions';
import type { PaperDraft } from '../PaperDraft';

describe('toPaperOptions', () => {
  it('giấy cuộn chưa chọn cách cắt thì cắt cuối job', () => {
    const draft = { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode: CutterMode.PerJob };

    expect(toPaperOptions(draft)).toEqual({
      type: PaperType.Continuous,
      paperSize: PaperSize.Mm80,
      cutterMode: CutterMode.PerJob,
    });
  });

  it('giấy cuộn bỏ các kích thước tem còn sót từ lần chọn giấy tem trước', () => {
    const draft = {
      type: PaperType.Continuous,
      paperSize: PaperSize.Mm58,
      cutterMode: CutterMode.None,
      itemHeightMm: 40,
    };

    expect(toPaperOptions(draft)).toEqual({
      type: PaperType.Continuous,
      paperSize: PaperSize.Mm58,
      cutterMode: CutterMode.None,
    });
  });

  it('giấy tem đủ kích thước thì ra giấy tem, không có cách cắt', () => {
    const draft = {
      type: PaperType.DieCut,
      paperSize: PaperSize.Mm58,
      itemWidthMm: 20,
      itemHeightMm: 10,
      columns: 2,
      horizontalGapMm: 2,
      verticalGapMm: 3,
      cutterMode: CutterMode.PerJob,
    };

    expect(toPaperOptions(draft)).toEqual({
      type: PaperType.DieCut,
      paperSize: PaperSize.Mm58,
      itemWidthMm: 20,
      itemHeightMm: 10,
      columns: 2,
      horizontalGapMm: 2,
      verticalGapMm: 3,
    });
  });

  it('giấy tem thiếu một kích thước thì chưa hợp lệ', () => {
    const draft = {
      type: PaperType.DieCut,
      paperSize: PaperSize.Mm58,
      itemWidthMm: 20,
      itemHeightMm: 10,
      columns: 2,
      horizontalGapMm: 2,
    };

    expect(toPaperOptions(draft)).toBeNull();
  });
});

const die = (o: Partial<PaperDraft>): PaperDraft => ({
  type: PaperType.DieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3, ...o,
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
    expect(dieCutRowOverflow({ type: PaperType.Continuous, paperSize: 80, cutterMode: CutterMode.PerJob })).toBeNull();
  });
  it('null khi die-cut thiếu field (chưa đủ để tính)', () => {
    expect(dieCutRowOverflow({ type: PaperType.DieCut, paperSize: 100 })).toBeNull();
  });
});

describe('dieCutMediaError', () => {
  it('báo thiếu field khi die-cut thiếu columns', () => {
    const msg = dieCutMediaError({ type: PaperType.DieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, horizontalGapMm: 2, verticalGapMm: 3 });
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
    expect(dieCutMediaError({ type: PaperType.Continuous, paperSize: 80, cutterMode: CutterMode.PerJob })).toBeNull();
  });
});
