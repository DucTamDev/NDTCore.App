import type { IPrinterAdapter } from '../adapters/IPrinterAdapter';
import type { PrinterConnectionService } from '../connection/PrinterConnectionService';
import { ConnectionType } from '../models/printer/ConnectionType';
import {
  LanguageSelection,
  PrintLanguage,
  type PrinterLanguage,
} from '../models/printer/PrinterLanguage';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { CutterMode, PaperSize, PaperType } from '../models/paper/PaperOptions';
import { type Printer } from '../models/printer/Printer';
import { PrintKind } from '../models/printer/PrintKind';

// Fixture dùng chung cho các file test service; nằm ngoài `__tests__/` và không có đuôi `.test.` nên Jest bỏ qua.

/** Adapter giả ghi nhận lời gọi; `lose()` giả lập kết nối của adapter bị mất. */
export const makeFakeAdapter = (): { adapter: jest.Mocked<IPrinterAdapter>; lose: () => void } => {
  const lostCallbacks = new Set<() => void>();

  const adapter: jest.Mocked<IPrinterAdapter> = {
    source: 'native',
    canRead: true,
    listDevices: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(undefined),
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

/** Chỉ phần công khai: object giả không thể có field private của class. */
type ConnectionServiceApi = Pick<PrinterConnectionService, keyof PrinterConnectionService>;

/** Connection service giả: mặc định máy đã kết nối, gửi và ngắt đều thành công. */
export const makeMockConnectionService = (
  overrides: Partial<jest.Mocked<ConnectionServiceApi>> = {},
): jest.Mocked<ConnectionServiceApi> => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  send: jest.fn().mockResolvedValue(undefined),
  read: jest.fn().mockResolvedValue(null),
  getStatus: jest.fn().mockReturnValue(PrinterStatus.Connected),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  reconnect: jest.fn().mockResolvedValue(undefined),
  reconnectAutoPrinters: jest.fn(),
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
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
