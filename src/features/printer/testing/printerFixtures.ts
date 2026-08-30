import { ConnectionType, DriverSource, PrinterDriverType, PrintMediaType, TsplRenderMode } from '../types/printer.types';
import type { PrintMedia, Printer, PrinterDriver } from '../types/printer.types';
import { PrintType } from '../types/printConfiguration.types';

export const DEFAULT_MEDIA: PrintMedia = { type: PrintMediaType.continuous, paperSize: 80 };

export const makeEscPosDriverEntry = (o: Partial<PrinterDriver> & { media?: Partial<PrintMedia> } = {}): PrinterDriver => {
  const { media, config, ...rest } = o;
  return {
    type: PrinterDriverType.escpos,
    source: DriverSource.auto,
    contentTypes: [PrintType.Receipt],
    ...rest,
    config: { type: PrinterDriverType.escpos, media: { ...DEFAULT_MEDIA, ...media }, ...(config as object) },
  };
};

export const makeTsplDriverEntry = (
  o: Partial<PrinterDriver> & { media?: Partial<PrintMedia>; renderMode?: TsplRenderMode } = {},
): PrinterDriver => {
  const { media, renderMode, config, ...rest } = o;
  return {
    type: PrinterDriverType.tspl,
    source: DriverSource.auto,
    contentTypes: [PrintType.Label],
    ...rest,
    config: {
      type: PrinterDriverType.tspl,
      renderMode: renderMode ?? TsplRenderMode.bitmap,
      media: { ...DEFAULT_MEDIA, ...media },
      ...(config as object),
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
