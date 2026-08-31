import { EscPosDriver } from '../EscPosDriver';
import { buildEscPosText } from '../EscPosTextBuilder';
import { ConnectionType, DeviceScanEventType } from '../../../models/printer/PrinterDevice';
import { DriverSource, PrinterDriverType, type PrinterDriver } from '../../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../../models/printer/PrinterStatus';
import { type Printer } from '../../../models/printer/Printer';
import { paperSizeOf } from '../../driverConfig';
import { PrintType } from '../../../models/printing/PrintType';
import type { PrintDocuments } from '../../IPrinterDriver';

jest.mock('../../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));
import type { PrintDocument } from '../../../models/printing/PrintDocument';
import { PrinterErrorCode } from '../../../errors/PrinterError';

// The library's real dist/index.d.ts (inspected after `npm install`) differs
// from README-only assumptions: `connectPrinter()` takes positional args
// specific to each namespace (not a shared `{host, port}`-style object), and
// `printText()` is callback-based (`cbSuccess`/`cbErr`), not Promise-returning.
// Mocks below reflect the real shapes.
jest.mock('../../../adapters/native/PrinterNativeModule', () => {
  const USBPrinter = {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'USB', vendor_id: '1155', product_id: '22222' }),
    printText: jest.fn((_t: string, _o: unknown, cb?: (msg: string) => void) => cb?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  };
  const BLEPrinter = {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'BLE', inner_mac_address: '00:11:22:33:44:55' }),
    printText: jest.fn((_t: string, _o: unknown, cb?: (msg: string) => void) => cb?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  };
  const NetPrinter = {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'Net', host: '192.168.1.50', port: 9100 }),
    printText: jest.fn((_t: string, _o: unknown, cb?: (msg: string) => void) => cb?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  };
  const namespaces: Record<string, unknown> = { usb: USBPrinter, bluetooth: BLEPrinter, lan: NetPrinter };
  return {
    USBPrinter,
    BLEPrinter,
    NetPrinter,
    ensureUsbInitialized: jest.fn().mockResolvedValue(undefined),
    ensureNativeInitialized: jest.fn().mockResolvedValue(undefined),
    printRawDataUsb: jest.fn().mockResolvedValue(undefined),
    printRawDataBluetooth: jest.fn().mockResolvedValue(undefined),
    printRawDataLan: jest.fn().mockResolvedValue(undefined),
    ThermalPrinterAdapter: {
      namespaceFor: (connectionType: string) => namespaces[connectionType],
      printTextAsync: (connectionType: string, text: string, options: unknown): Promise<void> =>
        new Promise((resolve, reject) => {
          (namespaces[connectionType] as { printText: jest.Mock }).printText(
            text,
            options,
            () => resolve(),
            (error: Error) => reject(error),
          );
        }),
    },
  };
});
jest.mock('../../../services/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../../services/PrinterLogger', () => ({
  PrinterLogger: {
    scanCompleted: jest.fn(), scanFailed: jest.fn(), connectSucceeded: jest.fn(), connectFailed: jest.fn(),
    disconnectSucceeded: jest.fn(), disconnectFailed: jest.fn(), testPrintSucceeded: jest.fn(), testPrintFailed: jest.fn(),
    printSucceeded: jest.fn(), printFailed: jest.fn(),
  },
}));

const escposDriverEntry: PrinterDriver = { type: PrinterDriverType.escpos, source: DriverSource.auto, contentTypes: [PrintType.Receipt], config: { type: PrinterDriverType.escpos, media: { type: 'continuous', paperSize: 80 } } };

const escposDriverEntry58: PrinterDriver = { ...escposDriverEntry, config: { type: PrinterDriverType.escpos, media: { type: 'continuous', paperSize: 58 } } };

const lanPrinter: Printer = {
  id: 'receipt-lan',
  name: 'Máy in hoá đơn',
  drivers: [escposDriverEntry],
  connection: { type: ConnectionType.lan, lan: { ip: '192.168.1.50', port: 9100 } },
  identityKey: 'lan:192.168.1.50:9100',
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const blePrinter: Printer = {
  ...lanPrinter,
  id: 'receipt-ble',
  connection: { type: ConnectionType.bluetooth, device: { deviceId: '00:11:22:33:44:55', displayName: 'Máy in BLE', rawDevice: {} } },
};

const usbPrinter: Printer = {
  ...lanPrinter,
  id: 'receipt-usb',
  connection: { type: ConnectionType.usb, device: { deviceId: '1155:22222', displayName: 'Máy in USB', rawDevice: { vendor_id: 1155, product_id: 22222 } } },
};

const sampleDocuments: PrintDocuments = { text: { elements: [{ type: 'text', content: 'In thử', x: 0, y: 0 }] } };

const asDocuments = (document: PrintDocument): PrintDocuments => ({ text: document });

describe('EscPosDriver', () => {
  afterEach(() => jest.clearAllMocks());

  it('connect() over LAN transitions status idle -> connecting -> connected', async () => {
    const driver = new EscPosDriver();
    const statuses: string[] = [];
    driver.onStatusChange(lanPrinter.id, (status) => statuses.push(status));
    await driver.connect(lanPrinter, escposDriverEntry);
    expect(statuses).toEqual([PrinterStatus.connecting, PrinterStatus.connected]);
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { NetPrinter: { connectPrinter: jest.Mock } };
    expect(NetPrinter.connectPrinter).toHaveBeenCalledWith('192.168.1.50', 9100);
  });

  it('buildEscPosText() converts the resolved text document into ESC/POS text (pure, no driver/transport needed)', () => {
    const text = buildEscPosText(paperSizeOf(escposDriverEntry), sampleDocuments);
    expect(text).toContain('In thử');
  });

  it('buildEscPosText() ignores documents.image — ESC/POS always uses text', () => {
    const withImage: PrintDocuments = { text: sampleDocuments.text, image: 'c2hvdWxkLW5vdC1iZS11c2Vk' };
    const text = buildEscPosText(paperSizeOf(escposDriverEntry), withImage);
    expect(text).toContain('In thử');
  });

  it('print() calls printText via the vendor library, using buildEscPosText internally (pragmatic path)', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { NetPrinter: { printText: jest.Mock } };
    await driver.print(lanPrinter.id, sampleDocuments, PrintType.Receipt);
    expect(NetPrinter.printText).toHaveBeenCalledWith(
      expect.stringContaining('In thử'),
      expect.objectContaining({ keepConnection: true, cut: true, tailingLine: true, encoding: 'UTF8' }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('sendDocuments gửi cut:true khi media.cutterMode undefined (mặc định giữ hành vi cũ)', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { NetPrinter: { printText: jest.Mock } };
    await driver.print(lanPrinter.id, sampleDocuments, PrintType.Receipt);
    expect(NetPrinter.printText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cut: true }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('sendDocuments gửi cut:false khi media.cutterMode = none', async () => {
    const noCutEntry: PrinterDriver = { ...escposDriverEntry, config: { type: PrinterDriverType.escpos, media: { type: 'continuous', paperSize: 80, cutterMode: 'none' } } };
    const driver = new EscPosDriver();
    await driver.connect({ ...lanPrinter, drivers: [noCutEntry] }, noCutEntry);
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { NetPrinter: { printText: jest.Mock } };
    await driver.print(lanPrinter.id, sampleDocuments, PrintType.Receipt);
    expect(NetPrinter.printText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cut: false }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('identify() over USB always returns null', async () => {
    const driver = new EscPosDriver();
    const usbPrinterHere: Printer = { ...lanPrinter, id: 'receipt-usb', connection: { type: ConnectionType.usb, device: { deviceId: '1155:22222', displayName: 'USB', rawDevice: { vendor_id: 1155, product_id: 22222 } } } };
    await driver.connect(usbPrinterHere, escposDriverEntry);
    expect(await driver.identify(usbPrinterHere.id)).toBeNull();
  });

  it('connect() over Bluetooth checks permission and connects with the device MAC address', async () => {
    const driver = new EscPosDriver();
    await driver.connect(blePrinter, escposDriverEntry);
    const { ensureBluetoothPermission } = jest.requireMock('../../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    const { BLEPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      BLEPrinter: { connectPrinter: jest.Mock };
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(BLEPrinter.connectPrinter).toHaveBeenCalledWith('00:11:22:33:44:55');
    expect(driver.getStatus(blePrinter.id)).toBe(PrinterStatus.connected);
  });

  it('connect() over Bluetooth fails with PRINTER_CONNECTION_FAILED when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new EscPosDriver();
    await expect(driver.connect(blePrinter, escposDriverEntry)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
    expect(driver.getStatus(blePrinter.id)).toBe(PrinterStatus.error);
  });

  it('connect() over USB reads vendor_id/product_id from the scanned rawDevice as numbers', async () => {
    const driver = new EscPosDriver();
    await driver.connect(usbPrinter, escposDriverEntry);
    const { USBPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      USBPrinter: { connectPrinter: jest.Mock };
    };
    expect(USBPrinter.connectPrinter).toHaveBeenCalledWith(1155, 22222);
  });

  it('disconnect() closes the connection and sets status disconnected', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    await driver.disconnect(lanPrinter.id);
    expect(driver.getStatus(lanPrinter.id)).toBe(PrinterStatus.disconnected);
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { closeConn: jest.Mock };
    };
    expect(NetPrinter.closeConn).toHaveBeenCalled();
  });

  it('disconnect() sets status error (not stuck at disconnecting), logs disconnectFailed and rethrows PRINTER_CONNECTION_FAILED when native closeConn() rejects', async () => {
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { closeConn: jest.Mock };
    };
    NetPrinter.closeConn.mockRejectedValueOnce(new Error('socket already closed'));
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);

    await expect(driver.disconnect(lanPrinter.id)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
    expect(driver.getStatus(lanPrinter.id)).toBe(PrinterStatus.error);

    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { disconnectFailed: jest.Mock };
    };
    expect(PrinterLogger.disconnectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.escpos }),
    );
  });

  it('disconnect() clears activeByType bookkeeping despite the native failure — a second printer on the same connectionType is not blocked forever', async () => {
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { closeConn: jest.Mock };
    };
    NetPrinter.closeConn.mockRejectedValueOnce(new Error('socket already closed'));
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    await driver.disconnect(lanPrinter.id).catch(() => undefined);

    const secondPrinter: Printer = { ...lanPrinter, id: 'receipt-lan-2' };
    await driver.connect(secondPrinter, escposDriverEntry);
    expect(driver.getStatus(secondPrinter.id)).toBe(PrinterStatus.connected);
  });

  it('scan("lan") reports empty immediately without calling the library', () => {
    const driver = new EscPosDriver();
    const events: string[] = [];
    driver.scan(ConnectionType.lan, (event) => events.push(event.type));
    expect(events).toEqual([DeviceScanEventType.empty]);
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { getDeviceList: jest.Mock };
    };
    expect(NetPrinter.getDeviceList).not.toHaveBeenCalled();
  });

  it('scan("bluetooth") checks permission before calling BLEPrinter.getDeviceList', async () => {
    const driver = new EscPosDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(ConnectionType.bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.loading, DeviceScanEventType.empty]);
    const { BLEPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      BLEPrinter: { getDeviceList: jest.Mock };
    };
    expect(BLEPrinter.getDeviceList).toHaveBeenCalled();
  });

  it('scan("bluetooth") emits an error event when ensureBluetoothPermission itself rejects', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockRejectedValueOnce(new Error('permission check failed'));
    const driver = new EscPosDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(ConnectionType.bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.loading, DeviceScanEventType.error]);
  });

  it('scan("bluetooth") emits empty (not error) when getDeviceList rejects with "No Device Found"', async () => {
    const { BLEPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      BLEPrinter: { getDeviceList: jest.Mock };
    };
    BLEPrinter.getDeviceList.mockRejectedValueOnce('No Device Found');
    const driver = new EscPosDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(ConnectionType.bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.loading, DeviceScanEventType.empty]);
  });

  it('testPrint() reuses an already-open connection instead of reconnecting', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { connectPrinter: jest.Mock; printText: jest.Mock };
    };
    const callsBeforeTestPrint = NetPrinter.connectPrinter.mock.calls.length;
    await driver.testPrint(lanPrinter, escposDriverEntry, sampleDocuments, PrintType.Receipt);
    expect(NetPrinter.connectPrinter.mock.calls.length).toBe(callsBeforeTestPrint);
    expect(NetPrinter.printText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ keepConnection: true, cut: true, tailingLine: true }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('identify() returns null when not connected', async () => {
    const driver = new EscPosDriver();
    const result = await driver.identify('never-connected');
    expect(result).toBeNull();
  });

  it('identify() over BLE/LAN returns {} (weak confirm) when connected — native không có discriminator thật', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const result = await driver.identify(lanPrinter.id);
    expect(result).toEqual({});
  });

  it('connecting printer B on the same connectionType as already-connected printer A flips A to disconnected', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { ...lanPrinter.connection, lan: { ip: '192.168.1.50', port: 9100 } } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { ...lanPrinter.connection, lan: { ip: '192.168.1.51', port: 9100 } } };

    await driver.connect(printerA, escposDriverEntry);
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.connected);

    await driver.connect(printerB, escposDriverEntry);
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.disconnected);
    expect(driver.getStatus(printerB.id)).toBe(PrinterStatus.connected);
  });

  it('does not flip printer A to disconnected when connecting printer B on the same connectionType fails validation', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { ...lanPrinter.connection, lan: { ip: '192.168.1.50', port: 9100 } } };
    const printerBInvalid: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { ...lanPrinter.connection, lan: undefined } };

    await driver.connect(printerA, escposDriverEntry);
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.connected);

    await expect(driver.connect(printerBInvalid, escposDriverEntry)).rejects.toMatchObject({ code: PrinterErrorCode.VALIDATION_ERROR });
    // printer A must still be reported as connected — the failed attempt on B
    // never touched the native connection, so A's real state is unchanged.
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.connected);
  });

  it('testPrint() reconnects instead of taking the stale fast path when another printer has taken over the shared connection', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { ...lanPrinter.connection, lan: { ip: '192.168.1.50', port: 9100 } } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { ...lanPrinter.connection, lan: { ip: '192.168.1.51', port: 9100 } } };

    await driver.connect(printerA, escposDriverEntry);
    await driver.connect(printerB, escposDriverEntry);

    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { connectPrinter: jest.Mock };
    };
    const callsBeforeTestPrint = NetPrinter.connectPrinter.mock.calls.length;
    await driver.testPrint(printerA, escposDriverEntry, sampleDocuments, PrintType.Receipt);
    expect(NetPrinter.connectPrinter.mock.calls.length).toBe(callsBeforeTestPrint + 1);
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.connected);
  });

  it('connect() logs connectSucceeded on success', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { connectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.connectSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.escpos, connectionType: ConnectionType.lan }),
    );
  });

  it('connect() logs connectFailed on failure', async () => {
    const driver = new EscPosDriver();
    const badPrinter: Printer = { ...lanPrinter, id: 'receipt-bad', connection: { ...lanPrinter.connection, lan: undefined } };
    await expect(driver.connect(badPrinter, escposDriverEntry)).rejects.toThrow();
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { connectFailed: jest.Mock };
    };
    expect(PrinterLogger.connectFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        printerId: badPrinter.id,
        protocol: PrinterDriverType.escpos,
        connectionType: ConnectionType.lan,
        errorCode: PrinterErrorCode.VALIDATION_ERROR,
      }),
    );
  });

  it('disconnect() logs disconnectSucceeded', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    await driver.disconnect(lanPrinter.id);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { disconnectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.disconnectSucceeded).toHaveBeenCalledWith({ printerId: lanPrinter.id, protocol: PrinterDriverType.escpos });
  });

  it('scan("bluetooth") logs scanCompleted with the device count on success', async () => {
    const driver = new EscPosDriver();
    await new Promise<void>((resolve) => {
      driver.scan(ConnectionType.bluetooth, (event) => {
        if (event.type !== DeviceScanEventType.loading) resolve();
      });
    });
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { scanCompleted: jest.Mock };
    };
    expect(PrinterLogger.scanCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: ConnectionType.bluetooth, deviceCount: 0 }),
    );
  });

  it('scan("bluetooth") logs scanFailed on a genuine connection error (not "No Device Found")', async () => {
    const { BLEPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      BLEPrinter: { getDeviceList: jest.Mock };
    };
    BLEPrinter.getDeviceList.mockRejectedValueOnce(new Error('bluetooth adapter off'));
    const driver = new EscPosDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(ConnectionType.bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.loading, DeviceScanEventType.error]);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { scanFailed: jest.Mock };
    };
    expect(PrinterLogger.scanFailed).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: ConnectionType.bluetooth, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED }),
    );
  });

  it('testPrint() logs testPrintSucceeded', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    await driver.testPrint(lanPrinter, escposDriverEntry, sampleDocuments, PrintType.Receipt);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { testPrintSucceeded: jest.Mock };
    };
    expect(PrinterLogger.testPrintSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.escpos }),
    );
  });

  it('testPrint() logs testPrintFailed (not just a bare connect failure) when the implicit reconnect fails', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new EscPosDriver();
    await expect(driver.testPrint(blePrinter, escposDriverEntry, sampleDocuments, PrintType.Receipt)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { testPrintFailed: jest.Mock };
    };
    expect(PrinterLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: blePrinter.id, protocol: PrinterDriverType.escpos, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED }),
    );
  });

  it('testPrint() logs testPrintFailed when printText fails', async () => {
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { printText: jest.Mock };
    };
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    NetPrinter.printText.mockImplementationOnce(
      (_text: string, _opts: unknown, _cbSuccess?: (msg: string) => void, cbErr?: (error: Error) => void) =>
        cbErr?.(new Error('print failed')),
    );
    await expect(driver.testPrint(lanPrinter, escposDriverEntry, sampleDocuments, PrintType.Receipt)).rejects.toThrow('print failed');
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { testPrintFailed: jest.Mock };
    };
    expect(PrinterLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.escpos, errorCode: PrinterErrorCode.UNKNOWN_ERROR }),
    );
  });

  it('disconnect() does not call the native closeConn() for a printer that no longer owns the shared connection', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { ...lanPrinter.connection, lan: { ip: '192.168.1.50', port: 9100 } } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { ...lanPrinter.connection, lan: { ip: '192.168.1.51', port: 9100 } } };

    await driver.connect(printerA, escposDriverEntry);
    await driver.connect(printerB, escposDriverEntry);

    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { closeConn: jest.Mock };
    };
    NetPrinter.closeConn.mockClear();

    await driver.disconnect(printerA.id);
    expect(NetPrinter.closeConn).not.toHaveBeenCalled();
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.disconnected);

    await driver.disconnect(printerB.id);
    expect(NetPrinter.closeConn).toHaveBeenCalledTimes(1);
    expect(driver.getStatus(printerB.id)).toBe(PrinterStatus.disconnected);
  });

  it('print() joins text/line/table elements into a single printText call', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { printText: jest.Mock };
    };
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'line', x: 0, y: 10 },
        { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
      ],
    };
    await driver.print(lanPrinter.id, asDocuments(document), PrintType.Receipt);
    expect(NetPrinter.printText).toHaveBeenCalledWith(
      `Trà sữa\n${'-'.repeat(48)}\nTrà sữa  2\n`,
      expect.objectContaining({ keepConnection: true, cut: true, tailingLine: true }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('print() renders a row element as a left/right-aligned line sized to the driver media paperSize', async () => {
    const driver = new EscPosDriver();
    await driver.connect({ ...lanPrinter, drivers: [escposDriverEntry58] }, escposDriverEntry58);
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { printText: jest.Mock };
    };
    const document: PrintDocument = { elements: [{ type: 'row', left: 'Mã đơn', right: '#001', x: 0, y: 0 }] };
    await driver.print(lanPrinter.id, asDocuments(document), PrintType.Receipt);
    expect(NetPrinter.printText).toHaveBeenCalledWith(
      `Mã đơn${' '.repeat(22)}#001\n`,
      expect.objectContaining({ keepConnection: true, cut: true, tailingLine: true }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('print() throws TSPL_ELEMENT_UNSUPPORTED for a barcode element without calling printText', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { printText: jest.Mock };
    };
    const callsBefore = NetPrinter.printText.mock.calls.length;
    const document: PrintDocument = { elements: [{ type: 'barcode', content: '123', x: 0, y: 0 }] };
    await expect(driver.print(lanPrinter.id, asDocuments(document), PrintType.Receipt)).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
    expect(NetPrinter.printText.mock.calls.length).toBe(callsBefore);
  });

  it('print() throws TSPL_ELEMENT_UNSUPPORTED for a qrCode element', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const document: PrintDocument = { elements: [{ type: 'qrCode', content: 'https://x', x: 0, y: 0 }] };
    await expect(driver.print(lanPrinter.id, asDocuments(document), PrintType.Receipt)).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
  });

  it('print() throws TSPL_ELEMENT_UNSUPPORTED for an image element', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const document: PrintDocument = { elements: [{ type: 'image', data: 'AAAA', x: 0, y: 0 }] };
    await expect(driver.print(lanPrinter.id, asDocuments(document), PrintType.Receipt)).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
  });

  it('print() validates all elements before sending anything — an unsupported element after valid ones still sends nothing', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { printText: jest.Mock };
    };
    const callsBefore = NetPrinter.printText.mock.calls.length;
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'barcode', content: '123', x: 0, y: 10 },
      ],
    };
    await expect(driver.print(lanPrinter.id, asDocuments(document), PrintType.Receipt)).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
    expect(NetPrinter.printText.mock.calls.length).toBe(callsBefore);
  });

  it('print() throws PRINTER_NOT_CONNECTED when not connected', async () => {
    const driver = new EscPosDriver();
    const document: PrintDocument = { elements: [] };
    await expect(driver.print('never-connected', asDocuments(document), PrintType.Receipt)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED });
  });

  it('print() throws PRINTER_NOT_CONNECTED when the printer is no longer the active owner of the shared connection', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { ...lanPrinter.connection, lan: { ip: '192.168.1.50', port: 9100 } } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { ...lanPrinter.connection, lan: { ip: '192.168.1.51', port: 9100 } } };
    await driver.connect(printerA, escposDriverEntry);
    await driver.connect(printerB, escposDriverEntry);
    const document: PrintDocument = { elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] };
    await expect(driver.print(printerA.id, asDocuments(document), PrintType.Receipt)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED });
  });

  it('print() logs printSucceeded on success', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    await driver.print(lanPrinter.id, asDocuments({ elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] }), PrintType.Receipt);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { printSucceeded: jest.Mock };
    };
    expect(PrinterLogger.printSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.escpos }),
    );
  });

  it('print() logs printFailed when printText fails', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const { NetPrinter } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      NetPrinter: { printText: jest.Mock };
    };
    NetPrinter.printText.mockImplementationOnce(
      (_text: string, _opts: unknown, _cbSuccess?: (msg: string) => void, cbErr?: (error: Error) => void) =>
        cbErr?.(new Error('print failed')),
    );
    await expect(
      driver.print(lanPrinter.id, asDocuments({ elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] }), PrintType.Receipt),
    ).rejects.toThrow('print failed');
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { printFailed: jest.Mock };
    };
    expect(PrinterLogger.printFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.escpos, errorCode: PrinterErrorCode.UNKNOWN_ERROR }),
    );
  });
});
