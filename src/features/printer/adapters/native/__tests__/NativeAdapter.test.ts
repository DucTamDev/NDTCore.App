import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import { NativeAdapter } from '../NativeAdapter';
import { PrinterConnectionType } from '../../../models/printer/PrinterConnection';
import { PrinterErrorCode } from '../../../errors/PrinterError';

// `NativeAdapter.printText` có nhánh iOS gọi module in cũ của iOS. Jest preset RN mặc định Platform.OS='ios' — ép
// 'android' để test đúng nhánh DeviceModule chạy trên thiết bị.
const originalPlatformOS = Platform.OS;
beforeAll(() => {
  Platform.OS = 'android';
});
afterAll(() => {
  Platform.OS = originalPlatformOS;
});

const deviceModule = () =>
  (jest.requireMock('../DeviceModule') as {
    DeviceModule: { discover: jest.Mock; connect: jest.Mock; write: jest.Mock; read: jest.Mock; disconnect: jest.Mock };
  }).DeviceModule;

const lanTarget = { printerId: 'p1', connectionType: PrinterConnectionType.Lan, lan: { ip: '10.0.0.5', port: 9100 } };

const bluetoothTarget = {
  printerId: 'p2',
  connectionType: PrinterConnectionType.Bluetooth,
  bluetooth: { deviceId: 'AA:BB' },
};

describe('NativeAdapter', () => {
  afterEach(() => jest.clearAllMocks());

  it('source là "native" và đọc được phản hồi', () => {
    const adapter = new NativeAdapter();
    expect(adapter.source).toBe('native');
    expect(adapter.canRead).toBe(true);
  });

  it('listDevices(lan) trả [] mà không gọi native', async () => {
    await expect(new NativeAdapter().listDevices(PrinterConnectionType.Lan)).resolves.toEqual([]);
    expect(deviceModule().discover).not.toHaveBeenCalled();
  });

  it('listDevices(bluetooth) dùng MAC làm deviceId', async () => {
    deviceModule().discover.mockResolvedValueOnce([
      { type: 'bluetooth', deviceId: 'bluetooth:AA:BB', name: 'BT', address: { type: 'bluetooth', mac: 'AA:BB' } },
    ]);
    const devices = await new NativeAdapter().listDevices(PrinterConnectionType.Bluetooth);
    expect(deviceModule().discover).toHaveBeenCalledWith('bluetooth');
    expect(devices).toEqual([{ deviceId: 'AA:BB', displayName: 'BT', rawDevice: { type: 'bluetooth', mac: 'AA:BB' } }]);
  });

  it('listDevices(usb) giữ deviceId vendorId:productId và đưa serial/devicePath vào rawDevice', async () => {
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
    const devices = await new NativeAdapter().listDevices(PrinterConnectionType.Usb);
    expect(devices).toEqual([
      {
        deviceId: '1155:22222',
        displayName: 'X',
        rawDevice: {
          vendorId: 1155,
          productId: 22222,
          serialNumber: null,
          devicePath: '/dev/bus/usb/001/004',
          manufacturerName: null,
          productName: 'X',
        },
      },
    ]);
  });

  it('connect gửi địa chỉ native theo từng loại kết nối', async () => {
    await new NativeAdapter().connect(lanTarget);
    await new NativeAdapter().connect(bluetoothTarget);
    await new NativeAdapter().connect({
      printerId: 'p3',
      connectionType: PrinterConnectionType.Usb,
      usb: { vendorId: 1155, productId: 22222, serialNumber: 'SN1' },
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

  it('connect(usb) thiếu target.usb -> VALIDATION_ERROR', async () => {
    const connect = new NativeAdapter().connect({ printerId: 'p1', connectionType: PrinterConnectionType.Usb });
    await expect(connect).rejects.toMatchObject({ code: PrinterErrorCode.VALIDATION_ERROR });
  });

  it('getConnectionId trả mã native sau connect, null trước connect', async () => {
    const adapter = new NativeAdapter();
    expect(adapter.getConnectionId()).toBeNull();

    deviceModule().connect.mockResolvedValueOnce({ connectionId: 'bluetooth:AA:BB', serialNumber: null });
    await adapter.connect(bluetoothTarget);
    expect(adapter.getConnectionId()).toBe('bluetooth:AA:BB');
  });

  it('write gửi base64 kèm hạn ghi theo connectionId', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);
    await adapter.write(new Uint8Array([0x41, 0x42]));
    expect(deviceModule().write).toHaveBeenCalledWith('mock-connection', 'QUI=', expect.any(Number));
  });

  it('printText encode ESC/POS rồi ghi theo connectionId', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);
    await adapter.printText('<C>hi</C>', { cut: true, tailingLine: true, encoding: 'UTF8' });
    expect(deviceModule().write).toHaveBeenCalledWith('mock-connection', expect.any(String), expect.any(Number));
  });

  it('read trả byte giải mã từ base64, null khi native trả null', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);

    deviceModule().read.mockResolvedValueOnce('QUI=');
    await expect(adapter.read(1000)).resolves.toEqual(new Uint8Array([0x41, 0x42]));
    await expect(adapter.read(1000)).resolves.toBeNull();
  });

  it('connect lần hai trả lease của lần đầu đúng một lần', async () => {
    const adapter = new NativeAdapter();
    deviceModule().connect
      .mockResolvedValueOnce({ connectionId: 'first', serialNumber: null })
      .mockResolvedValueOnce({ connectionId: 'second', serialNumber: null });

    await adapter.connect(lanTarget);
    await adapter.connect(lanTarget);

    expect(adapter.getConnectionId()).toBe('second');
    expect(deviceModule().disconnect).toHaveBeenCalledTimes(1);
    expect(deviceModule().disconnect).toHaveBeenCalledWith('first');
  });

  it('connect lần hai thất bại giữ nguyên lease và loại kết nối của lần đầu', async () => {
    const adapter = new NativeAdapter();
    deviceModule().connect.mockResolvedValueOnce({ connectionId: 'first', serialNumber: null });
    await adapter.connect(lanTarget);

    deviceModule().connect.mockRejectedValueOnce({ code: 'CONNECTION_FAILED', message: 'fail' });
    await expect(adapter.connect(bluetoothTarget)).rejects.toBeDefined();

    expect(adapter.getConnectionId()).toBe('first');
    expect(deviceModule().disconnect).not.toHaveBeenCalled();
    await adapter.write(new Uint8Array([1]));
    expect(deviceModule().write).toHaveBeenCalledWith('first', expect.any(String), expect.any(Number));
  });

  it('timeout ghi = 30 000 ms + ceil(byte / 2) cho payload nhỏ', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);
    await adapter.write(new Uint8Array(1_001));
    expect(deviceModule().write).toHaveBeenCalledWith('mock-connection', expect.any(String), 30_000 + 501);
  });

  it('timeout ghi chặn trên ở 600 000 ms cho payload rất lớn', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);
    await adapter.write(new Uint8Array(2_000_000));
    expect(deviceModule().write).toHaveBeenCalledWith('mock-connection', expect.any(String), 600_000);
  });

  it('printText cũng dùng timeout theo cỡ payload', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);
    await adapter.printText('hi', { cut: true, tailingLine: true, encoding: 'UTF8' });
    const [, base64, timeoutMs] = deviceModule().write.mock.calls[0] as [string, string, number];
    expect(timeoutMs).toBe(30_000 + Math.ceil(Buffer.from(base64, 'base64').length / 2));
  });

  it('write trước connect -> PRINTER_NOT_CONNECTED', async () => {
    await expect(new NativeAdapter().write(new Uint8Array([1]))).rejects.toMatchObject({
      code: PrinterErrorCode.PRINTER_NOT_CONNECTED,
    });
  });

  it('lỗi native được đổi sang PrinterErrorException theo mã', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);
    deviceModule().write.mockRejectedValueOnce({ code: 'WRITE_TIMEOUT', message: 'timeout' });

    const write = adapter.write(new Uint8Array([1]));
    await expect(write).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_WRITE_FAILED });
  });

  it('disconnect trả lease (native disconnect) và lần thứ hai không làm gì', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect(lanTarget);
    await adapter.disconnect();
    await adapter.disconnect();
    expect(deviceModule().disconnect).toHaveBeenCalledTimes(1);
    expect(deviceModule().disconnect).toHaveBeenCalledWith('mock-connection');
  });
});
