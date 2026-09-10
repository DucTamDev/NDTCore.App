import { buildBluetoothConnection, buildLanConnection, buildUsbConnection, deviceFromConnection, resolveIdentityKey } from '../PrinterResolver';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import type { PrinterDevice } from '../../models/printer/PrinterDevice';

const usbDevice: PrinterDevice = { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: { vendorId: 1155, productId: 22222 } };
const btDevice: PrinterDevice = { deviceId: '00:11:22:33:44:55', displayName: 'Máy in BT', rawDevice: {} };

describe('resolveIdentityKey', () => {
  it('builds a lan:<host>:<port> key for LAN', () => {
    expect(resolveIdentityKey(buildLanConnection('192.168.1.50', 9100))).toBe('lan:192.168.1.50:9100');
  });

  it('builds a bluetooth:mac:<deviceId> key for Bluetooth', () => {
    expect(resolveIdentityKey(buildBluetoothConnection(btDevice))).toBe('bluetooth:mac:00:11:22:33:44:55');
  });

  it('builds a usb:<vendorId>:<productId> key for USB when no serial is available', () => {
    expect(resolveIdentityKey(buildUsbConnection(usbDevice))).toBe('usb:1155:22222');
  });

  it('pins the serial into the key when the USB descriptor carries one', () => {
    const withSerial: PrinterDevice = { ...usbDevice, rawDevice: { vendorId: 1155, productId: 22222, serialNumber: 'XPR-000123' } };
    expect(resolveIdentityKey(buildUsbConnection(withSerial))).toBe('usb:1155:22222:XPR-000123');
  });

  it('two same-model USB printers with distinct serials get distinct identityKeys', () => {
    const a: PrinterDevice = { ...usbDevice, rawDevice: { vendorId: 1155, productId: 22222, serialNumber: 'AAA' } };
    const b: PrinterDevice = { ...usbDevice, rawDevice: { vendorId: 1155, productId: 22222, serialNumber: 'BBB' } };
    expect(resolveIdentityKey(buildUsbConnection(a))).not.toBe(resolveIdentityKey(buildUsbConnection(b)));
  });

  it('two different physical printers of the same model over USB collide on identityKey — a documented limitation, not a bug', () => {
    const cloneA: PrinterDevice = { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: { vendorId: 1155, productId: 22222 } };
    const cloneB: PrinterDevice = { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: { vendorId: 1155, productId: 22222 } };
    expect(resolveIdentityKey(buildUsbConnection(cloneA))).toBe(resolveIdentityKey(buildUsbConnection(cloneB)));
  });
});

describe('buildUsbConnection', () => {
  it('extracts vendorId/productId as numbers, omitting serialNumber when absent', () => {
    expect(buildUsbConnection(usbDevice)).toEqual({ type: PrinterConnectionType.Usb, vendorId: 1155, productId: 22222 });
  });

  it('includes serialNumber when the rawDevice descriptor carries one', () => {
    const withSerial: PrinterDevice = { ...usbDevice, rawDevice: { vendorId: 1155, productId: 22222, serialNumber: 'XPR-000123' } };
    expect(buildUsbConnection(withSerial)).toEqual({ type: PrinterConnectionType.Usb, vendorId: 1155, productId: 22222, serialNumber: 'XPR-000123' });
  });
});

describe('buildBluetoothConnection', () => {
  it('carries deviceId + displayName as name', () => {
    expect(buildBluetoothConnection(btDevice)).toEqual({ type: PrinterConnectionType.Bluetooth, deviceId: '00:11:22:33:44:55', name: 'Máy in BT' });
  });

  it('omits name when displayName is empty', () => {
    expect(buildBluetoothConnection({ ...btDevice, displayName: '' })).toEqual({ type: PrinterConnectionType.Bluetooth, deviceId: '00:11:22:33:44:55' });
  });
});

describe('buildLanConnection', () => {
  it('builds a LanPrinterConnection from host/port', () => {
    expect(buildLanConnection('192.168.1.50', 9100)).toEqual({ type: PrinterConnectionType.Lan, host: '192.168.1.50', port: 9100 });
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
