import { NativeAdapter, toDeviceError } from '../NativeAdapter';
import { ConnectionType } from '../../../models/printer/ConnectionType';
import type { PrinterConnection } from '../../../models/printer/PrinterConnection';
import { DeviceErrorCode } from '../../../errors/DeviceErrorCode';
import { DeviceErrorException } from '../../../exceptions/DeviceErrorException';

type DisconnectListener = (event: { connectionId: string; reason: string }) => void;

const nativeMock = () =>
  jest.requireMock('../DeviceModule') as {
    DeviceModule: { discover: jest.Mock; connect: jest.Mock; write: jest.Mock; read: jest.Mock; disconnect: jest.Mock };
    subscribeDeviceDisconnected: jest.Mock;
  };

const deviceModule = () => nativeMock().DeviceModule;

/** Bắn sự kiện mất kết nối tới listener cuối cùng đã đăng ký. */
const emitDisconnected = (connectionId: string): void => {
  const { calls } = nativeMock().subscribeDeviceDisconnected.mock;
  const listener = calls[calls.length - 1][0] as DisconnectListener;
  listener({ connectionId, reason: 'usb_detached' });
};

const lanConnection: PrinterConnection = { type: ConnectionType.Lan, host: '10.0.0.5', port: 9100 };

const bluetoothConnection: PrinterConnection = { type: ConnectionType.Bluetooth, mac: 'AA:BB' };

describe('NativeAdapter', () => {
  afterEach(() => jest.clearAllMocks());

  it('source là "native" và đọc được phản hồi', () => {
    const adapter = new NativeAdapter();
    expect(adapter.source).toBe('native');
    expect(adapter.canRead).toBe(true);
  });

  it('listDevices(lan) trả [] mà không gọi native', async () => {
    await expect(new NativeAdapter().listDevices(ConnectionType.Lan)).resolves.toEqual([]);
    expect(deviceModule().discover).not.toHaveBeenCalled();
  });

  it('listDevices(bluetooth) trả mã quét của native và kết nối theo MAC', async () => {
    deviceModule().discover.mockResolvedValueOnce([
      { type: 'bluetooth', deviceId: 'bluetooth:AA:BB', name: 'BT', address: { type: 'bluetooth', mac: 'AA:BB' } },
    ]);
    const devices = await new NativeAdapter().listDevices(ConnectionType.Bluetooth);
    expect(deviceModule().discover).toHaveBeenCalledWith('bluetooth');
    expect(devices).toEqual([
      {
        device: { deviceId: 'bluetooth:AA:BB', name: 'BT', hasPermission: true },
        connection: { type: ConnectionType.Bluetooth, mac: 'AA:BB' },
      },
    ]);
  });

  it('listDevices(usb) trả thông tin thiết bị và kết nối USB, không giữ đường dẫn thiết bị', async () => {
    deviceModule().discover.mockResolvedValueOnce([
      {
        type: 'usb',
        deviceId: 'usb:/dev/bus/usb/001/004',
        name: 'X',
        address: {
          type: 'usb',
          vendorId: 1155,
          productId: 22222,
          serialNumber: null,
          devicePath: '/dev/bus/usb/001/004',
        },
        manufacturerName: null,
        productName: 'X',
        hasPermission: false,
      },
    ]);
    const devices = await new NativeAdapter().listDevices(ConnectionType.Usb);
    expect(devices).toEqual([
      {
        device: { deviceId: 'usb:/dev/bus/usb/001/004', name: 'X', model: 'X', hasPermission: false },
        connection: { type: ConnectionType.Usb, vendorId: 1155, productId: 22222 },
      },
    ]);
  });

  it('listDevices: thiếu tên thì dùng MAC hoặc đường dẫn; USB có serial thì đưa vào kết nối', async () => {
    deviceModule().discover.mockResolvedValueOnce([
      { type: 'bluetooth', deviceId: 'bluetooth:AA:BB', name: null, address: { type: 'bluetooth', mac: 'AA:BB' } },
      {
        type: 'usb',
        deviceId: 'usb:/dev/bus/usb/001/005',
        name: null,
        address: { type: 'usb', vendorId: 1, productId: 2, serialNumber: 'SN9', devicePath: '/dev/bus/usb/001/005' },
        manufacturerName: 'Xprinter',
        productName: null,
        hasPermission: true,
      },
    ]);

    const [bluetooth, usb] = await new NativeAdapter().listDevices(ConnectionType.Usb);

    expect(bluetooth.device.name).toBe('AA:BB');
    expect(usb).toEqual({
      device: {
        deviceId: 'usb:/dev/bus/usb/001/005',
        name: '/dev/bus/usb/001/005',
        manufacturer: 'Xprinter',
        hasPermission: true,
      },
      connection: { type: ConnectionType.Usb, vendorId: 1, productId: 2, serialNumber: 'SN9' },
    });
  });

  it('connect gửi địa chỉ native theo từng loại kết nối', async () => {
    await new NativeAdapter().connect(lanConnection);
    await new NativeAdapter().connect(bluetoothConnection);
    await new NativeAdapter().connect({
      type: ConnectionType.Usb,
      vendorId: 1155,
      productId: 22222,
      serialNumber: 'SN1',
    });

    expect(deviceModule().connect).toHaveBeenNthCalledWith(1, { type: 'lan', host: '10.0.0.5', port: 9100 });
    expect(deviceModule().connect).toHaveBeenNthCalledWith(2, { type: 'bluetooth', mac: 'AA:BB' });
    expect(deviceModule().connect).toHaveBeenNthCalledWith(3, {
      type: 'usb',
      vendorId: 1155,
      productId: 22222,
      serialNumber: 'SN1',
      devicePath: null,
    });
  });

  it('connect USB chưa biết serial gửi serialNumber null', async () => {
    await new NativeAdapter().connect({ type: ConnectionType.Usb, vendorId: 1155, productId: 22222 });

    expect(deviceModule().connect).toHaveBeenCalledWith(expect.objectContaining({ serialNumber: null }));
  });

  it('write gửi base64 kèm hạn ghi theo connectionId', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanConnection);
    await adapter.write(new Uint8Array([0x41, 0x42]));
    expect(deviceModule().write).toHaveBeenCalledWith('mock-connection', 'QUI=', expect.any(Number));
  });

  it('read trả byte giải mã từ base64, null khi native trả null', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanConnection);

    deviceModule().read.mockResolvedValueOnce('QUI=');
    await expect(adapter.read(1000)).resolves.toEqual(new Uint8Array([0x41, 0x42]));
    await expect(adapter.read(1000)).resolves.toBeNull();
  });

  it('connect lần hai trả lease của lần đầu đúng một lần và ghi qua lease mới', async () => {
    const adapter = new NativeAdapter();
    deviceModule()
      .connect.mockResolvedValueOnce({ connectionId: 'first', serialNumber: null })
      .mockResolvedValueOnce({ connectionId: 'second', serialNumber: null });

    await adapter.connect(lanConnection);
    await adapter.connect(lanConnection);
    await adapter.write(new Uint8Array([1]));

    expect(deviceModule().disconnect).toHaveBeenCalledTimes(1);
    expect(deviceModule().disconnect).toHaveBeenCalledWith('first');
    expect(deviceModule().write).toHaveBeenCalledWith('second', expect.any(String), expect.any(Number));
  });

  it('connect lần hai thất bại giữ nguyên lease của lần đầu', async () => {
    const adapter = new NativeAdapter();
    deviceModule().connect.mockResolvedValueOnce({ connectionId: 'first', serialNumber: null });
    await adapter.connect(lanConnection);

    deviceModule().connect.mockRejectedValueOnce({ code: 'CONNECTION_FAILED', message: 'fail' });
    await expect(adapter.connect(bluetoothConnection)).rejects.toBeDefined();

    expect(deviceModule().disconnect).not.toHaveBeenCalled();
    await adapter.write(new Uint8Array([1]));
    expect(deviceModule().write).toHaveBeenCalledWith('first', expect.any(String), expect.any(Number));
  });

  it('onLost báo khi native mất đúng kết nối đang giữ', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanConnection);
    const callback = jest.fn();
    adapter.onLost(callback);

    emitDisconnected('other-connection');
    expect(callback).not.toHaveBeenCalled();

    emitDisconnected('mock-connection');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('onLost không báo khi chưa kết nối hoặc đã ngắt', async () => {
    const adapter = new NativeAdapter();
    const callback = jest.fn();
    adapter.onLost(callback);

    emitDisconnected('mock-connection');
    await adapter.connect(lanConnection);
    await adapter.disconnect();
    emitDisconnected('mock-connection');

    expect(callback).not.toHaveBeenCalled();
  });

  it('timeout ghi = 30 000 ms + ceil(byte / 2) cho payload nhỏ', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanConnection);
    await adapter.write(new Uint8Array(1_001));
    expect(deviceModule().write).toHaveBeenCalledWith('mock-connection', expect.any(String), 30_000 + 501);
  });

  it('timeout ghi chặn trên ở 600 000 ms cho payload rất lớn', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanConnection);
    await adapter.write(new Uint8Array(2_000_000));
    expect(deviceModule().write).toHaveBeenCalledWith('mock-connection', expect.any(String), 600_000);
  });

  it('write trước connect -> NOT_CONNECTED', async () => {
    await expect(new NativeAdapter().write(new Uint8Array([1]))).rejects.toMatchObject({
      code: DeviceErrorCode.NOT_CONNECTED,
    });
  });

  it('lỗi native được đổi sang DeviceErrorException giữ nguyên mã', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanConnection);
    deviceModule().write.mockRejectedValueOnce({ code: 'WRITE_TIMEOUT', message: 'timeout' });

    const write = adapter.write(new Uint8Array([1]));
    await expect(write).rejects.toMatchObject({ code: DeviceErrorCode.WRITE_TIMEOUT });
  });

  it('disconnect trả lease (native disconnect) và lần thứ hai không làm gì', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanConnection);
    await adapter.disconnect();
    await adapter.disconnect();
    expect(deviceModule().disconnect).toHaveBeenCalledTimes(1);
    expect(deviceModule().disconnect).toHaveBeenCalledWith('mock-connection');
  });
});

describe('toDeviceError', () => {
  it.each(Object.values(DeviceErrorCode))('mã native %s giữ nguyên, kèm thông báo tiếng Việt và lỗi gốc', (code) => {
    const nativeError = { code, message: 'native message' };

    const error = toDeviceError(nativeError);

    expect(error).toBeInstanceOf(DeviceErrorException);
    expect(error).toMatchObject({ code, cause: nativeError });
    expect((error as DeviceErrorException).message).not.toBe('native message');
  });

  it('lỗi không có mã thiết bị được trả nguyên', () => {
    const plain = new Error('native connect failed');
    const internal = { code: 'INTERNAL_ERROR', message: 'boom' };

    expect(toDeviceError(plain)).toBe(plain);
    expect(toDeviceError(internal)).toBe(internal);
  });
});
