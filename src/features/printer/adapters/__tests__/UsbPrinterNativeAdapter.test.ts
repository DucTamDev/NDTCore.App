import { NativeModules } from 'react-native';
import { ensureUsbInitialized, printRawDataUsb } from '../UsbPrinterNativeAdapter';

describe('ensureUsbInitialized', () => {
  it('calls USBPrinter.init() only once even when called multiple times', async () => {
    const { USBPrinter } = jest.requireMock('../../vendor/thermal-receipt-printer') as {
      USBPrinter: { init: jest.Mock };
    };
    const callsBefore = USBPrinter.init.mock.calls.length;

    await ensureUsbInitialized();
    await ensureUsbInitialized();

    expect(USBPrinter.init.mock.calls.length).toBe(callsBefore + 1);
  });
});

describe('printRawDataUsb', () => {
  const originalRNUSBPrinter = NativeModules.RNUSBPrinter;

  afterEach(() => {
    NativeModules.RNUSBPrinter = originalRNUSBPrinter;
  });

  it('resolves when the native module invokes the success callback', async () => {
    NativeModules.RNUSBPrinter = {
      printRawData: jest.fn((_data: string, _keepConnection: boolean, cbSuccess: () => void) => cbSuccess()),
    };

    await expect(printRawDataUsb('AAAA', true)).resolves.toBeUndefined();
    expect(NativeModules.RNUSBPrinter.printRawData).toHaveBeenCalledWith('AAAA', true, expect.any(Function), expect.any(Function));
  });

  it('rejects when the native module invokes the error callback', async () => {
    NativeModules.RNUSBPrinter = {
      printRawData: jest.fn(
        (_data: string, _keepConnection: boolean, _cbSuccess: () => void, cbErr: (error: Error) => void) =>
          cbErr(new Error('USB print failed')),
      ),
    };

    await expect(printRawDataUsb('AAAA', true)).rejects.toThrow('USB print failed');
  });
});
