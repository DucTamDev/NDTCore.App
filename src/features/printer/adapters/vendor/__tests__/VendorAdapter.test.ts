import { VendorAdapter } from '../VendorAdapter';
import { ConnectionType } from '../../../models/printer/ConnectionType';
import { PrinterErrorCode } from '../../../errors/PrinterErrorCode';

describe('VendorAdapter (khung)', () => {
  it('source là "vendor" và không đọc được phản hồi', () => {
    const adapter = new VendorAdapter();
    expect(adapter.source).toBe('vendor');
    expect(adapter.canRead).toBe(false);
  });

  it('listDevices trả []', async () => {
    await expect(new VendorAdapter().listDevices(ConnectionType.Lan)).resolves.toEqual([]);
  });

  it('connect và write ném PRINTER_UNSUPPORTED_CONNECTION', async () => {
    const adapter = new VendorAdapter();
    const unsupported = { code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION };

    await expect(adapter.connect({ type: ConnectionType.Lan, host: '1.1.1.1', port: 9100 })).rejects.toMatchObject(
      unsupported,
    );
    await expect(adapter.write(new Uint8Array([1]))).rejects.toMatchObject(unsupported);
  });

  it('read trả null, onLost trả hàm huỷ rỗng, disconnect không ném', async () => {
    const adapter = new VendorAdapter();
    await expect(adapter.read(100)).resolves.toBeNull();
    expect(() => adapter.onLost(jest.fn())()).not.toThrow();
    await expect(adapter.disconnect()).resolves.toBeUndefined();
  });
});
