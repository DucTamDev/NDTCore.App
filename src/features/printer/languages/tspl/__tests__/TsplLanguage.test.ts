import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { TsplLanguage } from '../TsplLanguage';
import { fingerprintOf, stripedPngBase64 } from '../../../testing/encodeCases';
import { PrintKind } from '../../../models/printer/PrintKind';
import { CutterMode, PaperSize, PaperType } from '../../../models/paper/PaperOptions';
import { PrinterErrorCode } from '../../../errors/PrinterError';
import { makePrinter, makeTsplLanguage } from '../../../testing/printerFixtures';

const printer = makePrinter({ language: makeTsplLanguage() });

const paper58 = { type: PaperType.Continuous, paperSize: PaperSize.Mm58, cutterMode: CutterMode.PerJob } as const;

const rasterLabelPrinter = makePrinter({ kind: PrintKind.Label, language: makeTsplLanguage(), paper: paper58 });

/** Ảnh vuông toàn đen: chuẩn hoá về bề rộng 384px của giấy 58mm thì cao 384px, vượt chiều cao tem 30mm (240px). */
const squarePngBase64 = (): string => {
  const rgba = new Uint8Array(2 * 2 * 4);

  for (let alpha = 3; alpha < rgba.length; alpha += 4) {
    rgba[alpha] = 255;
  }

  return Buffer.from(new Uint8Array(UPNG.encode([rgba.buffer], 2, 2, 0, [], true))).toString('base64');
};

describe('TsplLanguage', () => {
  it('lệnh dò là ~!T và chỉ khớp khi máy có trả lời', () => {
    const probe = TsplLanguage.identifyProbe;

    expect(probe && Array.from(probe.command)).toEqual([0x7e, 0x21, 0x54, 0x0d, 0x0a]);
    expect(probe?.matches(new Uint8Array([]))).toBe(false);
    expect(probe?.matches(new Uint8Array([0x00]))).toBe(true);
  });

  it('số hàng không hợp lệ coi như 1 hàng', () => {
    const image = stripedPngBase64();
    const oneRow = fingerprintOf(TsplLanguage.encode(printer, image));

    expect(fingerprintOf(TsplLanguage.encode(printer, image, { rows: 0 }))).toBe(oneRow);
    expect(fingerprintOf(TsplLanguage.encode(printer, image, { rows: Number.NaN }))).toBe(oneRow);
  });

  it('ảnh cao hơn tem → IMAGE_TOO_LARGE', () => {
    expect(() => TsplLanguage.encode(rasterLabelPrinter, squarePngBase64())).toThrow(
      expect.objectContaining({ code: PrinterErrorCode.IMAGE_TOO_LARGE }),
    );
  });

  it('cùng ảnh đó in hoá đơn giấy cuộn thì vẫn in được', () => {
    const receiptPrinter = { ...rasterLabelPrinter, kind: PrintKind.Receipt };

    expect(() => TsplLanguage.encode(receiptPrinter, squarePngBase64())).not.toThrow();
  });
});
