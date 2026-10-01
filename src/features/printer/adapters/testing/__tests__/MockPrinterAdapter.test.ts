import { createMockDeviceModule, createMockSubscribeDeviceDisconnected } from '../MockPrinterAdapter';

describe('MockPrinterAdapter', () => {
  it('createMockDeviceModule trả stub cho toàn bộ hàm của DeviceModule', async () => {
    const mock = createMockDeviceModule();
    await expect(mock.discover('usb')).resolves.toEqual([]);
    await expect(mock.connect({ type: 'lan', host: '10.0.0.1', port: 9100 })).resolves.toEqual({
      connectionId: 'mock-connection',
      serialNumber: null,
    });
    await expect(mock.write('mock-connection', 'QUI=', 1000)).resolves.toBeUndefined();
    await expect(mock.read('mock-connection', 16, 1000)).resolves.toBeNull();
    await expect(mock.disconnect('mock-connection')).resolves.toBeUndefined();
  });

  it('createMockSubscribeDeviceDisconnected trả hàm huỷ đăng ký', () => {
    const subscribe = createMockSubscribeDeviceDisconnected();
    expect(typeof subscribe(jest.fn())).toBe('function');
  });
});
