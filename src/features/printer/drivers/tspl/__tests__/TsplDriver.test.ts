import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { TsplDriver } from '../TsplDriver';
import { TsplFontManager, DEFAULT_TSPL_FONT } from '../TsplFontManager';
import { ConnectionType, DeviceScanEventType, DriverSource, PrinterDriverType, PrinterStatus, TsplRenderMode, type Printer, type PrinterDriver } from '../../../types/printer.types';
import { PrintType } from '../../../types/printConfiguration.types';
import type { PrintDocuments } from '../../../types/driver.types';
import type { PrintDocument, PrintElement } from '../../../types/printDocument.types';
import { PrinterErrorCode } from '../../../types/PrinterError';

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
    printSucceeded: jest.fn(),
    printFailed: jest.fn(),
  },
}));

const MEDIA_58 = { type: 'continuous', paperSize: 58 } as const;

const tsplDriverEntry: PrinterDriver = {
  type: PrinterDriverType.tspl,
  source: DriverSource.auto,
  contentTypes: [PrintType.Label],
  config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { ...MEDIA_58 } },
};

/**
 * `documents.image` giờ là base64 string thuần — bitmap mode không còn duyệt
 * qua `PrintElement[]` nữa (xem `TsplBitmapStrategy`). Để vẫn cover
 * `encodeElements()` (text/line/table/row/barcode/qrCode/unsupported), các
 * test đó phải đi qua nhánh truetype (`documents.text`) bằng driver này thay
 * vì `tsplDriverEntry` mặc định.
 */
const tsplTruetypeDriverEntry: PrinterDriver = {
  ...tsplDriverEntry,
  config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, media: { ...MEDIA_58 }, font: { ...DEFAULT_TSPL_FONT, fontInstalled: true } },
};

const lanPrinter: Printer = {
  id: 'label-1',
  name: 'Máy in tem',
  drivers: [tsplDriverEntry],
  connectionType: ConnectionType.lan,
  lan: { ip: '192.168.1.60', port: 9100 },
  identityKey: 'lan:192.168.1.60:9100',
  capabilities: { cutter: false },
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

const sampleDocuments: PrintDocuments = {
  text: { elements: [{ type: 'text', content: 'In thử', x: 0, y: 0 }] },
  image: tinyPngBase64(),
};

/** Dùng `documents.text` để test strategy truetype (`tsplTruetypeDriverEntry`) — bitmap mode giờ không còn duyệt qua elements nữa. */
const asTextDocuments = (document: PrintDocument): PrintDocuments => ({ text: document });

const sampleText = sampleDocuments.text;

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

  it('disconnect() sets status error (not stuck at disconnecting), logs disconnectFailed and rethrows PRINTER_CONNECTION_FAILED when transport.close() rejects', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as {
      close: jest.Mock;
    };
    instance.close.mockRejectedValueOnce(new Error('socket already destroyed'));

    await expect(driver.disconnect(lanPrinter.id)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
    expect(driver.getStatus(lanPrinter.id)).toBe(PrinterStatus.error);

    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { disconnectFailed: jest.Mock };
    };
    expect(PrinterLogger.disconnectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.tspl }),
    );
  });

  it('disconnect() clears the stale transport reference despite the native failure — print() afterwards correctly reports PRINTER_NOT_CONNECTED instead of using a broken transport', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as {
      close: jest.Mock;
    };
    instance.close.mockRejectedValueOnce(new Error('socket already destroyed'));
    await driver.disconnect(lanPrinter.id).catch(() => undefined);

    await expect(
      driver.print(lanPrinter.id, sampleDocuments, PrintType.Receipt),
    ).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED });
  });

  it('connect() over USB rejects with VALIDATION_ERROR when no device was chosen', async () => {
    const driver = new TsplDriver();
    await expect(driver.connect(usbPrinterNoDevice, tsplDriverEntry)).rejects.toMatchObject({ code: PrinterErrorCode.VALIDATION_ERROR });
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
    await driver.testPrint(usbPrinter, tsplDriverEntry, sampleDocuments, PrintType.Receipt);
    expect(instance.write).toHaveBeenCalled();
  });

  it('testPrint() with options.rows emits PRINT rows,1 and SET CUTTER rows (continuous default per_job)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.testPrint(lanPrinter, tsplDriverEntry, { text: sampleText, image: tinyPngBase64() }, PrintType.Label, { rows: 4 });
    const bytes = instance.write.mock.calls[0][0] as Uint8Array;
    const ascii = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('PRINT 4,1');
    expect(ascii).toContain('SET CUTTER 4');
  });

  it.each([
    ['NaN', NaN, 'PRINT 1,1'],
    ['âm', -3, 'PRINT 1,1'],
    ['số thực', 2.9, 'PRINT 2,1'],
  ])('testPrint() sanitises options.rows = %s → %s', async (_label, rows, expected) => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.testPrint(lanPrinter, tsplDriverEntry, { text: sampleText, image: tinyPngBase64() }, PrintType.Label, { rows });
    const ascii = Array.from(instance.write.mock.calls[0][0] as Uint8Array).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain(expected);
    expect(ascii).not.toContain('PRINT NaN,1');
  });

  it('testPrint() with no options defaults to PRINT 1,1', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.testPrint(lanPrinter, tsplDriverEntry, { text: sampleText, image: tinyPngBase64() }, PrintType.Label);
    const ascii = Array.from(instance.write.mock.calls[0][0] as Uint8Array).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('PRINT 1,1');
  });

  it('print() over USB writes through UsbTransport', async () => {
    const driver = new TsplDriver();
    await driver.connect(usbPrinter, tsplDriverEntry);
    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    const instance = UsbTransport.mock.results[UsbTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.print(usbPrinter.id, sampleDocuments, PrintType.Receipt);
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
    await driver.testPrint(lanPrinter, tsplDriverEntry, sampleDocuments, PrintType.Receipt);
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

  /**
   * `image` KHÔNG nằm trong danh sách — `TsplTrueTypeStrategy` không hỗ trợ
   * `element.type === 'image'` lồng trong `documents.text.elements` (RULE 21:
   * TrueType chỉ gửi `TEXT`, không bao giờ `BITMAP`), xem test
   * `TSPL_ELEMENT_UNSUPPORTED` riêng bên dưới.
   */
  it('print() encodes every truetype-supported element kind and writes once (via documents.text, truetype)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplTruetypeDriverEntry);
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'line', x: 0, y: 10 },
        { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
        { type: 'row', left: 'Mã đơn', right: '#001', x: 0, y: 40 },
        { type: 'barcode', content: '123', x: 0, y: 80 },
        { type: 'qrCode', content: 'https://x', x: 0, y: 100 },
      ],
    };
    await expect(driver.print(lanPrinter.id, asTextDocuments(document), PrintType.Receipt)).resolves.toBeUndefined();
  });

  it('print() renders a row element as a left/right-aligned line sized to paperSize (via documents.text, truetype)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplTruetypeDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.print(lanPrinter.id, asTextDocuments({ elements: [{ type: 'row', left: 'Ma don', right: '#001', x: 5, y: 10 }] }), PrintType.Receipt);
    const bytes = instance.write.mock.calls[0][0] as Uint8Array;
    const text = String.fromCharCode(...Array.from(bytes));
    // 58mm = 32 ký tự, 'Ma don' (6) + 'a#001'... gap = 32 - 6 - 4 = 22 khoảng trắng.
    // Font dùng tên thật từ font.name (truetype) thay vì "3" (bitmap) — xem tsplTruetypeDriverEntry.
    expect(text).toContain(`TEXT 5,10,"${DEFAULT_TSPL_FONT.name}",0,1,1,"Ma don${' '.repeat(22)}#001"`);
  });

  /**
   * RULE 21: TrueType chỉ bao giờ gửi `TEXT`, không bao giờ `BITMAP` — 1
   * strategy render-mode-homogeneous không có cách nào xen kẽ bitmap giữa
   * chừng. `TsplTrueTypeStrategy` không hỗ trợ `element.type === 'image'`
   * trong `documents.text.elements` (chỉ text/line/table/row/barcode/qrCode),
   * nên nhánh này phải ném `TSPL_ELEMENT_UNSUPPORTED` — KHÔNG còn render ra
   * `BITMAP` như hành vi cũ của `encodeElements()` (đã xoá ở Task 6).
   */
  it('print() rejects an image PrintElement nested inside documents.text.elements with TSPL_ELEMENT_UNSUPPORTED (truetype không hỗ trợ BITMAP xen giữa)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplTruetypeDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await expect(
      driver.print(lanPrinter.id, asTextDocuments({ elements: [{ type: 'image', data: tinyPngBase64(), x: 3, y: 7 }] }), PrintType.Receipt),
    ).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
    expect(instance.write).not.toHaveBeenCalled();
  });

  it('print() decodes documents.image (base64 PNG) into a real BITMAP command at (0,0) (widthBytes = ceil(width/8))', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.print(lanPrinter.id, { text: sampleDocuments.text, image: tinyPngBase64() }, PrintType.Receipt);
    const bytes = instance.write.mock.calls[0][0] as Uint8Array;
    // `initialize()` viết SIZE/GAP/CODEPAGE/CLS trước — tìm đúng vị trí bắt
    // đầu của "BITMAP" trong toàn bộ byte stream thay vì giả định index 0.
    const asAscii = Array.from(bytes.slice(0, 200)).map((b) => String.fromCharCode(b)).join('');
    const bitmapStart = asAscii.indexOf('BITMAP');
    expect(bitmapStart).toBeGreaterThan(-1);
    // `TsplDriver` chuẩn hoá mọi ảnh về đúng `PAPER_IMAGE_WIDTH_PX[58]`
    // (384px, xem `decodePngBase64ToMonochrome`) bất kể kích thước gốc — ảnh
    // test rộng 2px bị scale lên 384px (widthBytes = ceil(384/8) = 48), cao
    // tương ứng theo tỉ lệ (1px * 384/2 = 192px). `documents.image` là base64
    // string thuần (không còn x/y riêng) — luôn vẽ tại (0,0), xem TsplBitmapStrategy.
    const header = 'BITMAP 0,0,48,192,0,';
    expect(asAscii.slice(bitmapStart, bitmapStart + header.length)).toBe(header);
  });

  it('print() rejects with TSPL_IMAGE_TOO_LARGE when the image is taller than the declared label height', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await expect(
      driver.print(lanPrinter.id, { text: sampleDocuments.text, image: squarePngBase64() }, PrintType.Label),
    ).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_IMAGE_TOO_LARGE });
  });

  it('print() does NOT reject the same oversized-for-Label image when printing a Receipt (continuous paper, no fixed label height)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await expect(
      driver.print(lanPrinter.id, { text: sampleDocuments.text, image: squarePngBase64() }, PrintType.Receipt),
    ).resolves.toBeUndefined();
  });

  it('print() rejects with TSPL_ELEMENT_UNSUPPORTED for an unsupported element (via documents.text, truetype)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplTruetypeDriverEntry);
    const badElement = { type: 'unknown-kind', x: 0, y: 0 } as unknown as PrintElement;
    await expect(driver.print(lanPrinter.id, asTextDocuments({ elements: [badElement] }), PrintType.Receipt)).rejects.toMatchObject({
      code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED,
    });
  });

  it('print() bitmap mode: thiếu documents.image → ném TSPL_IMAGE_REQUIRED, KHÔNG ghi bytes, log printFailed (RULE 33)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await expect(driver.print(lanPrinter.id, { text: sampleText }, PrintType.Receipt)).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_IMAGE_REQUIRED });
    expect(instance.write).not.toHaveBeenCalled();
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { printFailed: jest.Mock };
    };
    expect(PrinterLogger.printFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.tspl, errorCode: PrinterErrorCode.TSPL_IMAGE_REQUIRED }),
    );
  });

  it('print() logs printSucceeded on the success path (RULE 33)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await driver.print(lanPrinter.id, { text: sampleText, image: tinyPngBase64() }, PrintType.Receipt);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { printSucceeded: jest.Mock };
    };
    expect(PrinterLogger.printSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.tspl }),
    );
  });

  it('print() truetype mode chưa cài font → ném TSPL_FONT_NOT_INSTALLED, KHÔNG ghi bytes', async () => {
    const driver = new TsplDriver();
    const ttDriver: PrinterDriver = { ...tsplDriverEntry, config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, media: { ...MEDIA_58 } } };
    await driver.connect(lanPrinter, ttDriver);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await expect(driver.print(lanPrinter.id, { text: sampleText }, PrintType.Receipt)).rejects.toMatchObject({ code: PrinterErrorCode.TSPL_FONT_NOT_INSTALLED });
    expect(instance.write).not.toHaveBeenCalled();
  });

  /** `downloadFont` là method DUY NHẤT của `TsplFontManager` thực sự gửi lệnh `DOWNLOAD` — print path không được chạm tới nó. */
  it('print()/testPrint()/connect() KHÔNG gọi TsplFontManager.downloadFont', async () => {
    const spy = jest.spyOn(TsplFontManager.prototype, 'downloadFont');
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await driver.print(lanPrinter.id, { text: sampleText, image: tinyPngBase64() }, PrintType.Receipt).catch(() => undefined);
    await driver.testPrint(lanPrinter, tsplDriverEntry, { text: sampleText, image: tinyPngBase64() }, PrintType.Receipt).catch(() => undefined);
    expect(spy).not.toHaveBeenCalled();
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

  it('connect() over Bluetooth fails with PRINTER_CONNECTION_FAILED when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new TsplDriver();
    await expect(driver.connect(bluetoothPrinter, tsplDriverEntry)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
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
    await expect(driver.connect(usbPrinterNoDevice, tsplDriverEntry)).rejects.toMatchObject({ code: PrinterErrorCode.VALIDATION_ERROR });
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
    await driver.testPrint(lanPrinter, tsplDriverEntry, sampleDocuments, PrintType.Receipt);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { testPrintSucceeded: jest.Mock };
    };
    expect(PrinterLogger.testPrintSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: PrinterDriverType.tspl }),
    );
  });

  it('testPrint() logs testPrintFailed (not just a bare connect failure) when the implicit reconnect fails', async () => {
    const driver = new TsplDriver();
    await expect(driver.testPrint(usbPrinterNoDevice, tsplDriverEntry, sampleDocuments, PrintType.Receipt)).rejects.toMatchObject({ code: PrinterErrorCode.VALIDATION_ERROR });
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { testPrintFailed: jest.Mock };
    };
    expect(PrinterLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: usbPrinterNoDevice.id, protocol: PrinterDriverType.tspl, errorCode: PrinterErrorCode.VALIDATION_ERROR }),
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

});

describe('TsplDriver.installTsplFont', () => {
  it('delegates to TsplFontManager.downloadFont using the connected transport', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    // `mock.instances[0]` would be the very first `TsplDriver` constructed
    // anywhere in this file (each `new TsplDriver()` builds its own private
    // `TsplFontManager`, and mocks aren't cleared between tests) — take the
    // most recent instance instead, matching the pattern already used above
    // for `LanTransport.mock.results[...length - 1]`.
    const instances = (TsplFontManager as jest.Mock).mock.instances;
    const downloadFontMock = instances[instances.length - 1].downloadFont as jest.Mock;
    downloadFontMock.mockResolvedValue(undefined);

    await driver.installTsplFont(lanPrinter.id, DEFAULT_TSPL_FONT);

    expect(downloadFontMock).toHaveBeenCalledWith(expect.anything(), DEFAULT_TSPL_FONT);
  });

  it('throws PRINTER_NOT_CONNECTED when the printer is not connected', async () => {
    const driver = new TsplDriver();
    await expect(driver.installTsplFont('never-connected', DEFAULT_TSPL_FONT)).rejects.toMatchObject({
      code: PrinterErrorCode.PRINTER_NOT_CONNECTED,
    });
  });
});

