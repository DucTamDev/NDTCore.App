# Printer Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `src/features/printer/` to a layered architecture (Driver/Transport/Adapter/Discovery/Storage/Routing) with a multi-driver-per-printer data model, printer identity/uniqueness, and a fixed USB resource-lock bug — with no data migration (destructive reset).

**Architecture:** `Printer.drivers: PrinterDriver[]` replaces the single `protocol` field. `PrinterService` (facade) delegates print-target selection to a new `PrintRoutingService`, storage to `PrinterStorage`, and identity to `PrinterResolver`. TSPL keeps its own `Transport` abstraction; ESC/POS keeps its documented pragmatic exception (vendor library owns connect+encode+write) routed through a new `ThermalPrinterLibraryAdapter`.

**Tech Stack:** React Native CLI + TypeScript strict, Zod, Jest, MMKV (via `StorageService`).

**Spec:** `docs/superpowers/specs/2026-08-26-printer-architecture-refactor-design.md` — this plan implements that spec section-by-section; read both together.

## Global Constraints

- No data migration — destructive reset (spec §10): bump `printer.storageVersion`, wipe `printer.list`/`printer.defaultId` when outdated.
- TrueType font for TSPL is OUT OF SCOPE this refactor — `TsplRenderMode` is the single literal `'bitmap'`, no UI toggle, no `TsplFontManager` (spec §1).
- Keep the existing `PrintType` name (`'Receipt' | 'Label'`, from `types/printConfiguration.types.ts`) — do NOT rename to `PrintContentType`. That file is untouched.
- Rename `Protocol` → `PrinterDriverType`, `ProtocolSource` → `DriverSource`, `PrinterConfig` → `Printer` everywhere (no backward-compat aliases — destructive refactor, not additive).
- ESC/POS keeps its pragmatic exception (spec §2.3): it does NOT go through `Transport`; its `encode()` exists only for test/snapshot purposes, never used on the production write path.
- Resource lock key formula is NOT uniform across drivers (spec §9) — `usb` is global; `escpos:bluetooth`/`escpos:lan` are per-connectionType-global (vendor library singleton); `tspl:bluetooth:<deviceId>`/`tspl:lan:<host>:<port>` are per-connection.
- Every changed file's existing `__tests__/*.test.ts(x)` must keep passing (same test *names*/count where behavior is unchanged, adapted fixtures) — never delete a pre-existing test case without an explicit reason tied to removed behavior (e.g. `isDefault` tests).
- Before every commit in this plan: `npm run type-check && npm run lint && npm test` (repo's own `npm run verify`) must pass.
- Test files always live in `__tests__/` beside the file they test, suffix `.test.ts`/`.test.tsx` (see `.claude/rules/testing-file-organization.md`) — never colocated.

---

## Phase A — Foundations (types, definitions, identity, storage, schema)

### Task 1: `types/printer.types.ts` — new data model

**Files:**
- Modify: `src/features/printer/types/printer.types.ts` (full rewrite)
- Modify: `src/features/printer/services/PrinterLogger.ts` (rename `Protocol` → `PrinterDriverType`)
- Test: `src/features/printer/types/__tests__/printer.types.test.ts` (full rewrite)

**Interfaces:**
- Produces: `PrinterDriverType`, `ConnectionType`, `PaperSize` (now `58 | 80`), `DriverSource`, `TsplRenderMode`, `TsplDriverConfig`, `EscPosDriverConfig`, `PrinterDriverConfig`, `PrinterDriver`, `Printer`, `PrinterDevice`, `PrinterLanConfig`, `PrinterDeviceInfo`, `DeviceScanEventType`, `DeviceScanEvent` — every later task imports these from this file.

- [ ] **Step 1: Replace the file**

```ts
// src/features/printer/types/printer.types.ts
import type { AppError } from './AppError';
import type { PrintType } from './printConfiguration.types';

export type PrinterDriverType = 'escpos' | 'tspl';
export type ConnectionType = 'usb' | 'bluetooth' | 'lan';
export type PaperSize = 58 | 80;
export type DriverSource = 'auto' | 'manual';
/**
 * Chỉ 1 giá trị khả dụng hiện tại — TrueType font cho TSPL ngoài phạm vi lần
 * refactor này (xem spec §1, §4.1). KHÔNG thêm `'truetype'` vào union này cho
 * tới khi có spike riêng xác nhận khả thi trên phần cứng thật.
 */
export type TsplRenderMode = 'bitmap';

export type PrinterStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface PrinterDevice {
  deviceId: string;
  displayName: string;
  rawDevice: Record<string, unknown>;
}

export interface PrinterLanConfig {
  ip: string;
  port: number;
}

export interface PrinterDeviceInfo {
  deviceName?: string;
  vendor?: string;
  model?: string;
}

export interface TsplDriverConfig {
  type: 'tspl';
  /** Luôn `'bitmap'` — không có UI chọn ở phase này (xem spec §4.2, §7.2). */
  renderMode: TsplRenderMode;
  /**
   * Chỉ có ý nghĩa khi in Tem (`PrintType.Label`) — chiều cao khổ giấy VẬT LÝ
   * (mm) khai báo trong lệnh `SIZE`/`GAP` của TSPL. `undefined` dùng
   * `DEFAULT_LABEL_HEIGHT_MM` (xem `drivers/tspl/TsplEncoder.ts`).
   */
  labelHeightMm?: number;
}

export interface EscPosDriverConfig {
  type: 'escpos';
}

export type PrinterDriverConfig = TsplDriverConfig | EscPosDriverConfig;

export interface PrinterDriver {
  type: PrinterDriverType;
  source: DriverSource;
  /** Phải là tập con của `PrinterDriverDefinitions[type].contentTypes` (xem `definitions/PrinterDriverDefinitions.ts`), và không được giao với `contentTypes` của driver khác trên cùng `Printer` (invariant #3, enforce ở `schemas/printerFormSchema.ts`). */
  contentTypes: PrintType[];
  config: PrinterDriverConfig;
}

export interface Printer {
  id: string;
  name: string;
  vendor?: string;
  model?: string;
  /** `>= 1, <= 2` (escpos + tspl) — enforce ở schema, không chỉ document (invariant #2, #10). */
  drivers: PrinterDriver[];
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
  /** Xem `discovery/PrinterResolver.ts` — chỉ phụ thuộc connectionType+device/lan, không phụ thuộc driver nào. */
  identityKey: string;
  paperSize: PaperSize;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  // KHÔNG có isDefault — không dùng cho routing thực tế (xem spec §4.4).
  // KHÔNG có field trạng thái kết nối runtime nào (invariant #11).
}

export type DeviceScanEventType = 'loading' | 'found' | 'empty' | 'error';

export interface DeviceScanEvent {
  type: DeviceScanEventType;
  devices?: PrinterDevice[];
  error?: AppError;
}
```

- [ ] **Step 2: Rename `Protocol` → `PrinterDriverType` in `PrinterLogger.ts`**

In `src/features/printer/services/PrinterLogger.ts`, change the import and every parameter type:

```ts
import type { ConnectionType, PrinterDriverType } from '../types/printer.types';
```

Then replace every `protocol: Protocol` parameter type (11 occurrences: `connectSucceeded`, `connectFailed`, `disconnectSucceeded`, `disconnectFailed`, `testPrintSucceeded`, `testPrintFailed`, `discoveryStarted` (`candidates: Protocol[]`), `discoveryCandidateRejected`, `discoveryFailed` (`candidatesTried: Protocol[]`), `protocolDetected` (both `protocol: Protocol` and `candidatesTried: Protocol[]`), `protocolUnknown` (`candidatesTried: Protocol[]`), `printSucceeded`, `printFailed`) with `protocol: PrinterDriverType` / `PrinterDriverType[]` respectively. The string values passed at call sites (`'escpos'`, `'tspl'`) do not change — only the type annotation.

- [ ] **Step 3: Replace the type test file**

```ts
// src/features/printer/types/__tests__/printer.types.test.ts
import type { IPrinterDriver } from '../driver.types';
import type { Printer, PrinterDriver } from '../printer.types';

describe('printer domain types', () => {
  it('accepts a fully-formed Printer with a single tspl driver for a LAN label printer', () => {
    const driver: PrinterDriver = {
      type: 'tspl',
      source: 'auto',
      contentTypes: ['Label'],
      config: { type: 'tspl', renderMode: 'bitmap' },
    };
    const printer: Printer = {
      id: 'p1',
      name: 'Máy in tem quầy 1',
      drivers: [driver],
      connectionType: 'lan',
      lan: { ip: '192.168.1.50', port: 9100 },
      identityKey: 'lan:192.168.1.50:9100',
      paperSize: 58,
      autoReconnect: true,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(printer.drivers[0].type).toBe('tspl');
  });

  it('accepts a Printer with two drivers (escpos + tspl) over the same physical connection', () => {
    const printer: Printer = {
      id: 'p1',
      name: 'Máy in đa năng',
      drivers: [
        { type: 'escpos', source: 'auto', contentTypes: ['Receipt'], config: { type: 'escpos' } },
        { type: 'tspl', source: 'manual', contentTypes: ['Label'], config: { type: 'tspl', renderMode: 'bitmap' } },
      ],
      connectionType: 'usb',
      device: { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: {} },
      identityKey: 'usb:device:1155:22222',
      paperSize: 80,
      autoReconnect: false,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(printer.drivers).toHaveLength(2);
  });

  it('a mock driver satisfies IPrinterDriver', () => {
    const driver: IPrinterDriver = {
      scan: () => () => undefined,
      connect: async () => undefined,
      disconnect: async () => undefined,
      getStatus: () => 'idle',
      onStatusChange: () => () => undefined,
      testPrint: async () => undefined,
      print: async () => undefined,
      identify: async () => null,
      encode: () => new Uint8Array(),
    };
    expect(driver.getStatus('p1')).toBe('idle');
  });
});
```

- [ ] **Step 4: Run the two updated test files**

Run: `npm test -- printer.types.test.ts PrinterLogger.test.ts` (if `services/__tests__/PrinterLogger.test.ts` does not exist, run `npm test -- printer.types.test.ts` only)
Expected: type test PASSES; the whole repo will NOT type-check yet (many other files still reference removed types) — that is expected until later tasks land. Do not run `npm run type-check` until Task 20.

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/types/printer.types.ts src/features/printer/types/__tests__/printer.types.test.ts src/features/printer/services/PrinterLogger.ts
git commit -m "refactor(printer): replace PrinterConfig with multi-driver Printer model"
```

---

### Task 2: `types/driver.types.ts` — new `IPrinterDriver` + `PrintDocumentVariants`

**Files:**
- Modify: `src/features/printer/types/driver.types.ts` (full rewrite)

**Interfaces:**
- Consumes: `ConnectionType`, `DeviceScanEvent`, `Printer`, `PrinterDeviceInfo`, `PrinterDriver`, `PrinterStatus` from Task 1; `PrintType` from `printConfiguration.types.ts` (unchanged); `PrintDocument` from `printDocument.types.ts` (unchanged).
- Produces: `Unsubscribe`, `PrintDocumentVariants`, `IPrinterDriver` — every driver/service task from here on implements or consumes this exact shape.

- [ ] **Step 1: Replace the file**

```ts
// src/features/printer/types/driver.types.ts
import type { ConnectionType, DeviceScanEvent, Printer, PrinterDeviceInfo, PrinterDriver, PrinterStatus } from './printer.types';
import type { PrintDocument } from './printDocument.types';
import type { PrintType } from './printConfiguration.types';

export type Unsubscribe = () => void;

/**
 * `text` là document dùng mặc định cho mọi driver. `image` (tuỳ chọn) là bản
 * render sẵn thành ảnh — driver TỰ quyết định có dùng hay không (xem
 * `encode()` bên dưới và spec §7.2), KHÔNG phải nơi gọi (`PrintRoutingService`/
 * `PrintService`) quyết định thay.
 */
export interface PrintDocumentVariants {
  text: PrintDocument;
  image?: PrintDocument;
}

export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(printer: Printer, driver: PrinterDriver): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocumentVariants, printType?: PrintType): Promise<void>;
  print(printerId: string, documents: PrintDocumentVariants, printType?: PrintType): Promise<void>;
  identify(printerId: string): Promise<PrinterDeviceInfo | null>;
  /**
   * Mã hoá `documents` (chọn variant text/image theo capability của chính
   * driver) + `driver.config` thành raw bytes — public pure, dùng cho unit
   * test/snapshot không cần transport/printer thật (spec §7.2). Với ESC/POS,
   * hàm này CHỈ phục vụ test — production print đi qua thư viện vendor gộp
   * sẵn (adapters/ThermalPrinterLibraryAdapter.ts), không gọi `encode()`.
   */
  encode(printer: Printer, driver: PrinterDriver, documents: PrintDocumentVariants, printType?: PrintType): Uint8Array;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/printer/types/driver.types.ts
git commit -m "refactor(printer): update IPrinterDriver for multi-driver model + encode()"
```

---

### Task 3: `utils/paperWidth.ts` — numeric `PaperSize` keys

**Files:**
- Modify: `src/features/printer/utils/paperWidth.ts`
- Test: `src/features/printer/utils/__tests__/paperWidth.test.ts` (update fixture keys only)

- [ ] **Step 1: Update the file**

```ts
import type { PaperSize } from '../types/printer.types';

/**
 * Số ký tự/dòng ước lượng theo khổ giấy, dùng font mặc định (Font A) của máy
 * in ESC/POS — 32 ký tự cho 58mm, 48 ký tự cho 80mm là quy ước phổ biến của
 * máy in nhiệt POS, không đọc được từ driver/SDK nên phải hardcode theo khổ
 * giấy thay vì đo thật.
 */
export const PAPER_WIDTH_CHARS: Record<PaperSize, number> = {
  58: 32,
  80: 48,
};

/**
 * Chiều rộng ảnh bill (px) theo khổ giấy — dùng khi render bill thành ảnh
 * cho TSPL (`useBillImageCapture`). 576px cho 80mm khớp quy ước đã dùng ở
 * bill web (`build-bill-canvas.util.ts`); 384px cho 58mm theo cùng tỷ lệ.
 */
export const PAPER_IMAGE_WIDTH_PX: Record<PaperSize, number> = {
  58: 384,
  80: 576,
};

/** Ghép `left`/`right` thành 1 dòng canh trái/phải trong `width` ký tự. */
export const formatRow = (left: string, right: string, width: number): string => {
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(gap)}${right}`;
};
```

- [ ] **Step 2: Update the test file's fixtures**

Open `src/features/printer/utils/__tests__/paperWidth.test.ts`. Every `PAPER_WIDTH_CHARS['58mm']`/`PAPER_WIDTH_CHARS['80mm']` becomes `PAPER_WIDTH_CHARS[58]`/`PAPER_WIDTH_CHARS[80]` (same for `PAPER_IMAGE_WIDTH_PX`). `formatRow` tests are untouched. Run `npm test -- paperWidth.test.ts` and confirm the same test count passes as before.

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/utils/paperWidth.ts src/features/printer/utils/__tests__/paperWidth.test.ts
git commit -m "refactor(printer): PaperSize as number (58|80) instead of string"
```

---

### Task 4: `definitions/PrinterDriverDefinitions.ts` — static driver capability

**Files:**
- Create: `src/features/printer/definitions/PrinterDriverDefinitions.ts`
- Test: `src/features/printer/definitions/__tests__/PrinterDriverDefinitions.test.ts`

**Interfaces:**
- Consumes: `PrinterDriverType` (Task 1), `PrintType` (`printConfiguration.types.ts`, unchanged).
- Produces: `PrinterDriverDefinition`, `PRINTER_DRIVER_DEFINITIONS`, `getDriverDefinition(type)` — used by `schemas/printerFormSchema.ts` (Task 7) and `components/PrinterInfoCard.tsx` (Task 23).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/printer/definitions/__tests__/PrinterDriverDefinitions.test.ts
import { PRINTER_DRIVER_DEFINITIONS, getDriverDefinition } from '../PrinterDriverDefinitions';

describe('PrinterDriverDefinitions', () => {
  it('escpos only supports Receipt', () => {
    expect(PRINTER_DRIVER_DEFINITIONS.escpos.contentTypes).toEqual(['Receipt']);
  });

  it('tspl supports both Receipt and Label', () => {
    expect(PRINTER_DRIVER_DEFINITIONS.tspl.contentTypes).toEqual(['Receipt', 'Label']);
  });

  it('getDriverDefinition returns the definition for a given type', () => {
    expect(getDriverDefinition('tspl')).toBe(PRINTER_DRIVER_DEFINITIONS.tspl);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- PrinterDriverDefinitions.test.ts`
Expected: FAIL with "Cannot find module '../PrinterDriverDefinitions'"

- [ ] **Step 3: Implement**

```ts
// src/features/printer/definitions/PrinterDriverDefinitions.ts
import type { PrinterDriverType } from '../types/printer.types';
import type { PrintType } from '../types/printConfiguration.types';

export interface PrinterDriverDefinition {
  contentTypes: PrintType[];
}

/**
 * Capability TĨNH theo driver TYPE — driver này CÓ THỂ in loại nội dung nào,
 * tách biệt hoàn toàn khỏi `PrinterDriver.contentTypes` (loại nội dung THỰC
 * TẾ đang được gán cho 1 driver cụ thể của 1 printer, xem `types/printer.types.ts`).
 * KHÔNG phải rule table theo vendor/model — cơ chế đó đã bị bỏ trước đây vì
 * không đáng tin (xem CLAUDE.md).
 */
export const PRINTER_DRIVER_DEFINITIONS: Record<PrinterDriverType, PrinterDriverDefinition> = {
  escpos: { contentTypes: ['Receipt'] },
  tspl: { contentTypes: ['Receipt', 'Label'] },
};

export const getDriverDefinition = (type: PrinterDriverType): PrinterDriverDefinition => PRINTER_DRIVER_DEFINITIONS[type];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PrinterDriverDefinitions.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/definitions/PrinterDriverDefinitions.ts src/features/printer/definitions/__tests__/PrinterDriverDefinitions.test.ts
git commit -m "feat(printer): add PrinterDriverDefinitions (static driver capability)"
```

---

### Task 5: `discovery/PrinterResolver.ts` — printer identity

**Files:**
- Create: `src/features/printer/discovery/PrinterResolver.ts`
- Test: `src/features/printer/discovery/__tests__/PrinterResolver.test.ts`

**Interfaces:**
- Consumes: `ConnectionType`, `PrinterDevice`, `PrinterLanConfig` (Task 1).
- Produces: `ResolveIdentityKeyInput`, `resolveIdentityKey(input)` — used by `components/AddPrinterModal.tsx` (Task 22) and `printing/PrinterService.ts` (Task 17).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/printer/discovery/__tests__/PrinterResolver.test.ts
import { resolveIdentityKey } from '../PrinterResolver';
import type { PrinterDevice } from '../../types/printer.types';

const usbDevice: PrinterDevice = { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: {} };
const btDevice: PrinterDevice = { deviceId: '00:11:22:33:44:55', displayName: 'Máy in BT', rawDevice: {} };

describe('resolveIdentityKey', () => {
  it('builds a lan:<ip>:<port> key for LAN', () => {
    expect(resolveIdentityKey({ connectionType: 'lan', lan: { ip: '192.168.1.50', port: 9100 } })).toBe(
      'lan:192.168.1.50:9100',
    );
  });

  it('throws when LAN is missing the lan config', () => {
    expect(() => resolveIdentityKey({ connectionType: 'lan' })).toThrow();
  });

  it('builds a bluetooth:mac:<deviceId> key for Bluetooth', () => {
    expect(resolveIdentityKey({ connectionType: 'bluetooth', device: btDevice })).toBe('bluetooth:mac:00:11:22:33:44:55');
  });

  it('builds a usb:device:<deviceId> key for USB', () => {
    expect(resolveIdentityKey({ connectionType: 'usb', device: usbDevice })).toBe('usb:device:1155:22222');
  });

  it('throws when USB/Bluetooth is missing the device', () => {
    expect(() => resolveIdentityKey({ connectionType: 'usb' })).toThrow();
  });

  it('two different physical printers of the same model over USB collide on identityKey — a documented limitation, not a bug', () => {
    const cloneA: PrinterDevice = { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: {} };
    const cloneB: PrinterDevice = { deviceId: '1155:22222', displayName: 'XP-420B', rawDevice: {} };
    expect(resolveIdentityKey({ connectionType: 'usb', device: cloneA })).toBe(
      resolveIdentityKey({ connectionType: 'usb', device: cloneB }),
    );
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- PrinterResolver.test.ts`
Expected: FAIL with "Cannot find module '../PrinterResolver'"

- [ ] **Step 3: Implement**

```ts
// src/features/printer/discovery/PrinterResolver.ts
import type { ConnectionType, PrinterDevice, PrinterLanConfig } from '../types/printer.types';

export interface ResolveIdentityKeyInput {
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
}

/**
 * Tính identityKey của 1 physical printer — CHỈ phụ thuộc connectionType +
 * device/lan, không phụ thuộc driver/protocol nào được gán (spec §6.1).
 * KHÔNG tự quyết định "có phải trùng lặp không" — so khớp với printer đã lưu
 * là việc của `printing/PrinterService.ts` (spec §6.2).
 *
 * USB không có cách đọc serial number đáng tin qua thư viện hiện tại — fallback
 * duy nhất là vendorId:productId, đã có sẵn trong `PrinterDevice.deviceId`
 * dạng "vendor_id:product_id", KHÔNG đảm bảo phân biệt được 2 máy cùng model
 * cắm cùng lúc — giới hạn đã biết, không cố tạo giải pháp giả.
 */
export const resolveIdentityKey = (input: ResolveIdentityKeyInput): string => {
  if (input.connectionType === 'lan') {
    if (!input.lan) throw new Error('Thiếu cấu hình IP/Port để tính identityKey cho kết nối LAN');
    return `lan:${input.lan.ip}:${input.lan.port}`;
  }
  if (!input.device) {
    throw new Error(`Thiếu thiết bị để tính identityKey cho kết nối ${input.connectionType}`);
  }
  if (input.connectionType === 'bluetooth') {
    return `bluetooth:mac:${input.device.deviceId}`;
  }
  return `usb:device:${input.device.deviceId}`;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PrinterResolver.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/discovery/PrinterResolver.ts src/features/printer/discovery/__tests__/PrinterResolver.test.ts
git commit -m "feat(printer): add PrinterResolver for printer identity"
```

---

### Task 6: `storage/PrinterStorage.ts` — persistence + destructive reset

**Files:**
- Create: `src/features/printer/storage/PrinterStorage.ts`
- Test: `src/features/printer/storage/__tests__/PrinterStorage.test.ts`

**Interfaces:**
- Consumes: `Printer` (Task 1), `StorageService` (`src/services/StorageService.ts`, unchanged — `getItem<T>(key): T | null`, `setItem(key, value)`, `removeItem(key)`).
- Produces: `PrinterStorage.getPrinters()`, `PrinterStorage.savePrinters(printers)` — used by `printing/PrinterService.ts` (Task 17).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/printer/storage/__tests__/PrinterStorage.test.ts
import { PrinterStorage } from '../PrinterStorage';
import { StorageService } from '../../../../services/StorageService';
import type { Printer } from '../../types/printer.types';

const printer: Printer = {
  id: 'p1',
  name: 'Máy in',
  drivers: [{ type: 'escpos', source: 'auto', contentTypes: ['Receipt'], config: { type: 'escpos' } }],
  connectionType: 'lan',
  lan: { ip: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  paperSize: 80,
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('PrinterStorage', () => {
  beforeEach(() => {
    StorageService.removeItem('printer.list');
    StorageService.removeItem('printer.storageVersion');
    StorageService.removeItem('printer.defaultId');
  });

  it('getPrinters() returns an empty array when nothing was saved yet', () => {
    expect(PrinterStorage.getPrinters()).toEqual([]);
  });

  it('savePrinters() then getPrinters() round-trips the list', () => {
    PrinterStorage.savePrinters([printer]);
    expect(PrinterStorage.getPrinters()).toEqual([printer]);
  });

  it('discards a legacy (pre-refactor) printer.list written under a missing/older storage version', () => {
    StorageService.setItem('printer.list', [{ id: 'legacy', printerName: 'Old shape', protocol: 'escpos' }]);
    expect(PrinterStorage.getPrinters()).toEqual([]);
  });

  it('also clears the legacy printer.defaultId key on reset', () => {
    StorageService.setItem('printer.defaultId', 'old-id');
    PrinterStorage.getPrinters();
    expect(StorageService.getItem('printer.defaultId')).toBeNull();
  });

  it('does not wipe printer.list again on a second call once the version has been stamped', () => {
    PrinterStorage.savePrinters([printer]);
    expect(PrinterStorage.getPrinters()).toEqual([printer]);
    expect(PrinterStorage.getPrinters()).toEqual([printer]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- PrinterStorage.test.ts`
Expected: FAIL with "Cannot find module '../PrinterStorage'"

- [ ] **Step 3: Implement**

```ts
// src/features/printer/storage/PrinterStorage.ts
import { StorageService } from '../../../services/StorageService';
import type { Printer } from '../types/printer.types';

const PRINTER_LIST_KEY = 'printer.list';
const PRINTER_DEFAULT_ID_KEY = 'printer.defaultId';
const PRINTER_STORAGE_VERSION_KEY = 'printer.storageVersion';

/**
 * Bump khi đổi cấu trúc `Printer` không tương thích ngược (spec §10) — dữ
 * liệu MMKV theo version cũ hơn/không có bị xoá hẳn (destructive reset),
 * KHÔNG migrate. Giá trị 1 tương ứng với model `drivers: PrinterDriver[]`
 * (thay cho `protocol` đơn) của lần refactor này.
 */
const CURRENT_STORAGE_VERSION = 1;

/**
 * Xoá `printer.list`/`printer.defaultId` (key cũ, `isDefault` đã bị bỏ —
 * dọn nếu còn sót) và ghi `printer.storageVersion` mới trong CÙNG 1 lần gọi
 * — `StorageService` (MMKV) ghi đồng bộ nên 3 lệnh liên tiếp trong cùng hàm
 * là đủ atomic thực tế, không cần transaction thật (spec §10).
 */
const resetIfOutdated = (): void => {
  const storedVersion = StorageService.getItem<number>(PRINTER_STORAGE_VERSION_KEY) ?? 0;
  if (storedVersion === CURRENT_STORAGE_VERSION) return;
  StorageService.removeItem(PRINTER_LIST_KEY);
  StorageService.removeItem(PRINTER_DEFAULT_ID_KEY);
  StorageService.setItem(PRINTER_STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
};

export const PrinterStorage = {
  getPrinters(): Printer[] {
    resetIfOutdated();
    return StorageService.getItem<Printer[]>(PRINTER_LIST_KEY) ?? [];
  },

  savePrinters(printers: Printer[]): void {
    resetIfOutdated();
    StorageService.setItem(PRINTER_LIST_KEY, printers);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PrinterStorage.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/storage/PrinterStorage.ts src/features/printer/storage/__tests__/PrinterStorage.test.ts
git commit -m "feat(printer): add PrinterStorage with destructive-reset versioning"
```

---

### Task 7: `schemas/printerFormSchema.ts` — numeric paperSize + full `Printer` invariants

**Files:**
- Modify: `src/features/printer/schemas/printerFormSchema.ts` (full rewrite — add to it, keep `lanConnectionSchema` as-is)
- Test: `src/features/printer/schemas/__tests__/printerFormSchema.test.ts` (full rewrite)

**Interfaces:**
- Consumes: `getDriverDefinition` (Task 4), `Printer`/`PrinterDriver` types (Task 1).
- Produces: `lanConnectionSchema` (unchanged), `printerDisplaySchema` (field renamed `printerName`→`name`, `paperSize` numeric), `printerDriverSchema`, `printerSchema` — `printerSchema` is called by `printing/PrinterService.ts` (Task 17) as a safety-net validation before persisting.

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/printer/schemas/__tests__/printerFormSchema.test.ts
import { lanConnectionSchema, printerDisplaySchema, printerDriverSchema, printerSchema } from '../printerFormSchema';
import type { Printer, PrinterDriver } from '../../types/printer.types';

const escposDriver: PrinterDriver = { type: 'escpos', source: 'auto', contentTypes: ['Receipt'], config: { type: 'escpos' } };
const tsplDriver: PrinterDriver = { type: 'tspl', source: 'auto', contentTypes: ['Label'], config: { type: 'tspl', renderMode: 'bitmap' } };

const basePrinter: Printer = {
  id: 'p1',
  name: 'Máy in',
  drivers: [escposDriver],
  connectionType: 'lan',
  lan: { ip: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  paperSize: 80,
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('lanConnectionSchema', () => {
  it('accepts a valid IPv4 + port', () => {
    expect(lanConnectionSchema.safeParse({ lanIp: '192.168.1.10', lanPort: '9100' }).success).toBe(true);
  });

  it('rejects an invalid IPv4', () => {
    expect(lanConnectionSchema.safeParse({ lanIp: '999.1.1.1', lanPort: '9100' }).success).toBe(false);
  });
});

describe('printerDisplaySchema', () => {
  it('accepts a numeric paperSize of 58 or 80', () => {
    expect(printerDisplaySchema.safeParse({ name: 'Máy in', paperSize: 58 }).success).toBe(true);
    expect(printerDisplaySchema.safeParse({ name: 'Máy in', paperSize: 80 }).success).toBe(true);
  });

  it('rejects a string paperSize like the old "80mm"', () => {
    expect(printerDisplaySchema.safeParse({ name: 'Máy in', paperSize: '80mm' }).success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(printerDisplaySchema.safeParse({ name: '', paperSize: 80 }).success).toBe(false);
  });
});

describe('printerDriverSchema', () => {
  it('accepts an escpos driver with only Receipt', () => {
    expect(printerDriverSchema.safeParse(escposDriver).success).toBe(true);
  });

  it('rejects an escpos driver assigned Label (outside its capability)', () => {
    const invalid: PrinterDriver = { ...escposDriver, contentTypes: ['Label'] };
    expect(printerDriverSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects a driver whose config.type does not match driver.type', () => {
    const mismatched = { ...escposDriver, config: { type: 'tspl', renderMode: 'bitmap' } };
    expect(printerDriverSchema.safeParse(mismatched).success).toBe(false);
  });
});

describe('printerSchema', () => {
  it('accepts a valid single-driver LAN printer', () => {
    expect(printerSchema.safeParse(basePrinter).success).toBe(true);
  });

  it('accepts a valid two-driver printer with disjoint content types', () => {
    const printer: Printer = { ...basePrinter, drivers: [escposDriver, tsplDriver] };
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('rejects two drivers that both claim Receipt (invariant #3)', () => {
    const overlapping: PrinterDriver = { ...tsplDriver, contentTypes: ['Receipt'] };
    const printer: Printer = { ...basePrinter, drivers: [escposDriver, overlapping] };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects two drivers of the same type on one printer', () => {
    const printer: Printer = { ...basePrinter, drivers: [escposDriver, { ...escposDriver, contentTypes: [] }] };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects zero drivers (invariant #10)', () => {
    const printer: Printer = { ...basePrinter, drivers: [] };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects three drivers (max 2, invariant #2)', () => {
    const printer: Printer = { ...basePrinter, drivers: [escposDriver, tsplDriver, { ...escposDriver, contentTypes: [] }] };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects connectionType lan with a device set (invariant #13)', () => {
    const printer: Printer = { ...basePrinter, device: { deviceId: 'x', displayName: 'x', rawDevice: {} } };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects connectionType lan with no lan config (invariant #13)', () => {
    const printer: Printer = { ...basePrinter, lan: undefined };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });

  it('rejects connectionType usb with a lan config set (invariant #13)', () => {
    const printer: Printer = {
      ...basePrinter,
      connectionType: 'usb',
      device: { deviceId: '1155:22222', displayName: 'x', rawDevice: {} },
    };
    expect(printerSchema.safeParse(printer).success).toBe(true);
    const invalid: Printer = { ...printer, lan: { ip: '1.1.1.1', port: 9100 } };
    expect(printerSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects connectionType usb with no device set (invariant #13)', () => {
    const printer: Printer = { ...basePrinter, connectionType: 'usb', lan: undefined };
    expect(printerSchema.safeParse(printer).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- printerFormSchema.test.ts`
Expected: FAIL — `printerDriverSchema`/`printerSchema` not exported, `printerDisplaySchema` rejects numeric paperSize.

- [ ] **Step 3: Implement**

```ts
// src/features/printer/schemas/printerFormSchema.ts
import { z } from 'zod';
import { getDriverDefinition } from '../definitions/PrinterDriverDefinitions';

const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const isValidIpv4 = (value: string): boolean => {
  if (!ipv4Regex.test(value)) return false;
  return value.split('.').every((segment) => Number(segment) >= 0 && Number(segment) <= 255);
};

const isValidPort = (value: string): boolean => {
  const port = Number(value);
  return value.length > 0 && !Number.isNaN(port) && port >= 1 && port <= 65535;
};

export const lanConnectionSchema = z.object({
  lanIp: z.string().refine(isValidIpv4, 'Địa chỉ IP không hợp lệ'),
  lanPort: z.string().refine(isValidPort, 'Cổng không hợp lệ (1-65535)'),
});

export type LanConnectionValues = z.infer<typeof lanConnectionSchema>;

const paperSizeSchema = z.union([z.literal(58), z.literal(80)]);

export const printerDisplaySchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên máy in'),
  paperSize: paperSizeSchema,
});

export type PrinterDisplayValues = z.infer<typeof printerDisplaySchema>;

const printContentTypeSchema = z.enum(['Receipt', 'Label']);

const tsplDriverConfigSchema = z.object({
  type: z.literal('tspl'),
  renderMode: z.literal('bitmap'),
  labelHeightMm: z.number().positive().optional(),
});

const escPosDriverConfigSchema = z.object({
  type: z.literal('escpos'),
});

const printerDriverConfigSchema = z.discriminatedUnion('type', [tsplDriverConfigSchema, escPosDriverConfigSchema]);

/**
 * Validate 1 `PrinterDriver`: `config.type` phải khớp `type`, và `contentTypes`
 * phải là tập con capability của `PrinterDriverDefinitions[type]` (invariant
 * doc — không phải chỉ disable checkbox ở UI, spec §8).
 */
export const printerDriverSchema = z
  .object({
    type: z.enum(['escpos', 'tspl']),
    source: z.enum(['auto', 'manual']),
    contentTypes: z.array(printContentTypeSchema).min(1),
    config: printerDriverConfigSchema,
  })
  .superRefine((driver, ctx) => {
    if (driver.config.type !== driver.type) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'config.type phải khớp với driver.type' });
    }
    const allowed = getDriverDefinition(driver.type).contentTypes;
    const invalid = driver.contentTypes.filter((ct) => !allowed.includes(ct));
    if (invalid.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Driver ${driver.type} không hỗ trợ content type: ${invalid.join(', ')}`,
      });
    }
  });

const printerDeviceSchema = z.object({
  deviceId: z.string(),
  displayName: z.string(),
  rawDevice: z.record(z.unknown()),
});

const printerLanConfigSchema = z.object({
  ip: z.string(),
  port: z.number(),
});

/**
 * Validate toàn bộ `Printer` trước khi persist — safety net ở service layer
 * (invariant #2, #3, #10, #13, spec §8), KHÔNG thay thế validation UI (UI đã
 * tự ngăn phần lớn state không hợp lệ trước khi tới đây).
 */
export const printerSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    vendor: z.string().optional(),
    model: z.string().optional(),
    drivers: z.array(printerDriverSchema).min(1).max(2),
    connectionType: z.enum(['usb', 'bluetooth', 'lan']),
    device: printerDeviceSchema.optional(),
    lan: printerLanConfigSchema.optional(),
    identityKey: z.string().min(1),
    paperSize: paperSizeSchema,
    autoReconnect: z.boolean(),
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((printer, ctx) => {
    if (printer.connectionType === 'lan') {
      if (!printer.lan) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'connectionType lan bắt buộc phải có lan' });
      if (printer.device) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'connectionType lan không được có device' });
    } else {
      if (!printer.device) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `connectionType ${printer.connectionType} bắt buộc phải có device` });
      }
      if (printer.lan) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `connectionType ${printer.connectionType} không được có lan` });
      }
    }

    const seenContentTypes = new Set<string>();
    for (const driver of printer.drivers) {
      for (const contentType of driver.contentTypes) {
        if (seenContentTypes.has(contentType)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Content type "${contentType}" bị gán cho nhiều hơn 1 driver trong cùng printer`,
          });
        }
        seenContentTypes.add(contentType);
      }
    }

    const driverTypes = printer.drivers.map((d) => d.type);
    if (new Set(driverTypes).size !== driverTypes.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Printer không được có 2 driver cùng type' });
    }
  });

export type PrinterValidated = z.infer<typeof printerSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- printerFormSchema.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/schemas/printerFormSchema.ts src/features/printer/schemas/__tests__/printerFormSchema.test.ts
git commit -m "feat(printer): validate Printer invariants (disjoint content types, driver count, connectionType shape) via Zod"
```

---

## Phase B — Adapters

### Task 8: `adapters/UsbPrinterNativeAdapter.ts` — move `UsbPrinterNative.ts`

**Files:**
- Create: `src/features/printer/adapters/UsbPrinterNativeAdapter.ts` (move content from `services/UsbPrinterNative.ts` unchanged)
- Delete: `src/features/printer/services/UsbPrinterNative.ts`
- Create: `src/features/printer/adapters/__tests__/UsbPrinterNativeAdapter.test.ts` (move from `services/__tests__/UsbPrinterNative.test.ts`, import path only)
- Delete: `src/features/printer/services/__tests__/UsbPrinterNative.test.ts`
- Modify: `src/features/printer/transports/UsbTransport.ts` (import path only)

This is a pure relocation — no behavior change, so no red/green cycle is needed; just move, fix imports, and verify tests still pass.

- [ ] **Step 1: Move the implementation file**

Copy the exact content of `src/features/printer/services/UsbPrinterNative.ts` into a new file `src/features/printer/adapters/UsbPrinterNativeAdapter.ts` (same exports: `ensureUsbInitialized`, `printRawDataUsb`). Delete the old file at `src/features/printer/services/UsbPrinterNative.ts`.

- [ ] **Step 2: Move the test file**

Copy the exact content of `src/features/printer/services/__tests__/UsbPrinterNative.test.ts` into `src/features/printer/adapters/__tests__/UsbPrinterNativeAdapter.test.ts`. Change only the import line from `import { ensureUsbInitialized, printRawDataUsb } from '../UsbPrinterNative';` to `import { ensureUsbInitialized, printRawDataUsb } from '../UsbPrinterNativeAdapter';`. Delete the old test file.

- [ ] **Step 3: Fix the importer**

In `src/features/printer/transports/UsbTransport.ts`, change:

```ts
import { ensureUsbInitialized, printRawDataUsb } from '../services/UsbPrinterNative';
```

to:

```ts
import { ensureUsbInitialized, printRawDataUsb } from '../adapters/UsbPrinterNativeAdapter';
```

- [ ] **Step 4: Run the moved test**

Run: `npm test -- UsbPrinterNativeAdapter.test.ts`
Expected: PASS (2 tests, same as before the move)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/adapters/UsbPrinterNativeAdapter.ts src/features/printer/adapters/__tests__/UsbPrinterNativeAdapter.test.ts src/features/printer/transports/UsbTransport.ts
git rm src/features/printer/services/UsbPrinterNative.ts src/features/printer/services/__tests__/UsbPrinterNative.test.ts
git commit -m "refactor(printer): move UsbPrinterNative into adapters/"
```

---

### Task 9: `adapters/ThermalPrinterLibraryAdapter.ts` — ESC/POS vendor library boundary

**Files:**
- Create: `src/features/printer/adapters/ThermalPrinterLibraryAdapter.ts`
- Test: `src/features/printer/adapters/__tests__/ThermalPrinterLibraryAdapter.test.ts`

**Interfaces:**
- Consumes: `ConnectionType` (Task 1).
- Produces: `ThermalPrinterLibraryAdapter.namespaceFor(connectionType)`, `ThermalPrinterLibraryAdapter.printTextAsync(connectionType, text, options)` — used by `drivers/escpos/EscPosDriver.ts` (Task 13) instead of importing `@poriyaalar/react-native-thermal-receipt-printer` directly.

This is the ESC/POS pragmatic-path boundary (spec §2.3): it only re-exports the vendor library's namespaces and normalizes `printText()`'s callback API into a Promise — no business logic.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/printer/adapters/__tests__/ThermalPrinterLibraryAdapter.test.ts
jest.mock('@poriyaalar/react-native-thermal-receipt-printer', () => ({
  USBPrinter: { printText: jest.fn((_t: string, _o: unknown, cb?: () => void) => cb?.()) },
  BLEPrinter: { printText: jest.fn((_t: string, _o: unknown, cb?: () => void) => cb?.()) },
  NetPrinter: { printText: jest.fn((_t: string, _o: unknown, cb?: () => void) => cb?.()) },
}));

import { ThermalPrinterLibraryAdapter } from '../ThermalPrinterLibraryAdapter';

describe('ThermalPrinterLibraryAdapter', () => {
  afterEach(() => jest.clearAllMocks());

  it('namespaceFor returns the namespace matching each connectionType', () => {
    const { USBPrinter, BLEPrinter, NetPrinter } = jest.requireMock(
      '@poriyaalar/react-native-thermal-receipt-printer',
    ) as Record<string, unknown>;
    expect(ThermalPrinterLibraryAdapter.namespaceFor('usb')).toBe(USBPrinter);
    expect(ThermalPrinterLibraryAdapter.namespaceFor('bluetooth')).toBe(BLEPrinter);
    expect(ThermalPrinterLibraryAdapter.namespaceFor('lan')).toBe(NetPrinter);
  });

  it('printTextAsync resolves when the library calls the success callback', async () => {
    await expect(
      ThermalPrinterLibraryAdapter.printTextAsync('lan', 'hello', {
        keepConnection: true,
        cut: true,
        tailingLine: true,
        encoding: 'UTF8',
      }),
    ).resolves.toBeUndefined();
  });

  it('printTextAsync rejects when the library calls the error callback', async () => {
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as {
      NetPrinter: { printText: jest.Mock };
    };
    NetPrinter.printText.mockImplementationOnce(
      (_t: string, _o: unknown, _cb?: () => void, cbErr?: (e: Error) => void) => cbErr?.(new Error('boom')),
    );
    await expect(
      ThermalPrinterLibraryAdapter.printTextAsync('lan', 'hello', {
        keepConnection: true,
        cut: true,
        tailingLine: true,
        encoding: 'UTF8',
      }),
    ).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- ThermalPrinterLibraryAdapter.test.ts`
Expected: FAIL with "Cannot find module '../ThermalPrinterLibraryAdapter'"

- [ ] **Step 3: Implement**

```ts
// src/features/printer/adapters/ThermalPrinterLibraryAdapter.ts
import { USBPrinter, BLEPrinter, NetPrinter } from '@poriyaalar/react-native-thermal-receipt-printer';
import type { ConnectionType } from '../types/printer.types';

export interface ThermalPrinterPrintTextOptions {
  keepConnection: boolean;
  cut: boolean;
  tailingLine: boolean;
  encoding: 'UTF8';
}

/**
 * Boundary duy nhất giữa `EscPosDriver` và thư viện vendor
 * `@poriyaalar/react-native-thermal-receipt-printer` (spec §2.3 — ngoại lệ
 * pragmatic: thư viện gộp connect+encode+write theo namespace riêng cho
 * từng connectionType; `EscPosDriver` vẫn tự chọn namespace nội bộ). Adapter
 * này chỉ re-export namespace + chuẩn hoá `printText()` (callback-based)
 * thành Promise — không chứa business logic về máy in.
 */
export const ThermalPrinterLibraryAdapter = {
  namespaceFor: (connectionType: ConnectionType) =>
    ({ usb: USBPrinter, bluetooth: BLEPrinter, lan: NetPrinter })[connectionType],

  printTextAsync(connectionType: ConnectionType, text: string, options: ThermalPrinterPrintTextOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      ThermalPrinterLibraryAdapter.namespaceFor(connectionType).printText(
        text,
        options,
        () => resolve(),
        (error: Error) => reject(error),
      );
    });
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ThermalPrinterLibraryAdapter.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/adapters/ThermalPrinterLibraryAdapter.ts src/features/printer/adapters/__tests__/ThermalPrinterLibraryAdapter.test.ts
git commit -m "feat(printer): add ThermalPrinterLibraryAdapter (ESC/POS vendor boundary)"
```

---

### Task 10: `adapters/MockPrinterAdapter.ts` — shared test doubles

**Files:**
- Create: `src/features/printer/adapters/MockPrinterAdapter.ts`
- Test: `src/features/printer/adapters/__tests__/MockPrinterAdapter.test.ts`

This file is test-only infrastructure (uses the `jest` global) — it is never imported from production code, only from future/other test files that want a ready-made adapter double instead of hand-rolling `jest.fn()` boilerplate.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/printer/adapters/__tests__/MockPrinterAdapter.test.ts
import { createMockUsbPrinterNativeAdapter, createMockThermalPrinterLibraryAdapter } from '../MockPrinterAdapter';

describe('MockPrinterAdapter', () => {
  it('createMockUsbPrinterNativeAdapter resolves ensureUsbInitialized and printRawDataUsb', async () => {
    const mock = createMockUsbPrinterNativeAdapter();
    await expect(mock.ensureUsbInitialized()).resolves.toBeUndefined();
    await expect(mock.printRawDataUsb('AAAA', true)).resolves.toBeUndefined();
  });

  it('createMockThermalPrinterLibraryAdapter returns a namespace stub with init/getDeviceList/connectPrinter/closeConn', async () => {
    const mock = createMockThermalPrinterLibraryAdapter();
    const namespace = mock.namespaceFor('lan');
    await expect(namespace.init()).resolves.toBeUndefined();
    await expect(namespace.getDeviceList()).resolves.toEqual([]);
    await expect(namespace.connectPrinter()).resolves.toEqual({ device_name: 'Mock' });
    await expect(namespace.closeConn()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- MockPrinterAdapter.test.ts`
Expected: FAIL with "Cannot find module '../MockPrinterAdapter'"

- [ ] **Step 3: Implement**

```ts
// src/features/printer/adapters/MockPrinterAdapter.ts
/**
 * Test double dùng chung cho adapters/ trong unit test — thay vì mỗi file
 * test tự viết lại `jest.fn()` boilerplate cho từng adapter. KHÔNG dùng cho
 * production code (chỉ import được từ file test, phụ thuộc global `jest`).
 */
export const createMockUsbPrinterNativeAdapter = () => ({
  ensureUsbInitialized: jest.fn().mockResolvedValue(undefined),
  printRawDataUsb: jest.fn().mockResolvedValue(undefined),
});

export const createMockThermalPrinterLibraryAdapter = () => ({
  namespaceFor: jest.fn().mockReturnValue({
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'Mock' }),
    closeConn: jest.fn().mockResolvedValue(undefined),
  }),
  printTextAsync: jest.fn().mockResolvedValue(undefined),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- MockPrinterAdapter.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/adapters/MockPrinterAdapter.ts src/features/printer/adapters/__tests__/MockPrinterAdapter.test.ts
git commit -m "feat(printer): add MockPrinterAdapter test doubles"
```

---

## Phase C — Drivers

### Task 11: `drivers/tspl/TsplEncoder.ts` — move + numeric `paperSize`

**Files:**
- Create: `src/features/printer/drivers/tspl/TsplEncoder.ts` (move from `protocols/TsplEncoder.ts`)
- Delete: `src/features/printer/protocols/TsplEncoder.ts`
- Create: `src/features/printer/drivers/tspl/__tests__/TsplEncoder.test.ts` (move from `protocols/__tests__/TsplEncoder.test.ts`)
- Delete: `src/features/printer/protocols/__tests__/TsplEncoder.test.ts`

- [ ] **Step 1: Move the file, updating only the `initialize()` paperSize comparison**

Copy `src/features/printer/protocols/TsplEncoder.ts` to `src/features/printer/drivers/tspl/TsplEncoder.ts`. Change the single line inside `initialize()`:

```ts
// before
const widthMm = paperSize === '58mm' ? 50 : 72;
// after
const widthMm = paperSize === 58 ? 50 : 72;
```

Everything else in the file (the `PaperSize` import from `'../types/printer.types'` still resolves — path unchanged since both old and new locations are 2 levels under `src/features/printer/`, but note the new path is `drivers/tspl/TsplEncoder.ts` so the relative import becomes `'../../types/printer.types'` and `'../types/printConfiguration.types'` becomes `'../../types/printConfiguration.types'` and `'../utils/monochromeBitmap'` becomes `'../../utils/monochromeBitmap'` — update all three relative imports for the new depth) stays identical: `encodeUtf8`, `DEFAULT_LABEL_HEIGHT_MM`, `CONTINUOUS_HEIGHT_MM`, `DOTS_PER_MM`, `text()`, `barcode()`, `qrcode()`, `image()`, `cut()`, `encode()`.

- [ ] **Step 2: Move the test file**

Copy `src/features/printer/protocols/__tests__/TsplEncoder.test.ts` to `src/features/printer/drivers/tspl/__tests__/TsplEncoder.test.ts`. Update the import of the module under test from `'../TsplEncoder'` (still `'../TsplEncoder'` — same relative depth, unchanged) and fix any relative imports of `types/printer.types` the same way as Step 1 (one extra `../`). Update every `'58mm'`/`'80mm'` fixture value to `58`/`80`.

- [ ] **Step 3: Run the moved test**

Run: `npm test -- TsplEncoder.test.ts`
Expected: PASS (same test count as before the move)

- [ ] **Step 4: Commit**

```bash
git add src/features/printer/drivers/tspl/TsplEncoder.ts src/features/printer/drivers/tspl/__tests__/TsplEncoder.test.ts
git rm src/features/printer/protocols/TsplEncoder.ts src/features/printer/protocols/__tests__/TsplEncoder.test.ts
git commit -m "refactor(printer): move TsplEncoder into drivers/tspl/, numeric paperSize"
```

---

### Task 12: `drivers/tspl/TsplDriver.ts` — new model + `encode()`

**Files:**
- Create: `src/features/printer/drivers/tspl/TsplDriver.ts` (rewrite of `drivers/TsplDriver.ts`)
- Delete: `src/features/printer/drivers/TsplDriver.ts`
- Create: `src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts` (rewrite)
- Delete: `src/features/printer/drivers/__tests__/TsplDriver.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver`, `PrintDocumentVariants` (Task 2); `Printer`, `PrinterDriver`, `TsplDriverConfig` (Task 1); `LanTransport`/`BluetoothTransport`/`UsbTransport` (unchanged); `TsplEncoder`, `DEFAULT_LABEL_HEIGHT_MM`, `CONTINUOUS_HEIGHT_MM`, `DOTS_PER_MM` (Task 11).
- Produces: `TsplDriver` class implementing `IPrinterDriver` — registered in `printing/DriverRegistry.ts` (Task 15).

The connect/disconnect/scan/identify logic is unchanged from the current `drivers/TsplDriver.ts` — only the parameter shape changes (`Printer` + `PrinterDriver` instead of one flat `PrinterConfig`), plus the new `encode()` method and `documents: PrintDocumentVariants` replacing the old single `document: PrintDocument` parameter on `print()`/`testPrint()`.

- [ ] **Step 1: Write the failing tests (representative subset — full parity test below)**

```ts
// src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts
import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { TsplDriver } from '../TsplDriver';
import type { Printer, PrinterDriver } from '../../../types/printer.types';
import type { PrintDocumentVariants } from '../../../types/driver.types';

const tinyPngBase64 = (): string => {
  const rgba = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]);
  return Buffer.from(new Uint8Array(UPNG.encode([rgba.buffer], 2, 1, 0, [], true))).toString('base64');
};

jest.mock('../../../transports/LanTransport', () => ({
  LanTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn(),
    readOnce: jest.fn().mockResolvedValue(null),
    close: jest.fn(),
  })),
}));
jest.mock('../../../transports/BluetoothTransport', () => ({
  BluetoothTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
    readOnce: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('../../../transports/UsbTransport', () => ({
  UsbTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('../../../services/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../../services/PrinterLogger', () => ({
  PrinterLogger: {
    scanCompleted: jest.fn(),
    scanFailed: jest.fn(),
    connectSucceeded: jest.fn(),
    connectFailed: jest.fn(),
    disconnectSucceeded: jest.fn(),
    disconnectFailed: jest.fn(),
    testPrintSucceeded: jest.fn(),
    testPrintFailed: jest.fn(),
  },
}));

const tsplDriverEntry: PrinterDriver = {
  type: 'tspl',
  source: 'auto',
  contentTypes: ['Label'],
  config: { type: 'tspl', renderMode: 'bitmap' },
};

const lanPrinter: Printer = {
  id: 'label-1',
  name: 'Máy in tem',
  drivers: [tsplDriverEntry],
  connectionType: 'lan',
  lan: { ip: '192.168.1.60', port: 9100 },
  identityKey: 'lan:192.168.1.60:9100',
  paperSize: 58,
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const usbPrinter: Printer = {
  ...lanPrinter,
  id: 'label-usb',
  connectionType: 'usb',
  lan: undefined,
  device: { deviceId: '1155:22222', displayName: 'Máy in tem USB', rawDevice: { vendor_id: 1155, product_id: 22222 } },
};

const sampleDocuments: PrintDocumentVariants = { text: { elements: [{ type: 'text', content: 'In thử', x: 0, y: 0 }] } };

describe('TsplDriver', () => {
  it('connect() over LAN transitions status idle -> connecting -> connected', async () => {
    const driver = new TsplDriver();
    const statuses: string[] = [];
    driver.onStatusChange(lanPrinter.id, (status) => statuses.push(status));
    expect(driver.getStatus(lanPrinter.id)).toBe('idle');
    await driver.connect(lanPrinter, tsplDriverEntry);
    expect(statuses).toEqual(['connecting', 'connected']);
    expect(driver.getStatus(lanPrinter.id)).toBe('connected');
  });

  it('connect() over USB reads vendor_id/product_id from the scanned rawDevice as numbers', async () => {
    const driver = new TsplDriver();
    await driver.connect(usbPrinter, tsplDriverEntry);
    const { UsbTransport } = jest.requireMock('../../../transports/UsbTransport') as { UsbTransport: jest.Mock };
    const instance = UsbTransport.mock.results[UsbTransport.mock.results.length - 1].value as { connect: jest.Mock };
    expect(instance.connect).toHaveBeenCalledWith(1155, 22222);
  });

  it('encode() is a pure function — calling it twice with the same input yields identical bytes, without needing a live connection', () => {
    const driver = new TsplDriver();
    const bytesA = driver.encode(lanPrinter, tsplDriverEntry, sampleDocuments);
    const bytesB = driver.encode(lanPrinter, tsplDriverEntry, sampleDocuments);
    expect(Array.from(bytesA)).toEqual(Array.from(bytesB));
  });

  it('encode() prefers documents.image over documents.text (renderMode is always bitmap)', () => {
    const driver = new TsplDriver();
    const withImage: PrintDocumentVariants = { text: sampleDocuments.text, image: { elements: [{ type: 'image', data: tinyPngBase64(), x: 0, y: 0 }] } };
    const bytes = driver.encode(lanPrinter, tsplDriverEntry, withImage);
    const ascii = Array.from(bytes.slice(0, 200)).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('BITMAP');
  });

  it('encode() falls back to documents.text when no image variant is provided', () => {
    const driver = new TsplDriver();
    const bytes = driver.encode(lanPrinter, tsplDriverEntry, sampleDocuments);
    const ascii = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('In thử');
  });

  it('print() writes the same bytes that encode() produces', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const { LanTransport } = jest.requireMock('../../../transports/LanTransport') as { LanTransport: jest.Mock };
    const instance = LanTransport.mock.results[LanTransport.mock.results.length - 1].value as { write: jest.Mock };
    const expectedBytes = driver.encode(lanPrinter, tsplDriverEntry, sampleDocuments);
    await driver.print(lanPrinter.id, sampleDocuments);
    expect(Array.from(instance.write.mock.calls[0][0] as Uint8Array)).toEqual(Array.from(expectedBytes));
  });

  it('scan() on lan immediately reports empty (no scan for LAN)', () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    driver.scan('lan', (event) => events.push(event.type));
    expect(events).toEqual(['empty']);
  });

  it('identify() returns null when not connected', async () => {
    const driver = new TsplDriver();
    expect(await driver.identify('never-connected')).toBeNull();
  });
});
```

Port the remaining pre-existing `TsplDriver.test.ts` cases (disconnect error handling, Bluetooth permission checks, per-element encoding of `line`/`table`/`row`/`barcode`/`qrCode`, the `ENCODING_FAILED` height-overflow case, all the `PrinterLogger` call assertions) mechanically:
- `PrinterConfig` fixture → split into a `Printer` + a `PrinterDriver` (`tsplDriverEntry`) as shown above.
- `driver.connect(config)` → `driver.connect(printer, tsplDriverEntry)`.
- `driver.testPrint(config, document, printType)` → `driver.testPrint(printer, tsplDriverEntry, { text: document }, printType)`.
- `driver.print(id, document, printType)` → `driver.print(id, { text: document }, printType)`.
- `config.protocol` in `PrinterLogger` assertions → the literal string `'tspl'` (unchanged value, the type name changed but the runtime string didn't).
Run `npm test -- TsplDriver.test.ts` after porting and confirm the same total test count as the original file (25 tests) passes.

- [ ] **Step 2: Run to confirm failures**

Run: `npm test -- TsplDriver.test.ts`
Expected: FAIL — module not found / `driver.connect` signature mismatch

- [ ] **Step 3: Implement**

```ts
// src/features/printer/drivers/tspl/TsplDriver.ts
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, PrintDocumentVariants, Unsubscribe } from '../../types/driver.types';
import type { ConnectionType, DeviceScanEvent, Printer, PrinterDeviceInfo, PrinterDriver, PrinterStatus } from '../../types/printer.types';
import type { PrintDocument } from '../../types/printDocument.types';
import type { PrintType } from '../../types/printConfiguration.types';
import { TsplEncoder, DEFAULT_LABEL_HEIGHT_MM, CONTINUOUS_HEIGHT_MM, DOTS_PER_MM } from './TsplEncoder';
import { LanTransport } from '../../transports/LanTransport';
import { BluetoothTransport } from '../../transports/BluetoothTransport';
import { UsbTransport } from '../../transports/UsbTransport';
import { AppErrorException, type AppErrorCode } from '../../types/AppError';
import { ensureBluetoothPermission } from '../../services/PrinterPermissionService';
import { PrinterLogger } from '../../services/PrinterLogger';
import { PAPER_WIDTH_CHARS, PAPER_IMAGE_WIDTH_PX, formatRow } from '../../utils/paperWidth';
import { decodePngBase64ToMonochrome } from '../../utils/pngToMonochrome';

type TsplTransport = LanTransport | BluetoothTransport | UsbTransport;

const IDENTIFY_TIMEOUT_MS = 1000;

interface UsbRawDevice {
  vendor_id: number;
  product_id: number;
}

const errorCodeOf = (error: unknown): AppErrorCode => (error instanceof AppErrorException ? error.code : 'UNKNOWN_ERROR');

const encodeAsciiCommand = (text: string): Uint8Array => {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    // eslint-disable-next-line no-bitwise -- intentional single-byte masking
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
};

/** `documents.image` chỉ có nếu nơi gọi (`useBillImageCapture`/AddPrinterModal test print) chủ động chụp — luôn ưu tiên vì `renderMode` luôn `'bitmap'`, fallback về text nếu không có image. */
const resolveDocument = (documents: PrintDocumentVariants): PrintDocument => documents.image ?? documents.text;

const resolveHeightMm = (driver: PrinterDriver, printType?: PrintType): number => {
  const labelHeightMm = driver.config.type === 'tspl' ? driver.config.labelHeightMm : undefined;
  return printType === 'Label' ? (labelHeightMm ?? DEFAULT_LABEL_HEIGHT_MM) : CONTINUOUS_HEIGHT_MM;
};

export class TsplDriver implements IPrinterDriver {
  private connections = new Map<string, TsplTransport>();
  private contexts = new Map<string, { printer: Printer; driver: PrinterDriver }>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  private createTransport(connectionType: ConnectionType): TsplTransport {
    if (connectionType === 'lan') return new LanTransport();
    if (connectionType === 'bluetooth') return new BluetoothTransport();
    return new UsbTransport();
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === 'lan') {
      onEvent({ type: 'empty' });
      return () => undefined;
    }
    if (connectionType === 'usb') {
      onEvent({ type: 'error', error: { code: 'UNSUPPORTED_CONNECTION', message: 'TsplDriver không tự quét USB' } });
      return () => undefined;
    }
    onEvent({ type: 'loading' });
    let cancelled = false;
    const startedAt = Date.now();
    ensureBluetoothPermission()
      .then((granted) => {
        if (cancelled) return;
        if (!granted) {
          onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' } });
          return;
        }
        RNBluetoothClassic.startDiscovery()
          .then((devices) => {
            if (cancelled) return;
            onEvent({
              type: devices.length > 0 ? 'found' : 'empty',
              devices: devices.map((d) => ({ deviceId: d.address, displayName: d.name ?? d.address, rawDevice: d as unknown as Record<string, unknown> })),
            });
            PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
            PrinterLogger.scanFailed({ connectionType, errorCode: 'CONNECTION_ERROR', durationMs: Date.now() - startedAt });
          });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
        PrinterLogger.scanFailed({ connectionType, errorCode: 'CONNECTION_ERROR', durationMs: Date.now() - startedAt });
      });
    return () => {
      cancelled = true;
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }

  async connect(printer: Printer, driver: PrinterDriver): Promise<void> {
    this.setStatus(printer.id, 'connecting');
    const startedAt = Date.now();
    try {
      const transport = this.createTransport(printer.connectionType);
      if (printer.connectionType === 'lan') {
        if (!printer.lan) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu cấu hình IP/Port' });
        await (transport as LanTransport).connect(printer.lan.ip, printer.lan.port);
      } else if (printer.connectionType === 'bluetooth') {
        if (!printer.device) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        const granted = await ensureBluetoothPermission();
        if (!granted) throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' });
        await (transport as BluetoothTransport).connect(printer.device.deviceId);
      } else {
        if (!printer.device) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị USB' });
        const raw = printer.device.rawDevice as unknown as UsbRawDevice | undefined;
        if (!raw) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu thông tin thiết bị USB' });
        await (transport as UsbTransport).connect(Number(raw.vendor_id), Number(raw.product_id));
      }
      this.connections.set(printer.id, transport);
      this.contexts.set(printer.id, { printer, driver });
      this.setStatus(printer.id, 'connected');
      PrinterLogger.connectSucceeded({ printerId: printer.id, protocol: 'tspl', connectionType: printer.connectionType, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, 'error');
      PrinterLogger.connectFailed({ printerId: printer.id, protocol: 'tspl', connectionType: printer.connectionType, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const transport = this.connections.get(printerId);
    try {
      await transport?.close();
    } catch (error) {
      this.setStatus(printerId, 'error');
      PrinterLogger.disconnectFailed({ printerId, protocol: 'tspl', errorCode: errorCodeOf(error) });
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: error instanceof Error ? error.message : String(error) });
    } finally {
      this.connections.delete(printerId);
    }
    this.setStatus(printerId, 'disconnected');
    PrinterLogger.disconnectSucceeded({ printerId, protocol: 'tspl' });
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  private encodeElements(encoder: TsplEncoder, document: PrintDocument, paperSize: Printer['paperSize'], heightMm: number): void {
    const paperWidth = PAPER_WIDTH_CHARS[paperSize];
    for (const element of document.elements) {
      if (element.type === 'text') {
        encoder.text(element.x, element.y, element.content);
      } else if (element.type === 'line') {
        encoder.text(element.x, element.y, '-'.repeat(paperWidth));
      } else if (element.type === 'table') {
        element.rows.forEach((row, i) => encoder.text(element.x, element.y + i * 20, row.join('  ')));
      } else if (element.type === 'row') {
        encoder.text(element.x, element.y, formatRow(element.left, element.right, paperWidth));
      } else if (element.type === 'image') {
        const bitmap = decodePngBase64ToMonochrome(element.data, PAPER_IMAGE_WIDTH_PX[paperSize]);
        const maxHeightPx = heightMm * DOTS_PER_MM;
        if (bitmap.heightPx > maxHeightPx) {
          throw new AppErrorException({
            code: 'ENCODING_FAILED',
            message: `Nội dung cao khoảng ${Math.ceil(bitmap.heightPx / DOTS_PER_MM)}mm, vượt khổ giấy đang khai báo (${heightMm}mm) — dùng giấy dài hơn hoặc rút gọn nội dung.`,
          });
        }
        encoder.image(element.x, element.y, bitmap);
      } else if (element.type === 'barcode') {
        encoder.barcode(element.x, element.y, element.content);
      } else if (element.type === 'qrCode') {
        encoder.qrcode(element.x, element.y, element.content);
      } else {
        throw new AppErrorException({ code: 'ENCODING_FAILED', message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
      }
    }
  }

  encode(printer: Printer, driver: PrinterDriver, documents: PrintDocumentVariants, printType?: PrintType): Uint8Array {
    const heightMm = resolveHeightMm(driver, printType);
    const encoder = new TsplEncoder().initialize(printer.paperSize, printType, heightMm);
    this.encodeElements(encoder, resolveDocument(documents), printer.paperSize, heightMm);
    return encoder.cut().encode();
  }

  private async writeBytes(printer: Printer, transport: TsplTransport | undefined, bytes: Uint8Array): Promise<void> {
    if (printer.connectionType === 'lan') {
      (transport as LanTransport).write(bytes);
    } else if (printer.connectionType === 'bluetooth') {
      await (transport as BluetoothTransport).write(bytes);
    } else {
      await (transport as UsbTransport).write(bytes);
    }
  }

  async testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocumentVariants, printType?: PrintType): Promise<void> {
    const startedAt = Date.now();
    try {
      if (!this.connections.has(printer.id)) {
        await this.connect(printer, driver);
      }
      const transport = this.connections.get(printer.id);
      const bytes = this.encode(printer, driver, documents, printType);
      await this.writeBytes(printer, transport, bytes);
      PrinterLogger.testPrintSucceeded({ printerId: printer.id, protocol: 'tspl', durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({ printerId: printer.id, protocol: 'tspl', errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async print(printerId: string, documents: PrintDocumentVariants, printType?: PrintType): Promise<void> {
    const context = this.contexts.get(printerId);
    const transport = this.connections.get(printerId);
    if (!context || !transport) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Máy in chưa kết nối' });
    }
    const bytes = this.encode(context.printer, context.driver, documents, printType);
    await this.writeBytes(context.printer, transport, bytes);
  }

  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const transport = this.connections.get(printerId);
    if (!transport || !('readOnce' in transport)) return null;
    try {
      const query = encodeAsciiCommand('~!T\r\n');
      await transport.write(query);
      const response = await transport.readOnce(IDENTIFY_TIMEOUT_MS);
      return response && response.length > 0 ? {} : null;
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- TsplDriver.test.ts`
Expected: PASS (all ported tests, same count as the original file)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/drivers/tspl/TsplDriver.ts src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts
git rm src/features/printer/drivers/TsplDriver.ts src/features/printer/drivers/__tests__/TsplDriver.test.ts
git commit -m "refactor(printer): rewrite TsplDriver for multi-driver Printer model + encode()"
```

---

### Task 13: `drivers/escpos/EscPosDriver.ts` — rename + route through adapter

**Files:**
- Create: `src/features/printer/drivers/escpos/EscPosDriver.ts` (rename+rewrite of `drivers/ThermalReceiptDriver.ts`)
- Delete: `src/features/printer/drivers/ThermalReceiptDriver.ts`
- Create: `src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts` (rewrite)
- Delete: `src/features/printer/drivers/__tests__/ThermalReceiptDriver.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver`, `PrintDocumentVariants` (Task 2); `Printer`, `PrinterDriver` (Task 1); `ThermalPrinterLibraryAdapter` (Task 9); `ensureUsbInitialized` (`adapters/UsbPrinterNativeAdapter.ts`, Task 8).
- Produces: `EscPosDriver` class implementing `IPrinterDriver` — registered in `printing/DriverRegistry.ts` (Task 15).

Per spec §2.3/§7.2, this driver keeps its pragmatic exception: production `print()`/`testPrint()` still call the vendor library's `printText()` directly (now via `ThermalPrinterLibraryAdapter`), never `encode()`+`transport.write()`. `encode()` exists purely so the text-building logic (`encodeDocument`, now renamed) is independently testable — it converts the resolved text into UTF-8 bytes via `Buffer`, matching the encoding the vendor library performs internally, but this conversion is NOT on the production path.

- [ ] **Step 1: Write the failing tests (representative subset)**

```ts
// src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts
import { EscPosDriver } from '../EscPosDriver';
import type { Printer, PrinterDriver } from '../../../types/printer.types';
import type { PrintDocumentVariants } from '../../../types/driver.types';

jest.mock('@poriyaalar/react-native-thermal-receipt-printer', () => ({
  USBPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'USB', vendor_id: '1155', product_id: '22222' }),
    printText: jest.fn((_t: string, _o: unknown, cb?: (msg: string) => void) => cb?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
  BLEPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'BLE', inner_mac_address: '00:11:22:33:44:55' }),
    printText: jest.fn((_t: string, _o: unknown, cb?: (msg: string) => void) => cb?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
  NetPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'Net', host: '192.168.1.50', port: 9100 }),
    printText: jest.fn((_t: string, _o: unknown, cb?: (msg: string) => void) => cb?.('ok')),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../../services/PrinterPermissionService', () => ({
  ensureBluetoothPermission: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../../services/PrinterLogger', () => ({
  PrinterLogger: {
    scanCompleted: jest.fn(), scanFailed: jest.fn(), connectSucceeded: jest.fn(), connectFailed: jest.fn(),
    disconnectSucceeded: jest.fn(), disconnectFailed: jest.fn(), testPrintSucceeded: jest.fn(), testPrintFailed: jest.fn(),
    printSucceeded: jest.fn(), printFailed: jest.fn(),
  },
}));

const escposDriverEntry: PrinterDriver = { type: 'escpos', source: 'auto', contentTypes: ['Receipt'], config: { type: 'escpos' } };

const lanPrinter: Printer = {
  id: 'receipt-lan',
  name: 'Máy in hoá đơn',
  drivers: [escposDriverEntry],
  connectionType: 'lan',
  lan: { ip: '192.168.1.50', port: 9100 },
  identityKey: 'lan:192.168.1.50:9100',
  paperSize: 80,
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const sampleDocuments: PrintDocumentVariants = { text: { elements: [{ type: 'text', content: 'In thử', x: 0, y: 0 }] } };

describe('EscPosDriver', () => {
  afterEach(() => jest.clearAllMocks());

  it('connect() over LAN transitions status idle -> connecting -> connected', async () => {
    const driver = new EscPosDriver();
    const statuses: string[] = [];
    driver.onStatusChange(lanPrinter.id, (status) => statuses.push(status));
    await driver.connect(lanPrinter, escposDriverEntry);
    expect(statuses).toEqual(['connecting', 'connected']);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as { NetPrinter: { connectPrinter: jest.Mock } };
    expect(NetPrinter.connectPrinter).toHaveBeenCalledWith('192.168.1.50', 9100);
  });

  it('encode() converts the resolved text document into UTF-8 bytes without touching any transport', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const bytes = driver.encode(lanPrinter, escposDriverEntry, sampleDocuments);
    expect(Buffer.from(bytes).toString('utf8')).toContain('In thử');
  });

  it('encode() ignores documents.image — ESC/POS always uses text (production never calls encode(), this is test-only per spec §7.2)', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const withImage: PrintDocumentVariants = { text: sampleDocuments.text, image: { elements: [{ type: 'text', content: 'should not be used', x: 0, y: 0 }] } };
    const bytes = driver.encode(lanPrinter, escposDriverEntry, withImage);
    expect(Buffer.from(bytes).toString('utf8')).toContain('In thử');
  });

  it('print() calls printText via the vendor library, never encode()+transport.write (pragmatic path)', async () => {
    const driver = new EscPosDriver();
    await driver.connect(lanPrinter, escposDriverEntry);
    const { NetPrinter } = jest.requireMock('@poriyaalar/react-native-thermal-receipt-printer') as { NetPrinter: { printText: jest.Mock } };
    await driver.print(lanPrinter.id, sampleDocuments);
    expect(NetPrinter.printText).toHaveBeenCalledWith(
      expect.stringContaining('In thử'),
      expect.objectContaining({ keepConnection: true, cut: true, tailingLine: true, encoding: 'UTF8' }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('identify() over USB always returns null', async () => {
    const driver = new EscPosDriver();
    const usbPrinter: Printer = { ...lanPrinter, id: 'receipt-usb', connectionType: 'usb', lan: undefined, device: { deviceId: '1155:22222', displayName: 'USB', rawDevice: { vendor_id: 1155, product_id: 22222 } } };
    await driver.connect(usbPrinter, escposDriverEntry);
    expect(await driver.identify(usbPrinter.id)).toBeNull();
  });
});
```

Port the remaining pre-existing `ThermalReceiptDriver.test.ts` cases (Bluetooth/USB connect, disconnect error handling + `activeByType` bookkeeping, scan behavior for lan/bluetooth including "No Device Found", `testPrint()` reconnect-if-stale-owner, `connect()`/`disconnect()`/`testPrint()`/`print()` `PrinterLogger` assertions, `print()` element encoding for `text`/`line`/`table`/`row`, `ENCODING_FAILED` for `barcode`/`qrCode`/`image`) mechanically — same rename recipe as Task 12 (`config` → `printer` + `escposDriverEntry`, `printerName`→`name`, `protocol: 'escpos'` string values unchanged). Run `npm test -- EscPosDriver.test.ts` after porting and confirm the same total test count as the original file (30 tests) passes.

- [ ] **Step 2: Run to confirm failures**

Run: `npm test -- EscPosDriver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/features/printer/drivers/escpos/EscPosDriver.ts
import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import { USBPrinter, BLEPrinter } from '@poriyaalar/react-native-thermal-receipt-printer';
import type { IPrinterDriver, PrintDocumentVariants, Unsubscribe } from '../../types/driver.types';
import type { ConnectionType, DeviceScanEvent, Printer, PrinterDeviceInfo, PrinterDriver, PrinterStatus } from '../../types/printer.types';
import { AppErrorException, type AppErrorCode } from '../../types/AppError';
import { ensureBluetoothPermission } from '../../services/PrinterPermissionService';
import { PrinterLogger } from '../../services/PrinterLogger';
import { ensureUsbInitialized } from '../../adapters/UsbPrinterNativeAdapter';
import { ThermalPrinterLibraryAdapter } from '../../adapters/ThermalPrinterLibraryAdapter';
import { PAPER_WIDTH_CHARS, formatRow } from '../../utils/paperWidth';

const errorCodeOf = (error: unknown): AppErrorCode => (error instanceof AppErrorException ? error.code : 'UNKNOWN_ERROR');

interface UsbRawDevice {
  vendor_id: number;
  product_id: number;
}

/**
 * Ngoại lệ pragmatic của ESC/POS (spec §2.3): thư viện vendor gộp
 * connect+encode+write theo namespace riêng cho từng connectionType, không
 * đi qua `Transport` chung với TSPL. Driver này vẫn tự chọn namespace theo
 * connectionType nội bộ — giữ nguyên hành vi đã verify trên phần cứng thật
 * (UTF-8 mode-switch, `keepConnection` NPE workaround...).
 */
export class EscPosDriver implements IPrinterDriver {
  private connectedTypes = new Map<string, ConnectionType>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private initialized = new Set<ConnectionType>();
  private deviceInfos = new Map<string, PrinterDeviceInfo>();
  private contexts = new Map<string, { printer: Printer; driver: PrinterDriver }>();
  private activeByType = new Map<ConnectionType, string>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  private async ensureInitialized(connectionType: ConnectionType): Promise<void> {
    if (this.initialized.has(connectionType)) return;
    if (connectionType === 'usb') {
      await ensureUsbInitialized();
    } else {
      await ThermalPrinterLibraryAdapter.namespaceFor(connectionType).init();
    }
    this.initialized.add(connectionType);
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === 'lan') {
      onEvent({ type: 'empty' });
      return () => undefined;
    }
    if (connectionType === 'usb' && Platform.OS !== 'android') {
      onEvent({ type: 'error', error: { code: 'UNSUPPORTED_CONNECTION', message: 'USB chỉ hỗ trợ trên Android' } });
      return () => undefined;
    }
    let cancelled = false;
    onEvent({ type: 'loading' });
    const startedAt = Date.now();
    const run = async (): Promise<void> => {
      try {
        if (connectionType === 'bluetooth') {
          const granted = await ensureBluetoothPermission();
          if (cancelled) return;
          if (!granted) {
            onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' } });
            return;
          }
        }
        await this.ensureInitialized(connectionType);
        if (cancelled) return;
        if (connectionType === 'bluetooth') {
          const devices = await BLEPrinter.getDeviceList();
          if (cancelled) return;
          onEvent({ type: devices.length > 0 ? 'found' : 'empty', devices: devices.map((d) => ({ deviceId: d.inner_mac_address, displayName: d.device_name, rawDevice: d as unknown as Record<string, unknown> })) });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
        } else {
          const devices = await USBPrinter.getDeviceList();
          if (cancelled) return;
          onEvent({ type: devices.length > 0 ? 'found' : 'empty', devices: devices.map((d) => ({ deviceId: `${d.vendor_id}:${d.product_id}`, displayName: d.device_name, rawDevice: d as unknown as Record<string, unknown> })) });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        if (/no device found/i.test(message)) {
          onEvent({ type: 'empty' });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: 0, durationMs: Date.now() - startedAt });
          return;
        }
        onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message } });
        PrinterLogger.scanFailed({ connectionType, errorCode: 'CONNECTION_ERROR', durationMs: Date.now() - startedAt });
      }
    };
    run();
    return () => { cancelled = true; };
  }

  async connect(printer: Printer, driver: PrinterDriver): Promise<void> {
    this.setStatus(printer.id, 'connecting');
    const startedAt = Date.now();
    try {
      if (printer.connectionType === 'bluetooth') {
        const granted = await ensureBluetoothPermission();
        if (!granted) throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' });
      }
      await this.ensureInitialized(printer.connectionType);

      let deviceName: string | undefined;
      if (printer.connectionType === 'lan') {
        if (!printer.lan) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu cấu hình IP/Port' });
        const result = await ThermalPrinterLibraryAdapter.namespaceFor('lan').connectPrinter(printer.lan.ip, printer.lan.port);
        deviceName = result?.device_name;
      } else if (printer.connectionType === 'bluetooth') {
        if (!printer.device) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        const result = await ThermalPrinterLibraryAdapter.namespaceFor('bluetooth').connectPrinter(printer.device.deviceId);
        deviceName = result?.device_name;
      } else {
        const raw = printer.device?.rawDevice as unknown as UsbRawDevice | undefined;
        if (!raw) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu thông tin thiết bị USB' });
        const result = await ThermalPrinterLibraryAdapter.namespaceFor('usb').connectPrinter(
          Number(raw.vendor_id) as unknown as string,
          Number(raw.product_id) as unknown as string,
        );
        deviceName = result?.device_name;
      }

      if (deviceName) this.deviceInfos.set(printer.id, { deviceName });
      this.connectedTypes.set(printer.id, printer.connectionType);
      this.contexts.set(printer.id, { printer, driver });

      const previousOwner = this.activeByType.get(printer.connectionType);
      if (previousOwner && previousOwner !== printer.id) {
        this.setStatus(previousOwner, 'disconnected');
      }
      this.activeByType.set(printer.connectionType, printer.id);
      this.setStatus(printer.id, 'connected');
      PrinterLogger.connectSucceeded({ printerId: printer.id, protocol: 'escpos', connectionType: printer.connectionType, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, 'error');
      PrinterLogger.connectFailed({ printerId: printer.id, protocol: 'escpos', connectionType: printer.connectionType, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const connectionType = this.connectedTypes.get(printerId);
    try {
      if (connectionType && this.activeByType.get(connectionType) === printerId) {
        await ThermalPrinterLibraryAdapter.namespaceFor(connectionType).closeConn();
      }
    } catch (error) {
      this.setStatus(printerId, 'error');
      PrinterLogger.disconnectFailed({ printerId, protocol: 'escpos', errorCode: errorCodeOf(error) });
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: error instanceof Error ? error.message : String(error) });
    } finally {
      if (connectionType && this.activeByType.get(connectionType) === printerId) this.activeByType.delete(connectionType);
      this.connectedTypes.delete(printerId);
      this.deviceInfos.delete(printerId);
      this.contexts.delete(printerId);
    }
    this.setStatus(printerId, 'disconnected');
    PrinterLogger.disconnectSucceeded({ printerId, protocol: 'escpos' });
  }

  /** Chỉ dùng cho test/snapshot (spec §7.2) — production `print()`/`testPrint()` KHÔNG gọi hàm này. */
  private encodeDocumentText(printer: Printer, documents: PrintDocumentVariants): string {
    const paperWidth = PAPER_WIDTH_CHARS[printer.paperSize];
    const lines: string[] = [];
    for (const element of documents.text.elements) {
      if (element.type === 'text') {
        lines.push(element.content);
      } else if (element.type === 'line') {
        lines.push('-'.repeat(paperWidth));
      } else if (element.type === 'table') {
        for (const row of element.rows) lines.push(row.join('  '));
      } else if (element.type === 'row') {
        lines.push(formatRow(element.left, element.right, paperWidth));
      } else {
        throw new AppErrorException({ code: 'ENCODING_FAILED', message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
      }
    }
    return `${lines.join('\n')}\n`;
  }

  encode(printer: Printer, _driver: PrinterDriver, documents: PrintDocumentVariants): Uint8Array {
    return new Uint8Array(Buffer.from(this.encodeDocumentText(printer, documents), 'utf8'));
  }

  private async printText(connectionType: ConnectionType, printer: Printer, documents: PrintDocumentVariants): Promise<void> {
    const text = this.encodeDocumentText(printer, documents);
    await ThermalPrinterLibraryAdapter.printTextAsync(connectionType, text, { keepConnection: true, cut: true, tailingLine: true, encoding: 'UTF8' });
  }

  async print(printerId: string, documents: PrintDocumentVariants): Promise<void> {
    const context = this.contexts.get(printerId);
    const connectionType = this.connectedTypes.get(printerId);
    if (!context || !connectionType || this.activeByType.get(connectionType) !== printerId) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Máy in chưa kết nối' });
    }
    const startedAt = Date.now();
    try {
      await this.printText(connectionType, context.printer, documents);
      PrinterLogger.printSucceeded({ printerId, protocol: 'escpos', durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.printFailed({ printerId, protocol: 'escpos', errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  async testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocumentVariants): Promise<void> {
    const startedAt = Date.now();
    try {
      const isStaleOwner = this.activeByType.get(printer.connectionType) !== printer.id;
      if (!this.connectedTypes.has(printer.id) || isStaleOwner) {
        await this.connect(printer, driver);
      }
      const connectionType = this.connectedTypes.get(printer.id);
      if (!connectionType) return;
      await this.printText(connectionType, printer, documents);
      PrinterLogger.testPrintSucceeded({ printerId: printer.id, protocol: 'escpos', durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({ printerId: printer.id, protocol: 'escpos', errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const connectionType = this.connectedTypes.get(printerId);
    if (!connectionType) return null;
    if (connectionType === 'usb') return null;
    return this.deviceInfos.get(printerId) ?? null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EscPosDriver.test.ts`
Expected: PASS (all ported tests, same count as the original `ThermalReceiptDriver.test.ts`)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/drivers/escpos/EscPosDriver.ts src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts
git rm src/features/printer/drivers/ThermalReceiptDriver.ts src/features/printer/drivers/__tests__/ThermalReceiptDriver.test.ts
git commit -m "refactor(printer): rename ThermalReceiptDriver to EscPosDriver, route through ThermalPrinterLibraryAdapter"
```

---

## Phase D — Discovery

### Task 14: `discovery/PrinterDiscoveryService.ts` — rename + `excludedDrivers`

**Files:**
- Create: `src/features/printer/discovery/PrinterDiscoveryService.ts` (rewrite of `services/discoverProtocol.ts`)
- Delete: `src/features/printer/services/discoverProtocol.ts`
- Create: `src/features/printer/discovery/__tests__/PrinterDiscoveryService.test.ts` (rewrite)
- Delete: `src/features/printer/services/__tests__/discoverProtocol.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver` (Task 2), `PrinterDriverType`, `ConnectionType`, `PrinterDevice`, `PrinterLanConfig`, `PrinterDeviceInfo` (Task 1).
- Produces: `createDiscoverDriver(registry)`, `DiscoveryEvent`, `DiscoveryInput` (now with `excludedDrivers`) — used by `printing/PrinterService.ts` (Task 17) and `components/AddPrinterModal.tsx` (Task 22).

Per spec §5.1, `AddPrinterModal` computes which driver types are already on the printer being edited and passes them in — this service only receives the constraint, it never inspects a `Printer` itself.

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/printer/discovery/__tests__/PrinterDiscoveryService.test.ts
import { createDiscoverDriver, type DiscoveryEvent } from '../PrinterDiscoveryService';
import type { IPrinterDriver } from '../../types/driver.types';
import type { PrinterDriverType } from '../../types/printer.types';
import { PrinterLogger } from '../../services/PrinterLogger';

jest.mock('../../services/PrinterLogger', () => ({
  PrinterLogger: {
    discoveryStarted: jest.fn(), discoveryCandidateRejected: jest.fn(), discoveryFailed: jest.fn(),
    protocolDetected: jest.fn(), protocolUnknown: jest.fn(),
  },
}));

const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue('connected'),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  print: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  encode: jest.fn().mockReturnValue(new Uint8Array()),
  ...overrides,
});

const collectEvents = (
  registry: Record<PrinterDriverType, IPrinterDriver>,
  input: Parameters<ReturnType<typeof createDiscoverDriver>>[0],
): Promise<DiscoveryEvent[]> =>
  new Promise((resolve) => {
    const events: DiscoveryEvent[] = [];
    createDiscoverDriver(registry)(input, (event) => {
      events.push(event);
      if (event.stage === 'identified' || event.stage === 'unknown_protocol' || event.stage === 'error') resolve(events);
    });
  });

describe('PrinterDiscoveryService', () => {
  const baseInput = { printerId: 'p1', connectionType: 'lan' as const, lan: { ip: '192.168.1.10', port: 9100 } };

  afterEach(() => jest.clearAllMocks());

  it('emits identified when the first candidate connects and identifies successfully', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver();
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(events.map((e) => e.stage)).toEqual(['connecting', 'identifying', 'identified']);
    expect(events[2].protocol).toBe('tspl');
  });

  it('excludedDrivers removes a driver type from the candidate list even if it would have identified', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, { ...baseInput, excludedDrivers: ['tspl'] });
    const identified = events.find((e) => e.stage === 'identified');
    expect(identified?.protocol).toBe('escpos');
    expect(tsplDriver.connect).not.toHaveBeenCalled();
  });

  it('emits error (not unknown_protocol) when excludedDrivers removes every candidate', async () => {
    const events = await collectEvents(
      { escpos: makeMockDriver(), tspl: makeMockDriver() },
      { ...baseInput, excludedDrivers: ['escpos', 'tspl'] },
    );
    expect(events[events.length - 1].stage).toBe('error');
  });

  it('falls through to the next candidate when the first identify() returns null', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({}) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(events.find((e) => e.stage === 'identified')?.protocol).toBe('escpos');
  });

  it('emits unknown_protocol when every remaining candidate connects but none identifies', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(events[events.length - 1].stage).toBe('unknown_protocol');
  });

  it('emits error when every remaining candidate fails to even connect', async () => {
    const escposDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('down')) });
    const tsplDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('down')) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(events[events.length - 1].stage).toBe('error');
  });
});
```

- [ ] **Step 2: Run to confirm failures**

Run: `npm test -- PrinterDiscoveryService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/features/printer/discovery/PrinterDiscoveryService.ts
import type { IPrinterDriver } from '../types/driver.types';
import type { ConnectionType, PrinterDevice, PrinterDeviceInfo, PrinterDriverType, PrinterLanConfig } from '../types/printer.types';
import type { AppError } from '../types/AppError';
import { PrinterLogger } from '../services/PrinterLogger';

/**
 * Thử `tspl` trước `escpos` — xem lý do ở lịch sử `discoverProtocol.ts`
 * (giữ nguyên): `TsplDriver.identify()` là 1 discriminator thật (gửi lệnh dò
 * `~!T`), trong khi ESC/POS's `identify()` chỉ chứng minh "đã connect thành
 * công". Qua USB cả 2 driver luôn trả `null` — cố ý, không phải thiếu rule.
 */
const CANDIDATE_ORDER: PrinterDriverType[] = ['tspl', 'escpos'];

export type DiscoveryStage = 'connecting' | 'identifying' | 'identified' | 'unknown_protocol' | 'error';

export interface DiscoveryEvent {
  stage: DiscoveryStage;
  protocol?: PrinterDriverType;
  deviceInfo?: PrinterDeviceInfo;
  error?: AppError;
}

export interface DiscoveryInput {
  printerId: string;
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
  /**
   * Driver type đã có trong printer đang thêm/sửa — do `AddPrinterModal` tự
   * tính (spec §5.1). Service này chỉ NHẬN constraint, không tự biết
   * business rule "driver này đã được add vào Printer".
   */
  excludedDrivers?: PrinterDriverType[];
}

const buildDraftPrinter = (input: DiscoveryInput) => ({
  id: input.printerId,
  connectionType: input.connectionType,
  device: input.device,
  lan: input.lan,
});

export type Unsubscribe = () => void;

export const createDiscoverDriver =
  (registry: Record<PrinterDriverType, IPrinterDriver>) =>
  (input: DiscoveryInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      const startedAt = Date.now();
      const excluded = new Set(input.excludedDrivers ?? []);
      const candidates = CANDIDATE_ORDER.filter((type) => Boolean(registry[type]) && !excluded.has(type));
      const candidatesTried: PrinterDriverType[] = [];
      let connectFailures = 0;

      PrinterLogger.discoveryStarted({ printerId: input.printerId, connectionType: input.connectionType, candidates });

      for (const type of candidates) {
        if (cancelled) return;
        candidatesTried.push(type);
        const driver = registry[type];
        const draftPrinter = buildDraftPrinter(input);
        const draftDriver = { type, source: 'auto' as const, contentTypes: [], config: type === 'tspl' ? { type: 'tspl' as const, renderMode: 'bitmap' as const } : { type: 'escpos' as const } };
        const disconnectQuietly = (): Promise<void> => driver.disconnect(input.printerId).catch(() => undefined);
        onEvent({ stage: 'connecting', protocol: type });
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- draft Printer/PrinterDriver during discovery, before a real one is persisted
          await driver.connect(draftPrinter as any, draftDriver);
        } catch {
          connectFailures += 1;
          PrinterLogger.discoveryCandidateRejected({ printerId: input.printerId, protocol: type, connectionType: input.connectionType, reason: 'connect_failed' });
          continue;
        }
        if (cancelled) {
          await disconnectQuietly();
          return;
        }
        onEvent({ stage: 'identifying', protocol: type });
        const deviceInfo = await driver.identify(input.printerId).catch(() => null);
        if (cancelled) {
          await disconnectQuietly();
          return;
        }
        if (deviceInfo) {
          onEvent({ stage: 'identified', protocol: type, deviceInfo });
          PrinterLogger.protocolDetected({ printerId: input.printerId, protocol: type, connectionType: input.connectionType, candidatesTried, durationMs: Date.now() - startedAt });
          return;
        }
        PrinterLogger.discoveryCandidateRejected({ printerId: input.printerId, protocol: type, connectionType: input.connectionType, reason: 'not_confirmed' });
        await disconnectQuietly();
      }

      if (cancelled) return;
      if (candidates.length === 0 || connectFailures === candidates.length) {
        onEvent({ stage: 'error', error: { code: 'CONNECTION_ERROR', message: 'Không thể kết nối tới máy in' } });
        PrinterLogger.discoveryFailed({ printerId: input.printerId, connectionType: input.connectionType, candidatesTried, durationMs: Date.now() - startedAt });
        return;
      }
      onEvent({ stage: 'unknown_protocol' });
      PrinterLogger.protocolUnknown({ printerId: input.printerId, connectionType: input.connectionType, candidatesTried, durationMs: Date.now() - startedAt });
    };

    run();

    return () => { cancelled = true; };
  };
```

Note: `candidates.length === 0` (every driver excluded) now emits `error`, not `unknown_protocol` — there is nothing left to try manually either, since both known driver types are already on the printer (test "emits error (not unknown_protocol) when excludedDrivers removes every candidate" above pins this).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PrinterDiscoveryService.test.ts`
Expected: PASS (6 tests) — port the remaining pre-existing `discoverProtocol.test.ts` cases (cancellation mid-connect/mid-identify, full logging assertions) with the same mechanical rename.

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/discovery/PrinterDiscoveryService.ts src/features/printer/discovery/__tests__/PrinterDiscoveryService.test.ts
git rm src/features/printer/services/discoverProtocol.ts src/features/printer/services/__tests__/discoverProtocol.test.ts
git commit -m "refactor(printer): rename discoverProtocol to PrinterDiscoveryService, add excludedDrivers"
```

---

## Phase E — Printing pipeline

### Task 15: `printing/DriverRegistry.ts` (+`.web.ts`) — move

**Files:**
- Create: `src/features/printer/printing/DriverRegistry.ts` (move from `services/DriverRegistry.ts`)
- Create: `src/features/printer/printing/DriverRegistry.web.ts` (move + update signatures)
- Delete: `src/features/printer/services/DriverRegistry.ts`, `src/features/printer/services/DriverRegistry.web.ts`
- Create: `src/features/printer/printing/__tests__/DriverRegistry.web.test.ts` (rewrite)
- Delete: `src/features/printer/services/__tests__/DriverRegistry.web.test.ts`

- [ ] **Step 1: Move `DriverRegistry.ts`**

```ts
// src/features/printer/printing/DriverRegistry.ts
import type { IPrinterDriver } from '../types/driver.types';
import type { PrinterDriverType } from '../types/printer.types';
import { EscPosDriver } from '../drivers/escpos/EscPosDriver';
import { TsplDriver } from '../drivers/tspl/TsplDriver';

export const DriverRegistry: Record<PrinterDriverType, IPrinterDriver> = {
  escpos: new EscPosDriver(),
  tspl: new TsplDriver(),
};
```

- [ ] **Step 2: Move `DriverRegistry.web.ts`, updating the stub's method signatures to match `IPrinterDriver`**

```ts
// src/features/printer/printing/DriverRegistry.web.ts
import type { IPrinterDriver, PrintDocumentVariants, Unsubscribe } from '../types/driver.types';
import type { PrinterDriverType, PrinterStatus } from '../types/printer.types';
import { AppErrorException } from '../types/AppError';

class WebUnsupportedDriver implements IPrinterDriver {
  scan(): Unsubscribe {
    return () => {};
  }

  async connect(): Promise<void> {
    throw new AppErrorException({ code: 'UNSUPPORTED_CONNECTION', message: 'Chức năng máy in không khả dụng trên trình duyệt web' });
  }

  async disconnect(): Promise<void> {
    // no-op — không có kết nối thật để ngắt trên web
  }

  getStatus(): PrinterStatus {
    return 'error';
  }

  onStatusChange(): Unsubscribe {
    return () => {};
  }

  async testPrint(): Promise<void> {
    throw new AppErrorException({ code: 'UNSUPPORTED_CONNECTION', message: 'Chức năng máy in không khả dụng trên trình duyệt web' });
  }

  async print(): Promise<void> {
    throw new AppErrorException({ code: 'UNSUPPORTED_CONNECTION', message: 'Chức năng máy in không khả dụng trên trình duyệt web' });
  }

  async identify(): Promise<null> {
    return null;
  }

  encode(): Uint8Array {
    return new Uint8Array();
  }
}

const webUnsupportedDriver = new WebUnsupportedDriver();

export const DriverRegistry: Record<PrinterDriverType, IPrinterDriver> = {
  escpos: webUnsupportedDriver,
  tspl: webUnsupportedDriver,
};
```

- [ ] **Step 3: Move + update the test**

```ts
// src/features/printer/printing/__tests__/DriverRegistry.web.test.ts
import { DriverRegistry } from '../DriverRegistry.web';

describe('DriverRegistry (web)', () => {
  it('registers both driver types', () => {
    expect(DriverRegistry.escpos).toBeDefined();
    expect(DriverRegistry.tspl).toBeDefined();
  });

  it('scan returns a no-op unsubscribe and never reports a device', () => {
    const onEvent = jest.fn();
    const unsubscribe = DriverRegistry.escpos.scan('usb', onEvent);
    expect(onEvent).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('connect rejects with UNSUPPORTED_CONNECTION', async () => {
    // @ts-expect-error -- web stub ignores its arguments entirely
    await expect(DriverRegistry.tspl.connect()).rejects.toMatchObject({ code: 'UNSUPPORTED_CONNECTION' });
  });

  it('testPrint rejects with UNSUPPORTED_CONNECTION', async () => {
    // @ts-expect-error -- web stub ignores its arguments entirely
    await expect(DriverRegistry.escpos.testPrint()).rejects.toMatchObject({ code: 'UNSUPPORTED_CONNECTION' });
  });

  it('disconnect resolves without throwing', async () => {
    await expect(DriverRegistry.escpos.disconnect('p1')).resolves.toBeUndefined();
  });

  it('getStatus always returns "error"', () => {
    expect(DriverRegistry.escpos.getStatus('p1')).toBe('error');
  });

  it('onStatusChange returns a no-op unsubscribe', () => {
    const callback = jest.fn();
    const unsubscribe = DriverRegistry.tspl.onStatusChange('p1', callback);
    expect(callback).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('identify resolves null', async () => {
    await expect(DriverRegistry.tspl.identify('p1')).resolves.toBeNull();
  });

  it('encode returns an empty Uint8Array', () => {
    // @ts-expect-error -- web stub ignores its arguments entirely
    expect(DriverRegistry.escpos.encode()).toEqual(new Uint8Array());
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- DriverRegistry.web.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/printing/DriverRegistry.ts src/features/printer/printing/DriverRegistry.web.ts src/features/printer/printing/__tests__/DriverRegistry.web.test.ts
git rm src/features/printer/services/DriverRegistry.ts src/features/printer/services/DriverRegistry.web.ts src/features/printer/services/__tests__/DriverRegistry.web.test.ts
git commit -m "refactor(printer): move DriverRegistry into printing/"
```

---

### Task 16: `printing/PrinterConnectionLock.ts` — move + new resource key formula

**Files:**
- Create: `src/features/printer/printing/PrinterConnectionLock.ts` (move + rewrite `connectionResourceKey`)
- Delete: `src/features/printer/services/PrinterConnectionLock.ts`
- Create: `src/features/printer/printing/__tests__/PrinterConnectionLock.test.ts` (new — the resource-key formula was previously only exercised indirectly)

**Interfaces:**
- Consumes: `PrinterDriverType`, `ConnectionType`, `PrinterDevice`, `PrinterLanConfig` (Task 1).
- Produces: `connectionResourceKey(input)`, `createResourceLock()`, `PrinterConnectionLock` — used by `printing/PrinterService.ts` (Task 17) and `printing/PrintScheduler.ts` (Task 20).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/printer/printing/__tests__/PrinterConnectionLock.test.ts
import { connectionResourceKey, createResourceLock } from '../PrinterConnectionLock';
import type { PrinterDevice, PrinterLanConfig } from '../../types/printer.types';

const btDevice: PrinterDevice = { deviceId: '00:11:22:33:44:55', displayName: 'x', rawDevice: {} };
const lan: PrinterLanConfig = { ip: '192.168.1.50', port: 9100 };

describe('connectionResourceKey', () => {
  it('is "usb" for any driver over USB (RNUSBPrinter is a shared native singleton)', () => {
    expect(connectionResourceKey({ driverType: 'escpos', connectionType: 'usb' })).toBe('usb');
    expect(connectionResourceKey({ driverType: 'tspl', connectionType: 'usb' })).toBe('usb');
  });

  it('is "escpos:bluetooth" regardless of device — the vendor library BLEPrinter namespace is a global singleton', () => {
    const deviceA: PrinterDevice = { ...btDevice, deviceId: 'AA:AA:AA:AA:AA:AA' };
    const deviceB: PrinterDevice = { ...btDevice, deviceId: 'BB:BB:BB:BB:BB:BB' };
    expect(connectionResourceKey({ driverType: 'escpos', connectionType: 'bluetooth', device: deviceA })).toBe(
      connectionResourceKey({ driverType: 'escpos', connectionType: 'bluetooth', device: deviceB }),
    );
    expect(connectionResourceKey({ driverType: 'escpos', connectionType: 'bluetooth', device: deviceA })).toBe('escpos:bluetooth');
  });

  it('is "escpos:lan" regardless of host:port — the vendor library NetPrinter namespace is a global singleton', () => {
    expect(connectionResourceKey({ driverType: 'escpos', connectionType: 'lan', lan })).toBe('escpos:lan');
  });

  it('is per-device for tspl over bluetooth — TsplDriver manages its own transport per printer, no shared native singleton', () => {
    const deviceA: PrinterDevice = { ...btDevice, deviceId: 'AA:AA:AA:AA:AA:AA' };
    const deviceB: PrinterDevice = { ...btDevice, deviceId: 'BB:BB:BB:BB:BB:BB' };
    expect(connectionResourceKey({ driverType: 'tspl', connectionType: 'bluetooth', device: deviceA })).not.toBe(
      connectionResourceKey({ driverType: 'tspl', connectionType: 'bluetooth', device: deviceB }),
    );
    expect(connectionResourceKey({ driverType: 'tspl', connectionType: 'bluetooth', device: deviceA })).toBe(
      'tspl:bluetooth:AA:AA:AA:AA:AA:AA',
    );
  });

  it('is per-host:port for tspl over lan', () => {
    expect(connectionResourceKey({ driverType: 'tspl', connectionType: 'lan', lan })).toBe('tspl:lan:192.168.1.50:9100');
  });

  it('throws when tspl+bluetooth is missing the device, or tspl+lan is missing lan', () => {
    expect(() => connectionResourceKey({ driverType: 'tspl', connectionType: 'bluetooth' })).toThrow();
    expect(() => connectionResourceKey({ driverType: 'tspl', connectionType: 'lan' })).toThrow();
  });
});

describe('createResourceLock', () => {
  it('runs two tasks under the same key sequentially, never overlapping', async () => {
    const lock = createResourceLock();
    let inFlight = 0;
    let maxInFlight = 0;
    const task = () =>
      lock.runExclusive('k', async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      });
    await Promise.all([task(), task()]);
    expect(maxInFlight).toBe(1);
  });

  it('runs tasks under different keys concurrently', async () => {
    const lock = createResourceLock();
    let inFlight = 0;
    let maxInFlight = 0;
    const task = (key: string) =>
      lock.runExclusive(key, async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      });
    await Promise.all([task('a'), task('b')]);
    expect(maxInFlight).toBe(2);
  });
});
```

- [ ] **Step 2: Run to confirm failures**

Run: `npm test -- PrinterConnectionLock.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/features/printer/printing/PrinterConnectionLock.ts
import type { ConnectionType, PrinterDevice, PrinterDriverType, PrinterLanConfig } from '../types/printer.types';

type Task = () => Promise<void>;

export interface ConnectionResourceKeyInput {
  driverType: PrinterDriverType;
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
}

/**
 * Resource key phải phản ánh đúng RANH GIỚI CONCURRENCY THẬT của lớp bên
 * dưới, không phải định danh vật lý của printer (spec §9, invariant #14):
 *
 * - USB: `RNUSBPrinter` là native module singleton dùng chung giữa CẢ 2
 *   driver — 1 key toàn cục `"usb"` bất kể protocol.
 * - ESC/POS qua Bluetooth/LAN: thư viện `@poriyaalar/...` giữ đúng 1 kết nối
 *   native / namespace, singleton TOÀN CỤC theo connectionType — KHÔNG theo
 *   device. Thu hẹp xuống per-device sẽ tái tạo lại bug multi-printer đã
 *   fix trước đây (2 job tưởng độc lập nhưng cướp kết nối lẫn nhau).
 * - TSPL qua Bluetooth/LAN: `TsplDriver` tự quản lý transport riêng theo
 *   printerId (không qua thư viện singleton) — an toàn để thu hẹp xuống
 *   per-connection, cho phép 2 máy TSPL khác nhau in song song thật.
 */
export const connectionResourceKey = (input: ConnectionResourceKeyInput): string => {
  if (input.connectionType === 'usb') return 'usb';
  if (input.driverType === 'escpos') return `escpos:${input.connectionType}`;
  if (input.connectionType === 'bluetooth') {
    if (!input.device) throw new Error('Thiếu device để tính resource key cho TSPL qua Bluetooth');
    return `tspl:bluetooth:${input.device.deviceId}`;
  }
  if (!input.lan) throw new Error('Thiếu lan để tính resource key cho TSPL qua LAN');
  return `tspl:lan:${input.lan.ip}:${input.lan.port}`;
};

/**
 * Khoá loại trừ lẫn nhau theo resource key tuỳ ý — dùng chung bởi
 * `PrintScheduler` (hàng đợi in) và `PrinterService.testPrint()` (thao tác
 * thủ công "In thử"), để 2 đường gọi này không bao giờ chạm cùng 1 kết nối
 * native cùng lúc.
 */
export const createResourceLock = () => {
  const queues = new Map<string, Task[]>();
  const processing = new Set<string>();

  const processQueue = async (key: string): Promise<void> => {
    if (processing.has(key)) return;
    processing.add(key);
    try {
      const queue = queues.get(key);
      while (queue && queue.length > 0) {
        const task = queue[0];
        await task();
        queue.shift();
      }
    } finally {
      queues.delete(key);
      processing.delete(key);
    }
  };

  const runExclusive = <T>(key: string, task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      if (!queues.has(key)) queues.set(key, []);
      queues.get(key)?.push(() => task().then(resolve, reject));
      void processQueue(key);
    });

  return { runExclusive };
};

export const PrinterConnectionLock = createResourceLock();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PrinterConnectionLock.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/printing/PrinterConnectionLock.ts src/features/printer/printing/__tests__/PrinterConnectionLock.test.ts
git rm src/features/printer/services/PrinterConnectionLock.ts
git commit -m "refactor(printer): fix USB resource-lock key to be global across drivers (spec §9)"
```

---

### Task 17: `printing/PrinterService.ts` — full rewrite for multi-driver model

**Files:**
- Create: `src/features/printer/printing/PrinterService.ts` (full rewrite of `services/PrinterService.ts`)
- Delete: `src/features/printer/services/PrinterService.ts`
- Create: `src/features/printer/printing/__tests__/PrinterService.test.ts` (full rewrite)
- Delete: `src/features/printer/services/__tests__/PrinterService.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver`, `PrintDocumentVariants` (Task 2); `Printer`, `PrinterDriver`, `PrinterDriverType` (Task 1); `PrinterStorage` (Task 6); `resolveIdentityKey` (Task 5); `printerSchema` (Task 7); `connectionResourceKey`, `PrinterConnectionLock` (Task 16); `createDiscoverDriver`, `DiscoveryEvent`, `DiscoveryInput` (Task 14).
- Produces: `createPrinterService(registry, lock)`, `PrinterService` singleton — every remaining task (`PrintRoutingService`, `PrintService`, `PrintScheduler`, all UI components) calls this.

**Design decisions this task locks in (not previously reviewed in the spec, decided here for consistency):**
- A `Printer` can have up to 2 live driver connections at once (LAN/Bluetooth: independent native connections; USB: shares one native channel — connecting a second driver silently steals it, a known, accepted limitation, see spec §9). `connect(printerId)`/`disconnect(printerId)` therefore loop over `printer.drivers` and call every underlying driver, collecting failures with `Promise.allSettled` so one driver's failure doesn't block the other.
- `getStatus(printerId)`/`onStatusChange(printerId, cb)` aggregate across `printer.drivers`: **connected if ANY driver is connected**, otherwise the first driver's status. This is what the printer-list UI badge shows — a single status per printer row, even when it has 2 drivers.

- [ ] **Step 1: Write the failing tests (representative subset — port the rest per the recipe after)**

```ts
// src/features/printer/printing/__tests__/PrinterService.test.ts
import { createPrinterService } from '../PrinterService';
import { createResourceLock } from '../PrinterConnectionLock';
import { PrinterStorage } from '../../storage/PrinterStorage';
import type { IPrinterDriver } from '../../types/driver.types';
import type { Printer, PrinterDriver } from '../../types/printer.types';

const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue('connected'),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  print: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  encode: jest.fn().mockReturnValue(new Uint8Array()),
  ...overrides,
});

const escposDriverEntry: PrinterDriver = { type: 'escpos', source: 'auto', contentTypes: ['Receipt'], config: { type: 'escpos' } };
const tsplDriverEntry: PrinterDriver = { type: 'tspl', source: 'auto', contentTypes: ['Label'], config: { type: 'tspl', renderMode: 'bitmap' } };

const basePrinter: Printer = {
  id: 'p1',
  name: 'Máy in hóa đơn quầy 1',
  drivers: [escposDriverEntry],
  connectionType: 'lan',
  lan: { ip: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  paperSize: 80,
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('PrinterService', () => {
  beforeEach(() => {
    PrinterStorage.savePrinters([]);
  });

  it('addPrinter() persists and getPrinters() returns it back', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    expect(service.getPrinters()).toEqual([basePrinter]);
  });

  it('addPrinter() throws when identityKey collides with a different existing printer', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    const duplicate: Printer = { ...basePrinter, id: 'p2', name: 'Máy in khác' };
    expect(() => service.addPrinter(duplicate)).toThrow();
    expect(service.getPrinters()).toHaveLength(1);
  });

  it('updatePrinter() does not throw against its own identityKey', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    const updated: Printer = { ...basePrinter, name: 'Tên mới' };
    expect(() => service.updatePrinter(updated)).not.toThrow();
    expect(service.getPrinters()[0].name).toBe('Tên mới');
  });

  it('removePrinter() removes it from the list', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    service.removePrinter(basePrinter.id);
    expect(service.getPrinters()).toEqual([]);
  });

  it('connect() connects every driver of the printer', async () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    await service.connect(twoDriverPrinter.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(twoDriverPrinter, escposDriverEntry);
    expect(tsplDriver.connect).toHaveBeenCalledWith(twoDriverPrinter, tsplDriverEntry);
  });

  it('connect() does not let one driver failing block the other', async () => {
    const escposDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('offline')) });
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    await service.connect(twoDriverPrinter.id);
    expect(tsplDriver.connect).toHaveBeenCalled();
  });

  it('getStatus() returns connected when at least one driver of the printer is connected', () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue('idle') });
    const tsplDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue('connected') });
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    expect(service.getStatus(twoDriverPrinter.id)).toBe('connected');
  });

  it('getStatus() falls back to the first driver status when none are connected', () => {
    const escposDriver = makeMockDriver({ getStatus: jest.fn().mockReturnValue('error') });
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    service.addPrinter(basePrinter);
    expect(service.getStatus(basePrinter.id)).toBe('error');
  });

  it('print() forwards to the driver whose contentTypes includes the printType', async () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const twoDriverPrinter: Printer = { ...basePrinter, drivers: [escposDriverEntry, tsplDriverEntry] };
    service.addPrinter(twoDriverPrinter);
    const documents = { text: { elements: [] } };
    await service.print(twoDriverPrinter.id, documents, 'Label');
    expect(tsplDriver.print).toHaveBeenCalledWith(twoDriverPrinter.id, documents, 'Label');
    expect(escposDriver.print).not.toHaveBeenCalled();
  });

  it('testPrint() forwards printer+driver+documents straight to the matching driver, without persisting it', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    const documents = { text: { elements: [] } };
    await service.testPrint(basePrinter, escposDriverEntry, documents);
    expect(escposDriver.testPrint).toHaveBeenCalledWith(basePrinter, escposDriverEntry, documents, undefined);
    expect(service.getPrinters()).toEqual([]);
  });

  it('testPrint() runs through the connection lock keyed by connectionResourceKey', async () => {
    const escposDriver = makeMockDriver();
    const lock = createResourceLock();
    const runExclusiveSpy = jest.spyOn(lock, 'runExclusive');
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, lock);
    await service.testPrint(basePrinter, escposDriverEntry, { text: { elements: [] } });
    expect(runExclusiveSpy).toHaveBeenCalledWith('escpos:lan', expect.any(Function));
  });

  it('reconnectAutoPrinters() connects only enabled printers with autoReconnect on', () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: tsplDriver }, createResourceLock());
    const auto: Printer = { ...basePrinter, id: 'p-auto', autoReconnect: true, enabled: true, identityKey: 'lan:1.1.1.1:9100', lan: { ip: '1.1.1.1', port: 9100 } };
    const manual: Printer = { ...basePrinter, id: 'p-manual', autoReconnect: false, enabled: true, identityKey: 'lan:1.1.1.2:9100', lan: { ip: '1.1.1.2', port: 9100 } };
    service.addPrinter(auto);
    service.addPrinter(manual);
    service.reconnectAutoPrinters();
    expect(escposDriver.connect).toHaveBeenCalledTimes(1);
    expect(escposDriver.connect).toHaveBeenCalledWith(auto, escposDriverEntry);
  });

  it('setEnabled() updates enabled for that printer only', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
    const second: Printer = { ...basePrinter, id: 'p2', identityKey: 'lan:1.1.1.2:9100', lan: { ip: '1.1.1.2', port: 9100 } };
    service.addPrinter(basePrinter);
    service.addPrinter(second);
    service.setEnabled('p1', false);
    expect(service.getPrinters().find((p) => p.id === 'p1')?.enabled).toBe(false);
    expect(service.getPrinters().find((p) => p.id === 'p2')?.enabled).toBe(true);
  });

  it('discoverDriver() forwards to createDiscoverDriver wired with the registry', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver }, createResourceLock());
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      service.discoverDriver({ printerId: 'p1', connectionType: 'lan', lan: { ip: '1.1.1.1', port: 9100 } }, (event) => {
        events.push(event.stage);
        if (event.stage === 'identified') resolve();
      });
    });
    expect(events).toEqual(['connecting', 'identifying', 'identified']);
  });

  it('two printers sharing the same resourceKey never connect concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const escposDriver = makeMockDriver({
      connect: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      }),
    });
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() }, createResourceLock());
    const second: Printer = { ...basePrinter, id: 'p2', identityKey: 'lan:1.1.1.2:9100', lan: { ip: '1.1.1.2', port: 9100 } };
    service.addPrinter(basePrinter);
    service.addPrinter(second);
    await Promise.all([service.connect(basePrinter.id), service.connect(second.id)]);
    expect(maxInFlight).toBe(1);
  });
});
```

Port the remaining pre-existing `PrinterService.test.ts` cases (`scanForConnectionType`, `connectDraft`, `disconnect() runs through the lock`, the `getPrinters() normalizes...` legacy-record test — this one can be DELETED, it tested `enabled` defaulting which `PrinterStorage` no longer needs since the destructive reset guarantees only new-shape data survives) using the same mechanical rename: `PrinterConfig` → `Printer` + `PrinterDriver`, `service.setDefault`/`getDefaultPrinterId` tests → DELETE (removed feature, `isDefault` no longer exists — this is an intentional removal, not an oversight), `connectionResourceKey` string literals (`'escpos:lan'`) stay the same for single-driver escpos-lan cases. `connectDraft(config)` becomes `connectDraft(printer, driver)` calling `getDriver(driver.type).connect(printer, driver)` directly (no lock, matching original behavior — this was already true before the refactor, not a new gap introduced here). `disconnectForDriver(driverType, printerId)` replaces `disconnectForProtocol`. Run `npm test -- printing/__tests__/PrinterService.test.ts` after porting.

- [ ] **Step 2: Run to confirm failures**

Run: `npm test -- printing/__tests__/PrinterService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/features/printer/printing/PrinterService.ts
import type { IPrinterDriver, PrintDocumentVariants, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, Printer, PrinterDriver, PrinterDriverType, PrinterStatus } from '../types/printer.types';
import type { PrintType } from '../types/printConfiguration.types';
import { DriverRegistry } from './DriverRegistry';
import { PrinterConnectionLock, connectionResourceKey, type createResourceLock } from './PrinterConnectionLock';
import { PrinterStorage } from '../storage/PrinterStorage';
import { resolveIdentityKey } from '../discovery/PrinterResolver';
import { printerSchema } from '../schemas/printerFormSchema';
import { createDiscoverDriver, type DiscoveryEvent, type DiscoveryInput } from '../discovery/PrinterDiscoveryService';

type ResourceLockLike = ReturnType<typeof createResourceLock>;

export const createPrinterService = (
  registry: Record<PrinterDriverType, IPrinterDriver>,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const getDriver = (type: PrinterDriverType): IPrinterDriver => registry[type];
  const discoverDriverFn = createDiscoverDriver(registry);

  const getPrinters = (): Printer[] => PrinterStorage.getPrinters();
  const savePrinters = (printers: Printer[]): void => PrinterStorage.savePrinters(printers);

  const findOrThrow = (printerId: string): Printer => {
    const found = getPrinters().find((p) => p.id === printerId);
    if (!found) throw new Error(`Không tìm thấy máy in với id ${printerId}`);
    return found;
  };

  const assertNoDuplicateIdentity = (printer: Printer): void => {
    const collision = getPrinters().find((p) => p.id !== printer.id && p.identityKey === printer.identityKey);
    if (collision) {
      throw new Error(`Máy in này đã được thêm với tên "${collision.name}" — dùng "+ Thêm driver" trên máy in đó thay vì thêm mới.`);
    }
  };

  /**
   * Tính lại `identityKey` từ chính `connectionType`/`device`/`lan` của
   * printer — KHÔNG tin thẳng giá trị caller truyền vào (defense-in-depth,
   * cùng triết lý với `printerSchema.parse()` bên dưới: UI đã tự tính đúng,
   * đây là lưới an toàn ở service layer, không phải nguồn sự thật duy nhất).
   */
  const withRecomputedIdentity = (printer: Printer): Printer => ({
    ...printer,
    identityKey: resolveIdentityKey({ connectionType: printer.connectionType, device: printer.device, lan: printer.lan }),
  });

  const addPrinter = (printer: Printer): void => {
    const withIdentity = withRecomputedIdentity(printer);
    printerSchema.parse(withIdentity);
    assertNoDuplicateIdentity(withIdentity);
    savePrinters([...getPrinters(), withIdentity]);
  };

  const updatePrinter = (printer: Printer): void => {
    const withIdentity = withRecomputedIdentity(printer);
    printerSchema.parse(withIdentity);
    assertNoDuplicateIdentity(withIdentity);
    savePrinters(getPrinters().map((p) => (p.id === withIdentity.id ? withIdentity : p)));
  };

  const removePrinter = (printerId: string): void => {
    savePrinters(getPrinters().filter((p) => p.id !== printerId));
  };

  const setEnabled = (printerId: string, enabled: boolean): void => {
    savePrinters(getPrinters().map((p) => (p.id === printerId ? { ...p, enabled } : p)));
  };

  const resourceKeyFor = (printer: Printer, driverType: PrinterDriverType): string =>
    connectionResourceKey({ driverType, connectionType: printer.connectionType, device: printer.device, lan: printer.lan });

  /**
   * Kết nối TẤT CẢ driver của printer, qua khoá tài nguyên riêng cho từng
   * driver (§9) — 1 driver lỗi không chặn driver còn lại (`Promise.allSettled`).
   * LAN/Bluetooth: mỗi driver là 1 kết nối native độc lập. USB: cả 2 driver
   * dùng chung 1 channel — connect driver B sau khi A đã sống sẽ "cướp" kênh
   * (giới hạn đã biết của thư viện, không giải quyết ở đây, xem spec §9).
   */
  const connect = async (printerId: string): Promise<void> => {
    const printer = findOrThrow(printerId);
    await Promise.allSettled(
      printer.drivers.map((driver) =>
        lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).connect(printer, driver)),
      ),
    );
  };

  const disconnect = async (printerId: string): Promise<void> => {
    const printer = findOrThrow(printerId);
    await Promise.allSettled(
      printer.drivers.map((driver) =>
        lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).disconnect(printerId)),
      ),
    );
  };

  const reconnect = async (printerId: string): Promise<void> => {
    await disconnect(printerId).catch(() => undefined);
    await connect(printerId);
  };

  const reconnectAutoPrinters = (): void => {
    getPrinters()
      .filter((p) => p.enabled && p.autoReconnect)
      .forEach((p) => {
        connect(p.id).catch(() => undefined);
      });
  };

  const testPrint = async (printer: Printer, driver: PrinterDriver, documents: PrintDocumentVariants, printType?: PrintType): Promise<void> => {
    await lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).testPrint(printer, driver, documents, printType));
  };

  const print = async (printerId: string, documents: PrintDocumentVariants, printType?: PrintType): Promise<void> => {
    const printer = findOrThrow(printerId);
    const driverEntry = printer.drivers.find((d) => (printType ? d.contentTypes.includes(printType) : true));
    if (!driverEntry) throw new Error(`Máy in ${printerId} không có driver nào nhận in ${printType ?? '(không rõ loại)'}`);
    const driver = getDriver(driverEntry.type);
    if (driver.getStatus(printerId) !== 'connected') {
      await driver.connect(printer, driverEntry);
    }
    await driver.print(printerId, documents, printType);
  };

  const scanDevices = (type: PrinterDriverType, connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe =>
    getDriver(type).scan(connectionType, onEvent);

  const scanForConnectionType = (connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe => {
    if (connectionType === 'usb') return getDriver('escpos').scan('usb', onEvent);
    if (connectionType === 'bluetooth') return getDriver('tspl').scan('bluetooth', onEvent);
    return getDriver('tspl').scan('lan', onEvent);
  };

  const connectDraft = async (printer: Printer, driver: PrinterDriver): Promise<void> => {
    await getDriver(driver.type).connect(printer, driver);
  };

  const disconnectForDriver = async (type: PrinterDriverType, printerId: string): Promise<void> => {
    await getDriver(type).disconnect(printerId);
  };

  /** Connected nếu BẤT KỲ driver nào của printer đang connected, ngược lại fallback driver đầu tiên — 1 badge/1 printer dù có thể có 2 driver (thiết kế cho task này, xem đầu Task 17). */
  const getStatus = (printerId: string): PrinterStatus => {
    const printer = findOrThrow(printerId);
    const statuses = printer.drivers.map((d) => getDriver(d.type).getStatus(printerId));
    return statuses.find((s) => s === 'connected') ?? statuses[0] ?? 'idle';
  };

  const onStatusChange = (printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe => {
    const printer = findOrThrow(printerId);
    const unsubscribes = printer.drivers.map((d) => getDriver(d.type).onStatusChange(printerId, () => callback(getStatus(printerId))));
    return () => unsubscribes.forEach((unsub) => unsub());
  };

  const getStatusForDriver = (type: PrinterDriverType, printerId: string): PrinterStatus => getDriver(type).getStatus(printerId);

  const onStatusChangeForDriver = (type: PrinterDriverType, printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe =>
    getDriver(type).onStatusChange(printerId, callback);

  const discoverDriver = (input: DiscoveryInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe => discoverDriverFn(input, onEvent);

  return {
    getPrinters,
    addPrinter,
    updatePrinter,
    removePrinter,
    setEnabled,
    connect,
    disconnect,
    reconnect,
    reconnectAutoPrinters,
    testPrint,
    print,
    scanDevices,
    scanForConnectionType,
    connectDraft,
    getStatus,
    onStatusChange,
    getStatusForDriver,
    onStatusChangeForDriver,
    disconnectForDriver,
    discoverDriver,
  };
};

export const PrinterService = createPrinterService(DriverRegistry);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- printing/__tests__/PrinterService.test.ts`
Expected: PASS (all ported tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/printing/PrinterService.ts src/features/printer/printing/__tests__/PrinterService.test.ts
git rm src/features/printer/services/PrinterService.ts src/features/printer/services/__tests__/PrinterService.test.ts
git commit -m "refactor(printer): rewrite PrinterService for multi-driver Printer model"
```

---

### Task 18: `printing/PrintRoutingService.ts` — new (content type → printer/driver)

**Files:**
- Create: `src/features/printer/printing/PrintRoutingService.ts`
- Test: `src/features/printer/printing/__tests__/PrintRoutingService.test.ts`

**Interfaces:**
- Consumes: `Printer`, `PrinterDriver` (Task 1); `PrintType` (`printConfiguration.types.ts`, unchanged); `PrinterService.getPrinters` (Task 17).
- Produces: `PrintTarget`, `createPrintRoutingService(deps)`, `PrintRoutingService` singleton — used by `printing/PrintService.ts` (Task 19).

Per spec §7.1: this service ONLY answers "content type → which printer/driver" — it never decides how a driver encodes or which document variant to send.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/printer/printing/__tests__/PrintRoutingService.test.ts
import { createPrintRoutingService } from '../PrintRoutingService';
import type { Printer, PrinterDriver } from '../../types/printer.types';

const escposDriver: PrinterDriver = { type: 'escpos', source: 'auto', contentTypes: ['Receipt'], config: { type: 'escpos' } };
const tsplDriver: PrinterDriver = { type: 'tspl', source: 'auto', contentTypes: ['Label'], config: { type: 'tspl', renderMode: 'bitmap' } };

const makePrinter = (id: string, overrides: Partial<Printer> = {}): Printer => ({
  id,
  name: id,
  drivers: [escposDriver],
  connectionType: 'lan',
  lan: { ip: '1.1.1.1', port: 9100 },
  identityKey: `lan:1.1.1.1:9100-${id}`,
  paperSize: 80,
  autoReconnect: false,
  enabled: true,
  createdAt: 'x',
  updatedAt: 'x',
  ...overrides,
});

describe('PrintRoutingService.resolveTargets', () => {
  it('returns the printer + driver whose contentTypes include the given printType', () => {
    const p1 = makePrinter('p1');
    const service = createPrintRoutingService({ getPrinters: () => [p1] });
    expect(service.resolveTargets('Receipt')).toEqual([{ printer: p1, driver: escposDriver }]);
  });

  it('excludes disabled printers', () => {
    const service = createPrintRoutingService({ getPrinters: () => [makePrinter('p1', { enabled: false })] });
    expect(service.resolveTargets('Receipt')).toEqual([]);
  });

  it('excludes a printer whose driver does not claim this printType', () => {
    const service = createPrintRoutingService({ getPrinters: () => [makePrinter('p1')] });
    expect(service.resolveTargets('Label')).toEqual([]);
  });

  it('picks the correct driver among two on the same printer', () => {
    const p1 = makePrinter('p1', { drivers: [escposDriver, tsplDriver] });
    const service = createPrintRoutingService({ getPrinters: () => [p1] });
    expect(service.resolveTargets('Label')).toEqual([{ printer: p1, driver: tsplDriver }]);
  });

  it('returns multiple targets across multiple printers', () => {
    const service = createPrintRoutingService({ getPrinters: () => [makePrinter('p1'), makePrinter('p2')] });
    expect(service.resolveTargets('Receipt')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to confirm failures**

Run: `npm test -- PrintRoutingService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/features/printer/printing/PrintRoutingService.ts
import type { Printer, PrinterDriver } from '../types/printer.types';
import type { PrintType } from '../types/printConfiguration.types';
import { PrinterService } from './PrinterService';

export interface PrintTarget {
  printer: Printer;
  driver: PrinterDriver;
}

interface PrintRoutingServiceDeps {
  getPrinters: typeof PrinterService.getPrinters;
}

/**
 * CHỈ biết "content type nào → printer nào / driver nào" (spec §7.1) —
 * không biết cách driver mã hoá/gửi dữ liệu, không quyết định document
 * variant nào được dùng (đó là driver capability concern, xem
 * `drivers/tspl/TsplDriver.ts` `encode()`).
 */
export const createPrintRoutingService = (deps: PrintRoutingServiceDeps) => {
  const resolveTargets = (printType: PrintType): PrintTarget[] => {
    const targets: PrintTarget[] = [];
    for (const printer of deps.getPrinters()) {
      if (!printer.enabled) continue;
      const driver = printer.drivers.find((d) => d.contentTypes.includes(printType));
      if (driver) targets.push({ printer, driver });
    }
    return targets;
  };

  return { resolveTargets };
};

export const PrintRoutingService = createPrintRoutingService({ getPrinters: PrinterService.getPrinters });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PrintRoutingService.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/printing/PrintRoutingService.ts src/features/printer/printing/__tests__/PrintRoutingService.test.ts
git commit -m "feat(printer): add PrintRoutingService (content type -> printer/driver)"
```

---

### Task 19: `types/printJob.types.ts` + `printing/PrintService.ts` — variants flow through to the driver

**Files:**
- Modify: `src/features/printer/types/printJob.types.ts` (`document: PrintDocument` → `documentVariants: PrintDocumentVariants`)
- Modify: `src/features/printer/types/__tests__/printJob.types.test.ts` (rename fixture field only)
- Create: `src/features/printer/printing/PrintService.ts` (rewrite of `services/PrintService.ts`)
- Delete: `src/features/printer/services/PrintService.ts`
- Create: `src/features/printer/printing/__tests__/PrintService.test.ts` (rewrite)
- Delete: `src/features/printer/services/__tests__/PrintService.test.ts`

**Why `PrintJob` changes:** spec §7.2 requires the document-variant choice (text vs image) to happen INSIDE the driver, not in `PrintService`/`PrintRoutingService`. That only works if the full `PrintDocumentVariants` travels all the way through `PrintJob` → `PrintScheduler` → `PrinterService.print()` → driver — a single pre-resolved `PrintDocument` on the job would force `PrintService` to pick the variant itself (exactly what spec §7.1/§7.2 says NOT to do).

**Interfaces:**
- Consumes: `PrintDocumentVariants` (Task 2, now the canonical definition — re-exported from `PrintService.ts` for `OrderPrintTrigger`'s existing import path, fixed in Task 21); `PrintTarget`, `PrintRoutingService` (Task 18); `PrintScheduler` (Task 20, imported here but implemented after — TypeScript resolves this fine since both are same-package modules, just implement Task 20 before running this task's tests if `PrintScheduler.ts` does not exist yet at the old path).
- Produces: `createPrintService(deps)`, `PrintService` singleton (`print`, `imageDocumentPaperSize`) — consumed by `src/features/cart/services/OrderPrintTrigger.ts` (import path only changes, Task 21).

- [ ] **Step 1: Update `printJob.types.ts`**

```ts
// src/features/printer/types/printJob.types.ts
import type { AppError } from './AppError';
import type { PrintDocumentVariants } from './driver.types';
import type { PrintType } from './printConfiguration.types';

export type PrintJobStatus = 'pending' | 'printing' | 'success' | 'failed' | 'cancelled';

export interface PrintJob {
  id: string;
  requestId: string;
  printerId: string;
  /** Loại nội dung (Hoá đơn/Tem) — TSPL driver dùng để chọn chế độ giấy liên tục (Receipt) hay dò khe (Label). */
  printType: PrintType;
  /** Cả 2 variant (text/image) đi hết tới driver — driver tự chọn dùng cái nào (spec §7.2), KHÔNG resolve trước ở PrintService/PrintScheduler. */
  documentVariants: PrintDocumentVariants;
  status: PrintJobStatus;
  retryCount: number;
  error?: AppError;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type PrintResultStatus = 'success' | 'partial-failure' | 'failed' | 'no-available-printer';

export interface PrintResult {
  status: PrintResultStatus;
  jobs: PrintJob[];
  error?: AppError;
}
```

Open `src/features/printer/types/__tests__/printJob.types.test.ts` and rename every fixture's `document: {...}` field to `documentVariants: { text: {...} }`. Run `npm test -- printJob.types.test.ts` and confirm the same test count passes.

- [ ] **Step 2: Write the failing `PrintService` tests**

```ts
// src/features/printer/printing/__tests__/PrintService.test.ts
import { createPrintService, PrintService } from '../PrintService';
import type { PrintTarget } from '../PrintRoutingService';
import type { Printer, PrinterDriver } from '../../types/printer.types';
import type { PrintJob } from '../../types/printJob.types';

const textDocument = { elements: [{ type: 'text' as const, content: 'text-doc', x: 0, y: 0 }] };
const imageDocument = { elements: [{ type: 'image' as const, data: 'base64...', x: 0, y: 0 }] };

const escposDriver: PrinterDriver = { type: 'escpos', source: 'auto', contentTypes: ['Receipt'], config: { type: 'escpos' } };
const tsplDriver: PrinterDriver = { type: 'tspl', source: 'auto', contentTypes: ['Label'], config: { type: 'tspl', renderMode: 'bitmap' } };

const makePrinter = (id: string, overrides: Partial<Printer> = {}): Printer => ({
  id, name: id, drivers: [escposDriver], connectionType: 'lan', lan: { ip: '1.1.1.1', port: 9100 },
  identityKey: `lan:1.1.1.1:9100-${id}`, paperSize: 80, autoReconnect: false, enabled: true,
  createdAt: 'x', updatedAt: 'x', ...overrides,
});

const makeDeps = (targets: PrintTarget[], scheduleResult: (printerId: string) => PrintJob) => ({
  routing: { resolveTargets: jest.fn().mockReturnValue(targets) },
  scheduler: { enqueue: jest.fn().mockImplementation((job: PrintJob) => Promise.resolve(scheduleResult(job.printerId))) },
});

describe('PrintService.print', () => {
  it('returns no-available-printer with no jobs when routing finds nothing', async () => {
    const deps = makeDeps([], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print('Receipt', { text: textDocument });
    expect(result.status).toBe('no-available-printer');
    expect(result.error?.code).toBe('NO_AVAILABLE_PRINTER');
    expect(deps.scheduler.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues one job per resolved target, carrying the full documentVariants through untouched', async () => {
    const p1 = makePrinter('p1');
    const deps = makeDeps(
      [{ printer: p1, driver: escposDriver }],
      (printerId) => ({ id: 'job1', requestId: 'req1', printerId, printType: 'Receipt', documentVariants: { text: textDocument }, status: 'success', retryCount: 0, createdAt: 'now' }),
    );
    const service = createPrintService(deps);
    const documentVariants = { text: textDocument, image: imageDocument };
    await service.print('Receipt', documentVariants);
    expect(deps.scheduler.enqueue).toHaveBeenCalledWith(expect.objectContaining({ printerId: 'p1', documentVariants }));
  });

  it('reports success when all jobs succeed', async () => {
    const deps = makeDeps(
      [{ printer: makePrinter('p1'), driver: escposDriver }, { printer: makePrinter('p2'), driver: escposDriver }],
      (printerId) => ({ id: 'job', requestId: 'req', printerId, printType: 'Receipt', documentVariants: { text: textDocument }, status: 'success', retryCount: 0, createdAt: 'now' }),
    );
    const service = createPrintService(deps);
    expect((await service.print('Receipt', { text: textDocument })).status).toBe('success');
  });

  it('reports partial-failure on mixed results', async () => {
    const deps = makeDeps(
      [{ printer: makePrinter('p1'), driver: escposDriver }, { printer: makePrinter('p2'), driver: escposDriver }],
      (printerId) => ({ id: 'job', requestId: 'req', printerId, printType: 'Receipt', documentVariants: { text: textDocument }, status: printerId === 'p1' ? 'success' : 'failed', retryCount: 0, createdAt: 'now' }),
    );
    const service = createPrintService(deps);
    expect((await service.print('Receipt', { text: textDocument })).status).toBe('partial-failure');
  });

  it('reports failed with no top-level error when every job fails', async () => {
    const deps = makeDeps(
      [{ printer: makePrinter('p1'), driver: escposDriver }],
      (printerId) => ({ id: 'job', requestId: 'req', printerId, printType: 'Receipt', documentVariants: { text: textDocument }, status: 'failed', retryCount: 0, createdAt: 'now', error: { code: 'PRINT_ERROR', message: 'x' } }),
    );
    const service = createPrintService(deps);
    const result = await service.print('Receipt', { text: textDocument });
    expect(result.status).toBe('failed');
    expect(result.error).toBeUndefined();
  });
});

describe('PrintService.imageDocumentPaperSize', () => {
  it('returns null when the only target uses escpos', () => {
    const deps = makeDeps([{ printer: makePrinter('p1', { paperSize: 58 }), driver: escposDriver }], () => { throw new Error('unused'); });
    expect(createPrintService(deps).imageDocumentPaperSize('Receipt')).toBeNull();
  });

  it('returns the paperSize of the tspl target — TSPL always wants image now, no toggle', () => {
    const deps = makeDeps([{ printer: makePrinter('p1', { paperSize: 58, drivers: [tsplDriver] }), driver: tsplDriver }], () => { throw new Error('unused'); });
    expect(createPrintService(deps).imageDocumentPaperSize('Receipt')).toBe(58);
  });

  it('the real exported PrintService singleton has no configured printers by default, so it returns null', () => {
    expect(PrintService.imageDocumentPaperSize('Receipt')).toBeNull();
  });
});
```

- [ ] **Step 3: Run to confirm failures**

Run: `npm test -- printJob.types.test.ts printing/__tests__/PrintService.test.ts`
Expected: FAIL — module not found for `PrintService`

- [ ] **Step 4: Implement `PrintService.ts`**

```ts
// src/features/printer/printing/PrintService.ts
import { PrintRoutingService, type PrintTarget } from './PrintRoutingService';
import { PrintScheduler } from './PrintScheduler';
import { generateId } from '../../../utils/id';
import { PRINT_TYPE_LABELS } from '../types/printConfiguration.types';
import type { PrintType } from '../types/printConfiguration.types';
import type { PaperSize } from '../types/printer.types';
import type { PrintDocumentVariants } from '../types/driver.types';
import type { PrintJob, PrintResult } from '../types/printJob.types';

export type { PrintDocumentVariants };

interface PrintServiceDeps {
  routing: Pick<typeof PrintRoutingService, 'resolveTargets'>;
  scheduler: Pick<typeof PrintScheduler, 'enqueue'>;
}

export const createPrintService = (deps: PrintServiceDeps) => {
  /**
   * `paperSize` cần để render ảnh cho `printType` này, hoặc `null` nếu không
   * có target nào dùng driver tspl — TSPL `renderMode` luôn `'bitmap'` nên
   * hễ có tspl target là cần ảnh, không còn toggle `tsplRenderAsImage` như
   * trước (spec §4.4). Nơi gọi (`OrderPrintTrigger`) chỉ nên tốn chi phí
   * capture khi có giá trị trả về.
   */
  const imageDocumentPaperSize = (printType: PrintType): PaperSize | null => {
    const target = deps.routing.resolveTargets(printType).find((t: PrintTarget) => t.driver.type === 'tspl');
    return target ? target.printer.paperSize : null;
  };

  const print = async (printType: PrintType, documentVariants: PrintDocumentVariants): Promise<PrintResult> => {
    const targets = deps.routing.resolveTargets(printType);
    if (targets.length === 0) {
      return {
        status: 'no-available-printer',
        jobs: [],
        error: { code: 'NO_AVAILABLE_PRINTER', message: `Chưa thiết lập máy in cho ${PRINT_TYPE_LABELS[printType]}` },
      };
    }
    const requestId = generateId();
    const jobs: PrintJob[] = await Promise.all(
      targets.map(({ printer }) =>
        deps.scheduler.enqueue({
          id: generateId(),
          requestId,
          printerId: printer.id,
          printType,
          documentVariants,
          status: 'pending',
          retryCount: 0,
          createdAt: new Date().toISOString(),
        }),
      ),
    );
    const successCount = jobs.filter((job) => job.status === 'success').length;
    const status = successCount === jobs.length ? 'success' : successCount === 0 ? 'failed' : 'partial-failure';
    return { status, jobs };
  };

  return { print, imageDocumentPaperSize };
};

export const PrintService = createPrintService({ routing: PrintRoutingService, scheduler: PrintScheduler });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- printJob.types.test.ts printing/__tests__/PrintService.test.ts`
Expected: PASS (all tests) — this requires Task 20 (`PrintScheduler.ts`) to already exist at `printing/PrintScheduler.ts`; do Task 20 first if working strictly in order, or implement both together.

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/types/printJob.types.ts src/features/printer/types/__tests__/printJob.types.test.ts src/features/printer/printing/PrintService.ts src/features/printer/printing/__tests__/PrintService.test.ts
git rm src/features/printer/services/PrintService.ts src/features/printer/services/__tests__/PrintService.test.ts
git commit -m "refactor(printer): PrintJob carries full PrintDocumentVariants through to the driver"
```

---

### Task 20: `printing/PrintScheduler.ts` — move + driver-aware resource key

**Files:**
- Create: `src/features/printer/printing/PrintScheduler.ts` (rewrite of `services/PrintScheduler.ts`)
- Delete: `src/features/printer/services/PrintScheduler.ts`
- Create: `src/features/printer/printing/__tests__/PrintScheduler.test.ts` (rewrite)
- Delete: `src/features/printer/services/__tests__/PrintScheduler.test.ts`

**Interfaces:**
- Consumes: `PrinterService` (Task 17), `connectionResourceKey`, `PrinterConnectionLock` (Task 16), `PrintJob` (Task 19).
- Produces: `createPrintScheduler(printerService, lock)`, `PrintScheduler` singleton — consumed by `printing/PrintService.ts` (Task 19).

Do this task before running Task 19's tests if executing strictly in file order (Task 19 imports `./PrintScheduler`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/printer/printing/__tests__/PrintScheduler.test.ts
import { createPrintScheduler } from '../PrintScheduler';
import { createResourceLock } from '../PrinterConnectionLock';
import { AppErrorException } from '../../types/AppError';
import type { Printer, PrinterDriver } from '../../types/printer.types';
import type { PrintJob } from '../../types/printJob.types';

const escposDriver: PrinterDriver = { type: 'escpos', source: 'auto', contentTypes: ['Receipt'], config: { type: 'escpos' } };
const tsplDriver: PrinterDriver = { type: 'tspl', source: 'auto', contentTypes: ['Label'], config: { type: 'tspl', renderMode: 'bitmap' } };

const makeJob = (overrides: Partial<PrintJob> = {}): PrintJob => ({
  id: 'job1', requestId: 'req1', printerId: 'p1', printType: 'Receipt',
  documentVariants: { text: { elements: [] } }, status: 'pending', retryCount: 0, createdAt: new Date().toISOString(),
  ...overrides,
});

const makePrinter = (overrides: Partial<Printer> = {}): Printer => ({
  id: 'p1', name: 'Máy in', drivers: [escposDriver], connectionType: 'lan', lan: { ip: '1.1.1.1', port: 9100 },
  identityKey: 'lan:1.1.1.1:9100', paperSize: 80, autoReconnect: false, enabled: true, createdAt: 'x', updatedAt: 'x',
  ...overrides,
});

describe('PrintScheduler', () => {
  it('enqueue() resolves with status success when PrinterService.print resolves', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined), getPrinters: jest.fn().mockReturnValue([]) };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe('success');
    expect(result.completedAt).toBeDefined();
  });

  it('enqueue() resolves with status failed and an AppError when PrinterService.print rejects', async () => {
    const printerService = {
      print: jest.fn().mockRejectedValue(new AppErrorException({ code: 'PRINT_ERROR', message: 'hết giấy' })),
      getPrinters: jest.fn().mockReturnValue([]),
    };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe('failed');
    expect(result.error).toEqual({ code: 'PRINT_ERROR', message: 'hết giấy' });
  });

  it('retry() increments retryCount and re-enqueues the same job id', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined), getPrinters: jest.fn().mockReturnValue([]) };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    const result = await scheduler.retry(makeJob({ status: 'failed', retryCount: 0 }));
    expect(result.retryCount).toBe(1);
    expect(result.status).toBe('success');
  });

  it('serializes jobs for different printers that share the same resource key (escpos:lan, vendor library singleton)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printers = [makePrinter({ id: 'receipt-1' }), makePrinter({ id: 'receipt-2' })];
    const printerService = {
      print: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      }),
      getPrinters: jest.fn().mockReturnValue(printers),
    };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'a', printerId: 'receipt-1' })),
      scheduler.enqueue(makeJob({ id: 'b', printerId: 'receipt-2' })),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('runs jobs in parallel for tspl printers on different LAN hosts (per-connection resource key)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printers = [
      makePrinter({ id: 'label-1', drivers: [tsplDriver], lan: { ip: '1.1.1.1', port: 9100 } }),
      makePrinter({ id: 'label-2', drivers: [tsplDriver], lan: { ip: '1.1.1.2', port: 9100 } }),
    ];
    const printerService = {
      print: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      }),
      getPrinters: jest.fn().mockReturnValue(printers),
    };
    const scheduler = createPrintScheduler(printerService, createResourceLock());
    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'a', printerId: 'label-1', printType: 'Label' })),
      scheduler.enqueue(makeJob({ id: 'b', printerId: 'label-2', printType: 'Label' })),
    ]);
    expect(maxInFlight).toBe(2);
  });
});
```

- [ ] **Step 2: Run to confirm failures**

Run: `npm test -- printing/__tests__/PrintScheduler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/features/printer/printing/PrintScheduler.ts
import { AppErrorException, type AppError } from '../types/AppError';
import { PrinterService } from './PrinterService';
import { PrinterConnectionLock, connectionResourceKey, type createResourceLock } from './PrinterConnectionLock';
import type { PrintJob } from '../types/printJob.types';

type PrinterServiceLike = Pick<typeof PrinterService, 'print' | 'getPrinters'>;
type ResourceLockLike = ReturnType<typeof createResourceLock>;

export const createPrintScheduler = (
  printerService: PrinterServiceLike,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const toAppError = (error: unknown): AppError =>
    error instanceof AppErrorException ? { code: error.code, message: error.message } : { code: 'PRINT_ERROR', message: String(error) };

  /**
   * Tra printer + driver sẽ xử lý `job.printType`, rồi tính resource key
   * theo đúng đặc thù driver đó (spec §9, xem `connectionResourceKey`) — KHÔNG
   * còn `protocol:connectionType` đơn giản như trước, vì mỗi driver type có
   * ranh giới concurrency khác nhau. Rơi về `job.printerId` nếu không tìm
   * thấy cấu hình (không nên xảy ra trong thực tế).
   */
  const resourceKeyFor = (job: PrintJob): string => {
    const printer = printerService.getPrinters().find((p) => p.id === job.printerId);
    if (!printer) return job.printerId;
    const driver = printer.drivers.find((d) => d.contentTypes.includes(job.printType)) ?? printer.drivers[0];
    return connectionResourceKey({ driverType: driver.type, connectionType: printer.connectionType, device: printer.device, lan: printer.lan });
  };

  const enqueue = (job: PrintJob): Promise<PrintJob> =>
    lock
      .runExclusive(resourceKeyFor(job), async () => {
        job.status = 'printing';
        job.startedAt = new Date().toISOString();
        try {
          await printerService.print(job.printerId, job.documentVariants, job.printType);
          job.status = 'success';
        } catch (error) {
          job.status = 'failed';
          job.error = toAppError(error);
        }
        job.completedAt = new Date().toISOString();
      })
      .then(() => job);

  const retry = (job: PrintJob): Promise<PrintJob> => {
    job.retryCount += 1;
    job.status = 'pending';
    job.error = undefined;
    return enqueue(job);
  };

  return { enqueue, retry };
};

export const PrintScheduler = createPrintScheduler(PrinterService);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- printing/__tests__/PrintScheduler.test.ts`
Expected: PASS (5 tests). Then re-run Task 19's `PrintService.test.ts` to confirm it also passes now that `PrintScheduler.ts` exists.

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/printing/PrintScheduler.ts src/features/printer/printing/__tests__/PrintScheduler.test.ts
git rm src/features/printer/services/PrintScheduler.ts src/features/printer/services/__tests__/PrintScheduler.test.ts
git commit -m "refactor(printer): PrintScheduler resource key is driver-aware (spec §9)"
```

---

## Phase F — Cross-feature import fixes

### Task 21: Fix import paths in files outside `printer/` that reference moved modules

**Files:**
- Modify: `App.tsx` (repo root)
- Modify: `src/features/application/components/ApplicationSidebar.tsx`
- Modify: `src/features/printer/hooks/usePrinterConnection.ts`
- Modify: `src/features/printer/hooks/__tests__/usePrinterConnection.test.tsx`
- Modify: `src/features/cart/services/OrderPrintTrigger.ts`

No logic changes in any of these files — only import paths, since `PrinterService`/`PrintService` moved from `services/` to `printing/`. `PrinterService.getStatus(printerId)`/`onStatusChange(printerId, cb)` keep the exact same call signature (now internally aggregating across a printer's drivers, per Task 17 — invisible to these callers). `OrderPrintTrigger.ts`'s `PrintType`/`PaperSize` imports are unaffected by path (still `printer/types/printConfiguration.types` and `printer/types/printer.types`, unchanged locations); only its `PrintService`/`PrintDocumentVariants` import path changes.

- [ ] **Step 1: Update `App.tsx`**

```ts
// before
import { PrinterService } from './src/features/printer/services/PrinterService';
// after
import { PrinterService } from './src/features/printer/printing/PrinterService';
```

- [ ] **Step 2: Update `ApplicationSidebar.tsx`**

```ts
// before
import { PrinterService } from '../../printer/services/PrinterService';
// after
import { PrinterService } from '../../printer/printing/PrinterService';
```

- [ ] **Step 3: Update `usePrinterConnection.ts`**

```ts
// before
import { PrinterService } from '../services/PrinterService';
// after
import { PrinterService } from '../printing/PrinterService';
```

- [ ] **Step 4: Update `usePrinterConnection.test.tsx`**

```ts
// before
import { PrinterService } from '../../services/PrinterService';
jest.mock('../../services/PrinterService', () => ({ ... }));
// after
import { PrinterService } from '../../printing/PrinterService';
jest.mock('../../printing/PrinterService', () => ({ ... }));
```

- [ ] **Step 5: Update `OrderPrintTrigger.ts`**

```ts
// before
import { PrintService, type PrintDocumentVariants } from '../../printer/services/PrintService';
// after
import { PrintService, type PrintDocumentVariants } from '../../printer/printing/PrintService';
```

- [ ] **Step 6: Run the affected tests**

Run: `npm test -- usePrinterConnection.test.tsx OrderPrintTrigger.test.ts`
Expected: PASS (no behavior changed, only import resolution)

- [ ] **Step 7: Commit**

```bash
git add App.tsx src/features/application/components/ApplicationSidebar.tsx src/features/printer/hooks/usePrinterConnection.ts src/features/printer/hooks/__tests__/usePrinterConnection.test.tsx src/features/cart/services/OrderPrintTrigger.ts
git commit -m "refactor(printer): fix cross-feature import paths after services/ -> printing/ move"
```

---

## Phase G — UI (no dedicated test files per project convention — see `CLAUDE.md`: "Component UI thuần trình bày ... không có test file riêng — verify qua type-check + lint + test thủ công trên thiết bị")

### Task 22: `AddPrinterModal.tsx` + `StatusPanel.tsx` + `ConnectionSection.tsx` — multi-driver flow

**Files:**
- Modify: `src/features/printer/components/AddPrinterModal.tsx` (full rewrite)
- Modify: `src/features/printer/components/StatusPanel.tsx` (full rewrite)
- Modify: `src/features/printer/components/ConnectionSection.tsx` (add `disabled` prop)

**Interfaces:**
- Consumes: `PrinterService` (Task 17: `discoverDriver`, `connectDraft`, `disconnectForDriver`, `getStatusForDriver`, `onStatusChangeForDriver`, `testPrint`, `addPrinter`, `updatePrinter`, `getPrinters`), `resolveIdentityKey` (Task 5), `getDriverDefinition` (Task 4), `printerDisplaySchema`/`lanConnectionSchema` (Task 7).
- Produces: `AddPrinterModalProps` unchanged externally (`visible`, `initialValues: Printer | undefined`, `onDismiss`, `onSaved`) — `components/PrinterManagementPanel.tsx` needs NO changes (still passes a `Printer | undefined`, same prop names).

**Design decisions this task locks in (multi-driver UX, spec §5.1, not fully mechanical from the spec — the actual state machine wiring):**
- `ConnectionSection` (connectionType/device/LAN inputs) is **disabled once `drivers.length > 0`** — a printer's physical connection point is fixed the moment its first driver is confirmed; there is no UI to change connection after that (matches "Disable, không Hide"). This makes `connectionDirty` only ever relevant before the first driver exists.
- Identity duplicate check (spec §6.3) runs as soon as `connectionType`+`device`/`lan` are fully specified, BEFORE "Kết nối" is enabled — computed with `resolveIdentityKey`, compared against `PrinterService.getPrinters()` excluding the printer being edited.
- On `identified`/manual-chosen, the new driver is appended to local `drivers` state with a DEFAULT `contentTypes` = every content type `getDriverDefinition(type).contentTypes` allows that is NOT already claimed by another driver already in `drivers` (invariant #3) — the user can then uncheck any of them in `PrinterInfoCard` (Task 23), never add ones outside capability or already claimed.
- "+ Thêm driver khác" is only shown while `drivers.length < 2`.
- Test print builds an ephemeral (unsaved) `Printer` from current modal state and always captures a bill image when the target driver is `tspl` (no toggle anymore — `renderMode` is always `'bitmap'`).

- [ ] **Step 1: Add a `disabled` prop to `ConnectionSection.tsx`**

```tsx
// src/features/printer/components/ConnectionSection.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons, HelperText } from 'react-native-paper';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { DeviceScanList } from './DeviceScanList';
import type { ConnectionType, PrinterDevice } from '../types/printer.types';

export interface ConnectionSectionProps {
  connectionType: ConnectionType;
  onConnectionTypeChange: (value: ConnectionType) => void;
  selectedDeviceId?: string;
  onSelectDevice: (device: PrinterDevice) => void;
  lanIp: string;
  lanPort: string;
  onLanIpChange: (value: string) => void;
  onLanPortChange: (value: string) => void;
  lanIpError?: string;
  lanPortError?: string;
  detectedLanIp?: string | null;
  lanIpFetchError?: string;
  onFetchLanIp: () => void;
  onAutoFillLanIp: () => void;
  connectLabel: string;
  connectDisabled: boolean;
  onConnectPress: () => void;
  /** Khoá toàn bộ section (segmented buttons/inputs/device list/nút Kết nối) khi đã có >= 1 driver — điểm kết nối vật lý cố định sau khi driver đầu tiên được xác nhận. */
  disabled: boolean;
}

export const ConnectionSection: React.FC<ConnectionSectionProps> = ({
  connectionType,
  onConnectionTypeChange,
  selectedDeviceId,
  onSelectDevice,
  lanIp,
  lanPort,
  onLanIpChange,
  onLanPortChange,
  lanIpError,
  lanPortError,
  detectedLanIp,
  lanIpFetchError,
  onFetchLanIp,
  onAutoFillLanIp,
  connectLabel,
  connectDisabled,
  onConnectPress,
  disabled,
}) => (
  <View style={styles.container}>
    <SegmentedButtons
      value={connectionType}
      onValueChange={(value) => onConnectionTypeChange(value as ConnectionType)}
      buttons={[
        { value: 'usb', label: 'USB' },
        { value: 'bluetooth', label: 'Bluetooth' },
        { value: 'lan', label: 'LAN' },
      ]}
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- SegmentedButtons has no `disabled` prop upstream, wrap the whole block visually via pointerEvents instead
    />
    {connectionType === 'lan' ? (
      <>
        <AppInput label="Địa chỉ IP" value={lanIp} onChangeText={onLanIpChange} errorMessage={lanIpError} disabled={disabled} />
        <View style={styles.lanIpActions}>
          <AppButton label="Lấy IP mạng" mode="outlined" onPress={onFetchLanIp} disabled={disabled} />
          {detectedLanIp ? <AppButton label="Điền IP" mode="outlined" onPress={onAutoFillLanIp} disabled={disabled} /> : null}
        </View>
        {lanIpFetchError ? <HelperText type="error">{lanIpFetchError}</HelperText> : null}
        <AppInput
          label="Cổng"
          value={lanPort}
          onChangeText={onLanPortChange}
          keyboardType="numeric"
          errorMessage={lanPortError}
          disabled={disabled}
        />
      </>
    ) : (
      <DeviceScanList connectionType={connectionType} selectedDeviceId={selectedDeviceId} onSelect={disabled ? () => undefined : onSelectDevice} />
    )}
    <AppButton label={connectLabel} onPress={onConnectPress} disabled={connectDisabled || disabled} />
  </View>
);

const styles = StyleSheet.create({
  container: { gap: 12 },
  lanIpActions: { flexDirection: 'row', gap: 8 },
});
```

`SegmentedButtons` from `react-native-paper` has no native `disabled` prop as a whole block in this codebase's installed version — leave `onConnectionTypeChange` callable but note it is effectively moot once `drivers.length > 0`, since `AddPrinterModal` will simply ignore/no-op connection-type changes at that point rather than fighting the library (see Step 2 `onConnectionTypeChange` implementation, which early-returns when `drivers.length > 0`).

- [ ] **Step 2: Rewrite `StatusPanel.tsx`**

```tsx
// src/features/printer/components/StatusPanel.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, SegmentedButtons } from 'react-native-paper';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import type { PrinterDeviceInfo, PrinterDriverType } from '../types/printer.types';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
export type ProtocolState = 'idle' | 'detecting' | 'identified' | 'unknown';

export interface StatusPanelProps {
  connectionState: ConnectionState;
  protocolState: ProtocolState;
  protocol?: PrinterDriverType;
  deviceInfo?: PrinterDeviceInfo;
  errorMessage?: string;
  /** Chỉ hiện lựa chọn thủ công cho driver type CHƯA có trong printer đang thêm/sửa (spec §5.1). */
  excludedDrivers: PrinterDriverType[];
  onChooseProtocol: (protocol: PrinterDriverType) => void;
}

const protocolLabel: Record<PrinterDriverType, string> = {
  escpos: 'ESC/POS',
  tspl: 'TSPL',
};

const ALL_PROTOCOLS: PrinterDriverType[] = ['escpos', 'tspl'];

export const StatusPanel: React.FC<StatusPanelProps> = ({
  connectionState,
  protocolState,
  protocol,
  deviceInfo,
  errorMessage,
  excludedDrivers,
  onChooseProtocol,
}) => {
  if (protocolState === 'unknown') {
    const choices = ALL_PROTOCOLS.filter((type) => !excludedDrivers.includes(type)).map((type) => ({ value: type, label: protocolLabel[type] }));
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium">Không thể tự nhận diện giao thức. Vui lòng chọn thủ công:</Text>
        <SegmentedButtons value="" onValueChange={(value) => onChooseProtocol(value as PrinterDriverType)} buttons={choices} />
      </View>
    );
  }

  if (connectionState === 'error') {
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium" style={styles.errorText}>{errorMessage ?? 'Kết nối thất bại.'}</Text>
      </View>
    );
  }

  if (connectionState === 'connecting' && protocolState === 'detecting') {
    return (
      <View style={styles.container}>
        <LoadingOverlay />
        <Text variant="bodyMedium">Đang nhận diện giao thức...</Text>
      </View>
    );
  }

  if (connectionState === 'connecting') {
    return (
      <View style={styles.container}>
        <LoadingOverlay />
        <Text variant="bodyMedium">Đang kết nối...</Text>
      </View>
    );
  }

  if (connectionState === 'connected' && protocolState === 'identified') {
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium" style={styles.successText}>✓ Đã kết nối</Text>
        {deviceInfo?.vendor ? <Text variant="bodySmall">Hãng sản xuất: {deviceInfo.vendor}</Text> : null}
        {deviceInfo?.model ? <Text variant="bodySmall">Model: {deviceInfo.model}</Text> : null}
        {protocol ? <Text variant="bodySmall">Giao thức: {protocolLabel[protocol]}</Text> : null}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  errorText: { color: '#B91C1C' },
  successText: { color: '#15803D' },
});
```

- [ ] **Step 3: Rewrite `AddPrinterModal.tsx`**

```tsx
// src/features/printer/components/AddPrinterModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Modal, Portal, Snackbar, Text } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrinterService } from '../printing/PrinterService';
import { getCurrentWifiIp } from '../services/NetworkInfoService';
import { buildSampleReceiptDocument, buildSampleLabelDocument } from '../utils/sampleDocuments';
import { useBillImageCapture } from '../hooks/useBillImageCapture';
import { generateId } from '../../../utils/id';
import { resolveIdentityKey } from '../discovery/PrinterResolver';
import { getDriverDefinition } from '../definitions/PrinterDriverDefinitions';
import {
  lanConnectionSchema,
  printerDisplaySchema,
  type LanConnectionValues,
  type PrinterDisplayValues,
} from '../schemas/printerFormSchema';
import { ConnectionSection } from './ConnectionSection';
import { StatusPanel, type ConnectionState, type ProtocolState } from './StatusPanel';
import { PrinterInfoCard } from './PrinterInfoCard';
import type { DiscoveryEvent } from '../discovery/PrinterDiscoveryService';
import { AppErrorException } from '../types/AppError';
import type { PrintDocumentVariants } from '../types/driver.types';
import type { PrintType } from '../types/printConfiguration.types';
import type {
  ConnectionType,
  Printer,
  PrinterDevice,
  PrinterDeviceInfo,
  PrinterDriver,
  PrinterDriverType,
  PrinterStatus,
} from '../types/printer.types';

export interface AddPrinterModalProps {
  visible: boolean;
  initialValues?: Printer;
  onDismiss: () => void;
  onSaved: () => void;
}

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved }) => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [connectionType, setConnectionType] = useState<ConnectionType>(initialValues?.connectionType ?? 'usb');
  const [selectedDevice, setSelectedDevice] = useState<PrinterDevice | undefined>(initialValues?.device);
  const [autoReconnect, setAutoReconnect] = useState(initialValues?.autoReconnect ?? true);
  const [drivers, setDrivers] = useState<PrinterDriver[]>(initialValues?.drivers ?? []);
  const [testPrintReceiptPending, setTestPrintReceiptPending] = useState(false);
  const [testPrintLabelPending, setTestPrintLabelPending] = useState(false);
  const [testPrintErrorMessage, setTestPrintErrorMessage] = useState<string | null>(null);
  const { captureNode, captureBillImage } = useBillImageCapture();
  const [liveStatus, setLiveStatus] = useState<PrinterStatus>('idle');
  const [connectionDirty, setConnectionDirty] = useState(!initialValues);

  const [connectionState, setConnectionState] = useState<ConnectionState>(initialValues ? 'connected' : 'idle');
  const [protocolState, setProtocolState] = useState<ProtocolState>(initialValues ? 'identified' : 'idle');
  const [lastProtocol, setLastProtocol] = useState<PrinterDriverType | undefined>(initialValues?.drivers[0]?.type);
  const [deviceInfo, setDeviceInfo] = useState<PrinterDeviceInfo | undefined>(undefined);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | undefined>(undefined);
  const [identityErrorMessage, setIdentityErrorMessage] = useState<string | undefined>(undefined);
  const [detectedLanIp, setDetectedLanIp] = useState<string | null>(null);
  const [lanIpFetchError, setLanIpFetchError] = useState<string | undefined>(undefined);

  const discoveryUnsubscribeRef = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const connectionRef = useRef<{ connectionState: ConnectionState; drivers: PrinterDriver[] }>({
    connectionState: initialValues ? 'connected' : 'idle',
    drivers: initialValues?.drivers ?? [],
  });

  const lanForm = useForm<LanConnectionValues>({
    resolver: zodResolver(lanConnectionSchema),
    defaultValues: {
      lanIp: initialValues?.lan?.ip ?? '',
      lanPort: initialValues?.lan?.port ? String(initialValues.lan.port) : '',
    },
  });

  const displayForm = useForm<PrinterDisplayValues>({
    resolver: zodResolver(printerDisplaySchema),
    defaultValues: {
      name: initialValues?.name ?? '',
      paperSize: initialValues?.paperSize ?? 80,
    },
  });

  useEffect(() => {
    connectionRef.current = { connectionState, drivers };
  }, [connectionState, drivers]);

  useEffect(() => {
    const activeDriver = drivers[0];
    if (protocolState !== 'identified' || !activeDriver) {
      setLiveStatus('idle');
      return undefined;
    }
    setLiveStatus(PrinterService.getStatusForDriver(activeDriver.type, printerId));
    const unsubscribes = drivers.map((d) => PrinterService.onStatusChangeForDriver(d.type, printerId, setLiveStatus));
    return () => unsubscribes.forEach((unsub) => unsub());
  }, [protocolState, drivers, printerId]);

  useEffect(() => {
    if (!visible) {
      discoveryUnsubscribeRef.current?.();
      discoveryUnsubscribeRef.current = null;
      const current = connectionRef.current;
      if (current.connectionState === 'connected' && !savedRef.current) {
        current.drivers.forEach((d) => {
          PrinterService.disconnectForDriver(d.type, printerId).catch(() => undefined);
        });
      }
    }
    return () => {
      discoveryUnsubscribeRef.current?.();
    };
  }, [visible, printerId]);

  const buildLan = (values: LanConnectionValues) => ({ ip: values.lanIp, port: Number(values.lanPort) });

  /** Đủ thông tin để tính identityKey (không cần biết protocol) — xem `resolveIdentityKey`. */
  const currentIdentityKey = (): string | null => {
    try {
      if (connectionType === 'lan') {
        const values = lanForm.getValues();
        if (!lanConnectionSchema.safeParse(values).success) return null;
        return resolveIdentityKey({ connectionType, lan: buildLan(values) });
      }
      if (!selectedDevice) return null;
      return resolveIdentityKey({ connectionType, device: selectedDevice });
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const key = currentIdentityKey();
    if (!key) {
      setIdentityErrorMessage(undefined);
      return;
    }
    const collision = PrinterService.getPrinters().find((p) => p.id !== printerId && p.identityKey === key);
    setIdentityErrorMessage(
      collision ? `Máy in này đã được thêm với tên "${collision.name}" — dùng "+ Thêm driver" trên máy in đó thay vì thêm mới.` : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy lại khi connectionType/selectedDevice/lan form thay đổi, đọc qua currentIdentityKey() ở trên
  }, [connectionType, selectedDevice, lanForm.watch('lanIp'), lanForm.watch('lanPort')]);

  const resetDiscoveryFields = (nextConnectionState: ConnectionState): void => {
    setConnectionState(nextConnectionState);
    setProtocolState('idle');
    setDeviceInfo(undefined);
    setConnectionErrorMessage(undefined);
    setConnectionDirty(true);
  };

  const resetConnectionResult = (): void => {
    discoveryUnsubscribeRef.current?.();
    discoveryUnsubscribeRef.current = null;
    resetDiscoveryFields('idle');
  };

  /** Thêm driver mới vào `drivers[]` với contentTypes mặc định = mọi type driver này hỗ trợ TRỪ type đã thuộc driver khác (invariant #3). */
  const addDriverToList = (type: PrinterDriverType, source: 'auto' | 'manual'): PrinterDriver => {
    const alreadyClaimed = new Set(drivers.flatMap((d) => d.contentTypes));
    const contentTypes = getDriverDefinition(type).contentTypes.filter((ct) => !alreadyClaimed.has(ct));
    const config = type === 'tspl' ? ({ type: 'tspl', renderMode: 'bitmap' } as const) : ({ type: 'escpos' } as const);
    const entry: PrinterDriver = { type, source, contentTypes, config };
    setDrivers((prev) => [...prev, entry]);
    return entry;
  };

  const startDiscovery = (lan?: { ip: string; port: number }): void => {
    resetDiscoveryFields('connecting');
    discoveryUnsubscribeRef.current = PrinterService.discoverDriver(
      {
        printerId,
        connectionType,
        device: connectionType === 'lan' ? undefined : selectedDevice,
        lan,
        excludedDrivers: drivers.map((d) => d.type),
      },
      (event: DiscoveryEvent) => {
        if (event.stage === 'identifying') {
          setProtocolState('detecting');
        } else if (event.stage === 'identified' && event.protocol) {
          setConnectionState('connected');
          setProtocolState('identified');
          setLastProtocol(event.protocol);
          setDeviceInfo(event.deviceInfo);
          setConnectionDirty(false);
          addDriverToList(event.protocol, 'auto');
          if (!displayForm.getValues('name')) {
            displayForm.setValue('name', event.deviceInfo?.deviceName ?? selectedDevice?.displayName ?? 'Máy in mới');
          }
        } else if (event.stage === 'unknown_protocol') {
          setConnectionState('idle');
          setProtocolState('unknown');
        } else if (event.stage === 'error') {
          setConnectionState('error');
          setProtocolState('idle');
          setConnectionErrorMessage(event.error?.message);
        }
      },
    );
  };

  const onConnectPress = (): void => {
    if (connectionType === 'lan') {
      lanForm.handleSubmit((values) => startDiscovery(buildLan(values)))();
    } else {
      startDiscovery(undefined);
    }
  };

  const buildDraftPrinter = (): Printer => ({
    id: printerId,
    name: displayForm.getValues('name') || 'Máy in mới',
    drivers,
    connectionType,
    device: connectionType === 'lan' ? undefined : selectedDevice,
    lan: connectionType === 'lan' ? buildLan(lanForm.getValues()) : undefined,
    identityKey: currentIdentityKey() ?? '',
    paperSize: displayForm.getValues('paperSize'),
    autoReconnect,
    enabled: initialValues?.enabled ?? true,
    createdAt: initialValues?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const onChooseProtocol = (chosenProtocol: PrinterDriverType): void => {
    setConnectionState('connecting');
    setProtocolState('detecting');
    const draftDriver: PrinterDriver = {
      type: chosenProtocol,
      source: 'manual',
      contentTypes: [],
      config: chosenProtocol === 'tspl' ? { type: 'tspl', renderMode: 'bitmap' } : { type: 'escpos' },
    };
    const draftPrinter: Printer = { ...buildDraftPrinter(), drivers: [...drivers, draftDriver] };
    PrinterService.connectDraft(draftPrinter, draftDriver)
      .then(() => {
        setConnectionState('connected');
        setProtocolState('identified');
        setLastProtocol(chosenProtocol);
        setDeviceInfo(undefined);
        setConnectionDirty(false);
        addDriverToList(chosenProtocol, 'manual');
      })
      .catch((error: { message: string }) => {
        setConnectionState('error');
        setProtocolState('idle');
        setConnectionErrorMessage(error.message);
      });
  };

  const onConnectionTypeChange = (value: ConnectionType): void => {
    if (drivers.length > 0) return;
    setConnectionType(value);
    setSelectedDevice(undefined);
    if (connectionState !== 'idle' || protocolState !== 'idle') resetConnectionResult();
  };

  const onSelectDevice = (device: PrinterDevice): void => {
    if (drivers.length > 0) return;
    setSelectedDevice(device);
    if (connectionState !== 'idle' || protocolState !== 'idle') resetConnectionResult();
  };

  const onLanIpChange = (text: string): void => {
    if (drivers.length > 0) return;
    lanForm.setValue('lanIp', text);
    if (connectionState !== 'idle' || protocolState !== 'idle') resetConnectionResult();
  };

  const onLanPortChange = (text: string): void => {
    if (drivers.length > 0) return;
    lanForm.setValue('lanPort', text);
    if (connectionState !== 'idle' || protocolState !== 'idle') resetConnectionResult();
  };

  const onFetchLanIp = async (): Promise<void> => {
    setLanIpFetchError(undefined);
    const ip = await getCurrentWifiIp();
    if (!ip) {
      setDetectedLanIp(null);
      setLanIpFetchError('Không lấy được IP — kiểm tra đã kết nối WiFi chưa');
      return;
    }
    setDetectedLanIp(ip);
  };

  const onAutoFillLanIp = (): void => {
    if (!detectedLanIp) return;
    onLanIpChange(detectedLanIp);
  };

  const onUpdateDriverContentTypes = (type: PrinterDriverType, contentTypes: PrintType[]): void => {
    setDrivers((prev) => prev.map((d) => (d.type === type ? { ...d, contentTypes } : d)));
  };

  const resolveTestPrintDocuments = async (driver: PrinterDriver, printer: Printer, document: import('../types/printDocument.types').PrintDocument): Promise<PrintDocumentVariants> => {
    if (driver.type !== 'tspl') return { text: document };
    const base64 = await captureBillImage(document, printer.paperSize);
    if (!base64) return { text: document };
    return { text: document, image: { elements: [{ type: 'image', data: base64, x: 0, y: 0 }] } };
  };

  const runTestPrint = async (
    setPending: (pending: boolean) => void,
    printType: PrintType,
    sampleDocument: import('../types/printDocument.types').PrintDocument,
  ): Promise<void> => {
    const driver = drivers.find((d) => d.contentTypes.includes(printType));
    if (!driver) return;
    const printer = buildDraftPrinter();
    const valid = await displayForm.trigger();
    if (!valid) return;
    setPending(true);
    setTestPrintErrorMessage(null);
    try {
      const documents = await resolveTestPrintDocuments(driver, printer, sampleDocument);
      await PrinterService.testPrint(printer, driver, documents, printType);
    } catch (error) {
      setTestPrintErrorMessage(error instanceof AppErrorException ? error.message : 'In thử thất bại');
    } finally {
      setPending(false);
    }
  };

  const onTestPrintReceipt = (): Promise<void> => runTestPrint(setTestPrintReceiptPending, 'Receipt', buildSampleReceiptDocument());
  const onTestPrintLabel = (): Promise<void> => runTestPrint(setTestPrintLabelPending, 'Label', buildSampleLabelDocument());

  const onSave = displayForm.handleSubmit(() => {
    if (drivers.length === 0) return;
    const printer = buildDraftPrinter();
    savedRef.current = true;
    if (initialValues) PrinterService.updatePrinter(printer);
    else PrinterService.addPrinter(printer);
    if (printer.autoReconnect && liveStatus !== 'connected') {
      PrinterService.connect(printer.id).catch(() => undefined);
    }
    onSaved();
  });

  const connectLabel = connectionState === 'connecting' ? 'Đang kết nối...' : connectionState === 'connected' ? 'Kết nối lại' : 'Kết nối';
  const connectDisabled =
    connectionState === 'connecting' ||
    (connectionType !== 'lan' && !selectedDevice) ||
    drivers.length >= 2 ||
    Boolean(identityErrorMessage);

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text variant="titleMedium">{initialValues ? 'Chỉnh sửa máy in' : 'Thêm máy in'}</Text>

          <ConnectionSection
            connectionType={connectionType}
            onConnectionTypeChange={onConnectionTypeChange}
            selectedDeviceId={selectedDevice?.deviceId}
            onSelectDevice={onSelectDevice}
            lanIp={lanForm.watch('lanIp')}
            lanPort={lanForm.watch('lanPort')}
            onLanIpChange={onLanIpChange}
            onLanPortChange={onLanPortChange}
            detectedLanIp={detectedLanIp}
            lanIpFetchError={lanIpFetchError}
            onFetchLanIp={onFetchLanIp}
            onAutoFillLanIp={onAutoFillLanIp}
            lanIpError={lanForm.formState.errors.lanIp?.message}
            lanPortError={lanForm.formState.errors.lanPort?.message}
            connectLabel={connectLabel}
            connectDisabled={connectDisabled}
            onConnectPress={onConnectPress}
            disabled={drivers.length > 0}
          />
          {identityErrorMessage ? <Text style={styles.identityError}>{identityErrorMessage}</Text> : null}

          <StatusPanel
            connectionState={connectionState}
            protocolState={protocolState}
            protocol={lastProtocol}
            deviceInfo={deviceInfo}
            errorMessage={connectionErrorMessage}
            excludedDrivers={drivers.map((d) => d.type)}
            onChooseProtocol={onChooseProtocol}
          />

          {drivers.length > 0 && drivers.length < 2 ? (
            <Text variant="bodySmall" style={styles.addDriverHint}>Máy in này còn hỗ trợ thêm driver khác — bấm "Kết nối" để dò tiếp.</Text>
          ) : null}

          <PrinterInfoCard
            control={displayForm.control}
            errors={displayForm.formState.errors}
            connectionType={connectionType}
            drivers={drivers}
            onUpdateDriverContentTypes={onUpdateDriverContentTypes}
            deviceInfo={deviceInfo}
            status={liveStatus}
            autoReconnect={autoReconnect}
            onAutoReconnectChange={setAutoReconnect}
            testPrintReceiptPending={testPrintReceiptPending}
            onTestPrintReceipt={onTestPrintReceipt}
            testPrintLabelPending={testPrintLabelPending}
            onTestPrintLabel={onTestPrintLabel}
            onSave={onSave}
            saveDisabled={drivers.length === 0 || connectionDirty}
            locked={drivers.length === 0}
          />
          {captureNode}
        </ScrollView>
        <Snackbar visible={testPrintErrorMessage !== null} onDismiss={() => setTestPrintErrorMessage(null)} duration={5000}>
          {testPrintErrorMessage}
        </Snackbar>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, maxHeight: '85%' },
  scrollContent: { gap: 12 },
  identityError: { color: '#B91C1C' },
  addDriverHint: { color: '#6B7280' },
});
```

- [ ] **Step 4: Type-check + lint**

Run: `npm run type-check && npm run lint`
Expected: PASS (0 errors) — this is the first point in the plan where the WHOLE repo type-checks, since `PrinterInfoCard.tsx` (Task 23) still has its old props at this point. **Do not run this step until Task 23 is also done** — implement Tasks 22 and 23 together before type-checking, or expect type errors on `PrinterInfoCard` usage until then.

- [ ] **Step 5: Manual verification on device/emulator**

Per `CLAUDE.md`, this component has no dedicated test file — verify by running the app (`npm run android` or `npm start` + reload) and walking through: Add Printer → USB/LAN connect → driver identified → content type checkboxes appear in `PrinterInfoCard` → "+ Thêm driver khác" appears and works for a second driver on the same physical printer → identity duplicate check blocks adding the same printer twice → Save persists and the printer appears in the list.

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/components/AddPrinterModal.tsx src/features/printer/components/StatusPanel.tsx src/features/printer/components/ConnectionSection.tsx
git commit -m "feat(printer): AddPrinterModal supports adding a second driver to an existing printer"
```

---

### Task 23: `PrinterInfoCard.tsx` — driver cards with content-type checkboxes

**Files:**
- Modify: `src/features/printer/components/PrinterInfoCard.tsx` (full rewrite)

**Interfaces:**
- Consumes: `PrinterDriver`, `PrinterDriverType`, `ConnectionType`, `PrinterDeviceInfo`, `PrinterStatus` (Task 1); `PrintType` (`printConfiguration.types.ts`, unchanged); `getDriverDefinition` (Task 4); `PrinterDisplayValues` (Task 7).
- Consumed by: `components/AddPrinterModal.tsx` (Task 22, already wired to the new prop names `drivers`/`onUpdateDriverContentTypes`).

Per spec §5.1 step 5: each content-type checkbox is disabled when that type is already claimed by a DIFFERENT driver on the same printer (invariant #3 — the real enforcement is the Zod schema at save time, Task 7; this is just the UI reflecting it so the user never gets to a rejected Save).

- [ ] **Step 1: Replace the file**

```tsx
// src/features/printer/components/PrinterInfoCard.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { AppInput } from '../../../components/AppInput';
import { AppSelect } from '../../../components/AppSelect';
import { AppSwitch } from '../../../components/AppSwitch';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import { getDriverDefinition } from '../definitions/PrinterDriverDefinitions';
import type { PrinterDisplayValues } from '../schemas/printerFormSchema';
import type { PrintType } from '../types/printConfiguration.types';
import type { ConnectionType, PrinterDeviceInfo, PrinterDriver, PrinterDriverType, PrinterStatus } from '../types/printer.types';

const connectionLabel: Record<ConnectionType, string> = {
  usb: 'USB',
  bluetooth: 'Bluetooth',
  lan: 'LAN',
};

const protocolLabel: Record<PrinterDriverType, string> = {
  escpos: 'ESC/POS',
  tspl: 'TSPL',
};

const contentTypeLabel: Record<PrintType, string> = {
  Receipt: 'In Hoá đơn',
  Label: 'In Tem',
};

export interface PrinterInfoCardProps {
  control: Control<PrinterDisplayValues>;
  errors: FieldErrors<PrinterDisplayValues>;
  connectionType: ConnectionType;
  drivers: PrinterDriver[];
  onUpdateDriverContentTypes: (type: PrinterDriverType, contentTypes: PrintType[]) => void;
  deviceInfo?: PrinterDeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  testPrintReceiptPending: boolean;
  onTestPrintReceipt: () => void;
  testPrintLabelPending: boolean;
  onTestPrintLabel: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  locked: boolean;
}

export const PrinterInfoCard: React.FC<PrinterInfoCardProps> = ({
  control,
  errors,
  connectionType,
  drivers,
  onUpdateDriverContentTypes,
  deviceInfo,
  status,
  autoReconnect,
  onAutoReconnectChange,
  testPrintReceiptPending,
  onTestPrintReceipt,
  testPrintLabelPending,
  onTestPrintLabel,
  onSave,
  saveDisabled,
  locked,
}) => {
  const claimedElsewhere = (type: PrinterDriverType, contentType: PrintType): boolean =>
    drivers.some((d) => d.type !== type && d.contentTypes.includes(contentType));

  const toggleContentType = (driver: PrinterDriver, contentType: PrintType, value: boolean): void => {
    const next = value ? [...driver.contentTypes, contentType] : driver.contentTypes.filter((ct) => ct !== contentType);
    onUpdateDriverContentTypes(driver.type, next);
  };

  const canPrint = (contentType: PrintType): boolean => drivers.some((d) => d.contentTypes.includes(contentType));

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <AppInput label="Tên hiển thị" value={field.value} onChangeText={field.onChange} errorMessage={errors.name?.message} disabled={locked} />
        )}
      />

      {deviceInfo?.deviceName ? <Text variant="bodySmall">Tên thiết bị: {deviceInfo.deviceName}</Text> : null}
      {deviceInfo?.vendor ? <Text variant="bodySmall">Hãng sản xuất: {deviceInfo.vendor}</Text> : null}
      {deviceInfo?.model ? <Text variant="bodySmall">Model: {deviceInfo.model}</Text> : null}
      <View style={styles.row}>
        <Text variant="bodySmall">Loại kết nối: {connectionLabel[connectionType]}</Text>
        <PrinterStatusBadge status={status} />
      </View>

      <Controller
        control={control}
        name="paperSize"
        render={({ field }) => (
          <AppSelect
            label="Khổ giấy"
            value={String(field.value)}
            onSelect={(value) => field.onChange(Number(value))}
            options={[
              { label: '58mm', value: '58' },
              { label: '80mm', value: '80' },
            ]}
            disabled={locked}
          />
        )}
      />

      <AppSwitch label="Tự động kết nối lại" value={autoReconnect} onValueChange={onAutoReconnectChange} disabled={locked} />

      {drivers.map((driver) => (
        <View key={driver.type} style={styles.driverCard}>
          <View style={styles.row}>
            <Chip>{`Driver: ${protocolLabel[driver.type]}`}</Chip>
            <Chip>{driver.source === 'auto' ? 'Tự động nhận diện' : 'Người dùng chọn'}</Chip>
          </View>
          {getDriverDefinition(driver.type).contentTypes.map((contentType) => (
            <AppSwitch
              key={contentType}
              label={contentTypeLabel[contentType]}
              value={driver.contentTypes.includes(contentType)}
              onValueChange={(value) => toggleContentType(driver, contentType, value)}
              disabled={locked || (!driver.contentTypes.includes(contentType) && claimedElsewhere(driver.type, contentType))}
            />
          ))}
          {driver.type === 'tspl' ? <Text variant="bodySmall" style={styles.renderModeLabel}>Chế độ render: Bitmap</Text> : null}
        </View>
      ))}

      <View style={styles.testPrintRow}>
        <AppButton
          label="In bill thử"
          mode="outlined"
          style={styles.testPrintButton}
          disabled={status !== 'connected' || !canPrint('Receipt') || testPrintReceiptPending}
          loading={testPrintReceiptPending}
          onPress={onTestPrintReceipt}
        />
        <AppButton
          label="In tem thử"
          mode="outlined"
          style={styles.testPrintButton}
          disabled={status !== 'connected' || !canPrint('Label') || testPrintLabelPending}
          loading={testPrintLabelPending}
          onPress={onTestPrintLabel}
        />
      </View>
      <AppButton label="Lưu máy in" disabled={saveDisabled} onPress={onSave} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  driverCard: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  renderModeLabel: { color: '#6B7280' },
  testPrintRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  testPrintButton: { flex: 1 },
});
```

- [ ] **Step 2: Type-check + lint the whole repo**

Run: `npm run type-check && npm run lint`
Expected: PASS (0 errors) — this is the first point where the whole repo should type-check cleanly, since every module touched by this refactor has now landed. Fix any remaining type errors before continuing (most likely leftover `PrinterConfig`/`Protocol` references this plan's mechanical-rename instructions missed in a test file).

- [ ] **Step 3: Manual verification**

Run the app, open "Thêm máy in", confirm: checkbox for a content type disables itself (greyed out) when that type is already assigned to the OTHER driver once 2 drivers exist on the same printer; TSPL driver card shows the static "Chế độ render: Bitmap" line with no toggle.

- [ ] **Step 4: Commit**

```bash
git add src/features/printer/components/PrinterInfoCard.tsx
git commit -m "feat(printer): PrinterInfoCard shows one card per driver with content-type checkboxes"
```

---

### Task 24: `PrinterListItem.tsx` + `PrinterList.tsx` + `DeviceScanList.tsx` — renamed fields, remove "Đặt mặc định"

**Files:**
- Modify: `src/features/printer/components/PrinterListItem.tsx`
- Modify: `src/features/printer/components/PrinterList.tsx`
- Modify: `src/features/printer/components/DeviceScanList.tsx` (import path only)

**Interfaces:**
- Consumes: `Printer` (Task 1), `PrinterService` (Task 17 — `getStatus`, `connect`, `disconnect`, `reconnect`, `removePrinter`, `setEnabled`; `setDefault`/`getDefaultPrinterId` no longer exist, removed).

- [ ] **Step 1: Update `DeviceScanList.tsx` import path**

```ts
// before
import { PrinterService } from '../services/PrinterService';
// after
import { PrinterService } from '../printing/PrinterService';
```

No other change — this component never referenced `protocol`/`printerName`/`isDefault`.

- [ ] **Step 2: Update `PrinterList.tsx`**

```tsx
// src/features/printer/components/PrinterList.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../../../components/EmptyState';
import { PrinterListItem } from './PrinterListItem';
import type { Printer } from '../types/printer.types';

export interface PrinterListProps {
  printers: Printer[];
  onEdit: (printer: Printer) => void;
  onChanged: () => void;
}

export const PrinterList: React.FC<PrinterListProps> = ({ printers, onEdit, onChanged }) => {
  if (printers.length === 0) return <EmptyState message="Chưa có máy in nào được thêm" />;
  return (
    <View style={styles.container}>
      {printers.map((printer) => (
        <PrinterListItem key={printer.id} printer={printer} onEdit={onEdit} onChanged={onChanged} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
});
```

- [ ] **Step 3: Update `PrinterListItem.tsx`**

```tsx
// src/features/printer/components/PrinterListItem.tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, Menu } from 'react-native-paper';
import { usePrinterConnection } from '../hooks/usePrinterConnection';
import { PrinterService } from '../printing/PrinterService';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { AppSwitch } from '../../../components/AppSwitch';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import type { Printer } from '../types/printer.types';

export interface PrinterListItemProps {
  printer: Printer;
  onEdit: (printer: Printer) => void;
  onChanged: () => void;
}

const connectionLabel: Record<Printer['connectionType'], string> = {
  usb: 'USB',
  bluetooth: 'Bluetooth',
  lan: 'LAN',
};

export const PrinterListItem: React.FC<PrinterListItemProps> = ({ printer, onEdit, onChanged }) => {
  const status = usePrinterConnection(printer.id);
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  const closeMenu = (): void => setMenuVisible(false);

  const handleDelete = async (): Promise<void> => {
    if (status === 'connected') {
      setConfirmDeleteVisible(true);
      return;
    }
    PrinterService.removePrinter(printer.id);
    onChanged();
  };

  const confirmDelete = async (): Promise<void> => {
    await PrinterService.disconnect(printer.id).catch(() => undefined);
    PrinterService.removePrinter(printer.id);
    setConfirmDeleteVisible(false);
    onChanged();
  };

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{printer.name}</Text>
        <Text style={styles.subtitle}>
          {connectionLabel[printer.connectionType]} · Khổ {printer.paperSize}mm
        </Text>
      </View>
      <PrinterStatusBadge status={status} />
      <AppSwitch
        label=""
        value={printer.enabled ?? true}
        onValueChange={(enabled) => {
          PrinterService.setEnabled(printer.id, enabled);
          onChanged();
        }}
      />
      <Menu visible={menuVisible} onDismiss={closeMenu} anchor={<IconButton icon="dots-vertical" onPress={() => setMenuVisible(true)} />}>
        <Menu.Item title="Kết nối" onPress={() => { closeMenu(); PrinterService.connect(printer.id).catch(() => undefined); }} />
        <Menu.Item title="Ngắt kết nối" onPress={() => { closeMenu(); PrinterService.disconnect(printer.id).catch(() => undefined); }} />
        <Menu.Item title="Kết nối lại" onPress={() => { closeMenu(); PrinterService.reconnect(printer.id).catch(() => undefined); }} />
        <Menu.Item title="Chỉnh sửa" onPress={() => { closeMenu(); onEdit(printer); }} />
        <Menu.Item title="Xóa" onPress={() => { closeMenu(); handleDelete(); }} />
      </Menu>
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="Xóa máy in"
        message={`Máy in "${printer.name}" đang kết nối. Bạn có chắc muốn ngắt kết nối và xóa?`}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  info: { flex: 1 },
  name: { fontSize: 13 },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
```

Note the "Đặt mặc định" `Menu.Item` (and its `PrinterService.setDefault` call) is REMOVED, not ported — `isDefault` no longer exists (spec §4.4), this is an intentional feature removal already verified as unused for real routing (§1).

- [ ] **Step 4: Update `PrinterManagementPanel.tsx`'s type import**

Open `src/features/printer/components/PrinterManagementPanel.tsx` and change:

```ts
// before
import type { PrinterConfig } from '../types/printer.types';
// ...
const [printers, setPrinters] = useState<PrinterConfig[]>(() => PrinterService.getPrinters());
const [editingPrinter, setEditingPrinter] = useState<PrinterConfig | undefined>(undefined);
// ...
import { PrinterService } from '../services/PrinterService';
```

to:

```ts
// after
import type { Printer } from '../types/printer.types';
// ...
const [printers, setPrinters] = useState<Printer[]>(() => PrinterService.getPrinters());
const [editingPrinter, setEditingPrinter] = useState<Printer | undefined>(undefined);
// ...
import { PrinterService } from '../printing/PrinterService';
```

- [ ] **Step 5: Full repo verification**

Run: `npm run verify` (type-check + lint + test, per this repo's own pre-commit convention)
Expected: PASS with 0 errors — this is the final gate for the whole refactor. If anything fails, it is almost certainly a leftover import of a moved/renamed module (`services/PrinterService`, `services/PrintService`, `types/printer.types`'s `PrinterConfig`/`Protocol`/`ProtocolSource`) — grep the repo for these three strings to find stragglers:

```bash
grep -rn "PrinterConfig\|from '.*services/PrinterService'\|from '.*services/PrintService'" src/ App.tsx
```

- [ ] **Step 6: Manual verification on device/emulator**

Run the app, open Application → Quản lý máy in: confirm the printer list renders (name, connection type, paper size in mm), the enable/disable switch works, the menu has no "Đặt mặc định" item, "Xóa" still confirms before deleting a connected printer.

- [ ] **Step 7: Commit**

```bash
git add src/features/printer/components/PrinterListItem.tsx src/features/printer/components/PrinterList.tsx src/features/printer/components/DeviceScanList.tsx src/features/printer/components/PrinterManagementPanel.tsx
git commit -m "refactor(printer): PrinterListItem/PrinterList use Printer model, remove isDefault menu action"
```

---

## Final checklist (after Task 24)

- [ ] `npm run verify` passes with zero errors/warnings introduced by this refactor.
- [ ] Every file under `src/features/printer/services/` that is not `PrinterLogger.ts`, `PrinterPermissionService.ts`, or `NetworkInfoService.ts` has been deleted (moved elsewhere).
- [ ] `src/features/printer/protocols/` no longer exists (moved into `drivers/tspl/`).
- [ ] No file in the repo imports `PrinterConfig`, `Protocol`, or `ProtocolSource` from `types/printer.types` (all renamed to `Printer`, `PrinterDriverType`, `DriverSource`).
- [ ] Manually add a real USB or LAN printer end-to-end on a device/emulator, confirm it survives app restart (except right after this refactor ships, where the destructive reset intentionally wipes any pre-existing printer list — document this for whoever tests the release).
- [ ] Manually verify "+ Thêm driver khác" against a real printer if one that speaks both ESC/POS and TSPL is available; otherwise this path is only exercised by the mocked driver tests in Task 14/17.

