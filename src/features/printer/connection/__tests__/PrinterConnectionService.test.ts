import { PrinterConnectionService } from '../PrinterConnectionService';
import { PrinterConnectionLock, lockKeyOf } from '../PrinterConnectionLock';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { printerStorage } from '../../storage/PrinterStorage';
import { printerLogger } from '../../logging/PrinterLogger';
import { ConnectionType } from '../../models/connections/ConnectionType';
import { ConnectionStatus } from '../../models/connections/ConnectionStatus';
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
  const lock = new PrinterConnectionLock();
  const service = new PrinterConnectionService(createAdapter, ensureBluetoothPermission, repository, lock);

  return { service, repository, lock, createAdapter, ensureBluetoothPermission };
};

/** Ghi lại mọi trạng thái của một máy in kể từ lúc gọi. */
const recordStatuses = (service: ReturnType<typeof setup>['service'], printerId: string): ConnectionStatus[] => {
  const statuses: ConnectionStatus[] = [];
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

    expect(service.getStatus('never')).toBe(ConnectionStatus.Idle);
  });

  it('kết nối mở adapter bằng đúng kết nối của máy và chuyển Connecting → Connected', async () => {
    const { adapter } = makeFakeAdapter();
    const { service } = setup([adapter]);
    const statuses = recordStatuses(service, basePrinter.id);

    await service.connect(basePrinter);

    expect(adapter.connect).toHaveBeenCalledWith(basePrinter.connection);
    expect(statuses).toEqual([ConnectionStatus.Connecting, ConnectionStatus.Connected]);
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
    expect(service.getStatus(bluetoothPrinter.id)).toBe(ConnectionStatus.Error);
  });

  it('kết nối thất bại → trạng thái Error, ghi log và ném lại lỗi', async () => {
    const { adapter } = makeFakeAdapter();
    const failure = new DeviceErrorException({ code: DeviceErrorCode.CONNECTION_FAILED, message: 'down' });
    adapter.connect.mockRejectedValueOnce(failure);
    const { service } = setup([adapter]);

    await expect(service.connect(basePrinter)).rejects.toBe(failure);

    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Error);
    expect(printerLogger.connectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: basePrinter.id, errorCode: DeviceErrorCode.CONNECTION_FAILED }),
    );
  });

  it('kết nối lại cùng máy dùng lại kết nối đang mở, không mở adapter mới', async () => {
    const first = makeFakeAdapter().adapter;
    const { service, createAdapter } = setup([first]);

    await service.connect(basePrinter);
    await service.connect(basePrinter);
    await service.send(basePrinter.id, new Uint8Array([1]));

    expect(createAdapter).toHaveBeenCalledTimes(1);
    expect(first.disconnect).not.toHaveBeenCalled();
    expect(first.write).toHaveBeenCalledWith(new Uint8Array([1]));
  });

  it('hai máy in trỏ cùng một máy vật lý dùng chung một kết nối; ngắt máy này máy kia vẫn in được', async () => {
    const shared = makeFakeAdapter().adapter;
    const { service, createAdapter } = setup([shared]);
    const label: Printer = { ...basePrinter, id: 'p-label' };

    await service.connect(basePrinter);
    await service.connect(label);
    await service.disconnect(basePrinter.id);
    await service.send(label.id, new Uint8Array([3]));

    expect(createAdapter).toHaveBeenCalledTimes(1);
    expect(shared.disconnect).not.toHaveBeenCalled();
    expect(shared.write).toHaveBeenCalledWith(new Uint8Array([3]));
    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Disconnected);
    expect(service.getStatus(label.id)).toBe(ConnectionStatus.Connected);
    await expect(service.send(basePrinter.id, new Uint8Array([1]))).rejects.toMatchObject({
      code: DeviceErrorCode.NOT_CONNECTED,
    });
  });

  it('máy in cuối cùng ngắt thì mới đóng kết nối dùng chung', async () => {
    const shared = makeFakeAdapter().adapter;
    const { service } = setup([shared]);
    const label: Printer = { ...basePrinter, id: 'p-label' };
    await service.connect(basePrinter);
    await service.connect(label);

    await service.disconnect(basePrinter.id);
    await service.disconnect(label.id);

    expect(shared.disconnect).toHaveBeenCalledTimes(1);
  });

  it('mất kết nối dùng chung thì mọi máy in trên máy đó chuyển Disconnected', async () => {
    const shared = makeFakeAdapter();
    const { service } = setup([shared.adapter]);
    const label: Printer = { ...basePrinter, id: 'p-label' };
    await service.connect(basePrinter);
    await service.connect(label);

    shared.lose();

    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Disconnected);
    expect(service.getStatus(label.id)).toBe(ConnectionStatus.Disconnected);
    expect(shared.adapter.disconnect).toHaveBeenCalledTimes(1);
  });

  it('chuyển sang máy vật lý khác mà mở thất bại thì giữ kết nối cũ', async () => {
    const first = makeFakeAdapter().adapter;
    const second = makeFakeAdapter().adapter;
    second.connect.mockRejectedValueOnce(new Error('down'));
    const { service } = setup([first, second]);

    await service.connect(basePrinter);
    await expect(service.connect({ ...basePrinter, connection: secondLanPrinter.connection })).rejects.toThrow('down');
    await service.send(basePrinter.id, new Uint8Array([2]));

    expect(first.disconnect).not.toHaveBeenCalled();
    expect(first.write).toHaveBeenCalledWith(new Uint8Array([2]));
  });

  it('chuyển sang máy vật lý khác: đóng kết nối cũ, lỗi khi đóng chỉ ghi log', async () => {
    const first = makeFakeAdapter().adapter;
    first.disconnect.mockRejectedValueOnce(new Error('close failed'));
    const second = makeFakeAdapter().adapter;
    const { service } = setup([first, second]);

    await service.connect(basePrinter);
    await service.connect({ ...basePrinter, connection: secondLanPrinter.connection });
    await service.send(basePrinter.id, new Uint8Array([4]));

    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(second.write).toHaveBeenCalledWith(new Uint8Array([4]));
    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Connected);
    expect(printerLogger.disconnectFailed).toHaveBeenCalledWith(expect.objectContaining({ printerId: basePrinter.id }));
  });

  it('hai máy cùng loại kết nối giữ kết nối song song', async () => {
    const first = makeFakeAdapter().adapter;
    const second = makeFakeAdapter().adapter;
    const { service } = setup([first, second]);

    await service.connect(basePrinter);
    await service.connect(secondLanPrinter);

    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Connected);
    expect(service.getStatus(secondLanPrinter.id)).toBe(ConnectionStatus.Connected);
    expect(first.disconnect).not.toHaveBeenCalled();
  });

  it('ngắt kết nối: Disconnecting → Disconnected, trả adapter, sau đó gửi báo PRINTER_NOT_CONNECTED', async () => {
    const { adapter } = makeFakeAdapter();
    const { service } = setup([adapter]);
    await service.connect(basePrinter);
    const statuses = recordStatuses(service, basePrinter.id);

    await service.disconnect(basePrinter.id);

    expect(adapter.disconnect).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual([ConnectionStatus.Disconnecting, ConnectionStatus.Disconnected]);
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

  it('lệnh ngắt đang chờ khoá hết hiệu lực khi máy in được kết nối lại', async () => {
    const first = makeFakeAdapter().adapter;
    const { service, lock } = setup([first]);
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

    expect(first.disconnect).not.toHaveBeenCalled();
    expect(first.write).toHaveBeenCalledWith(new Uint8Array([7]));
    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Connected);
  });

  it('kết nối không bị khoá in giữ chặn (print kết nối bên trong khoá)', async () => {
    const { adapter } = makeFakeAdapter();
    const { service, lock } = setup([adapter]);

    await lock.runExclusive(lockKeyOf(basePrinter), () => service.connect(basePrinter));

    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Connected);
  });

  it('ngắt máy chưa kết nối chỉ đặt Disconnected', async () => {
    const { service } = setup([]);

    await service.disconnect('never');

    expect(service.getStatus('never')).toBe(ConnectionStatus.Disconnected);
  });

  it('ngắt thất bại → trạng thái Error và ném lại lỗi', async () => {
    const { adapter } = makeFakeAdapter();
    adapter.disconnect.mockRejectedValueOnce(new Error('close failed'));
    const { service } = setup([adapter]);
    await service.connect(basePrinter);

    await expect(service.disconnect(basePrinter.id)).rejects.toThrow('close failed');

    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Error);
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

    await expect(service.read(basePrinter.id)).resolves.toEqual(new Uint8Array([0x41]));
    expect(adapter.read).toHaveBeenCalledTimes(1);
  });

  it('adapter báo mất kết nối → Disconnected, bỏ phiên và trả adapter', async () => {
    const { adapter, lose } = makeFakeAdapter();
    const { service } = setup([adapter]);
    await service.connect(basePrinter);

    lose();

    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Disconnected);
    expect(adapter.disconnect).toHaveBeenCalledTimes(1);
    await expect(service.send(basePrinter.id, new Uint8Array([1]))).rejects.toMatchObject({
      code: DeviceErrorCode.NOT_CONNECTED,
    });
  });

  it('ngắt sau khi đã mất kết nối thì không gọi lại adapter', async () => {
    const { adapter, lose } = makeFakeAdapter();
    const { service } = setup([adapter]);
    await service.connect(basePrinter);
    lose();

    await service.disconnect(basePrinter.id);

    expect(adapter.disconnect).toHaveBeenCalledTimes(1);
    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Disconnected);
  });

  it('lượt kết nối cũ thất bại thì không ghi đè trạng thái của lượt mới', async () => {
    const slow = makeFakeAdapter();
    let failSlow: (error: Error) => void = () => undefined;
    slow.adapter.connect.mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => {
        failSlow = reject;
      }),
    );
    const fast = makeFakeAdapter();
    const { service } = setup([slow.adapter, fast.adapter]);

    const first = service.connect(basePrinter);
    const second = service.connect(basePrinter);
    failSlow(new Error('timeout'));

    await expect(first).rejects.toThrow('timeout');
    await second;
    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Connected);
    await expect(service.send(basePrinter.id, new Uint8Array([1]))).resolves.toBeUndefined();
    expect(fast.adapter.write).toHaveBeenCalled();
  });

  it('hai lượt kết nối cùng lúc: chỉ lượt mới nhất giữ máy in, trạng thái Connected', async () => {
    const slow = makeFakeAdapter();
    let finishSlow: () => void = () => undefined;
    slow.adapter.connect.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSlow = resolve;
      }),
    );
    const fast = makeFakeAdapter();
    const { service } = setup([slow.adapter, fast.adapter]);

    const first = service.connect(basePrinter);
    const second = service.connect(basePrinter);
    finishSlow();
    await Promise.all([first, second]);
    await service.send(basePrinter.id, new Uint8Array([5]));

    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Connected);
    expect([slow.adapter, fast.adapter].filter((adapter) => adapter.write.mock.calls.length > 0)).toHaveLength(1);
  });

  it('ngắt trong lúc đang kết nối thì kết nối xong bị trả lại, trạng thái giữ Disconnected', async () => {
    const { adapter } = makeFakeAdapter();
    let finishConnect: () => void = () => undefined;
    adapter.connect.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishConnect = resolve;
      }),
    );
    const { service } = setup([adapter]);

    const connecting = service.connect(basePrinter);
    await service.disconnect(basePrinter.id);
    finishConnect();
    await connecting;

    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Disconnected);
    expect(adapter.disconnect).toHaveBeenCalledTimes(1);
    await expect(service.send(basePrinter.id, new Uint8Array([1]))).rejects.toMatchObject({
      code: DeviceErrorCode.NOT_CONNECTED,
    });
  });

  it('listener ném lỗi không làm hỏng kết nối và không chặn listener khác', async () => {
    const { adapter } = makeFakeAdapter();
    const { service } = setup([adapter]);
    const after = jest.fn();
    service.onStatusChange(basePrinter.id, () => {
      throw new Error('listener hỏng');
    });
    service.onStatusChange(basePrinter.id, after);

    await expect(service.connect(basePrinter)).resolves.toBeUndefined();

    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Connected);
    expect(after).toHaveBeenCalledWith(ConnectionStatus.Connected);
  });

  it('kết nối cũ (đã chuyển sang máy khác) báo mất thì không đổi trạng thái', async () => {
    const first = makeFakeAdapter();
    const second = makeFakeAdapter();
    const { service } = setup([first.adapter, second.adapter]);
    await service.connect(basePrinter);
    await service.connect({ ...basePrinter, connection: secondLanPrinter.connection });

    first.lose();

    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Connected);
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
    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Connected);
  });

  it('reconnect máy in đã bị xoá thì chỉ ngắt, không mở lại', async () => {
    const first = makeFakeAdapter().adapter;
    const { service, createAdapter } = setup([first]);
    await service.connect(basePrinter);

    await service.reconnect(basePrinter.id);

    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(createAdapter).toHaveBeenCalledTimes(1);
    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Disconnected);
  });

  it('tự kết nối lại chỉ các máy đang bật và bật tự kết nối', async () => {
    const { adapter } = makeFakeAdapter();
    const { service, repository, createAdapter } = setup([adapter]);
    repository.addPrinter({ ...basePrinter, autoReconnect: true, enabled: true });
    repository.addPrinter({ ...secondLanPrinter, autoReconnect: false, enabled: true });

    service.reconnectAutoPrinters();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createAdapter).toHaveBeenCalledTimes(1);
    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Connected);
    expect(service.getStatus(secondLanPrinter.id)).toBe(ConnectionStatus.Idle);
  });

  it('tự kết nối lại nuốt lỗi của từng máy', async () => {
    const { adapter } = makeFakeAdapter();
    adapter.connect.mockRejectedValueOnce(new Error('offline'));
    const { service, repository } = setup([adapter]);
    repository.addPrinter({ ...basePrinter, autoReconnect: true, enabled: true });

    expect(() => service.reconnectAutoPrinters()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(service.getStatus(basePrinter.id)).toBe(ConnectionStatus.Error);
  });
});
