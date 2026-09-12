import { createPrintService, PrintService } from '../PrintService';
import { RenderMode, BitmapSource } from '../../models/printer/PrinterDriver';
import { PaperSize, PrintPaperType } from '../../models/paper/PrintPaperConfig';
import { type Printer } from '../../models/printer/Printer';
import { PrintJobStatus, PrintResultStatus, type PrintJob } from '../../models/printing/PrintJob';
import { PrinterErrorCode } from '../../errors/PrinterError';
import { PrintType } from '../../models/printing/PrintType';
import { makePrinter, makeEscPosDriver, makeTsplDriver } from '../../testing/printerFixtures';

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
    const result = await service.print(PrintType.Receipt, { text: textDocument });
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
      printType: PrintType.Receipt,
      documents: { text: textDocument },
      status: PrintJobStatus.Success,
      retryCount: 0,
      createdAt: 'now',
    }));
    const service = createPrintService(deps);
    const documents = { text: textDocument, image: imageBase64 };
    await service.print(PrintType.Receipt, documents);
    expect(deps.scheduler.enqueue).toHaveBeenCalledWith(expect.objectContaining({ printerId: 'p1', documents }));
  });

  it('reports success when all jobs succeed', async () => {
    const deps = makeDeps([makePrinter({ id: 'p1' }), makePrinter({ id: 'p2' })], (printerId) => ({
      id: 'job',
      requestId: 'req',
      printerId,
      printType: PrintType.Receipt,
      documents: { text: textDocument },
      status: PrintJobStatus.Success,
      retryCount: 0,
      createdAt: 'now',
    }));
    const service = createPrintService(deps);
    expect((await service.print(PrintType.Receipt, { text: textDocument })).status).toBe(PrintResultStatus.Success);
  });

  it('reports partial-failure on mixed results', async () => {
    const deps = makeDeps([makePrinter({ id: 'p1' }), makePrinter({ id: 'p2' })], (printerId) => ({
      id: 'job',
      requestId: 'req',
      printerId,
      printType: PrintType.Receipt,
      documents: { text: textDocument },
      status: printerId === 'p1' ? PrintJobStatus.Success : PrintJobStatus.Failed,
      retryCount: 0,
      createdAt: 'now',
    }));
    const service = createPrintService(deps);
    expect((await service.print(PrintType.Receipt, { text: textDocument })).status).toBe(PrintResultStatus.PartialFailure);
  });

  it('reports failed with no top-level error when every job fails', async () => {
    const deps = makeDeps([makePrinter({ id: 'p1' })], (printerId) => ({
      id: 'job',
      requestId: 'req',
      printerId,
      printType: PrintType.Receipt,
      documents: { text: textDocument },
      status: PrintJobStatus.Failed,
      retryCount: 0,
      createdAt: 'now',
      error: { code: PrinterErrorCode.UNKNOWN_ERROR, message: 'x' },
    }));
    const service = createPrintService(deps);
    const result = await service.print(PrintType.Receipt, { text: textDocument });
    expect(result.status).toBe(PrintResultStatus.Failed);
    expect(result.error).toBeUndefined();
  });
});

describe('PrintService.imageDocumentTarget', () => {
  it('returns null when the only target uses escpos in encoder mode', () => {
    const deps = makeDeps([makePrinter({ id: 'p1' })], () => {
      throw new Error('unused');
    });
    expect(createPrintService(deps).imageDocumentTarget(PrintType.Receipt)).toBeNull();
  });

  it('returns the paper + Image bitmapSource default when the target has no bitmapSource set', () => {
    const p1 = makePrinter({
      id: 'p1',
      driver: makeEscPosDriver({ config: { renderMode: RenderMode.Bitmap } }),
      paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm58 },
    });
    const deps = makeDeps([p1], () => {
      throw new Error('unused');
    });
    expect(createPrintService(deps).imageDocumentTarget(PrintType.Receipt)).toEqual({ paper: p1.paper, bitmapSource: BitmapSource.Image });
  });

  it('returns the target driver config bitmapSource when explicitly set to Ast', () => {
    const p1 = makePrinter({
      id: 'p1',
      driver: makeTsplDriver({ config: { renderMode: RenderMode.Bitmap, bitmapSource: BitmapSource.Ast } }),
      paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm58 },
    });
    const deps = makeDeps([p1], () => {
      throw new Error('unused');
    });
    expect(createPrintService(deps).imageDocumentTarget(PrintType.Receipt)).toEqual({ paper: p1.paper, bitmapSource: BitmapSource.Ast });
  });

  it('returns the bitmap target when a mix of encoder and bitmap targets both resolve the same printType', () => {
    const p1 = makePrinter({ id: 'p1', driver: makeEscPosDriver() });
    const p2 = makePrinter({ id: 'p2', driver: makeTsplDriver(), paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm80 } });
    const deps = makeDeps([p1, p2], () => {
      throw new Error('unused');
    });
    expect(createPrintService(deps).imageDocumentTarget(PrintType.Receipt)).toEqual({ paper: p2.paper, bitmapSource: BitmapSource.Image });
  });

  it('the real exported PrintService singleton has no configured printers by default, so it returns null', () => {
    expect(PrintService.imageDocumentTarget(PrintType.Receipt)).toBeNull();
  });
});
