import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import { EscPosDriver } from '../EscPosDriver';
import { buildEscPosText } from '../EscPosTextBuilder';
import { DeviceScanEventType } from '../../../models/printer/PrinterDevice';
import { ConnectionType } from '../../../models/printer/ConnectionType';
import { RenderMode, PrintLanguage } from '../../../models/printer/PrinterLanguage';
import { PrinterStatus } from '../../../models/printer/PrinterStatus';
import { CutterMode, PaperSize, PaperType } from '../../../models/paper/PaperOptions';
import { type Printer } from '../../../models/printer/Printer';
import { makePrinter, makeEscPosLanguage } from '../../../testing/printerFixtures';
import type { PrintDocuments } from '../../../models/printing/PrintDocuments';

jest.mock('../../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));
import type { PrintDocument } from '../../../models/printing/PrintDocument';
import { PrinterErrorCode } from '../../../errors/PrinterError';

// EscPosDriver đi qua NativeAdapter (không mock) → DeviceModule (adapters/native/DeviceModule), mọi loại kết nối
// cùng một native module nên mock 1 chỗ là đủ. Pool dùng chung dùng bản đi thẳng trong jest.setup.js.
jest.mock('../../../adapters/native/DeviceModule', () => ({
  DeviceModule: {
    discover: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue({ connectionId: 'mock-connection', serialNumber: null }),
    write: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(null),
    disconnect: jest.fn().mockResolvedValue(undefined),
  },
  subscribeDeviceDisconnected: jest.fn().mockReturnValue(() => undefined),
}));
jest.mock('../../../permissions/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../../logging/PrinterLogger', () => ({
  PrinterLogger: {
    scanCompleted: jest.fn(), scanFailed: jest.fn(), connectSucceeded: jest.fn(), connectFailed: jest.fn(),
    disconnectSucceeded: jest.fn(), disconnectFailed: jest.fn(), testPrintSucceeded: jest.fn(), testPrintFailed: jest.fn(),
    printSucceeded: jest.fn(), printFailed: jest.fn(),
  },
}));

/** Decode payload `write` nhận được về lại bytes gốc để assert nội dung/ESC-byte. */
const bytesOf = (base64: string): Buffer => Buffer.from(base64, 'base64');

/**
 * `forbidPlte: true` tránh 1 bug encoder `upng-js` ở ảnh 2 màu cực nhỏ (xem
 * cùng lý do trong `TsplDriver.test.ts`) — không phải rủi ro production, ảnh
 * bill thật lớn/phức tạp hơn hẳn ngưỡng lỗi này.
 */
const tinyPngBase64 = (): string => {
  const rgba = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]); // 2x1: đen, trắng
  return Buffer.from(new Uint8Array(UPNG.encode([rgba.buffer], 2, 1, 0, [], true))).toString('base64');
};

/** 2x6 (cao gấp 3 rộng) — sau khi chuẩn hoá về `PAPER_SIZE_SPECS[80].imageWidthPx` (576px), chiều cao ra 1728px, vượt `CONTINUOUS_HEIGHT_MM * DOTS_PER_MM` (1600px). */
const tallPngBase64 = (): string => {
  const rgba = new Uint8Array(2 * 6 * 4).fill(0);
  for (let i = 3; i < rgba.length; i += 4) {
    rgba[i] = 255; // alpha
  }
  return Buffer.from(new Uint8Array(UPNG.encode([rgba.buffer], 2, 6, 0, [], true))).toString('base64');
};

const lanPrinter: Printer = makePrinter({
  id: 'receipt-lan',
  name: 'Máy in hoá đơn',
  deviceId: 'lan:192.168.1.50:9100',
  connection: { type: ConnectionType.Lan, host: '192.168.1.50', port: 9100 },
});

const blePrinter: Printer = {
  ...lanPrinter,
  id: 'receipt-ble',
  connection: { type: ConnectionType.Bluetooth, mac: '00:11:22:33:44:55' },
};

const usbPrinter: Printer = {
  ...lanPrinter,
  id: 'receipt-usb',
  connection: { type: ConnectionType.Usb, vendorId: 1155, productId: 22222 },
};

const bitmapPrinter: Printer = { ...lanPrinter, language: makeEscPosLanguage({ renderMode: RenderMode.Raster }) };

const sampleDocuments: PrintDocuments = { text: { elements: [{ type: 'text', content: 'In thử', x: 0, y: 0 }] } };

const asDocuments = (document: PrintDocument): PrintDocuments => ({ text: document });

// `NativeAdapter.printText` (dùng bởi EscPosDriver) có nhánh iOS gọi module in cũ của iOS. Jest preset RN mặc
// định Platform.OS='ios' — ép 'android' để test đúng nhánh DeviceModule chạy trên thiết bị.
const originalPlatformOS = Platform.OS;
beforeAll(() => {
  Platform.OS = 'android';
});
afterAll(() => {
  Platform.OS = originalPlatformOS;
});

describe('EscPosDriver', () => {
  afterEach(() => jest.clearAllMocks());

  it('connect() over LAN transitions status idle -> connecting -> connected', async () => {
    const driver = new EscPosDriver();
    const statuses: string[] = [];
    driver.onStatusChange(lanPrinter.id, (status) => statuses.push(status));
    await driver.connect(lanPrinter);
    expect(statuses).toEqual([PrinterStatus.Connecting, PrinterStatus.Connected]);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { connect: jest.Mock } };
    expect(DeviceModule.connect).toHaveBeenCalledWith({ type: 'lan', host: '192.168.1.50', port: 9100 });
  });

  it('buildEscPosText() converts the resolved text document into ESC/POS text (pure, no driver/transport needed)', () => {
    const text = buildEscPosText(lanPrinter.paper.paperSize, sampleDocuments);
    expect(text).toContain('In thử');
  });

  it('buildEscPosText() ignores documents.image — ESC/POS always uses text', () => {
    const withImage: PrintDocuments = { text: sampleDocuments.text, image: 'c2hvdWxkLW5vdC1iZS11c2Vk' };
    const text = buildEscPosText(lanPrinter.paper.paperSize, withImage);
    expect(text).toContain('In thử');
  });

  it('print() encodes buildEscPosText() into ESC/POS bytes and writes via write(connectionId, ...)', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { write: jest.Mock } };
    await driver.print(lanPrinter.id, sampleDocuments);
    expect(DeviceModule.write).toHaveBeenCalledTimes(1);
    const [connectionId, base64] = DeviceModule.write.mock.calls[0] as [string, string, number];
    expect(connectionId).toBe('mock-connection');
    expect(bytesOf(base64).toString('utf8')).toContain('In thử');
  });

  it('sendDocuments gửi lệnh cắt khi giấy cuộn cắt cuối job', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { write: jest.Mock } };
    await driver.print(lanPrinter.id, sampleDocuments);
    const [, base64] = DeviceModule.write.mock.calls[0] as [string, string, number];
    expect(bytesOf(base64).includes(Buffer.from([27, 109]))).toBe(true); // cut_bytes
  });

  it('sendDocuments gửi cut:false khi media.cutterMode = none', async () => {
    const noCutPrinter: Printer = {
      ...lanPrinter,
      paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode: CutterMode.None },
    };
    const driver = new EscPosDriver();
    await driver.connect(noCutPrinter);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { write: jest.Mock } };
    await driver.print(lanPrinter.id, sampleDocuments);
    const [, base64] = DeviceModule.write.mock.calls[0] as [string, string, number];
    expect(bytesOf(base64).includes(Buffer.from([27, 109]))).toBe(false); // cut_bytes absent
  });

  it('sendDocuments bitmap mode: thiếu documents.image → ném IMAGE_REQUIRED, KHÔNG gọi write', async () => {
    const driver = new EscPosDriver();
    await driver.connect(bitmapPrinter);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { write: jest.Mock } };
    await expect(driver.print(lanPrinter.id, { text: sampleDocuments.text })).rejects.toMatchObject({ code: PrinterErrorCode.IMAGE_REQUIRED });
    expect(DeviceModule.write).not.toHaveBeenCalled();
  });

  it('sendDocuments bitmap mode: PNG hỏng → ném IMAGE_INVALID', async () => {
    const driver = new EscPosDriver();
    await driver.connect(bitmapPrinter);
    await expect(
      driver.print(lanPrinter.id, { text: sampleDocuments.text, image: 'not-a-real-png' }),
    ).rejects.toMatchObject({ code: PrinterErrorCode.IMAGE_INVALID });
  });

  it('sendDocuments bitmap mode: ảnh quá cao (sau khi chuẩn hoá theo paperSize) → ném IMAGE_TOO_LARGE', async () => {
    const driver = new EscPosDriver();
    await driver.connect(bitmapPrinter);
    await expect(
      driver.print(lanPrinter.id, { text: sampleDocuments.text, image: tallPngBase64() }),
    ).rejects.toMatchObject({ code: PrinterErrorCode.IMAGE_TOO_LARGE });
  });

  it('sendDocuments bitmap mode: ảnh hợp lệ → gửi lệnh GS v 0 qua adapter.write() (write), KHÔNG dùng printText()', async () => {
    const driver = new EscPosDriver();
    await driver.connect(bitmapPrinter);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { write: jest.Mock } };
    await driver.print(lanPrinter.id, { text: sampleDocuments.text, image: tinyPngBase64() });
    expect(DeviceModule.write).toHaveBeenCalledTimes(1);
    const [connectionId, base64] = DeviceModule.write.mock.calls[0] as [string, string, number];
    expect(connectionId).toBe('mock-connection');
    const bytes = bytesOf(base64);
    // ESC @ rồi GS v 0 (m=0), không phải text ESC/POS encode qua EPToolkit —
    // printText() không bao giờ phát ra byte 0x1d,0x76,0x30.
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0x1b, 0x40]));
    expect(bytes.subarray(2, 6)).toEqual(Buffer.from([0x1d, 0x76, 0x30, 0x00]));
    // eslint-disable-next-line no-bitwise -- intentional low-byte/high-byte reconstruction of a little-endian field
    const widthBytes = bytes[6] | (bytes[7] << 8);
    expect(widthBytes).toBe(72); // ceil(PAPER_SIZE_SPECS[80].imageWidthPx / 8) = ceil(576/8)
    // Giấy cuộn cắt cuối job → có lệnh cắt cuối payload.
    expect(bytes.subarray(bytes.length - 2)).toEqual(Buffer.from([0x1b, 0x6d]));
  });

  it('sendDocuments bitmap mode: cutterMode = none → không phát cut_bytes cuối payload', async () => {
    const noCutBitmapPrinter: Printer = {
      ...bitmapPrinter,
      paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode: CutterMode.None },
    };
    const driver = new EscPosDriver();
    await driver.connect(noCutBitmapPrinter);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { write: jest.Mock } };
    await driver.print(lanPrinter.id, { text: sampleDocuments.text, image: tinyPngBase64() });
    const [, base64] = DeviceModule.write.mock.calls[0] as [string, string, number];
    const bytes = bytesOf(base64);
    expect(bytes.includes(Buffer.from([0x1b, 0x6d]))).toBe(false);
  });

  it('identify() over USB always returns null', async () => {
    const driver = new EscPosDriver();
    await driver.connect(usbPrinter);
    expect(await driver.identify(usbPrinter.id)).toBeNull();
  });

  it('connect() over Bluetooth checks permission and connects with the device MAC address', async () => {
    const driver = new EscPosDriver();
    await driver.connect(blePrinter);
    const { ensureBluetoothPermission } = jest.requireMock('../../../permissions/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { connect: jest.Mock };
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(DeviceModule.connect).toHaveBeenCalledWith({ type: 'bluetooth', mac: '00:11:22:33:44:55' });
    expect(driver.getStatus(blePrinter.id)).toBe(PrinterStatus.Connected);
  });

  it('connect() over Bluetooth fails with PRINTER_CONNECTION_FAILED when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../permissions/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new EscPosDriver();
    await expect(driver.connect(blePrinter)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
    expect(driver.getStatus(blePrinter.id)).toBe(PrinterStatus.Error);
  });

  it('connect() over USB reads vendorId/productId from the scanned rawDevice as numbers', async () => {
    const driver = new EscPosDriver();
    await driver.connect(usbPrinter);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { connect: jest.Mock };
    };
    expect(DeviceModule.connect).toHaveBeenCalledWith({ type: 'usb', vendorId: 1155, productId: 22222, serialNumber: null, devicePath: null });
  });

  it('disconnect() closes the connection and sets status disconnected', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    await driver.disconnect(lanPrinter.id);
    expect(driver.getStatus(lanPrinter.id)).toBe(PrinterStatus.Disconnected);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { disconnect: jest.Mock };
    };
    expect(DeviceModule.disconnect).toHaveBeenCalledWith('mock-connection');
  });

  it('disconnect() sets status error (not stuck at disconnecting), logs disconnectFailed and rethrows PRINTER_CONNECTION_FAILED when native disconnect() rejects', async () => {
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { disconnect: jest.Mock };
    };
    DeviceModule.disconnect.mockRejectedValueOnce(new Error('socket already closed'));
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);

    await expect(driver.disconnect(lanPrinter.id)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
    expect(driver.getStatus(lanPrinter.id)).toBe(PrinterStatus.Error);

    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { disconnectFailed: jest.Mock };
    };
    expect(PrinterLogger.disconnectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrintLanguage.EscPos }),
    );
  });

  it('disconnect() clears activeByType bookkeeping despite the native failure — a second printer on the same connectionType is not blocked forever', async () => {
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { disconnect: jest.Mock };
    };
    DeviceModule.disconnect.mockRejectedValueOnce(new Error('socket already closed'));
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    await driver.disconnect(lanPrinter.id).catch(() => undefined);

    const secondPrinter: Printer = { ...lanPrinter, id: 'receipt-lan-2' };
    await driver.connect(secondPrinter);
    expect(driver.getStatus(secondPrinter.id)).toBe(PrinterStatus.Connected);
  });

  it('scan("lan") reports empty immediately without calling the library', () => {
    const driver = new EscPosDriver();
    const events: string[] = [];
    driver.scan(ConnectionType.Lan, (event) => events.push(event.type));
    expect(events).toEqual([DeviceScanEventType.Empty]);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { discover: jest.Mock };
    };
    expect(DeviceModule.discover).not.toHaveBeenCalled();
  });

  it('scan("bluetooth") checks permission before calling discover', async () => {
    const driver = new EscPosDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(ConnectionType.Bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.Loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.Loading, DeviceScanEventType.Empty]);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { discover: jest.Mock };
    };
    expect(DeviceModule.discover).toHaveBeenCalledWith('bluetooth');
  });

  it('scan("bluetooth") emits an error event when ensureBluetoothPermission itself rejects', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../permissions/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockRejectedValueOnce(new Error('permission check failed'));
    const driver = new EscPosDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(ConnectionType.Bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.Loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.Loading, DeviceScanEventType.Error]);
  });

  it('scan("bluetooth") emits empty (not error) when discover rejects with "No Device Found"', async () => {
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { discover: jest.Mock };
    };
    DeviceModule.discover.mockRejectedValueOnce('No Device Found');
    const driver = new EscPosDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(ConnectionType.Bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.Loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.Loading, DeviceScanEventType.Empty]);
  });

  it('testPrint() reuses an already-open connection instead of reconnecting', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { connect: jest.Mock; write: jest.Mock };
    };
    const callsBeforeTestPrint = DeviceModule.connect.mock.calls.length;
    await driver.testPrint(lanPrinter, sampleDocuments);
    expect(DeviceModule.connect.mock.calls.length).toBe(callsBeforeTestPrint);
    expect(DeviceModule.write).toHaveBeenCalledWith('mock-connection', expect.any(String), expect.any(Number));
  });

  it('identify() returns null when not connected', async () => {
    const driver = new EscPosDriver();
    const result = await driver.identify('never-connected');
    expect(result).toBeNull();
  });

  it('identify() over BLE/LAN returns {} (weak confirm) when connected — native không có discriminator thật', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const result = await driver.identify(lanPrinter.id);
    expect(result).toEqual({});
  });

  it('connecting printer B on the same connectionType as already-connected printer A flips A to disconnected', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { type: ConnectionType.Lan, host: '192.168.1.50', port: 9100 } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { type: ConnectionType.Lan, host: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.Connected);

    await driver.connect(printerB);
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.Disconnected);
    expect(driver.getStatus(printerB.id)).toBe(PrinterStatus.Connected);
  });

  it('does not flip printer A to disconnected when connecting printer B on the same connectionType fails to connect natively', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { type: ConnectionType.Lan, host: '192.168.1.50', port: 9100 } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { type: ConnectionType.Lan, host: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.Connected);

    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { connect: jest.Mock } };
    DeviceModule.connect.mockRejectedValueOnce(new Error('native connect failed'));

    await expect(driver.connect(printerB)).rejects.toThrow();
    // printer A must still be reported as connected — the failed attempt on B
    // never touched the native connection, so A's real state is unchanged.
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.Connected);
  });

  it('testPrint() reconnects instead of taking the stale fast path when another printer has taken over the shared connection', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { type: ConnectionType.Lan, host: '192.168.1.50', port: 9100 } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { type: ConnectionType.Lan, host: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    await driver.connect(printerB);

    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { connect: jest.Mock };
    };
    const callsBeforeTestPrint = DeviceModule.connect.mock.calls.length;
    await driver.testPrint(printerA, sampleDocuments);
    expect(DeviceModule.connect.mock.calls.length).toBe(callsBeforeTestPrint + 1);
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.Connected);
  });

  it('connect() logs connectSucceeded on success', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { connectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.connectSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrintLanguage.EscPos, connectionType: ConnectionType.Lan }),
    );
  });

  it('connect() logs connectFailed on failure', async () => {
    const driver = new EscPosDriver();
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { connect: jest.Mock } };
    DeviceModule.connect.mockRejectedValueOnce(new Error('native connect failed'));
    await expect(driver.connect(lanPrinter)).rejects.toThrow();
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { connectFailed: jest.Mock };
    };
    expect(PrinterLogger.connectFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        printerId: lanPrinter.id,
        protocol: PrintLanguage.EscPos,
        connectionType: ConnectionType.Lan,
        errorCode: PrinterErrorCode.UNKNOWN_ERROR,
      }),
    );
  });

  it('disconnect() logs disconnectSucceeded', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    await driver.disconnect(lanPrinter.id);
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { disconnectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.disconnectSucceeded).toHaveBeenCalledWith({ printerId: lanPrinter.id, protocol: PrintLanguage.EscPos });
  });

  it('scan("bluetooth") logs scanCompleted with the device count on success', async () => {
    const driver = new EscPosDriver();
    await new Promise<void>((resolve) => {
      driver.scan(ConnectionType.Bluetooth, (event) => {
        if (event.type !== DeviceScanEventType.Loading) resolve();
      });
    });
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { scanCompleted: jest.Mock };
    };
    expect(PrinterLogger.scanCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: ConnectionType.Bluetooth, deviceCount: 0 }),
    );
  });

  it('scan("bluetooth") logs scanFailed on a genuine connection error (not "No Device Found")', async () => {
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { discover: jest.Mock };
    };
    DeviceModule.discover.mockRejectedValueOnce(new Error('bluetooth adapter off'));
    const driver = new EscPosDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(ConnectionType.Bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.Loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.Loading, DeviceScanEventType.Error]);
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { scanFailed: jest.Mock };
    };
    expect(PrinterLogger.scanFailed).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: ConnectionType.Bluetooth, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED }),
    );
  });

  it('testPrint() logs testPrintSucceeded', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    await driver.testPrint(lanPrinter, sampleDocuments);
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { testPrintSucceeded: jest.Mock };
    };
    expect(PrinterLogger.testPrintSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrintLanguage.EscPos }),
    );
  });

  it('testPrint() logs testPrintFailed (not just a bare connect failure) when the implicit reconnect fails', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../permissions/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new EscPosDriver();
    await expect(driver.testPrint(blePrinter, sampleDocuments)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { testPrintFailed: jest.Mock };
    };
    expect(PrinterLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: blePrinter.id, protocol: PrintLanguage.EscPos, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED }),
    );
  });

  it('testPrint() logs testPrintFailed when write fails', async () => {
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { write: jest.Mock };
    };
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    DeviceModule.write.mockRejectedValueOnce(new Error('print failed'));
    await expect(driver.testPrint(lanPrinter, sampleDocuments)).rejects.toThrow('print failed');
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { testPrintFailed: jest.Mock };
    };
    expect(PrinterLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrintLanguage.EscPos, errorCode: PrinterErrorCode.UNKNOWN_ERROR }),
    );
  });

  it('disconnect() does not call the native disconnect() for a printer that no longer owns the shared connection', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { type: ConnectionType.Lan, host: '192.168.1.50', port: 9100 } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { type: ConnectionType.Lan, host: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    await driver.connect(printerB);

    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { disconnect: jest.Mock };
    };
    DeviceModule.disconnect.mockClear();

    await driver.disconnect(printerA.id);
    expect(DeviceModule.disconnect).not.toHaveBeenCalled();
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.Disconnected);

    await driver.disconnect(printerB.id);
    expect(DeviceModule.disconnect).toHaveBeenCalledTimes(1);
    expect(driver.getStatus(printerB.id)).toBe(PrinterStatus.Disconnected);
  });

  it('print() joins text/line/table elements into a single write call', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { write: jest.Mock };
    };
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'line', x: 0, y: 10 },
        { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
      ],
    };
    await driver.print(lanPrinter.id, asDocuments(document));
    expect(DeviceModule.write).toHaveBeenCalledTimes(1);
    const [, base64] = DeviceModule.write.mock.calls[0] as [string, string, number];
    const decoded = bytesOf(base64).toString('utf8');
    // mỗi dòng vẫn liền mạch trong payload — chỉ các byte điều khiển (reset sau
    // mỗi \n) chen giữa CÁC dòng, không chen giữa nội dung 1 dòng.
    expect(decoded).toContain('Trà sữa');
    expect(decoded).toContain('-'.repeat(48));
    expect(decoded).toContain('Trà sữa  2');
  });

  it('print() renders a row element as a left/right-aligned line sized to the driver media paperSize', async () => {
    const printer58: Printer = { ...lanPrinter, paper: { ...lanPrinter.paper, paperSize: PaperSize.Mm58 } };
    const driver = new EscPosDriver();
    await driver.connect(printer58);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { write: jest.Mock };
    };
    const document: PrintDocument = { elements: [{ type: 'row', left: 'Mã đơn', right: '#001', x: 0, y: 0 }] };
    await driver.print(lanPrinter.id, asDocuments(document));
    const [, base64] = DeviceModule.write.mock.calls[0] as [string, string, number];
    expect(bytesOf(base64).toString('utf8')).toContain(`Mã đơn${' '.repeat(22)}#001`);
  });

  it('print() throws TSPL_ELEMENT_UNSUPPORTED for a barcode element without calling write', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { write: jest.Mock };
    };
    const callsBefore = DeviceModule.write.mock.calls.length;
    const document: PrintDocument = { elements: [{ type: 'barcode', content: '123', x: 0, y: 0 }] };
    await expect(driver.print(lanPrinter.id, asDocuments(document))).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
    expect(DeviceModule.write.mock.calls.length).toBe(callsBefore);
  });

  it('print() throws TSPL_ELEMENT_UNSUPPORTED for a qrCode element', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const document: PrintDocument = { elements: [{ type: 'qrCode', content: 'https://x', x: 0, y: 0 }] };
    await expect(driver.print(lanPrinter.id, asDocuments(document))).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
  });

  it('print() throws TSPL_ELEMENT_UNSUPPORTED for an image element', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const document: PrintDocument = { elements: [{ type: 'image', data: 'AAAA', x: 0, y: 0 }] };
    await expect(driver.print(lanPrinter.id, asDocuments(document))).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
  });

  it('print() validates all elements before sending anything — an unsupported element after valid ones still sends nothing', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { write: jest.Mock };
    };
    const callsBefore = DeviceModule.write.mock.calls.length;
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'barcode', content: '123', x: 0, y: 10 },
      ],
    };
    await expect(driver.print(lanPrinter.id, asDocuments(document))).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
    expect(DeviceModule.write.mock.calls.length).toBe(callsBefore);
  });

  it('print() throws PRINTER_NOT_CONNECTED when not connected', async () => {
    const driver = new EscPosDriver();
    const document: PrintDocument = { elements: [] };
    await expect(driver.print('never-connected', asDocuments(document))).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED });
  });

  it('print() throws PRINTER_NOT_CONNECTED when the printer is no longer the active owner of the shared connection', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { type: ConnectionType.Lan, host: '192.168.1.50', port: 9100 } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { type: ConnectionType.Lan, host: '192.168.1.51', port: 9100 } };
    await driver.connect(printerA);
    await driver.connect(printerB);
    const document: PrintDocument = { elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] };
    await expect(driver.print(printerA.id, asDocuments(document))).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED });
  });

  it('print() logs printSucceeded on success', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    await driver.print(lanPrinter.id, asDocuments({ elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] }));
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { printSucceeded: jest.Mock };
    };
    expect(PrinterLogger.printSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrintLanguage.EscPos }),
    );
  });

  it('print() logs printFailed when write fails', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      DeviceModule: { write: jest.Mock };
    };
    DeviceModule.write.mockRejectedValueOnce(new Error('print failed'));
    await expect(
      driver.print(lanPrinter.id, asDocuments({ elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] })),
    ).rejects.toThrow('print failed');
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { printFailed: jest.Mock };
    };
    expect(PrinterLogger.printFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrintLanguage.EscPos, errorCode: PrinterErrorCode.UNKNOWN_ERROR }),
    );
  });
});

describe('EscPosDriver — connection lost event', () => {
  it('cập nhật status Disconnected khi subscribeDeviceDisconnected bắn đúng identity đã connect', async () => {
    const { subscribeDeviceDisconnected, DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      subscribeDeviceDisconnected: jest.Mock;
      DeviceModule: { connect: jest.Mock };
    };
    DeviceModule.connect.mockResolvedValueOnce({ connectionId: 'USB:1155:22222:SERIAL', serialNumber: null });

    const driver = new EscPosDriver();
    const printer: Printer = makePrinter({
      id: 'p1',
      language: makeEscPosLanguage(),
      connection: { type: ConnectionType.Usb, vendorId: 1155, productId: 22222 },
    });
    await driver.connect(printer);

    const statuses: PrinterStatus[] = [];
    driver.onStatusChange(printer.id, (status) => statuses.push(status));

    const onConnectionLost = subscribeDeviceDisconnected.mock.calls[subscribeDeviceDisconnected.mock.calls.length - 1][0] as (event: { connectionId: string; reason: string }) => void;
    onConnectionLost({ connectionId: 'USB:1155:22222:SERIAL', reason: 'usb_detached' });

    expect(statuses).toEqual([PrinterStatus.Disconnected]);
  });

  it('bỏ qua identity không khớp printer nào đã connect', async () => {
    const { subscribeDeviceDisconnected, DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      subscribeDeviceDisconnected: jest.Mock;
      DeviceModule: { connect: jest.Mock };
    };
    DeviceModule.connect.mockResolvedValueOnce({ connectionId: 'USB:1155:22222:SERIAL', serialNumber: null });

    const driver = new EscPosDriver();
    const printer: Printer = makePrinter({
      id: 'p1',
      language: makeEscPosLanguage(),
      connection: { type: ConnectionType.Usb, vendorId: 1155, productId: 22222 },
    });
    await driver.connect(printer);

    const statuses: PrinterStatus[] = [];
    driver.onStatusChange(printer.id, (status) => statuses.push(status));

    const onConnectionLost = subscribeDeviceDisconnected.mock.calls[subscribeDeviceDisconnected.mock.calls.length - 1][0] as (event: { connectionId: string; reason: string }) => void;
    onConnectionLost({ connectionId: 'USB:9999:9999:OTHER', reason: 'usb_detached' });

    expect(statuses).toEqual([]);
  });

  it('chỉ đúng printerId khớp identity mới đổi status, printerId khác giữ nguyên', async () => {
    const { subscribeDeviceDisconnected, DeviceModule } = jest.requireMock('../../../adapters/native/DeviceModule') as {
      subscribeDeviceDisconnected: jest.Mock;
      DeviceModule: { connect: jest.Mock };
    };
    DeviceModule.connect.mockResolvedValueOnce({ connectionId: 'USB:1155:22222:SERIAL', serialNumber: null }).mockResolvedValueOnce({ connectionId: 'USB:9999:8888:OTHER', serialNumber: null });

    const driver = new EscPosDriver();
    const printerA: Printer = makePrinter({
      id: 'p-a',
      language: makeEscPosLanguage(),
      connection: { type: ConnectionType.Usb, vendorId: 1155, productId: 22222 },
    });
    const printerB: Printer = makePrinter({
      id: 'p-b',
      language: makeEscPosLanguage(),
      connection: { type: ConnectionType.Usb, vendorId: 9999, productId: 8888 },
    });
    await driver.connect(printerA);
    await driver.connect(printerB);

    const statusesA: PrinterStatus[] = [];
    const statusesB: PrinterStatus[] = [];
    driver.onStatusChange(printerA.id, (status) => statusesA.push(status));
    driver.onStatusChange(printerB.id, (status) => statusesB.push(status));

    const onConnectionLost = subscribeDeviceDisconnected.mock.calls[subscribeDeviceDisconnected.mock.calls.length - 1][0] as (event: { connectionId: string; reason: string }) => void;
    onConnectionLost({ connectionId: 'USB:9999:8888:OTHER', reason: 'usb_detached' });

    expect(statusesB).toEqual([PrinterStatus.Disconnected]);
    expect(statusesA).toEqual([]);
  });

  describe('trả kết nối khi đổi máy hoặc kết nối lại', () => {
    beforeEach(() => jest.clearAllMocks());

    const lanPrinterB: Printer = {
      ...lanPrinter,
      id: 'receipt-lan-b',
      connection: { type: ConnectionType.Lan, host: '192.168.1.51', port: 9100 },
    };

    const mockDeviceModule = () =>
      (jest.requireMock('../../../adapters/native/DeviceModule') as {
        DeviceModule: { connect: jest.Mock; disconnect: jest.Mock };
      }).DeviceModule;

    const connectedAs = (connectionId: string) => ({ connectionId, serialNumber: null });

    const disconnectedIds = (): string[] => mockDeviceModule().disconnect.mock.calls.map(([id]) => id as string);

    it('connect máy LAN khác thì trả kết nối của máy trước', async () => {
      mockDeviceModule()
        .connect.mockResolvedValueOnce(connectedAs('conn-a'))
        .mockResolvedValueOnce(connectedAs('conn-b'));
      const driver = new EscPosDriver();

      await driver.connect(lanPrinter);
      await driver.connect(lanPrinterB);

      expect(disconnectedIds()).toEqual(['conn-a']);
      expect(driver.getStatus(lanPrinter.id)).toBe(PrinterStatus.Disconnected);
    });

    it('connect lại cùng máy thì trả kết nối cũ đúng một lần', async () => {
      mockDeviceModule()
        .connect.mockResolvedValueOnce(connectedAs('conn-a1'))
        .mockResolvedValueOnce(connectedAs('conn-a2'));
      const driver = new EscPosDriver();

      await driver.connect(lanPrinter);
      await driver.connect(lanPrinter);

      expect(disconnectedIds()).toEqual(['conn-a1']);
    });

    it('máy mất quyền rồi in thử kết nối lại, disconnect thì mọi kết nối đều được trả đúng một lần', async () => {
      mockDeviceModule()
        .connect.mockResolvedValueOnce(connectedAs('conn-a'))
        .mockResolvedValueOnce(connectedAs('conn-b'))
        .mockResolvedValueOnce(connectedAs('conn-a2'));
      const driver = new EscPosDriver();

      await driver.connect(lanPrinter);
      await driver.connect(lanPrinterB);
      await driver.testPrint(lanPrinter, sampleDocuments);
      await driver.disconnect(lanPrinter.id);

      const ids = disconnectedIds();
      expect(ids.filter((id) => id === 'conn-a')).toHaveLength(1);
      expect(ids.filter((id) => id === 'conn-a2')).toHaveLength(1);
    });
  });
});
