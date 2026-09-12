import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { TsplDriver } from '../TsplDriver';
import { DeviceScanEventType } from '../../../models/printer/PrinterDevice';
import { PrinterConnectionType } from '../../../models/printer/PrinterConnection';
import { PrinterDriverType, RenderMode } from '../../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../../models/printer/PrinterStatus';
import { PrintType } from '../../../models/printing/PrintType';
import { PaperSize, PrintPaperType } from '../../../models/paper/PrintPaperConfig';
import { type Printer } from '../../../models/printer/Printer';
import { makePrinter, makeTsplDriver } from '../../../testing/printerFixtures';
import type { PrintDocuments } from '../../IPrinterDriver';
import { PrinterErrorCode } from '../../../errors/PrinterError';

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

/** 2x2 (aspect vuông) — sau khi chuẩn hoá về `PAPER_SIZE_SPECS[58].imageWidthPx` (384px), chiều cao ra 384px, vượt `LABEL_HEIGHT_MM * DOTS_PER_MM` (240px). */
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
jest.mock('../../../permissions/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../../logging/PrinterLogger', () => ({
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

const MEDIA_58 = { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm58 } as const;

/** Máy in Tem (LAN) — dùng cho các test phụ thuộc `resolveSizeHeightMm`/DEFAULT_LABEL_HEIGHT_MM (rows/cutter/IMAGE_TOO_LARGE). */
const lanLabelPrinter: Printer = makePrinter({
  id: 'label-1',
  name: 'Máy in tem',
  identityKey: 'lan:192.168.1.60:9100',
  type: PrintType.Label,
  driver: makeTsplDriver({ config: { renderMode: RenderMode.Bitmap } }),
  connection: { type: PrinterConnectionType.Lan, host: '192.168.1.60', port: 9100 },
  paper: { ...MEDIA_58 },
});

const usbLabelPrinter: Printer = {
  ...lanLabelPrinter,
  id: 'label-usb',
  connection: { type: PrinterConnectionType.Usb, vendorId: 1155, productId: 22222 },
};

const bluetoothLabelPrinter: Printer = {
  ...lanLabelPrinter,
  id: 'label-bt',
  connection: { type: PrinterConnectionType.Bluetooth, deviceId: '00:11:22:33:44:66', name: 'Máy in tem BT' },
};

/** Máy in Hoá đơn (giấy Continuous không giới hạn chiều cao cố định) — dùng cho các test IMAGE_TOO_LARGE/Receipt. */
const lanReceiptPrinter: Printer = { ...lanLabelPrinter, id: 'receipt-1', type: PrintType.Receipt };
const usbReceiptPrinter: Printer = { ...usbLabelPrinter, id: 'receipt-usb', type: PrintType.Receipt };

/** renderMode Encoder — dùng cho test rẽ nhánh sang TsplTextStrategy (không cần documents.image). */
const lanEncoderPrinter: Printer = { ...lanLabelPrinter, id: 'label-encoder', driver: makeTsplDriver({ config: { renderMode: RenderMode.Encoder } }) };

const sampleDocuments: PrintDocuments = {
  text: { elements: [{ type: 'text', content: 'In thử', x: 0, y: 0 }] },
  image: tinyPngBase64(),
};

const sampleText = sampleDocuments.text;

describe('TsplDriver', () => {
  it('connect() over LAN transitions status idle -> connecting -> connected', async () => {
    const driver = new TsplDriver();
    const statuses: string[] = [];
    driver.onStatusChange(lanLabelPrinter.id, (status) => statuses.push(status));
    expect(driver.getStatus(lanLabelPrinter.id)).toBe(PrinterStatus.Idle);
    await driver.connect(lanLabelPrinter);
    expect(statuses).toEqual([PrinterStatus.Connecting, PrinterStatus.Connected]);
    expect(driver.getStatus(lanLabelPrinter.id)).toBe(PrinterStatus.Connected);
  });

  it('disconnect() transitions to disconnected and clears the connection', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    await driver.disconnect(lanLabelPrinter.id);
    expect(driver.getStatus(lanLabelPrinter.id)).toBe(PrinterStatus.Disconnected);
  });

  it('disconnect() sets status error (not stuck at disconnecting), logs disconnectFailed and rethrows PRINTER_CONNECTION_FAILED when transport.close() rejects', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as {
      close: jest.Mock;
    };
    instance.close.mockRejectedValueOnce(new Error('socket already destroyed'));

    await expect(driver.disconnect(lanLabelPrinter.id)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
    expect(driver.getStatus(lanLabelPrinter.id)).toBe(PrinterStatus.Error);

    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { disconnectFailed: jest.Mock };
    };
    expect(PrinterLogger.disconnectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanLabelPrinter.id, protocol: PrinterDriverType.Tspl }),
    );
  });

  it('disconnect() clears the stale transport reference despite the native failure — print() afterwards correctly reports PRINTER_NOT_CONNECTED instead of using a broken transport', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as {
      close: jest.Mock;
    };
    instance.close.mockRejectedValueOnce(new Error('socket already destroyed'));
    await driver.disconnect(lanLabelPrinter.id).catch(() => undefined);

    await expect(
      driver.print(lanLabelPrinter.id, sampleDocuments),
    ).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED });
  });

  it('connect() over USB rejects and sets status error when UsbTransport.connect() fails', async () => {
    const driver = new TsplDriver();
    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    UsbTransport.mockImplementationOnce(() => ({
      connect: jest.fn().mockRejectedValue(new Error('usb connect failed')),
      write: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }));
    await expect(driver.connect(usbLabelPrinter)).rejects.toThrow();
    expect(driver.getStatus(usbLabelPrinter.id)).toBe(PrinterStatus.Error);
  });

  it('connect() over USB reads vendorId/productId from the scanned rawDevice as numbers', async () => {
    const driver = new TsplDriver();
    await driver.connect(usbLabelPrinter);
    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    const instance = UsbTransport.mock.results[UsbTransport.mock.results.length - 1].value as { connect: jest.Mock };
    expect(instance.connect).toHaveBeenCalledWith(usbLabelPrinter.id, 1155, 22222);
  });

  it('connect() over USB reads vendorId/productId from the scanned rawDevice as numbers and transitions to connected', async () => {
    const driver = new TsplDriver();
    await driver.connect(usbLabelPrinter);
    expect(driver.getStatus(usbLabelPrinter.id)).toBe(PrinterStatus.Connected);
  });

  it('testPrint() over USB writes through UsbTransport', async () => {
    const driver = new TsplDriver();
    await driver.connect(usbReceiptPrinter);
    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    const instance = UsbTransport.mock.results[UsbTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.testPrint(usbReceiptPrinter, sampleDocuments);
    expect(instance.write).toHaveBeenCalled();
  });

  it('testPrint() with options.rows emits PRINT rows,1 and SET CUTTER rows (continuous default per_job)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.testPrint(lanLabelPrinter, { text: sampleText, image: tinyPngBase64() }, { rows: 4 });
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
    await driver.connect(lanLabelPrinter);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.testPrint(lanLabelPrinter, { text: sampleText, image: tinyPngBase64() }, { rows });
    const ascii = Array.from(instance.write.mock.calls[0][0] as Uint8Array).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain(expected);
    expect(ascii).not.toContain('PRINT NaN,1');
  });

  it('testPrint() with no options defaults to PRINT 1,1', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.testPrint(lanLabelPrinter, { text: sampleText, image: tinyPngBase64() });
    const ascii = Array.from(instance.write.mock.calls[0][0] as Uint8Array).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('PRINT 1,1');
  });

  it('renderMode Encoder gọi TsplTextStrategy (TEXT command), không cần documents.image', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanEncoderPrinter);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.testPrint(lanEncoderPrinter, { text: { elements: [{ type: 'text', content: 'hi', x: 0, y: 0 }] } });
    const ascii = Array.from(instance.write.mock.calls[0][0] as Uint8Array).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('TEXT 0,0,"3",0,1,1,"hi"');
  });

  it('print() over USB writes through UsbTransport', async () => {
    const driver = new TsplDriver();
    await driver.connect(usbReceiptPrinter);
    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    const instance = UsbTransport.mock.results[UsbTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.print(usbReceiptPrinter.id, sampleDocuments);
    expect(instance.write).toHaveBeenCalled();
  });

  it('identify() over USB returns null (no readOnce capability)', async () => {
    const driver = new TsplDriver();
    await driver.connect(usbLabelPrinter);
    const result = await driver.identify(usbLabelPrinter.id);
    expect(result).toBeNull();
  });

  it('scan() on lan immediately reports empty (no scan for LAN)', () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    driver.scan(PrinterConnectionType.Lan, (event) => events.push(event.type));
    expect(events).toEqual([DeviceScanEventType.Empty]);
  });

  it('scan() on usb immediately reports error', () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    driver.scan(PrinterConnectionType.Usb, (event) => events.push(event.type));
    expect(events).toEqual([DeviceScanEventType.Error]);
  });

  it('testPrint() reuses an already-open connection instead of reconnecting', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const callsBeforeTestPrint = LanTransport.mock.calls.length;
    await driver.testPrint(lanLabelPrinter, sampleDocuments);
    expect(LanTransport.mock.calls.length).toBe(callsBeforeTestPrint);
  });

  it('identify() returns null when not connected', async () => {
    const driver = new TsplDriver();
    expect(await driver.identify('never-connected')).toBeNull();
  });

  it('identify() returns null when the transport does not respond in time', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    const result = await driver.identify(lanLabelPrinter.id);
    expect(result).toBeNull();
  });

  it('print() decodes documents.image (base64 PNG) into a real BITMAP command at (0,0) (widthBytes = ceil(width/8))', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanReceiptPrinter);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await driver.print(lanReceiptPrinter.id, { text: sampleDocuments.text, image: tinyPngBase64() });
    const bytes = instance.write.mock.calls[0][0] as Uint8Array;
    // `initialize()` viết SIZE/GAP/CODEPAGE/CLS trước — tìm đúng vị trí bắt
    // đầu của "BITMAP" trong toàn bộ byte stream thay vì giả định index 0.
    const asAscii = Array.from(bytes.slice(0, 200)).map((b) => String.fromCharCode(b)).join('');
    const bitmapStart = asAscii.indexOf('BITMAP');
    expect(bitmapStart).toBeGreaterThan(-1);
    // `TsplDriver` chuẩn hoá mọi ảnh về đúng `PAPER_SIZE_SPECS[58].imageWidthPx`
    // (384px, xem `decodePngBase64ToMonochrome`) bất kể kích thước gốc — ảnh
    // test rộng 2px bị scale lên 384px (widthBytes = ceil(384/8) = 48), cao
    // tương ứng theo tỉ lệ (1px * 384/2 = 192px). `documents.image` là base64
    // string thuần (không còn x/y riêng) — luôn vẽ tại (0,0), xem TsplBitmapStrategy.
    const header = 'BITMAP 0,0,48,192,0,';
    expect(asAscii.slice(bitmapStart, bitmapStart + header.length)).toBe(header);
  });

  it('print() rejects with IMAGE_TOO_LARGE when the image is taller than the declared label height', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    await expect(
      driver.print(lanLabelPrinter.id, { text: sampleDocuments.text, image: squarePngBase64() }),
    ).rejects.toMatchObject({ code: PrinterErrorCode.IMAGE_TOO_LARGE });
  });

  it('print() does NOT reject the same oversized-for-Label image when printing a Receipt (continuous paper, no fixed label height)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanReceiptPrinter);
    await expect(
      driver.print(lanReceiptPrinter.id, { text: sampleDocuments.text, image: squarePngBase64() }),
    ).resolves.toBeUndefined();
  });

  it('print() bitmap mode: thiếu documents.image → ném IMAGE_REQUIRED, KHÔNG ghi bytes, log printFailed (RULE 33)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    await expect(driver.print(lanLabelPrinter.id, { text: sampleText })).rejects.toMatchObject({ code: PrinterErrorCode.IMAGE_REQUIRED });
    expect(instance.write).not.toHaveBeenCalled();
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { printFailed: jest.Mock };
    };
    expect(PrinterLogger.printFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanLabelPrinter.id, protocol: PrinterDriverType.Tspl, errorCode: PrinterErrorCode.IMAGE_REQUIRED }),
    );
  });

  it('print() logs printSucceeded on the success path (RULE 33)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    await driver.print(lanLabelPrinter.id, { text: sampleText, image: tinyPngBase64() });
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { printSucceeded: jest.Mock };
    };
    expect(PrinterLogger.printSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanLabelPrinter.id, protocol: PrinterDriverType.Tspl }),
    );
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
    await driver.connect(lanLabelPrinter);
    const result = await driver.identify(lanLabelPrinter.id);
    expect(result).not.toBeNull();
  });

  it('connect() over Bluetooth checks permission before connecting', async () => {
    const driver = new TsplDriver();
    await driver.connect(bluetoothLabelPrinter);
    const { ensureBluetoothPermission } = jest.requireMock('../../../permissions/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(driver.getStatus(bluetoothLabelPrinter.id)).toBe(PrinterStatus.Connected);
  });

  it('connect() over Bluetooth fails with PRINTER_CONNECTION_FAILED when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../permissions/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new TsplDriver();
    await expect(driver.connect(bluetoothLabelPrinter)).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
    expect(driver.getStatus(bluetoothLabelPrinter.id)).toBe(PrinterStatus.Error);
  });

  it('connect() logs connectSucceeded on success', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { connectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.connectSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanLabelPrinter.id, protocol: PrinterDriverType.Tspl, connectionType: PrinterConnectionType.Lan }),
    );
  });

  it('connect() logs connectFailed on failure', async () => {
    const driver = new TsplDriver();
    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    UsbTransport.mockImplementationOnce(() => ({
      connect: jest.fn().mockRejectedValue(new Error('usb connect failed')),
      write: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }));
    await expect(driver.connect(usbLabelPrinter)).rejects.toThrow();
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { connectFailed: jest.Mock };
    };
    expect(PrinterLogger.connectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: usbLabelPrinter.id, protocol: PrinterDriverType.Tspl, connectionType: PrinterConnectionType.Usb, errorCode: PrinterErrorCode.UNKNOWN_ERROR }),
    );
  });

  it('disconnect() logs disconnectSucceeded', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    await driver.disconnect(lanLabelPrinter.id);
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { disconnectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.disconnectSucceeded).toHaveBeenCalledWith({ printerId: lanLabelPrinter.id, protocol: PrinterDriverType.Tspl });
  });

  it('testPrint() logs testPrintSucceeded', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanLabelPrinter);
    await driver.testPrint(lanLabelPrinter, sampleDocuments);
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { testPrintSucceeded: jest.Mock };
    };
    expect(PrinterLogger.testPrintSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanLabelPrinter.id, protocol: PrinterDriverType.Tspl }),
    );
  });

  it('testPrint() logs testPrintFailed (not just a bare connect failure) when the implicit reconnect fails', async () => {
    const driver = new TsplDriver();
    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    UsbTransport.mockImplementationOnce(() => ({
      connect: jest.fn().mockRejectedValue(new Error('usb connect failed')),
      write: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }));
    await expect(driver.testPrint(usbLabelPrinter, sampleDocuments)).rejects.toThrow();
    const { PrinterLogger } = jest.requireMock('../../../logging/PrinterLogger') as {
      PrinterLogger: { testPrintFailed: jest.Mock };
    };
    expect(PrinterLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: usbLabelPrinter.id, protocol: PrinterDriverType.Tspl, errorCode: PrinterErrorCode.UNKNOWN_ERROR }),
    );
  });

  it('scan("bluetooth") checks permission before calling RNBluetoothClassic.startDiscovery()', async () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan(PrinterConnectionType.Bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.Loading) resolve();
      });
    });
    const { ensureBluetoothPermission } = jest.requireMock('../../../permissions/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(events).toEqual([DeviceScanEventType.Loading, DeviceScanEventType.Empty]);
  });

  it('scan("bluetooth") emits an error and skips startDiscovery when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../permissions/PrinterPermissionService') as {
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
      driver.scan(PrinterConnectionType.Bluetooth, (event) => {
        events.push(event.type);
        if (event.type !== DeviceScanEventType.Loading) resolve();
      });
    });
    expect(events).toEqual([DeviceScanEventType.Loading, DeviceScanEventType.Error]);
    expect(RNBluetoothClassic.default.startDiscovery.mock.calls.length).toBe(callsBefore);
  });
});
