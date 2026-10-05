import { createPrinterAdapter } from '../PrinterAdapterFactory';
import { createPrinterAdapter as createWebPrinterAdapter } from '../PrinterAdapterFactory.web';
import { NativeAdapter } from '../../adapters/native/NativeAdapter';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { PrinterErrorCode } from '../../errors';

describe('createPrinterAdapter', () => {
  it('trên thiết bị luôn dùng NativeAdapter, mỗi lần một instance mới', () => {
    const first = createPrinterAdapter();

    expect(first).toBeInstanceOf(NativeAdapter);
    expect(createPrinterAdapter()).not.toBe(first);
  });

  it('trên web mọi thao tác với máy in báo PRINTER_UNSUPPORTED_CONNECTION', async () => {
    const adapter = createWebPrinterAdapter();
    const unsupported = { code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION };

    await expect(adapter.listDevices(ConnectionType.Usb)).rejects.toMatchObject(unsupported);
    await expect(adapter.connect({ type: ConnectionType.Lan, host: '1.1.1.1', port: 9100 })).rejects.toMatchObject(
      unsupported,
    );
    await expect(adapter.write(new Uint8Array([1]))).rejects.toMatchObject(unsupported);
    await expect(adapter.read(100)).resolves.toBeNull();
    await expect(adapter.disconnect()).resolves.toBeUndefined();
  });
});
