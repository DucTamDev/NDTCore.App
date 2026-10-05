import { type ErrorCode, PrintErrorCode } from '../errors';
import { PrinterFeatureException } from './PrinterFeatureException';
import { PrintErrorException } from './PrintErrorException';

export { PrinterFeatureException, type ExceptionDetail } from './PrinterFeatureException';
export { DeviceErrorException } from './DeviceErrorException';
export { PrinterErrorException } from './PrinterErrorException';
export { PrintErrorException } from './PrintErrorException';

/**
 * Lỗi không phải exception của feature (vd lỗi lập trình, lỗi native không mang mã) được bọc thành `UNKNOWN_ERROR`
 * để job in và UI luôn nhận một exception có `code`.
 */
export const toPrinterFeatureException = (error: unknown): PrinterFeatureException => {
  if (error instanceof PrinterFeatureException) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new PrintErrorException({ code: PrintErrorCode.UNKNOWN_ERROR, message, cause: error });
};

/** Lỗi không phải exception của feature coi là `UNKNOWN_ERROR`. */
export const errorCodeOf = (error: unknown): ErrorCode =>
  error instanceof PrinterFeatureException ? error.code : PrintErrorCode.UNKNOWN_ERROR;
