import { DRIVER_CAPABILITIES, getDriverCapabilities } from '../DriverCapabilities';
import { RenderMode, PrinterDriverType } from '../../models/printer/PrinterDriver';
import { PrintType } from '../../models/printing/PrintType';

describe('DriverCapabilities', () => {
  it('EscPos only supports Receipt', () => {
    expect(DRIVER_CAPABILITIES[PrinterDriverType.EscPos].contentTypes).toEqual([PrintType.Receipt]);
  });

  it('Tspl supports both Receipt and Label', () => {
    expect(DRIVER_CAPABILITIES[PrinterDriverType.Tspl].contentTypes).toEqual([PrintType.Receipt, PrintType.Label]);
  });

  it('getDriverCapabilities returns the definition for a given type', () => {
    expect(getDriverCapabilities(PrinterDriverType.Tspl)).toBe(DRIVER_CAPABILITIES[PrinterDriverType.Tspl]);
  });

  it('EscPos default config is { renderMode: Encoder }', () => {
    expect(DRIVER_CAPABILITIES[PrinterDriverType.EscPos].defaultConfig).toEqual({ renderMode: RenderMode.Encoder });
  });

  it('Tspl default config is { renderMode: Bitmap }', () => {
    expect(DRIVER_CAPABILITIES[PrinterDriverType.Tspl].defaultConfig).toEqual({ renderMode: RenderMode.Bitmap });
  });
});
