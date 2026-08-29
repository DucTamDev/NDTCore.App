jest.mock('../../vendor/thermal-receipt-printer', () => ({
  USBPrinter: { printText: jest.fn((_t: string, _o: unknown, cb?: () => void) => cb?.()) },
  BLEPrinter: { printText: jest.fn((_t: string, _o: unknown, cb?: () => void) => cb?.()) },
  NetPrinter: { printText: jest.fn((_t: string, _o: unknown, cb?: () => void) => cb?.()) },
}));

import { ThermalPrinterLibraryAdapter } from '../ThermalPrinterLibraryAdapter';
import { ConnectionType } from '../../types/printer.types';

describe('ThermalPrinterLibraryAdapter', () => {
  afterEach(() => jest.clearAllMocks());

  it('namespaceFor returns the namespace matching each connectionType', () => {
    const { USBPrinter, BLEPrinter, NetPrinter } = jest.requireMock(
      '../../vendor/thermal-receipt-printer',
    ) as Record<string, unknown>;
    expect(ThermalPrinterLibraryAdapter.namespaceFor(ConnectionType.usb)).toBe(USBPrinter);
    expect(ThermalPrinterLibraryAdapter.namespaceFor(ConnectionType.bluetooth)).toBe(BLEPrinter);
    expect(ThermalPrinterLibraryAdapter.namespaceFor(ConnectionType.lan)).toBe(NetPrinter);
  });

  it('printTextAsync resolves when the library calls the success callback', async () => {
    await expect(
      ThermalPrinterLibraryAdapter.printTextAsync(ConnectionType.lan, 'hello', {
        keepConnection: true,
        cut: true,
        tailingLine: true,
        encoding: 'UTF8',
      }),
    ).resolves.toBeUndefined();
  });

  it('printTextAsync rejects when the library calls the error callback', async () => {
    const { NetPrinter } = jest.requireMock('../../vendor/thermal-receipt-printer') as {
      NetPrinter: { printText: jest.Mock };
    };
    NetPrinter.printText.mockImplementationOnce(
      (_t: string, _o: unknown, _cb?: () => void, cbErr?: (e: Error) => void) => cbErr?.(new Error('boom')),
    );
    await expect(
      ThermalPrinterLibraryAdapter.printTextAsync(ConnectionType.lan, 'hello', {
        keepConnection: true,
        cut: true,
        tailingLine: true,
        encoding: 'UTF8',
      }),
    ).rejects.toThrow('boom');
  });
});
