import type { PrintDocument } from '../printDocument.types';
import type { PrintJob, PrintResult } from '../printJob.types';

const document: PrintDocument = { elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] };

describe('print job types', () => {
  it('accepts a pending PrintJob', () => {
    const job: PrintJob = {
      id: 'job1',
      requestId: 'req1',
      printerId: 'p1',
      document,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    expect(job.status).toBe('pending');
  });

  it('accepts every PrintResult status', () => {
    // 'PRINT_ERROR' here is just an existing AppErrorCode to satisfy the shape —
    // 'NO_AVAILABLE_PRINTER' isn't added until Task 10, which runs after this one.
    const results: PrintResult[] = [
      { status: 'success', jobs: [] },
      { status: 'partial-failure', jobs: [] },
      { status: 'failed', jobs: [] },
      { status: 'no-available-printer', jobs: [], error: { code: 'PRINT_ERROR', message: 'x' } },
    ];
    expect(results).toHaveLength(4);
  });
});
