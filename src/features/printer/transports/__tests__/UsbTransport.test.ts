import { Buffer } from 'buffer';
import { UsbTransport } from '../UsbTransport';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

// `ThermalPrinterModule` từ `PrinterNativeModule` (đã mock toàn cục ở jest.setup.js).

describe('UsbTransport.connect', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('connects using printerId + vendor_id/product_id as numbers', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { connect: jest.Mock };
    };
    const transport = new UsbTransport();
    await transport.connect('p1', 1155, 22222);
    expect(ThermalPrinterModule.connect).toHaveBeenCalledWith({ printerId: 'p1', type: 'usb', vendorId: 1155, productId: 22222 });
  });

  it('wraps a native connect failure into PRINTER_CONNECTION_FAILED', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { connect: jest.Mock };
    };
    ThermalPrinterModule.connect.mockRejectedValueOnce(new Error('device not found'));
    const transport = new UsbTransport();
    await expect(transport.connect('p1', 1155, 22222)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
  });
});

describe('UsbTransport.write', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('base64-encodes the bytes and writes via the connected printerId', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { writeByBase64: jest.Mock };
    };
    const transport = new UsbTransport();
    await transport.connect('p1', 1155, 22222);
    await transport.write(new Uint8Array([0x41, 0x42]));
    expect(ThermalPrinterModule.writeByBase64).toHaveBeenCalledTimes(1);
    expect(ThermalPrinterModule.writeByBase64).toHaveBeenCalledWith('p1', 'QUI=');
  });

  it('splits a payload larger than 16KB into ≤16KB chunks (font DOWNLOAD case)', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { writeByBase64: jest.Mock };
    };
    const transport = new UsbTransport();
    await transport.connect('p1', 1155, 22222);
    await transport.write(new Uint8Array(40 * 1024)); // ~font-sized
    expect(ThermalPrinterModule.writeByBase64).toHaveBeenCalledTimes(3); // 16 + 16 + 8 KB
    for (const [printerId] of ThermalPrinterModule.writeByBase64.mock.calls) {
      expect(printerId).toBe('p1');
    }
    // mỗi chunk decode ra ≤ 16KB
    for (const [, b64] of ThermalPrinterModule.writeByBase64.mock.calls) {
      expect(Buffer.from(b64 as string, 'base64').length).toBeLessThanOrEqual(16 * 1024);
    }
  });

  it('surfaces a mid-stream chunk failure as PRINTER_WRITE_FAILED', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { writeByBase64: jest.Mock };
    };
    ThermalPrinterModule.writeByBase64.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('USB print failed'));
    const transport = new UsbTransport();
    await transport.connect('p1', 1155, 22222);
    await expect(transport.write(new Uint8Array(20 * 1024))).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_WRITE_FAILED });
    expect(ThermalPrinterModule.writeByBase64).toHaveBeenCalledTimes(2);
  });

  it('wraps a native write failure into PRINTER_WRITE_FAILED', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { writeByBase64: jest.Mock };
    };
    ThermalPrinterModule.writeByBase64.mockRejectedValueOnce(new Error('USB print failed'));
    const transport = new UsbTransport();
    await transport.connect('p1', 1155, 22222);
    await expect(transport.write(new Uint8Array([0x41]))).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_WRITE_FAILED });
  });

  it('rethrows as PrinterErrorException', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { writeByBase64: jest.Mock };
    };
    ThermalPrinterModule.writeByBase64.mockRejectedValueOnce(new Error('USB print failed'));
    const transport = new UsbTransport();
    await transport.connect('p1', 1155, 22222);
    await expect(transport.write(new Uint8Array([0x41]))).rejects.toBeInstanceOf(PrinterErrorException);
  });

  it('throws PRINTER_NOT_CONNECTED when writing before connect()', async () => {
    const transport = new UsbTransport();
    await expect(transport.write(new Uint8Array([0x41]))).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED });
  });
});

describe('UsbTransport.close', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('closes the native connection for the connected printerId', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { disconnect: jest.Mock };
    };
    const transport = new UsbTransport();
    await transport.connect('p1', 1155, 22222);
    await transport.close();
    expect(ThermalPrinterModule.disconnect).toHaveBeenCalledWith('p1');
  });

  it('wraps a native close failure into PRINTER_CONNECTION_FAILED instead of leaking a raw error', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { disconnect: jest.Mock };
    };
    ThermalPrinterModule.disconnect.mockRejectedValueOnce(new Error('device already unplugged'));
    const transport = new UsbTransport();
    await transport.connect('p1', 1155, 22222);
    await expect(transport.close()).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
  });

  it('is a no-op when closed before connect()', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { disconnect: jest.Mock };
    };
    const transport = new UsbTransport();
    await expect(transport.close()).resolves.toBeUndefined();
    expect(ThermalPrinterModule.disconnect).not.toHaveBeenCalled();
  });
});
