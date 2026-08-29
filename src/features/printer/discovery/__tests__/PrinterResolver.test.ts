import { resolveIdentityKey } from '../PrinterResolver';
import { ConnectionType } from '../../types/printer.types';
import type { PrinterDevice } from '../../types/printer.types';

const usbDevice: PrinterDevice = { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: {} };
const btDevice: PrinterDevice = { deviceId: '00:11:22:33:44:55', displayName: 'Máy in BT', rawDevice: {} };

describe('resolveIdentityKey', () => {
  it('builds a lan:<ip>:<port> key for LAN', () => {
    expect(resolveIdentityKey({ connectionType: ConnectionType.lan, lan: { ip: '192.168.1.50', port: 9100 } })).toBe(
      'lan:192.168.1.50:9100',
    );
  });

  it('throws when LAN is missing the lan config', () => {
    expect(() => resolveIdentityKey({ connectionType: ConnectionType.lan })).toThrow();
  });

  it('builds a bluetooth:mac:<deviceId> key for Bluetooth', () => {
    expect(resolveIdentityKey({ connectionType: ConnectionType.bluetooth, device: btDevice })).toBe('bluetooth:mac:00:11:22:33:44:55');
  });

  it('builds a usb:device:<deviceId> key for USB when no serial is available', () => {
    expect(resolveIdentityKey({ connectionType: ConnectionType.usb, device: usbDevice })).toBe('usb:device:1155:22222');
  });

  it('prefers usb:serial:<serial> when the USB descriptor carries a serial number', () => {
    const withSerial: PrinterDevice = { ...usbDevice, rawDevice: { vendor_id: 1155, product_id: 22222, serialNumber: 'XPR-000123' } };
    expect(resolveIdentityKey({ connectionType: ConnectionType.usb, device: withSerial })).toBe('usb:serial:XPR-000123');
  });

  it('two same-model USB printers with distinct serials get distinct identityKeys', () => {
    const a: PrinterDevice = { ...usbDevice, rawDevice: { serialNumber: 'AAA' } };
    const b: PrinterDevice = { ...usbDevice, rawDevice: { serialNumber: 'BBB' } };
    expect(resolveIdentityKey({ connectionType: ConnectionType.usb, device: a })).not.toBe(
      resolveIdentityKey({ connectionType: ConnectionType.usb, device: b }),
    );
  });

  it('throws when USB/Bluetooth is missing the device', () => {
    expect(() => resolveIdentityKey({ connectionType: ConnectionType.usb })).toThrow();
  });

  it('two different physical printers of the same model over USB collide on identityKey — a documented limitation, not a bug', () => {
    const cloneA: PrinterDevice = { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: {} };
    const cloneB: PrinterDevice = { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: {} };
    expect(resolveIdentityKey({ connectionType: ConnectionType.usb, device: cloneA })).toBe(
      resolveIdentityKey({ connectionType: ConnectionType.usb, device: cloneB }),
    );
  });
});
