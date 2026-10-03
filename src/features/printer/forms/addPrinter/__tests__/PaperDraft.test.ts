import { toPaperOptions } from '../PaperDraft';
import { CutterMode, PaperSize, PaperType } from '../../../models/paper/PaperOptions';

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
