import type { IPrinterAdapter } from '../adapters/IPrinterAdapter';
import type { PrinterConnectionService } from '../connection/PrinterConnectionService';
import type { DeviceAddress } from '../models/device/DeviceAddress';
import type { ConnectedDevice } from '../models/device/ConnectedDevice';
import { ConnectionType } from '../models/connections/ConnectionType';
import {
  LanguageSelection,
  PrintLanguage,
  type PrinterLanguage,
} from '../models/printer/PrinterLanguage';
import { ConnectionStatus } from '../models/connections/ConnectionStatus';
import { CutterMode } from '../models/paper/CutterMode';
import { PaperSize } from '../models/paper/PaperSize';
import { PaperType } from '../models/paper/PaperType';
import { type Printer } from '../models/printer/Printer';
import { PrintKind } from '../models/printer/PrintKind';

// Fixture dùng chung cho các file test service; nằm ngoài `__tests__/` và không có đuôi `.test.` nên Jest bỏ qua.

/** Định danh giống quy tắc native: LAN theo host:port, Bluetooth theo MAC, USB theo vendorId:productId (+ serial). */
export const fakeDeviceIdOf = (address: DeviceAddress): string => {
  if (address.type === ConnectionType.Lan) {
    return `lan:${address.host}:${address.port}`;
  }

  if (address.type === ConnectionType.Bluetooth) {
    return `bluetooth:${address.mac.toUpperCase()}`;
  }

  const usbId = `usb:${address.vendorId}:${address.productId}`;
  return address.serialNumber ? `${usbId}:${address.serialNumber}` : usbId;
};

/** Thông tin native trả khi kết nối; cùng địa chỉ thì cùng `connectionId`, như native dùng chung kết nối. */
export const fakeConnectedDevice = (
  address: DeviceAddress,
  overrides: Partial<ConnectedDevice> = {},
): ConnectedDevice => ({
  connectionId: `conn:${fakeDeviceIdOf(address)}`,
  deviceId: fakeDeviceIdOf(address),
  address,
  ...overrides,
});

/** Adapter giả ghi nhận lời gọi; `lose()` giả lập kết nối của adapter bị mất. */
export const makeFakeAdapter = (): { adapter: jest.Mocked<IPrinterAdapter>; lose: () => void } => {
  const lostCallbacks = new Set<() => void>();

  const adapter: jest.Mocked<IPrinterAdapter> = {
    source: 'native',
    canRead: true,
    listDevices: jest.fn().mockResolvedValue([]),
    connect: jest.fn((address: DeviceAddress) => Promise.resolve(fakeConnectedDevice(address))),
    write: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(null),
    onLost: jest.fn((callback: () => void) => {
      lostCallbacks.add(callback);
      return () => lostCallbacks.delete(callback);
    }),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };

  return { adapter, lose: () => lostCallbacks.forEach((callback) => callback()) };
};

/**
 * Ép object giả (chỉ có các method test cần) sang kiểu class: service nhận nguyên class làm phụ thuộc, mà class có
 * field private nên object viết tay không bao giờ khớp kiểu.
 */
export const mockOf = <T>(members: Partial<T>): T => members as T;

/** Connection service giả: mặc định máy đã kết nối, gửi và ngắt đều thành công. */
export const makeMockConnectionService = (
  overrides: Partial<jest.Mocked<PrinterConnectionService>> = {},
): jest.Mocked<PrinterConnectionService> =>
  mockOf<jest.Mocked<PrinterConnectionService>>({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(null),
    getStatus: jest.fn().mockReturnValue(ConnectionStatus.Connected),
    onStatusChange: jest.fn().mockReturnValue(() => undefined),
    reconnect: jest.fn().mockResolvedValue(undefined),
    connectEnabledPrinters: jest.fn(),
    ensureConnected: jest.fn().mockResolvedValue(undefined),
    forget: jest.fn(),
    ...overrides,
  });

export const escposLanguage: PrinterLanguage = {
  type: PrintLanguage.EscPos,
  selection: LanguageSelection.Auto,
};

export const tsplLanguage: PrinterLanguage = {
  type: PrintLanguage.Tspl,
  selection: LanguageSelection.Auto,
};

export const basePrinter: Printer = {
  id: 'p1',
  deviceId: 'lan:192.168.1.10:9100',
  kind: PrintKind.Receipt,
  name: 'Máy in hóa đơn quầy 1',
  language: escposLanguage,
  connection: { type: ConnectionType.Lan, host: '192.168.1.10', port: 9100 },
  paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode: CutterMode.PerJob },
  capabilities: { cutter: false, cashDrawer: false, color: false, image: false },
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
