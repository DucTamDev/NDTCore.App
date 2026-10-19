import { DeviceErrorCode, type ErrorCode } from '../../errors';

/** Cách hàng đợi in xử lý một lệnh lỗi. */
export const PrintFailureKind = {
  /** Mở kết nối thất bại: có thể tự hết sau vài giây nên được thử lại. */
  ConnectFailed: 'ConnectFailed',

  /** Máy đang không dùng được: lệnh sau của máy cũng sẽ lỗi nên bỏ cả hàng của máy. */
  DeviceUnavailable: 'DeviceUnavailable',

  /** Lỗi gắn với riêng lệnh này: chỉ bỏ lệnh đó. */
  TaskFailed: 'TaskFailed',
} as const;

export type PrintFailureKind = (typeof PrintFailureKind)[keyof typeof PrintFailureKind];

const DEVICE_UNAVAILABLE_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  DeviceErrorCode.CONNECTION_LOST,
  DeviceErrorCode.NOT_CONNECTED,
  DeviceErrorCode.DEVICE_NOT_FOUND,
  DeviceErrorCode.BLUETOOTH_DISABLED,
  DeviceErrorCode.SERVICE_CLOSED,
  DeviceErrorCode.PERMISSION_DENIED,
]);

export const printFailureKindOf = (code: ErrorCode): PrintFailureKind => {
  if (code === DeviceErrorCode.CONNECTION_FAILED) {
    return PrintFailureKind.ConnectFailed;
  }

  return DEVICE_UNAVAILABLE_CODES.has(code) ? PrintFailureKind.DeviceUnavailable : PrintFailureKind.TaskFailed;
};
