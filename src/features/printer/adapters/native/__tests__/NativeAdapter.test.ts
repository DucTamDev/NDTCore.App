import { Platform } from 'react-native';
import { NativeAdapter } from '../NativeAdapter';
import { ConnectionType } from '../../../models/printer/PrinterDevice';
import { PrinterErrorCode } from '../../../errors/PrinterError';

// `NativeAdapter.printText` có nhánh iOS gọi thẳng NativeModules.RN*Printer cũ
// (native iOS chưa implement kiến trúc printerId mới — ngoài phạm vi Android-only,
// xem NativeAdapter.ts). Jest preset RN mặc định Platform.OS='ios' — ép 'android'
// để test đúng nhánh ThermalPrinterModule thật sự chạy trên thiết bị.
const originalPlatformOS = Platform.OS;
beforeAll(() => {
  Platform.OS = 'android';
});
afterAll(() => {
  Platform.OS = originalPlatformOS;
});

jest.mock('../../../../../services/LoggerService', () => ({
  LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() },
}));

jest.mock('../PrinterNativeModule', () => ({
  ThermalPrinterModule: {
    discoverPrinters: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('ok'),
  },
}));

const mod = () =>
  jest.requireMock('../PrinterNativeModule') as {
    ThermalPrinterModule: {
      discoverPrinters: jest.Mock;
      connect: jest.Mock;
      disconnect: jest.Mock;
      writeByBase64: jest.Mock;
    };
  };

describe('NativeAdapter', () => {
  afterEach(() => jest.clearAllMocks());

  it('source là "native"', () => {
    expect(new NativeAdapter().source).toBe('native');
  });

  it('listDevices(lan) trả [] mà không gọi native', async () => {
    await expect(new NativeAdapter().listDevices(ConnectionType.lan)).resolves.toEqual([]);
    expect(mod().ThermalPrinterModule.discoverPrinters).not.toHaveBeenCalled();
  });

  it('listDevices(bluetooth) map address -> deviceId, name -> displayName', async () => {
    mod().ThermalPrinterModule.discoverPrinters.mockResolvedValueOnce([{ address: 'AA:BB', name: 'BT' }]);
    const devices = await new NativeAdapter().listDevices(ConnectionType.bluetooth);
    expect(devices).toEqual([{ deviceId: 'AA:BB', displayName: 'BT', rawDevice: { address: 'AA:BB', name: 'BT' } }]);
  });

  it('listDevices(usb) map vendorId:productId -> deviceId', async () => {
    mod().ThermalPrinterModule.discoverPrinters.mockResolvedValueOnce([{ vendorId: 1155, productId: 22222, name: 'X' }]);
    const devices = await new NativeAdapter().listDevices(ConnectionType.usb);
    expect(devices).toEqual([{ deviceId: '1155:22222', displayName: 'X', rawDevice: { vendorId: 1155, productId: 22222, name: 'X' } }]);
  });

  it('connect(lan) gọi ThermalPrinterModule.connect với printerId + host/port', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect({ printerId: 'p1', connectionType: ConnectionType.lan, lan: { ip: '10.0.0.5', port: 9100 } });
    expect(mod().ThermalPrinterModule.connect).toHaveBeenCalledWith({ printerId: 'p1', type: 'lan', host: '10.0.0.5', port: 9100 });
  });

  it('connect(bluetooth) gọi ThermalPrinterModule.connect với printerId + address', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect({ printerId: 'p1', connectionType: ConnectionType.bluetooth, bluetooth: { deviceId: 'AA:BB' } });
    expect(mod().ThermalPrinterModule.connect).toHaveBeenCalledWith({ printerId: 'p1', type: 'bluetooth', address: 'AA:BB' });
  });

  it('printText(lan) encode ESC/POS rồi gửi qua writeByBase64 với printerId', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect({ printerId: 'p1', connectionType: ConnectionType.lan, lan: { ip: '10.0.0.5', port: 9100 } });
    await adapter.printText('<C>hi</C>', { cut: true, tailingLine: true, encoding: 'UTF8' });
    expect(mod().ThermalPrinterModule.writeByBase64).toHaveBeenCalledWith('p1', expect.any(String));
  });

  it('write(bluetooth) base64-encodes bytes rồi gửi qua writeByBase64 với printerId', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect({ printerId: 'p1', connectionType: ConnectionType.bluetooth, bluetooth: { deviceId: 'AA:BB' } });
    await adapter.write(new Uint8Array([0x41, 0x42]));
    expect(mod().ThermalPrinterModule.writeByBase64).toHaveBeenCalledWith('p1', 'QUI=');
  });

  it('read() luôn null (native không đọc được)', async () => {
    await expect(new NativeAdapter().read(1000)).resolves.toBeNull();
  });

  it('connect(usb) thiếu target.usb -> VALIDATION_ERROR', async () => {
    await expect(new NativeAdapter().connect({ printerId: 'p1', connectionType: ConnectionType.usb })).rejects.toMatchObject({
      code: PrinterErrorCode.VALIDATION_ERROR,
    });
  });

  it('disconnect(lan) gọi ThermalPrinterModule.disconnect với printerId', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect({ printerId: 'p1', connectionType: ConnectionType.lan, lan: { ip: '10.0.0.5', port: 9100 } });
    await adapter.disconnect();
    expect(mod().ThermalPrinterModule.disconnect).toHaveBeenCalledWith('p1');
  });
});
