import { PrintService, printService } from '../PrintService';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperSize } from '../../models/paper/PaperSize';
import { PaperType } from '../../models/paper/PaperType';
import { type Printer } from '../../models/printer/Printer';
import { PrintJobStatus, PrintResultStatus, type PrintJob } from '../../models/printing/PrintJob';
import { PrintKind } from '../../models/printer/PrintKind';
import { makePrinter, makeEscPosLanguage, makeTsplLanguage } from '../../testing/printerFixtures';
import { PrintErrorCode } from '../../errors';
import { PrintErrorException } from '../../exceptions';

const image = 'base64-png';

const makeDeps = (targets: Printer[], scheduleResult: (printerId: string) => PrintJob) => ({
  routing: { resolveTargets: jest.fn().mockReturnValue(targets) },
  scheduler: { enqueue: jest.fn().mockImplementation((job: PrintJob) => Promise.resolve(scheduleResult(job.printerId))) },
});

describe('PrintService.print', () => {
  it('returns no-available-printer with no jobs when routing finds nothing', async () => {
    const deps = makeDeps([], () => {
      throw new Error('should not be called');
    });
    const service = new PrintService(deps);
    const result = await service.print(PrintKind.Receipt, image);
    expect(result.status).toBe(PrintResultStatus.NoAvailablePrinter);
    expect(result.error?.code).toBe(PrintErrorCode.NO_AVAILABLE_PRINTER);
    expect(deps.scheduler.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues one job per resolved target, carrying the image through untouched', async () => {
    const p1 = makePrinter({ id: 'p1' });
    const deps = makeDeps([p1], (printerId) => ({
      id: 'job1',
      requestId: 'req1',
      printerId,
      kind: PrintKind.Receipt,
      image,
      status: PrintJobStatus.Success,
      retryCount: 0,
      createdAt: 'now',
    }));
    const service = new PrintService(deps);
    await service.print(PrintKind.Receipt, image);
    expect(deps.scheduler.enqueue).toHaveBeenCalledWith(expect.objectContaining({ printerId: 'p1', image }));
  });

  it('reports success when all jobs succeed', async () => {
    const deps = makeDeps([makePrinter({ id: 'p1' }), makePrinter({ id: 'p2' })], (printerId) => ({
      id: 'job',
      requestId: 'req',
      printerId,
      kind: PrintKind.Receipt,
      image,
      status: PrintJobStatus.Success,
      retryCount: 0,
      createdAt: 'now',
    }));
    const service = new PrintService(deps);
    expect((await service.print(PrintKind.Receipt, image)).status).toBe(PrintResultStatus.Success);
  });

  it('reports partial-failure on mixed results', async () => {
    const deps = makeDeps([makePrinter({ id: 'p1' }), makePrinter({ id: 'p2' })], (printerId) => ({
      id: 'job',
      requestId: 'req',
      printerId,
      kind: PrintKind.Receipt,
      image,
      status: printerId === 'p1' ? PrintJobStatus.Success : PrintJobStatus.Failed,
      retryCount: 0,
      createdAt: 'now',
    }));
    const service = new PrintService(deps);
    expect((await service.print(PrintKind.Receipt, image)).status).toBe(PrintResultStatus.PartialFailure);
  });

  it('reports failed with no top-level error when every job fails', async () => {
    const deps = makeDeps([makePrinter({ id: 'p1' })], (printerId) => ({
      id: 'job',
      requestId: 'req',
      printerId,
      kind: PrintKind.Receipt,
      image,
      status: PrintJobStatus.Failed,
      retryCount: 0,
      createdAt: 'now',
      error: new PrintErrorException({ code: PrintErrorCode.UNKNOWN_ERROR, message: 'x' }),
    }));
    const service = new PrintService(deps);
    const result = await service.print(PrintKind.Receipt, image);
    expect(result.status).toBe(PrintResultStatus.Failed);
    expect(result.error).toBeUndefined();
  });
});

describe('PrintService.paperFor', () => {
  it('returns null when no printer prints this kind', () => {
    const deps = makeDeps([], () => {
      throw new Error('unused');
    });
    expect(new PrintService(deps).paperFor(PrintKind.Receipt)).toBeNull();
  });

  it('returns the paper of the first target', () => {
    const p1 = makePrinter({
      id: 'p1',
      language: makeEscPosLanguage(),
      paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm58, cutterMode: CutterMode.PerJob },
    });
    const p2 = makePrinter({ id: 'p2', language: makeTsplLanguage() });
    const deps = makeDeps([p1, p2], () => {
      throw new Error('unused');
    });
    expect(new PrintService(deps).paperFor(PrintKind.Receipt)).toEqual(p1.paper);
  });

  it('the real exported printService singleton has no configured printers by default, so it returns null', () => {
    expect(printService.paperFor(PrintKind.Receipt)).toBeNull();
  });
});
