import type { PrintDocument } from '../printDocument.types';
import { PrintJobStatus, PrintResultStatus, type PrintJob, type PrintResult } from '../printJob.types';
import { PrinterErrorCode } from '../PrinterError';
import { PrintType } from '../printConfiguration.types';

const document: PrintDocument = { elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] };

describe('print job types', () => {
  it('accepts a pending PrintJob', () => {
    const job: PrintJob = {
      id: 'job1',
      requestId: 'req1',
      printerId: 'p1',
      printType: PrintType.Receipt,
      documents: { text: document },
      status: PrintJobStatus.pending,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    expect(job.status).toBe(PrintJobStatus.pending);
  });

  it('PrintJob dùng field documents (không phải documentVariants)', () => {
    const job: PrintJob = {
      id: '1',
      requestId: 'r',
      printerId: 'p',
      printType: PrintType.Receipt,
      documents: { text: { elements: [] } },
      status: PrintJobStatus.pending,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    expect(job.documents.text).toBeDefined();
  });

  it('accepts every PrintResult status', () => {
    // 'UNKNOWN_ERROR' ở đây chỉ là 1 PrinterErrorCode bất kỳ để thoả shape.
    const results: PrintResult[] = [
      { status: PrintResultStatus.success, jobs: [] },
      { status: PrintResultStatus.partialFailure, jobs: [] },
      { status: PrintResultStatus.failed, jobs: [] },
      { status: PrintResultStatus.noAvailablePrinter, jobs: [], error: { code: PrinterErrorCode.UNKNOWN_ERROR, message: 'x' } },
    ];
    expect(results).toHaveLength(4);
  });
});
