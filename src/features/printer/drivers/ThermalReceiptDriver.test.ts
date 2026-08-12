import { ThermalReceiptDriver } from './ThermalReceiptDriver';
import type { PrinterConfig } from '../types/printer.types';

// The library's real dist/index.d.ts (inspected after `npm install`) differs
// from the plan's README-only assumptions: `connectPrinter()` takes
// positional args specific to each namespace (not a shared `{host, port}`-
// style object), and `printText()` is callback-based (`cbSuccess`/`cbErr`),
// not Promise-returning. Mocks below reflect the real shapes.
jest.mock('@poriyaalar/react-native-thermal-receipt-printer', () => ({
  USBPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'USB', vendor_id: '1155', product_id: '22222' }),
    printText: jest.fn((_text: string, _opts: unknown, cbSuccess?: (msg: string) => void) => cbSuccess?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
  BLEPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'BLE', inner_mac_address: '00:11:22:33:44:55' }),
    printText: jest.fn((_text: string, _opts: unknown, cbSuccess?: (msg: string) => void) => cbSuccess?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
  NetPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'Net', host: '192.168.1.50', port: 9100 }),
    printText: jest.fn((_text: string, _opts: unknown, cbSuccess?: (msg: string) => void) => cbSuccess?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../services/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));

const lanConfig: PrinterConfig = {
  id: 'receipt-lan',
  printerName: 'Máy in hoá đơn',
  protocol: 'escpos',
  protocolSource: 'auto',
  connectionType: 'lan',
  paperSize: '80mm',
  autoReconnect: false,
  isDefault: false,
  lan: { ip: '192.168.1.50', port: 9100 },
};

const bleConfig: PrinterConfig = {
  ...lanConfig,
  id: 'receipt-ble',
  connectionType: 'bluetooth',
  lan: undefined,
  device: { deviceId: '00:11:22:33:44:55', displayName: 'Máy in BLE', rawDevice: {} },
};

const usbConfig: PrinterConfig = {
  ...lanConfig,
  id: 'receipt-usb',
  connectionType: 'usb',
  lan: undefined,
  device: { deviceId: '1155:22222', displayName: 'Máy in USB', rawDevice: { vendor_id: 1155, product_id: 22222 } },
};

describe('ThermalReceiptDriver', () => {
  it('connect() over LAN transitions status idle -> connecting -> connected', async () => {
    const driver = new ThermalReceiptDriver();
    const statuses: string[] = [];
    driver.onStatusChange(lanConfig.id, (status) => statuses.push(status));
    expect(driver.getStatus(lanConfig.id)).toBe('idle');
    await driver.connect(lanConfig);
    expect(statuses).toEqual(['connecting', 'connected']);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { connectPrinter: jest.Mock };
    };
    expect(NetPrinter.connectPrinter).toHaveBeenCalledWith('192.168.1.50', 9100);
  });

  it('connect() over Bluetooth checks permission and connects with the device MAC address', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(bleConfig);
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    const { BLEPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      BLEPrinter: { connectPrinter: jest.Mock };
    };
    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(BLEPrinter.connectPrinter).toHaveBeenCalledWith('00:11:22:33:44:55');
    expect(driver.getStatus(bleConfig.id)).toBe('connected');
  });

  it('connect() over Bluetooth fails with CONNECTION_ERROR when permission is denied', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../services/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockResolvedValueOnce(false);
    const driver = new ThermalReceiptDriver();
    await expect(driver.connect(bleConfig)).rejects.toMatchObject({ code: 'CONNECTION_ERROR' });
    expect(driver.getStatus(bleConfig.id)).toBe('error');
  });

  it('connect() over USB reads vendor_id/product_id from the scanned rawDevice', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(usbConfig);
    const { USBPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      USBPrinter: { connectPrinter: jest.Mock };
    };
    expect(USBPrinter.connectPrinter).toHaveBeenCalledWith('1155', '22222');
  });

  it('disconnect() closes the connection and sets status disconnected', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    await driver.disconnect(lanConfig.id);
    expect(driver.getStatus(lanConfig.id)).toBe('disconnected');
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { closeConn: jest.Mock };
    };
    expect(NetPrinter.closeConn).toHaveBeenCalled();
  });

  it('scan("lan") reports empty immediately without calling the library', () => {
    const driver = new ThermalReceiptDriver();
    const events: string[] = [];
    driver.scan('lan', (event) => events.push(event.type));
    expect(events).toEqual(['empty']);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { getDeviceList: jest.Mock };
    };
    expect(NetPrinter.getDeviceList).not.toHaveBeenCalled();
  });

  it('scan("bluetooth") checks permission before calling BLEPrinter.getDeviceList', async () => {
    const driver = new ThermalReceiptDriver();
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      driver.scan('bluetooth', (event) => {
        events.push(event.type);
        if (event.type !== 'loading') resolve();
      });
    });
    expect(events).toEqual(['loading', 'empty']);
    const { BLEPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      BLEPrinter: { getDeviceList: jest.Mock };
    };
    expect(BLEPrinter.getDeviceList).toHaveBeenCalled();
  });

  it('testPrint() reuses an already-open connection instead of reconnecting', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { connectPrinter: jest.Mock; printText: jest.Mock };
    };
    const callsBeforeTestPrint = NetPrinter.connectPrinter.mock.calls.length;
    await driver.testPrint(lanConfig);
    expect(NetPrinter.connectPrinter.mock.calls.length).toBe(callsBeforeTestPrint);
    expect(NetPrinter.printText).toHaveBeenCalled();
  });

  it('identify() returns null when not connected', async () => {
    const driver = new ThermalReceiptDriver();
    const result = await driver.identify('never-connected');
    expect(result).toBeNull();
  });

  it('identify() returns a non-null PrinterDeviceInfo when connected', async () => {
    const driver = new ThermalReceiptDriver();
    await driver.connect(lanConfig);
    const result = await driver.identify(lanConfig.id);
    expect(result).not.toBeNull();
  });
});
