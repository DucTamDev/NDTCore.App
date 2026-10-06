import { LoggerService } from '../../../../services/LoggerService';
import { printerLogger } from '../PrinterLogger';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { PrintLanguage } from '../../models/printer/PrinterLanguage';
import { DeviceErrorCode, PrintErrorCode } from '../../errors';

jest.mock('../../../../services/LoggerService', () => ({
  LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() },
}));

type Level = 'debug' | 'info' | 'warning' | 'error';

/** Một dòng: hàm log, tham số, mức log, tên sự kiện, operation và result mong đợi. */
interface LogCase {
  log: (logger: typeof printerLogger) => void;
  params: Record<string, unknown>;
  level: Level;
  event: string;
  operation: string;
  result?: 'success' | 'failure';
}

const bluetooth = ConnectionType.Bluetooth;

const lan = ConnectionType.Lan;

const failed = DeviceErrorCode.CONNECTION_FAILED;

/** Dựng một dòng bảng từ hàm log và tham số của nó, để tham số chỉ viết một lần. */
const logCase = <T extends Record<string, unknown>>(
  call: (logger: typeof printerLogger, params: T) => void,
  params: T,
  expected: Omit<LogCase, 'log' | 'params'>,
): [string, LogCase] => [expected.event, { log: (logger) => call(logger, params), params, ...expected }];

const CASES: [string, LogCase][] = [
  logCase(
    (l, p) => l.discoveryStarted(p),
    { connectionType: bluetooth },
    { level: 'debug', event: 'printer.discovery.started', operation: 'discovery' },
  ),
  logCase(
    (l, p) => l.discoveryCompleted(p),
    { connectionType: bluetooth, deviceCount: 2, durationMs: 150 },
    { level: 'info', event: 'printer.discovery.completed', operation: 'discovery', result: 'success' },
  ),
  logCase(
    (l, p) => l.discoveryFailed(p),
    { connectionType: bluetooth, errorCode: failed, durationMs: 90 },
    { level: 'warning', event: 'printer.discovery.failed', operation: 'discovery', result: 'failure' },
  ),
  logCase(
    (l, p) => l.permissionDenied(p),
    { connectionType: bluetooth },
    { level: 'warning', event: 'printer.permission.denied', operation: 'discovery', result: 'failure' },
  ),
  logCase(
    (l, p) => l.connectSucceeded(p),
    { printerId: 'p1', connectionType: lan, durationMs: 200 },
    { level: 'info', event: 'printer.connect.succeeded', operation: 'connect', result: 'success' },
  ),
  logCase(
    (l, p) => l.connectFailed(p),
    { printerId: 'p1', connectionType: bluetooth, errorCode: failed, durationMs: 300 },
    { level: 'warning', event: 'printer.connect.failed', operation: 'connect', result: 'failure' },
  ),
  logCase(
    (l, p) => l.disconnectSucceeded(p),
    { printerId: 'p1' },
    { level: 'info', event: 'printer.disconnect.succeeded', operation: 'disconnect', result: 'success' },
  ),
  logCase(
    (l, p) => l.disconnectFailed(p),
    { printerId: 'p1', errorCode: failed },
    { level: 'warning', event: 'printer.disconnect.failed', operation: 'disconnect', result: 'failure' },
  ),
  logCase(
    (l, p) => l.printerDetected(p),
    { connectionType: lan, language: PrintLanguage.Tspl },
    { level: 'info', event: 'printer.detection.detected', operation: 'detection', result: 'success' },
  ),
  logCase(
    (l, p) => l.printerNotDetected(p),
    { connectionType: lan },
    { level: 'info', event: 'printer.detection.not-detected', operation: 'detection', result: 'failure' },
  ),
  logCase(
    (l, p) => l.testPrintSucceeded(p),
    { printerId: 'p1', language: PrintLanguage.EscPos, durationMs: 400 },
    { level: 'info', event: 'printer.test-print.succeeded', operation: 'test-print', result: 'success' },
  ),
  logCase(
    (l, p) => l.testPrintFailed(p),
    { printerId: 'p1', language: PrintLanguage.EscPos, errorCode: PrintErrorCode.UNKNOWN_ERROR, durationMs: 500 },
    { level: 'error', event: 'printer.test-print.failed', operation: 'test-print', result: 'failure' },
  ),
  logCase(
    (l, p) => l.printSucceeded(p),
    { printerId: 'p1', language: PrintLanguage.Tspl, durationMs: 250 },
    { level: 'info', event: 'printer.print.succeeded', operation: 'print', result: 'success' },
  ),
  logCase(
    (l, p) => l.printFailed(p),
    {
      printerId: 'p1',
      language: PrintLanguage.EscPos,
      errorCode: PrintErrorCode.INVALID_IMAGE,
      durationMs: 80,
    },
    { level: 'error', event: 'printer.print.failed', operation: 'print', result: 'failure' },
  ),
];

describe('PrinterLogger', () => {
  afterEach(() => jest.clearAllMocks());

  it.each(CASES)('%s ghi đúng mức log, tham số và field chuẩn', (_event, testCase) => {
    testCase.log(printerLogger);

    const result = testCase.result ? { result: testCase.result } : {};
    const expected = { ...testCase.params, operation: testCase.operation, ...result };
    expect(LoggerService[testCase.level]).toHaveBeenCalledWith(testCase.event, expected);
  });

  it('log kết nối không mang khoá in, IP hay MAC', () => {
    printerLogger.connectSucceeded({ printerId: 'p1', connectionType: lan, durationMs: 200 });

    const payload = (LoggerService.info as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('lockKey');
    expect(payload).not.toHaveProperty('ip');
    expect(payload).not.toHaveProperty('mac');
  });
});
