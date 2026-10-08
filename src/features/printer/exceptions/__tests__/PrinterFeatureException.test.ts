import { DeviceErrorException } from '../DeviceErrorException';
import { PrintErrorException } from '../PrintErrorException';
import { PrinterErrorException } from '../PrinterErrorException';
import { PrinterFeatureException } from '../PrinterFeatureException';
import { errorCodeOf, toPrinterFeatureException } from '..';
import { DeviceErrorCode, PrintErrorCode, PrinterErrorCode } from '../../errors';

describe('exception của feature máy in', () => {
  it.each([
    ['DeviceErrorException', new DeviceErrorException({ code: DeviceErrorCode.WRITE_FAILED, message: 'Gửi lỗi' })],
    ['PrinterErrorException', new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_FOUND, message: 'x' })],
    ['PrintErrorException', new PrintErrorException({ code: PrintErrorCode.INVALID_IMAGE, message: 'Ảnh hỏng' })],
  ])('%s kế thừa lớp nền và mang tên lớp', (name, error) => {
    expect(error).toBeInstanceOf(PrinterFeatureException);
    expect(error.name).toBe(name);
  });

  it('giữ code, message và lỗi gốc', () => {
    const cause = new Error('native');
    const error = new DeviceErrorException({ code: DeviceErrorCode.CONNECTION_LOST, message: 'Mất kết nối', cause });

    expect(error).toMatchObject({ code: DeviceErrorCode.CONNECTION_LOST, cause });
    expect(error.message).toBe('Mất kết nối');
  });
});

describe('errorCodeOf', () => {
  it('trả code của exception thuộc bất kỳ tầng nào', () => {
    expect(errorCodeOf(new DeviceErrorException({ code: DeviceErrorCode.NOT_CONNECTED, message: 'x' }))).toBe(
      DeviceErrorCode.NOT_CONNECTED,
    );
    expect(errorCodeOf(new PrintErrorException({ code: PrintErrorCode.IMAGE_TOO_LARGE, message: 'x' }))).toBe(
      PrintErrorCode.IMAGE_TOO_LARGE,
    );
  });

  it('lỗi không phải exception của feature → UNKNOWN_ERROR', () => {
    expect(errorCodeOf(new Error('x'))).toBe(PrintErrorCode.UNKNOWN_ERROR);
  });
});

describe('toPrinterFeatureException', () => {
  it('exception của feature trả nguyên', () => {
    const error = new DeviceErrorException({ code: DeviceErrorCode.NOT_CONNECTED, message: 'x' });

    expect(toPrinterFeatureException(error)).toBe(error);
  });

  it('lỗi khác bọc thành PrintErrorException UNKNOWN_ERROR, giữ thông báo và lỗi gốc', () => {
    const cause = new Error('boom');
    const error = toPrinterFeatureException(cause);

    expect(error).toBeInstanceOf(PrintErrorException);
    expect(error).toMatchObject({ code: PrintErrorCode.UNKNOWN_ERROR, cause });
    expect(error.message).toBe('boom');
  });
});
