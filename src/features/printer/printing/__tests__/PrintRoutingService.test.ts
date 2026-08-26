import { createPrintRoutingService } from '../PrintRoutingService';
import type { Printer, PrinterDriver } from '../../types/printer.types';

const escposDriver: PrinterDriver = { type: 'escpos', source: 'auto', contentTypes: ['Receipt'], config: { type: 'escpos' } };
const tsplDriver: PrinterDriver = { type: 'tspl', source: 'auto', contentTypes: ['Label'], config: { type: 'tspl', renderMode: 'bitmap' } };

const makePrinter = (id: string, overrides: Partial<Printer> = {}): Printer => ({
  id,
  name: id,
  drivers: [escposDriver],
  connectionType: 'lan',
  lan: { ip: '1.1.1.1', port: 9100 },
  identityKey: `lan:1.1.1.1:9100-${id}`,
  paperSize: 80,
  autoReconnect: false,
  enabled: true,
  createdAt: 'x',
  updatedAt: 'x',
  ...overrides,
});

describe('PrintRoutingService.resolveTargets', () => {
  it('returns the printer + driver whose contentTypes include the given printType', () => {
    const p1 = makePrinter('p1');
    const service = createPrintRoutingService({ getPrinters: () => [p1] });
    expect(service.resolveTargets('Receipt')).toEqual([{ printer: p1, driver: escposDriver }]);
  });

  it('excludes disabled printers', () => {
    const service = createPrintRoutingService({ getPrinters: () => [makePrinter('p1', { enabled: false })] });
    expect(service.resolveTargets('Receipt')).toEqual([]);
  });

  it('excludes a printer whose driver does not claim this printType', () => {
    const service = createPrintRoutingService({ getPrinters: () => [makePrinter('p1')] });
    expect(service.resolveTargets('Label')).toEqual([]);
  });

  it('picks the correct driver among two on the same printer', () => {
    const p1 = makePrinter('p1', { drivers: [escposDriver, tsplDriver] });
    const service = createPrintRoutingService({ getPrinters: () => [p1] });
    expect(service.resolveTargets('Label')).toEqual([{ printer: p1, driver: tsplDriver }]);
  });

  it('returns multiple targets across multiple printers', () => {
    const service = createPrintRoutingService({ getPrinters: () => [makePrinter('p1'), makePrinter('p2')] });
    expect(service.resolveTargets('Receipt')).toHaveLength(2);
  });
});
