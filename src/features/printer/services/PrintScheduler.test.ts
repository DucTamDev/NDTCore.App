import { createPrintScheduler } from './PrintScheduler';
import { AppErrorException } from '../../../types/AppError';
import type { PrintJob } from '../types/printJob.types';

const makeJob = (overrides: Partial<PrintJob> = {}): PrintJob => ({
  id: 'job1',
  planId: 'plan1',
  printerId: 'p1',
  document: { elements: [] },
  status: 'pending',
  retryCount: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('PrintScheduler', () => {
  it('enqueue() resolves with status success when PrinterService.print resolves', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined) };
    const scheduler = createPrintScheduler(printerService);
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe('success');
    expect(result.completedAt).toBeDefined();
  });

  it('enqueue() resolves with status failed and an AppError when PrinterService.print rejects', async () => {
    const printerService = {
      print: jest.fn().mockRejectedValue(new AppErrorException({ code: 'PRINT_ERROR', message: 'hết giấy' })),
    };
    const scheduler = createPrintScheduler(printerService);
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe('failed');
    expect(result.error).toEqual({ code: 'PRINT_ERROR', message: 'hết giấy' });
  });

  it('never runs two jobs for the same printerId concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printerService = {
      print: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      }),
    };
    const scheduler = createPrintScheduler(printerService);
    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'a' })),
      scheduler.enqueue(makeJob({ id: 'b' })),
      scheduler.enqueue(makeJob({ id: 'c' })),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('retry() increments retryCount and re-enqueues the same job id', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined) };
    const scheduler = createPrintScheduler(printerService);
    const failed = makeJob({ status: 'failed', retryCount: 0 });
    const result = await scheduler.retry(failed);
    expect(result.id).toBe(failed.id);
    expect(result.retryCount).toBe(1);
    expect(result.status).toBe('success');
  });
});
