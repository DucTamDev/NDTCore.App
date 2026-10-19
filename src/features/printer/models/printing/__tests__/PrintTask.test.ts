import type { PrintTask } from '../PrintTask';
import { PrintKind } from '../../printer/PrintKind';
import { ConnectionType } from '../../connections/ConnectionType';

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
      title: 'Hoá đơn #A1024',
      createdAt: new Date().toISOString(),
    };
    expect(task.printerId).toBe('p1');
  });
});
