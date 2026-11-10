import { PrinterErrorCode } from '@ndtcore/printer';
import { printerErrorMessageOf } from '../PrinterErrorMessages';

describe('printerErrorMessageOf', () => {
  const codes = Object.values(PrinterErrorCode);

  it('mọi mã public đều có câu riêng, không rỗng', () => {
    codes.forEach((code) => expect(printerErrorMessageOf(code)).toMatch(/\S/));
    expect(new Set(codes.map(printerErrorMessageOf)).size).toBe(codes.length);
  });

  it('câu cho người dùng, không lộ mã', () => {
    codes.forEach((code) => expect(printerErrorMessageOf(code)).not.toContain(code));
  });
});
