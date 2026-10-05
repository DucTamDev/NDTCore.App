import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { EscPosLanguage } from '../EscPosLanguage';
import { makeEscPosLanguage, makePrinter } from '../../../testing/printerFixtures';
import { PrintErrorCode } from '../../../errors/PrintErrorCode';

const printer = makePrinter({ language: makeEscPosLanguage() });

/** Ảnh 2x6 toàn đen: chuẩn hoá về bề rộng 576px thì cao 1728px, vượt trần an toàn 1600px của giấy 80mm. */
const tallPngBase64 = (): string => {
  const rgba = new Uint8Array(2 * 6 * 4);

  for (let alpha = 3; alpha < rgba.length; alpha += 4) {
    rgba[alpha] = 255;
  }

  return Buffer.from(new Uint8Array(UPNG.encode([rgba.buffer], 2, 6, 0, [], true))).toString('base64');
};

describe('EscPosLanguage', () => {
  it('ảnh không giải mã được → IMAGE_INVALID', () => {
    expect(() => EscPosLanguage.encode(printer, 'not-a-png')).toThrow(
      expect.objectContaining({ code: PrintErrorCode.INVALID_IMAGE }),
    );
  });

  it('ảnh cao quá trần an toàn → IMAGE_TOO_LARGE', () => {
    expect(() => EscPosLanguage.encode(printer, tallPngBase64())).toThrow(
      expect.objectContaining({ code: PrintErrorCode.IMAGE_TOO_LARGE }),
    );
  });

  it('không có lệnh dò', () => {
    expect(EscPosLanguage.identifyProbe).toBeUndefined();
  });
});
