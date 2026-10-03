import { EscPosDriver } from '../EscPosDriver';
import { PrinterConnectionService } from '../../../connection/PrinterConnectionService';
import { DeviceScanEventType } from '../../../models/printer/PrinterDevice';
import { ConnectionType } from '../../../models/printer/ConnectionType';
import type { Printer } from '../../../models/printer/Printer';
import { makePrinter } from '../../../testing/printerFixtures';
import { PrinterErrorCode } from '../../../errors/PrinterError';

jest.mock('../../../../../services/LoggerService', () => ({
  LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../permissions/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../../logging/PrinterLogger', () => ({
  PrinterLogger: new Proxy(
    {},
    { get: (target: Record<string, jest.Mock>, key: string) => (target[key] ??= jest.fn()) },
  ),
}));

const deviceModule = () =>
  (jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { discover: jest.Mock } }).DeviceModule;

const printerLogger = () =>
  (jest.requireMock('../../../logging/PrinterLogger') as { PrinterLogger: Record<string, jest.Mock> }).PrinterLogger;

const lanPrinter: Printer = makePrinter({
  id: 'receipt-lan',
  deviceId: 'lan:192.168.1.50:9100',
  connection: { type: ConnectionType.Lan, host: '192.168.1.50', port: 9100 },
});

const usbPrinter: Printer = {
  ...lanPrinter,
  id: 'receipt-usb',
  connection: { type: ConnectionType.Usb, vendorId: 1155, productId: 22222 },
};

/** Quét Bluetooth và chờ tới sự kiện kết thúc đầu tiên. */
const scanBluetooth = (driver: EscPosDriver): Promise<string[]> =>
  new Promise((resolve) => {
    const events: string[] = [];
    driver.scan(ConnectionType.Bluetooth, (event) => {
      events.push(event.type);

      if (event.type !== DeviceScanEventType.Loading) {
        resolve(events);
      }
    });
  });

describe('EscPosDriver', () => {
  afterEach(() => jest.clearAllMocks());

  it('quét LAN báo rỗng ngay, không gọi native', () => {
    const events: string[] = [];
    new EscPosDriver().scan(ConnectionType.Lan, (event) => events.push(event.type));

    expect(events).toEqual([DeviceScanEventType.Empty]);
    expect(deviceModule().discover).not.toHaveBeenCalled();
  });

  it('quét Bluetooth xin quyền rồi gọi native discover', async () => {
    await expect(scanBluetooth(new EscPosDriver())).resolves.toEqual([
      DeviceScanEventType.Loading,
      DeviceScanEventType.Empty,
    ]);
    expect(deviceModule().discover).toHaveBeenCalledWith('bluetooth');
    expect(printerLogger().scanCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: ConnectionType.Bluetooth, deviceCount: 0 }),
    );
  });

  it('kiểm tra quyền Bluetooth lỗi thì báo Error', async () => {
    const { ensureBluetoothPermission } = jest.requireMock('../../../permissions/PrinterPermissionService') as {
      ensureBluetoothPermission: jest.Mock;
    };
    ensureBluetoothPermission.mockRejectedValueOnce(new Error('permission check failed'));

    await expect(scanBluetooth(new EscPosDriver())).resolves.toEqual([
      DeviceScanEventType.Loading,
      DeviceScanEventType.Error,
    ]);
  });

  it('native báo "No Device Found" thì coi là rỗng', async () => {
    deviceModule().discover.mockRejectedValueOnce('No Device Found');

    await expect(scanBluetooth(new EscPosDriver())).resolves.toEqual([
      DeviceScanEventType.Loading,
      DeviceScanEventType.Empty,
    ]);
  });

  it('lỗi quét thật thì báo Error và ghi log scanFailed', async () => {
    deviceModule().discover.mockRejectedValueOnce(new Error('bluetooth adapter off'));

    await expect(scanBluetooth(new EscPosDriver())).resolves.toEqual([
      DeviceScanEventType.Loading,
      DeviceScanEventType.Error,
    ]);
    expect(printerLogger().scanFailed).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED }),
    );
  });

  it('xác nhận yếu: LAN đã kết nối thì xác nhận, chưa kết nối thì không', async () => {
    const driver = new EscPosDriver();

    await expect(driver.identify(lanPrinter)).resolves.toBeNull();

    await PrinterConnectionService.connect(lanPrinter);
    await expect(driver.identify(lanPrinter)).resolves.toEqual({});
  });

  it('USB không bao giờ tự xác nhận ESC/POS', async () => {
    await PrinterConnectionService.connect(usbPrinter);

    await expect(new EscPosDriver().identify(usbPrinter)).resolves.toBeNull();
  });
});
