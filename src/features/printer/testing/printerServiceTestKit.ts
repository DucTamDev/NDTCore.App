import type { IPrinterDriver } from '../drivers/IPrinterDriver';
import { ConnectionType } from '../models/printer/ConnectionType';
import { LanguageSelection, PrintLanguage, RasterSource, RenderMode, type PrinterLanguage } from '../models/printer/PrinterLanguage';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { PaperSize, PaperType } from '../models/paper/PaperOptions';
import { type Printer } from '../models/printer/Printer';
import { PrintKind } from '../models/printer/PrintKind';

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

export const escposLanguage: PrinterLanguage = {
  type: PrintLanguage.EscPos,
  selection: LanguageSelection.Auto,
  renderMode: RenderMode.Command,
  rasterSource: RasterSource.Image,
};

export const tsplLanguage: PrinterLanguage = {
  type: PrintLanguage.Tspl,
  selection: LanguageSelection.Auto,
  renderMode: RenderMode.Raster,
  rasterSource: RasterSource.Image,
};

export const basePrinter: Printer = {
  id: 'p1',
  deviceId: 'lan:192.168.1.10:9100',
  kind: PrintKind.Receipt,
  name: 'Máy in hóa đơn quầy 1',
  language: escposLanguage,
  connection: { type: ConnectionType.Lan, host: '192.168.1.10', port: 9100 },
  paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm80 },
  capabilities: { cutter: false, cashDrawer: false, color: false, image: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
