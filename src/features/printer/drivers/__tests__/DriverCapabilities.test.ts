import { DRIVER_CAPABILITIES, getDriverCapabilities } from '../DriverCapabilities';
import { RenderMode, PrintLanguage } from '../../models/printer/PrinterLanguage';
import { PrintKind } from '../../models/printer/PrintKind';

describe('DriverCapabilities', () => {
  it('EscPos only supports Receipt', () => {
    expect(DRIVER_CAPABILITIES[PrintLanguage.EscPos].contentTypes).toEqual([PrintKind.Receipt]);
  });

  it('Tspl supports both Receipt and Label', () => {
    expect(DRIVER_CAPABILITIES[PrintLanguage.Tspl].contentTypes).toEqual([PrintKind.Receipt, PrintKind.Label]);
  });

  it('getDriverCapabilities returns the definition for a given type', () => {
    expect(getDriverCapabilities(PrintLanguage.Tspl)).toBe(DRIVER_CAPABILITIES[PrintLanguage.Tspl]);
  });

  it('EscPos default config is { renderMode: Encoder }', () => {
    expect(DRIVER_CAPABILITIES[PrintLanguage.EscPos].defaultConfig).toEqual({ renderMode: RenderMode.Command });
  });

  it('Tspl default config is { renderMode: Bitmap }', () => {
    expect(DRIVER_CAPABILITIES[PrintLanguage.Tspl].defaultConfig).toEqual({ renderMode: RenderMode.Raster });
  });
});
