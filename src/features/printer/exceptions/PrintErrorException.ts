import type { PrintErrorCode } from '../errors/PrintErrorCode';
import { PrinterFeatureException, type ExceptionDetail } from './PrinterFeatureException';

/** Lỗi của một lệnh in (ảnh, encode, không có máy nhận). */
export class PrintErrorException extends PrinterFeatureException<PrintErrorCode> {
  constructor(detail: ExceptionDetail<PrintErrorCode>) {
    super('PrintErrorException', detail);
  }
}
