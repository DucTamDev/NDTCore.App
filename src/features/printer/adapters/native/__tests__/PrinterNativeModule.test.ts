import { NativeModules } from 'react-native';
import { ConnectionType } from '../../../models/printer/PrinterDevice';

// `ThermalPrinterAdapter` sống trong cùng file với 3 namespace, nên không mock
// riêng namespace được — stub `NativeModules.ThermalPrinterModule` rồi lấy bản
// THẬT qua requireActual (bỏ qua mock toàn cục ở jest.setup.js).
const mkNativeModule = () => ({
  init: jest.fn((_connectionType: string, cbOk: () => void) => cbOk()),
  getDeviceList: jest.fn((_connectionType: string, cbOk: (d: unknown[]) => void) => cbOk([])),
  connectPrinter: jest.fn(),
  closeConn: jest.fn(),
  printRawData: jest.fn(
    (_connectionType: string, _data: unknown, _keep: unknown, cbOk?: (m: string) => void) => cbOk?.('ok'),
  ),
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
  it('gọi ThermalPrinterModule.init("usb", ...) đúng 1 lần dù được gọi nhiều lần (memoize)', async () => {
    const { ensureUsbInitialized } = loadReal();
    await ensureUsbInitialized();
    await ensureUsbInitialized();
    expect(NativeModules.ThermalPrinterModule.init).toHaveBeenCalledTimes(1);
    expect(NativeModules.ThermalPrinterModule.init).toHaveBeenCalledWith('usb', expect.any(Function), expect.any(Function));
  });
});

describe('printRawDataUsb', () => {
  it('resolve khi native gọi success callback', async () => {
    const { printRawDataUsb } = loadReal();
    await expect(printRawDataUsb('QUI=', true)).resolves.toBeUndefined();
    expect(NativeModules.ThermalPrinterModule.printRawData).toHaveBeenCalledWith(
      'usb',
      'QUI=',
      true,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('reject khi native gọi error callback', async () => {
    NativeModules.ThermalPrinterModule.printRawData = jest.fn(
      (_connectionType: string, _data: unknown, _keep: unknown, _cbOk?: () => void, cbErr?: (e: Error) => void) =>
        cbErr?.(new Error('USB fail')),
    );
    const { printRawDataUsb } = loadReal();
    await expect(printRawDataUsb('QUI=', true)).rejects.toThrow('USB fail');
  });
});
