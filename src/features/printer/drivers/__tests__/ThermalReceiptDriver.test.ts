import { ThermalReceiptDriver } from '../ThermalReceiptDriver';
import type { PrinterConfig } from '../../types/printer.types';
import type { PrintDocument } from '../../types/printDocument.types';

// The library's real dist/index.d.ts (inspected after `npm install`) differs
// from README-only assumptions: `connectPrinter()` takes positional args
// specific to each namespace (not a shared `{host, port}`-style object), and
// `printText()` is callback-based (`cbSuccess`/`cbErr`), not Promise-returning.
// Mocks below reflect the real shapes.
jest.mock('@poriyaalar/react-native-thermal-receipt-printer', () => ({
  USBPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'USB', vendor_id: '1155', product_id: '22222' }),
    printText: jest.fn((_text: string, _opts: { keepConnection?: boolean; cut?: boolean; tailingLine?: boolean }, cbSuccess?: (msg: string) => void) => cbSuccess?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
  BLEPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'BLE', inner_mac_address: '00:11:22:33:44:55' }),
    printText: jest.fn((_text: string, _opts: { keepConnection?: boolean; cut?: boolean; tailingLine?: boolean }, cbSuccess?: (msg: string) => void) => cbSuccess?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
  NetPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'Net', host: '192.168.1.50', port: 9100 }),
    printText: jest.fn((_text: string, _opts: { keepConnection?: boolean; cut?: boolean; tailingLine?: boolean }, cbSuccess?: (msg: string) => void) => cbSuccess?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../services/PrinterLogger', () => ({
  PrinterLogger: {
    scanCompleted: jest.fn(),
    scanFailed: jest.fn(),
    connectSucceeded: jest.fn(),
    connectFailed: jest.fn(),
    disconnectSucceeded: jest.fn(),
    testPrintSucceeded: jest.fn(),
    testPrintFailed: jest.fn(),
    printSucceeded: jest.fn(),
    printFailed: jest.fn(),
  },
}));

const lanConfig: PrinterConfig = {
  id: 'receipt-lan',
  printerName: 'Máy in hoá đơn',
  protocol: 'escpos',
  protocolSource: 'auto',
  connectionType: 'lan',
  paperSize: '80mm',
  autoReconnect: false,
  isDefault: false,
  lan: { ip: '192.168.1.50', port: 9100 },
};

const bleConfig: PrinterConfig = {
  ...lanConfig,
  id: 'receipt-ble',
  connectionType: 'bluetooth',
  lan: undefined,
  device: { deviceId: '00:11:22:33:44:55', displayName: 'Máy in BLE', rawDevice: {} },
};

const usbConfig: PrinterConfig = {
  ...lanConfig,
  id: 'receipt-usb',
  connectionType: 'usb',
  lan: undefined,
  device: { deviceId: '1155:22222', displayName: 'Máy in USB', rawDevice: { vendor_id: 1155, product_id: 22222 } },
};

describe('ThermalReceiptDriver', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('connect() over LAN transitions status idle -> connecting -> connected', async () => {
    const driver = new ThermalReceiptDriver();
    const statuses: string[] = [];
    driver.onStatusChange(lanConfig.id, (status) => statuses.push(status));
    expect(driver.getStatus(lanConfig.id)).toBe('idle');
    await driver.connect(lanConfig);
    expect(statuses).toEqual(['connecting', 'connected']);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { connectPrinter: jest.Mock };
    };
    expect(NetPrinter.connectPrinter).toHaveBeenCalledWith('192.168.1.50', 9100);
  });

  it('connect() over Bluetooth checks permission and connects with the device MAC address', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(bleConfig);
    const { ensureBluetoothPermission } = jest.requireMock('../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    const { BLEPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      BLEPrinter: { connectPrinter: jest.Mock };
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(BLEPrinter.connectPrinter).toHaveBeenCalledWith('00:11:22:33:44:55');
    expect(driver.getStatus(bleConfig.id)).toBe('connected');
  });

  it('connect() over Bluetooth fails with CONNECTION_ERROR when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new ThermalReceiptDriver();
    await expect(driver.connect(bleConfig)).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
    expect(driver.getStatus(bleConfig.id)).toBe('error');
  });

  it('connect() over USB reads vendor_id/product_id from the scanned rawDevice as numbers', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(usbConfig);
    const { USBPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      USBPrinter: { connectPrinter: jest.Mock };
    };
    expect(USBPrinter.connectPrinter).toHaveBeenCalledWith(1155, 22222);
  });

  it('disconnect() closes the connection and sets status disconnected', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    await driver.disconnect(lanConfig.id);
    expect(driver.getStatus(lanConfig.id)).toBe('disconnected');
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { closeConn: jest.Mock };
    };
    expect(NetPrinter.closeConn).toHaveBeenCalled();
  });

  it('scan("lan") reports empty immediately without calling the library', () => {
    const driver = new ThermalReceiptDriver();
    const events: string[] = [];
    driver.scan('lan', (event) => events.push(event.type));
    expect(events).toEqual(['empty']);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { getDeviceList: jest.Mock };
    };
    expect(NetPrinter.getDeviceList).not.toHaveBeenCalled();
  });

  it('scan("bluetooth") checks permission before calling BLEPrinter.getDeviceList', async () => {
    const driver = new ThermalReceiptDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type !== 'loading') resolve();
      });
    });
    expect(events).toEqual(['loading', 'empty']);
    const { BLEPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      BLEPrinter: { getDeviceList: jest.Mock };
    };
    expect(BLEPrinter.getDeviceList).toHaveBeenCalled();
  });

  it('scan("bluetooth") emits an error event when ensureBluetoothPermission itself rejects', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockRejectedValueOnce(new Error('permission check failed'));
    const driver = new ThermalReceiptDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type !== 'loading') resolve();
      });
    });
    expect(events).toEqual(['loading', 'error']);
  });

  it('scan("bluetooth") emits empty (not error) when getDeviceList rejects with "No Device Found"', async () => {
    const { BLEPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      BLEPrinter: { getDeviceList: jest.Mock };
    };
    BLEPrinter.getDeviceList.mockRejectedValueOnce('No Device Found');
    const driver = new ThermalReceiptDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type !== 'loading') resolve();
      });
    });
    expect(events).toEqual(['loading', 'empty']);
  });

  it('testPrint() reuses an already-open connection instead of reconnecting', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { connectPrinter: jest.Mock; printText: jest.Mock };
    };
    const callsBeforeTestPrint = NetPrinter.connectPrinter.mock.calls.length;
    await driver.testPrint(lanConfig);
    expect(NetPrinter.connectPrinter.mock.calls.length).toBe(callsBeforeTestPrint);
    expect(NetPrinter.printText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ keepConnection: true, cut: true, tailingLine: true }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('identify() returns null when not connected', async () => {
    const driver = new ThermalReceiptDriver();
    const result = await driver.identify('never-connected');
    expect(result).toBeNull();
  });

  it('identify() returns a non-null PrinterDeviceInfo when connected', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const result = await driver.identify(lanConfig.id);
    expect(result).toEqual({ deviceName: 'Net' });
  });

  it('connecting printer B on the same connectionType as already-connected printer A flips A to disconnected', async () => {
    const driver = new ThermalReceiptDriver();
    const printerA: PrinterConfig = { ...lanConfig, id: 'receipt-lan-a', lan: { ip: '192.168.1.50', port: 9100 } };
    const printerB: PrinterConfig = { ...lanConfig, id: 'receipt-lan-b', lan: { ip: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    expect(driver.getStatus(printerA.id)).toBe('connected');

    await driver.connect(printerB);
    expect(driver.getStatus(printerA.id)).toBe('disconnected');
    expect(driver.getStatus(printerB.id)).toBe('connected');
  });

  it('does not flip printer A to disconnected when connecting printer B on the same connectionType fails validation', async () => {
    const driver = new ThermalReceiptDriver();
    const printerA: PrinterConfig = { ...lanConfig, id: 'receipt-lan-a', lan: { ip: '192.168.1.50', port: 9100 } };
    const printerBInvalid: PrinterConfig = { ...lanConfig, id: 'receipt-lan-b', lan: undefined };

    await driver.connect(printerA);
    expect(driver.getStatus(printerA.id)).toBe('connected');

    await expect(driver.connect(printerBInvalid)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    // printer A must still be reported as connected — the failed attempt on B
    // never touched the native connection, so A's real state is unchanged.
    expect(driver.getStatus(printerA.id)).toBe('connected');
  });

  it('testPrint() reconnects instead of taking the stale fast path when another printer has taken over the shared connection', async () => {
    const driver = new ThermalReceiptDriver();
    const printerA: PrinterConfig = { ...lanConfig, id: 'receipt-lan-a', lan: { ip: '192.168.1.50', port: 9100 } };
    const printerB: PrinterConfig = { ...lanConfig, id: 'receipt-lan-b', lan: { ip: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    await driver.connect(printerB);

    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { connectPrinter: jest.Mock };
    };
    const callsBeforeTestPrint = NetPrinter.connectPrinter.mock.calls.length;
    await driver.testPrint(printerA);
    expect(NetPrinter.connectPrinter.mock.calls.length).toBe(callsBeforeTestPrint + 1);
    expect(driver.getStatus(printerA.id)).toBe('connected');
  });

  it('connect() logs connectSucceeded on success', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { PrinterLogger } = jest.requireMock('../../services/PrinterLogger') as {
      PrinterLogger: { connectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.connectSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanConfig.id, protocol: 'escpos', connectionType: 'lan' }),
    );
  });

  it('connect() logs connectFailed on failure', async () => {
    const driver = new ThermalReceiptDriver();
    const badConfig: PrinterConfig = { ...lanConfig, id: 'receipt-bad', lan: undefined };
    await expect(driver.connect(badConfig)).rejects.toThrow();
    const { PrinterLogger } = jest.requireMock('../../services/PrinterLogger') as {
      PrinterLogger: { connectFailed: jest.Mock };
    };
    expect(PrinterLogger.connectFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        printerId: badConfig.id,
        protocol: 'escpos',
        connectionType: 'lan',
        errorCode: 'VALIDATION_ERROR',
      }),
    );
  });

  it('disconnect() logs disconnectSucceeded', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    await driver.disconnect(lanConfig.id);
    const { PrinterLogger } = jest.requireMock('../../services/PrinterLogger') as {
      PrinterLogger: { disconnectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.disconnectSucceeded).toHaveBeenCalledWith({ printerId: lanConfig.id, protocol: 'escpos' });
  });

  it('scan("bluetooth") logs scanCompleted with the device count on success', async () => {
    const driver = new ThermalReceiptDriver();
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        if (event.type !== 'loading') resolve();
      });
    });
    const { PrinterLogger } = jest.requireMock('../../services/PrinterLogger') as {
      PrinterLogger: { scanCompleted: jest.Mock };
    };
    expect(PrinterLogger.scanCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: 'bluetooth', deviceCount: 0 }),
    );
  });

  it('scan("bluetooth") logs scanFailed on a genuine connection error (not "No Device Found")', async () => {
    const { BLEPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      BLEPrinter: { getDeviceList: jest.Mock };
    };
    BLEPrinter.getDeviceList.mockRejectedValueOnce(new Error('bluetooth adapter off'));
    const driver = new ThermalReceiptDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type !== 'loading') resolve();
      });
    });
    expect(events).toEqual(['loading', 'error']);
    const { PrinterLogger } = jest.requireMock('../../services/PrinterLogger') as {
      PrinterLogger: { scanFailed: jest.Mock };
    };
    expect(PrinterLogger.scanFailed).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: 'bluetooth', errorCode: 'CONNECTION_ERROR' }),
    );
  });

  it('testPrint() logs testPrintSucceeded', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    await driver.testPrint(lanConfig);
    const { PrinterLogger } = jest.requireMock('../../services/PrinterLogger') as {
      PrinterLogger: { testPrintSucceeded: jest.Mock };
    };
    expect(PrinterLogger.testPrintSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanConfig.id, protocol: 'escpos' }),
    );
  });

  it('testPrint() logs testPrintFailed when printText fails', async () => {
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { printText: jest.Mock };
    };
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    NetPrinter.printText.mockImplementationOnce(
      (_text: string, _opts: unknown, _cbSuccess?: (msg: string) => void, cbErr?: (error: Error) => void) =>
        cbErr?.(new Error('print failed')),
    );
    await expect(driver.testPrint(lanConfig)).rejects.toThrow('print failed');
    const { PrinterLogger } = jest.requireMock('../../services/PrinterLogger') as {
      PrinterLogger: { testPrintFailed: jest.Mock };
    };
    expect(PrinterLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanConfig.id, protocol: 'escpos', errorCode: 'UNKNOWN_ERROR' }),
    );
  });

  it('disconnect() does not call the native closeConn() for a printer that no longer owns the shared connection', async () => {
    const driver = new ThermalReceiptDriver();
    const printerA: PrinterConfig = { ...lanConfig, id: 'receipt-lan-a', lan: { ip: '192.168.1.50', port: 9100 } };
    const printerB: PrinterConfig = { ...lanConfig, id: 'receipt-lan-b', lan: { ip: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    await driver.connect(printerB);

    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { closeConn: jest.Mock };
    };
    NetPrinter.closeConn.mockClear();

    await driver.disconnect(printerA.id);
    expect(NetPrinter.closeConn).not.toHaveBeenCalled();
    expect(driver.getStatus(printerA.id)).toBe('disconnected');

    await driver.disconnect(printerB.id);
    expect(NetPrinter.closeConn).toHaveBeenCalledTimes(1);
    expect(driver.getStatus(printerB.id)).toBe('disconnected');
  });

  it('print() joins text/line/table elements into a single printText call', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { printText: jest.Mock };
    };
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'line', x: 0, y: 10 },
        { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
      ],
    };
    await driver.print(lanConfig.id, document);
    expect(NetPrinter.printText).toHaveBeenCalledWith(
      'Trà sữa\n--------------------------------\nTrà sữa  2\n',
      expect.objectContaining({ keepConnection: true, cut: true, tailingLine: true }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('print() throws ENCODING_FAILED for a barcode element without calling printText', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { printText: jest.Mock };
    };
    const callsBefore = NetPrinter.printText.mock.calls.length;
    const document: PrintDocument = { elements: [{ type: 'barcode', content: '123', x: 0, y: 0 }] };
    await expect(driver.print(lanConfig.id, document)).rejects.toMatchObject({ code: 'ENCODING_FAILED' });
    expect(NetPrinter.printText.mock.calls.length).toBe(callsBefore);
  });

  it('print() throws ENCODING_FAILED for a qrCode element', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const document: PrintDocument = { elements: [{ type: 'qrCode', content: 'https://x', x: 0, y: 0 }] };
    await expect(driver.print(lanConfig.id, document)).rejects.toMatchObject({ code: 'ENCODING_FAILED' });
  });

  it('print() throws ENCODING_FAILED for an image element', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const document: PrintDocument = { elements: [{ type: 'image', data: 'AAAA', x: 0, y: 0 }] };
    await expect(driver.print(lanConfig.id, document)).rejects.toMatchObject({ code: 'ENCODING_FAILED' });
  });

  it('print() validates all elements before sending anything — an unsupported element after valid ones still sends nothing', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { printText: jest.Mock };
    };
    const callsBefore = NetPrinter.printText.mock.calls.length;
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'barcode', content: '123', x: 0, y: 10 },
      ],
    };
    await expect(driver.print(lanConfig.id, document)).rejects.toMatchObject({ code: 'ENCODING_FAILED' });
    expect(NetPrinter.printText.mock.calls.length).toBe(callsBefore);
  });

  it('print() throws CONNECTION_ERROR when not connected', async () => {
    const driver = new ThermalReceiptDriver();
    const document: PrintDocument = { elements: [] };
    await expect(driver.print('never-connected', document)).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
  });

  it('print() throws CONNECTION_ERROR when the printer is no longer the active owner of the shared connection', async () => {
    const driver = new ThermalReceiptDriver();
    const printerA: PrinterConfig = { ...lanConfig, id: 'receipt-lan-a', lan: { ip: '192.168.1.50', port: 9100 } };
    const printerB: PrinterConfig = { ...lanConfig, id: 'receipt-lan-b', lan: { ip: '192.168.1.51', port: 9100 } };
    await driver.connect(printerA);
    await driver.connect(printerB);
    const document: PrintDocument = { elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] };
    await expect(driver.print(printerA.id, document)).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
  });

  it('print() logs printSucceeded on success', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    await driver.print(lanConfig.id, { elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] });
    const { PrinterLogger } = jest.requireMock('../../services/PrinterLogger') as {
      PrinterLogger: { printSucceeded: jest.Mock };
    };
    expect(PrinterLogger.printSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanConfig.id, protocol: 'escpos' }),
    );
  });

  it('print() logs printFailed when printText fails', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { printText: jest.Mock };
    };
    NetPrinter.printText.mockImplementationOnce(
      (_text: string, _opts: unknown, _cbSuccess?: (msg: string) => void, cbErr?: (error: Error) => void) =>
        cbErr?.(new Error('print failed')),
    );
    await expect(
      driver.print(lanConfig.id, { elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] }),
    ).rejects.toThrow('print failed');
    const { PrinterLogger } = jest.requireMock('../../services/PrinterLogger') as {
      PrinterLogger: { printFailed: jest.Mock };
    };
    expect(PrinterLogger.printFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanConfig.id, protocol: 'escpos', errorCode: 'UNKNOWN_ERROR' }),
    );
  });
});
