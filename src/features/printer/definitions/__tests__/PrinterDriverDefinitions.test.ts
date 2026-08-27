import { PRINTER_DRIVER_DEFINITIONS, getDriverDefinition } from '../PrinterDriverDefinitions';

describe('PrinterDriverDefinitions', () => {
  it('escpos only supports Receipt', () => {
    expect(PRINTER_DRIVER_DEFINITIONS.escpos.contentTypes).toEqual(['Receipt']);
  });

  it('tspl supports both Receipt and Label', () => {
    expect(PRINTER_DRIVER_DEFINITIONS.tspl.contentTypes).toEqual(['Receipt', 'Label']);
  });

  it('getDriverDefinition returns the definition for a given type', () => {
    expect(getDriverDefinition('tspl')).toBe(PRINTER_DRIVER_DEFINITIONS.tspl);
  });

  it('escpos default config is { type: escpos }', () => {
    expect(PRINTER_DRIVER_DEFINITIONS.escpos.defaultConfig).toEqual({ type: 'escpos' });
  });

  it('tspl default config is { type: tspl, renderMode: bitmap }', () => {
    expect(PRINTER_DRIVER_DEFINITIONS.tspl.defaultConfig).toEqual({ type: 'tspl', renderMode: 'bitmap' });
  });
});
