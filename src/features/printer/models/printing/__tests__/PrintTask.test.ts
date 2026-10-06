import { PrintTaskStatus } from '../PrintTaskStatus';
import type { PrintTask } from '../PrintTask';
import { PrintStatus } from '../PrintStatus';
import type { PrintResult } from '../PrintResult';
import { PrintKind } from '../../printer/PrintKind';
import { ConnectionType } from '../../printer/ConnectionType';
import { PrintErrorCode } from '../../../errors';
import { PrintErrorException } from '../../../exceptions';

describe('print task types', () => {
  it('accepts a pending PrintTask', () => {
    const task: PrintTask = {
      id: 'job1',
      printerId: 'p1',
      printerName: 'Máy in quầy',
      deviceId: 'lan:10.0.0.5:9100',
      connectionType: ConnectionType.Lan,
      kind: PrintKind.Receipt,
      data: 'base64-png',
      status: PrintTaskStatus.Pending,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    expect(task.status).toBe(PrintTaskStatus.Pending);
  });

  it('accepts every PrintResult status', () => {
    const results: PrintResult[] = [
      { status: PrintStatus.Success, tasks: [] },
      { status: PrintStatus.PartialFailure, tasks: [] },
      { status: PrintStatus.Failed, tasks: [] },
      {
        status: PrintStatus.NoAvailablePrinter,
        tasks: [],
        error: new PrintErrorException({ code: PrintErrorCode.NO_AVAILABLE_PRINTER, message: 'x' }),
      },
    ];
    expect(results).toHaveLength(4);
  });
});
