import type { PrintTask } from '../PrintTask';
import { PrintStatus } from '../PrintStatus';
import type { PrintResult } from '../PrintResult';
import { PrintKind } from '../../printer/PrintKind';
import { ConnectionType } from '../../connections/ConnectionType';
import { PrintErrorCode } from '../../../errors';
import { PrintErrorException } from '../../../exceptions';

describe('print task types', () => {
  it('accepts a PrintTask', () => {
    const task: PrintTask = {
      id: 'job1',
      printerId: 'p1',
      printerName: 'Máy in quầy',
      deviceId: 'lan:10.0.0.5:9100',
      connectionType: ConnectionType.Lan,
      kind: PrintKind.Receipt,
      data: 'base64-png',
      createdAt: new Date().toISOString(),
    };
    expect(task.printerId).toBe('p1');
  });

  it('accepts every PrintResult status', () => {
    const results: PrintResult[] = [
      { status: PrintStatus.Success, results: [] },
      { status: PrintStatus.PartialFailure, results: [] },
      { status: PrintStatus.Failed, results: [] },
      {
        status: PrintStatus.NoAvailablePrinter,
        results: [],
        error: new PrintErrorException({ code: PrintErrorCode.NO_AVAILABLE_PRINTER, message: 'x' }),
      },
    ];
    expect(results).toHaveLength(4);
  });
});
