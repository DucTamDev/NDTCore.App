import type { IPrinterDriver } from '../drivers/IPrinterDriver';
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { DriverSource, PrinterDriverType, RenderMode, type PrinterDriver } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { PaperSize, PrintPaperType } from '../models/paper/PrintPaperConfig';
import { type Printer } from '../models/printer/Printer';
import { PrintType } from '../models/printing/PrintType';

/**
 * Fixture dùng chung cho các file test service — nằm ngoài `__tests__/` và
 * không có đuôi `.test.` nên Jest bỏ qua.
 */
export const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue(PrinterStatus.Connected),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  print: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  ...overrides,
});

export const escposDriverEntry: PrinterDriver = { type: PrinterDriverType.EscPos, source: DriverSource.Auto, config: { renderMode: RenderMode.Encoder } };
export const tsplDriverEntry: PrinterDriver = { type: PrinterDriverType.Tspl, source: DriverSource.Auto, config: { renderMode: RenderMode.Bitmap } };

export const basePrinter: Printer = {
  id: 'p1',
  identityKey: 'lan:192.168.1.10:9100',
  type: PrintType.Receipt,
  name: 'Máy in hóa đơn quầy 1',
  driver: escposDriverEntry,
  connection: { type: PrinterConnectionType.Lan, host: '192.168.1.10', port: 9100 },
  paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm80 },
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
