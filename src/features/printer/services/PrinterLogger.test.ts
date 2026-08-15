import { LoggerService } from '../../../services/LoggerService';
import { PrinterLogger } from './PrinterLogger';

jest.mock('../../../services/LoggerService', () => ({
  LoggerService: {
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PrinterLogger', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('scanCompleted logs an info event with connectionType/deviceCount/durationMs', () => {
    PrinterLogger.scanCompleted({ connectionType: 'bluetooth', deviceCount: 3, durationMs: 120 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.scan.completed', {
      connectionType: 'bluetooth',
      deviceCount: 3,
      durationMs: 120,
    });
  });

  it('scanFailed logs a warning event with connectionType/errorCode/durationMs', () => {
    PrinterLogger.scanFailed({ connectionType: 'usb', errorCode: 'CONNECTION_ERROR', durationMs: 50 });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.scan.failed', {
      connectionType: 'usb',
      errorCode: 'CONNECTION_ERROR',
      durationMs: 50,
    });
  });

  it('connectSucceeded logs an info event with printerId/protocol/connectionType/durationMs', () => {
    PrinterLogger.connectSucceeded({ printerId: 'p1', protocol: 'escpos', connectionType: 'lan', durationMs: 200 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.connect.succeeded', {
      printerId: 'p1',
      protocol: 'escpos',
      connectionType: 'lan',
      durationMs: 200,
    });
  });

  it('connectFailed logs a warning event with printerId/protocol/connectionType/errorCode/durationMs', () => {
    PrinterLogger.connectFailed({
      printerId: 'p1',
      protocol: 'tspl',
      connectionType: 'bluetooth',
      errorCode: 'CONNECTION_ERROR',
      durationMs: 300,
    });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.connect.failed', {
      printerId: 'p1',
      protocol: 'tspl',
      connectionType: 'bluetooth',
      errorCode: 'CONNECTION_ERROR',
      durationMs: 300,
    });
  });

  it('disconnectSucceeded logs an info event with printerId/protocol', () => {
    PrinterLogger.disconnectSucceeded({ printerId: 'p1', protocol: 'escpos' });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.disconnect.succeeded', {
      printerId: 'p1',
      protocol: 'escpos',
    });
  });

  it('testPrintSucceeded logs an info event with printerId/protocol/durationMs', () => {
    PrinterLogger.testPrintSucceeded({ printerId: 'p1', protocol: 'escpos', durationMs: 400 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.test-print.succeeded', {
      printerId: 'p1',
      protocol: 'escpos',
      durationMs: 400,
    });
  });

  it('testPrintFailed logs an error event with printerId/protocol/errorCode/durationMs', () => {
    PrinterLogger.testPrintFailed({ printerId: 'p1', protocol: 'escpos', errorCode: 'PRINT_ERROR', durationMs: 500 });
    expect(LoggerService.error).toHaveBeenCalledWith('printer.test-print.failed', {
      printerId: 'p1',
      protocol: 'escpos',
      errorCode: 'PRINT_ERROR',
      durationMs: 500,
    });
  });

  it('permissionDenied logs a warning event with connectionType', () => {
    PrinterLogger.permissionDenied({ connectionType: 'bluetooth' });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.permission.denied', { connectionType: 'bluetooth' });
  });

  it('protocolDetected logs an info event with printerId/protocol/connectionType', () => {
    PrinterLogger.protocolDetected({ printerId: 'p1', protocol: 'escpos', connectionType: 'lan' });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.protocol.detected', {
      printerId: 'p1',
      protocol: 'escpos',
      connectionType: 'lan',
    });
  });

  it('protocolUnknown logs a warning event with printerId/connectionType', () => {
    PrinterLogger.protocolUnknown({ printerId: 'p1', connectionType: 'usb' });
    expect(LoggerService.warning).toHaveBeenCalledWith('printer.protocol.unknown', {
      printerId: 'p1',
      connectionType: 'usb',
    });
  });

  it('printSucceeded logs an info event with printerId/protocol/durationMs', () => {
    PrinterLogger.printSucceeded({ printerId: 'p1', protocol: 'escpos', durationMs: 250 });
    expect(LoggerService.info).toHaveBeenCalledWith('printer.print.succeeded', {
      printerId: 'p1',
      protocol: 'escpos',
      durationMs: 250,
    });
  });

  it('printFailed logs an error event with printerId/protocol/errorCode/durationMs', () => {
    PrinterLogger.printFailed({ printerId: 'p1', protocol: 'escpos', errorCode: 'ENCODING_FAILED', durationMs: 80 });
    expect(LoggerService.error).toHaveBeenCalledWith('printer.print.failed', {
      printerId: 'p1',
      protocol: 'escpos',
      errorCode: 'ENCODING_FAILED',
      durationMs: 80,
    });
  });
});
