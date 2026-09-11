import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { DriverSource, PrinterDriverType, RenderMode } from '../models/printer/PrinterDriver';
import type { Printer } from '../models/printer/Printer';
import type { PrinterConnection } from '../models/printer/PrinterConnection';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import { PaperSize, PrintPaperType } from '../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { PrintType } from '../models/printing/PrintType';

export const DEFAULT_PAPER: PrintPaperConfig = { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm80 };

export const makeEscPosDriver = (o: Partial<PrinterDriver> = {}): PrinterDriver => ({
  type: PrinterDriverType.EscPos,
  source: DriverSource.Auto,
  config: { renderMode: RenderMode.Encoder },
  ...o,
});

export const makeTsplDriver = (o: Partial<PrinterDriver> = {}): PrinterDriver => ({
  type: PrinterDriverType.Tspl,
  source: DriverSource.Auto,
  config: { renderMode: RenderMode.Bitmap },
  ...o,
});

const DEFAULT_CONNECTION: PrinterConnection = { type: PrinterConnectionType.Lan, host: '192.168.1.10', port: 9100 };

export const makePrinter = (o: Partial<Printer> = {}): Printer => ({
  id: 'p1',
  identityKey: 'lan:192.168.1.10:9100',
  type: PrintType.Receipt,
  name: 'Máy in test',
  driver: makeEscPosDriver(),
  connection: DEFAULT_CONNECTION,
  paper: { ...DEFAULT_PAPER },
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...o,
});
