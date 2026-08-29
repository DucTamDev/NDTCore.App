import { NativeModules } from 'react-native';
import { listUsbDevices, findUsbDescriptor, type UsbDeviceDescriptor } from '../UsbPrinterInfoNative';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

const descriptor = (over: Partial<UsbDeviceDescriptor> = {}): UsbDeviceDescriptor => ({
  deviceName: '/dev/bus/usb/001/009',
  deviceId: 1009,
  vendorId: 11575,
  productId: 33751,
  manufacturerName: 'Xprinter',
  productName: 'XP-420B',
  version: '1.00',
  serialNumber: null,
  deviceClass: 0,
  deviceSubclass: 0,
  deviceProtocol: 0,
  interfaceCount: 1,
  interfaceClass: 7,
  interfaceSubclass: 1,
  interfaceProtocol: 2,
  hasBulkInEndpoint: true,
  hasBulkOutEndpoint: true,
  ...over,
});

describe('UsbPrinterInfoNative', () => {
  const original = NativeModules.UsbDeviceInfo;
  afterEach(() => {
    (NativeModules as Record<string, unknown>).UsbDeviceInfo = original;
  });

  it('returns [] when the native module is not linked (JS bundle ahead of the build)', async () => {
    (NativeModules as Record<string, unknown>).UsbDeviceInfo = undefined;
    await expect(listUsbDevices()).resolves.toEqual([]);
  });

  it('returns [] instead of throwing when the native call rejects', async () => {
    (NativeModules as Record<string, unknown>).UsbDeviceInfo = { listDevices: jest.fn().mockRejectedValue(new Error('boom')) };
    await expect(listUsbDevices()).resolves.toEqual([]);
  });

  it('passes native descriptors straight through', async () => {
    const d = descriptor();
    (NativeModules as Record<string, unknown>).UsbDeviceInfo = { listDevices: jest.fn().mockResolvedValue([d]) };
    await expect(listUsbDevices()).resolves.toEqual([d]);
  });

  it('findUsbDescriptor matches on vendorId + productId', () => {
    const list = [descriptor({ vendorId: 1, productId: 2 }), descriptor({ vendorId: 11575, productId: 33751, serialNumber: 'S1' })];
    expect(findUsbDescriptor(list, 11575, 33751)?.serialNumber).toBe('S1');
    expect(findUsbDescriptor(list, 999, 999)).toBeUndefined();
  });
});
