import { TsplDriver } from '../TsplDriver';
import { PrinterConnectionService } from '../../../connection/PrinterConnectionService';
import { DeviceScanEventType } from '../../../models/printer/PrinterDevice';
import { ConnectionType } from '../../../models/printer/ConnectionType';
import { PrintKind } from '../../../models/printer/PrintKind';
import type { Printer } from '../../../models/printer/Printer';
import { makePrinter, makeTsplLanguage } from '../../../testing/printerFixtures';

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
  (jest.requireMock('../../../adapters/native/DeviceModule') as { DeviceModule: { write: jest.Mock; read: jest.Mock } })
    .DeviceModule;

const permissionMock = () =>
  jest.requireMock('../../../permissions/PrinterPermissionService') as { ensureBluetoothPermission: jest.Mock };

const bluetoothClassicMock = () =>
  jest.requireMock('react-native-bluetooth-classic') as { default: { startDiscovery: jest.Mock } };

const labelPrinter: Printer = makePrinter({
  id: 'label-1',
  deviceId: 'lan:192.168.1.60:9100',
  kind: PrintKind.Label,
  language: makeTsplLanguage(),
  connection: { type: ConnectionType.Lan, host: '192.168.1.60', port: 9100 },
});

/** Quét Bluetooth và chờ tới sự kiện kết thúc đầu tiên. */
const scanBluetooth = (driver: TsplDriver): Promise<string[]> =>
  new Promise((resolve) => {
    const events: string[] = [];
    driver.scan(ConnectionType.Bluetooth, (event) => {
      events.push(event.type);

      if (event.type !== DeviceScanEventType.Loading) {
        resolve(events);
      }
    });
  });

describe('TsplDriver', () => {
  afterEach(() => jest.clearAllMocks());

  it('quét LAN báo rỗng ngay', () => {
    const events: string[] = [];
    new TsplDriver().scan(ConnectionType.Lan, (event) => events.push(event.type));

    expect(events).toEqual([DeviceScanEventType.Empty]);
  });

  it('không tự quét USB', () => {
    const events: string[] = [];
    new TsplDriver().scan(ConnectionType.Usb, (event) => events.push(event.type));

    expect(events).toEqual([DeviceScanEventType.Error]);
  });

  it('quét Bluetooth xin quyền trước', async () => {
    await expect(scanBluetooth(new TsplDriver())).resolves.toEqual([
      DeviceScanEventType.Loading,
      DeviceScanEventType.Empty,
    ]);
    expect(permissionMock().ensureBluetoothPermission).toHaveBeenCalled();
  });

  it('không có quyền Bluetooth thì báo Error và không quét', async () => {
    permissionMock().ensureBluetoothPermission.mockResolvedValueOnce(false);

    await expect(scanBluetooth(new TsplDriver())).resolves.toEqual([
      DeviceScanEventType.Loading,
      DeviceScanEventType.Error,
    ]);
    expect(bluetoothClassicMock().default.startDiscovery).not.toHaveBeenCalled();
  });

  it('chưa kết nối thì không xác nhận', async () => {
    await expect(new TsplDriver().identify({ ...labelPrinter, id: 'never-connected' })).resolves.toBeNull();
  });

  it('gửi lệnh dò ~!T; máy không trả lời thì không xác nhận', async () => {
    await PrinterConnectionService.connect(labelPrinter);

    await expect(new TsplDriver().identify(labelPrinter)).resolves.toBeNull();
    expect(deviceModule().write).toHaveBeenCalledWith('mock-connection', 'fiFUDQo=', expect.any(Number));
  });

  it('máy trả lời lệnh dò thì xác nhận TSPL', async () => {
    await PrinterConnectionService.connect(labelPrinter);
    deviceModule().read.mockResolvedValueOnce('VFNDIFRFMjQ0');

    await expect(new TsplDriver().identify(labelPrinter)).resolves.toEqual({});
  });
});
