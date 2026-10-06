import { DeviceDiscoveryService } from '../DeviceDiscoveryService';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { DiscoveryStatus } from '../../models/discovery/DiscoveryStatus';
import type { DiscoveryEvent } from '../../models/discovery/DiscoveryEvent';
import type { DiscoverResult } from '../../models/discovery/DiscoverResult';
import { printerLogger } from '../../logging/PrinterLogger';
import { makeFakeAdapter } from '../../testing/printerServiceTestKit';
import { DeviceErrorCode, PrintErrorCode } from '../../errors';

jest.mock('../../../../services/LoggerService', () => ({
  LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() },
}));

jest.mock('../../logging/PrinterLogger', () => ({
  printerLogger: { discoveryStarted: jest.fn(), discoveryCompleted: jest.fn(), discoveryFailed: jest.fn() },
}));

const bluetoothPrinter: DiscoverResult = {
  device: { deviceId: 'bluetooth:AA:BB', name: 'XP-P323B', hasPermission: true },
  connection: { type: ConnectionType.Bluetooth, mac: 'AA:BB' },
};

/** Service với một adapter giả và quyền Bluetooth tuỳ chọn. */
const setup = (bluetoothGranted = true) => {
  const { adapter } = makeFakeAdapter();
  const ensureBluetoothPermission = jest.fn().mockResolvedValue(bluetoothGranted);
  const service = new DeviceDiscoveryService(() => adapter, ensureBluetoothPermission);

  return { service, adapter, ensureBluetoothPermission };
};

/** Quét và chờ tới sự kiện kết thúc đầu tiên. */
const discoverUntilSettled = (
  service: ReturnType<typeof setup>['service'],
  connectionType: ConnectionType,
): Promise<DiscoveryEvent[]> =>
  new Promise((resolve) => {
    const events: DiscoveryEvent[] = [];
    service.discover(connectionType, (event) => {
      events.push(event);

      if (event.status !== DiscoveryStatus.Loading) {
        resolve(events);
      }
    });
  });

describe('DeviceDiscoveryService', () => {
  afterEach(() => jest.clearAllMocks());

  it('LAN báo rỗng ngay, không gọi adapter', () => {
    const { service, adapter } = setup();
    const events: DiscoveryEvent[] = [];

    service.discover(ConnectionType.Lan, (event) => events.push(event));

    expect(events).toEqual([{ status: DiscoveryStatus.Empty }]);
    expect(adapter.listDevices).not.toHaveBeenCalled();
  });

  it('Bluetooth xin quyền rồi trả nguyên kết quả của adapter', async () => {
    const { service, adapter, ensureBluetoothPermission } = setup();
    adapter.listDevices.mockResolvedValueOnce([bluetoothPrinter]);

    const events = await discoverUntilSettled(service, ConnectionType.Bluetooth);

    expect(ensureBluetoothPermission).toHaveBeenCalled();
    expect(adapter.listDevices).toHaveBeenCalledWith(ConnectionType.Bluetooth);
    expect(events).toEqual([
      { status: DiscoveryStatus.Loading },
      { status: DiscoveryStatus.Found, devices: [bluetoothPrinter] },
    ]);
    expect(printerLogger.discoveryCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: ConnectionType.Bluetooth, deviceCount: 1 }),
    );
  });

  it('không có quyền Bluetooth thì báo Error và không quét', async () => {
    const { service, adapter } = setup(false);

    const events = await discoverUntilSettled(service, ConnectionType.Bluetooth);

    expect(events[1]).toMatchObject({
      status: DiscoveryStatus.Error,
      error: { code: DeviceErrorCode.PERMISSION_DENIED, message: 'Chưa được cấp quyền Bluetooth' },
    });
    expect(adapter.listDevices).not.toHaveBeenCalled();
  });

  it('USB quét thẳng, không xin quyền Bluetooth', async () => {
    const { service, adapter, ensureBluetoothPermission } = setup();

    const events = await discoverUntilSettled(service, ConnectionType.Usb);

    expect(ensureBluetoothPermission).not.toHaveBeenCalled();
    expect(adapter.listDevices).toHaveBeenCalledWith(ConnectionType.Usb);
    expect(events[1]).toEqual({ status: DiscoveryStatus.Empty });
  });

  it('native báo "No Device Found" thì coi là rỗng', async () => {
    const { service, adapter } = setup();
    adapter.listDevices.mockRejectedValueOnce('No Device Found');

    const events = await discoverUntilSettled(service, ConnectionType.Usb);

    expect(events[1]).toEqual({ status: DiscoveryStatus.Empty });
  });

  it('lỗi quét thật thì báo Error và ghi log discoveryFailed', async () => {
    const { service, adapter } = setup();
    adapter.listDevices.mockRejectedValueOnce(new Error('bluetooth adapter off'));

    const events = await discoverUntilSettled(service, ConnectionType.Bluetooth);

    expect(events[1]).toMatchObject({
      status: DiscoveryStatus.Error,
      error: { code: PrintErrorCode.UNKNOWN_ERROR, message: 'bluetooth adapter off' },
    });
    expect(printerLogger.discoveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({ connectionType: ConnectionType.Bluetooth }),
    );
  });

  it('huỷ trước khi quét xong thì không báo thêm sự kiện', async () => {
    const { service, adapter } = setup();
    let finish: (devices: DiscoverResult[]) => void = () => undefined;
    adapter.listDevices.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const events: DiscoveryEvent[] = [];

    const unsubscribe = service.discover(ConnectionType.Usb, (event) => events.push(event));
    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribe();
    finish([bluetoothPrinter]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).toEqual([{ status: DiscoveryStatus.Loading }]);
  });
});
