import { createMockUsbPrinterNativeAdapter, createMockThermalPrinterLibraryAdapter } from '../MockPrinterAdapter';
import { ConnectionType } from '../../types/printer.types';

describe('MockPrinterAdapter', () => {
  it('createMockUsbPrinterNativeAdapter resolves ensureUsbInitialized and printRawDataUsb', async () => {
    const mock = createMockUsbPrinterNativeAdapter();
    await expect(mock.ensureUsbInitialized()).resolves.toBeUndefined();
    await expect(mock.printRawDataUsb('AAAA', true)).resolves.toBeUndefined();
  });

  it('createMockThermalPrinterLibraryAdapter returns a namespace stub with init/getDeviceList/connectPrinter/closeConn', async () => {
    const mock = createMockThermalPrinterLibraryAdapter();
    const namespace = mock.namespaceFor(ConnectionType.lan);
    await expect(namespace.init()).resolves.toBeUndefined();
    await expect(namespace.getDeviceList()).resolves.toEqual([]);
    await expect(namespace.connectPrinter()).resolves.toEqual({ device_name: 'Mock' });
    await expect(namespace.closeConn()).resolves.toBeUndefined();
  });
});
