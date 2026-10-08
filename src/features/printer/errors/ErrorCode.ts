import type { DeviceErrorCode } from './DeviceErrorCode';
import type { PrintErrorCode } from './PrintErrorCode';
import type { PrinterErrorCode } from './PrinterErrorCode';

/** Mọi mã lỗi của feature máy in: thiết bị, cấu hình máy in, hoặc một lệnh in. */
export type ErrorCode = DeviceErrorCode | PrinterErrorCode | PrintErrorCode;
