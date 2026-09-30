import { VendorAdapter } from '../VendorAdapter';
import { PrinterConnectionType } from '../../../models/printer/PrinterConnection';
import { PrinterErrorCode } from '../../../errors/PrinterError';

describe('VendorAdapter (skeleton)', () => {
  it('source là "vendor"', () => {
    expect(new VendorAdapter().source).toBe('vendor');
  });

  it('listDevices trả []', async () => {
    await expect(new VendorAdapter().listDevices(PrinterConnectionType.Lan)).resolves.toEqual([]);
  });

  it('connect / write / printText ném PRINTER_UNSUPPORTED_CONNECTION', async () => {
    const adapter = new VendorAdapter();
    await expect(adapter.connect({ printerId: 'p1', connectionType: PrinterConnectionType.Lan, lan: { ip: '1.1.1.1', port: 9100 } })).rejects.toMatchObject({
      code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION,
    });
    await expect(adapter.write(new Uint8Array([1]))).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION });
    await expect(
      adapter.printText('x', { cut: true, tailingLine: true, encoding: 'UTF8' }),
    ).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION });
  });

  it('read trả null, disconnect không ném', async () => {
    const adapter = new VendorAdapter();
    await expect(adapter.read(100)).resolves.toBeNull();
    await expect(adapter.disconnect()).resolves.toBeUndefined();
  });
});
