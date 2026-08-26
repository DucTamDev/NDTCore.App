import { LoggerService } from '../../../services/LoggerService';
import type { AppErrorCode } from '../types/AppError';
import type { ConnectionType, PrinterDriverType } from '../types/printer.types';

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
    protocol: PrinterDriverType;
    connectionType: ConnectionType;
    durationMs: number;
  }): void {
    LoggerService.info('printer.connect.succeeded', params);
  },

  connectFailed(params: {
    printerId: string;
    protocol: PrinterDriverType;
    connectionType: ConnectionType;
    errorCode: AppErrorCode;
    durationMs: number;
  }): void {
    LoggerService.warning('printer.connect.failed', params);
  },

  disconnectSucceeded(params: { printerId: string; protocol: PrinterDriverType }): void {
    LoggerService.info('printer.disconnect.succeeded', params);
  },

  disconnectFailed(params: { printerId: string; protocol: PrinterDriverType; errorCode: AppErrorCode }): void {
    LoggerService.warning('printer.disconnect.failed', params);
  },

  testPrintSucceeded(params: { printerId: string; protocol: PrinterDriverType; durationMs: number }): void {
    LoggerService.info('printer.test-print.succeeded', params);
  },

  testPrintFailed(params: {
    printerId: string;
    protocol: PrinterDriverType;
    errorCode: AppErrorCode;
    durationMs: number;
  }): void {
    LoggerService.error('printer.test-print.failed', params);
  },

  permissionDenied(params: { connectionType: ConnectionType }): void {
    LoggerService.warning('printer.permission.denied', params);
  },

  /** Bắt đầu 1 phiên `discoverProtocol()` — trace danh sách candidate sẽ thử, theo đúng thứ tự ưu tiên. */
  discoveryStarted(params: { printerId: string; connectionType: ConnectionType; candidates: PrinterDriverType[] }): void {
    LoggerService.debug('printer.discovery.started', params);
  },

  /**
   * 1 candidate bị loại trong lúc dò — bình thường trong quá trình thử, không
   * phải sự cố (sự cố thật chỉ tính khi TOÀN BỘ candidate đều loại, xem
   * `discoveryFailed`/`protocolUnknown`) — log ở mức `debug` để không nhiễu
   * ngoài lúc dev.
   */
  discoveryCandidateRejected(params: {
    printerId: string;
    protocol: PrinterDriverType;
    connectionType: ConnectionType;
    reason: 'connect_failed' | 'not_confirmed';
  }): void {
    LoggerService.debug('printer.discovery.candidate-rejected', params);
  },

  /** Toàn bộ candidate đều KHÔNG connect được — khác `protocolUnknown` (connect được nhưng không xác nhận được protocol). */
  discoveryFailed(params: {
    printerId: string;
    connectionType: ConnectionType;
    candidatesTried: PrinterDriverType[];
    durationMs: number;
  }): void {
    LoggerService.warning('printer.discovery.failed', params);
  },

  protocolDetected(params: {
    printerId: string;
    protocol: PrinterDriverType;
    connectionType: ConnectionType;
    candidatesTried: PrinterDriverType[];
    durationMs: number;
  }): void {
    LoggerService.info('printer.protocol.detected', params);
  },

  protocolUnknown(params: {
    printerId: string;
    connectionType: ConnectionType;
    candidatesTried: PrinterDriverType[];
    durationMs: number;
  }): void {
    LoggerService.warning('printer.protocol.unknown', params);
  },

  printSucceeded(params: { printerId: string; protocol: PrinterDriverType; durationMs: number }): void {
    LoggerService.info('printer.print.succeeded', params);
  },

  printFailed(params: { printerId: string; protocol: PrinterDriverType; errorCode: AppErrorCode; durationMs: number }): void {
    LoggerService.error('printer.print.failed', params);
  },
};
