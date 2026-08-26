// src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts
import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { TsplDriver } from '../TsplDriver';
import type { Printer, PrinterDriver } from '../../../types/printer.types';
import type { PrintDocumentVariants } from '../../../types/driver.types';
import type { PrintDocument, PrintElement } from '../../../types/printDocument.types';

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
  type: 'tspl',
  source: 'auto',
  contentTypes: ['Label'],
  config: { type: 'tspl', renderMode: 'bitmap' },
};

const lanPrinter: Printer = {
  id: 'label-1',
  name: 'Máy in tem',
  drivers: [tsplDriverEntry],
  connectionType: 'lan',
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
  connectionType: 'usb',
  lan: undefined,
  device: { deviceId: '1155:22222', displayName: 'Máy in tem USB', rawDevice: { vendor_id: 1155, product_id: 22222 } },
};

/** Không có `device` — dùng cho các test kiểm tra `VALIDATION_ERROR` khi chưa chọn thiết bị USB. */
const usbPrinterNoDevice: Printer = {
  ...lanPrinter,
  id: 'label-usb-nodevice',
  connectionType: 'usb',
  lan: undefined,
  device: undefined,
};

const bluetoothPrinter: Printer = {
  ...lanPrinter,
  id: 'label-bt',
  connectionType: 'bluetooth',
  lan: undefined,
  device: { deviceId: '00:11:22:33:44:66', displayName: 'Máy in tem BT', rawDevice: {} },
};

const sampleDocuments: PrintDocumentVariants = { text: { elements: [{ type: 'text', content: 'In thử', x: 0, y: 0 }] } };

const asDocuments = (document: PrintDocument): PrintDocumentVariants => ({ text: document });

describe('TsplDriver', () => {
  it('connect() over LAN transitions status idle -> connecting -> connected', async () => {
    const driver = new TsplDriver();
    const statuses: string[] = [];
    driver.onStatusChange(lanPrinter.id, (status) => statuses.push(status));
    expect(driver.getStatus(lanPrinter.id)).toBe('idle');
    await driver.connect(lanPrinter, tsplDriverEntry);
    expect(statuses).toEqual(['connecting', 'connected']);
    expect(driver.getStatus(lanPrinter.id)).toBe('connected');
  });

  it('disconnect() transitions to disconnected and clears the connection', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await driver.disconnect(lanPrinter.id);
    expect(driver.getStatus(lanPrinter.id)).toBe('disconnected');
  });

  it('disconnect() sets status error (not stuck at disconnecting), logs disconnectFailed and rethrows CONNECTION_ERROR when transport.close() rejects', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as {
      close: jest.Mock;
    };
    instance.close.mockRejectedValueOnce(new Error('socket already destroyed'));

    await expect(driver.disconnect(lanPrinter.id)).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
    expect(driver.getStatus(lanPrinter.id)).toBe('error');

    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { disconnectFailed: jest.Mock };
    };
    expect(PrinterLogger.disconnectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: 'tspl' }),
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
    ).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
  });

  it('connect() over USB rejects with VALIDATION_ERROR when no device was chosen', async () => {
    const driver = new TsplDriver();
    await expect(driver.connect(usbPrinterNoDevice, tsplDriverEntry)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(driver.getStatus(usbPrinterNoDevice.id)).toBe('error');
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
    expect(driver.getStatus(usbPrinter.id)).toBe('connected');
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
    driver.scan('lan', (event) => events.push(event.type));
    expect(events).toEqual(['empty']);
  });

  it('scan() on usb immediately reports error', () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    driver.scan('usb', (event) => events.push(event.type));
    expect(events).toEqual(['error']);
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
      driver.print(lanPrinter.id, asDocuments({ elements: [{ type: 'image', data: squarePngBase64(), x: 0, y: 0 }] }), 'Label'),
    ).rejects.toMatchObject({ code: 'ENCODING_FAILED' });
  });

  it('print() does NOT reject the same oversized-for-Label image when printing a Receipt (continuous paper, no fixed label height)', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await expect(
      driver.print(lanPrinter.id, asDocuments({ elements: [{ type: 'image', data: squarePngBase64(), x: 0, y: 0 }] }), 'Receipt'),
    ).resolves.toBeUndefined();
  });

  it('print() rejects with ENCODING_FAILED for an unsupported element', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const badElement = { type: 'unknown-kind', x: 0, y: 0 } as unknown as PrintElement;
    await expect(driver.print(lanPrinter.id, asDocuments({ elements: [badElement] }))).rejects.toMatchObject({
      code: 'ENCODING_FAILED',
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
    expect(driver.getStatus(bluetoothPrinter.id)).toBe('connected');
  });

  it('connect() over Bluetooth fails with CONNECTION_ERROR when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new TsplDriver();
    await expect(driver.connect(bluetoothPrinter, tsplDriverEntry)).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
    expect(driver.getStatus(bluetoothPrinter.id)).toBe('error');
  });

  it('connect() logs connectSucceeded on success', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { connectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.connectSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: 'tspl', connectionType: 'lan' }),
    );
  });

  it('connect() logs connectFailed on failure', async () => {
    const driver = new TsplDriver();
    await expect(driver.connect(usbPrinterNoDevice, tsplDriverEntry)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { connectFailed: jest.Mock };
    };
    expect(PrinterLogger.connectFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: usbPrinterNoDevice.id, protocol: 'tspl', connectionType: 'usb' }),
    );
  });

  it('disconnect() logs disconnectSucceeded', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await driver.disconnect(lanPrinter.id);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { disconnectSucceeded: jest.Mock };
    };
    expect(PrinterLogger.disconnectSucceeded).toHaveBeenCalledWith({ printerId: lanPrinter.id, protocol: 'tspl' });
  });

  it('testPrint() logs testPrintSucceeded', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    await driver.testPrint(lanPrinter, tsplDriverEntry, sampleDocuments);
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { testPrintSucceeded: jest.Mock };
    };
    expect(PrinterLogger.testPrintSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanPrinter.id, protocol: 'tspl' }),
    );
  });

  it('testPrint() logs testPrintFailed (not just a bare connect failure) when the implicit reconnect fails', async () => {
    const driver = new TsplDriver();
    await expect(driver.testPrint(usbPrinterNoDevice, tsplDriverEntry, sampleDocuments)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const { PrinterLogger } = jest.requireMock('../../../services/PrinterLogger') as {
      PrinterLogger: { testPrintFailed: jest.Mock };
    };
    expect(PrinterLogger.testPrintFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: usbPrinterNoDevice.id, protocol: 'tspl', errorCode: 'VALIDATION_ERROR' }),
    );
  });

  it('scan("bluetooth") checks permission before calling RNBluetoothClassic.startDiscovery()', async () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type !== 'loading') resolve();
      });
    });
    const { ensureBluetoothPermission } = jest.requireMock('../../../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(events).toEqual(['loading', 'empty']);
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
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type !== 'loading') resolve();
      });
    });
    expect(events).toEqual(['loading', 'error']);
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

  it('encode() falls back to documents.text when no image variant is provided', () => {
    const driver = new TsplDriver();
    const bytes = driver.encode(lanPrinter, tsplDriverEntry, sampleDocuments);
    // `sampleDocuments.text` chứa tiếng Việt có dấu ("In thử") — `TsplEncoder`
    // mã hoá UTF-8 thật (nhiều byte/ký tự, xem `TsplEncoder.text()`), nên
    // phải decode UTF-8 đúng cách bằng `Buffer`, không thể `String.fromCharCode`
    // byte-by-byte (vốn chỉ đúng cho nội dung thuần ASCII).
    const decoded = Buffer.from(bytes).toString('utf8');
    expect(decoded).toContain('In thử');
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
