import { PrintTaskStatus } from '../PrintTaskStatus';
import type { PrintTask } from '../PrintTask';
import { PrintResultStatus } from '../PrintResultStatus';
import type { PrintResult } from '../PrintResult';
import { PrintKind } from '../../printer/PrintKind';
import { PrintErrorCode } from '../../../errors';
import { PrintErrorException } from '../../../exceptions';

describe('print task types', () => {
  it('accepts a pending PrintTask', () => {
    const task: PrintTask = {
      id: 'job1',
      requestId: 'req1',
      printerId: 'p1',
      kind: PrintKind.Receipt,
      image: 'base64-png',
      status: PrintTaskStatus.Pending,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    expect(task.status).toBe(PrintTaskStatus.Pending);
  });

  it('accepts every PrintResult status', () => {
    const results: PrintResult[] = [
      { status: PrintResultStatus.Success, tasks: [] },
      { status: PrintResultStatus.PartialFailure, tasks: [] },
      { status: PrintResultStatus.Failed, tasks: [] },
      {
        status: PrintResultStatus.NoAvailablePrinter,
        tasks: [],
        error: new PrintErrorException({ code: PrintErrorCode.NO_AVAILABLE_PRINTER, message: 'x' }),
      },
    ];
    expect(results).toHaveLength(4);
  });
});
