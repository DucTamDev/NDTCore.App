import { createPrintService } from './PrintService';
import type { PrinterConfig } from '../types/printer.types';
import type { PrintJob } from '../types/printJob.types';

const document = { elements: [] };

const printer = (id: string, enabled = true): PrinterConfig => ({
  id, printerName: id, protocol: 'escpos', protocolSource: 'auto', connectionType: 'lan',
  paperSize: '80mm', autoReconnect: false, isDefault: false, enabled,
});

const makeDeps = (
  defaultPrinterIds: string[],
  printers: PrinterConfig[],
  scheduleResult: (printerId: string) => PrintJob,
) => ({
  getDefaultPrinterIdsForType: jest.fn().mockReturnValue(defaultPrinterIds),
  getPrinters: jest.fn().mockReturnValue(printers),
  scheduler: { enqueue: jest.fn().mockImplementation((job: PrintJob) => Promise.resolve(scheduleResult(job.printerId))) },
});

describe('PrintService', () => {
  it('returns no-available-printer with no jobs and a NO_AVAILABLE_PRINTER error when nothing is configured', async () => {
    const deps = makeDeps([], [], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print('Receipt', document);
    expect(result.status).toBe('no-available-printer');
    expect(result.jobs).toEqual([]);
    expect(result.error?.code).toBe('NO_AVAILABLE_PRINTER');
    expect(deps.scheduler.enqueue).not.toHaveBeenCalled();
  });

  it('excludes a configured printer that is disabled', async () => {
    const deps = makeDeps(['p1'], [printer('p1', false)], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print('Receipt', document);
    expect(result.status).toBe('no-available-printer');
  });

  it('sends to every configured printer and reports success when all succeed', async () => {
    const deps = makeDeps(['p1', 'p2'], [printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', requestId: 'req1', printerId, document, status: 'success', retryCount: 0, createdAt: 'now',
    }));
    const service = createPrintService(deps);
    const result = await service.print('Receipt', document);
    expect(result.status).toBe('success');
    expect(deps.scheduler.enqueue).toHaveBeenCalledTimes(2);
  });

  it('reports partial-failure on mixed results', async () => {
    const deps = makeDeps(['p1', 'p2'], [printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', requestId: 'req1', printerId, document,
      status: printerId === 'p1' ? 'success' : 'failed', retryCount: 0, createdAt: 'now',
    }));
    const service = createPrintService(deps);
    const result = await service.print('Receipt', document);
    expect(result.status).toBe('partial-failure');
  });

  it('reports failed with no top-level error when all configured printers fail', async () => {
    const deps = makeDeps(['p1', 'p2'], [printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', requestId: 'req1', printerId, document, status: 'failed', retryCount: 0, createdAt: 'now',
      error: { code: 'PRINT_ERROR', message: 'x' },
    }));
    const service = createPrintService(deps);
    const result = await service.print('Receipt', document);
    expect(result.status).toBe('failed');
    expect(result.error).toBeUndefined();
  });
});
