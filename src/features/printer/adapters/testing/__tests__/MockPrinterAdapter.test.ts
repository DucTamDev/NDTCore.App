import { createMockUsbPrinterNativeBridge, createMockThermalPrinterAdapter } from '../MockPrinterAdapter';
import { ConnectionType } from '../../../models/printer/PrinterDevice';

describe('MockPrinterAdapter', () => {
  it('createMockUsbPrinterNativeBridge resolves ensureUsbInitialized and printRawDataUsb', async () => {
    const mock = createMockUsbPrinterNativeBridge();
    await expect(mock.ensureUsbInitialized()).resolves.toBeUndefined();
    await expect(mock.printRawDataUsb('AAAA', true)).resolves.toBeUndefined();
  });

  it('createMockThermalPrinterAdapter returns a namespace stub with init/getDeviceList/connectPrinter/closeConn', async () => {
    const mock = createMockThermalPrinterAdapter();
    const namespace = mock.namespaceFor(ConnectionType.lan);
    await expect(namespace.init()).resolves.toBeUndefined();
    await expect(namespace.getDeviceList()).resolves.toEqual([]);
    await expect(namespace.connectPrinter()).resolves.toEqual({ device_name: 'Mock' });
    await expect(namespace.closeConn()).resolves.toBeUndefined();
  });
});
