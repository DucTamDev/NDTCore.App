import { PrinterErrorException, errorCodeOf } from '../PrinterErrorException';
import { PrinterErrorCode } from '../../errors/PrinterErrorCode';

describe('PrinterErrorException', () => {
  it('giữ code, message và lỗi gốc', () => {
    const cause = new Error('native');
    const error = new PrinterErrorException({ code: PrinterErrorCode.PRINTER_BUSY, message: 'Máy đang bận', cause });

    expect(error).toMatchObject({ name: 'PrinterErrorException', code: 'PRINTER_BUSY', cause });
    expect(error.message).toBe('Máy đang bận');
  });
});

describe('errorCodeOf', () => {
  it('trả UNKNOWN_ERROR cho lỗi không phải PrinterErrorException', () => {
    expect(errorCodeOf(new Error('x'))).toBe(PrinterErrorCode.UNKNOWN_ERROR);
  });

  it('trả code của PrinterErrorException', () => {
    const error = new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_FOUND, message: 'y' });

    expect(errorCodeOf(error)).toBe(PrinterErrorCode.PRINTER_NOT_FOUND);
  });
});
