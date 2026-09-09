import { LoggerService } from '../../../services/LoggerService';
import type { PrinterErrorCode } from '../errors/PrinterError';
import type { ConnectionType } from '../models/printer/PrinterDevice';
import type { PrinterDriverType } from '../models/printer/PrinterDriver';

/**
 * Điểm log chuẩn hoá duy nhất cho printer module — mỗi hàm ứng với đúng 1
 * event name cố định và chỉ nhận field an toàn để log (printerId nội bộ,
 * protocol, connectionType, errorCode, durationMs). Không có tham số nào cho
 * phép truyền MAC/IP/rawDevice/nội dung hoá đơn, để log không bao giờ chứa
 * dữ liệu nhạy cảm dù được ghi ra console hay (sau này) gửi lên server.
 *
 * `resourceKey` KHÔNG được log ở đây: với TSPL LAN nó là `tspl:lan:<ip>:<port>`
 * — nhúng IP LAN, vi phạm §106. `connectionType` + `protocol` đã đủ để debug
 * concurrency mà không lộ IP (spec §12.6).
 *
 * Mọi payload đều kèm field chuẩn (§9.2 / §105):
 * - `operation`: thao tác nghiệp vụ nào (`scan`, `connect`, ... `font-install`).
 * - `result`: `success` / `failure` — OPTIONAL. Event mốc-bắt-đầu lifecycle
 *   (`discoveryStarted`) KHÔNG phát `result`: `operation: 'discovery'` + tên
 *   event `.started` đã mang phase, chưa có kết quả để phân loại.
 */
type PrinterLogOperation =
  | 'scan'
  | 'connect'
  | 'disconnect'
  | 'discovery'
  | 'test-print'
  | 'print'
  | 'font-install';

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

export const PrinterLogger = {
  scanCompleted(params: { connectionType: ConnectionType; deviceCount: number; durationMs: number }): void {
    LoggerService.info('printer.scan.completed', withStdFields('scan', 'success', params));
  },

  scanFailed(params: { connectionType: ConnectionType; errorCode: PrinterErrorCode; durationMs: number }): void {
    LoggerService.warning('printer.scan.failed', withStdFields('scan', 'failure', params));
  },

  connectSucceeded(params: {
    printerId: string;
    protocol: PrinterDriverType;
    connectionType: ConnectionType;
    durationMs: number;
  }): void {
    LoggerService.info('printer.connect.succeeded', withStdFields('connect', 'success', params));
  },

  connectFailed(params: {
    printerId: string;
    protocol: PrinterDriverType;
    connectionType: ConnectionType;
    errorCode: PrinterErrorCode;
    durationMs: number;
  }): void {
    LoggerService.warning('printer.connect.failed', withStdFields('connect', 'failure', params));
  },

  disconnectSucceeded(params: { printerId: string; protocol: PrinterDriverType }): void {
    LoggerService.info('printer.disconnect.succeeded', withStdFields('disconnect', 'success', params));
  },

  disconnectFailed(params: { printerId: string; protocol: PrinterDriverType; errorCode: PrinterErrorCode }): void {
    LoggerService.warning('printer.disconnect.failed', withStdFields('disconnect', 'failure', params));
  },

  testPrintSucceeded(params: { printerId: string; protocol: PrinterDriverType; durationMs: number }): void {
    LoggerService.info('printer.test-print.succeeded', withStdFields('test-print', 'success', params));
  },

  testPrintFailed(params: {
    printerId: string;
    protocol: PrinterDriverType;
    errorCode: PrinterErrorCode;
    durationMs: number;
  }): void {
    LoggerService.error('printer.test-print.failed', withStdFields('test-print', 'failure', params));
  },

  /** Permission là cửa chặn của scan (Bluetooth/USB) — coi như `scan` fail. */
  permissionDenied(params: { connectionType: ConnectionType }): void {
    LoggerService.warning('printer.permission.denied', withStdFields('scan', 'failure', params));
  },

  discoveryStarted(params: { printerId: string; connectionType: ConnectionType; candidates: PrinterDriverType[] }): void {
    LoggerService.debug('printer.discovery.started', withStdFields('discovery', undefined, params));
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
    LoggerService.debug('printer.discovery.candidate-rejected', withStdFields('discovery', 'failure', params));
  },

  /** Toàn bộ candidate đều KHÔNG connect được — khác `protocolUnknown` (connect được nhưng không xác nhận được protocol). */
  discoveryFailed(params: {
    printerId: string;
    connectionType: ConnectionType;
    candidatesTried: PrinterDriverType[];
    durationMs: number;
  }): void {
    LoggerService.warning('printer.discovery.failed', withStdFields('discovery', 'failure', params));
  },

  protocolDetected(params: {
    printerId: string;
    protocol: PrinterDriverType;
    connectionType: ConnectionType;
    candidatesTried: PrinterDriverType[];
    durationMs: number;
  }): void {
    LoggerService.info('printer.protocol.detected', withStdFields('discovery', 'success', params));
  },

  protocolUnknown(params: {
    printerId: string;
    connectionType: ConnectionType;
    candidatesTried: PrinterDriverType[];
    durationMs: number;
  }): void {
    LoggerService.warning('printer.protocol.unknown', withStdFields('discovery', 'failure', params));
  },

  printSucceeded(params: { printerId: string; protocol: PrinterDriverType; durationMs: number }): void {
    LoggerService.info('printer.print.succeeded', withStdFields('print', 'success', params));
  },

  printFailed(params: { printerId: string; protocol: PrinterDriverType; errorCode: PrinterErrorCode; durationMs: number }): void {
    LoggerService.error('printer.print.failed', withStdFields('print', 'failure', params));
  },

  /**
   * Font-install = op DOWNLOAD tường minh (§126). `connectionType` optional vì
   * `AddPrinterModal` gọi trên draft chưa lưu — lúc đó chưa có `Printer` object
   * để lấy connectionType (xem `PrinterConfigService.installTsplFont`).
   */
  fontInstallSucceeded(params: { printerId: string; connectionType?: ConnectionType; durationMs: number }): void {
    LoggerService.info('printer.font-install.succeeded', withStdFields('font-install', 'success', params));
  },

  fontInstallFailed(params: {
    printerId: string;
    connectionType?: ConnectionType;
    errorCode: PrinterErrorCode;
    durationMs: number;
  }): void {
    LoggerService.warning('printer.font-install.failed', withStdFields('font-install', 'failure', params));
  },
};
