import { PrintFailureKind, printFailureKindOf } from '../PrintFailureKind';
import type { ErrorCode } from '../../../errors';

describe('printFailureKindOf', () => {
  it('CONNECTION_FAILED là lỗi kết nối', () => {
    expect(printFailureKindOf('CONNECTION_FAILED')).toBe(PrintFailureKind.ConnectFailed);
  });

  it.each([
    'CONNECTION_LOST',
    'NOT_CONNECTED',
    'DEVICE_NOT_FOUND',
    'BLUETOOTH_DISABLED',
    'SERVICE_CLOSED',
    'PERMISSION_DENIED',
  ])('%s là máy không dùng được', (code) => {
    expect(printFailureKindOf(code as ErrorCode)).toBe(PrintFailureKind.DeviceUnavailable);
  });

  it.each(['WRITE_FAILED', 'WRITE_TIMEOUT', 'INVALID_IMAGE', 'ENCODE_FAILED', 'PRINTER_NOT_FOUND', 'UNKNOWN_ERROR'])(
    '%s là lỗi của riêng lệnh',
    (code) => {
      expect(printFailureKindOf(code as ErrorCode)).toBe(PrintFailureKind.TaskFailed);
    },
  );
});
