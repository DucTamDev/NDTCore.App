import { createPrintService, PrintService } from '../PrintService';
import type { PrintTarget } from '../PrintRoutingService';
import { ConnectionType, PrinterDriverType, TsplRenderMode, type Printer, type PrinterDriver } from '../../types/printer.types';
import type { PrintJob } from '../../types/printJob.types';
import { AppErrorCode } from '../../types/AppError';
import { PrintType } from '../../types/printConfiguration.types';

const textDocument = { elements: [{ type: 'text' as const, content: 'text-doc', x: 0, y: 0 }] };
const imageDocument = { elements: [{ type: 'image' as const, data: 'base64...', x: 0, y: 0 }] };

const escposDriver: PrinterDriver = { type: PrinterDriverType.escpos, source: 'auto', contentTypes: [PrintType.Receipt], config: { type: PrinterDriverType.escpos } };
const tsplDriver: PrinterDriver = { type: PrinterDriverType.tspl, source: 'auto', contentTypes: [PrintType.Label], config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap } };

const makePrinter = (id: string, overrides: Partial<Printer> = {}): Printer => ({
  id, name: id, drivers: [escposDriver], connectionType: ConnectionType.lan, lan: { ip: '1.1.1.1', port: 9100 },
  identityKey: `lan:1.1.1.1:9100-${id}`, paperSize: 80, autoReconnect: false, enabled: true,
  createdAt: 'x', updatedAt: 'x', ...overrides,
});

const makeDeps = (targets: PrintTarget[], scheduleResult: (printerId: string) => PrintJob) => ({
  routing: { resolveTargets: jest.fn().mockReturnValue(targets) },
  scheduler: { enqueue: jest.fn().mockImplementation((job: PrintJob) => Promise.resolve(scheduleResult(job.printerId))) },
});

describe('PrintService.print', () => {
  it('returns no-available-printer with no jobs when routing finds nothing', async () => {
    const deps = makeDeps([], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print(PrintType.Receipt, { text: textDocument });
    expect(result.status).toBe('no-available-printer');
    expect(result.error?.code).toBe(AppErrorCode.NO_AVAILABLE_PRINTER);
    expect(deps.scheduler.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues one job per resolved target, carrying the full documentVariants through untouched', async () => {
    const p1 = makePrinter('p1');
    const deps = makeDeps(
      [{ printer: p1, driver: escposDriver }],
      (printerId) => ({ id: 'job1', requestId: 'req1', printerId, printType: PrintType.Receipt, documentVariants: { text: textDocument }, status: 'success', retryCount: 0, createdAt: 'now' }),
    );
    const service = createPrintService(deps);
    const documentVariants = { text: textDocument, image: imageDocument };
    await service.print(PrintType.Receipt, documentVariants);
    expect(deps.scheduler.enqueue).toHaveBeenCalledWith(expect.objectContaining({ printerId: 'p1', documentVariants }));
  });

  it('reports success when all jobs succeed', async () => {
    const deps = makeDeps(
      [{ printer: makePrinter('p1'), driver: escposDriver }, { printer: makePrinter('p2'), driver: escposDriver }],
      (printerId) => ({ id: 'job', requestId: 'req', printerId, printType: PrintType.Receipt, documentVariants: { text: textDocument }, status: 'success', retryCount: 0, createdAt: 'now' }),
    );
    const service = createPrintService(deps);
    expect((await service.print(PrintType.Receipt, { text: textDocument })).status).toBe('success');
  });

  it('reports partial-failure on mixed results', async () => {
    const deps = makeDeps(
      [{ printer: makePrinter('p1'), driver: escposDriver }, { printer: makePrinter('p2'), driver: escposDriver }],
      (printerId) => ({ id: 'job', requestId: 'req', printerId, printType: PrintType.Receipt, documentVariants: { text: textDocument }, status: printerId === 'p1' ? 'success' : 'failed', retryCount: 0, createdAt: 'now' }),
    );
    const service = createPrintService(deps);
    expect((await service.print(PrintType.Receipt, { text: textDocument })).status).toBe('partial-failure');
  });

  it('reports failed with no top-level error when every job fails', async () => {
    const deps = makeDeps(
      [{ printer: makePrinter('p1'), driver: escposDriver }],
      (printerId) => ({ id: 'job', requestId: 'req', printerId, printType: PrintType.Receipt, documentVariants: { text: textDocument }, status: 'failed', retryCount: 0, createdAt: 'now', error: { code: AppErrorCode.PRINT_ERROR, message: 'x' } }),
    );
    const service = createPrintService(deps);
    const result = await service.print(PrintType.Receipt, { text: textDocument });
    expect(result.status).toBe('failed');
    expect(result.error).toBeUndefined();
  });
});

describe('PrintService.imageDocumentPaperSize', () => {
  it('returns null when the only target uses escpos', () => {
    const deps = makeDeps([{ printer: makePrinter('p1', { paperSize: 58 }), driver: escposDriver }], () => { throw new Error('unused'); });
    expect(createPrintService(deps).imageDocumentPaperSize(PrintType.Receipt)).toBeNull();
  });

  it('returns the paperSize of the tspl target when it is in bitmap mode', () => {
    const deps = makeDeps([{ printer: makePrinter('p1', { paperSize: 58, drivers: [tsplDriver] }), driver: tsplDriver }], () => { throw new Error('unused'); });
    expect(createPrintService(deps).imageDocumentPaperSize(PrintType.Receipt)).toBe(58);
  });

  it('returns null when the only tspl target is fully switched to truetype (installed font) — encode() discards the image entirely', () => {
    const truetypeDriver: PrinterDriver = {
      type: PrinterDriverType.tspl,
      source: 'auto',
      contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, font: { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } },
    };
    const deps = makeDeps([{ printer: makePrinter('p1', { paperSize: 58, drivers: [truetypeDriver] }), driver: truetypeDriver }], () => { throw new Error('unused'); });
    expect(createPrintService(deps).imageDocumentPaperSize(PrintType.Receipt)).toBeNull();
  });

  it('returns the bitmap target paperSize when a mix of truetype+installed and bitmap tspl targets both resolve the same printType', () => {
    const truetypeDriver: PrinterDriver = {
      type: PrinterDriverType.tspl,
      source: 'auto',
      contentTypes: [PrintType.Receipt],
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, font: { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } },
    };
    const deps = makeDeps(
      [
        { printer: makePrinter('p1', { paperSize: 58, drivers: [truetypeDriver] }), driver: truetypeDriver },
        { printer: makePrinter('p2', { paperSize: 80, drivers: [tsplDriver] }), driver: tsplDriver },
      ],
      () => { throw new Error('unused'); },
    );
    expect(createPrintService(deps).imageDocumentPaperSize(PrintType.Receipt)).toBe(80);
  });

  it('the real exported PrintService singleton has no configured printers by default, so it returns null', () => {
    expect(PrintService.imageDocumentPaperSize(PrintType.Receipt)).toBeNull();
  });
});
