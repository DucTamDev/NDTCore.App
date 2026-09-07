import { NativeModules } from 'react-native';
import { ConnectionType } from '../../../models/printer/PrinterDevice';

// `ThermalPrinterAdapter` sống trong cùng file với 3 namespace, nên không mock
// riêng namespace được — stub `NativeModules.ThermalPrinterModule` rồi lấy bản
// THẬT qua requireActual (bỏ qua mock toàn cục ở jest.setup.js).
const mkNativeModule = () => ({
  init: jest.fn().mockResolvedValue(null),
  getDeviceList: jest.fn().mockResolvedValue([]),
  connect: jest.fn().mockResolvedValue({}),
  disconnect: jest.fn().mockResolvedValue(null),
  writeByBase64: jest.fn().mockResolvedValue('Print SuccessFully'),
});

// Nhánh iOS trong BLEPrinter/NetPrinter.printText gọi thẳng
// NativeModules.RNBLEPrinter/RNNetPrinter (native iOS chưa implement — xem
// Global Constraints trong plan). Jest preset RN mặc định Platform.OS='ios'
// nên nhánh này chạy trong test dù app thật chạy Android — giữ stub tối
// thiểu để không throw, KHÔNG đụng tới vì ngoài phạm vi refactor (Android-only).
const mkLegacyIosStub = () => ({
  printRawData: jest.fn((_text: unknown, _opts: unknown, cbOk?: (m: string) => void) => cbOk?.('ok')),
});

const originals = {
  ThermalPrinterModule: NativeModules.ThermalPrinterModule,
  RNBLEPrinter: NativeModules.RNBLEPrinter,
  RNNetPrinter: NativeModules.RNNetPrinter,
};

beforeEach(() => {
  NativeModules.ThermalPrinterModule = mkNativeModule();
  NativeModules.RNBLEPrinter = mkLegacyIosStub();
  NativeModules.RNNetPrinter = mkLegacyIosStub();
});
afterEach(() => {
  Object.assign(NativeModules, originals);
  jest.resetModules();
});

const loadReal = () =>
  jest.requireActual('../PrinterNativeModule') as typeof import('../PrinterNativeModule');

describe('ThermalPrinterAdapter', () => {
  it('namespaceFor returns the namespace matching each connectionType', () => {
    const { ThermalPrinterAdapter, USBPrinter, BLEPrinter, NetPrinter } = loadReal();
    expect(ThermalPrinterAdapter.namespaceFor(ConnectionType.usb)).toBe(USBPrinter);
    expect(ThermalPrinterAdapter.namespaceFor(ConnectionType.bluetooth)).toBe(BLEPrinter);
    expect(ThermalPrinterAdapter.namespaceFor(ConnectionType.lan)).toBe(NetPrinter);
  });

  it('printTextAsync resolves when the native module invokes the success callback', async () => {
    const { ThermalPrinterAdapter } = loadReal();
    await expect(
      ThermalPrinterAdapter.printTextAsync(ConnectionType.lan, 'hello', {
        keepConnection: true,
        cut: true,
        tailingLine: true,
        encoding: 'UTF8',
      }),
    ).resolves.toBeUndefined();
  });

  it('printTextAsync rejects when the native module invokes the error callback', async () => {
    NativeModules.RNNetPrinter.printRawData = jest.fn(
      (_text: unknown, _opts: unknown, _cbOk?: () => void, cbErr?: (e: Error) => void) => cbErr?.(new Error('boom')),
    );
    const { ThermalPrinterAdapter } = loadReal();
    await expect(
      ThermalPrinterAdapter.printTextAsync(ConnectionType.lan, 'hello', {
        keepConnection: true,
        cut: true,
        tailingLine: true,
        encoding: 'UTF8',
      }),
    ).rejects.toThrow('boom');
  });
});

describe('ensureUsbInitialized', () => {
  it('gọi ThermalPrinterModule.init("usb") đúng 1 lần dù được gọi nhiều lần (memoize)', async () => {
    const { ensureUsbInitialized } = loadReal();
    await ensureUsbInitialized();
    await ensureUsbInitialized();
    expect(NativeModules.ThermalPrinterModule.init).toHaveBeenCalledTimes(1);
    expect(NativeModules.ThermalPrinterModule.init).toHaveBeenCalledWith('usb');
  });
});

describe('printRawDataUsb', () => {
  it('resolve khi native resolve thành công, gọi writeByBase64 (không phải printRawData)', async () => {
    const { printRawDataUsb } = loadReal();
    await expect(printRawDataUsb('QUI=', true)).resolves.toBe('Print SuccessFully');
    expect(NativeModules.ThermalPrinterModule.writeByBase64).toHaveBeenCalledWith('usb', 'QUI=', true);
  });

  it('reject với structured error (code + message) khi native reject', async () => {
    const rejection = Object.assign(new Error('USB fail'), { code: 'WRITE_FAILED' });
    NativeModules.ThermalPrinterModule.writeByBase64 = jest.fn().mockRejectedValue(rejection);
    const { printRawDataUsb } = loadReal();
    await expect(printRawDataUsb('QUI=', true)).rejects.toMatchObject({ code: 'WRITE_FAILED', message: 'USB fail' });
  });
});

describe('USBPrinter.connectPrinter', () => {
  it('gọi native connect (không phải connectPrinter) với đúng connection map', async () => {
    const { USBPrinter } = loadReal();
    await USBPrinter.connectPrinter(1234, 5678);
    expect(NativeModules.ThermalPrinterModule.connect).toHaveBeenCalledWith({
      type: 'usb',
      vendorId: 1234,
      productId: 5678,
    });
  });
});

describe('USBPrinter.closeConn', () => {
  it('gọi native disconnect (không phải closeConn)', async () => {
    const { USBPrinter } = loadReal();
    await USBPrinter.closeConn();
    expect(NativeModules.ThermalPrinterModule.disconnect).toHaveBeenCalledWith('usb');
  });
});
