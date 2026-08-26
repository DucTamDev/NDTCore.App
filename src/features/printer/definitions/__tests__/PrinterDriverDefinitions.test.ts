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
});
