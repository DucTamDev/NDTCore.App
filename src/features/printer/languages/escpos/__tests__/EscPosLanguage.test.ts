import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { EscPosLanguage } from '../EscPosLanguage';
import { RenderMode } from '../../../models/printer/PrinterLanguage';
import { PrinterErrorCode } from '../../../errors/PrinterError';
import { makeEscPosLanguage, makePrinter } from '../../../testing/printerFixtures';

const textDocument = { elements: [{ type: 'text' as const, content: 'In thử', x: 0, y: 0 }] };

const rasterPrinter = makePrinter({ language: makeEscPosLanguage({ renderMode: RenderMode.Raster }) });

/** Ảnh 2x6 toàn đen: chuẩn hoá về bề rộng 576px thì cao 1728px, vượt trần an toàn 1600px của giấy 80mm. */
const tallPngBase64 = (): string => {
  const rgba = new Uint8Array(2 * 6 * 4);

  for (let alpha = 3; alpha < rgba.length; alpha += 4) {
    rgba[alpha] = 255;
  }

  return Buffer.from(new Uint8Array(UPNG.encode([rgba.buffer], 2, 6, 0, [], true))).toString('base64');
};

describe('EscPosLanguage', () => {
  it('lệnh văn bản không gửi chuỗi mở đầu ESC @ của bộ encode', () => {
    const bytes = EscPosLanguage.encode(makePrinter(), { text: textDocument });

    expect([bytes[0], bytes[1]]).not.toEqual([0x1b, 0x40]);
  });

  it('in ảnh mà thiếu ảnh → IMAGE_REQUIRED', () => {
    expect(() => EscPosLanguage.encode(rasterPrinter, { text: textDocument })).toThrow(
      expect.objectContaining({ code: PrinterErrorCode.IMAGE_REQUIRED }),
    );
  });

  it('ảnh không giải mã được → IMAGE_INVALID', () => {
    expect(() => EscPosLanguage.encode(rasterPrinter, { text: textDocument, image: 'not-a-png' })).toThrow(
      expect.objectContaining({ code: PrinterErrorCode.IMAGE_INVALID }),
    );
  });

  it('ảnh cao quá trần an toàn → IMAGE_TOO_LARGE', () => {
    expect(() => EscPosLanguage.encode(rasterPrinter, { text: textDocument, image: tallPngBase64() })).toThrow(
      expect.objectContaining({ code: PrinterErrorCode.IMAGE_TOO_LARGE }),
    );
  });

  it('không có lệnh dò', () => {
    expect(EscPosLanguage.identifyProbe).toBeUndefined();
  });
});
