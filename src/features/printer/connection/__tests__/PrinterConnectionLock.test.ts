import { PrinterConnectionLock, lockKeyOf } from '../PrinterConnectionLock';
import { ConnectionType } from '../../models/connections/ConnectionType';
import type { DeviceAddress } from '../../models/device/DeviceAddress';
import { makePrinter, makeTsplLanguage } from '../../testing/printerFixtures';

const bluetoothConnection = (mac: string): DeviceAddress => ({ type: ConnectionType.Bluetooth, mac });

const lanConnection: DeviceAddress = { type: ConnectionType.Lan, host: '192.168.1.50', port: 9100 };

const usbConnection: DeviceAddress = { type: ConnectionType.Usb, vendorId: 1155, productId: 22222 };

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

describe('PrinterConnectionLock', () => {
  it('runs two tasks under the same key sequentially, never overlapping', async () => {
    const lock = new PrinterConnectionLock();
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
    const lock = new PrinterConnectionLock();
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
    const lock = new PrinterConnectionLock();
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
    const lock = new PrinterConnectionLock();
    await expect(lock.runExclusive('k', async () => undefined)).resolves.toBeUndefined();
    await expect(
      lock.runExclusive('k', async () => {
        throw new Error('tác vụ lỗi');
      }),
    ).rejects.toThrow('tác vụ lỗi');
  });

  it('a rejecting task does not block the next queued task for the same key', async () => {
    const lock = new PrinterConnectionLock();
    const order: string[] = [];
    const first = lock
      .runExclusive('k', async () => {
        throw new Error('tác vụ lỗi');
      })
      .catch(() => order.push('first-rejected'));
    const second = lock.runExclusive('k', async () => {
      order.push('second-ran');
    });
    await Promise.all([first, second]);
    expect(order).toEqual(['first-rejected', 'second-ran']);
  });
});
