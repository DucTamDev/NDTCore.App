import { Buffer } from 'buffer';
import { UsbTransport } from '../UsbTransport';
import { AppErrorException, AppErrorCode } from '../../types/AppError';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

jest.mock('../../adapters/native/UsbPrinterNativeAdapter', () => ({
  ensureUsbInitialized: jest.fn().mockResolvedValue(undefined),
  printRawDataUsb: jest.fn().mockResolvedValue(undefined),
}));

describe('UsbTransport.connect', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('initializes the shared USB native module before connecting', async () => {
    const { ensureUsbInitialized } = jest.requireMock('../../adapters/native/UsbPrinterNativeAdapter') as {
      ensureUsbInitialized: jest.Mock;
    };
    const transport = new UsbTransport();
    await transport.connect(1155, 22222);
    expect(ensureUsbInitialized).toHaveBeenCalled();
  });

  it('connects using vendor_id/product_id as numbers', async () => {
    const transport = new UsbTransport();
    await transport.connect(1155, 22222);
    const { USBPrinter } = jest.requireMock('../../adapters/native/ThermalPrinterNativeModule') as {
      USBPrinter: { connectPrinter: jest.Mock };
    };
    expect(USBPrinter.connectPrinter).toHaveBeenCalledWith(1155, 22222);
  });

  it('wraps a native connect failure into PRINTER_CONNECTION_FAILED', async () => {
    const { USBPrinter } = jest.requireMock('../../adapters/native/ThermalPrinterNativeModule') as {
      USBPrinter: { connectPrinter: jest.Mock };
    };
    USBPrinter.connectPrinter.mockRejectedValueOnce(new Error('device not found'));
    const transport = new UsbTransport();
    await expect(transport.connect(1155, 22222)).rejects.toMatchObject({ code: AppErrorCode.PRINTER_CONNECTION_FAILED });
  });
});

describe('UsbTransport.write', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('base64-encodes the bytes and keeps the connection open', async () => {
    const { printRawDataUsb } = jest.requireMock('../../adapters/native/UsbPrinterNativeAdapter') as {
      printRawDataUsb: jest.Mock;
    };
    const transport = new UsbTransport();
    await transport.write(new Uint8Array([0x41, 0x42]));
    expect(printRawDataUsb).toHaveBeenCalledTimes(1);
    expect(printRawDataUsb).toHaveBeenCalledWith('QUI=', true);
  });

  it('splits a payload larger than 16KB into ≤16KB chunks (font DOWNLOAD case)', async () => {
    const { printRawDataUsb } = jest.requireMock('../../adapters/native/UsbPrinterNativeAdapter') as {
      printRawDataUsb: jest.Mock;
    };
    const transport = new UsbTransport();
    await transport.write(new Uint8Array(40 * 1024)); // ~font-sized
    expect(printRawDataUsb).toHaveBeenCalledTimes(3); // 16 + 16 + 8 KB
    for (const [, keepConnection] of printRawDataUsb.mock.calls) {
      expect(keepConnection).toBe(true);
    }
    // mỗi chunk decode ra ≤ 16KB
    for (const [b64] of printRawDataUsb.mock.calls) {
      expect(Buffer.from(b64 as string, 'base64').length).toBeLessThanOrEqual(16 * 1024);
    }
  });

  it('surfaces a mid-stream chunk failure as PRINTER_WRITE_FAILED', async () => {
    const { printRawDataUsb } = jest.requireMock('../../adapters/native/UsbPrinterNativeAdapter') as {
      printRawDataUsb: jest.Mock;
    };
    printRawDataUsb.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('USB print failed'));
    const transport = new UsbTransport();
    await expect(transport.write(new Uint8Array(20 * 1024))).rejects.toMatchObject({ code: AppErrorCode.PRINTER_WRITE_FAILED });
    expect(printRawDataUsb).toHaveBeenCalledTimes(2);
  });

  it('wraps a native write failure into PRINTER_WRITE_FAILED', async () => {
    const { printRawDataUsb } = jest.requireMock('../../adapters/native/UsbPrinterNativeAdapter') as {
      printRawDataUsb: jest.Mock;
    };
    printRawDataUsb.mockRejectedValueOnce(new Error('USB print failed'));
    const transport = new UsbTransport();
    await expect(transport.write(new Uint8Array([0x41]))).rejects.toMatchObject({ code: AppErrorCode.PRINTER_WRITE_FAILED });
  });

  it('rethrows as AppErrorException', async () => {
    const { printRawDataUsb } = jest.requireMock('../../adapters/native/UsbPrinterNativeAdapter') as {
      printRawDataUsb: jest.Mock;
    };
    printRawDataUsb.mockRejectedValueOnce(new Error('USB print failed'));
    const transport = new UsbTransport();
    await expect(transport.write(new Uint8Array([0x41]))).rejects.toBeInstanceOf(AppErrorException);
  });
});

describe('UsbTransport.close', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('closes the shared native USB connection', async () => {
    const transport = new UsbTransport();
    await transport.close();
    const { USBPrinter } = jest.requireMock('../../adapters/native/ThermalPrinterNativeModule') as {
      USBPrinter: { closeConn: jest.Mock };
    };
    expect(USBPrinter.closeConn).toHaveBeenCalled();
  });

  it('wraps a native close failure into PRINTER_CONNECTION_FAILED instead of leaking a raw error', async () => {
    const { USBPrinter } = jest.requireMock('../../adapters/native/ThermalPrinterNativeModule') as {
      USBPrinter: { closeConn: jest.Mock };
    };
    USBPrinter.closeConn.mockRejectedValueOnce(new Error('device already unplugged'));
    const transport = new UsbTransport();
    await expect(transport.close()).rejects.toMatchObject({ code: AppErrorCode.PRINTER_CONNECTION_FAILED });
  });
});
