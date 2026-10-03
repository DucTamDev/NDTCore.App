import { createPrintService, PrintService } from '../PrintService';
import { RenderMode, RasterSource } from '../../models/printer/PrinterLanguage';
import { PaperSize, PaperType } from '../../models/paper/PaperOptions';
import { type Printer } from '../../models/printer/Printer';
import { PrintJobStatus, PrintResultStatus, type PrintJob } from '../../models/printing/PrintJob';
import { PrinterErrorCode } from '../../errors/PrinterError';
import { PrintKind } from '../../models/printer/PrintKind';
import { makePrinter, makeEscPosLanguage, makeTsplLanguage } from '../../testing/printerFixtures';

const textDocument = { elements: [{ type: 'text' as const, content: 'text-doc', x: 0, y: 0 }] };
const imageBase64 = 'base64...';

const makeDeps = (targets: Printer[], scheduleResult: (printerId: string) => PrintJob) => ({
  routing: { resolveTargets: jest.fn().mockReturnValue(targets) },
  scheduler: { enqueue: jest.fn().mockImplementation((job: PrintJob) => Promise.resolve(scheduleResult(job.printerId))) },
});

describe('PrintService.print', () => {
  it('returns no-available-printer with no jobs when routing finds nothing', async () => {
    const deps = makeDeps([], () => {
      throw new Error('should not be called');
    });
    const service = createPrintService(deps);
    const result = await service.print(PrintKind.Receipt, { text: textDocument });
    expect(result.status).toBe(PrintResultStatus.NoAvailablePrinter);
    expect(result.error?.code).toBe(PrinterErrorCode.NO_AVAILABLE_PRINTER);
    expect(deps.scheduler.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues one job per resolved target, carrying the full documents through untouched', async () => {
    const p1 = makePrinter({ id: 'p1' });
    const deps = makeDeps([p1], (printerId) => ({
      id: 'job1',
      requestId: 'req1',
      printerId,
      kind: PrintKind.Receipt,
      documents: { text: textDocument },
      status: PrintJobStatus.Success,
      retryCount: 0,
      createdAt: 'now',
    }));
    const service = createPrintService(deps);
    const documents = { text: textDocument, image: imageBase64 };
    await service.print(PrintKind.Receipt, documents);
    expect(deps.scheduler.enqueue).toHaveBeenCalledWith(expect.objectContaining({ printerId: 'p1', documents }));
  });

  it('reports success when all jobs succeed', async () => {
    const deps = makeDeps([makePrinter({ id: 'p1' }), makePrinter({ id: 'p2' })], (printerId) => ({
      id: 'job',
      requestId: 'req',
      printerId,
      kind: PrintKind.Receipt,
      documents: { text: textDocument },
      status: PrintJobStatus.Success,
      retryCount: 0,
      createdAt: 'now',
    }));
    const service = createPrintService(deps);
    expect((await service.print(PrintKind.Receipt, { text: textDocument })).status).toBe(PrintResultStatus.Success);
  });

  it('reports partial-failure on mixed results', async () => {
    const deps = makeDeps([makePrinter({ id: 'p1' }), makePrinter({ id: 'p2' })], (printerId) => ({
      id: 'job',
      requestId: 'req',
      printerId,
      kind: PrintKind.Receipt,
      documents: { text: textDocument },
      status: printerId === 'p1' ? PrintJobStatus.Success : PrintJobStatus.Failed,
      retryCount: 0,
      createdAt: 'now',
    }));
    const service = createPrintService(deps);
    expect((await service.print(PrintKind.Receipt, { text: textDocument })).status).toBe(PrintResultStatus.PartialFailure);
  });

  it('reports failed with no top-level error when every job fails', async () => {
    const deps = makeDeps([makePrinter({ id: 'p1' })], (printerId) => ({
      id: 'job',
      requestId: 'req',
      printerId,
      kind: PrintKind.Receipt,
      documents: { text: textDocument },
      status: PrintJobStatus.Failed,
      retryCount: 0,
      createdAt: 'now',
      error: { code: PrinterErrorCode.UNKNOWN_ERROR, message: 'x' },
    }));
    const service = createPrintService(deps);
    const result = await service.print(PrintKind.Receipt, { text: textDocument });
    expect(result.status).toBe(PrintResultStatus.Failed);
    expect(result.error).toBeUndefined();
  });
});

describe('PrintService.imageDocumentTarget', () => {
  it('returns null when the only target uses escpos in encoder mode', () => {
    const deps = makeDeps([makePrinter({ id: 'p1' })], () => {
      throw new Error('unused');
    });
    expect(createPrintService(deps).imageDocumentTarget(PrintKind.Receipt)).toBeNull();
  });

  it('returns the paper + Image rasterSource default when the target has no rasterSource set', () => {
    const p1 = makePrinter({
      id: 'p1',
      language: makeEscPosLanguage({ renderMode: RenderMode.Raster }),
      paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm58 },
    });
    const deps = makeDeps([p1], () => {
      throw new Error('unused');
    });
    expect(createPrintService(deps).imageDocumentTarget(PrintKind.Receipt)).toEqual({ paper: p1.paper, rasterSource: RasterSource.Image });
  });

  it('returns the target driver config rasterSource when explicitly set to Ast', () => {
    const p1 = makePrinter({
      id: 'p1',
      language: makeTsplLanguage({ renderMode: RenderMode.Raster, rasterSource: RasterSource.Ast }),
      paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm58 },
    });
    const deps = makeDeps([p1], () => {
      throw new Error('unused');
    });
    expect(createPrintService(deps).imageDocumentTarget(PrintKind.Receipt)).toEqual({ paper: p1.paper, rasterSource: RasterSource.Ast });
  });

  it('returns the bitmap target when a mix of encoder and bitmap targets both resolve the same kind', () => {
    const p1 = makePrinter({ id: 'p1', language: makeEscPosLanguage() });
    const p2 = makePrinter({ id: 'p2', language: makeTsplLanguage(), paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm80 } });
    const deps = makeDeps([p1, p2], () => {
      throw new Error('unused');
    });
    expect(createPrintService(deps).imageDocumentTarget(PrintKind.Receipt)).toEqual({ paper: p2.paper, rasterSource: RasterSource.Image });
  });

  it('the real exported PrintService singleton has no configured printers by default, so it returns null', () => {
    expect(PrintService.imageDocumentTarget(PrintKind.Receipt)).toBeNull();
  });
});
