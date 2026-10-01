import { PrinterErrorCode, PrinterErrorException } from '../../errors/PrinterError';

/** Mã lỗi `DeviceModule` (native) → mã lỗi máy in và thông báo hiển thị cho người dùng. */
const NATIVE_ERRORS: Record<string, { code: PrinterErrorCode; message: string }> = {
  INVALID_ARGUMENT: { code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thông tin kết nối máy in không hợp lệ' },
  DEVICE_NOT_FOUND: { code: PrinterErrorCode.PRINTER_NOT_FOUND, message: 'Không tìm thấy máy in' },
  AMBIGUOUS_DEVICE: {
    code: PrinterErrorCode.PRINTER_CONNECTION_FAILED,
    message: 'Có nhiều máy in USB cùng loại, chưa xác định được máy cần dùng',
  },
  PERMISSION_DENIED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền dùng máy in' },
  BLUETOOTH_DISABLED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Bluetooth đang tắt' },
  CONNECTION_FAILED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Không kết nối được máy in' },
  NOT_CONNECTED: { code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' },
  CONNECTION_LOST: { code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Mất kết nối máy in' },
  SERVICE_CLOSED: { code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' },
  WRITE_FAILED: { code: PrinterErrorCode.PRINTER_WRITE_FAILED, message: 'Gửi dữ liệu tới máy in thất bại' },
  WRITE_TIMEOUT: { code: PrinterErrorCode.PRINTER_WRITE_FAILED, message: 'Máy in không nhận hết dữ liệu kịp thời' },
  READ_NOT_SUPPORTED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Máy in không hỗ trợ đọc phản hồi' },
  READ_FAILED: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Không đọc được phản hồi máy in' },
};

const nativeCodeOf = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const { code } = error as { code: unknown };
  return typeof code === 'string' ? code : undefined;
};

/** Lỗi không mang mã native (lỗi lập trình, lỗi lạ) giữ `UNKNOWN_ERROR` kèm thông báo gốc. */
export const toPrinterError = (error: unknown): PrinterErrorException => {
  const nativeCode = nativeCodeOf(error);
  const mapped = nativeCode ? NATIVE_ERRORS[nativeCode] : undefined;

  if (mapped) {
    return new PrinterErrorException({ code: mapped.code, message: mapped.message, cause: error });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new PrinterErrorException({ code: PrinterErrorCode.UNKNOWN_ERROR, message, cause: error });
};
