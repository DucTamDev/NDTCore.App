import { DRIVER_CAPABILITIES, getDriverCapabilities } from '../DriverCapabilities';
import { PrinterDriverType, TsplRenderMode } from '../../models/printer/PrinterDriver';
import { PrintType } from '../../models/printing/PrintType';

describe('PrinterDriverDefinitions', () => {
  it('escpos only supports Receipt', () => {
    expect(DRIVER_CAPABILITIES.escpos.contentTypes).toEqual([PrintType.Receipt]);
  });

  it('tspl supports both Receipt and Label', () => {
    expect(DRIVER_CAPABILITIES.tspl.contentTypes).toEqual([PrintType.Receipt, PrintType.Label]);
  });

  it('getDriverCapabilities returns the definition for a given type', () => {
    expect(getDriverCapabilities(PrinterDriverType.tspl)).toBe(DRIVER_CAPABILITIES.tspl);
  });

  it('escpos default config is { type: escpos, media: continuous 80 }', () => {
    expect(DRIVER_CAPABILITIES.escpos.defaultConfig).toEqual({ type: PrinterDriverType.escpos, media: { type: 'continuous', paperSize: 80 } });
  });

  it('tspl default config is { type: tspl, renderMode: bitmap, media: continuous 80 }', () => {
    expect(DRIVER_CAPABILITIES.tspl.defaultConfig).toEqual({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { type: 'continuous', paperSize: 80 } });
  });
});
