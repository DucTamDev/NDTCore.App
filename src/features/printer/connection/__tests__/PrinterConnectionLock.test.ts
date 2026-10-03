import { createResourceLock, lockKeyOf } from '../PrinterConnectionLock';
import { ConnectionType } from '../../models/printer/ConnectionType';
import type { PrinterConnection } from '../../models/printer/PrinterConnection';
import { makePrinter, makeTsplLanguage } from '../../testing/printerFixtures';

const bluetoothConnection = (mac: string): PrinterConnection => ({ type: ConnectionType.Bluetooth, mac });

const lanConnection: PrinterConnection = { type: ConnectionType.Lan, host: '192.168.1.50', port: 9100 };

const usbConnection: PrinterConnection = { type: ConnectionType.Usb, vendorId: 1155, productId: 22222 };

describe('lockKeyOf', () => {
  it('cùng máy vật lý thì cùng khoá, dù khác máy in đã lưu và khác ngôn ngữ', () => {
    const receipt = makePrinter({ id: 'receipt', connection: lanConnection });
    const label = makePrinter({ id: 'label', connection: lanConnection, language: makeTsplLanguage() });

    expect(lockKeyOf(receipt)).toBe(lockKeyOf(label));
  });

  it('máy khác nhau cùng loại kết nối thì khác khoá', () => {
    const deviceA = makePrinter({ connection: bluetoothConnection('AA:AA:AA:AA:AA:AA') });
    const deviceB = makePrinter({ connection: bluetoothConnection('BB:BB:BB:BB:BB:BB') });

    expect(lockKeyOf(deviceA)).not.toBe(lockKeyOf(deviceB));
  });

  it('tính từ kết nối nên bản nháp chưa có deviceId vẫn khoá đúng máy', () => {
    const draft = makePrinter({ deviceId: '', connection: usbConnection });

    expect(lockKeyOf(draft)).toBe('usb:1155:22222');
  });
});

describe('createResourceLock', () => {
  it('runs two tasks under the same key sequentially, never overlapping', async () => {
    const lock = createResourceLock();
    let inFlight = 0;
    let maxInFlight = 0;
    const task = () =>
      lock.runExclusive('k', async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      });
    await Promise.all([task(), task()]);
    expect(maxInFlight).toBe(1);
  });

  it('runs tasks under different keys concurrently', async () => {
    const lock = createResourceLock();
    let inFlight = 0;
    let maxInFlight = 0;
    const task = (key: string) =>
      lock.runExclusive(key, async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      });
    await Promise.all([task('a'), task('b')]);
    expect(maxInFlight).toBe(2);
  });

  it('runs queued tasks in the order they were submitted', async () => {
    const order: string[] = [];
    const lock = createResourceLock();
    await Promise.all([
      lock.runExclusive('k', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push('a');
      }),
      lock.runExclusive('k', async () => {
        order.push('b');
      }),
    ]);
    expect(order).toEqual(['a', 'b']);
  });

  it('resolves with the task result and does not swallow the task error', async () => {
    const lock = createResourceLock();
    await expect(lock.runExclusive('k', async () => undefined)).resolves.toBeUndefined();
    await expect(
      lock.runExclusive('k', async () => {
        throw new Error('driver lỗi');
      }),
    ).rejects.toThrow('driver lỗi');
  });

  it('a rejecting task does not block the next queued task for the same key', async () => {
    const lock = createResourceLock();
    const order: string[] = [];
    const first = lock
      .runExclusive('k', async () => {
        throw new Error('driver lỗi');
      })
      .catch(() => order.push('first-rejected'));
    const second = lock.runExclusive('k', async () => {
      order.push('second-ran');
    });
    await Promise.all([first, second]);
    expect(order).toEqual(['first-rejected', 'second-ran']);
  });
});
