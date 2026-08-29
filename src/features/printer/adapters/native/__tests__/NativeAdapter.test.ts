import { NativeAdapter } from '../NativeAdapter';
import { ConnectionType } from '../../../types/printer.types';
import { PrinterErrorCode } from '../../../types/PrinterError';

jest.mock('../../../../../services/LoggerService', () => ({
  LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() },
}));

jest.mock('../PrinterNativeModule', () => {
  const ns = (overrides: Record<string, unknown> = {}) => ({
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'X' }),
    closeConn: jest.fn().mockResolvedValue(undefined),
    printText: jest.fn((_t: string, _o: unknown, cbOk?: () => void) => cbOk?.()),
    ...overrides,
  });
  return {
    USBPrinter: ns(),
    BLEPrinter: ns(),
    NetPrinter: ns(),
    ensureUsbInitialized: jest.fn().mockResolvedValue(undefined),
    ensureNativeInitialized: jest.fn().mockResolvedValue(undefined),
    printRawDataUsb: jest.fn().mockResolvedValue(undefined),
    printRawDataBluetooth: jest.fn().mockResolvedValue(undefined),
    printRawDataLan: jest.fn().mockResolvedValue(undefined),
    ThermalPrinterAdapter: { printTextAsync: jest.fn().mockResolvedValue(undefined) },
  };
});

const mod = () => jest.requireMock('../PrinterNativeModule');

describe('NativeAdapter', () => {
  afterEach(() => jest.clearAllMocks());

  it('source là "native"', () => {
    expect(new NativeAdapter().source).toBe('native');
  });

  it('listDevices(lan) trả [] mà không gọi native', async () => {
    await expect(new NativeAdapter().listDevices(ConnectionType.lan)).resolves.toEqual([]);
  });

  it('listDevices(bluetooth) map inner_mac_address -> deviceId', async () => {
    mod().BLEPrinter.getDeviceList.mockResolvedValueOnce([{ device_name: 'BT', inner_mac_address: 'AA:BB' }]);
    const devices = await new NativeAdapter().listDevices(ConnectionType.bluetooth);
    expect(devices).toEqual([{ deviceId: 'AA:BB', displayName: 'BT', rawDevice: { device_name: 'BT', inner_mac_address: 'AA:BB' } }]);
  });

  it('listDevices init native trước getDeviceList (tránh NPE native adapter==null)', async () => {
    await new NativeAdapter().listDevices(ConnectionType.usb);
    expect(mod().ensureNativeInitialized).toHaveBeenCalledWith(ConnectionType.usb);
    await new NativeAdapter().listDevices(ConnectionType.bluetooth);
    expect(mod().ensureNativeInitialized).toHaveBeenCalledWith(ConnectionType.bluetooth);
  });

  it('connect(lan) init rồi NetPrinter.connectPrinter(ip, port)', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect({ connectionType: ConnectionType.lan, lan: { ip: '10.0.0.5', port: 9100 } });
    expect(mod().ensureNativeInitialized).toHaveBeenCalledWith(ConnectionType.lan);
    expect(mod().NetPrinter.connectPrinter).toHaveBeenCalledWith('10.0.0.5', 9100);
  });

  it('printText(lan) đi qua ThermalPrinterAdapter.printTextAsync', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect({ connectionType: ConnectionType.lan, lan: { ip: '10.0.0.5', port: 9100 } });
    await adapter.printText('<C>hi</C>', { keepConnection: true, cut: true, tailingLine: true, encoding: 'UTF8' });
    expect(mod().ThermalPrinterAdapter.printTextAsync).toHaveBeenCalledWith(
      ConnectionType.lan,
      '<C>hi</C>',
      expect.objectContaining({ keepConnection: true }),
    );
  });

  it('write(bluetooth) base64 -> printRawDataBluetooth', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect({ connectionType: ConnectionType.bluetooth, bluetooth: { deviceId: 'AA:BB' } });
    await adapter.write(new Uint8Array([0x41, 0x42]));
    expect(mod().printRawDataBluetooth).toHaveBeenCalledWith('QUI=', true);
  });

  it('read() luôn null (native không đọc được)', async () => {
    await expect(new NativeAdapter().read(1000)).resolves.toBeNull();
  });

  it('connect(usb) thiếu target.usb -> VALIDATION_ERROR', async () => {
    await expect(new NativeAdapter().connect({ connectionType: ConnectionType.usb })).rejects.toMatchObject({
      code: PrinterErrorCode.VALIDATION_ERROR,
    });
  });

  it('disconnect(lan) gọi NetPrinter.closeConn', async () => {
    const adapter = new NativeAdapter();
    await adapter.connect({ connectionType: ConnectionType.lan, lan: { ip: '10.0.0.5', port: 9100 } });
    await adapter.disconnect();
    expect(mod().NetPrinter.closeConn).toHaveBeenCalled();
  });
});
