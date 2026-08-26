// src/features/printer/transports/UsbTransport.test.ts
import { UsbTransport } from '../UsbTransport';
import { AppErrorException } from '../../types/AppError';

jest.mock('../../adapters/UsbPrinterNativeAdapter', () => ({
  ensureUsbInitialized: jest.fn().mockResolvedValue(undefined),
  printRawDataUsb: jest.fn().mockResolvedValue(undefined),
}));

describe('UsbTransport.connect', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('initializes the shared USB native module before connecting', async () => {
    const { ensureUsbInitialized } = jest.requireMock('../../adapters/UsbPrinterNativeAdapter') as {
      ensureUsbInitialized: jest.Mock;
    };
    const transport = new UsbTransport();
    await transport.connect(1155, 22222);
    expect(ensureUsbInitialized).toHaveBeenCalled();
  });

  it('connects using vendor_id/product_id as numbers', async () => {
    const transport = new UsbTransport();
    await transport.connect(1155, 22222);
    const { USBPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      USBPrinter: { connectPrinter: jest.Mock };
    };
    expect(USBPrinter.connectPrinter).toHaveBeenCalledWith(1155, 22222);
  });

  it('wraps a native connect failure into CONNECTION_ERROR', async () => {
    const { USBPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      USBPrinter: { connectPrinter: jest.Mock };
    };
    USBPrinter.connectPrinter.mockRejectedValueOnce(new Error('device not found'));
    const transport = new UsbTransport();
    await expect(transport.connect(1155, 22222)).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
  });
});

describe('UsbTransport.write', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('base64-encodes the bytes and keeps the connection open', async () => {
    const { printRawDataUsb } = jest.requireMock('../../adapters/UsbPrinterNativeAdapter') as {
      printRawDataUsb: jest.Mock;
    };
    const transport = new UsbTransport();
    await transport.write(new Uint8Array([0x41, 0x42]));
    expect(printRawDataUsb).toHaveBeenCalledWith('QUI=', true);
  });

  it('wraps a native write failure into PRINT_ERROR', async () => {
    const { printRawDataUsb } = jest.requireMock('../../adapters/UsbPrinterNativeAdapter') as {
      printRawDataUsb: jest.Mock;
    };
    printRawDataUsb.mockRejectedValueOnce(new Error('USB print failed'));
    const transport = new UsbTransport();
    await expect(transport.write(new Uint8Array([0x41]))).rejects.toMatchObject({ code: 'PRINT_ERROR' });
  });

  it('rethrows as AppErrorException', async () => {
    const { printRawDataUsb } = jest.requireMock('../../adapters/UsbPrinterNativeAdapter') as {
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
    const { USBPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      USBPrinter: { closeConn: jest.Mock };
    };
    expect(USBPrinter.closeConn).toHaveBeenCalled();
  });

  it('wraps a native close failure into CONNECTION_ERROR instead of leaking a raw error', async () => {
    const { USBPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      USBPrinter: { closeConn: jest.Mock };
    };
    USBPrinter.closeConn.mockRejectedValueOnce(new Error('device already unplugged'));
    const transport = new UsbTransport();
    await expect(transport.close()).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
  });
});
