import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { TsplDriver } from '../TsplDriver';
import { TsplFontManager, DEFAULT_TSPL_FONT } from '../TsplFontManager';
import { ConnectionType, DeviceScanEventType, DriverSource, PrinterDriverType, PrinterStatus, TsplRenderMode, type Printer, type PrinterDriver } from '../../../types/printer.types';
import { PrintType } from '../../../types/printConfiguration.types';
import type { PrintDocumentVariants } from '../../../types/driver.types';
import type { PrintDocument, PrintElement } from '../../../types/printDocument.types';
import { AppErrorCode } from '../../../types/AppError';

// `../TsplFontManager` is automocked (no factory) below so `mock.instances`
// reflects the real class shape — but automocking still `require`s the real
// module to introspect it, which transitively pulls in the real
// `react-native-fs` (untranspiled Flow syntax, not in this project's Jest
// `transformIgnorePatterns`). Stub it out the same way TsplFontManager's own
// test does, purely to keep that require from crashing the parser.
jest.mock('react-native-fs', () => ({
  readFileAssets: jest.fn(),
}));
jest.mock('../TsplFontManager');

/**
 * `TsplDriver.print()` decodes 'image' elements as real PNG bytes — a
 * placeholder string like 'AAAA' would throw "not a PNG file". `forbidPlte:
 * true` is required here — `upng-js`'s own palette-mode encoder has a real
 * bug on very small/low-color images (verified: for a 2x1 2-color image, its
 * decoder leaves `decoded.data` `undefined`, crashing `toRGBA8()`); forcing
 * truecolor (ctype 2) sidesteps that encoder path entirely. This is a
 * upng-js encoder quirk specific to tiny synthetic test fixtures, not a
 * production risk — real bill screenshots from `react-native-view-shot` are
 * far larger/more complex than this edge case triggers on.
 */
const tinyPngBase64 = (): string => {
  const rgba = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]); // 2x1: black, white
  return Buffer.from(new Uint8Array(UPNG.encode([rgba.buffer], 2, 1, 0, [], true))).toString('base64');
};

/** 2x2 (aspect vuông) — sau khi chuẩn hoá về `PAPER_IMAGE_WIDTH_PX[58]` (384px), chiều cao ra 384px, vượt `LABEL_HEIGHT_MM * DOTS_PER_MM` (240px). */
const squarePngBase64 = (): string => {
  const rgba = new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]); // 2x2, toàn đen
  return Buffer.from(new Uint8Array(UPNG.encode([rgba.buffer], 2, 2, 0, [], true))).toString('base64');
};

jest.mock('../../../transports/LanTransport', () => ({
  LanTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn(),
    readOnce: jest.fn().mockResolvedValue(null),
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
jest.mock('../../../transports/UsbTransport', () => ({
  UsbTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('../../../services/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../../services/PrinterLogger', () => ({
  PrinterLogger: {
    scanCompleted: jest.fn(),
    scanFailed: jest.fn(),
    connectSucceeded: jest.fn(),
    connectFailed: jest.fn(),
    disconnectSucceeded: jest.fn(),
    disconnectFailed: jest.fn(),
    testPrintSucceeded: jest.fn(),
    testPrintFailed: jest.fn(),
  },
}));

const tsplDriverEntry: PrinterDriver = {
  type: PrinterDriverType.tspl,
  source: DriverSource.auto,
  contentTypes: [PrintType.Label],
  config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap },
};

const lanPrinter: Printer = {
  id: 'label-1',
  name: 'Máy in tem',
  drivers: [tsplDriverEntry],
  connectionType: ConnectionType.lan,
  lan: { ip: '192.168.1.60', port: 9100 },
  identityKey: 'lan:192.168.1.60:9100',
  paperSize: 58,
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const usbPrinter: Printer = {
  ...lanPrinter,
  id: 'label-usb',
  connectionType: ConnectionType.usb,
  lan: undefined,
  device: { deviceId: '1155:22222', displayName: 'Máy in tem USB', rawDevice: { vendor_id: 1155, product_id: 22222 } },
};

const usbPrinterNoDevice: Printer = {
  ...lanPrinter,
  id: 'label-usb-nodevice',
  connectionType: ConnectionType.usb,
  lan: undefined,
  device: undefined,
};

const bluetoothPrinter: Printer = {
  ...lanPrinter,
  id: 'label-bt',
  connectionType: ConnectionType.bluetooth,
  lan: undefined,
  device: { deviceId: '00:11:22:33:44:66', displayName: 'Máy in tem BT', rawDevice: {} },
};

const sampleDocuments: PrintDocumentVariants = {
  text: { elements: [{ type: 'text', content: 'In thử', x: 0, y: 0 }] },
  image: { elements: [{ type: 'image', data: tinyPngBase64(), x: 0, y: 0 }] },
};

/** Bitmap mode (mặc định) không còn fallback về `text` khi thiếu `image` — dùng riêng để test đúng trường hợp đó. */
const textOnlyDocuments: PrintDocumentVariants = { text: sampleDocuments.text };

/** `image` = `text` — bitmap mode bắt buộc có `documents.image`, xem `TsplDriver.resolveDocumentAndFont()`. */
const asDocuments = (document: PrintDocument): PrintDocumentVariants => ({ text: document, image: document });

describe('TsplDriver', () => {
  it('connect() over LAN transitions status idle -> connecting -> connected', async () => {
    const driver = new TsplDriver();
    const statuses: string[] = [];
    driver.onStatusChange(lanPrinter.id, (status) => statuses.push(status));
    expect(driver.getStatus(lanPrinter.id)).toBe(PrinterStatus.idle);
    await driver.connect(lanPrinter, tsplDriverEntry);
    expect(statuses).toEqual([PrinterStatus.connecting, PrinterStatus.connected]);
    expect(driver.getStatus(lanPrinter.id)).toBe(PrinterStatus.connected);
  });

  it('disconnect() transitions to disconnected and clears the connection', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await driver.disconnect(lanPrinter.id);
    expect(driver.getStatus(lanPrinter.id)).toBe(PrinterStatus.disconnected);
  });

  it('disconnect() sets status error (not stuck at disconnecting), logs disconnectFailed and rethrows CONNECTION_ERROR when transport.close() rejects', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as {
      close: jest.Mock;
    };
    instance.close.mockRejectedValueOnce(new Error('socket already destroyed'));

    await expect(driver.disconnect(lanPrinter.id)).rejects.toMatchObject({ code: AppErrorCode.CONNECTION_ERROR });
    expect(driver.getStatus(lanPrinter.id)).toBe(PrinterStatus.error);

    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { disconnectFailed: jest.Mock };
    };
    expect(PrinterLogger.disconnectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.tspl }),
    );
  });

  it('disconnect() clears the stale transport reference despite the native failure — print() afterwards correctly reports CONNECTION_ERROR instead of using a broken transport', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as {
      close: jest.Mock;
    };
    instance.close.mockRejectedValueOnce(new Error('socket already destroyed'));
    await driver.disconnect(lanPrinter.id).catch(() => undefined);

    await expect(
      driver.print(lanPrinter.id, asDocuments({ elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] })),
    ).rejects.toMatchObject({ code: AppErrorCode.CONNECTION_ERROR });
  });

  it('connect() over USB rejects with VALIDATION_ERROR when no device was chosen', async () => {
    const driver = new TsplDriver();
    await expect(driver.connect(usbPrinterNoDevice, tsplDriverEntry)).rejects.toMatchObject({ code: AppErrorCode.VALIDATION_ERROR });
    expect(driver.getStatus(usbPrinterNoDevice.id)).toBe(PrinterStatus.error);
  });

  it('connect() over USB reads vendor_id/product_id from the scanned rawDevice as numbers', async () => {
    const driver = new TsplDriver();
    await driver.connect(usbPrinter, tsplDriverEntry);
    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    const instance = UsbTransport.mock.results[UsbTransport.mock.results.length - 1].value as { connect: jest.Mock };
    expect(instance.connect).toHaveBeenCalledWith(1155, 22222);
  });

  it('connect() over USB reads vendor_id/product_id from the scanned rawDevice as numbers and transitions to connected', async () => {
    const driver = new TsplDriver();
    await driver.connect(usbPrinter, tsplDriverEntry);
    expect(driver.getStatus(usbPrinter.id)).toBe(PrinterStatus.connected);
  });

  it('testPrint() over USB writes through UsbTransport', async () => {
    const driver = new TsplDriver();
    await driver.connect(usbPrinter, tsplDriverEntry);
    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    const instance = UsbTransport.mock.results[UsbTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.testPrint(usbPrinter, tsplDriverEntry, sampleDocuments);
    expect(instance.write).toHaveBeenCalled();
  });

  it('print() over USB writes through UsbTransport', async () => {
    const driver = new TsplDriver();
    await driver.connect(usbPrinter, tsplDriverEntry);
    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    const instance = UsbTransport.mock.results[UsbTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.print(usbPrinter.id, asDocuments({ elements: [{ type: 'text', content: 'Trà sữa', x: 0, y: 0 }] }));
    expect(instance.write).toHaveBeenCalled();
  });

  it('identify() over USB returns null (no readOnce capability)', async () => {
    const driver = new TsplDriver();
    await driver.connect(usbPrinter, tsplDriverEntry);
    const result = await driver.identify(usbPrinter.id);
    expect(result).toBeNull();
  });

  it('scan() on lan immediately reports empty (no scan for LAN)', () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    driver.scan(ConnectionType.lan, (event) => events.push(event.type));
    expect(events).toEqual([DeviceScanEventType.empty]);
  });

  it('scan() on usb immediately reports error', () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    driver.scan(ConnectionType.usb, (event) => events.push(event.type));
    expect(events).toEqual([DeviceScanEventType.error]);
  });

  it('testPrint() reuses an already-open connection instead of reconnecting', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const callsBeforeTestPrint = LanTransport.mock.calls.length;
    await driver.testPrint(lanPrinter, tsplDriverEntry, sampleDocuments);
    expect(LanTransport.mock.calls.length).toBe(callsBeforeTestPrint);
  });

  it('identify() returns null when not connected', async () => {
    const driver = new TsplDriver();
    expect(await driver.identify('never-connected')).toBeNull();
  });

  it('identify() returns null when the transport does not respond in time', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const result = await driver.identify(lanPrinter.id);
    expect(result).toBeNull();
  });

  it('print() encodes every element kind and writes once', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'line', x: 0, y: 10 },
        { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
        { type: 'row', left: 'Mã đơn', right: '#001', x: 0, y: 40 },
        { type: 'image', data: tinyPngBase64(), x: 0, y: 60 },
        { type: 'barcode', content: '123', x: 0, y: 80 },
        { type: 'qrCode', content: 'https://x', x: 0, y: 100 },
      ],
    };
    await expect(driver.print(lanPrinter.id, asDocuments(document))).resolves.toBeUndefined();
  });

  it('print() renders a row element as a left/right-aligned line sized to paperSize', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.print(lanPrinter.id, asDocuments({ elements: [{ type: 'row', left: 'Ma don', right: '#001', x: 5, y: 10 }] }));
    const bytes = instance.write.mock.calls[0][0] as Uint8Array;
    const text = String.fromCharCode(...Array.from(bytes));
    // 58mm = 32 ký tự, 'Ma don' (6) + 'a#001'... gap = 32 - 6 - 4 = 22 khoảng trắng.
    expect(text).toContain(`TEXT 5,10,"3",0,1,1,"Ma don${' '.repeat(22)}#001"`);
  });

  it('print() decodes an image element into a real BITMAP command (widthBytes = ceil(width/8))', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.print(lanPrinter.id, asDocuments({ elements: [{ type: 'image', data: tinyPngBase64(), x: 3, y: 7 }] }));
    const bytes = instance.write.mock.calls[0][0] as Uint8Array;
    // `initialize()` viết SIZE/GAP/CODEPAGE/CLS trước — tìm đúng vị trí bắt
    // đầu của "BITMAP" trong toàn bộ byte stream thay vì giả định index 0.
    const asAscii = Array.from(bytes.slice(0, 200)).map((b) => String.fromCharCode(b)).join('');
    const bitmapStart = asAscii.indexOf('BITMAP');
    expect(bitmapStart).toBeGreaterThan(-1);
    // `TsplDriver` chuẩn hoá mọi ảnh về đúng `PAPER_IMAGE_WIDTH_PX[58]`
    // (384px, xem `decodePngBase64ToMonochrome`) bất kể kích thước gốc — ảnh
    // test rộng 2px bị scale lên 384px (widthBytes = ceil(384/8) = 48), cao
    // tương ứng theo tỉ lệ (1px * 384/2 = 192px).
    const header = 'BITMAP 3,7,48,192,0,';
    expect(asAscii.slice(bitmapStart, bitmapStart + header.length)).toBe(header);
  });

  it('print() rejects with ENCODING_FAILED when the image is taller than the declared label height', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await expect(
      driver.print(lanPrinter.id, asDocuments({ elements: [{ type: 'image', data: squarePngBase64(), x: 0, y: 0 }] }), PrintType.Label),
    ).rejects.toMatchObject({ code: AppErrorCode.ENCODING_FAILED });
  });

  it('print() does NOT reject the same oversized-for-Label image when printing a Receipt (continuous paper, no fixed label height)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await expect(
      driver.print(lanPrinter.id, asDocuments({ elements: [{ type: 'image', data: squarePngBase64(), x: 0, y: 0 }] }), PrintType.Receipt),
    ).resolves.toBeUndefined();
  });

  it('print() rejects with ENCODING_FAILED for an unsupported element', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const badElement = { type: 'unknown-kind', x: 0, y: 0 } as unknown as PrintElement;
    await expect(driver.print(lanPrinter.id, asDocuments({ elements: [badElement] }))).rejects.toMatchObject({
      code: AppErrorCode.ENCODING_FAILED,
    });
  });

  it('identify() returns a non-null PrinterDeviceInfo when the transport responds', async () => {
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as {
      LanTransport: jest.Mock;
    };
    LanTransport.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      write: jest.fn(),
      readOnce: jest.fn().mockResolvedValue(new Uint8Array([0x01])),
      close: jest.fn(),
    }));
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const result = await driver.identify(lanPrinter.id);
    expect(result).not.toBeNull();
  });

  it('connect() over Bluetooth checks permission before connecting', async () => {
    const driver = new TsplDriver();
    await driver.connect(bluetoothPrinter, tsplDriverEntry);
    const { ensureBluetoothPermission } = jest.requireMock('../../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(driver.getStatus(bluetoothPrinter.id)).toBe(PrinterStatus.connected);
  });

  it('connect() over Bluetooth fails with CONNECTION_ERROR when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new TsplDriver();
    await expect(driver.connect(bluetoothPrinter, tsplDriverEntry)).rejects.toMatchObject({ code: AppErrorCode.CONNECTION_ERROR });
    expect(driver.getStatus(bluetoothPrinter.id)).toBe(PrinterStatus.error);
  });

  it('connect() logs connectSucceeded on success', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { connectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.connectSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.tspl, connectionType: ConnectionType.lan }),
    );
  });

  it('connect() logs connectFailed on failure', async () => {
    const driver = new TsplDriver();
    await expect(driver.connect(usbPrinterNoDevice, tsplDriverEntry)).rejects.toMatchObject({ code: AppErrorCode.VALIDATION_ERROR });
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { connectFailed: jest.Mock };
    };
    expect(PrinterLogger.connectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: usbPrinterNoDevice.id, protocol: PrinterDriverType.tspl, connectionType: ConnectionType.usb }),
    );
  });

  it('disconnect() logs disconnectSucceeded', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await driver.disconnect(lanPrinter.id);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { disconnectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.disconnectSucceeded).toHaveBeenCalledWith({ printerId: lanPrinter.id, protocol: PrinterDriverType.tspl });
  });

  it('testPrint() logs testPrintSucceeded', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await driver.testPrint(lanPrinter, tsplDriverEntry, sampleDocuments);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { testPrintSucceeded: jest.Mock };
    };
    expect(PrinterLogger.testPrintSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.tspl }),
    );
  });

  it('testPrint() logs testPrintFailed (not just a bare connect failure) when the implicit reconnect fails', async () => {
    const driver = new TsplDriver();
    await expect(driver.testPrint(usbPrinterNoDevice, tsplDriverEntry, sampleDocuments)).rejects.toMatchObject({ code: AppErrorCode.VALIDATION_ERROR });
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { testPrintFailed: jest.Mock };
    };
    expect(PrinterLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: usbPrinterNoDevice.id, protocol: PrinterDriverType.tspl, errorCode: AppErrorCode.VALIDATION_ERROR }),
    );
  });

  it('scan("bluetooth") checks permission before calling RNBluetoothClassic.startDiscovery()', async () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(ConnectionType.bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.loading) resolve();
      });
    });
    const { ensureBluetoothPermission } = jest.requireMock('../../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(events).toEqual([DeviceScanEventType.loading, DeviceScanEventType.empty]);
  });

  it('scan("bluetooth") emits an error and skips startDiscovery when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const RNBluetoothClassic = jest.requireMock('react-native-bluetooth-classic') as {
      default: { startDiscovery: jest.Mock };
    };
    const callsBefore = RNBluetoothClassic.default.startDiscovery.mock.calls.length;
    const driver = new TsplDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(ConnectionType.bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.loading, DeviceScanEventType.error]);
    expect(RNBluetoothClassic.default.startDiscovery.mock.calls.length).toBe(callsBefore);
  });

  it('encode() is a pure function — calling it twice with the same input yields identical bytes, without needing a live connection', () => {
    const driver = new TsplDriver();
    const bytesA = driver.encode(lanPrinter, tsplDriverEntry, sampleDocuments);
    const bytesB = driver.encode(lanPrinter, tsplDriverEntry, sampleDocuments);
    expect(Array.from(bytesA)).toEqual(Array.from(bytesB));
  });

  it('encode() prefers documents.image over documents.text (renderMode is always bitmap)', () => {
    const driver = new TsplDriver();
    const withImage: PrintDocumentVariants = { text: sampleDocuments.text, image: { elements: [{ type: 'image', data: tinyPngBase64(), x: 0, y: 0 }] } };
    const bytes = driver.encode(lanPrinter, tsplDriverEntry, withImage);
    const ascii = Array.from(bytes.slice(0, 200)).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('BITMAP');
  });

  it('encode() throws ENCODING_FAILED in bitmap mode when no image variant is provided', () => {
    const driver = new TsplDriver();
    let error: unknown;
    try {
      driver.encode(lanPrinter, tsplDriverEntry, textOnlyDocuments);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: AppErrorCode.ENCODING_FAILED });
  });

  it('print() writes the same bytes that encode() produces', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    const expectedBytes = driver.encode(lanPrinter, tsplDriverEntry, sampleDocuments);
    await driver.print(lanPrinter.id, sampleDocuments);
    expect(Array.from(instance.write.mock.calls[0][0] as Uint8Array)).toEqual(Array.from(expectedBytes));
  });
});

describe('TsplDriver.installTrueTypeFont', () => {
  it('delegates to TsplFontManager.ensureFontInstalled using the connected transport', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    // `mock.instances[0]` would be the very first `TsplDriver` constructed
    // anywhere in this file (each `new TsplDriver()` builds its own private
    // `TsplFontManager`, and mocks aren't cleared between tests) — take the
    // most recent instance instead, matching the pattern already used above
    // for `LanTransport.mock.results[...length - 1]`.
    const instances = (TsplFontManager as jest.Mock).mock.instances;
    const ensureFontInstalledMock = instances[instances.length - 1].ensureFontInstalled as jest.Mock;
    ensureFontInstalledMock.mockResolvedValue(undefined);

    await driver.installTrueTypeFont(lanPrinter.id, DEFAULT_TSPL_FONT);

    expect(ensureFontInstalledMock).toHaveBeenCalledWith(expect.anything(), DEFAULT_TSPL_FONT);
  });

  it('throws CONNECTION_ERROR when the printer is not connected', async () => {
    const driver = new TsplDriver();
    await expect(driver.installTrueTypeFont('never-connected', DEFAULT_TSPL_FONT)).rejects.toMatchObject({
      code: AppErrorCode.CONNECTION_ERROR,
    });
  });
});

describe('TsplDriver renderMode resolution (via encode())', () => {
  it('encode() uses bitmap (image variant) when renderMode is bitmap, ignoring any font config', () => {
    const driver = new TsplDriver();
    const driverWithFont: PrinterDriver = {
      ...tsplDriverEntry,
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, font: { ...DEFAULT_TSPL_FONT, fontInstalled: true } },
    };
    const withImage = { text: sampleDocuments.text, image: { elements: [{ type: 'image' as const, data: tinyPngBase64(), x: 0, y: 0 }] } };
    const bytes = driver.encode(lanPrinter, driverWithFont, withImage);
    const ascii = Array.from(bytes.slice(0, 200)).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('BITMAP');
  });

  it('encode() uses truetype (text variant + custom font name) only when renderMode is truetype AND font.fontInstalled is true', () => {
    const driver = new TsplDriver();
    const driverWithInstalledFont: PrinterDriver = {
      ...tsplDriverEntry,
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, font: { ...DEFAULT_TSPL_FONT, fontInstalled: true } },
    };
    const bytes = driver.encode(lanPrinter, driverWithInstalledFont, sampleDocuments);
    const ascii = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain(`"${DEFAULT_TSPL_FONT.name}"`);
    expect(ascii).not.toContain('BITMAP');
  });

  it('encode() falls back to bitmap when renderMode is truetype but font.fontInstalled is false', () => {
    const driver = new TsplDriver();
    const driverWithUninstalledFont: PrinterDriver = {
      ...tsplDriverEntry,
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, font: { ...DEFAULT_TSPL_FONT, fontInstalled: false } },
    };
    const withImage = { text: sampleDocuments.text, image: { elements: [{ type: 'image' as const, data: tinyPngBase64(), x: 0, y: 0 }] } };
    const bytes = driver.encode(lanPrinter, driverWithUninstalledFont, withImage);
    const ascii = Array.from(bytes.slice(0, 200)).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('BITMAP');
  });

  it('encode() falls back to bitmap when renderMode is truetype but no font config exists at all', () => {
    const driver = new TsplDriver();
    const driverNoFont: PrinterDriver = { ...tsplDriverEntry, config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype } };
    const bytes = driver.encode(lanPrinter, driverNoFont, sampleDocuments);
    const ascii = Array.from(bytes.slice(0, 200)).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('BITMAP');
  });
});
