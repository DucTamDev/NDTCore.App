import { LoggerService } from '../../../../services/LoggerService';
import { PrinterLogger } from '../PrinterLogger';
import { PrinterErrorCode } from '../../types/PrinterError';
import { ConnectionType, PrinterDriverType } from '../../types/printer.types';

jest.mock('../../../../services/LoggerService', () => ({
  LoggerService: {
    debug: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PrinterLogger', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('scanCompleted logs an info event with connectionType/deviceCount/durationMs + operation/result', () => {
    PrinterLogger.scanCompleted({ connectionType: ConnectionType.bluetooth, deviceCount: 3, durationMs: 120 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.scan.completed', {
      connectionType: ConnectionType.bluetooth,
      deviceCount: 3,
      durationMs: 120,
      operation: 'scan',
      result: 'success',
    });
  });

  it('scanFailed logs a warning event with connectionType/errorCode/durationMs + operation/result', () => {
    PrinterLogger.scanFailed({ connectionType: ConnectionType.usb, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: 50 });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.scan.failed', {
      connectionType: ConnectionType.usb,
      errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED,
      durationMs: 50,
      operation: 'scan',
      result: 'failure',
    });
  });

  it('connectSucceeded logs an info event with operation=connect, result=success, and no resourceKey/ip', () => {
    PrinterLogger.connectSucceeded({ printerId: 'p1', protocol: PrinterDriverType.escpos, connectionType: ConnectionType.lan, durationMs: 200 });
    expect(LoggerService.info).toHaveBeenCalledWith(
      'printer.connect.succeeded',
      expect.objectContaining({ operation: 'connect', result: 'success' }),
    );
    const payload = (LoggerService.info as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('resourceKey');
    expect(payload).not.toHaveProperty('ip');
    expect(payload).not.toHaveProperty('mac');
    expect(payload).toEqual({
      printerId: 'p1',
      protocol: PrinterDriverType.escpos,
      connectionType: ConnectionType.lan,
      durationMs: 200,
      operation: 'connect',
      result: 'success',
    });
  });

  it('connectFailed logs a warning event with operation=connect, result=failure', () => {
    PrinterLogger.connectFailed({
      printerId: 'p1',
      protocol: PrinterDriverType.tspl,
      connectionType: ConnectionType.bluetooth,
      errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED,
      durationMs: 300,
    });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.connect.failed', {
      printerId: 'p1',
      protocol: PrinterDriverType.tspl,
      connectionType: ConnectionType.bluetooth,
      errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED,
      durationMs: 300,
      operation: 'connect',
      result: 'failure',
    });
  });

  it('disconnectSucceeded logs an info event with operation=disconnect, result=success', () => {
    PrinterLogger.disconnectSucceeded({ printerId: 'p1', protocol: PrinterDriverType.escpos });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.disconnect.succeeded', {
      printerId: 'p1',
      protocol: PrinterDriverType.escpos,
      operation: 'disconnect',
      result: 'success',
    });
  });

  it('disconnectFailed logs a warning event with operation=disconnect, result=failure', () => {
    PrinterLogger.disconnectFailed({ printerId: 'p1', protocol: PrinterDriverType.tspl, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.disconnect.failed', {
      printerId: 'p1',
      protocol: PrinterDriverType.tspl,
      errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED,
      operation: 'disconnect',
      result: 'failure',
    });
  });

  it('testPrintSucceeded logs an info event with operation=test-print, result=success', () => {
    PrinterLogger.testPrintSucceeded({ printerId: 'p1', protocol: PrinterDriverType.escpos, durationMs: 400 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.test-print.succeeded', {
      printerId: 'p1',
      protocol: PrinterDriverType.escpos,
      durationMs: 400,
      operation: 'test-print',
      result: 'success',
    });
  });

  it('testPrintFailed logs an error event with operation=test-print, result=failure', () => {
    PrinterLogger.testPrintFailed({ printerId: 'p1', protocol: PrinterDriverType.escpos, errorCode: PrinterErrorCode.UNKNOWN_ERROR, durationMs: 500 });
    expect(LoggerService.error).toHaveBeenCalledWith('printer.test-print.failed', {
      printerId: 'p1',
      protocol: PrinterDriverType.escpos,
      errorCode: PrinterErrorCode.UNKNOWN_ERROR,
      durationMs: 500,
      operation: 'test-print',
      result: 'failure',
    });
  });

  it('permissionDenied logs a warning event mapped to operation=scan, result=failure', () => {
    PrinterLogger.permissionDenied({ connectionType: ConnectionType.bluetooth });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.permission.denied', {
      connectionType: ConnectionType.bluetooth,
      operation: 'scan',
      result: 'failure',
    });
  });

  it('discoveryStarted logs a debug event with operation=discovery and NO result field', () => {
    PrinterLogger.discoveryStarted({ printerId: 'p1', connectionType: ConnectionType.lan, candidates: [PrinterDriverType.tspl, PrinterDriverType.escpos] });
    expect(LoggerService.debug).toHaveBeenCalledWith('printer.discovery.started', {
      printerId: 'p1',
      connectionType: ConnectionType.lan,
      candidates: [PrinterDriverType.tspl, PrinterDriverType.escpos],
      operation: 'discovery',
    });
    const payload = (LoggerService.debug as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('result');
  });

  it('discoveryCandidateRejected logs a debug event with operation=discovery, result=failure', () => {
    PrinterLogger.discoveryCandidateRejected({
      printerId: 'p1',
      protocol: PrinterDriverType.tspl,
      connectionType: ConnectionType.usb,
      reason: 'not_confirmed',
    });
    expect(LoggerService.debug).toHaveBeenCalledWith('printer.discovery.candidate-rejected', {
      printerId: 'p1',
      protocol: PrinterDriverType.tspl,
      connectionType: ConnectionType.usb,
      reason: 'not_confirmed',
      operation: 'discovery',
      result: 'failure',
    });
  });

  it('discoveryFailed logs a warning event with operation=discovery, result=failure', () => {
    PrinterLogger.discoveryFailed({
      printerId: 'p1',
      connectionType: ConnectionType.lan,
      candidatesTried: [PrinterDriverType.tspl, PrinterDriverType.escpos],
      durationMs: 600,
    });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.discovery.failed', {
      printerId: 'p1',
      connectionType: ConnectionType.lan,
      candidatesTried: [PrinterDriverType.tspl, PrinterDriverType.escpos],
      durationMs: 600,
      operation: 'discovery',
      result: 'failure',
    });
  });

  it('protocolDetected logs an info event with operation=discovery, result=success', () => {
    PrinterLogger.protocolDetected({
      printerId: 'p1',
      protocol: PrinterDriverType.escpos,
      connectionType: ConnectionType.lan,
      candidatesTried: [PrinterDriverType.tspl, PrinterDriverType.escpos],
      durationMs: 700,
    });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.protocol.detected', {
      printerId: 'p1',
      protocol: PrinterDriverType.escpos,
      connectionType: ConnectionType.lan,
      candidatesTried: [PrinterDriverType.tspl, PrinterDriverType.escpos],
      durationMs: 700,
      operation: 'discovery',
      result: 'success',
    });
  });

  it('protocolUnknown logs a warning event with operation=discovery, result=failure', () => {
    PrinterLogger.protocolUnknown({
      printerId: 'p1',
      connectionType: ConnectionType.usb,
      candidatesTried: [PrinterDriverType.tspl, PrinterDriverType.escpos],
      durationMs: 800,
    });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.protocol.unknown', {
      printerId: 'p1',
      connectionType: ConnectionType.usb,
      candidatesTried: [PrinterDriverType.tspl, PrinterDriverType.escpos],
      durationMs: 800,
      operation: 'discovery',
      result: 'failure',
    });
  });

  it('printSucceeded logs an info event with operation=print, result=success', () => {
    PrinterLogger.printSucceeded({ printerId: 'p1', protocol: PrinterDriverType.escpos, durationMs: 250 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.print.succeeded', {
      printerId: 'p1',
      protocol: PrinterDriverType.escpos,
      durationMs: 250,
      operation: 'print',
      result: 'success',
    });
  });

  it('printFailed logs an error event with operation=print, result=failure', () => {
    PrinterLogger.printFailed({ printerId: 'p1', protocol: PrinterDriverType.escpos, errorCode: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED, durationMs: 80 });
    expect(LoggerService.error).toHaveBeenCalledWith('printer.print.failed', {
      printerId: 'p1',
      protocol: PrinterDriverType.escpos,
      errorCode: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED,
      durationMs: 80,
      operation: 'print',
      result: 'failure',
    });
  });

  it('fontInstallSucceeded / fontInstallFailed exist', () => {
    expect(typeof PrinterLogger.fontInstallSucceeded).toBe('function');
    expect(typeof PrinterLogger.fontInstallFailed).toBe('function');
  });

  it('fontInstallSucceeded logs an info event with operation=font-install, result=success', () => {
    PrinterLogger.fontInstallSucceeded({ printerId: 'p1', connectionType: ConnectionType.lan, durationMs: 4200 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.font-install.succeeded', {
      printerId: 'p1',
      connectionType: ConnectionType.lan,
      durationMs: 4200,
      operation: 'font-install',
      result: 'success',
    });
    const payload = (LoggerService.info as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('resourceKey');
    expect(payload).not.toHaveProperty('ip');
  });

  it('fontInstallSucceeded omits connectionType for a draft printer (no Printer object)', () => {
    PrinterLogger.fontInstallSucceeded({ printerId: 'draft', durationMs: 10 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.font-install.succeeded', {
      printerId: 'draft',
      durationMs: 10,
      operation: 'font-install',
      result: 'success',
    });
  });

  it('fontInstallFailed logs a warning event with operation=font-install, result=failure', () => {
    PrinterLogger.fontInstallFailed({ printerId: 'p1', connectionType: ConnectionType.bluetooth, errorCode: PrinterErrorCode.PRINTER_NOT_CONNECTED, durationMs: 900 });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.font-install.failed', {
      printerId: 'p1',
      connectionType: ConnectionType.bluetooth,
      errorCode: PrinterErrorCode.PRINTER_NOT_CONNECTED,
      durationMs: 900,
      operation: 'font-install',
      result: 'failure',
    });
  });
});
