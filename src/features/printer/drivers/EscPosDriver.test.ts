// src/features/printer/drivers/EscPosDriver.test.ts
import { EscPosDriver } from './EscPosDriver';
import type { PrinterConfig } from '../types/printer.types';
import type { PrintDocument } from '../types/printDocument.types';

jest.mock('react-native-esc-pos-printer', () => {
  const printerInstance = {
    deviceName: '',
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    addText: jest.fn().mockResolvedValue(undefined),
    addImage: jest.fn().mockResolvedValue(undefined),
    addBarcode: jest.fn().mockResolvedValue(undefined),
    addSymbol: jest.fn().mockResolvedValue(undefined),
    addFeedLine: jest.fn().mockResolvedValue(undefined),
    addCut: jest.fn().mockResolvedValue(undefined),
    sendData: jest.fn().mockResolvedValue({}),
    getStatus: jest.fn().mockResolvedValue({}),
  };

  const discoveryListeners: Array<(printers: unknown[]) => void> = [];

  const PrintersDiscovery = {
    start: jest.fn().mockImplementation(async () => {
      discoveryListeners.forEach((listener) =>
        listener([
          {
            deviceType: 'TYPE_PRINTER',
            target: 'TCP:192.168.1.10',
            deviceName: 'TM-T82',
            ipAddress: '192.168.1.10',
            macAddress: '',
            bdAddress: '',
          },
        ])
      );
    }),
    stop: jest.fn().mockResolvedValue(undefined),
    onDiscovery: jest.fn().mockImplementation((listener: (printers: unknown[]) => void) => {
      discoveryListeners.push(listener);
      return () => {
        const index = discoveryListeners.indexOf(listener);
        if (index >= 0) discoveryListeners.splice(index, 1);
      };
    }),
    onError: jest.fn().mockImplementation(() => () => undefined),
  };

  return {
    Printer: jest.fn().mockImplementation((params: { deviceName?: string }) => {
      printerInstance.deviceName = params?.deviceName ?? '';
      return printerInstance;
    }),
    PrintersDiscovery,
    DiscoveryPortType: {
      PORTTYPE_ALL: 0,
      PORTTYPE_TCP: 1,
      PORTTYPE_BLUETOOTH: 2,
      PORTTYPE_USB: 3,
      PORTTYPE_BLUETOOTH_LE: 4,
    },
    BarcodeType: {
      BARCODE_CODE128: 'BARCODE_CODE128',
    },
    SymbolType: {
      SYMBOL_QRCODE_MODEL_2: 'SYMBOL_QRCODE_MODEL_2',
    },
  };
});

const receiptConfig: PrinterConfig = {
  id: 'receipt-1',
  printerName: 'Máy in hóa đơn quầy 1',
  protocol: 'escpos',
  protocolSource: 'auto',
  connectionType: 'lan',
  paperSize: '80mm',
  autoReconnect: true,
  isDefault: true,
  lan: { ip: '192.168.1.10', port: 9100 },
};

describe('EscPosDriver', () => {
  it('connect() transitions idle -> connecting -> connected', async () => {
    const driver = new EscPosDriver();
    const statuses: string[] = [];
    driver.onStatusChange(receiptConfig.id, (status) => statuses.push(status));
    await driver.connect(receiptConfig);
    expect(statuses).toEqual(['connecting', 'connected']);
  });

  it('disconnect() transitions to disconnected', async () => {
    const driver = new EscPosDriver();
    await driver.connect(receiptConfig);
    await driver.disconnect(receiptConfig.id);
    expect(driver.getStatus(receiptConfig.id)).toBe('disconnected');
  });

  it('testPrint() connects then prints without throwing', async () => {
    const driver = new EscPosDriver();
    await expect(driver.testPrint(receiptConfig)).resolves.toBeUndefined();
  });

  it('scan() reports found devices from PrintersDiscovery.onDiscovery', (done) => {
    const driver = new EscPosDriver();
    driver.scan('lan', (event) => {
      if (event.type === 'found') {
        expect(event.devices?.[0].displayName).toBe('TM-T82');
        done();
      }
    });
  });

  it('identify() returns null when not connected', async () => {
    const driver = new EscPosDriver();
    const result = await driver.identify('never-connected');
    expect(result).toBeNull();
  });

  it('identify() returns the printer deviceName when getStatus() resolves', async () => {
    const driver = new EscPosDriver();
    await driver.connect(receiptConfig);
    const result = await driver.identify(receiptConfig.id);
    expect(result).toEqual({ deviceName: receiptConfig.printerName });
  });

  it('identify() returns null when getStatus() rejects', async () => {
    const { Printer } = jest.requireMock('react-native-esc-pos-printer') as { Printer: jest.Mock };
    Printer.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockRejectedValue(new Error('no response')),
    }));
    const driver = new EscPosDriver();
    await driver.connect(receiptConfig);
    const result = await driver.identify(receiptConfig.id);
    expect(result).toBeNull();
  });

  it('print() calls the matching add* method for each element kind, then feed/cut/send once', async () => {
    const { Printer } = jest.requireMock('react-native-esc-pos-printer') as { Printer: jest.Mock };
    const driver = new EscPosDriver();
    await driver.connect(receiptConfig);
    const printerInstance = Printer.mock.results[Printer.mock.results.length - 1].value as {
      addText: jest.Mock;
      addImage: jest.Mock;
      addBarcode: jest.Mock;
      addSymbol: jest.Mock;
      addFeedLine: jest.Mock;
      addCut: jest.Mock;
      sendData: jest.Mock;
    };
    // File này không có `beforeEach`/`clearMocks` toàn cục và mock `Printer`
    // luôn trả về cùng 1 `printerInstance` — clear số lần gọi trước khi test
    // `print()` để không bị cộng dồn lượt gọi từ các test trước (vd. `testPrint()`).
    // (This file has no global `beforeEach`/`clearMocks`, and the mocked `Printer`
    // always returns the same `printerInstance` — clear call counts before
    // exercising `print()` so we don't inherit calls from earlier tests, e.g. `testPrint()`.)
    printerInstance.addText.mockClear();
    printerInstance.addImage.mockClear();
    printerInstance.addBarcode.mockClear();
    printerInstance.addSymbol.mockClear();
    printerInstance.addFeedLine.mockClear();
    printerInstance.addCut.mockClear();
    printerInstance.sendData.mockClear();
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'line', x: 0, y: 10 },
        { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
        { type: 'image', data: 'https://example.com/logo.png', x: 0, y: 40 },
        { type: 'barcode', content: '123', x: 0, y: 60 },
        { type: 'qrCode', content: 'https://x', x: 0, y: 80 },
      ],
    };

    await driver.print(receiptConfig.id, document);

    expect(printerInstance.addText).toHaveBeenCalled();
    expect(printerInstance.addImage).toHaveBeenCalledWith(
      expect.objectContaining({ source: { uri: 'https://example.com/logo.png' } })
    );
    expect(printerInstance.addBarcode).toHaveBeenCalledWith(expect.objectContaining({ data: '123' }));
    expect(printerInstance.addSymbol).toHaveBeenCalledWith(expect.objectContaining({ data: 'https://x' }));
    expect(printerInstance.addFeedLine).toHaveBeenCalledTimes(1);
    expect(printerInstance.addCut).toHaveBeenCalledTimes(1);
    expect(printerInstance.sendData).toHaveBeenCalledTimes(1);
  });

  it('print() throws CONNECTION_ERROR when the printer is not connected', async () => {
    const driver = new EscPosDriver();
    const document: PrintDocument = { elements: [] };
    await expect(driver.print('never-connected', document)).rejects.toThrow();
  });
});
