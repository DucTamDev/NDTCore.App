import type { DeviceErrorCode } from '../errors/DeviceErrorCode';
import { PrinterFeatureException, type ExceptionDetail } from './PrinterFeatureException';

/** Lỗi tầng thiết bị (kết nối, đọc ghi), mã khớp 1:1 với native. */
export class DeviceErrorException extends PrinterFeatureException<DeviceErrorCode> {
  constructor(detail: ExceptionDetail<DeviceErrorCode>) {
    super('DeviceErrorException', detail);
  }
}
