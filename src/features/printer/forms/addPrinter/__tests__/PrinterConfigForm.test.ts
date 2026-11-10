import {
  CutMode,
  DEFAULT_LABEL_PAPER,
  DEFAULT_RECEIPT_PAPER,
  FieldErrorReason,
  LangSource,
  PrinterDpi,
  PrinterKind,
  PrinterLang,
  type PrinterConfig,
} from '@ndtcore/printer';
import {
  configUpdateOf,
  defaultFormValuesOf,
  fieldMessageOf,
  formFieldOf,
  formValuesOf,
} from '../PrinterConfigForm';

const receipt: PrinterConfig = {
  kind: PrinterKind.Receipt,
  name: 'Quầy',
  lang: PrinterLang.EscPos,
  langSource: LangSource.Probe,
  capabilities: { hasCutter: true, dpi: PrinterDpi.Dpi203 },
  paper: { widthMm: 58, cutMode: CutMode.Partial, feedLines: 4 },
};

const label: PrinterConfig = {
  kind: PrinterKind.Label,
  name: 'Tem',
  lang: PrinterLang.Tspl,
  langSource: LangSource.Manual,
  capabilities: { hasCutter: false, dpi: PrinterDpi.Dpi300 },
  paper: { widthMm: 40, heightMm: 30 },
};

describe('PrinterConfigForm', () => {
  it('formValuesOf: số thành chữ cho ô nhập, field thiếu lấy mặc định của kind', () => {
    expect(formValuesOf(label)).toMatchObject({
      name: 'Tem',
      lang: PrinterLang.Tspl,
      hasCutter: false,
      dpi: PrinterDpi.Dpi300,
      widthMm: '40',
      heightMm: '30',
      columns: String(DEFAULT_LABEL_PAPER.columns),
      rowGapMm: String(DEFAULT_LABEL_PAPER.rowGapMm),
    });
  });

  it('configUpdateOf hoá đơn: chỉ gửi giấy của hoá đơn', () => {
    expect(configUpdateOf(formValuesOf(receipt), PrinterKind.Receipt)).toEqual({
      name: 'Quầy',
      lang: PrinterLang.EscPos,
      capabilities: { hasCutter: true, dpi: PrinterDpi.Dpi203 },
      paper: { widthMm: 58, cutMode: CutMode.Partial, feedLines: 4 },
    });
  });

  it('configUpdateOf tem: chỉ gửi giấy của tem', () => {
    expect(
      configUpdateOf(
        { ...formValuesOf(label), columns: '2' },
        PrinterKind.Label,
      ).paper,
    ).toEqual({
      widthMm: 40,
      heightMm: 30,
      columns: 2,
      columnGapMm: DEFAULT_LABEL_PAPER.columnGapMm,
      rowGapMm: DEFAULT_LABEL_PAPER.rowGapMm,
    });
  });

  it('lang chưa chọn thì không gửi lang, để package báo REQUIRED', () => {
    const values = { ...defaultFormValuesOf(PrinterKind.Receipt), name: 'Mới' };
    expect(configUpdateOf(values, PrinterKind.Receipt)).not.toHaveProperty(
      'lang',
    );
  });

  it('defaultFormValuesOf hoá đơn theo giấy mặc định của package', () => {
    expect(defaultFormValuesOf(PrinterKind.Receipt)).toMatchObject({
      widthMm: String(DEFAULT_RECEIPT_PAPER.widthMm),
      cutMode: DEFAULT_RECEIPT_PAPER.cutMode,
      lang: '',
    });
  });

  it('đường dẫn lỗi của package ra ô của form', () => {
    expect(formFieldOf('paper.widthMm')).toBe('widthMm');
    expect(formFieldOf('capabilities.dpi')).toBe('dpi');
    expect(formFieldOf('name')).toBe('name');
    expect(formFieldOf('printer')).toBeUndefined();
    expect(fieldMessageOf(FieldErrorReason.OutOfRange)).toMatch(/\S/);
  });
});
