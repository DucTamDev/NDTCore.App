import { LoggerService } from '../../../services/LoggerService';
import type { ErrorCode } from '../errors';
import type { ConnectionType } from '../models/connections/ConnectionType';
import type { PrintLanguage } from '../models/printer/PrinterLanguage';

/**
 * Điểm log chuẩn hoá duy nhất cho printer module — mỗi hàm ứng với đúng 1
 * event name cố định và chỉ nhận field an toàn để log (printerId nội bộ,
 * ngôn ngữ in, connectionType, errorCode, durationMs). Không có tham số nào cho
 * phép truyền MAC/IP/thông tin thiết bị/nội dung hoá đơn, để log không bao giờ
 * chứa dữ liệu nhạy cảm dù được ghi ra console hay (sau này) gửi lên server.
 *
 * Khoá in KHÔNG được log: key là `deviceId`, nhúng IP/MAC của máy in.
 *
 * Mọi payload đều kèm field chuẩn:
 * - `operation`: thao tác nghiệp vụ nào (`discovery`, `connect`, ... `print`).
 * - `result`: `success` / `failure` — OPTIONAL. Event mốc bắt đầu (`*.started`)
 *   KHÔNG phát `result` vì chưa có kết quả để phân loại.
 */
type PrinterLogOperation = 'discovery' | 'connect' | 'disconnect' | 'detection' | 'test-print' | 'print';

type PrinterLogResult = 'success' | 'failure';

const withStdFields = <T extends Record<string, unknown>>(
  operation: PrinterLogOperation,
  result: PrinterLogResult | undefined,
  params: T,
): T & { operation: PrinterLogOperation; result?: PrinterLogResult } => ({
  ...params,
  operation,
  ...(result ? { result } : {}),
});

/** Ghi log nghiệp vụ máy in với tên sự kiện cố định và field chuẩn. */
export class PrinterLogger {
  discoveryStarted(params: { connectionType: ConnectionType }): void {
    LoggerService.debug('printer.discovery.started', withStdFields('discovery', undefined, params));
  }

  discoveryCompleted(params: { connectionType: ConnectionType; deviceCount: number; durationMs: number }): void {
    LoggerService.info('printer.discovery.completed', withStdFields('discovery', 'success', params));
  }

  discoveryFailed(params: { connectionType: ConnectionType; errorCode: ErrorCode; durationMs: number }): void {
    LoggerService.warning('printer.discovery.failed', withStdFields('discovery', 'failure', params));
  }

  /** Quyền là cửa chặn của việc tìm thiết bị Bluetooth nên tính như tìm thiết bị thất bại. */
  permissionDenied(params: { connectionType: ConnectionType }): void {
    LoggerService.warning('printer.permission.denied', withStdFields('discovery', 'failure', params));
  }

  connectSucceeded(params: { printerId: string; connectionType: ConnectionType; durationMs: number }): void {
    LoggerService.info('printer.connect.succeeded', withStdFields('connect', 'success', params));
  }

  connectFailed(params: {
    printerId: string;
    connectionType: ConnectionType;
    errorCode: ErrorCode;
    durationMs: number;
  }): void {
    LoggerService.warning('printer.connect.failed', withStdFields('connect', 'failure', params));
  }

  disconnectSucceeded(params: { printerId: string }): void {
    LoggerService.info('printer.disconnect.succeeded', withStdFields('disconnect', 'success', params));
  }

  disconnectFailed(params: { printerId: string; errorCode: ErrorCode }): void {
    LoggerService.warning('printer.disconnect.failed', withStdFields('disconnect', 'failure', params));
  }

  /** Tra được model trong bảng máy in. */
  printerDetected(params: { connectionType: ConnectionType; language: PrintLanguage }): void {
    LoggerService.info('printer.detection.detected', withStdFields('detection', 'success', params));
  }

  /** Thiết bị không có trong bảng máy in; người dùng tự chọn ngôn ngữ. */
  printerNotDetected(params: { connectionType: ConnectionType }): void {
    LoggerService.info('printer.detection.not-detected', withStdFields('detection', 'failure', params));
  }

  testPrintSucceeded(params: { printerId: string; language: PrintLanguage; durationMs: number }): void {
    LoggerService.info('printer.test-print.succeeded', withStdFields('test-print', 'success', params));
  }

  testPrintFailed(params: {
    printerId: string;
    language: PrintLanguage;
    errorCode: ErrorCode;
    durationMs: number;
  }): void {
    LoggerService.error('printer.test-print.failed', withStdFields('test-print', 'failure', params));
  }

  printSucceeded(params: { printerId: string; language: PrintLanguage; durationMs: number }): void {
    LoggerService.info('printer.print.succeeded', withStdFields('print', 'success', params));
  }

  printFailed(params: {
    printerId: string;
    language: PrintLanguage;
    errorCode: ErrorCode;
    durationMs: number;
  }): void {
    LoggerService.error('printer.print.failed', withStdFields('print', 'failure', params));
  }

  /** `attempt` là lần thử lại thứ mấy (từ 1), `delayMs` là thời gian chờ trước lần đó. */
  printRetryScheduled(params: { printerId: string; attempt: number; delayMs: number; errorCode: ErrorCode }): void {
    LoggerService.warning('printer.print.retry_scheduled', withStdFields('print', 'failure', params));
  }
}

export const printerLogger = new PrinterLogger();
