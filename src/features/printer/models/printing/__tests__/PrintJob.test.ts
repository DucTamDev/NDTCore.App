import { PrintJobStatus, PrintResultStatus, type PrintJob, type PrintResult } from '../PrintJob';
import { PrintKind } from '../../printer/PrintKind';
import { PrintErrorCode } from '../../../errors';
import { PrintErrorException } from '../../../exceptions';

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
    const results: PrintResult[] = [
      { status: PrintResultStatus.Success, jobs: [] },
      { status: PrintResultStatus.PartialFailure, jobs: [] },
      { status: PrintResultStatus.Failed, jobs: [] },
      {
        status: PrintResultStatus.NoAvailablePrinter,
        jobs: [],
        error: new PrintErrorException({ code: PrintErrorCode.NO_AVAILABLE_PRINTER, message: 'x' }),
      },
    ];
    expect(results).toHaveLength(4);
  });
});
