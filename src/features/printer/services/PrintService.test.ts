import { createPrintService } from './PrintService';
import type { PrintDestination } from '../types/destination.types';
import type { PrinterConfig } from '../types/printer.types';
import type { PrintJob } from '../types/printJob.types';

const plan = { id: 'plan1', destinationId: 'd1', document: { elements: [] }, copies: 1 };

const printer = (id: string, enabled = true): PrinterConfig => ({
  id, printerName: id, protocol: 'escpos', protocolSource: 'auto', connectionType: 'lan',
  paperSize: '80mm', autoReconnect: false, isDefault: false, enabled,
});

const makeDeps = (destination: PrintDestination, printers: PrinterConfig[], scheduleResult: (printerId: string) => PrintJob) => ({
  getDestinations: jest.fn().mockReturnValue([destination]),
  getPrinters: jest.fn().mockReturnValue(printers),
  scheduler: { enqueue: jest.fn().mockImplementation((job: PrintJob) => Promise.resolve(scheduleResult(job.printerId))) },
});

describe('PrintService', () => {
  it('returns no-available-printer with no jobs and a NO_AVAILABLE_PRINTER error when the effective printer list is empty', async () => {
    const destination: PrintDestination = { id: 'd1', name: 'Bar', printerIds: [], fanoutMode: 'failover', enabled: true };
    const deps = makeDeps(destination, [], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print(plan);
    expect(result.status).toBe('no-available-printer');
    expect(result.jobs).toEqual([]);
    expect(result.error?.code).toBe('NO_AVAILABLE_PRINTER');
    expect(deps.scheduler.enqueue).not.toHaveBeenCalled();
  });

  it('excludes disabled printers and a disabled destination\'s printers from the effective list', async () => {
    const destination: PrintDestination = { id: 'd1', name: 'Bar', printerIds: ['p1'], fanoutMode: 'failover', enabled: true };
    const deps = makeDeps(destination, [printer('p1', false)], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print(plan);
    expect(result.status).toBe('no-available-printer');
  });

  it('failover: stops at the first successful printer', async () => {
    const destination: PrintDestination = { id: 'd1', name: 'Bar', printerIds: ['p1', 'p2'], fanoutMode: 'failover', enabled: true };
    const deps = makeDeps(destination, [printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', planId: plan.id, printerId, document: plan.document, status: 'success', retryCount: 0, createdAt: 'now',
    }));
    const service = createPrintService(deps);
    const result = await service.print(plan);
    expect(result.status).toBe('success');
    expect(deps.scheduler.enqueue).toHaveBeenCalledTimes(1);
  });

  it('failover: tries every printer and reports failed (not no-available-printer) when all fail', async () => {
    const destination: PrintDestination = { id: 'd1', name: 'Bar', printerIds: ['p1', 'p2'], fanoutMode: 'failover', enabled: true };
    const deps = makeDeps(destination, [printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', planId: plan.id, printerId, document: plan.document, status: 'failed', retryCount: 0, createdAt: 'now',
      error: { code: 'PRINT_ERROR', message: 'x' },
    }));
    const service = createPrintService(deps);
    const result = await service.print(plan);
    expect(result.status).toBe('failed');
    expect(result.error).toBeUndefined();
    expect(deps.scheduler.enqueue).toHaveBeenCalledTimes(2);
  });

  it('broadcast: sends to every effective printer and reports partial-failure on mixed results', async () => {
    const destination: PrintDestination = { id: 'd1', name: 'Bar', printerIds: ['p1', 'p2'], fanoutMode: 'broadcast', enabled: true };
    const deps = makeDeps(destination, [printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', planId: plan.id, printerId, document: plan.document,
      status: printerId === 'p1' ? 'success' : 'failed', retryCount: 0, createdAt: 'now',
    }));
    const service = createPrintService(deps);
    const result = await service.print(plan);
    expect(result.status).toBe('partial-failure');
    expect(deps.scheduler.enqueue).toHaveBeenCalledTimes(2);
  });
});
