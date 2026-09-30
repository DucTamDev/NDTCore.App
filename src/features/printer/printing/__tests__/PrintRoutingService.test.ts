import { createPrintRoutingService } from '../PrintRoutingService';
import type { Printer } from '../../models/printer/Printer';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { PrintType } from '../../models/printing/PrintType';
import { makePrinter as makePrinterFixture, makeEscPosDriver, makeTsplDriver } from '../../testing/printerFixtures';

const makePrinter = (id: string, overrides: Partial<Printer> = {}): Printer =>
  makePrinterFixture({
    id,
    name: id,
    type: PrintType.Receipt,
    driver: makeEscPosDriver(),
    connection: { type: PrinterConnectionType.Lan, host: '1.1.1.1', port: 9100 },
    identityKey: `lan:1.1.1.1:9100-${id}`,
    createdAt: 'x',
    updatedAt: 'x',
    ...overrides,
  });

describe('PrintRoutingService.resolveTargets', () => {
  it('returns the enabled printer whose type matches the given printType', () => {
    const p1 = makePrinter('p1');
    const service = createPrintRoutingService({ getPrinters: () => [p1] });
    expect(service.resolveTargets(PrintType.Receipt)).toEqual([p1]);
  });

  it('excludes disabled printers', () => {
    const service = createPrintRoutingService({ getPrinters: () => [makePrinter('p1', { enabled: false })] });
    expect(service.resolveTargets(PrintType.Receipt)).toEqual([]);
  });

  it('excludes a printer whose fixed type does not match', () => {
    const service = createPrintRoutingService({ getPrinters: () => [makePrinter('p1')] });
    expect(service.resolveTargets(PrintType.Label)).toEqual([]);
  });

  it('matches a label printer only for PrintType.Label, not PrintType.Receipt', () => {
    const p1 = makePrinter('p1', { type: PrintType.Label, driver: makeTsplDriver() });
    const service = createPrintRoutingService({ getPrinters: () => [p1] });
    expect(service.resolveTargets(PrintType.Label)).toEqual([p1]);
    expect(service.resolveTargets(PrintType.Receipt)).toEqual([]);
  });

  it('returns multiple targets across multiple printers', () => {
    const service = createPrintRoutingService({ getPrinters: () => [makePrinter('p1'), makePrinter('p2')] });
    expect(service.resolveTargets(PrintType.Receipt)).toHaveLength(2);
  });
});
