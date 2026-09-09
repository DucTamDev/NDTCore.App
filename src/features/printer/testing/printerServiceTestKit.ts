import type { IPrinterDriver } from '../drivers/IPrinterDriver';
import { ConnectionType } from '../models/printer/PrinterDevice';
import { DriverSource, PrinterDriverType, PrintRenderMode, type PrinterDriver } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { type Printer } from '../models/printer/Printer';
import { PrintType } from '../models/printing/PrintType';

/**
 * Fixture dùng chung cho 4 file test service (Repository/Connection/Config/
 * DeviceScan) — nằm ngoài `__tests__/` và không có đuôi `.test.` nên Jest bỏ qua.
 *
 * Shared fixtures for the 4 service test files — outside `__tests__/` with no
 * `.test.` suffix, so Jest does not pick it up.
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
export const tsplDriverEntry: PrinterDriver = { type: PrinterDriverType.tspl, source: DriverSource.auto, contentTypes: [PrintType.Label], config: { type: PrinterDriverType.tspl, renderMode: PrintRenderMode.bitmap, media: { type: 'continuous', paperSize: 80 } } };

export const basePrinter: Printer = {
  id: 'p1',
  name: 'Máy in hóa đơn quầy 1',
  drivers: [escposDriverEntry],
  connection: { type: ConnectionType.lan, host: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
