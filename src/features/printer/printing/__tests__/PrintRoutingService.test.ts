import { createPrintRoutingService } from '../PrintRoutingService';
import type { Printer } from '../../models/printer/Printer';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { PrintKind } from '../../models/printer/PrintKind';
import { makePrinter as makePrinterFixture, makeEscPosLanguage, makeTsplLanguage } from '../../testing/printerFixtures';

const makePrinter = (id: string, overrides: Partial<Printer> = {}): Printer =>
  makePrinterFixture({
    id,
    name: id,
    kind: PrintKind.Receipt,
    language: makeEscPosLanguage(),
    connection: { type: ConnectionType.Lan, host: '1.1.1.1', port: 9100 },
    deviceId: `lan:1.1.1.1:9100-${id}`,
    createdAt: 'x',
    updatedAt: 'x',
    ...overrides,
  });

describe('PrintRoutingService.resolveTargets', () => {
  it('returns the enabled printer whose type matches the given kind', () => {
    const p1 = makePrinter('p1');
    const service = createPrintRoutingService({ getPrinters: () => [p1] });
    expect(service.resolveTargets(PrintKind.Receipt)).toEqual([p1]);
  });

  it('excludes disabled printers', () => {
    const service = createPrintRoutingService({ getPrinters: () => [makePrinter('p1', { enabled: false })] });
    expect(service.resolveTargets(PrintKind.Receipt)).toEqual([]);
  });

  it('excludes a printer whose fixed type does not match', () => {
    const service = createPrintRoutingService({ getPrinters: () => [makePrinter('p1')] });
    expect(service.resolveTargets(PrintKind.Label)).toEqual([]);
  });

  it('matches a label printer only for PrintKind.Label, not PrintKind.Receipt', () => {
    const p1 = makePrinter('p1', { kind: PrintKind.Label, language: makeTsplLanguage() });
    const service = createPrintRoutingService({ getPrinters: () => [p1] });
    expect(service.resolveTargets(PrintKind.Label)).toEqual([p1]);
    expect(service.resolveTargets(PrintKind.Receipt)).toEqual([]);
  });

  it('returns multiple targets across multiple printers', () => {
    const service = createPrintRoutingService({ getPrinters: () => [makePrinter('p1'), makePrinter('p2')] });
    expect(service.resolveTargets(PrintKind.Receipt)).toHaveLength(2);
  });
});
