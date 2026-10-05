import { PrintJobStatus, PrintResultStatus, type PrintJob, type PrintResult } from '../PrintJob';
import { PrinterErrorCode } from '../../../errors/PrinterErrorCode';
import { PrintKind } from '../../printer/PrintKind';

describe('print job types', () => {
  it('accepts a pending PrintJob', () => {
    const job: PrintJob = {
      id: 'job1',
      requestId: 'req1',
      printerId: 'p1',
      kind: PrintKind.Receipt,
      image: 'base64-png',
      status: PrintJobStatus.Pending,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    expect(job.status).toBe(PrintJobStatus.Pending);
  });

  it('accepts every PrintResult status', () => {
    // 'UNKNOWN_ERROR' ở đây chỉ là 1 PrinterErrorCode bất kỳ để thoả shape.
    const results: PrintResult[] = [
      { status: PrintResultStatus.Success, jobs: [] },
      { status: PrintResultStatus.PartialFailure, jobs: [] },
      { status: PrintResultStatus.Failed, jobs: [] },
      { status: PrintResultStatus.NoAvailablePrinter, jobs: [], error: { code: PrinterErrorCode.UNKNOWN_ERROR, message: 'x' } },
    ];
    expect(results).toHaveLength(4);
  });
});
