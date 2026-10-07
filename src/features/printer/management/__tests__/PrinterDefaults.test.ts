import { createPrinterDraft, createPrinterLanguage, DEFAULT_PAPER } from '../PrinterDefaults';
import { ConnectionType } from '../../models/connections/ConnectionType';
import { PrintKind } from '../../models/printer/PrintKind';
import { LanguageSelection, PrintLanguage } from '../../models/printer/PrinterLanguage';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperSize } from '../../models/paper/PaperSize';
import { PaperType } from '../../models/paper/PaperType';

const lan = { type: ConnectionType.Lan, host: '192.168.1.50', port: 9100 } as const;

describe('createPrinterLanguage', () => {
  it('giữ ngôn ngữ và cách xác định được truyền vào', () => {
    expect(createPrinterLanguage(PrintLanguage.Tspl, LanguageSelection.Manual)).toEqual({
      type: PrintLanguage.Tspl,
      selection: LanguageSelection.Manual,
    });
  });
});

describe('createPrinterDraft', () => {
  it('điền mặc định và tính deviceId từ kết nối', () => {
    const language = createPrinterLanguage(PrintLanguage.Tspl, LanguageSelection.Auto);
    const printer = createPrinterDraft({ id: 'p1', kind: PrintKind.Label, connection: lan, language });

    expect(printer).toMatchObject({
      id: 'p1',
      deviceId: 'lan:192.168.1.50:9100',
      kind: PrintKind.Label,
      connection: lan,
      language,
      paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode: CutterMode.PerJob },
      capabilities: { cutter: false, cashDrawer: false, color: false, image: true },
      enabled: true,
    });
  });

  it('khả năng mặc định của ESC/POS có dao cắt và ngăn kéo tiền', () => {
    const language = createPrinterLanguage(PrintLanguage.EscPos, LanguageSelection.Auto);

    expect(createPrinterDraft({ kind: PrintKind.Receipt, connection: lan, language }).capabilities).toEqual({
      cutter: true,
      cashDrawer: true,
      color: false,
      image: true,
    });
  });

  it('không có id thì sinh mới; giấy mặc định là bản sao', () => {
    const language = createPrinterLanguage(PrintLanguage.EscPos, LanguageSelection.Auto);
    const printer = createPrinterDraft({ kind: PrintKind.Receipt, connection: lan, language });

    expect(printer.id).toEqual(expect.any(String));
    expect(printer.paper).not.toBe(DEFAULT_PAPER);
  });
});
