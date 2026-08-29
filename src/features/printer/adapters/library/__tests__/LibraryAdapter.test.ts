import { LibraryAdapter } from '../LibraryAdapter';
import { ConnectionType } from '../../../types/printer.types';
import { PrinterErrorCode } from '../../../types/PrinterError';

jest.mock('../../../../../services/LoggerService', () => ({
  LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../transports/LanTransport', () => ({
  LanTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn(),
    readOnce: jest.fn().mockResolvedValue(new Uint8Array([0x7e])),
    close: jest.fn(),
  })),
}));
jest.mock('../../../transports/BluetoothTransport', () => ({
  BluetoothTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
    readOnce: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

const lanMock = () => jest.requireMock('../../../transports/LanTransport').LanTransport as jest.Mock;
const lastLan = () => lanMock().mock.results[lanMock().mock.results.length - 1].value;

describe('LibraryAdapter', () => {
  afterEach(() => jest.clearAllMocks());

  it('source là "library"', () => {
    expect(new LibraryAdapter().source).toBe('library');
  });

  it('connect(usb) -> PRINTER_UNSUPPORTED_CONNECTION', async () => {
    await expect(
      new LibraryAdapter().connect({ connectionType: ConnectionType.usb, usb: { vendorId: 1, productId: 2 } }),
    ).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION });
  });

  it('connect(lan) mở LanTransport với ip/port', async () => {
    const adapter = new LibraryAdapter();
    await adapter.connect({ connectionType: ConnectionType.lan, lan: { ip: '10.0.0.9', port: 9100 } });
    expect(lastLan().connect).toHaveBeenCalledWith('10.0.0.9', 9100);
  });

  it('write(lan) đẩy bytes vào LanTransport.write', async () => {
    const adapter = new LibraryAdapter();
    await adapter.connect({ connectionType: ConnectionType.lan, lan: { ip: '10.0.0.9', port: 9100 } });
    await adapter.write(new Uint8Array([1, 2, 3]));
    expect(lastLan().write).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
  });

  it('printText(lan) encode ESC/POS rồi write', async () => {
    const adapter = new LibraryAdapter();
    await adapter.connect({ connectionType: ConnectionType.lan, lan: { ip: '10.0.0.9', port: 9100 } });
    await adapter.printText('<C>hi</C>', { keepConnection: true, cut: true, tailingLine: true, encoding: 'UTF8' });
    expect(lastLan().write).toHaveBeenCalledTimes(1);
    const [payload] = lastLan().write.mock.calls[0];
    expect(payload).toBeInstanceOf(Uint8Array);
    expect((payload as Uint8Array).length).toBeGreaterThan(0);
  });

  it('read(lan) trả bytes từ LanTransport.readOnce', async () => {
    const adapter = new LibraryAdapter();
    await adapter.connect({ connectionType: ConnectionType.lan, lan: { ip: '10.0.0.9', port: 9100 } });
    await expect(adapter.read(500)).resolves.toEqual(new Uint8Array([0x7e]));
  });

  it('write trước connect -> PRINTER_NOT_CONNECTED', async () => {
    await expect(new LibraryAdapter().write(new Uint8Array([1]))).rejects.toMatchObject({
      code: PrinterErrorCode.PRINTER_NOT_CONNECTED,
    });
  });
});
