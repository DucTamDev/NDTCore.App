import { paperFormErrorOf, toPaperFormValues, toPaperOptions, type PaperFormValues } from '../PaperFormSchema';
import { CutterMode } from '../../../models/paper/CutterMode';
import { PaperSize } from '../../../models/paper/PaperSize';
import { PaperType } from '../../../models/paper/PaperType';
import type { PaperOptions } from '../../../models/paper/PaperOptions';

const continuous: PaperOptions = {
  type: PaperType.Continuous,
  paperSize: PaperSize.Mm80,
  cutterMode: CutterMode.PerRow,
};

const dieCut: PaperOptions = {
  type: PaperType.DieCut,
  paperSize: PaperSize.Mm100,
  itemWidthMm: 30,
  itemHeightMm: 20,
  columns: 3,
  horizontalGapMm: 2,
  verticalGapMm: 3,
};

const dieCutValues = (overrides: Partial<PaperFormValues> = {}): PaperFormValues => ({
  ...toPaperFormValues(dieCut),
  ...overrides,
});

describe('toPaperFormValues / toPaperOptions', () => {
  it('giấy cuộn đi một vòng form vẫn y nguyên', () => {
    expect(toPaperOptions(toPaperFormValues(continuous))).toEqual(continuous);
  });

  it('giấy tem đi một vòng form vẫn y nguyên', () => {
    expect(toPaperOptions(toPaperFormValues(dieCut))).toEqual(dieCut);
  });

  it('giấy cuộn vẫn có sẵn kích thước tem mặc định để chuyển sang giấy tem', () => {
    expect(toPaperFormValues(continuous)).toMatchObject({
      itemWidthMm: '30',
      itemHeightMm: '20',
      columns: '2',
      horizontalGapMm: '2',
      verticalGapMm: '3',
    });
  });

  it('giấy cuộn bỏ qua ô kích thước tem dù đang sai', () => {
    const values = { ...toPaperFormValues(continuous), itemWidthMm: '' };
    expect(toPaperOptions(values)).toEqual(continuous);
    expect(paperFormErrorOf(values)).toBeNull();
  });
});

describe('paperFormErrorOf', () => {
  it('null khi giấy tem hợp lệ', () => {
    expect(paperFormErrorOf(dieCutValues())).toBeNull();
  });

  it('ô trống báo lỗi, không coi là 0', () => {
    expect(paperFormErrorOf(dieCutValues({ horizontalGapMm: '' }))).toBe('Khoảng cách ngang phải là số từ 0');
    expect(toPaperOptions(dieCutValues({ horizontalGapMm: '' }))).toBeNull();
  });

  it('khoảng cách bằng 0 là hợp lệ', () => {
    expect(toPaperOptions(dieCutValues({ horizontalGapMm: '0', verticalGapMm: '0' }))).toMatchObject({
      horizontalGapMm: 0,
      verticalGapMm: 0,
    });
  });

  it('chữ không phải số báo lỗi', () => {
    expect(paperFormErrorOf(dieCutValues({ itemHeightMm: 'abc' }))).toBe('Cao tem phải là số lớn hơn 0');
  });

  it('số cột lẻ thập phân báo lỗi', () => {
    expect(paperFormErrorOf(dieCutValues({ columns: '1.5' }))).toBe('Số cột phải là số nguyên từ 1');
  });

  it('nhiều ô sai thì lỗi đầu tiên là ô trên cùng', () => {
    const values = dieCutValues({ itemWidthMm: '', verticalGapMm: '' });
    expect(paperFormErrorOf(values)).toBe('Rộng tem phải là số lớn hơn 0');
  });

  it('hàng tem tràn khổ báo lỗi (4×30 + 3×2 = 126 > 96)', () => {
    const error = paperFormErrorOf(dieCutValues({ columns: '4' }));
    expect(error).toContain('126');
    expect(error).toContain('96');
  });
});
