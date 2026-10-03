import { buildBluetoothConnection, buildLanConnection, buildUsbConnection, deviceFromConnection } from '../PrinterResolver';
import { deviceIdOf } from '../../models/printer/deviceIdOf';
import { ConnectionType } from '../../models/printer/ConnectionType';
import type { PrinterDevice } from '../../models/printer/PrinterDevice';

const usbDevice: PrinterDevice = { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: { vendorId: 1155, productId: 22222 } };
const btDevice: PrinterDevice = { deviceId: '00:11:22:33:44:55', displayName: 'Máy in BT', rawDevice: {} };

describe('deviceIdOf', () => {
  it('builds a lan:<host>:<port> key for LAN', () => {
    expect(deviceIdOf(buildLanConnection('192.168.1.50', 9100))).toBe('lan:192.168.1.50:9100');
  });

  it('builds a bluetooth:mac:<deviceId> key for Bluetooth', () => {
    expect(deviceIdOf(buildBluetoothConnection(btDevice))).toBe('bluetooth:mac:00:11:22:33:44:55');
  });

  it('viết hoa MAC trong key Bluetooth để cùng thiết bị luôn ra cùng key', () => {
    const lowercaseDevice: PrinterDevice = { deviceId: 'aa:bb:cc:dd:ee:ff', displayName: 'Máy in BT', rawDevice: {} };
    expect(deviceIdOf(buildBluetoothConnection(lowercaseDevice))).toBe('bluetooth:mac:AA:BB:CC:DD:EE:FF');
  });

  it('builds a usb:<vendorId>:<productId> key for USB when no serial is available', () => {
    expect(deviceIdOf(buildUsbConnection(usbDevice))).toBe('usb:1155:22222');
  });

  it('pins the serial into the key when the USB descriptor carries one', () => {
    const withSerial: PrinterDevice = { ...usbDevice, rawDevice: { vendorId: 1155, productId: 22222, serialNumber: 'XPR-000123' } };
    expect(deviceIdOf(buildUsbConnection(withSerial))).toBe('usb:1155:22222:XPR-000123');
  });

  it('two same-model USB printers with distinct serials get distinct identityKeys', () => {
    const a: PrinterDevice = { ...usbDevice, rawDevice: { vendorId: 1155, productId: 22222, serialNumber: 'AAA' } };
    const b: PrinterDevice = { ...usbDevice, rawDevice: { vendorId: 1155, productId: 22222, serialNumber: 'BBB' } };
    expect(deviceIdOf(buildUsbConnection(a))).not.toBe(deviceIdOf(buildUsbConnection(b)));
  });

  it('two different physical printers of the same model over USB collide on deviceId — a documented limitation, not a bug', () => {
    const cloneA: PrinterDevice = { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: { vendorId: 1155, productId: 22222 } };
    const cloneB: PrinterDevice = { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: { vendorId: 1155, productId: 22222 } };
    expect(deviceIdOf(buildUsbConnection(cloneA))).toBe(deviceIdOf(buildUsbConnection(cloneB)));
  });
});

describe('buildUsbConnection', () => {
  it('extracts vendorId/productId as numbers, omitting serialNumber when absent', () => {
    expect(buildUsbConnection(usbDevice)).toEqual({ type: ConnectionType.Usb, vendorId: 1155, productId: 22222 });
  });

  it('includes serialNumber when the rawDevice descriptor carries one', () => {
    const withSerial: PrinterDevice = { ...usbDevice, rawDevice: { vendorId: 1155, productId: 22222, serialNumber: 'XPR-000123' } };
    expect(buildUsbConnection(withSerial)).toEqual({ type: ConnectionType.Usb, vendorId: 1155, productId: 22222, serialNumber: 'XPR-000123' });
  });
});

describe('buildBluetoothConnection', () => {
  it('dùng MAC của thiết bị đã chọn', () => {
    expect(buildBluetoothConnection(btDevice)).toEqual({ type: ConnectionType.Bluetooth, mac: '00:11:22:33:44:55' });
  });
});

describe('buildLanConnection', () => {
  it('builds a LanPrinterConnection from host/port', () => {
    expect(buildLanConnection('192.168.1.50', 9100)).toEqual({ type: ConnectionType.Lan, host: '192.168.1.50', port: 9100 });
  });
});

describe('deviceFromConnection', () => {
  it('round-trips a usb connection back into a PrinterDevice shape usable by buildUsbConnection', () => {
    const connection = buildUsbConnection(usbDevice);
    const device = deviceFromConnection(connection);
    expect(device).toBeDefined();
    expect(buildUsbConnection(device!)).toEqual(connection);
  });

  it('round-trips a bluetooth connection back into a PrinterDevice shape usable by buildBluetoothConnection', () => {
    const connection = buildBluetoothConnection(btDevice);
    const device = deviceFromConnection(connection);
    expect(device).toBeDefined();
    expect(buildBluetoothConnection(device!)).toEqual(connection);
  });

  it('returns undefined for a lan connection — LAN never seeds selectedDevice', () => {
    expect(deviceFromConnection(buildLanConnection('192.168.1.50', 9100))).toBeUndefined();
  });
});
