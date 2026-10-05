import { ConnectionType } from '../models/printer/ConnectionType';
import { LanguageSelection, PrintLanguage } from '../models/printer/PrinterLanguage';
import type { Printer } from '../models/printer/Printer';
import type { PrinterConnection } from '../models/printer/PrinterConnection';
import type { PrinterLanguage } from '../models/printer/PrinterLanguage';
import { CutterMode, PaperSize, PaperType } from '../models/paper/PaperOptions';
import type { PaperOptions } from '../models/paper/PaperOptions';
import { PrintKind } from '../models/printer/PrintKind';

export const DEFAULT_PAPER: PaperOptions = { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode: CutterMode.PerJob };

export const makeEscPosLanguage = (o: Partial<PrinterLanguage> = {}): PrinterLanguage => ({
  type: PrintLanguage.EscPos,
  selection: LanguageSelection.Auto,
  ...o,
});

export const makeTsplLanguage = (o: Partial<PrinterLanguage> = {}): PrinterLanguage => ({
  type: PrintLanguage.Tspl,
  selection: LanguageSelection.Auto,
  ...o,
});

const DEFAULT_CONNECTION: PrinterConnection = { type: ConnectionType.Lan, host: '192.168.1.10', port: 9100 };

export const makePrinter = (o: Partial<Printer> = {}): Printer => ({
  id: 'p1',
  deviceId: 'lan:192.168.1.10:9100',
  kind: PrintKind.Receipt,
  name: 'Máy in test',
  language: makeEscPosLanguage(),
  connection: DEFAULT_CONNECTION,
  paper: { ...DEFAULT_PAPER },
  capabilities: { cutter: false, cashDrawer: false, color: false, image: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...o,
});
