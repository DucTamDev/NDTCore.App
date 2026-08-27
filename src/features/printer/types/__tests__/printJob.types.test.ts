import type { PrintDocument } from '../printDocument.types';
import { PrintJobStatus, PrintResultStatus, type PrintJob, type PrintResult } from '../printJob.types';
import { AppErrorCode } from '../AppError';
import { PrintType } from '../printConfiguration.types';

const document: PrintDocument = { elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] };

describe('print job types', () => {
  it('accepts a pending PrintJob', () => {
    const job: PrintJob = {
      id: 'job1',
      requestId: 'req1',
      printerId: 'p1',
      printType: PrintType.Receipt,
      documentVariants: { text: document },
      status: PrintJobStatus.pending,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    expect(job.status).toBe(PrintJobStatus.pending);
  });

  it('accepts every PrintResult status', () => {
    // 'PRINT_ERROR' here is just an existing AppErrorCode to satisfy the shape —
    // 'NO_AVAILABLE_PRINTER' isn't added until Task 10, which runs after this one.
    const results: PrintResult[] = [
      { status: PrintResultStatus.success, jobs: [] },
      { status: PrintResultStatus.partialFailure, jobs: [] },
      { status: PrintResultStatus.failed, jobs: [] },
      { status: PrintResultStatus.noAvailablePrinter, jobs: [], error: { code: AppErrorCode.PRINT_ERROR, message: 'x' } },
    ];
    expect(results).toHaveLength(4);
  });
});
