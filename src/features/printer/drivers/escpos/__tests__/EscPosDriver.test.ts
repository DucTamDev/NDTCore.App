import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import { EscPosDriver } from '../EscPosDriver';
import { buildEscPosText } from '../EscPosTextBuilder';
import { DeviceScanEventType } from '../../../models/printer/PrinterDevice';
import { PrinterConnectionType } from '../../../models/printer/PrinterConnection';
import { RenderMode, PrinterDriverType } from '../../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../../models/printer/PrinterStatus';
import { CutterMode, PaperSize } from '../../../models/paper/PrintPaperConfig';
import { type Printer } from '../../../models/printer/Printer';
import { makePrinter, makeEscPosDriver } from '../../../testing/printerFixtures';
import type { PrintDocuments } from '../../IPrinterDriver';

jest.mock('../../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));
import type { PrintDocument } from '../../../models/printing/PrintDocument';
import { PrinterErrorCode } from '../../../errors/PrinterError';

// EscPosDriver đi qua NativeAdapter (không mock) → ThermalPrinterModule
// (adapters/native/PrinterNativeModule), gọi thẳng theo printerId (không còn
// namespace USBPrinter/BLEPrinter/NetPrinter). USB đi qua UsbTransport (cũng
// không mock) — cùng dùng ThermalPrinterModule nên mock 1 chỗ là đủ.
jest.mock('../../../adapters/native/PrinterNativeModule', () => ({
  ThermalPrinterModule: {
    discoverPrinters: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('ok'),
  },
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

/** Decode payload `writeByBase64` nhận được về lại bytes gốc để assert nội dung/ESC-byte. */
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
  identityKey: 'lan:192.168.1.50:9100',
  connection: { type: PrinterConnectionType.Lan, host: '192.168.1.50', port: 9100 },
});

const blePrinter: Printer = {
  ...lanPrinter,
  id: 'receipt-ble',
  connection: { type: PrinterConnectionType.Bluetooth, deviceId: '00:11:22:33:44:55', name: 'Máy in BLE' },
};

const usbPrinter: Printer = {
  ...lanPrinter,
  id: 'receipt-usb',
  connection: { type: PrinterConnectionType.Usb, vendorId: 1155, productId: 22222 },
};

const bitmapPrinter: Printer = { ...lanPrinter, driver: makeEscPosDriver({ config: { renderMode: RenderMode.Bitmap } }) };

const sampleDocuments: PrintDocuments = { text: { elements: [{ type: 'text', content: 'In thử', x: 0, y: 0 }] } };

const asDocuments = (document: PrintDocument): PrintDocuments => ({ text: document });

// `NativeAdapter.printText` (dùng bởi EscPosDriver) có nhánh iOS gọi thẳng
// NativeModules.RN*Printer cũ (native iOS chưa implement kiến trúc printerId
// mới — ngoài phạm vi Android-only, xem NativeAdapter.ts). Jest preset RN mặc
// định Platform.OS='ios' — ép 'android' để test đúng nhánh ThermalPrinterModule
// thật sự chạy trên thiết bị.
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
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { ThermalPrinterModule: { connect: jest.Mock } };
    expect(ThermalPrinterModule.connect).toHaveBeenCalledWith({ printerId: lanPrinter.id, type: 'lan', host: '192.168.1.50', port: 9100 });
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

  it('print() encodes buildEscPosText() into ESC/POS bytes and writes via writeByBase64(printerId, ...)', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { ThermalPrinterModule: { writeByBase64: jest.Mock } };
    await driver.print(lanPrinter.id, sampleDocuments);
    expect(ThermalPrinterModule.writeByBase64).toHaveBeenCalledTimes(1);
    const [printerId, base64] = ThermalPrinterModule.writeByBase64.mock.calls[0] as [string, string];
    expect(printerId).toBe(lanPrinter.id);
    expect(bytesOf(base64).toString('utf8')).toContain('In thử');
  });

  it('sendDocuments gửi cut:true khi media.cutterMode undefined (mặc định giữ hành vi cũ)', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { ThermalPrinterModule: { writeByBase64: jest.Mock } };
    await driver.print(lanPrinter.id, sampleDocuments);
    const [, base64] = ThermalPrinterModule.writeByBase64.mock.calls[0] as [string, string];
    expect(bytesOf(base64).includes(Buffer.from([27, 109]))).toBe(true); // cut_bytes
  });

  it('sendDocuments gửi cut:false khi media.cutterMode = none', async () => {
    const noCutPrinter: Printer = { ...lanPrinter, paper: { ...lanPrinter.paper, cutterMode: CutterMode.None } };
    const driver = new EscPosDriver();
    await driver.connect(noCutPrinter);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { ThermalPrinterModule: { writeByBase64: jest.Mock } };
    await driver.print(lanPrinter.id, sampleDocuments);
    const [, base64] = ThermalPrinterModule.writeByBase64.mock.calls[0] as [string, string];
    expect(bytesOf(base64).includes(Buffer.from([27, 109]))).toBe(false); // cut_bytes absent
  });

  it('sendDocuments bitmap mode: thiếu documents.image → ném IMAGE_REQUIRED, KHÔNG gọi writeByBase64', async () => {
    const driver = new EscPosDriver();
    await driver.connect(bitmapPrinter);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { ThermalPrinterModule: { writeByBase64: jest.Mock } };
    await expect(driver.print(lanPrinter.id, { text: sampleDocuments.text })).rejects.toMatchObject({ code: PrinterErrorCode.IMAGE_REQUIRED });
    expect(ThermalPrinterModule.writeByBase64).not.toHaveBeenCalled();
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

  it('sendDocuments bitmap mode: ảnh hợp lệ → gửi lệnh GS v 0 qua adapter.write() (writeByBase64), KHÔNG dùng printText()', async () => {
    const driver = new EscPosDriver();
    await driver.connect(bitmapPrinter);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { ThermalPrinterModule: { writeByBase64: jest.Mock } };
    await driver.print(lanPrinter.id, { text: sampleDocuments.text, image: tinyPngBase64() });
    expect(ThermalPrinterModule.writeByBase64).toHaveBeenCalledTimes(1);
    const [printerId, base64] = ThermalPrinterModule.writeByBase64.mock.calls[0] as [string, string];
    expect(printerId).toBe(lanPrinter.id);
    const bytes = bytesOf(base64);
    // ESC @ rồi GS v 0 (m=0), không phải text ESC/POS encode qua EPToolkit —
    // printText() không bao giờ phát ra byte 0x1d,0x76,0x30.
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0x1b, 0x40]));
    expect(bytes.subarray(2, 6)).toEqual(Buffer.from([0x1d, 0x76, 0x30, 0x00]));
    // eslint-disable-next-line no-bitwise -- intentional low-byte/high-byte reconstruction of a little-endian field
    const widthBytes = bytes[6] | (bytes[7] << 8);
    expect(widthBytes).toBe(72); // ceil(PAPER_SIZE_SPECS[80].imageWidthPx / 8) = ceil(576/8)
    // media.cutterMode undefined trên continuous → resolveEffectiveCutterMode = perJob → có cut_bytes cuối payload.
    expect(bytes.subarray(bytes.length - 2)).toEqual(Buffer.from([0x1b, 0x6d]));
  });

  it('sendDocuments bitmap mode: cutterMode = none → không phát cut_bytes cuối payload', async () => {
    const noCutBitmapPrinter: Printer = { ...bitmapPrinter, paper: { ...bitmapPrinter.paper, cutterMode: CutterMode.None } };
    const driver = new EscPosDriver();
    await driver.connect(noCutBitmapPrinter);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { ThermalPrinterModule: { writeByBase64: jest.Mock } };
    await driver.print(lanPrinter.id, { text: sampleDocuments.text, image: tinyPngBase64() });
    const [, base64] = ThermalPrinterModule.writeByBase64.mock.calls[0] as [string, string];
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
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { connect: jest.Mock };
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(ThermalPrinterModule.connect).toHaveBeenCalledWith({ printerId: blePrinter.id, type: 'bluetooth', address: '00:11:22:33:44:55' });
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
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { connect: jest.Mock };
    };
    expect(ThermalPrinterModule.connect).toHaveBeenCalledWith({ printerId: usbPrinter.id, type: 'usb', vendorId: 1155, productId: 22222 });
  });

  it('disconnect() closes the connection and sets status disconnected', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    await driver.disconnect(lanPrinter.id);
    expect(driver.getStatus(lanPrinter.id)).toBe(PrinterStatus.Disconnected);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { disconnect: jest.Mock };
    };
    expect(ThermalPrinterModule.disconnect).toHaveBeenCalledWith(lanPrinter.id);
  });

  it('disconnect() sets status error (not stuck at disconnecting), logs disconnectFailed and rethrows PRINTER_CONNECTION_FAILED when native disconnect() rejects', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { disconnect: jest.Mock };
    };
    ThermalPrinterModule.disconnect.mockRejectedValueOnce(new Error('socket already closed'));
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);

    await expect(driver.disconnect(lanPrinter.id)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
    expect(driver.getStatus(lanPrinter.id)).toBe(PrinterStatus.Error);

    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { disconnectFailed: jest.Mock };
    };
    expect(PrinterLogger.disconnectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.EscPos }),
    );
  });

  it('disconnect() clears activeByType bookkeeping despite the native failure — a second printer on the same connectionType is not blocked forever', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { disconnect: jest.Mock };
    };
    ThermalPrinterModule.disconnect.mockRejectedValueOnce(new Error('socket already closed'));
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
    driver.scan(PrinterConnectionType.Lan, (event) => events.push(event.type));
    expect(events).toEqual([DeviceScanEventType.Empty]);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { discoverPrinters: jest.Mock };
    };
    expect(ThermalPrinterModule.discoverPrinters).not.toHaveBeenCalled();
  });

  it('scan("bluetooth") checks permission before calling discoverPrinters', async () => {
    const driver = new EscPosDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(PrinterConnectionType.Bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.Loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.Loading, DeviceScanEventType.Empty]);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { discoverPrinters: jest.Mock };
    };
    expect(ThermalPrinterModule.discoverPrinters).toHaveBeenCalledWith(PrinterConnectionType.Bluetooth);
  });

  it('scan("bluetooth") emits an error event when ensureBluetoothPermission itself rejects', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../permissions/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockRejectedValueOnce(new Error('permission check failed'));
    const driver = new EscPosDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(PrinterConnectionType.Bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.Loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.Loading, DeviceScanEventType.Error]);
  });

  it('scan("bluetooth") emits empty (not error) when discoverPrinters rejects with "No Device Found"', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { discoverPrinters: jest.Mock };
    };
    ThermalPrinterModule.discoverPrinters.mockRejectedValueOnce('No Device Found');
    const driver = new EscPosDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(PrinterConnectionType.Bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.Loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.Loading, DeviceScanEventType.Empty]);
  });

  it('testPrint() reuses an already-open connection instead of reconnecting', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { connect: jest.Mock; writeByBase64: jest.Mock };
    };
    const callsBeforeTestPrint = ThermalPrinterModule.connect.mock.calls.length;
    await driver.testPrint(lanPrinter, sampleDocuments);
    expect(ThermalPrinterModule.connect.mock.calls.length).toBe(callsBeforeTestPrint);
    expect(ThermalPrinterModule.writeByBase64).toHaveBeenCalledWith(lanPrinter.id, expect.any(String));
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
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { type: PrinterConnectionType.Lan, host: '192.168.1.50', port: 9100 } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { type: PrinterConnectionType.Lan, host: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.Connected);

    await driver.connect(printerB);
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.Disconnected);
    expect(driver.getStatus(printerB.id)).toBe(PrinterStatus.Connected);
  });

  it('does not flip printer A to disconnected when connecting printer B on the same connectionType fails to connect natively', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { type: PrinterConnectionType.Lan, host: '192.168.1.50', port: 9100 } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { type: PrinterConnectionType.Lan, host: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.Connected);

    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { ThermalPrinterModule: { connect: jest.Mock } };
    ThermalPrinterModule.connect.mockRejectedValueOnce(new Error('native connect failed'));

    await expect(driver.connect(printerB)).rejects.toThrow();
    // printer A must still be reported as connected — the failed attempt on B
    // never touched the native connection, so A's real state is unchanged.
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.Connected);
  });

  it('testPrint() reconnects instead of taking the stale fast path when another printer has taken over the shared connection', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { type: PrinterConnectionType.Lan, host: '192.168.1.50', port: 9100 } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { type: PrinterConnectionType.Lan, host: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    await driver.connect(printerB);

    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { connect: jest.Mock };
    };
    const callsBeforeTestPrint = ThermalPrinterModule.connect.mock.calls.length;
    await driver.testPrint(printerA, sampleDocuments);
    expect(ThermalPrinterModule.connect.mock.calls.length).toBe(callsBeforeTestPrint + 1);
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.Connected);
  });

  it('connect() logs connectSucceeded on success', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { connectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.connectSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.EscPos, connectionType: PrinterConnectionType.Lan }),
    );
  });

  it('connect() logs connectFailed on failure', async () => {
    const driver = new EscPosDriver();
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as { ThermalPrinterModule: { connect: jest.Mock } };
    ThermalPrinterModule.connect.mockRejectedValueOnce(new Error('native connect failed'));
    await expect(driver.connect(lanPrinter)).rejects.toThrow();
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { connectFailed: jest.Mock };
    };
    expect(PrinterLogger.connectFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        printerId: lanPrinter.id,
        protocol: PrinterDriverType.EscPos,
        connectionType: PrinterConnectionType.Lan,
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
    expect(PrinterLogger.disconnectSucceeded).toHaveBeenCalledWith({ printerId: lanPrinter.id, protocol: PrinterDriverType.EscPos });
  });

  it('scan("bluetooth") logs scanCompleted with the device count on success', async () => {
    const driver = new EscPosDriver();
    await new Promise<void>((resolve) => {
      driver.scan(PrinterConnectionType.Bluetooth, (event) => {
        if (event.type !== DeviceScanEventType.Loading) resolve();
      });
    });
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { scanCompleted: jest.Mock };
    };
    expect(PrinterLogger.scanCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: PrinterConnectionType.Bluetooth, deviceCount: 0 }),
    );
  });

  it('scan("bluetooth") logs scanFailed on a genuine connection error (not "No Device Found")', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { discoverPrinters: jest.Mock };
    };
    ThermalPrinterModule.discoverPrinters.mockRejectedValueOnce(new Error('bluetooth adapter off'));
    const driver = new EscPosDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(PrinterConnectionType.Bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.Loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.Loading, DeviceScanEventType.Error]);
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { scanFailed: jest.Mock };
    };
    expect(PrinterLogger.scanFailed).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: PrinterConnectionType.Bluetooth, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED }),
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
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.EscPos }),
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
      expect.objectContaining({ printerId: blePrinter.id, protocol: PrinterDriverType.EscPos, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED }),
    );
  });

  it('testPrint() logs testPrintFailed when writeByBase64 fails', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { writeByBase64: jest.Mock };
    };
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    ThermalPrinterModule.writeByBase64.mockRejectedValueOnce(new Error('print failed'));
    await expect(driver.testPrint(lanPrinter, sampleDocuments)).rejects.toThrow('print failed');
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { testPrintFailed: jest.Mock };
    };
    expect(PrinterLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.EscPos, errorCode: PrinterErrorCode.UNKNOWN_ERROR }),
    );
  });

  it('disconnect() does not call the native disconnect() for a printer that no longer owns the shared connection', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { type: PrinterConnectionType.Lan, host: '192.168.1.50', port: 9100 } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { type: PrinterConnectionType.Lan, host: '192.168.1.51', port: 9100 } };

    await driver.connect(printerA);
    await driver.connect(printerB);

    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { disconnect: jest.Mock };
    };
    ThermalPrinterModule.disconnect.mockClear();

    await driver.disconnect(printerA.id);
    expect(ThermalPrinterModule.disconnect).not.toHaveBeenCalled();
    expect(driver.getStatus(printerA.id)).toBe(PrinterStatus.Disconnected);

    await driver.disconnect(printerB.id);
    expect(ThermalPrinterModule.disconnect).toHaveBeenCalledTimes(1);
    expect(driver.getStatus(printerB.id)).toBe(PrinterStatus.Disconnected);
  });

  it('print() joins text/line/table elements into a single writeByBase64 call', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { writeByBase64: jest.Mock };
    };
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'line', x: 0, y: 10 },
        { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
      ],
    };
    await driver.print(lanPrinter.id, asDocuments(document));
    expect(ThermalPrinterModule.writeByBase64).toHaveBeenCalledTimes(1);
    const [, base64] = ThermalPrinterModule.writeByBase64.mock.calls[0] as [string, string];
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
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { writeByBase64: jest.Mock };
    };
    const document: PrintDocument = { elements: [{ type: 'row', left: 'Mã đơn', right: '#001', x: 0, y: 0 }] };
    await driver.print(lanPrinter.id, asDocuments(document));
    const [, base64] = ThermalPrinterModule.writeByBase64.mock.calls[0] as [string, string];
    expect(bytesOf(base64).toString('utf8')).toContain(`Mã đơn${' '.repeat(22)}#001`);
  });

  it('print() throws TSPL_ELEMENT_UNSUPPORTED for a barcode element without calling writeByBase64', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { writeByBase64: jest.Mock };
    };
    const callsBefore = ThermalPrinterModule.writeByBase64.mock.calls.length;
    const document: PrintDocument = { elements: [{ type: 'barcode', content: '123', x: 0, y: 0 }] };
    await expect(driver.print(lanPrinter.id, asDocuments(document))).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
    expect(ThermalPrinterModule.writeByBase64.mock.calls.length).toBe(callsBefore);
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
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { writeByBase64: jest.Mock };
    };
    const callsBefore = ThermalPrinterModule.writeByBase64.mock.calls.length;
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'barcode', content: '123', x: 0, y: 10 },
      ],
    };
    await expect(driver.print(lanPrinter.id, asDocuments(document))).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
    expect(ThermalPrinterModule.writeByBase64.mock.calls.length).toBe(callsBefore);
  });

  it('print() throws PRINTER_NOT_CONNECTED when not connected', async () => {
    const driver = new EscPosDriver();
    const document: PrintDocument = { elements: [] };
    await expect(driver.print('never-connected', asDocuments(document))).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED });
  });

  it('print() throws PRINTER_NOT_CONNECTED when the printer is no longer the active owner of the shared connection', async () => {
    const driver = new EscPosDriver();
    const printerA: Printer = { ...lanPrinter, id: 'receipt-lan-a', connection: { type: PrinterConnectionType.Lan, host: '192.168.1.50', port: 9100 } };
    const printerB: Printer = { ...lanPrinter, id: 'receipt-lan-b', connection: { type: PrinterConnectionType.Lan, host: '192.168.1.51', port: 9100 } };
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
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.EscPos }),
    );
  });

  it('print() logs printFailed when writeByBase64 fails', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter);
    const { ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { writeByBase64: jest.Mock };
    };
    ThermalPrinterModule.writeByBase64.mockRejectedValueOnce(new Error('print failed'));
    await expect(
      driver.print(lanPrinter.id, asDocuments({ elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] })),
    ).rejects.toThrow('print failed');
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { printFailed: jest.Mock };
    };
    expect(PrinterLogger.printFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.EscPos, errorCode: PrinterErrorCode.UNKNOWN_ERROR }),
    );
  });
});
