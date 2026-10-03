import { deviceIdOf } from '../deviceIdOf';
import { ConnectionType } from '../ConnectionType';

describe('deviceIdOf', () => {
  it('LAN { host, port } → "lan:host:port"', () => {
    const connection = { type: ConnectionType.Lan, host: '192.168.1.10', port: 9100 };
    expect(deviceIdOf(connection)).toBe('lan:192.168.1.10:9100');
  });

  it('Bluetooth { mac } → "bluetooth:mac:MAC_UPPER"', () => {
    const connection = { type: ConnectionType.Bluetooth, mac: 'aa:bb:cc:dd:ee:ff' };
    expect(deviceIdOf(connection)).toBe('bluetooth:mac:AA:BB:CC:DD:EE:FF');
  });

  it('USB không serial { vendorId, productId } → "usb:vendorId:productId"', () => {
    const connection = { type: ConnectionType.Usb, vendorId: 1155, productId: 22222 };
    expect(deviceIdOf(connection)).toBe('usb:1155:22222');
  });

  it('USB có serial { vendorId, productId, serialNumber } → "usb:vendorId:productId:serial"', () => {
    const connection = { type: ConnectionType.Usb, vendorId: 1155, productId: 22222, serialNumber: 'SN1' };
    expect(deviceIdOf(connection)).toBe('usb:1155:22222:SN1');
  });

  it('2 USB serial khác nhau → 2 id khác nhau', () => {
    const connection1 = { type: ConnectionType.Usb, vendorId: 1155, productId: 22222, serialNumber: 'SN1' };
    const connection2 = { type: ConnectionType.Usb, vendorId: 1155, productId: 22222, serialNumber: 'SN2' };
    expect(deviceIdOf(connection1)).not.toBe(deviceIdOf(connection2));
  });
});
