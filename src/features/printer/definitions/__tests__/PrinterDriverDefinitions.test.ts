import { PRINTER_DRIVER_DEFINITIONS, getDriverDefinition } from '../PrinterDriverDefinitions';
import { PrinterDriverType, TsplRenderMode } from '../../types/printer.types';
import { PrintType } from '../../types/printConfiguration.types';

describe('PrinterDriverDefinitions', () => {
  it('escpos only supports Receipt', () => {
    expect(PRINTER_DRIVER_DEFINITIONS.escpos.contentTypes).toEqual([PrintType.Receipt]);
  });

  it('tspl supports both Receipt and Label', () => {
    expect(PRINTER_DRIVER_DEFINITIONS.tspl.contentTypes).toEqual([PrintType.Receipt, PrintType.Label]);
  });

  it('getDriverDefinition returns the definition for a given type', () => {
    expect(getDriverDefinition(PrinterDriverType.tspl)).toBe(PRINTER_DRIVER_DEFINITIONS.tspl);
  });

  it('escpos default config is { type: escpos }', () => {
    expect(PRINTER_DRIVER_DEFINITIONS.escpos.defaultConfig).toEqual({ type: PrinterDriverType.escpos });
  });

  it('tspl default config is { type: tspl, renderMode: bitmap }', () => {
    expect(PRINTER_DRIVER_DEFINITIONS.tspl.defaultConfig).toEqual({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap });
  });
});
