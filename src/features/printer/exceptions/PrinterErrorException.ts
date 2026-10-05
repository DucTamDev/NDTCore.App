import type { PrinterErrorCode } from '../errors/PrinterErrorCode';
import { PrinterFeatureException, type ExceptionDetail } from './PrinterFeatureException';

/** Lỗi cấu hình hoặc tìm máy in. */
export class PrinterErrorException extends PrinterFeatureException<PrinterErrorCode> {
  constructor(detail: ExceptionDetail<PrinterErrorCode>) {
    super('PrinterErrorException', detail);
  }
}
