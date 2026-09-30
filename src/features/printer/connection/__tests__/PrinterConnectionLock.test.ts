import { connectionResourceKey, createResourceLock } from '../PrinterConnectionLock';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import type { PrinterConnection } from '../../models/printer/PrinterConnection';
import { PrinterDriverType } from '../../models/printer/PrinterDriver';

const bluetoothConnection = (deviceId: string): PrinterConnection => ({ type: PrinterConnectionType.Bluetooth, deviceId });
const lanConnection: PrinterConnection = { type: PrinterConnectionType.Lan, host: '192.168.1.50', port: 9100 };
const usbConnection: PrinterConnection = { type: PrinterConnectionType.Usb, vendorId: 1155, productId: 22222 };

describe('connectionResourceKey', () => {
  it('is "usb" for any driver over USB (RNUSBPrinter is a shared native singleton)', () => {
    expect(connectionResourceKey({ driverType: PrinterDriverType.EscPos, connection: usbConnection })).toBe('usb');
    expect(connectionResourceKey({ driverType: PrinterDriverType.Tspl, connection: usbConnection })).toBe('usb');
  });

  it('is "escpos:bluetooth" regardless of device — the vendor library BLEPrinter namespace is a global singleton', () => {
    const deviceA = bluetoothConnection('AA:AA:AA:AA:AA:AA');
    const deviceB = bluetoothConnection('BB:BB:BB:BB:BB:BB');
    expect(connectionResourceKey({ driverType: PrinterDriverType.EscPos, connection: deviceA })).toBe(
      connectionResourceKey({ driverType: PrinterDriverType.EscPos, connection: deviceB }),
    );
    expect(connectionResourceKey({ driverType: PrinterDriverType.EscPos, connection: deviceA })).toBe('escpos:bluetooth');
  });

  it('is "escpos:lan" regardless of host:port — the vendor library NetPrinter namespace is a global singleton', () => {
    expect(connectionResourceKey({ driverType: PrinterDriverType.EscPos, connection: lanConnection })).toBe('escpos:lan');
  });

  it('is per-device for tspl over bluetooth — TsplDriver manages its own transport per printer, no shared native singleton', () => {
    const deviceA = bluetoothConnection('AA:AA:AA:AA:AA:AA');
    const deviceB = bluetoothConnection('BB:BB:BB:BB:BB:BB');
    expect(connectionResourceKey({ driverType: PrinterDriverType.Tspl, connection: deviceA })).not.toBe(
      connectionResourceKey({ driverType: PrinterDriverType.Tspl, connection: deviceB }),
    );
    expect(connectionResourceKey({ driverType: PrinterDriverType.Tspl, connection: deviceA })).toBe('tspl:bluetooth:AA:AA:AA:AA:AA:AA');
  });

  it('is per-host:port for tspl over lan', () => {
    expect(connectionResourceKey({ driverType: PrinterDriverType.Tspl, connection: lanConnection })).toBe('tspl:lan:192.168.1.50:9100');
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
