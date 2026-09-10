import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { DriverSource, PrinterDriverType, PrintRenderMode } from '../models/printer/PrinterDriver';
import type { Printer } from '../models/printer/Printer';
import type { PrinterConnection } from '../models/printer/PrinterConnection';
import type { PrinterDriver, TsplRenderMode } from '../models/printer/PrinterDriver';
import { PrintPaperType } from '../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { PrintType } from '../models/printing/PrintType';

export const DEFAULT_MEDIA: PrintPaperConfig = { type: PrintPaperType.Continuous, paperSize: 80 };

/** Override phần metadata của 1 `PrinterDriver` — `config` được factory tự dựng (dùng `media`/`renderMode`), không nhận qua đây. */
type DriverEntryOverride = Partial<Omit<PrinterDriver, 'config'>> & { media?: Partial<PrintPaperConfig> };

export const makeEscPosDriverEntry = (o: DriverEntryOverride = {}): PrinterDriver => {
  const { media, ...rest } = o;
  return {
    type: PrinterDriverType.escpos,
    source: DriverSource.auto,
    contentTypes: [PrintType.Receipt],
    ...rest,
    config: { type: PrinterDriverType.escpos, media: { ...DEFAULT_MEDIA, ...media } },
  };
};

export const makeTsplDriverEntry = (o: DriverEntryOverride & { renderMode?: TsplRenderMode } = {}): PrinterDriver => {
  const { media, renderMode, ...rest } = o;
  return {
    type: PrinterDriverType.tspl,
    source: DriverSource.auto,
    contentTypes: [PrintType.Label],
    ...rest,
    config: {
      type: PrinterDriverType.tspl,
      renderMode: renderMode ?? PrintRenderMode.bitmap,
      media: { ...DEFAULT_MEDIA, ...media },
    },
  };
};

const DEFAULT_CONNECTION: PrinterConnection = { type: PrinterConnectionType.Lan, host: '192.168.1.10', port: 9100 };

export const makePrinter = (o: Partial<Printer> = {}): Printer => ({
  id: 'p1',
  name: 'Máy in test',
  drivers: o.drivers ?? [makeEscPosDriverEntry()],
  connection: o.connection ?? DEFAULT_CONNECTION,
  identityKey: 'lan:192.168.1.10:9100',
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...o,
});
