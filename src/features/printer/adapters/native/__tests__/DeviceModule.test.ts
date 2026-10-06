import { Buffer } from 'buffer';
import { DeviceEventEmitter, NativeModules } from 'react-native';

const loadReal = () => jest.requireActual('../DeviceModule') as typeof import('../DeviceModule');

describe('DeviceModule', () => {
  afterEach(() => jest.clearAllMocks());

  it('discover gọi native với loại thiết bị', async () => {
    await loadReal().DeviceModule.discover('bluetooth');
    expect(NativeModules.DeviceModule.discover).toHaveBeenCalledWith('bluetooth');
  });

  it('connect gửi nguyên địa chỉ và trả kết quả native', async () => {
    const address = { type: 'usb', vendorId: 1, productId: 2, serialNumber: 'SN', devicePath: null } as const;
    await expect(loadReal().DeviceModule.connect(address)).resolves.toEqual({
      connectionId: 'mock-connection',
      serialNumber: null,
    });
    expect(NativeModules.DeviceModule.connect).toHaveBeenCalledWith(address);
  });

  it('write, read, disconnect gửi đúng tham số; read có hạn cố định 1 000 ms', async () => {
    const { DeviceModule } = loadReal();
    await DeviceModule.write('c1', 'QUI=');
    await DeviceModule.read('c1', 64);
    await DeviceModule.disconnect('c1');

    expect(NativeModules.DeviceModule.write).toHaveBeenCalledWith('c1', 'QUI=', expect.any(Number));
    expect(NativeModules.DeviceModule.read).toHaveBeenCalledWith('c1', 64, 1_000);
    expect(NativeModules.DeviceModule.disconnect).toHaveBeenCalledWith('c1');
  });

  it('hạn ghi = 30 000 ms + ceil(byte / 2) cho payload nhỏ', async () => {
    const base64 = Buffer.from(new Uint8Array(1_001)).toString('base64');

    await loadReal().DeviceModule.write('c1', base64);

    expect(NativeModules.DeviceModule.write).toHaveBeenCalledWith('c1', base64, 30_000 + 501);
  });

  it('hạn ghi chặn trên ở 600 000 ms cho payload rất lớn', async () => {
    const base64 = Buffer.from(new Uint8Array(2_000_000)).toString('base64');

    await loadReal().DeviceModule.write('c1', base64);

    expect(NativeModules.DeviceModule.write).toHaveBeenCalledWith('c1', base64, 600_000);
  });
});

describe('subscribeDeviceDisconnected', () => {
  it('gọi callback khi native phát DeviceDisconnected, ngừng gọi sau khi huỷ', () => {
    const callback = jest.fn();
    const unsubscribe = loadReal().subscribeDeviceDisconnected(callback);
    const event = { connectionId: 'usb:/dev/bus/usb/001/004', reason: 'usb_detached' };

    DeviceEventEmitter.emit('DeviceDisconnected', event);
    expect(callback).toHaveBeenCalledWith(event);

    unsubscribe();
    callback.mockClear();
    DeviceEventEmitter.emit('DeviceDisconnected', event);
    expect(callback).not.toHaveBeenCalled();
  });
});
