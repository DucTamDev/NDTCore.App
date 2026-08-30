import { ConnectionType, DriverSource, PrinterDriverType, PrintMediaType, TsplRenderMode } from '../types/printer.types';
import type { PrintMedia, Printer, PrinterDriver } from '../types/printer.types';
import { PrintType } from '../types/printConfiguration.types';

export const DEFAULT_MEDIA: PrintMedia = { type: PrintMediaType.continuous, paperSize: 80 };

/** Override phần metadata của 1 `PrinterDriver` — `config` được factory tự dựng (dùng `media`/`renderMode`), không nhận qua đây. */
type DriverEntryOverride = Partial<Omit<PrinterDriver, 'config'>> & { media?: Partial<PrintMedia> };

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
      renderMode: renderMode ?? TsplRenderMode.bitmap,
      media: { ...DEFAULT_MEDIA, ...media },
    },
  };
};

export const makePrinter = (o: Partial<Printer> = {}): Printer => ({
  id: 'p1',
  name: 'Máy in test',
  drivers: o.drivers ?? [makeEscPosDriverEntry()],
  connectionType: ConnectionType.lan,
  lan: { ip: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...o,
});
