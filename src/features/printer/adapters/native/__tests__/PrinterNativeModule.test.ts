import { NativeModules } from 'react-native';
import { ConnectionType } from '../../../models/printer/PrinterDevice';

// `ThermalPrinterAdapter` sống trong cùng file với 3 namespace, nên không mock
// riêng namespace được — stub `NativeModules.RN*Printer` rồi lấy bản THẬT qua
// requireActual (bỏ qua mock toàn cục ở jest.setup.js).
const mkNative = () => ({
  init: jest.fn((cbOk: () => void) => cbOk()),
  getDeviceList: jest.fn((cbOk: (d: unknown[]) => void) => cbOk([])),
  connectPrinter: jest.fn(),
  closeConn: jest.fn(),
  printRawData: jest.fn((_data: unknown, _keep: unknown, cbOk?: (m: string) => void) => cbOk?.('ok')),
});

const originals = {
  RNUSBPrinter: NativeModules.RNUSBPrinter,
  RNBLEPrinter: NativeModules.RNBLEPrinter,
  RNNetPrinter: NativeModules.RNNetPrinter,
};

beforeEach(() => {
  NativeModules.RNUSBPrinter = mkNative();
  NativeModules.RNBLEPrinter = mkNative();
  NativeModules.RNNetPrinter = mkNative();
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
      (_data: unknown, _keep: unknown, _cbOk?: () => void, cbErr?: (e: Error) => void) => cbErr?.(new Error('boom')),
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
  it('gọi RNUSBPrinter.init() đúng 1 lần dù được gọi nhiều lần (memoize)', async () => {
    const { ensureUsbInitialized } = loadReal();
    await ensureUsbInitialized();
    await ensureUsbInitialized();
    expect(NativeModules.RNUSBPrinter.init).toHaveBeenCalledTimes(1);
  });
});

describe('printRawDataUsb', () => {
  it('resolve khi native gọi success callback', async () => {
    const { printRawDataUsb } = loadReal();
    await expect(printRawDataUsb('QUI=', true)).resolves.toBeUndefined();
    expect(NativeModules.RNUSBPrinter.printRawData).toHaveBeenCalledWith(
      'QUI=',
      true,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('reject khi native gọi error callback', async () => {
    NativeModules.RNUSBPrinter.printRawData = jest.fn(
      (_data: unknown, _keep: unknown, _cbOk?: () => void, cbErr?: (e: Error) => void) => cbErr?.(new Error('USB fail')),
    );
    const { printRawDataUsb } = loadReal();
    await expect(printRawDataUsb('QUI=', true)).rejects.toThrow('USB fail');
  });
});
