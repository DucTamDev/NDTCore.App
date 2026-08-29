jest.mock('../ThermalPrinterNativeModule', () => ({
  USBPrinter: { printText: jest.fn((_t: string, _o: unknown, cb?: () => void) => cb?.()) },
  BLEPrinter: { printText: jest.fn((_t: string, _o: unknown, cb?: () => void) => cb?.()) },
  NetPrinter: { printText: jest.fn((_t: string, _o: unknown, cb?: () => void) => cb?.()) },
}));

import { ThermalPrinterAdapter } from '../ThermalPrinterAdapter';
import { ConnectionType } from '../../../types/printer.types';

describe('ThermalPrinterAdapter', () => {
  afterEach(() => jest.clearAllMocks());

  it('namespaceFor returns the namespace matching each connectionType', () => {
    const { USBPrinter, BLEPrinter, NetPrinter } = jest.requireMock(
      '../ThermalPrinterNativeModule',
    ) as Record<string, unknown>;
    expect(ThermalPrinterAdapter.namespaceFor(ConnectionType.usb)).toBe(USBPrinter);
    expect(ThermalPrinterAdapter.namespaceFor(ConnectionType.bluetooth)).toBe(BLEPrinter);
    expect(ThermalPrinterAdapter.namespaceFor(ConnectionType.lan)).toBe(NetPrinter);
  });

  it('printTextAsync resolves when the library calls the success callback', async () => {
    await expect(
      ThermalPrinterAdapter.printTextAsync(ConnectionType.lan, 'hello', {
        keepConnection: true,
        cut: true,
        tailingLine: true,
        encoding: 'UTF8',
      }),
    ).resolves.toBeUndefined();
  });

  it('printTextAsync rejects when the library calls the error callback', async () => {
    const { NetPrinter } = jest.requireMock('../ThermalPrinterNativeModule') as {
      NetPrinter: { printText: jest.Mock };
    };
    NetPrinter.printText.mockImplementationOnce(
      (_t: string, _o: unknown, _cb?: () => void, cbErr?: (e: Error) => void) => cbErr?.(new Error('boom')),
    );
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
