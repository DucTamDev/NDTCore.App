import type { IPrinterDriver } from '../../types/driver.types';
import { ConnectionType, DriverSource, PrinterDriverType, PrinterStatus, TsplRenderMode, type Printer, type PrinterDriver } from '../../types/printer.types';
import { PrintType } from '../../types/printConfiguration.types';

/**
 * Fixture dùng chung cho 4 file test service (Repository/Connection/Config/
 * DeviceScan) — không phải test suite (Jest bỏ qua qua `testPathIgnorePatterns`).
 *
 * Shared fixtures for the 4 service test files — not a test suite (Jest skips
 * it via `testPathIgnorePatterns`).
 */
export const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue(PrinterStatus.connected),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  print: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  ...overrides,
});

export const escposDriverEntry: PrinterDriver = { type: PrinterDriverType.escpos, source: DriverSource.auto, contentTypes: [PrintType.Receipt], config: { type: PrinterDriverType.escpos, media: { type: 'continuous', paperSize: 80 } } };
export const tsplDriverEntry: PrinterDriver = { type: PrinterDriverType.tspl, source: DriverSource.auto, contentTypes: [PrintType.Label], config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { type: 'continuous', paperSize: 80 } } };

export const basePrinter: Printer = {
  id: 'p1',
  name: 'Máy in hóa đơn quầy 1',
  drivers: [escposDriverEntry],
  connectionType: ConnectionType.lan,
  lan: { ip: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
