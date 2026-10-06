import { PrintService, printService } from '../PrintService';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperSize } from '../../models/paper/PaperSize';
import { PaperType } from '../../models/paper/PaperType';
import { type Printer } from '../../models/printer/Printer';
import { PrintTaskStatus } from '../../models/printing/PrintTaskStatus';
import { PrintStatus } from '../../models/printing/PrintStatus';
import type { PrintTask } from '../../models/printing/PrintTask';
import { PrintKind } from '../../models/printer/PrintKind';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { makePrinter, makeEscPosLanguage, makeTsplLanguage } from '../../testing/printerFixtures';
import { PrintErrorCode } from '../../errors';
import { PrintErrorException } from '../../exceptions';
import { mockOf } from '../../testing/printerServiceTestKit';
import type { PrintRoutingService } from '../PrintRoutingService';
import type { PrintScheduler } from '../PrintScheduler';

const image = 'base64-png';

const makeDeps = (targets: Printer[], scheduleResult: (printerId: string) => PrintTask) => ({
  routing: mockOf<jest.Mocked<PrintRoutingService>>({ resolveTargets: jest.fn().mockReturnValue(targets) }),
  scheduler: mockOf<jest.Mocked<PrintScheduler>>({
    enqueue: jest.fn().mockImplementation((task: PrintTask) => Promise.resolve(scheduleResult(task.printerId))),
  }),
});

describe('PrintService.print', () => {
  it('returns no-available-printer with no tasks when routing finds nothing', async () => {
    const deps = makeDeps([], () => {
      throw new Error('should not be called');
    });
    const service = new PrintService(deps);
    const result = await service.print(PrintKind.Receipt, image);
    expect(result.status).toBe(PrintStatus.NoAvailablePrinter);
    expect(result.error?.code).toBe(PrintErrorCode.NO_AVAILABLE_PRINTER);
    expect(deps.scheduler.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues one task per resolved target, carrying the image through untouched', async () => {
    const p1 = makePrinter({ id: 'p1' });
    const deps = makeDeps([p1], (printerId) => ({
      id: 'job1',
      requestId: 'req1',
      printerId,
      printerName: 'Máy in',
      deviceId: `lan:${printerId}`,
      connectionType: ConnectionType.Lan,
      kind: PrintKind.Receipt,
      data: image,
      status: PrintTaskStatus.Success,
      retryCount: 0,
      createdAt: 'now',
    }));
    const service = new PrintService(deps);
    await service.print(PrintKind.Receipt, image);
    expect(deps.scheduler.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        printerId: 'p1',
        printerName: p1.name,
        deviceId: p1.deviceId,
        connectionType: p1.connection.type,
        data: image,
      }),
    );
  });

  it('reports success when all tasks succeed', async () => {
    const deps = makeDeps([makePrinter({ id: 'p1' }), makePrinter({ id: 'p2' })], (printerId) => ({
      id: 'task',
      requestId: 'req',
      printerId,
      printerName: 'Máy in',
      deviceId: `lan:${printerId}`,
      connectionType: ConnectionType.Lan,
      kind: PrintKind.Receipt,
      data: image,
      status: PrintTaskStatus.Success,
      retryCount: 0,
      createdAt: 'now',
    }));
    const service = new PrintService(deps);
    expect((await service.print(PrintKind.Receipt, image)).status).toBe(PrintStatus.Success);
  });

  it('reports partial-failure on mixed results', async () => {
    const deps = makeDeps([makePrinter({ id: 'p1' }), makePrinter({ id: 'p2' })], (printerId) => ({
      id: 'task',
      requestId: 'req',
      printerId,
      printerName: 'Máy in',
      deviceId: `lan:${printerId}`,
      connectionType: ConnectionType.Lan,
      kind: PrintKind.Receipt,
      data: image,
      status: printerId === 'p1' ? PrintTaskStatus.Success : PrintTaskStatus.Failed,
      retryCount: 0,
      createdAt: 'now',
    }));
    const service = new PrintService(deps);
    expect((await service.print(PrintKind.Receipt, image)).status).toBe(PrintStatus.PartialFailure);
  });

  it('reports failed with no top-level error when every task fails', async () => {
    const deps = makeDeps([makePrinter({ id: 'p1' })], (printerId) => ({
      id: 'task',
      requestId: 'req',
      printerId,
      printerName: 'Máy in',
      deviceId: `lan:${printerId}`,
      connectionType: ConnectionType.Lan,
      kind: PrintKind.Receipt,
      data: image,
      status: PrintTaskStatus.Failed,
      retryCount: 0,
      createdAt: 'now',
      error: new PrintErrorException({ code: PrintErrorCode.UNKNOWN_ERROR, message: 'x' }),
    }));
    const service = new PrintService(deps);
    const result = await service.print(PrintKind.Receipt, image);
    expect(result.status).toBe(PrintStatus.Failed);
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
