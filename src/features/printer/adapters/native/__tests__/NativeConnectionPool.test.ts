import type { DeviceDisconnectedEvent, NativeConnectedDevice, NativeDeviceAddress } from '../DeviceModule';
import { createMockDeviceModule } from '../../testing/MockPrinterAdapter';

type PoolModule = typeof import('../NativeConnectionPool');

const { NativeConnectionPool } = jest.requireActual('../NativeConnectionPool') as PoolModule;

const PRINTER_A: NativeDeviceAddress = { type: 'lan', host: '10.0.0.1', port: 9100 };

const PRINTER_A_BY_OTHER_ADDRESS: NativeDeviceAddress = {
  type: 'usb',
  vendorId: 1,
  productId: 2,
  serialNumber: 'SN',
  devicePath: null,
};

const connectedTo = (connectionId: string): NativeConnectedDevice => ({ connectionId, serialNumber: null });

/** Promise tự điều khiển được thời điểm resolve, để giả lập native connect đang chờ. */
const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

const createPool = () => {
  const deviceModule = createMockDeviceModule();
  let emitDisconnected: (event: DeviceDisconnectedEvent) => void = () => undefined;
  const pool = new NativeConnectionPool(deviceModule, (callback) => {
    emitDisconnected = callback;
    return () => undefined;
  });
  return { pool, deviceModule, emit: (event: DeviceDisconnectedEvent) => emitDisconnected(event) };
};

describe('NativeConnectionPool', () => {
  it('hai acquire cùng thiết bị dùng chung kết nối; chỉ release cuối cùng mới disconnect', async () => {
    const { pool, deviceModule } = createPool();
    deviceModule.connect.mockResolvedValue(connectedTo('lan:10.0.0.1:9100'));

    const first = await pool.acquire(PRINTER_A);
    const second = await pool.acquire(PRINTER_A_BY_OTHER_ADDRESS);
    await first.release();
    expect(deviceModule.disconnect).not.toHaveBeenCalled();

    await second.release();
    expect(deviceModule.disconnect).toHaveBeenCalledTimes(1);
    expect(deviceModule.disconnect).toHaveBeenCalledWith('lan:10.0.0.1:9100');
  });

  it('release gọi lặp lại chỉ trừ một lần', async () => {
    const { pool, deviceModule } = createPool();
    deviceModule.connect.mockResolvedValue(connectedTo('c1'));
    const first = await pool.acquire(PRINTER_A);
    await pool.acquire(PRINTER_A);

    await first.release();
    await first.release();

    expect(deviceModule.disconnect).not.toHaveBeenCalled();
  });

  it('acquire nhận đúng kết nối đang bị release đóng thì chờ đóng xong rồi kết nối lại', async () => {
    const { pool, deviceModule } = createPool();
    deviceModule.connect.mockResolvedValueOnce(connectedTo('c1'));
    const holder = await pool.acquire(PRINTER_A);
    const pendingConnect = deferred<NativeConnectedDevice>();
    const pendingDisconnect = deferred<void>();
    deviceModule.connect.mockReturnValueOnce(pendingConnect.promise).mockResolvedValueOnce(connectedTo('c1'));
    deviceModule.disconnect.mockReturnValueOnce(pendingDisconnect.promise);

    const newcomer = pool.acquire(PRINTER_A);
    const holderRelease = holder.release();
    pendingConnect.resolve(connectedTo('c1'));
    pendingDisconnect.resolve();
    const newcomerLease = await newcomer;
    await holderRelease;

    expect(deviceModule.connect).toHaveBeenCalledTimes(3);
    expect(newcomerLease.connectionId).toBe('c1');
    await newcomerLease.release();
    expect(deviceModule.disconnect).toHaveBeenCalledTimes(2);
  });

  it('một máy đang chờ connect (vd hộp thoại quyền USB) không chặn acquire máy khác', async () => {
    const { pool, deviceModule } = createPool();
    deviceModule.connect
      .mockReturnValueOnce(deferred<NativeConnectedDevice>().promise)
      .mockResolvedValueOnce(connectedTo('lan:10.0.0.2:9100'));

    pool.acquire(PRINTER_A_BY_OTHER_ADDRESS);
    const otherPrinter = await pool.acquire({ type: 'lan', host: '10.0.0.2', port: 9100 });

    expect(otherPrinter.connectionId).toBe('lan:10.0.0.2:9100');
  });

  it('acquire lỗi không tăng bộ đếm và không chặn lần sau', async () => {
    const { pool, deviceModule } = createPool();
    deviceModule.connect.mockRejectedValueOnce({ code: 'CONNECTION_FAILED' });
    await expect(pool.acquire(PRINTER_A)).rejects.toEqual({ code: 'CONNECTION_FAILED' });

    deviceModule.connect.mockResolvedValueOnce(connectedTo('c1'));
    const lease = await pool.acquire(PRINTER_A);
    await lease.release();

    expect(deviceModule.disconnect).toHaveBeenCalledTimes(1);
  });

  it('sự kiện DeviceDisconnected xoá bộ đếm: lease cũ release không đóng phiên kết nối mới', async () => {
    const { pool, deviceModule, emit } = createPool();
    deviceModule.connect.mockResolvedValue(connectedTo('c1'));
    const staleLease = await pool.acquire(PRINTER_A);

    emit({ connectionId: 'c1', reason: 'usb_detached' });
    const freshLease = await pool.acquire(PRINTER_A);
    await staleLease.release();
    expect(deviceModule.disconnect).not.toHaveBeenCalled();

    await freshLease.release();
    expect(deviceModule.disconnect).toHaveBeenCalledTimes(1);
  });
});
