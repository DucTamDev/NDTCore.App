import { PrinterConnectionService } from '../PrinterConnectionService';
import { ResourceLock, lockKeyOf } from '../PrinterConnectionLock';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { printerStorage } from '../../storage/PrinterStorage';
import { printerLogger } from '../../logging/PrinterLogger';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import type { Printer } from '../../models/printer/Printer';
import type { IPrinterAdapter } from '../../adapters/IPrinterAdapter';
import { basePrinter, makeFakeAdapter } from '../../testing/printerServiceTestKit';
import { DeviceErrorCode } from '../../errors';
import { DeviceErrorException } from '../../exceptions';

jest.mock('../../../../services/LoggerService', () => ({
  LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() },
}));

jest.mock('../../logging/PrinterLogger', () => ({
  printerLogger: {
    connectSucceeded: jest.fn(),
    connectFailed: jest.fn(),
    disconnectSucceeded: jest.fn(),
    disconnectFailed: jest.fn(),
  },
}));

const bluetoothPrinter: Printer = {
  ...basePrinter,
  id: 'p-bt',
  deviceId: 'bluetooth:mac:AA:BB:CC:DD:EE:FF',
  connection: { type: ConnectionType.Bluetooth, mac: 'AA:BB:CC:DD:EE:FF' },
};

const secondLanPrinter: Printer = {
  ...basePrinter,
  id: 'p2',
  deviceId: 'lan:192.168.1.11:9100',
  connection: { type: ConnectionType.Lan, host: '192.168.1.11', port: 9100 },
};

/** Service với các adapter giả lần lượt trả về cho mỗi lần kết nối. */
const setup = (adapters: IPrinterAdapter[], bluetoothGranted = true) => {
  const repository = new PrinterRepository();
  const queue = [...adapters];
  const createAdapter = jest.fn(() => {
    const next = queue.shift();

    if (!next) {
      throw new Error('Hết adapter giả');
    }

    return next;
  });
  const ensureBluetoothPermission = jest.fn().mockResolvedValue(bluetoothGranted);
  const lock = new ResourceLock();
  const service = new PrinterConnectionService({ createAdapter, ensureBluetoothPermission, repository, lock });

  return { service, repository, lock, createAdapter, ensureBluetoothPermission };
};

/** Ghi lại mọi trạng thái của một máy in kể từ lúc gọi. */
const recordStatuses = (service: ReturnType<typeof setup>['service'], printerId: string): PrinterStatus[] => {
  const statuses: PrinterStatus[] = [];
  service.onStatusChange(printerId, (status) => statuses.push(status));
  return statuses;
};

describe('PrinterConnectionService', () => {
  beforeEach(() => {
    printerStorage.savePrinters([]);
    jest.clearAllMocks();
  });

  it('máy chưa từng kết nối ở trạng thái Idle', () => {
    const { service } = setup([]);

    expect(service.getStatus('never')).toBe(PrinterStatus.Idle);
  });

  it('kết nối mở adapter bằng đúng kết nối của máy và chuyển Connecting → Connected', async () => {
    const { adapter } = makeFakeAdapter();
    const { service } = setup([adapter]);
    const statuses = recordStatuses(service, basePrinter.id);

    await service.connect(basePrinter);

    expect(adapter.connect).toHaveBeenCalledWith(basePrinter.connection);
    expect(statuses).toEqual([PrinterStatus.Connecting, PrinterStatus.Connected]);
    expect(printerLogger.connectSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: basePrinter.id, connectionType: ConnectionType.Lan }),
    );
  });

  it('kết nối Bluetooth xin quyền trước', async () => {
    const { adapter } = makeFakeAdapter();
    const { service, ensureBluetoothPermission } = setup([adapter]);

    await service.connect(bluetoothPrinter);

    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(adapter.connect).toHaveBeenCalledWith(bluetoothPrinter.connection);
  });

  it('không có quyền Bluetooth → PERMISSION_DENIED, trạng thái Error, không mở adapter', async () => {
    const { service, createAdapter } = setup([], false);

    await expect(service.connect(bluetoothPrinter)).rejects.toMatchObject({
      code: DeviceErrorCode.PERMISSION_DENIED,
    });

    expect(createAdapter).not.toHaveBeenCalled();
    expect(service.getStatus(bluetoothPrinter.id)).toBe(PrinterStatus.Error);
  });

  it('kết nối thất bại → trạng thái Error, ghi log và ném lại lỗi', async () => {
    const { adapter } = makeFakeAdapter();
    const failure = new DeviceErrorException({ code: DeviceErrorCode.CONNECTION_FAILED, message: 'down' });
    adapter.connect.mockRejectedValueOnce(failure);
    const { service } = setup([adapter]);

    await expect(service.connect(basePrinter)).rejects.toBe(failure);

    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.Error);
    expect(printerLogger.connectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: basePrinter.id, errorCode: DeviceErrorCode.CONNECTION_FAILED }),
    );
  });

  it('kết nối lại cùng máy: trả adapter cũ đúng một lần và gửi qua adapter mới', async () => {
    const first = makeFakeAdapter().adapter;
    const second = makeFakeAdapter().adapter;
    const { service } = setup([first, second]);

    await service.connect(basePrinter);
    await service.connect(basePrinter);
    await service.send(basePrinter.id, new Uint8Array([1]));

    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(second.disconnect).not.toHaveBeenCalled();
    expect(second.write).toHaveBeenCalledWith(new Uint8Array([1]));
    expect(first.write).not.toHaveBeenCalled();
  });

  it('kết nối lại thất bại thì giữ phiên cũ', async () => {
    const first = makeFakeAdapter().adapter;
    const second = makeFakeAdapter().adapter;
    second.connect.mockRejectedValueOnce(new Error('down'));
    const { service } = setup([first, second]);

    await service.connect(basePrinter);
    await expect(service.connect(basePrinter)).rejects.toThrow('down');
    await service.send(basePrinter.id, new Uint8Array([2]));

    expect(first.disconnect).not.toHaveBeenCalled();
    expect(first.write).toHaveBeenCalledWith(new Uint8Array([2]));
  });

  it('lỗi khi trả adapter cũ chỉ ghi log, kết nối mới vẫn thành công', async () => {
    const first = makeFakeAdapter().adapter;
    first.disconnect.mockRejectedValueOnce(new Error('close failed'));
    const second = makeFakeAdapter().adapter;
    const { service } = setup([first, second]);

    await service.connect(basePrinter);
    await service.connect(basePrinter);

    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.Connected);
    expect(printerLogger.disconnectFailed).toHaveBeenCalledWith(expect.objectContaining({ printerId: basePrinter.id }));
  });

  it('hai máy cùng loại kết nối giữ kết nối song song', async () => {
    const first = makeFakeAdapter().adapter;
    const second = makeFakeAdapter().adapter;
    const { service } = setup([first, second]);

    await service.connect(basePrinter);
    await service.connect(secondLanPrinter);

    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.Connected);
    expect(service.getStatus(secondLanPrinter.id)).toBe(PrinterStatus.Connected);
    expect(first.disconnect).not.toHaveBeenCalled();
  });

  it('ngắt kết nối: Disconnecting → Disconnected, trả adapter, sau đó gửi báo PRINTER_NOT_CONNECTED', async () => {
    const { adapter } = makeFakeAdapter();
    const { service } = setup([adapter]);
    await service.connect(basePrinter);
    const statuses = recordStatuses(service, basePrinter.id);

    await service.disconnect(basePrinter.id);

    expect(adapter.disconnect).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual([PrinterStatus.Disconnecting, PrinterStatus.Disconnected]);
    await expect(service.send(basePrinter.id, new Uint8Array([1]))).rejects.toMatchObject({
      code: DeviceErrorCode.NOT_CONNECTED,
    });
  });

  it('ngắt kết nối chờ lệnh đang giữ khoá của máy xong mới trả adapter', async () => {
    const { adapter } = makeFakeAdapter();
    const { service, lock } = setup([adapter]);
    await service.connect(basePrinter);
    let release: () => void = () => undefined;
    const held = lock.runExclusive(
      lockKeyOf(basePrinter),
      () => new Promise<void>((resolve) => (release = resolve)),
    );

    const disconnecting = service.disconnect(basePrinter.id);
    await Promise.resolve();
    await Promise.resolve();

    expect(adapter.disconnect).not.toHaveBeenCalled();

    release();
    await held;
    await disconnecting;

    expect(adapter.disconnect).toHaveBeenCalledTimes(1);
  });

  it('lệnh ngắt đang chờ khoá không xoá phiên của lần kết nối mới hơn', async () => {
    const first = makeFakeAdapter().adapter;
    const second = makeFakeAdapter().adapter;
    const { service, lock } = setup([first, second]);
    await service.connect(basePrinter);
    let release: () => void = () => undefined;
    const held = lock.runExclusive(
      lockKeyOf(basePrinter),
      () => new Promise<void>((resolve) => (release = resolve)),
    );

    const disconnecting = service.disconnect(basePrinter.id);
    await service.connect(basePrinter);
    release();
    await held;
    await disconnecting;
    await service.send(basePrinter.id, new Uint8Array([7]));

    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(second.disconnect).not.toHaveBeenCalled();
    expect(second.write).toHaveBeenCalledWith(new Uint8Array([7]));
    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.Connected);
  });

  it('kết nối không bị khoá giữ chặn (print kết nối bên trong khoá)', async () => {
    const first = makeFakeAdapter().adapter;
    const second = makeFakeAdapter().adapter;
    const { service, lock } = setup([first, second]);
    await service.connect(basePrinter);

    await lock.runExclusive(lockKeyOf(basePrinter), () => service.connect(basePrinter));

    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.Connected);
  });

  it('ngắt máy chưa kết nối chỉ đặt Disconnected', async () => {
    const { service } = setup([]);

    await service.disconnect('never');

    expect(service.getStatus('never')).toBe(PrinterStatus.Disconnected);
  });

  it('ngắt thất bại → trạng thái Error và ném lại lỗi', async () => {
    const { adapter } = makeFakeAdapter();
    adapter.disconnect.mockRejectedValueOnce(new Error('close failed'));
    const { service } = setup([adapter]);
    await service.connect(basePrinter);

    await expect(service.disconnect(basePrinter.id)).rejects.toThrow('close failed');

    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.Error);
  });

  it('gửi khi chưa kết nối → NOT_CONNECTED', async () => {
    const { service } = setup([]);

    await expect(service.send('never', new Uint8Array([1]))).rejects.toMatchObject({
      code: DeviceErrorCode.NOT_CONNECTED,
    });
  });

  it('đọc trả phản hồi của adapter', async () => {
    const { adapter } = makeFakeAdapter();
    adapter.read.mockResolvedValueOnce(new Uint8Array([0x41]));
    const { service } = setup([adapter]);
    await service.connect(basePrinter);

    await expect(service.read(basePrinter.id, 500)).resolves.toEqual(new Uint8Array([0x41]));
    expect(adapter.read).toHaveBeenCalledWith(500);
  });

  it('adapter báo mất kết nối → Disconnected', async () => {
    const { adapter, lose } = makeFakeAdapter();
    const { service } = setup([adapter]);
    await service.connect(basePrinter);

    lose();

    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.Disconnected);
  });

  it('adapter đã bị thay báo mất kết nối thì không đổi trạng thái', async () => {
    const first = makeFakeAdapter();
    const second = makeFakeAdapter();
    const { service } = setup([first.adapter, second.adapter]);
    await service.connect(basePrinter);
    await service.connect(basePrinter);

    first.lose();

    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.Connected);
  });

  it('huỷ đăng ký trạng thái thì không nhận nữa', async () => {
    const { adapter } = makeFakeAdapter();
    const { service } = setup([adapter]);
    const listener = jest.fn();
    const unsubscribe = service.onStatusChange(basePrinter.id, listener);

    unsubscribe();
    await service.connect(basePrinter);

    expect(listener).not.toHaveBeenCalled();
  });

  it('reconnect ngắt rồi kết nối lại bằng máy in đã lưu', async () => {
    const first = makeFakeAdapter().adapter;
    const second = makeFakeAdapter().adapter;
    const { service, repository } = setup([first, second]);
    repository.addPrinter(basePrinter);
    await service.connect(basePrinter);

    await service.reconnect(basePrinter.id);

    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(second.connect).toHaveBeenCalledWith(basePrinter.connection);
    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.Connected);
  });

  it('tự kết nối lại chỉ các máy đang bật và bật tự kết nối', async () => {
    const { adapter } = makeFakeAdapter();
    const { service, repository, createAdapter } = setup([adapter]);
    repository.addPrinter({ ...basePrinter, autoReconnect: true, enabled: true });
    repository.addPrinter({ ...secondLanPrinter, autoReconnect: false, enabled: true });

    service.reconnectAutoPrinters();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createAdapter).toHaveBeenCalledTimes(1);
    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.Connected);
    expect(service.getStatus(secondLanPrinter.id)).toBe(PrinterStatus.Idle);
  });

  it('tự kết nối lại nuốt lỗi của từng máy', async () => {
    const { adapter } = makeFakeAdapter();
    adapter.connect.mockRejectedValueOnce(new Error('offline'));
    const { service, repository } = setup([adapter]);
    repository.addPrinter({ ...basePrinter, autoReconnect: true, enabled: true });

    expect(() => service.reconnectAutoPrinters()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(service.getStatus(basePrinter.id)).toBe(PrinterStatus.Error);
  });
});
