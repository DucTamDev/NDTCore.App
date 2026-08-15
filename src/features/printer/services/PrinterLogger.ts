import { LoggerService } from '../../../services/LoggerService';
import type { AppErrorCode } from '../../../types/AppError';
import type { ConnectionType, Protocol } from '../types/printer.types';

/**
 * Điểm log chuẩn hoá duy nhất cho printer module — mỗi hàm ứng với đúng 1
 * event name cố định và chỉ nhận field an toàn để log (printerId nội bộ,
 * protocol, connectionType, errorCode, durationMs). Không có tham số nào cho
 * phép truyền MAC/IP/rawDevice/nội dung hoá đơn, để log không bao giờ chứa
 * dữ liệu nhạy cảm dù được ghi ra console hay (sau này) gửi lên server.
 */
export const PrinterLogger = {
  scanCompleted(params: { connectionType: ConnectionType; deviceCount: number; durationMs: number }): void {
    LoggerService.info('printer.scan.completed', params);
  },

  scanFailed(params: { connectionType: ConnectionType; errorCode: AppErrorCode; durationMs: number }): void {
    LoggerService.warning('printer.scan.failed', params);
  },

  connectSucceeded(params: {
    printerId: string;
    protocol: Protocol;
    connectionType: ConnectionType;
    durationMs: number;
  }): void {
    LoggerService.info('printer.connect.succeeded', params);
  },

  connectFailed(params: {
    printerId: string;
    protocol: Protocol;
    connectionType: ConnectionType;
    errorCode: AppErrorCode;
    durationMs: number;
  }): void {
    LoggerService.warning('printer.connect.failed', params);
  },

  disconnectSucceeded(params: { printerId: string; protocol: Protocol }): void {
    LoggerService.info('printer.disconnect.succeeded', params);
  },

  testPrintSucceeded(params: { printerId: string; protocol: Protocol; durationMs: number }): void {
    LoggerService.info('printer.test-print.succeeded', params);
  },

  testPrintFailed(params: {
    printerId: string;
    protocol: Protocol;
    errorCode: AppErrorCode;
    durationMs: number;
  }): void {
    LoggerService.error('printer.test-print.failed', params);
  },

  permissionDenied(params: { connectionType: ConnectionType }): void {
    LoggerService.warning('printer.permission.denied', params);
  },

  protocolDetected(params: { printerId: string; protocol: Protocol; connectionType: ConnectionType }): void {
    LoggerService.info('printer.protocol.detected', params);
  },

  protocolUnknown(params: { printerId: string; connectionType: ConnectionType }): void {
    LoggerService.warning('printer.protocol.unknown', params);
  },

  printSucceeded(params: { printerId: string; protocol: Protocol; durationMs: number }): void {
    LoggerService.info('printer.print.succeeded', params);
  },

  printFailed(params: { printerId: string; protocol: Protocol; errorCode: AppErrorCode; durationMs: number }): void {
    LoggerService.error('printer.print.failed', params);
  },
};
