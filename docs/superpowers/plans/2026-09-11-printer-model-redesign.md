# Printer Model Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ tính năng font TrueType/internal-font của TSPL, và tái cấu trúc `Printer` từ "1 máy in mang 1-2 driver, mỗi driver tự giữ contentTypes+media" thành "1 `Printer` = 1 cấu hình in atomic cho đúng 1 `PrintType`, đúng 1 connection, đúng 1 driver, đúng 1 cấu hình giấy".

**Architecture:** Xem đầy đủ ở spec. Tóm tắt: `Printer.driver`/`Printer.connection`/`Printer.paper`/`Printer.type` đều là số ít (không còn mảng). `identityKey` vẫn tính từ `connection` nhưng ràng buộc unique đổi thành cặp `(identityKey, type)`. Toàn bộ enum trong feature (trừ `PrinterErrorCode`) chuyển sang PascalCase value. `IPrinterDriver` bỏ tham số `driver`/`printType` rời rạc trên `connect`/`print`/`testPrint` — driver tự đọc từ `printer.driver`/`printer.type`.

**Tech Stack:** React Native CLI + TypeScript strict, Zod, Jest.

**Spec:** `docs/superpowers/specs/2026-09-11-printer-model-redesign-design.md`

## Global Constraints

- Toàn bộ enum value trong `src/features/printer/` chuyển PascalCase, TRỪ `PrinterErrorCode` (giữ SCREAMING_SNAKE_CASE).
- `Printer` không còn `drivers[]`/`connections[]`/`contentTypes[]` — mỗi field là số ít: `driver: PrinterDriver`, `connection: PrinterConnection`, `paper: PrintPaperConfig`, `type: PrintType`.
- `IPrinterDriver.connect(printer)` — bỏ tham số `driver` rời (driver tự đọc `printer.driver`). `print`/`testPrint` bỏ tham số `printType` rời (đọc từ `printer.type`/context đã lưu).
- Tính năng TrueType/internal-font TSPL bị xoá HOÀN TOÀN: `TsplFontConfig`, `TsplInternalFontConfig`, `TsplCodepage`, `TsplTrueTypeStrategy`, `TsplInternalFontStrategy`, `TsplFontManager`, `TsplStrategyRegistry`, `utils/cp1258.ts`, error code `TSPL_FONT_NOT_INSTALLED`/`TSPL_FONT_INSTALL_FAILED`/`TSPL_FONT_INVALID`. TSPL chỉ còn `RenderMode.Bitmap`.
- `PrinterStorage.CURRENT_STORAGE_VERSION` bump — reset phá huỷ, KHÔNG migrate (convention đã có, xem `PrinterStorage.ts`).
- Sau MỖI task: chạy `npx tsc --noEmit -p .` và test suite liên quan tới khi xanh, trước khi sang task kế.
- Không thêm field `encoder`/`PrintEncoder` — ngoài phạm vi (xem spec §7).
- KHÔNG tạo lại migration/backward-compat shim cho shape cũ — reset storage theo đúng convention.

---

## Task 1: Model kết nối — gộp `ConnectionType` vào `PrinterConnectionType`, PascalCase

**Files:**
- Modify: `src/features/printer/models/printer/PrinterConnection.ts`
- Modify: `src/features/printer/models/printer/PrinterDevice.ts`
- Modify (rename `ConnectionType` → `PrinterConnectionType`, import từ `PrinterConnection` thay vì `PrinterDevice`, giá trị `usb/bluetooth/lan` → `Usb/Bluetooth/Lan`, `DeviceScanEventType` giá trị `loading/found/empty/error` → `Loading/Found/Empty/Error`): mọi file liệt kê ở bước 3.

**Interfaces:**
- Produces: `PrinterConnectionType = { Usb: 'Usb', Bluetooth: 'Bluetooth', Lan: 'Lan' }`, `PrinterConnection` (discriminated union giữ nguyên field), `DeviceScanEventType = { Loading, Found, Empty, Error }`.

- [ ] **Step 1: Viết lại `PrinterConnection.ts`**

```ts
/**
 * Thông tin kết nối đã lưu của 1 `Printer` — khác `PrinterDevice`
 * (PrinterDevice.ts) là kết quả scan tạm thời. Discriminated union theo
 * `type` để loại trừ trạng thái vô nghĩa (vd `Usb` thiếu `vendorId`) ở
 * compile-time thay vì validate tay.
 */
export const PrinterConnectionType = {
  Usb: 'Usb',
  Bluetooth: 'Bluetooth',
  Lan: 'Lan',
} as const;

export type PrinterConnectionType = (typeof PrinterConnectionType)[keyof typeof PrinterConnectionType];

export interface UsbPrinterConnection {
  type: typeof PrinterConnectionType.Usb;
  vendorId: number;
  productId: number;
  /** Cần quyền USB Android 10+ — có thể chưa có lúc scan lần đầu, xem `PrinterResolver`. */
  serialNumber?: string;
}

export interface BluetoothPrinterConnection {
  type: typeof PrinterConnectionType.Bluetooth;
  deviceId: string;
  /** Tên hiển thị lúc scan — chỉ để tham khảo, KHÔNG dùng cho identity/resource key. */
  name?: string;
}

export interface LanPrinterConnection {
  type: typeof PrinterConnectionType.Lan;
  host: string;
  port: number;
}

export type PrinterConnection =
  | UsbPrinterConnection
  | BluetoothPrinterConnection
  | LanPrinterConnection;
```

- [ ] **Step 2: Viết lại `PrinterDevice.ts`** (bỏ `ConnectionType` — đã chuyển sang `PrinterConnection.ts`)

```ts
import type { PrinterError } from '../../errors/PrinterError';

/** 2 giai đoạn của 1 máy in: scan (`PrinterDevice`) → identify sau khi connect (`PrinterDeviceInfo`). Kết nối đã lưu xem `PrinterConnection.ts`. */

/** 1 kết quả scan — thiết bị user có thể chọn, chưa connect, chưa lưu. */
export interface PrinterDevice {
  /** usb: `"<vendorId>:<productId>"`; bluetooth: MAC address. */
  deviceId: string;
  displayName: string;
  /** Payload gốc từ native — cast sang `UsbRawDevice` khi biết chắc là usb. */
  rawDevice: Record<string, unknown>;
}

/**
 * Hình dạng `PrinterDevice.rawDevice` khi `connectionType === PrinterConnectionType.Usb` — khớp
 * `PrinterInfoDto` từ native (`vendorId`/`productId` luôn có; `serialNumber`
 * cần quyền USB Android 10+, có thể null lúc scan lần đầu).
 */
export interface UsbRawDevice {
  vendorId: number;
  productId: number;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
}

/** Kết quả `IPrinterDriver.identify()` sau khi connect — chỉ để hiển thị xác nhận, không dùng để lưu. */
export interface PrinterDeviceInfo {
  deviceName?: string;
  vendor?: string;
  model?: string;
}

export const DeviceScanEventType = { Loading: 'Loading', Found: 'Found', Empty: 'Empty', Error: 'Error' } as const;
export type DeviceScanEventType = (typeof DeviceScanEventType)[keyof typeof DeviceScanEventType];
export interface DeviceScanEvent {
  type: DeviceScanEventType;
  devices?: PrinterDevice[];
  error?: PrinterError;
}
```

- [ ] **Step 3: Rename `ConnectionType` → `PrinterConnectionType` (import từ `PrinterConnection`) + PascalCase giá trị ở MỌI file sau**

Áp dụng đúng 3 phép thế cho từng file: (a) đổi import `import { ConnectionType } from '.../PrinterDevice'` (hoặc đường dẫn tương đối tương ứng) thành `import { PrinterConnectionType } from '.../PrinterConnection'`; (b) đổi mọi `ConnectionType` → `PrinterConnectionType`; (c) đổi mọi `.usb`/`.bluetooth`/`.lan` sau `PrinterConnectionType` thành `.Usb`/`.Bluetooth`/`.Lan`. Danh sách file (đường dẫn tương đối `src/features/printer/`):

`discovery/PrinterResolver.ts`, `discovery/PrinterDiscoveryService.ts`, `discovery/DeviceScanService.ts`, `discovery/NetworkInfoService.ts` (nếu có tham chiếu), `connection/PrinterConnectionLock.ts`, `connection/PrinterConnectionService.ts`, `adapters/IPrinterAdapter.ts`, `adapters/native/NativeAdapter.ts`, `adapters/native/PrinterNativeModule.ts`, `adapters/library/LibraryAdapter.ts`, `adapters/resolvePrinterAdapter.ts`, `adapters/testing/MockPrinterAdapter.ts`, `drivers/IPrinterDriver.ts`, `drivers/escpos/EscPosDriver.ts`, `drivers/tspl/TsplDriver.ts`, `drivers/DriverCapabilities.ts` (chỉ nếu có tham chiếu), `forms/addPrinter/PrinterSchema.ts`, `hooks/useAddPrinterFlow.ts`, `hooks/addPrinter/useConnectionSetup.ts`, `hooks/addPrinter/useProtocolDiscovery.ts`, `components/ConnectionSection.tsx`, `components/PrinterInfoCard.tsx`, `components/PrinterListItem.tsx`, `testing/printerFixtures.ts`, `testing/printerServiceTestKit.ts`.

Với mỗi file test `__tests__/*.test.ts(x)` tương ứng của các file trên (cùng thư mục con `__tests__/`) — áp dụng đúng 3 phép thế trên vào phần fixture/mock của test đó.

Component `ConnectionSection.tsx` có bảng `buttons={[{ value: ConnectionType.usb, ... }]}` — đổi `value` tương ứng sang `PrinterConnectionType.Usb` v.v., JSX còn lại giữ nguyên.

`PrinterInfoCard.tsx` có `connectionLabel: Record<ConnectionType, string> = { usb: 'USB', bluetooth: 'Bluetooth', lan: 'LAN' }` — đổi key sang `Usb`/`Bluetooth`/`Lan`, type đổi sang `Record<PrinterConnectionType, string>`, import từ `PrinterConnection`.

`PrinterListItem.tsx` có `connectionLabel: Record<Printer['connection']['type'], string> = { usb: ..., bluetooth: ..., lan: ... }` — đổi key tương tự.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p .`
Expected: Lỗi còn lại (nếu có) chỉ liên quan tới các task khác chưa làm (`PrinterDriverType`, `Printer.driver` số ít...) — không còn lỗi nào nhắc tới `ConnectionType` hay giá trị `usb`/`bluetooth`/`lan` viết thường trong ngữ cảnh `PrinterConnectionType`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(printer): merge ConnectionType into PrinterConnectionType, PascalCase"
```

---

## Task 2: Model driver — PascalCase `PrinterDriverType`/`DriverSource`, gộp `PrinterDriverConfig`, bỏ TTF/internalfont

**Files:**
- Modify: `src/features/printer/models/printer/PrinterDriver.ts`

**Interfaces:**
- Consumes: (không phụ thuộc task khác)
- Produces: `PrinterDriverType = { EscPos, Tspl }`, `DriverSource = { Auto, Manual }`, `RenderMode = { Encoder, Bitmap }`, `PrinterDriverConfig { renderMode: RenderMode }` (dùng chung, không còn `TsplDriverConfig`/`EscPosDriverConfig` riêng), `PrinterDriver { type, source, config }`.

- [ ] **Step 1: Viết lại toàn bộ file**

```ts
export const PrinterDriverType = {
  EscPos: 'EscPos',
  Tspl: 'Tspl',
} as const;

export type PrinterDriverType = (typeof PrinterDriverType)[keyof typeof PrinterDriverType];

export const DriverSource = {
  Auto: 'Auto',
  Manual: 'Manual',
} as const;

export type DriverSource = (typeof DriverSource)[keyof typeof DriverSource];

/**
 * Chiến lược render dùng chung cho CẢ 2 protocol. TSPL chỉ còn `Bitmap` (đã
 * bỏ TrueType/internal-font — enforce ở schema, không phải ở type vì cả 2
 * driver dùng chung 1 `PrinterDriverConfig`). ESC/POS chọn `Encoder` hoặc `Bitmap`.
 */
export const RenderMode = {
  /** ESC/POS only — encode trực tiếp qua `EPToolkit` (cần đúng codepage CP1258), không rasterize. */
  Encoder: 'Encoder',
  /** Render nội dung thành ảnh rồi gửi lệnh bitmap của protocol. Chậm hơn `Encoder` nhưng đúng trên mọi máy bất kể codepage. */
  Bitmap: 'Bitmap',
} as const;

export type RenderMode = (typeof RenderMode)[keyof typeof RenderMode];

export interface PrinterDriverConfig {
  renderMode: RenderMode;
}

/** 1 driver (protocol) của 1 `Printer` — mỗi `Printer` có ĐÚNG 1 driver, xem `Printer.ts`. */
export interface PrinterDriver {
  type: PrinterDriverType;
  source: DriverSource;
  config: PrinterDriverConfig;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: Rất nhiều lỗi ở các file tham chiếu `PrinterDriverType.escpos`/`.tspl`, `DriverSource.auto`/`.manual`, `TsplDriverConfig`/`EscPosDriverConfig`/`TsplFontConfig`/`TsplInternalFontConfig`/`TsplCodepage`/`TsplRenderMode`/`EscPosRenderMode`, `driver.contentTypes`, `driver.config.media` — đây là các lỗi MONG ĐỢI, sẽ hết dần khi hoàn thành Task 3 trở đi. Ghi lại danh sách file lỗi vào ledger để đối chiếu cuối task cuối cùng.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(printer): PascalCase PrinterDriverType/DriverSource, unify PrinterDriverConfig, drop TrueType/internal-font types"
```

---

## Task 3: Xoá tính năng TrueType/internal-font TSPL

**Files:**
- Delete: `src/features/printer/drivers/tspl/strategies/TsplTrueTypeStrategy.ts`
- Delete: `src/features/printer/drivers/tspl/strategies/__tests__/TsplTrueTypeStrategy.test.ts`
- Delete: `src/features/printer/drivers/tspl/strategies/TsplInternalFontStrategy.ts`
- Delete: `src/features/printer/drivers/tspl/strategies/__tests__/TsplInternalFontStrategy.test.ts`
- Delete: `src/features/printer/drivers/tspl/TsplFontManager.ts`
- Delete: `src/features/printer/drivers/tspl/__tests__/TsplFontManager.test.ts`
- Delete: `src/features/printer/drivers/tspl/TsplStrategyRegistry.ts`
- Delete: `src/features/printer/drivers/tspl/__tests__/TsplStrategyRegistry.test.ts`
- Delete: `src/features/printer/utils/cp1258.ts`
- Delete: `src/features/printer/utils/__tests__/cp1258.test.ts`
- Modify: `src/features/printer/errors/PrinterError.ts`
- Modify: `src/features/printer/errors/__tests__/PrinterError.test.ts`

**Interfaces:**
- Consumes: Task 2 đã bỏ `TsplFontConfig`/`TsplInternalFontConfig`/`TsplCodepage` khỏi `PrinterDriver.ts` — các file bị xoá ở đây không còn compile được dù giữ lại, nên xoá hẳn.
- Produces: `PrinterErrorCode` không còn `TSPL_FONT_NOT_INSTALLED`/`TSPL_FONT_INSTALL_FAILED`/`TSPL_FONT_INVALID`. Giữ `TSPL_RENDER_MODE_UNSUPPORTED` (vẫn dùng ở `TsplDriver` khi `driver.config.type !== tspl`).

- [ ] **Step 1: Xoá 9 file trên**

```bash
git rm src/features/printer/drivers/tspl/strategies/TsplTrueTypeStrategy.ts \
       src/features/printer/drivers/tspl/strategies/__tests__/TsplTrueTypeStrategy.test.ts \
       src/features/printer/drivers/tspl/strategies/TsplInternalFontStrategy.ts \
       src/features/printer/drivers/tspl/strategies/__tests__/TsplInternalFontStrategy.test.ts \
       src/features/printer/drivers/tspl/TsplFontManager.ts \
       src/features/printer/drivers/tspl/__tests__/TsplFontManager.test.ts \
       src/features/printer/drivers/tspl/TsplStrategyRegistry.ts \
       src/features/printer/drivers/tspl/__tests__/TsplStrategyRegistry.test.ts \
       src/features/printer/utils/cp1258.ts \
       src/features/printer/utils/__tests__/cp1258.test.ts
```

- [ ] **Step 2: Sửa `errors/PrinterError.ts`** — xoá 3 dòng:

```ts
  TSPL_FONT_NOT_INSTALLED: 'TSPL_FONT_NOT_INSTALLED',
  TSPL_FONT_INSTALL_FAILED: 'TSPL_FONT_INSTALL_FAILED',
  TSPL_FONT_INVALID: 'TSPL_FONT_INVALID',
```

Giữ nguyên toàn bộ phần còn lại của file (kể cả `TSPL_RENDER_MODE_UNSUPPORTED`, `TSPL_ELEMENT_UNSUPPORTED`).

- [ ] **Step 3: Sửa `errors/__tests__/PrinterError.test.ts`**

Đọc file hiện tại, xoá mọi test case/assertion tham chiếu `TSPL_FONT_NOT_INSTALLED`/`TSPL_FONT_INSTALL_FAILED`/`TSPL_FONT_INVALID`. Nếu file chỉ là 1 bảng liệt kê toàn bộ `PrinterErrorCode` để assert exhaustive, bớt đúng 3 dòng tương ứng.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p . 2>&1 | grep -i "tspl\|font\|cp1258"`
Expected: Không còn lỗi nào nhắc tới các identifier vừa xoá (còn lỗi khác thuộc task sau thì bỏ qua ở bước này).

Run: `npx jest src/features/printer/errors --silent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(printer): remove TSPL TrueType/internal-font feature entirely"
```

---

## Task 4: PascalCase giá trị `PrintPaperType`/`CutterMode` (nốt phần còn lại)

**Files:**
- Modify: `src/features/printer/models/paper/PrintPaperConfig.ts`

**Interfaces:**
- Consumes: không phụ thuộc task khác.
- Produces: `PrintPaperType = { Continuous: 'Continuous', DieCut: 'DieCut' }`, `CutterMode = { None: 'None', PerJob: 'PerJob', PerRow: 'PerRow' }`. `PaperSize` không đổi (giá trị là số, không có khái niệm casing).

Toàn bộ code khác trong repo truy cập enum này qua `PrintPaperType.Continuous`/`.DieCut`, `CutterMode.None`/`.PerJob`/`.PerRow` (property access, không phải string literal) nên KHÔNG cần sửa consumer nào ở task này — chỉ có 2 ngoại lệ dùng string literal trực tiếp, xử lý ở Task 21 (`testing/printerServiceTestKit.ts`).

- [ ] **Step 1: Đổi 2 khối value**

```ts
export const PrintPaperType = {
  /** Giấy cuộn liên tục, không có khe giữa các tem. */
  Continuous: 'Continuous',

  /** Giấy tem rời, có khe giữa các tem. */
  DieCut: 'DieCut',
} as const;
```

```ts
export const CutterMode = {
  None: 'None',

  /** Cắt một lần sau khi hoàn thành toàn bộ job in. */
  PerJob: 'PerJob',

  /** Cắt sau mỗi hàng in. */
  PerRow: 'PerRow',
} as const;
```

Giữ nguyên toàn bộ phần còn lại của file (`PaperSize`, `PrintPaperConfig` interface, doc comment).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p . 2>&1 | grep -i "printpapertype\|cuttermode"`
Expected: Chỉ còn lỗi ở `testing/printerServiceTestKit.ts` (string literal `'continuous'`) — xử lý ở Task 21.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(printer): PascalCase PrintPaperType/CutterMode values"
```

---

## Task 5: PascalCase enum trạng thái/sự kiện còn lại — `PrinterStatus`, `DiscoveryStage`, `PrintJobStatus`, `PrintResultStatus`

**Files:**
- Modify: `src/features/printer/models/printer/PrinterStatus.ts`
- Modify: `src/features/printer/models/printing/PrintJob.ts`
- Modify: `src/features/printer/discovery/PrinterDiscoveryService.ts` (chỉ phần `DiscoveryStage` — phần còn lại của file này sửa ở Task 20)
- Modify (rename giá trị, KHÔNG đổi tên biến/import): mọi file dùng các enum trên, liệt kê ở Step 4.

- [ ] **Step 1: Viết lại `PrinterStatus.ts`**

```ts
export const PrinterStatus = {
  Idle: 'Idle',
  Connecting: 'Connecting',
  Connected: 'Connected',
  Disconnecting: 'Disconnecting',
  Disconnected: 'Disconnected',
  Reconnecting: 'Reconnecting',
  Error: 'Error',
} as const;

export type PrinterStatus = (typeof PrinterStatus)[keyof typeof PrinterStatus];
```

- [ ] **Step 2: Sửa `PrintJob.ts`** — đổi 2 khối value, giữ nguyên phần còn lại (interface `PrintJob`/`PrintResult`, doc comment)

```ts
export const PrintJobStatus = {
  Pending: 'Pending',
  Printing: 'Printing',
  Success: 'Success',
  Failed: 'Failed',
  Cancelled: 'Cancelled',
} as const;
```

```ts
export const PrintResultStatus = {
  Success: 'Success',
  PartialFailure: 'PartialFailure',
  Failed: 'Failed',
  NoAvailablePrinter: 'NoAvailablePrinter',
} as const;
```

- [ ] **Step 3: Sửa khối `DiscoveryStage` trong `PrinterDiscoveryService.ts`** (chỉ khối này, phần orchestration sửa ở Task 20)

```ts
export const DiscoveryStage = {
  Connecting: 'Connecting',
  Identifying: 'Identifying',
  Identified: 'Identified',
  UnknownProtocol: 'UnknownProtocol',
  Error: 'Error',
} as const;
```

Đổi mọi `DiscoveryStage.connecting/identifying/identified/unknown_protocol/error` trong CHÍNH file này (phần còn lại của `createDiscoverDriver`) sang `.Connecting/.Identifying/.Identified/.UnknownProtocol/.Error`.

- [ ] **Step 4: Rename giá trị ở toàn bộ file dùng 4 enum trên** (đổi `.idle→.Idle`, `.connecting→.Connecting`, `.connected→.Connected`, `.disconnecting→.Disconnecting`, `.disconnected→.Disconnected`, `.reconnecting→.Reconnecting`, `.error→.Error` cho `PrinterStatus`; `.pending→.Pending`, `.printing→.Printing`, `.success→.Success`, `.failed→.Failed`, `.cancelled→.Cancelled` cho `PrintJobStatus`; `.partialFailure`/`.noAvailablePrinter` tương ứng cho `PrintResultStatus`; `.connecting/.identifying/.identified/.unknown_protocol/.error` → `.Connecting/.Identifying/.Identified/.UnknownProtocol/.Error` cho `DiscoveryStage`):

`connection/PrinterConnectionService.ts`, `connection/PrinterConnectionLock.ts` (nếu tham chiếu status), `management/PrinterConfigService.ts`, `printing/PrinterPrintService.ts`, `printing/PrintScheduler.ts`, `printing/PrintService.ts`, `printing/PrintRoutingService.ts` (nếu tham chiếu), `drivers/escpos/EscPosDriver.ts`, `drivers/tspl/TsplDriver.ts`, `discovery/DeviceScanService.ts`, `hooks/usePrinterConnection.ts`, `hooks/usePrinterList.ts`, `hooks/useAddPrinterFlow.ts`, `hooks/addPrinter/useProtocolDiscovery.ts`, `components/PrinterListItem.tsx`, `components/PrinterInfoCard.tsx`, `components/PrinterStatusBadge.tsx`, `store/printerSlice.ts` (nếu có default/initial status), `testing/printerFixtures.ts`, `testing/printerServiceTestKit.ts`.

Với mỗi file `__tests__/*.test.ts(x)` tương ứng — áp dụng cùng phép thế cho phần fixture/assertion.

Lưu ý: `ConnectionState`/`ProtocolState` trong `components/StatusPanel.tsx` là 2 UNION TYPE cục bộ của riêng UI (`'idle' | 'connecting' | 'connected' | 'error'`, `'idle' | 'detecting' | 'identified' | 'unknown'`), KHÔNG phải `PrinterStatus`/`DiscoveryStage` — GIỮ NGUYÊN chữ thường, không đổi (sửa nhầm sẽ vỡ state machine UI không liên quan tới enum model).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit -p . 2>&1 | grep -iE "printerstatus|printjobstatus|printresultstatus|discoverystage"`
Expected: Không còn lỗi nhắc tới các enum này với giá trị viết thường.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(printer): PascalCase PrinterStatus/DiscoveryStage/PrintJobStatus/PrintResultStatus"
```

---

## Task 6: Viết lại `Printer.ts` — atomic 1 connection/1 driver/1 paper/1 type

**Files:**
- Modify: `src/features/printer/models/printer/Printer.ts`
- Modify: `src/features/printer/storage/PrinterWriteInput.ts` (kiểm tra lại, không đổi shape)

**Interfaces:**
- Consumes: `PrinterDriver` (Task 2), `PrinterConnection` (Task 1), `PrintPaperConfig` (Task 4), `PrintType` (đã PascalCase sẵn, không đổi), `PrinterCapabilities` (không đổi).
- Produces: `Printer { id, identityKey, type, name, vendor?, model?, connection, driver, paper, capabilities, autoReconnect, enabled, createdAt, updatedAt }` — dùng ở TẤT CẢ task sau.

- [ ] **Step 1: Viết lại `Printer.ts`**

```ts
import type { PrinterDriver } from './PrinterDriver';
import type { PrinterCapabilities } from './PrinterCapabilities';
import type { PrinterConnection } from './PrinterConnection';
import type { PrintPaperConfig } from '../paper/PrintPaperConfig';
import type { PrintType } from '../printing/PrintType';

/**
 * 1 cấu hình in đã lưu — ĐÚNG 1 connection + ĐÚNG 1 driver + ĐÚNG 1 loại nội
 * dung (`type`) + ĐÚNG 1 cấu hình giấy. Khác `PrinterDevice` (PrinterDevice.ts)
 * là kết quả scan tạm thời trước khi lưu. Cùng 1 máy in vật lý phục vụ cả Hoá
 * đơn lẫn Tem thì có 2 `Printer` riêng, có thể cùng `connection` khác `driver`
 * (xem ARCHITECTURE.md).
 */
export interface Printer {
  id: string;
  /** Chỉ phụ thuộc connection, không phụ thuộc driver — xem `discovery/PrinterResolver.ts`. Ràng buộc unique là cặp `(identityKey, type)`, không phải `identityKey` một mình — xem `storage/PrinterRepository.ts`. */
  identityKey: string;
  type: PrintType;
  name: string;
  vendor?: string;
  model?: string;
  connection: PrinterConnection;
  driver: PrinterDriver;
  paper: PrintPaperConfig;
  capabilities: PrinterCapabilities;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Kiểm tra `PrinterWriteInput.ts`**

Đọc file hiện tại — shape là `Omit<Printer, 'identityKey'> & { identityKey?: string }`, không phụ thuộc field cụ thể nào của `Printer` nên KHÔNG cần sửa nội dung. Chỉ chạy tsc để xác nhận vẫn compile đúng với `Printer` mới.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "Printer\.ts|drivers:|connection:|\.drivers\b"`
Expected: Rất nhiều lỗi ở mọi nơi còn dùng `printer.drivers`/`printer.connection` kiểu cũ — đây là lỗi MONG ĐỢI, dọn dần ở các task sau. Ghi số lượng lỗi hiện tại vào ledger để so sánh cuối cùng.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(printer): Printer becomes one atomic (connection, driver, paper, type) config"
```

---

## Task 7: Viết lại `DriverCapabilities.ts` + `driverConfig.ts`

**Files:**
- Modify: `src/features/printer/drivers/DriverCapabilities.ts`
- Modify: `src/features/printer/drivers/driverConfig.ts`
- Modify: `src/features/printer/drivers/__tests__/DriverCapabilities.test.ts`
- Modify: `src/features/printer/drivers/__tests__/driverConfig.test.ts`

**Interfaces:**
- Consumes: `PrinterDriverType`/`RenderMode`/`PrinterDriverConfig` (Task 2), `PrintPaperConfig`/`PaperSize`/`PrintPaperType` (Task 4).
- Produces: `DRIVER_CAPABILITIES: Record<PrinterDriverType, DriverCapabilities>` (không còn `media` trong `defaultConfig` — media giờ độc lập ở `DEFAULT_PAPER`), `DEFAULT_PAPER: PrintPaperConfig`, `usesBitmapRenderMode(driver): boolean`. XOÁ `mediaOf`/`paperSizeOf`/`escPosRenderModeOf`/`tsplRenderModeOf`/`DEFAULT_TSPL_INTERNAL_FONT` (không còn ý nghĩa — gọi trực tiếp `printer.paper`/`printer.paper.paperSize`/`driver.config.renderMode`).

- [ ] **Step 1: Viết lại `DriverCapabilities.ts`**

```ts
import { RenderMode, PrinterDriverType, type PrinterDriverConfig } from '../models/printer/PrinterDriver';
import { PrintType } from '../models/printing/PrintType';

export interface DriverCapabilities {
  contentTypes: PrintType[];
  /** Config khởi tạo khi tạo 1 `Printer` mới với driver loại này — nguồn sự thật duy nhất, không viết tay rải rác ở nơi gọi. */
  defaultConfig: PrinterDriverConfig;
}

/**
 * Capability TĨNH theo driver TYPE — driver loại này CÓ THỂ phục vụ loại nội
 * dung nào (dùng để lọc candidate lúc discovery theo `printType` đang mở, xem
 * `PrinterDiscoveryService.ts`). KHÔNG phải rule table theo vendor/model.
 */
export const DRIVER_CAPABILITIES: Record<PrinterDriverType, DriverCapabilities> = {
  [PrinterDriverType.EscPos]: { contentTypes: [PrintType.Receipt], defaultConfig: { renderMode: RenderMode.Encoder } },
  [PrinterDriverType.Tspl]: { contentTypes: [PrintType.Receipt, PrintType.Label], defaultConfig: { renderMode: RenderMode.Bitmap } },
};

export const getDriverCapabilities = (type: PrinterDriverType): DriverCapabilities => DRIVER_CAPABILITIES[type];
```

- [ ] **Step 2: Viết lại `driverConfig.ts`**

```ts
import { RenderMode } from '../models/printer/PrinterDriver';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import { PaperSize, PrintPaperType } from '../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';

/** Cấu hình giấy mặc định khi tạo 1 `Printer` mới — 80mm, cuộn liên tục. */
export const DEFAULT_PAPER: PrintPaperConfig = { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm80 };

/** Driver này có đang ở chế độ render ảnh không — dùng chung cho cả 2 protocol vì `PrinterDriverConfig` giờ dùng chung 1 shape. */
export const usesBitmapRenderMode = (driver: PrinterDriver): boolean => driver.config.renderMode === RenderMode.Bitmap;
```

- [ ] **Step 3: Sửa `__tests__/DriverCapabilities.test.ts` và `__tests__/driverConfig.test.ts`**

Đọc từng file hiện tại: xoá mọi assertion tham chiếu `contentTypes`/`media` bên trong `defaultConfig` (không còn tồn tại), thêm/giữ assertion cho `defaultConfig.renderMode` đúng theo bảng trên. Với `driverConfig.test.ts`, xoá toàn bộ test case của `mediaOf`/`paperSizeOf`/`escPosRenderModeOf`/`tsplRenderModeOf`/`DEFAULT_TSPL_INTERNAL_FONT` (hàm đã xoá), giữ/thêm test case cho `usesBitmapRenderMode` và `DEFAULT_PAPER`.

- [ ] **Step 4: Verify**

Run: `npx jest src/features/printer/drivers/__tests__/DriverCapabilities.test.ts src/features/printer/drivers/__tests__/driverConfig.test.ts --silent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(printer): DriverCapabilities/driverConfig for the single-driver Printer shape"
```

---

## Task 8: Viết lại `PrinterSchema.ts`

**Files:**
- Modify: `src/features/printer/forms/addPrinter/PrinterSchema.ts`
- Modify: `src/features/printer/forms/addPrinter/__tests__/PrinterSchema.test.ts`

**Interfaces:**
- Consumes: `PrinterConnectionType` (Task 1), `PrinterDriverType`/`DriverSource`/`RenderMode` (Task 2), `PaperSize`/`PrintPaperType`/`CutterMode` (Task 4), `Printer` shape (Task 6).
- Produces: `printerSchema` validate đúng shape mới, `printerDriverSchema`, `printPaperConfigSchema` (đổi tên từ `printMediaSchema`).

- [ ] **Step 1: Viết lại toàn bộ file**

```ts
import { z } from 'zod';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { DriverSource, RenderMode, PrinterDriverType } from '../../models/printer/PrinterDriver';
import { CutterMode, PaperSize, PrintPaperType } from '../../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../../models/paper/PrintPaperConfig';
import { PrintType } from '../../models/printing/PrintType';
import { dieCutRowOverflow } from '../../paper/validation';

const paperSizeSchema = z.union([
  z.literal(PaperSize.Mm58),
  z.literal(PaperSize.Mm80),
  z.literal(PaperSize.Mm100),
  z.literal(PaperSize.Mm104),
]);

const DIE_CUT_REQUIRED = ['itemWidthMm', 'itemHeightMm', 'columns', 'horizontalGapMm', 'verticalGapMm'] as const;

const printPaperConfigSchema = z
  .object({
    type: z.enum([PrintPaperType.Continuous, PrintPaperType.DieCut]),
    paperSize: paperSizeSchema,
    itemWidthMm: z.number().positive().optional(),
    itemHeightMm: z.number().positive().optional(),
    columns: z.number().int().min(1).optional(),
    horizontalGapMm: z.number().min(0).optional(),
    verticalGapMm: z.number().min(0).optional(),
    cutterMode: z.enum([CutterMode.None, CutterMode.PerJob, CutterMode.PerRow]).optional(),
  })
  .superRefine((paper, ctx) => {
    if (paper.type !== PrintPaperType.DieCut) {
      return;
    }

    for (const f of DIE_CUT_REQUIRED) {
      if (paper[f] === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [f], message: `Giấy die-cut cần ${f}` });
      }
    }

    if (paper.cutterMode && paper.cutterMode !== CutterMode.None) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cutterMode'], message: 'Giấy die-cut không cắt được (răng cưa tự tách)' });
    }

    const overflow = dieCutRowOverflow(paper as PrintPaperConfig);

    if (overflow) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['columns'], message: overflow });
    }
  });

const printerCapabilitiesSchema = z.object({ cutter: z.boolean() });

const printerDriverConfigSchema = z.object({ renderMode: z.enum([RenderMode.Encoder, RenderMode.Bitmap]) });

export const printerDriverSchema = z.object({
  type: z.enum([PrinterDriverType.EscPos, PrinterDriverType.Tspl]),
  source: z.enum([DriverSource.Auto, DriverSource.Manual]),
  config: printerDriverConfigSchema,
});

const usbPrinterConnectionSchema = z.object({
  type: z.literal(PrinterConnectionType.Usb),
  vendorId: z.number(),
  productId: z.number(),
  serialNumber: z.string().optional(),
});

const bluetoothPrinterConnectionSchema = z.object({
  type: z.literal(PrinterConnectionType.Bluetooth),
  deviceId: z.string(),
  name: z.string().optional(),
});

const lanPrinterConnectionSchema = z.object({
  type: z.literal(PrinterConnectionType.Lan),
  host: z.string(),
  port: z.number(),
});

const printerConnectionSchema = z.discriminatedUnion('type', [
  usbPrinterConnectionSchema,
  bluetoothPrinterConnectionSchema,
  lanPrinterConnectionSchema,
]);

/**
 * Safety net ở service layer (spec §3), KHÔNG thay thế validation UI (UI đã
 * tự ngăn phần lớn state không hợp lệ trước khi tới đây).
 */
export const printerSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    vendor: z.string().optional(),
    model: z.string().optional(),
    type: z.enum([PrintType.Receipt, PrintType.Label]),
    driver: printerDriverSchema,
    connection: printerConnectionSchema,
    paper: printPaperConfigSchema,
    identityKey: z.string().min(1),
    capabilities: printerCapabilitiesSchema,
    autoReconnect: z.boolean(),
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((printer, ctx) => {
    if (printer.driver.type === PrinterDriverType.EscPos && printer.paper.type !== PrintPaperType.Continuous) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paper', 'type'], message: 'ESC/POS chỉ in giấy cuộn liên tục' });
    }

    if (printer.driver.type === PrinterDriverType.Tspl && printer.driver.config.renderMode !== RenderMode.Bitmap) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['driver', 'config', 'renderMode'], message: 'TSPL chỉ hỗ trợ chế độ Bitmap' });
    }
  });

export type PrinterValidated = z.infer<typeof printerSchema>;
```

- [ ] **Step 2: Viết lại `__tests__/PrinterSchema.test.ts`**

Đọc file hiện tại. Xoá mọi test case về: `contentTypes` không giao nhau giữa 2 driver, tối đa 2 driver, trùng `driver.type`, `tsplFontConfigSchema`/`tsplInternalFontConfigSchema`/`TsplCodepage` — các invariant này không còn tồn tại. Viết lại các case còn giá trị theo shape mới:
- Chấp nhận 1 printer hợp lệ đầy đủ field mới (`type`, `driver` số ít, `paper` số ít).
- ESC/POS + `paper.type: DieCut` → reject với message "ESC/POS chỉ in giấy cuộn liên tục".
- TSPL + `driver.config.renderMode: Encoder` → reject với message "TSPL chỉ hỗ trợ chế độ Bitmap".
- Die-cut thiếu field bắt buộc → reject.
- Die-cut với `cutterMode` khác `None` → reject.
- Connection USB/Bluetooth/LAN hợp lệ → accept (giữ style test hiện có, đổi giá trị `PrinterConnectionType.Usb` v.v.).

- [ ] **Step 3: Verify**

Run: `npx jest src/features/printer/forms/addPrinter --silent`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(printer): rewrite printerSchema for the atomic Printer shape"
```

---

## Task 9: Xác nhận `paper/validation.ts` + `paper/cutter.ts` (không cần đổi logic)

**Files:**
- Verify only: `src/features/printer/paper/validation.ts`
- Verify only: `src/features/printer/paper/cutter.ts`

**Interfaces:**
- Consumes: `PrintPaperType`/`CutterMode` (Task 4) qua property access (`PrintPaperType.DieCut`, `CutterMode.None`/`.PerJob`) — không phải string literal, nên không cần sửa.

- [ ] **Step 1: Đọc lại 2 file, xác nhận không có string literal `'die_cut'`/`'continuous'`/`'none'`/`'per_job'`/`'per_row'` nào viết tay (chỉ truy cập qua `PrintPaperType.X`/`CutterMode.X`)**

Nếu đúng như vậy (đã xác nhận khi viết plan này), KHÔNG cần sửa nội dung 2 file — chỉ cần verify compile.

- [ ] **Step 2: Verify**

Run: `npx jest src/features/printer/paper --silent`
Expected: PASS (test file `__tests__/validation.test.ts`, `__tests__/cutter.test.ts`, `__tests__/paperSpec.test.ts` không cần đổi vì cùng lý do — chỉ dùng property access qua enum import).

Run: `npx tsc --noEmit -p . 2>&1 | grep "paper/validation\|paper/cutter"`
Expected: Không có output.

- [ ] **Step 3: Commit**

Không có thay đổi để commit nếu Step 1 xác nhận đúng — bỏ qua bước này, ghi vào ledger "Task 9: no-op, verified".

---

## Task 10: Rename `PrinterResolver.ts`

**Files:**
- Modify: `src/features/printer/discovery/PrinterResolver.ts`
- Modify: `src/features/printer/discovery/__tests__/PrinterResolver.test.ts`

**Interfaces:**
- Consumes: `PrinterConnectionType` (Task 1).
- Produces: `buildUsbConnection`/`buildBluetoothConnection`/`buildLanConnection`/`deviceFromConnection`/`resolveIdentityKey` — chữ ký và THUẬT TOÁN identityKey không đổi, chỉ đổi enum reference.

- [ ] **Step 1: Sửa import + reference**

Đổi dòng đầu file:

```ts
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import type { PrinterDevice, UsbRawDevice } from '../models/printer/PrinterDevice';
import type { BluetoothPrinterConnection, LanPrinterConnection, PrinterConnection, UsbPrinterConnection } from '../models/printer/PrinterConnection';
```

Đổi mọi `ConnectionType.usb/.bluetooth/.lan` trong file thành `PrinterConnectionType.Usb/.Bluetooth/.Lan`.

**QUAN TRỌNG — KHÔNG đổi các chuỗi khoá nội bộ trong `resolveIdentityKey`:** `` `usb:${...}` ``, `` `bluetooth:mac:${...}` ``, `` `lan:${...}:${...}` `` — đây là format khoá tự do (không phải giá trị enum), giữ nguyên viết thường đúng như thiết kế (spec §2.3: "chuỗi khoá nội bộ, không phải enum hiển thị"). Chỉ đổi phần bên trái so sánh `connection.type === PrinterConnectionType.Lan` (điều kiện), KHÔNG đổi phần literal string bên trong template string kết quả trả về.

- [ ] **Step 2: Sửa test**

Đọc `__tests__/PrinterResolver.test.ts` hiện tại, đổi mọi `ConnectionType.usb/.bluetooth/.lan` → `PrinterConnectionType.Usb/.Bluetooth/.Lan` trong phần dựng input/expected. KHÔNG đổi các assertion so `identityKey` (`toBe('usb:...')`, `toBe('lan:...')`) — các chuỗi này giữ nguyên viết thường theo Step 1.

- [ ] **Step 3: Verify**

Run: `npx jest src/features/printer/discovery/__tests__/PrinterResolver.test.ts --silent`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(printer): rename ConnectionType to PrinterConnectionType in PrinterResolver"
```

---

## Task 11: Đơn giản hoá `IPrinterDriver.ts` + `IPrinterAdapter.ts` — bỏ tham số `driver`/`printType` rời

**Files:**
- Modify: `src/features/printer/drivers/IPrinterDriver.ts`
- Modify: `src/features/printer/adapters/IPrinterAdapter.ts`

**Interfaces:**
- Consumes: `Printer` (Task 6), `PrinterConnectionType` (Task 1), `PrinterStatus` (Task 5).
- Produces: `IPrinterDriver.connect(printer)` (bỏ `driver`), `.testPrint(printer, documents, options?)` (bỏ `driver`/`printType`), `.print(printerId, documents, options?)` (bỏ `printType`) — driver tự đọc `printer.driver`/`printer.type`. `toConnectTarget(printer)` không đổi chữ ký, chỉ đổi enum reference.

- [ ] **Step 1: Viết lại `IPrinterDriver.ts`**

```ts
import type { PrinterConnectionType, DeviceScanEvent, PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import type { Printer } from '../models/printer/Printer';
import type { PrinterStatus } from '../models/printer/PrinterStatus';
import type { PrintDocument } from '../models/printing/PrintDocument';

export type Unsubscribe = () => void;

/**
 * `text` là document dùng mặc định cho mọi driver. `image` (tuỳ chọn) là bản
 * base64 PNG render sẵn — driver TỰ quyết định có dùng hay không, KHÔNG phải
 * nơi gọi (`PrintRoutingService`/`PrintService`) quyết định thay.
 */
export interface PrintDocuments {
  text: PrintDocument;
  /** Base64 PNG (không tiền tố `data:`) — nguồn cho TSPL bitmap. */
  image?: string;
}

/** Tuỳ chọn in bổ sung, không phụ thuộc protocol — chỉ TSPL đọc `rows` (die-cut). */
export interface PrintOptions {
  /** Số HÀNG die-cut cần in (mỗi hàng = `paper.columns` con tem). Default 1. Bỏ qua khi paper continuous ở đường routing; `testPrint` dùng để in thử grid. */
  rows?: number;
}

/** `printer.driver`/`printer.type`/`printer.paper` đã đủ context — không còn tham số `driver`/`printType` rời như bản cũ (mỗi `Printer` giờ chỉ có 1 driver). */
export interface IPrinterDriver {
  scan(connectionType: PrinterConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(printer: Printer): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  testPrint(printer: Printer, documents: PrintDocuments, options?: PrintOptions): Promise<void>;
  print(printerId: string, documents: PrintDocuments, options?: PrintOptions): Promise<void>;
  identify(printerId: string): Promise<PrinterDeviceInfo | null>;
}
```

Lưu ý: `PrinterDevice.ts` hiện KHÔNG export `PrinterConnectionType` (đã chuyển sang `PrinterConnection.ts` ở Task 1) — import đúng 2 nguồn riêng: `PrinterConnectionType` từ `../models/printer/PrinterConnection`, `DeviceScanEvent`/`PrinterDeviceInfo` từ `../models/printer/PrinterDevice`. Sửa lại dòng import cho khớp (không gộp chung 1 dòng như bản nháp trên).

- [ ] **Step 2: Viết lại `IPrinterAdapter.ts`**

Đổi `import type { ConnectionType, PrinterDevice } from '../models/printer/PrinterDevice';` thành:

```ts
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import type { PrinterDevice } from '../models/printer/PrinterDevice';
```

Đổi `PrinterConnectTarget.connectionType: ConnectionType` → `connectionType: PrinterConnectionType`. Đổi `listDevices(connectionType: ConnectionType)` → `PrinterConnectionType`. Trong `toConnectTarget`, đổi 3 so sánh `connection.type === 'lan'`/`'bluetooth'`/còn lại → `connection.type === PrinterConnectionType.Lan`/`PrinterConnectionType.Bluetooth`/giữ nhánh `else` cho USB như cũ (không đổi logic, chỉ đổi literal so sánh).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "IPrinterDriver|IPrinterAdapter"`
Expected: Lỗi ở mọi implementer (`EscPosDriver`/`TsplDriver`/mock trong test) — MONG ĐỢI, xử lý ở Task 12-13.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(printer): drop redundant driver/printType params from IPrinterDriver"
```

---

## Task 12: Viết lại `EscPosDriver.ts`

**Files:**
- Modify: `src/features/printer/drivers/escpos/EscPosDriver.ts`
- Modify: `src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver` mới (Task 11), `Printer` (Task 6), `PrinterConnectionType` (Task 1), `RenderMode`/`PrinterDriverType` (Task 2), `CutterMode` (Task 4), `usesBitmapRenderMode` (Task 7).
- Produces: `EscPosDriver implements IPrinterDriver` — `contexts: Map<string, Printer>` (không còn lưu `driver` rời), `activeByType: Map<PrinterConnectionType, string>`.

- [ ] **Step 1: Viết lại toàn bộ file**

```ts
import { Platform } from 'react-native';
import type { IPrinterDriver, PrintDocuments, PrintOptions, Unsubscribe } from '../IPrinterDriver';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { RenderMode, PrinterDriverType } from '../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { CutterMode } from '../../models/paper/PrintPaperConfig';
import { DeviceScanEventType } from '../../models/printer/PrinterDevice';
import type { DeviceScanEvent, PrinterDeviceInfo } from '../../models/printer/PrinterDevice';
import type { Printer } from '../../models/printer/Printer';
import { PrinterErrorException, PrinterErrorCode, errorCodeOf } from '../../errors/PrinterError';
import { ensureBluetoothPermission } from '../../permissions/PrinterPermissionService';
import { PrinterLogger } from '../../logging/PrinterLogger';
import { LoggerService } from '../../../../services/LoggerService';
import { NativeAdapter } from '../../adapters/native/NativeAdapter';
import { toConnectTarget } from '../../adapters/IPrinterAdapter';
import { buildEscPosText } from './EscPosTextBuilder';
import { buildEscPosBitmapBytes } from './EscPosBitmapEncoder';
import { resolveEffectiveCutterMode } from '../../paper/cutter';
import { decodePngBase64ToMonochrome } from '../../utils/pngToMonochrome';
import { PAPER_SIZE_SPECS, DOTS_PER_MM, CONTINUOUS_HEIGHT_MM } from '../../paper/paperSpec';

const ESC_POS_BASE_OPTIONS = { keepConnection: true, tailingLine: true, encoding: 'UTF8' } as const;

/**
 * ESC/POS đi qua `NativeAdapter` (`IPrinterAdapter`) — native module RN*Printer
 * gộp connect+encode+write theo namespace/connectionType (spec §2.3, ngoại lệ
 * pragmatic: KHÔNG dùng `read`, `printText` encode ở JS `EPToolkit`). Native là
 * singleton per connectionType → `activeByType` giữ đúng 1 owner/loại.
 */
export class EscPosDriver implements IPrinterDriver {
  private adapters = new Map<string, NativeAdapter>();
  private connectedTypes = new Map<string, PrinterConnectionType>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private contexts = new Map<string, Printer>();
  private activeByType = new Map<PrinterConnectionType, string>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  scan(connectionType: PrinterConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === PrinterConnectionType.Lan) {
      onEvent({ type: DeviceScanEventType.Empty });
      return () => undefined;
    }

    if (connectionType === PrinterConnectionType.Usb && Platform.OS !== 'android') {
      onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'USB chỉ hỗ trợ trên Android' } });
      return () => undefined;
    }

    let cancelled = false;
    onEvent({ type: DeviceScanEventType.Loading });
    const startedAt = Date.now();

    const run = async (): Promise<void> => {
      try {
        if (connectionType === PrinterConnectionType.Bluetooth) {
          const granted = await ensureBluetoothPermission();

          if (cancelled) {
            return;
          }

          if (!granted) {
            onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' } });
            return;
          }
        }

        const devices = await new NativeAdapter().listDevices(connectionType);

        if (cancelled) {
          return;
        }

        LoggerService.debug('EscPosDriver.scan: devices', { connectionType, devices });
        onEvent({ type: devices.length > 0 ? DeviceScanEventType.Found : DeviceScanEventType.Empty, devices });
        PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);

        if (/no device found/i.test(message)) {
          onEvent({ type: DeviceScanEventType.Empty });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: 0, durationMs: Date.now() - startedAt });
          return;
        }

        onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message } });
        PrinterLogger.scanFailed({ connectionType, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }

  async connect(printer: Printer): Promise<void> {
    this.setStatus(printer.id, PrinterStatus.Connecting);
    const startedAt = Date.now();

    try {
      if (printer.connection.type === PrinterConnectionType.Bluetooth) {
        const granted = await ensureBluetoothPermission();

        if (!granted) {
          throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' });
        }
      }

      const adapter = new NativeAdapter();
      await adapter.connect(toConnectTarget(printer));

      this.adapters.set(printer.id, adapter);
      this.connectedTypes.set(printer.id, printer.connection.type);
      this.contexts.set(printer.id, printer);

      const previousOwner = this.activeByType.get(printer.connection.type);

      if (previousOwner && previousOwner !== printer.id) {
        this.setStatus(previousOwner, PrinterStatus.Disconnected);
      }

      this.activeByType.set(printer.connection.type, printer.id);
      this.setStatus(printer.id, PrinterStatus.Connected);
      PrinterLogger.connectSucceeded({ printerId: printer.id, protocol: PrinterDriverType.EscPos, connectionType: printer.connection.type, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, PrinterStatus.Error);
      PrinterLogger.connectFailed({ printerId: printer.id, protocol: PrinterDriverType.EscPos, connectionType: printer.connection.type, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, PrinterStatus.Disconnecting);
    const connectionType = this.connectedTypes.get(printerId);
    const isActiveOwner = Boolean(connectionType) && this.activeByType.get(connectionType!) === printerId;

    try {
      if (isActiveOwner) {
        await this.adapters.get(printerId)?.disconnect();
      }
    } catch (error) {
      this.setStatus(printerId, PrinterStatus.Error);
      PrinterLogger.disconnectFailed({ printerId, protocol: PrinterDriverType.EscPos, errorCode: errorCodeOf(error) });
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: error instanceof Error ? error.message : String(error) });
    } finally {
      if (isActiveOwner) {
        this.activeByType.delete(connectionType!);
      }

      this.adapters.delete(printerId);
      this.connectedTypes.delete(printerId);
      this.contexts.delete(printerId);
    }

    this.setStatus(printerId, PrinterStatus.Disconnected);
    PrinterLogger.disconnectSucceeded({ printerId, protocol: PrinterDriverType.EscPos });
  }

  private async sendDocuments(adapter: NativeAdapter, printer: Printer, documents: PrintDocuments): Promise<void> {
    if (printer.driver.config.renderMode === RenderMode.Bitmap) {
      await this.sendBitmap(adapter, printer, documents);
      return;
    }

    const cut = resolveEffectiveCutterMode(printer.paper) !== CutterMode.None;
    const text = buildEscPosText(printer.paper.paperSize, documents);
    await adapter.printText(text, { ...ESC_POS_BASE_OPTIONS, cut });
  }

  /**
   * ESC/POS paper luôn `Continuous` (schema cấm die-cut cho ESC/POS) — không
   * cần lặp theo cột như TSPL die-cut, đơn giản hơn hẳn theo đúng lý do vật lý.
   */
  private async sendBitmap(adapter: NativeAdapter, printer: Printer, documents: PrintDocuments): Promise<void> {
    if (!documents.image) {
      throw new PrinterErrorException({ code: PrinterErrorCode.IMAGE_REQUIRED, message: 'Chế độ Bitmap cần ảnh bill đã render — capture ảnh thất bại hoặc chưa chạy.' });
    }

    const targetWidthPx = PAPER_SIZE_SPECS[printer.paper.paperSize].imageWidthPx;

    let bitmap;

    try {
      bitmap = decodePngBase64ToMonochrome(documents.image, targetWidthPx);
    } catch (error) {
      throw new PrinterErrorException({ code: PrinterErrorCode.IMAGE_INVALID, message: 'Ảnh bill không hợp lệ (không giải mã được PNG).', cause: error });
    }

    const maxHeightPx = CONTINUOUS_HEIGHT_MM * DOTS_PER_MM;

    if (bitmap.heightPx > maxHeightPx) {
      throw new PrinterErrorException({ code: PrinterErrorCode.IMAGE_TOO_LARGE, message: `Nội dung cao khoảng ${Math.ceil(bitmap.heightPx / DOTS_PER_MM)}mm, vượt ngưỡng an toàn ${CONTINUOUS_HEIGHT_MM}mm.` });
    }

    const bytes = buildEscPosBitmapBytes(bitmap, resolveEffectiveCutterMode(printer.paper));
    // KHÔNG dùng adapter.printText() — cần chunk qua UsbTransport như TSPL bitmap
    // (printText() trên USB gọi thẳng writeByBase64 không chunk, bill dài dễ vượt 1 lần transfer).
    await adapter.write(bytes);
  }

  /** `_options` không dùng ở ESC/POS (không phân biệt bill/label, không grid) — chỉ giữ tham số để khớp `IPrinterDriver`. */
  async print(printerId: string, documents: PrintDocuments, _options?: PrintOptions): Promise<void> {
    const printer = this.contexts.get(printerId);
    const connectionType = this.connectedTypes.get(printerId);
    const adapter = this.adapters.get(printerId);

    if (!printer || !connectionType || !adapter || this.activeByType.get(connectionType) !== printerId) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });
    }

    const startedAt = Date.now();

    try {
      await this.sendDocuments(adapter, printer, documents);
      PrinterLogger.printSucceeded({ printerId, protocol: PrinterDriverType.EscPos, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.printFailed({ printerId, protocol: PrinterDriverType.EscPos, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? PrinterStatus.Idle;
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) {
      this.listeners.set(printerId, new Set());
    }

    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  /** `_options` không dùng ở ESC/POS (không phân biệt bill/label, không grid) — chỉ giữ tham số để khớp `IPrinterDriver`. */
  async testPrint(printer: Printer, documents: PrintDocuments, _options?: PrintOptions): Promise<void> {
    const startedAt = Date.now();

    try {
      const isStaleOwner = this.activeByType.get(printer.connection.type) !== printer.id;

      if (!this.adapters.has(printer.id) || isStaleOwner) {
        await this.connect(printer);
      }

      const adapter = this.adapters.get(printer.id);

      if (!adapter) {
        return;
      }

      await this.sendDocuments(adapter, printer, documents);
      PrinterLogger.testPrintSucceeded({ printerId: printer.id, protocol: PrinterDriverType.EscPos, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({ printerId: printer.id, protocol: PrinterDriverType.EscPos, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  /**
   * ESC/POS không có discriminator thật (native không `read`). Trả `{}` khi đã
   * kết nối (BLE/LAN — "weak confirm" cho auto-detect, xem `PrinterDiscoveryService`),
   * `null` cho USB (không bao giờ tự xác nhận protocol qua USB — xem CLAUDE.md).
   */
  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const connectionType = this.connectedTypes.get(printerId);

    if (!connectionType || connectionType === PrinterConnectionType.Usb) {
      return null;
    }

    return this.adapters.has(printerId) ? {} : null;
  }
}
```

- [ ] **Step 2: Sửa `__tests__/EscPosDriver.test.ts`**

Đọc file hiện tại. Với mọi lời gọi `driver.connect(printer, driverEntry)` → `driver.connect(printer)` (printer fixture giờ có `printer.driver` gắn sẵn, không truyền rời). Với `driver.testPrint(printer, driverEntry, documents, printType, options)` → `driver.testPrint(printer, documents, options)`. Với `driver.print(printerId, documents, printType, options)` → `driver.print(printerId, documents, options)`. Đổi mọi `ConnectionType.*`/`PrinterStatus.*`/`PrinterDriverType.escpos`/`DeviceScanEventType.*` sang PascalCase tương ứng. Test case "malformed connection" (nếu còn sót từ trước) giữ nguyên cách rewrite ở lần refactor trước (mock native reject).

- [ ] **Step 3: Verify**

Run: `npx jest src/features/printer/drivers/escpos --silent`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(printer): EscPosDriver reads config from printer.driver/printer.paper directly"
```

---

## Task 13: Viết lại `TsplEncoder.ts` (bỏ `TsplCodepage`) và `TsplDriver.ts` (bỏ font, chỉ còn Bitmap)

**Files:**
- Modify: `src/features/printer/drivers/tspl/TsplEncoder.ts`
- Modify: `src/features/printer/drivers/tspl/__tests__/TsplEncoder.test.ts`
- Modify: `src/features/printer/drivers/tspl/strategies/tsplStrategy.types.ts`
- Modify: `src/features/printer/drivers/tspl/strategies/TsplBitmapStrategy.ts`
- Modify: `src/features/printer/drivers/tspl/strategies/__tests__/TsplBitmapStrategy.test.ts`
- Modify: `src/features/printer/drivers/tspl/TsplDriver.ts`
- Modify: `src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver` mới (Task 11), `Printer` (Task 6), `RenderMode`/`PrinterDriverType` (Task 2), `CutterMode` (Task 4).
- Produces: `TsplEncoder` không còn `codepage`/`TsplCodepage` — `text()` chỉ còn nhánh UTF-8. `TsplStrategyContext.driver` bỏ (dùng `printer.driver`/`printer.paper` trực tiếp). `TsplDriver` gọi thẳng `new TsplBitmapStrategy()`, không qua `TsplStrategyRegistry` (đã xoá ở Task 3) — chỉ còn 1 chiến lược nên registry là abstraction thừa.

- [ ] **Step 1: Sửa `TsplEncoder.ts`**

Xoá import `TsplCodepage` (dòng `import { TsplCodepage } from '../../models/printer/PrinterDriver';`). Xoá field `private codepage: TsplCodepage = TsplCodepage.utf8;` và hàm `encodeSingleByte`. Đổi `initialize()`:

```ts
initialize(media: PrintPaperConfig, printType: PrintType = PrintType.Receipt): this {
  const heightMm = resolveSizeHeightMm(media, printType);

  if (media.type === PrintPaperType.DieCut) {
    const columns = media.columns ?? 1;
    const rowWidthMm = columns * (media.itemWidthMm ?? 0) + (columns - 1) * (media.horizontalGapMm ?? 0);
    this.pushLine(`SIZE ${rowWidthMm} mm, ${heightMm} mm`);
    this.pushLine(`GAP ${media.verticalGapMm ?? 0} mm, 0 mm`);
  } else {
    this.pushLine(`SIZE ${PAPER_SIZE_SPECS[media.paperSize].printableWidthMm} mm, ${heightMm} mm`);
    this.pushLine('GAP 0 mm, 0 mm');
  }

  this.pushLine('CODEPAGE UTF-8');
  this.pushLine('CLS');
  return this;
}
```

Đổi `text()`:

```ts
text(x: number, y: number, content: string, fontName: string = '3'): this {
  const escaped = content.replace(/"/g, '\\"');
  this.pushLine(`TEXT ${x},${y},"${fontName}",0,1,1,"${escaped}"`);
  return this;
}
```

Xoá import `encodeCp1258` từ `utils/cp1258` (file đã xoá ở Task 3). Giữ nguyên `barcode()`, `qrcode()`, `image()`, `cut()`, `encode()`, `resolveSizeHeightMm`/`columnPitchDots`/`columnOffsets`/`contentWidthChars`/`DEFAULT_LABEL_HEIGHT_MM`/`DOTS_PER_MM`/`CONTINUOUS_HEIGHT_MM` không đổi.

- [ ] **Step 2: Sửa `__tests__/TsplEncoder.test.ts`**

Đọc file hiện tại, xoá mọi test case truyền `codepage`/`TsplCodepage` cho `initialize()`/`text()` (case CP1258/CP1252) — chỉ còn UTF-8. Giữ các test case UTF-8, `barcode`, `qrcode`, `image`, `cut`.

- [ ] **Step 3: Sửa `tsplStrategy.types.ts`** — bỏ field `driver` khỏi `TsplStrategyContext` (dùng thẳng `printer.driver`/`printer.paper`), và `ITsplPrintStrategy.mode: RenderMode` (đổi tên type từ `PrintRenderMode`)

```ts
import type { Printer } from '../../../models/printer/Printer';
import type { RenderMode } from '../../../models/printer/PrinterDriver';
import type { PrintPaperConfig } from '../../../models/paper/PrintPaperConfig';
import type { PrintDocuments } from '../../IPrinterDriver';
import type { PrintType } from '../../../models/printing/PrintType';

/**
 * Input đã resolve đầy đủ cho 1 lần render TSPL. CONFIG-ONLY có chủ đích —
 * KHÔNG chứa connection state / transport / kết quả query máy in.
 */
export interface TsplStrategyContext {
  printer: Printer;
  documents: PrintDocuments;
  printType: PrintType;
  /** = `printer.paper`. Nguồn cho `SIZE`/`GAP`/`SET CUTTER`/layout cột. */
  paper: PrintPaperConfig;
  /** Số hàng die-cut cần in (>= 1). Continuous: số bản sao. */
  rows: number;
}

export interface ITsplPrintStrategy {
  readonly mode: RenderMode;
  /** Ném `PrinterErrorException` (TSPL_*) nếu context không đủ điều kiện. KHÔNG trả bool, KHÔNG fallback. */
  validate(context: TsplStrategyContext): void;
  /** Thuần: context → raw TSPL bytes. */
  encode(context: TsplStrategyContext): Uint8Array;
}
```

- [ ] **Step 4: Sửa `TsplBitmapStrategy.ts`** — đổi `context.media` → `context.paper` (đổi tên field theo Step 3), `PrintRenderMode.bitmap` → `RenderMode.Bitmap`, `PrintPaperType.DieCut` giữ nguyên (đã PascalCase từ Task 4)

Đọc file hiện tại, thay mọi `context.media` bằng `context.paper`, `mode = PrintRenderMode.bitmap` → `mode = RenderMode.Bitmap`, import `RenderMode` từ `PrinterDriver` thay `PrintRenderMode`.

- [ ] **Step 5: Sửa `__tests__/TsplBitmapStrategy.test.ts`** — đổi field `media` → `paper` trong mọi `TsplStrategyContext` dựng tay, bỏ field `driver` nếu test có dựng context với `driver` rời.

- [ ] **Step 6: Viết lại `TsplDriver.ts`**

```ts
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, PrintDocuments, PrintOptions, Unsubscribe } from '../IPrinterDriver';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { PrinterDriverType } from '../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { DeviceScanEventType } from '../../models/printer/PrinterDevice';
import type { DeviceScanEvent, PrinterDeviceInfo } from '../../models/printer/PrinterDevice';
import type { Printer } from '../../models/printer/Printer';
import { TsplBitmapStrategy } from './strategies/TsplBitmapStrategy';
import type { TsplStrategyContext } from './strategies/tsplStrategy.types';
import type { IPrinterAdapter } from '../../adapters/IPrinterAdapter';
import { toConnectTarget } from '../../adapters/IPrinterAdapter';
import { resolvePrinterAdapter } from '../../adapters/resolvePrinterAdapter';
import { PrinterErrorException, PrinterErrorCode, errorCodeOf } from '../../errors/PrinterError';
import { ensureBluetoothPermission } from '../../permissions/PrinterPermissionService';
import { PrinterLogger } from '../../logging/PrinterLogger';

const IDENTIFY_TIMEOUT_MS = 1000;

const resolveRows = (options?: PrintOptions): number => {
  const n = Math.floor(options?.rows ?? 1);
  return Number.isFinite(n) ? Math.max(1, n) : 1;
};

const encodeAsciiCommand = (text: string): Uint8Array => {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    // eslint-disable-next-line no-bitwise -- intentional single-byte masking
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
};

const tsplBitmapStrategy = new TsplBitmapStrategy();

export class TsplDriver implements IPrinterDriver {
  private connections = new Map<string, IPrinterAdapter>();
  private contexts = new Map<string, Printer>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  scan(connectionType: PrinterConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === PrinterConnectionType.Lan) {
      onEvent({ type: DeviceScanEventType.Empty });
      return () => undefined;
    }

    if (connectionType === PrinterConnectionType.Usb) {
      onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'TsplDriver không tự quét USB' } });
      return () => undefined;
    }

    onEvent({ type: DeviceScanEventType.Loading });
    let cancelled = false;
    const startedAt = Date.now();

    ensureBluetoothPermission()
      .then((granted) => {
        if (cancelled) {
          return;
        }

        if (!granted) {
          onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' } });
          return;
        }

        RNBluetoothClassic.startDiscovery()
          .then((devices) => {
            if (cancelled) {
              return;
            }

            onEvent({
              type: devices.length > 0 ? DeviceScanEventType.Found : DeviceScanEventType.Empty,
              devices: devices.map((d) => ({ deviceId: d.address, displayName: d.name ?? d.address, rawDevice: d as unknown as Record<string, unknown> })),
            });
            PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
          })
          .catch((error: unknown) => {
            if (cancelled) {
              return;
            }

            onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: String(error) } });
            PrinterLogger.scanFailed({ connectionType, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
          });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: String(error) } });
        PrinterLogger.scanFailed({ connectionType, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
      });

    return () => {
      cancelled = true;
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }

  async connect(printer: Printer): Promise<void> {
    this.setStatus(printer.id, PrinterStatus.Connecting);
    const startedAt = Date.now();

    try {
      if (printer.connection.type === PrinterConnectionType.Bluetooth) {
        const granted = await ensureBluetoothPermission();

        if (!granted) {
          throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' });
        }
      }

      const adapter = resolvePrinterAdapter(PrinterDriverType.Tspl, printer.connection.type);
      await adapter.connect(toConnectTarget(printer));

      this.connections.set(printer.id, adapter);
      this.contexts.set(printer.id, printer);
      this.setStatus(printer.id, PrinterStatus.Connected);
      PrinterLogger.connectSucceeded({ printerId: printer.id, protocol: PrinterDriverType.Tspl, connectionType: printer.connection.type, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, PrinterStatus.Error);
      PrinterLogger.connectFailed({ printerId: printer.id, protocol: PrinterDriverType.Tspl, connectionType: printer.connection.type, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, PrinterStatus.Disconnecting);
    const adapter = this.connections.get(printerId);

    try {
      await adapter?.disconnect();
    } catch (error) {
      this.setStatus(printerId, PrinterStatus.Error);
      PrinterLogger.disconnectFailed({ printerId, protocol: PrinterDriverType.Tspl, errorCode: errorCodeOf(error) });
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: error instanceof Error ? error.message : String(error) });
    } finally {
      this.connections.delete(printerId);
    }

    this.setStatus(printerId, PrinterStatus.Disconnected);
    PrinterLogger.disconnectSucceeded({ printerId, protocol: PrinterDriverType.Tspl });
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? PrinterStatus.Idle;
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) {
      this.listeners.set(printerId, new Set());
    }

    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  /** Nguồn render DUY NHẤT — chỉ còn `TsplBitmapStrategy` (TrueType/internal-font đã bỏ). */
  private buildBytes(printer: Printer, documents: PrintDocuments, rows: number): Uint8Array {
    const context: TsplStrategyContext = {
      printer,
      documents,
      printType: printer.type,
      paper: printer.paper,
      rows,
    };

    tsplBitmapStrategy.validate(context);
    return tsplBitmapStrategy.encode(context);
  }

  async testPrint(printer: Printer, documents: PrintDocuments, options?: PrintOptions): Promise<void> {
    const startedAt = Date.now();

    try {
      if (!this.connections.has(printer.id)) {
        await this.connect(printer);
      }

      const adapter = this.connections.get(printer.id);
      const rows = resolveRows(options);
      const bytes = this.buildBytes(printer, documents, rows);
      await adapter?.write(bytes);
      PrinterLogger.testPrintSucceeded({ printerId: printer.id, protocol: PrinterDriverType.Tspl, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({ printerId: printer.id, protocol: PrinterDriverType.Tspl, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async print(printerId: string, documents: PrintDocuments, options?: PrintOptions): Promise<void> {
    const printer = this.contexts.get(printerId);
    const adapter = this.connections.get(printerId);

    if (!printer || !adapter) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });
    }

    const startedAt = Date.now();

    try {
      const rows = resolveRows(options);
      const bytes = this.buildBytes(printer, documents, rows);
      await adapter.write(bytes);
      PrinterLogger.printSucceeded({ printerId, protocol: PrinterDriverType.Tspl, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.printFailed({ printerId, protocol: PrinterDriverType.Tspl, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const adapter = this.connections.get(printerId);

    if (!adapter || !adapter.canRead) {
      return null;
    }

    try {
      const query = encodeAsciiCommand('~!T\r\n');
      await adapter.write(query);
      const response = await adapter.read(IDENTIFY_TIMEOUT_MS);
      return response && response.length > 0 ? {} : null;
    } catch {
      return null;
    }
  }
}
```

Lưu ý: `installTsplFont` bị xoá hoàn toàn (không còn method này trên `TsplDriver`).

- [ ] **Step 7: Sửa `__tests__/TsplDriver.test.ts`**

Đọc file hiện tại. Xoá toàn bộ test case của `installTsplFont`. Đổi chữ ký gọi `connect(printer, driverEntry)` → `connect(printer)`, `testPrint(printer, driverEntry, documents, printType, options)` → `testPrint(printer, documents, options)`, `print(printerId, documents, printType, options)` → `print(printerId, documents, options)`. Đổi mọi enum sang PascalCase.

- [ ] **Step 8: Verify**

Run: `npx jest src/features/printer/drivers/tspl --silent`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(printer): TsplDriver drops TrueType/internal-font, uses TsplBitmapStrategy directly"
```

---

## Task 14: Đơn giản hoá `PrinterConnectionLock.ts`

**Files:**
- Modify: `src/features/printer/connection/PrinterConnectionLock.ts`
- Modify: `src/features/printer/connection/__tests__/PrinterConnectionLock.test.ts`

**Interfaces:**
- Consumes: `PrinterConnectionType` (Task 1), `PrinterDriverType` (Task 2), `Printer` (Task 6).
- Produces: `connectionResourceKey(input)` KHÔNG đổi logic (vẫn nhận `{ driverType, connection }` — vẫn cần `driverType` rời vì hàm này được gọi cả từ `PrintScheduler.resourceKeyFor(job)` nơi chưa có sẵn `Printer` đầy đủ, chỉ tra được `driver.type` + `connection`). `resourceKeyFor(printer: Printer)` bỏ tham số `driverType` rời — giờ tự đọc `printer.driver.type`.

- [ ] **Step 1: Sửa import + rename**

Đổi `import { ConnectionType } from '../models/printer/PrinterDevice';` → `import { PrinterConnectionType } from '../models/printer/PrinterConnection';`. Đổi `import { PrinterDriverType } from '../models/printer/PrinterDriver';` giữ nguyên tên import, chỉ đổi giá trị dùng bên trong. Đổi mọi `ConnectionType.usb/.bluetooth` → `PrinterConnectionType.Usb/.Bluetooth`, `PrinterDriverType.escpos` → `PrinterDriverType.EscPos`.

- [ ] **Step 2: Đổi `resourceKeyFor`**

```ts
/**
 * Tra resource key từ 1 `Printer` — helper dùng chung bởi
 * `PrinterConnectionService` và `PrinterConfigService`, wrapper mỏng quanh
 * `connectionResourceKey`. Mỗi `Printer` giờ chỉ có 1 driver nên không cần
 * tham số `driverType` rời như bản cũ.
 */
export const resourceKeyFor = (printer: Printer): string =>
  connectionResourceKey({ driverType: printer.driver.type, connection: printer.connection });
```

Phần còn lại của file (`connectionResourceKey`, `createResourceLock`, `PrinterConnectionLock`) không đổi logic — chỉ đổi enum reference như Step 1.

- [ ] **Step 3: Sửa test**

Đọc `__tests__/PrinterConnectionLock.test.ts`, đổi mọi lời gọi `resourceKeyFor(printer, driverType)` → `resourceKeyFor(printer)` (printer fixture đã có `printer.driver.type` sẵn), đổi enum sang PascalCase.

- [ ] **Step 4: Verify**

Run: `npx jest src/features/printer/connection/__tests__/PrinterConnectionLock.test.ts --silent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(printer): resourceKeyFor reads driverType from printer.driver"
```

---

## Task 15: Viết lại `PrinterConnectionService.ts`

**Files:**
- Modify: `src/features/printer/connection/PrinterConnectionService.ts`
- Modify: `src/features/printer/connection/__tests__/PrinterConnectionService.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver` mới (Task 11), `PrinterConnectionLock.resourceKeyFor(printer)` (Task 14), `Printer` (Task 6).
- Produces: `connect`/`disconnect`/`reconnect`/`reconnectAutoPrinters`/`connectDraft`/`disconnectForDriver`/`getStatus`/`onStatusChange`/`getStatusForDriver`/`onStatusChangeForDriver` — 2 hàm cuối GIỮ NGUYÊN (bypass repository, cần cho draft chưa lưu ở `useAddPrinterFlow`, xem Task 22), chỉ đổi `connect`/`disconnect` bên trong từ lặp `printer.drivers.map(...)` xuống thao tác thẳng `printer.driver` (không còn `Promise.allSettled`).

- [ ] **Step 1: Viết lại toàn bộ file**

```ts
import type { IPrinterDriver, Unsubscribe } from '../drivers/IPrinterDriver';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { Printer } from '../models/printer/Printer';
import { DriverRegistry } from '../drivers/DriverRegistry';
import { PrinterConnectionLock, resourceKeyFor, type createResourceLock } from './PrinterConnectionLock';
import { PrinterRepository, type createPrinterRepository } from '../storage/PrinterRepository';

type ResourceLockLike = ReturnType<typeof createResourceLock>;
type PrinterRepositoryLike = ReturnType<typeof createPrinterRepository>;

/**
 * Connection lifecycle trên máy in ĐÃ LƯU và draft chưa lưu — mọi lệnh đụng
 * kết nối native chạy qua `lock` để không interleave trên cùng resource. Print
 * dispatch (`print`/`testPrint`) nằm ở `PrinterPrintService` (anh em cùng
 * cấp), không phải service này.
 */
export const createPrinterConnectionService = (
  registry: Record<PrinterDriverType, IPrinterDriver> = DriverRegistry,
  repository: PrinterRepositoryLike = PrinterRepository,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const getDriver = (type: PrinterDriverType): IPrinterDriver => registry[type];

  const connect = async (printerId: string): Promise<void> => {
    const printer = repository.findOrThrow(printerId);
    await lock.runExclusive(resourceKeyFor(printer), () => getDriver(printer.driver.type).connect(printer));
  };

  const disconnect = async (printerId: string): Promise<void> => {
    const printer = repository.findOrThrow(printerId);
    await lock.runExclusive(resourceKeyFor(printer), () => getDriver(printer.driver.type).disconnect(printerId));
  };

  const reconnect = async (printerId: string): Promise<void> => {
    await disconnect(printerId).catch(() => undefined);
    await connect(printerId);
  };

  const reconnectAutoPrinters = (): void => {
    repository
      .getPrinters()
      .filter((p) => p.enabled && p.autoReconnect)
      .forEach((p) => {
        connect(p.id).catch(() => undefined);
      });
  };

  const connectDraft = async (printer: Printer): Promise<void> => {
    await getDriver(printer.driver.type).connect(printer);
  };

  const disconnectForDriver = async (type: PrinterDriverType, printerId: string): Promise<void> => {
    await getDriver(type).disconnect(printerId);
  };

  const getStatus = (printerId: string): PrinterStatus => {
    const printer = repository.findOrThrow(printerId);
    return getDriver(printer.driver.type).getStatus(printerId);
  };

  const onStatusChange = (printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe => {
    const printer = repository.findOrThrow(printerId);
    return getDriver(printer.driver.type).onStatusChange(printerId, callback);
  };

  /**
   * Bypass repository — cho draft CHƯA LƯU trong `useAddPrinterFlow` (printer
   * chưa có trong storage nên `getStatus`/`onStatusChange` ở trên sẽ throw
   * `PRINTER_NOT_FOUND`). Vẫn giữ ở bản atomic-driver này vì lý do tồn tại
   * không phải multi-driver dedup mà là "printer chưa tồn tại trong storage".
   */
  const getStatusForDriver = (type: PrinterDriverType, printerId: string): PrinterStatus => getDriver(type).getStatus(printerId);

  const onStatusChangeForDriver = (type: PrinterDriverType, printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe =>
    getDriver(type).onStatusChange(printerId, callback);

  return {
    connect,
    disconnect,
    reconnect,
    reconnectAutoPrinters,
    connectDraft,
    disconnectForDriver,
    getStatus,
    onStatusChange,
    getStatusForDriver,
    onStatusChangeForDriver,
  };
};

export const PrinterConnectionService = createPrinterConnectionService(DriverRegistry, PrinterRepository, PrinterConnectionLock);
```

Lưu ý: `connectDraft(printer, driver)` bản cũ nhận `driver` rời để connect 1 candidate đang dò (chưa nằm trong `printer.driver` thật) — bản mới bỏ tham số đó vì `draftPrinter` truyền vào LUÔN đã có `driver` gắn sẵn cho candidate đang thử (xem Task 20, `PrinterDiscoveryService` tự gắn `driver` vào draft trước khi gọi `connect`). `disconnectForDriver` giữ tham số `type` rời vì `useAddPrinterFlow` gọi nó lúc cleanup TRƯỚC KHI có `printer.driver` chắc chắn (unmount effect chỉ biết `driver.type` từ state cục bộ).

- [ ] **Step 2: Sửa test**

Đọc `__tests__/PrinterConnectionService.test.ts`. GIỮ test case của `getStatusForDriver`/`onStatusChangeForDriver` (chỉ đổi enum PascalCase) — 2 hàm này không đổi hành vi. Xoá test case liên quan `Promise.allSettled` nhiều driver (không còn — `connect`/`disconnect` giờ chỉ thao tác 1 driver duy nhất). Đổi `connectDraft(printer, driver)` → `connectDraft(printer)` (printer fixture có `driver` gắn sẵn).

- [ ] **Step 3: Verify**

Run: `npx jest src/features/printer/connection --silent`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(printer): PrinterConnectionService operates on printer.driver directly"
```

---

## Task 16: Viết lại `PrinterConfigService.ts`

**Files:**
- Modify: `src/features/printer/management/PrinterConfigService.ts`
- Modify: `src/features/printer/management/__tests__/PrinterConfigService.test.ts`

**Interfaces:**
- Consumes: `RenderMode` (Task 2), `PrintPaperConfig` (Task 4), `resourceKeyFor(printer)` (Task 14).
- Produces: `setRenderMode(printerId, renderMode)` (thay `installTsplFont`/`setTsplRenderMode`/`setTsplInternalFont`/`setEscPosRenderMode` — gộp làm 1 vì `PrinterDriverConfig` giờ dùng chung 1 shape), `setPaper(printerId, patch)` (thay `setDriverMedia`, ghi vào `printer.paper` thay vì `driver.config.media`).

- [ ] **Step 1: Viết lại toàn bộ file**

```ts
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { RenderMode } from '../models/printer/PrinterDriver';
import { PrinterRepository, type createPrinterRepository } from '../storage/PrinterRepository';

type PrinterRepositoryLike = ReturnType<typeof createPrinterRepository>;

/**
 * Cấu hình render mode / giấy cho 1 printer ĐÃ LƯU. Printer draft chưa lưu →
 * no-op ở cả 2 setter — modal Thêm máy in mang state vào lúc Save (xem
 * `useAddPrinterFlow.ts`).
 */
export const createPrinterConfigService = (repository: PrinterRepositoryLike = PrinterRepository) => {
  const setRenderMode = (printerId: string, renderMode: RenderMode): void => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);

    if (!printer) {
      return;
    }

    repository.savePrinters(
      repository.getPrinters().map((p) => (p.id !== printerId ? p : { ...p, driver: { ...p.driver, config: { ...p.driver.config, renderMode } } })),
    );
  };

  const setPaper = (printerId: string, patch: Partial<PrintPaperConfig>): void => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);

    if (!printer) {
      return;
    }

    repository.savePrinters(repository.getPrinters().map((p) => (p.id !== printerId ? p : { ...p, paper: { ...p.paper, ...patch } })));
  };

  return { setRenderMode, setPaper };
};

export const PrinterConfigService = createPrinterConfigService(PrinterRepository);
```

Lưu ý: bỏ hẳn dependency vào `DriverRegistry`/`PrinterConnectionLock`/`TsplDriver`/`resourceKeyFor` — không còn `installTsplFont` (yêu cầu connect+lock+DOWNLOAD) nên service này giờ CHỈ đụng storage, không đụng connection native nào cả. `RenderMode` import không dùng trực tiếp trong thân hàm (chỉ ở type annotation tham số) — vẫn cần import cho type.

- [ ] **Step 2: Sửa test**

Đọc `__tests__/PrinterConfigService.test.ts`. Xoá TOÀN BỘ test case của `installTsplFont` (kể cả case connect-tự-động, lock, disconnect-sau-khi-xong). Đổi `setTsplRenderMode`/`setEscPosRenderMode` → `setRenderMode`, `setTsplInternalFont` xoá hẳn, `setDriverMedia` → `setPaper`. Cập nhật fixture printer theo shape mới (`printer.paper`, `printer.driver`).

- [ ] **Step 3: Verify**

Run: `npx jest src/features/printer/management --silent`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(printer): PrinterConfigService drops TSPL font install, merges renderMode setters"
```

---

## Task 17: Viết lại `PrintRoutingService.ts`, `PrintScheduler.ts`, `PrinterPrintService.ts`

**Files:**
- Modify: `src/features/printer/printing/PrintRoutingService.ts`
- Modify: `src/features/printer/printing/PrintScheduler.ts`
- Modify: `src/features/printer/printing/PrinterPrintService.ts`
- Modify: `src/features/printer/printing/PrintService.ts`
- Modify: `src/features/printer/printing/__tests__/PrinterPrintService.test.ts`
- Modify: `src/features/printer/printing/__tests__/PrintService.test.ts`

**Interfaces:**
- Consumes: `Printer` (Task 6), `resourceKeyFor(printer)` (Task 14), `IPrinterDriver` mới (Task 11), `PrintJobStatus`/`PrintResultStatus` (Task 5).
- Produces: `PrintRoutingService.resolveTargets(printType): Printer[]` (không còn `{printer, driver}` pair). `PrintScheduler.enqueue/retry` không đổi chữ ký ngoài. `PrinterPrintService.print(printerId, documents)` — bỏ `printType` (dùng `printer.type` làm assertion nội bộ), `testPrint(printer, documents, options?)` — bỏ `driver`/`printType`.

- [ ] **Step 1: Viết lại `PrintRoutingService.ts`**

```ts
import type { PrintType } from '../models/printing/PrintType';
import type { Printer } from '../models/printer/Printer';
import { PrinterRepository } from '../storage/PrinterRepository';

interface PrintRoutingServiceDeps {
  getPrinters: typeof PrinterRepository.getPrinters;
}

/**
 * CHỈ biết "content type nào → printer nào" (spec §4) — mỗi `Printer` giờ cố
 * định đúng 1 `type` nên không còn bước tìm driver bên trong nữa.
 */
export const createPrintRoutingService = (deps: PrintRoutingServiceDeps) => {
  const resolveTargets = (printType: PrintType): Printer[] =>
    deps.getPrinters().filter((printer) => printer.enabled && printer.type === printType);

  return { resolveTargets };
};

export const PrintRoutingService = createPrintRoutingService({ getPrinters: PrinterRepository.getPrinters });
```

`PrintTarget` (re-export cũ ở đầu file) bị xoá — không còn `{printer, driver}` pair, chỗ gọi dùng thẳng `Printer`. Tìm mọi nơi import `PrintTarget` từ file này (`PrintService.ts` là nơi chính) và đổi sang dùng `Printer` trực tiếp.

- [ ] **Step 2: Sửa `PrintScheduler.ts`** — đổi `resourceKeyFor`

```ts
const resourceKeyFor = (job: PrintJob): string => {
  const printer = printerService.getPrinters().find((p) => p.id === job.printerId);

  if (!printer) {
    return job.printerId;
  }

  return connectionResourceKey({ driverType: printer.driver.type, connection: printer.connection });
};
```

Phần còn lại của file (`enqueue`, `retry`, `toPrinterError`) không đổi logic — chỉ đổi enum `PrintJobStatus.printing/.success/.failed` sang PascalCase (đã làm ở Task 5, xác nhận lại ở đây nếu sót).

- [ ] **Step 3: Viết lại `PrinterPrintService.ts`**

```ts
import type { IPrinterDriver, PrintDocuments, PrintOptions } from '../drivers/IPrinterDriver';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { Printer } from '../models/printer/Printer';
import { PrinterErrorException, PrinterErrorCode } from '../errors/PrinterError';
import { DriverRegistry } from '../drivers/DriverRegistry';
import { PrinterConnectionLock, resourceKeyFor, type createResourceLock } from '../connection/PrinterConnectionLock';
import { PrinterRepository, type createPrinterRepository } from '../storage/PrinterRepository';

type ResourceLockLike = ReturnType<typeof createResourceLock>;
type PrinterRepositoryLike = ReturnType<typeof createPrinterRepository>;

/**
 * Thực thi print/test-print cho 1 printer cụ thể — tách khỏi
 * `PrinterConnectionService` (chỉ còn connection lifecycle).
 */
export const createPrinterPrintService = (
  registry: Record<PrinterDriverType, IPrinterDriver> = DriverRegistry,
  repository: PrinterRepositoryLike = PrinterRepository,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const getDriver = (type: PrinterDriverType): IPrinterDriver => registry[type];

  /**
   * KHÔNG tự `lock.runExclusive` — luôn được `PrintScheduler.enqueue()` gọi
   * từ BÊN TRONG 1 `lock.runExclusive` đã acquire sẵn ở tầng scheduler cùng
   * `resourceKey`. `testPrint()` tự lock vì được UI gọi thẳng, không qua scheduler.
   */
  const print = async (printerId: string, documents: PrintDocuments, options?: PrintOptions): Promise<void> => {
    const printer = repository.findOrThrow(printerId);
    const driver = getDriver(printer.driver.type);

    if (driver.getStatus(printerId) !== PrinterStatus.Connected) {
      await driver.connect(printer);
    }

    await driver.print(printerId, documents, options);
  };

  const testPrint = async (printer: Printer, documents: PrintDocuments, options?: PrintOptions): Promise<void> => {
    await lock.runExclusive(resourceKeyFor(printer), () => getDriver(printer.driver.type).testPrint(printer, documents, options));
  };

  return { print, testPrint };
};

export const PrinterPrintService = createPrinterPrintService(DriverRegistry, PrinterRepository, PrinterConnectionLock);
```

Lưu ý: `PrinterErrorCode.NO_AVAILABLE_PRINTER` không còn ném ở đây (trước dùng khi KHÔNG driver nào trong `drivers[]` nhận `printType` — giờ printer luôn có đúng 1 driver phục vụ đúng `printer.type`, nếu gọi sai `printerId` thì `repository.findOrThrow` đã ném `PRINTER_NOT_FOUND` trước đó). Import `PrinterErrorException`/`PrinterErrorCode` có thể không còn dùng trực tiếp trong thân hàm — XOÁ import nếu `tsc`/`eslint` báo unused (không giữ import chết).

- [ ] **Step 4: Sửa `PrintService.ts`**

Đọc file hiện tại — sửa mọi chỗ gọi `PrinterPrintService.print(printerId, documents, printType)` → bỏ `printType` (đã có ở `printer.type`, PrintScheduler/PrintService không cần truyền lại). Đổi chỗ dùng `PrintTarget` (đã xoá ở Step 1) sang lặp thẳng `Printer[]` từ `PrintRoutingService.resolveTargets`.

- [ ] **Step 5: Sửa test**

Đọc `__tests__/PrinterPrintService.test.ts` và `__tests__/PrintService.test.ts`. Đổi mọi lời gọi theo chữ ký mới ở Step 3-4. Xoá case "không driver nào nhận printType" (không còn khả thi — mỗi printer chỉ có 1 driver, 1 type cố định). Giữ nguyên case "print() does NOT acquire the connection lock" (bất biến quan trọng, không đổi).

- [ ] **Step 6: Verify**

Run: `npx jest src/features/printer/printing --silent`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(printer): simplify print routing/scheduling for the single-driver Printer shape"
```

---

## Task 18: `PrinterRepository.ts` dedup theo `(identityKey, type)` + bump `PrinterStorage.ts`

**Files:**
- Modify: `src/features/printer/storage/PrinterRepository.ts`
- Modify: `src/features/printer/storage/__tests__/PrinterRepository.test.ts`
- Modify: `src/features/printer/storage/PrinterStorage.ts`
- Modify: `src/features/printer/storage/__tests__/PrinterStorage.test.ts`

**Interfaces:**
- Consumes: `Printer` (Task 6), `resolveIdentityKey` (Task 10).
- Produces: `assertNoDuplicateIdentity` chặn trùng cặp `(identityKey, type)` thay vì chỉ `identityKey`. `CURRENT_STORAGE_VERSION` tăng lên 7.

- [ ] **Step 1: Sửa `assertNoDuplicateIdentity` trong `PrinterRepository.ts`**

```ts
const assertNoDuplicateIdentity = (printer: Printer): void => {
  const collision = getPrinters().find(
    (p) => p.id !== printer.id && p.identityKey === printer.identityKey && p.type === printer.type,
  );

  if (collision) {
    throw new PrinterErrorException({
      code: PrinterErrorCode.PRINTER_ALREADY_EXISTS,
      message: `Máy in này đã được thêm cho loại nội dung này với tên "${collision.name}".`,
    });
  }
};
```

Phần còn lại của file (`findOrThrow`, `withRecomputedIdentity`, `addPrinter`, `updatePrinter`, `removePrinter`, `setEnabled`) không đổi logic.

- [ ] **Step 2: Sửa test**

Đọc `__tests__/PrinterRepository.test.ts`. Cập nhật test case trùng identity: thêm case "cùng `identityKey` KHÁC `type` → được phép" (mới, phản ánh use-case máy in kép khổ dùng chung 1 connection nhưng 2 driver/2 `Printer` khác `type`), và case "cùng `identityKey` cùng `type` → chặn" (giữ hành vi cốt lõi, đổi message assertion).

- [ ] **Step 3: Bump `PrinterStorage.ts`**

```ts
// v7: Printer đổi từ "1 connection + drivers[] (1-2 phần tử, mỗi driver tự
//     giữ contentTypes/media riêng)" sang "1 connection + đúng 1 driver +
//     đúng 1 paper + đúng 1 type" (atomic per-PrintType config) — đồng thời
//     bỏ hẳn TsplDriverConfig.font/internalFont (TrueType/internal-font đã
//     xoá tính năng). Shape đổi không tương thích ngược → reset (không migrate),
//     xem ARCHITECTURE.md và spec 2026-09-11.
const CURRENT_STORAGE_VERSION = 7;
```

Giữ nguyên toàn bộ phần còn lại của file (comment lịch sử v3-v6, `resetIfOutdated`, `PrinterStorage` object).

- [ ] **Step 4: Verify**

Run: `npx jest src/features/printer/storage --silent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(printer): dedupe by (identityKey, type), bump storage to v7"
```

---

## Task 19: Viết lại `PrinterDiscoveryService.ts` + rename `DeviceScanService.ts`

**Files:**
- Modify: `src/features/printer/discovery/PrinterDiscoveryService.ts`
- Modify: `src/features/printer/discovery/__tests__/PrinterDiscoveryService.test.ts`
- Modify: `src/features/printer/discovery/DeviceScanService.ts`
- Modify: `src/features/printer/discovery/__tests__/DeviceScanService.test.ts`

**Interfaces:**
- Consumes: `Printer` (Task 6), `DriverSource`/`PrinterDriverType` (Task 2), `getDriverCapabilities` (Task 7), `DiscoveryStage` PascalCase (đã đổi giá trị ở Task 5 — task này viết lại phần orchestration dùng `DiscoveryStage`).
- Produces: `DiscoverPrinterInput { draftPrinter: Printer }` (bỏ `excludedDrivers` — mỗi lần dò chỉ tìm ĐÚNG 1 driver, không còn khái niệm "dò thêm driver thứ 2"). Candidate list lọc theo `getDriverCapabilities(type).contentTypes.includes(draftPrinter.type)` — ESC/POS không còn được thử khi `type === Label`. `DiscoveryEvent` thêm field `driver?: PrinterDriver` (driver đã xác nhận, để caller gán thẳng `printer.driver = event.driver` — không cần tự dựng lại như bản cũ).

- [ ] **Step 1: Viết lại toàn bộ `PrinterDiscoveryService.ts`**

```ts
import type { IPrinterDriver } from '../drivers/IPrinterDriver';
import { DriverSource, PrinterDriverType } from '../models/printer/PrinterDriver';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import type { Printer } from '../models/printer/Printer';
import type { PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import { PrinterErrorCode, type PrinterError } from '../errors/PrinterError';
import { PrinterLogger } from '../logging/PrinterLogger';
import { getDriverCapabilities } from '../drivers/DriverCapabilities';

/**
 * Thử `Tspl` trước `EscPos`: `TsplDriver.identify()` là 1 discriminator thật
 * (gửi lệnh dò `~!T`), trong khi ESC/POS's `identify()` chỉ chứng minh "đã
 * connect thành công". Qua USB cả 2 driver luôn trả `null` — cố ý.
 */
const CANDIDATE_ORDER: PrinterDriverType[] = [PrinterDriverType.Tspl, PrinterDriverType.EscPos];

export const DiscoveryStage = {
  Connecting: 'Connecting',
  Identifying: 'Identifying',
  Identified: 'Identified',
  UnknownProtocol: 'UnknownProtocol',
  Error: 'Error',
} as const;

export type DiscoveryStage = (typeof DiscoveryStage)[keyof typeof DiscoveryStage];

export interface DiscoveryEvent {
  stage: DiscoveryStage;
  protocol?: PrinterDriverType;
  /** Driver đã xác nhận — chỉ có khi `stage === 'Identified'`. Caller gán thẳng `printer.driver = event.driver`. */
  driver?: PrinterDriver;
  deviceInfo?: PrinterDeviceInfo;
  error?: PrinterError;
}

export interface DiscoverPrinterInput {
  /**
   * Draft `Printer` ĐẦY ĐỦ (id, connection, type, paper, driver placeholder,
   * v.v.) do caller (`useProtocolDiscovery`) tự dựng — service này KHÔNG tự
   * tổng hợp draft. `draftPrinter.driver` là placeholder, bị GHI ĐÈ theo từng
   * candidate lúc thử — chỉ `draftPrinter.type`/`.connection`/`.paper` được
   * dùng nguyên vẹn. Candidate bị lọc theo `getDriverCapabilities(type).contentTypes`
   * có chứa `draftPrinter.type` hay không (vd ESC/POS không được thử khi `type === Label`).
   */
  draftPrinter: Printer;
}

export type Unsubscribe = () => void;

export const createDiscoverDriver =
  (registry: Record<PrinterDriverType, IPrinterDriver>) =>
  (input: DiscoverPrinterInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      const startedAt = Date.now();
      const { draftPrinter } = input;
      const printerId = draftPrinter.id;
      const connectionType = draftPrinter.connection.type;
      const candidates = CANDIDATE_ORDER.filter(
        (type) => Boolean(registry[type]) && getDriverCapabilities(type).contentTypes.includes(draftPrinter.type),
      );
      const candidatesTried: PrinterDriverType[] = [];
      let connectFailures = 0;

      PrinterLogger.discoveryStarted({ printerId, connectionType, candidates });

      for (const type of candidates) {
        if (cancelled) {
          return;
        }

        candidatesTried.push(type);
        const driver = registry[type];
        const attemptDriver: PrinterDriver = { type, source: DriverSource.Auto, config: { ...getDriverCapabilities(type).defaultConfig } };
        const attemptPrinter: Printer = { ...draftPrinter, driver: attemptDriver };
        const disconnectQuietly = (): Promise<void> => driver.disconnect(printerId).catch(() => undefined);
        onEvent({ stage: DiscoveryStage.Connecting, protocol: type });

        try {
          await driver.connect(attemptPrinter);
        } catch {
          connectFailures += 1;
          PrinterLogger.discoveryCandidateRejected({ printerId, protocol: type, connectionType, reason: 'connect_failed' });
          continue;
        }

        if (cancelled) {
          await disconnectQuietly();
          return;
        }

        onEvent({ stage: DiscoveryStage.Identifying, protocol: type });
        const deviceInfo = await driver.identify(printerId).catch(() => null);

        if (cancelled) {
          await disconnectQuietly();
          return;
        }

        if (deviceInfo) {
          onEvent({ stage: DiscoveryStage.Identified, protocol: type, driver: attemptDriver, deviceInfo });
          PrinterLogger.protocolDetected({ printerId, protocol: type, connectionType, candidatesTried, durationMs: Date.now() - startedAt });
          return;
        }

        PrinterLogger.discoveryCandidateRejected({ printerId, protocol: type, connectionType, reason: 'not_confirmed' });
        await disconnectQuietly();
      }

      if (cancelled) {
        return;
      }

      if (candidates.length === 0 || connectFailures === candidates.length) {
        onEvent({ stage: DiscoveryStage.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Không thể kết nối tới máy in' } });
        PrinterLogger.discoveryFailed({ printerId, connectionType, candidatesTried, durationMs: Date.now() - startedAt });
        return;
      }

      onEvent({ stage: DiscoveryStage.UnknownProtocol });
      PrinterLogger.protocolUnknown({ printerId, connectionType, candidatesTried, durationMs: Date.now() - startedAt });
    };

    run();

    return () => {
      cancelled = true;
    };
  };
```

- [ ] **Step 2: Sửa test**

Đọc `__tests__/PrinterDiscoveryService.test.ts`. Cập nhật fixture `draftPrinter` theo shape mới (có `type`, `paper`, `driver` placeholder). Thêm case mới: `draftPrinter.type === Label` → candidate list chỉ còn `[Tspl]` (ESC/POS bị lọc bởi capability), xác nhận `EscPosDriver.connect` KHÔNG được gọi trong case này. Đổi mọi `DiscoveryStage.connecting/...` → PascalCase. Đổi assertion `event.protocol`/thêm assertion `event.driver` ở case `Identified`.

- [ ] **Step 3: Sửa `DeviceScanService.ts`**

Đọc file hiện tại — chỉ cần đổi `ConnectionType` → `PrinterConnectionType` (import từ `PrinterConnection`, giá trị PascalCase) theo đúng mẫu ở Task 1 Step 3. Không đổi logic (`scanDevices`, `scanForConnectionType`, `discoverDriver` giữ nguyên cấu trúc).

- [ ] **Step 4: Sửa `__tests__/DeviceScanService.test.ts`** — đổi enum PascalCase tương ứng.

- [ ] **Step 5: Verify**

Run: `npx jest src/features/printer/discovery --silent`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(printer): filter discovery candidates by printType capability, single confirmed driver"
```

---

## Task 20: Viết lại `testing/printerFixtures.ts` + `testing/printerServiceTestKit.ts`

**Files:**
- Modify: `src/features/printer/testing/printerFixtures.ts`
- Modify: `src/features/printer/testing/printerServiceTestKit.ts`

**Interfaces:**
- Consumes: `Printer`/`PrinterDriver`/`PrinterConnection` mới, `RenderMode`/`PrinterDriverType`/`DriverSource` (Task 2), `PrinterConnectionType` (Task 1), `PrintPaperType`/`PaperSize` (Task 4), `PrinterStatus` (Task 5).
- Produces: `makePrinter`, `makeEscPosDriver`, `makeTsplDriver` (thay `makeEscPosDriverEntry`/`makeTsplDriverEntry` — bỏ tham số `media`/`contentTypes`, không còn ý nghĩa ở cấp driver), `makeMockDriver`, `basePrinter`, `escposDriverEntry`, `tsplDriverEntry` (giữ 2 export cuối để không phá vỡ mọi nơi đang `import { escposDriverEntry } from '.../printerServiceTestKit'`).

- [ ] **Step 1: Viết lại `printerFixtures.ts`**

```ts
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { DriverSource, PrinterDriverType, RenderMode } from '../models/printer/PrinterDriver';
import type { Printer } from '../models/printer/Printer';
import type { PrinterConnection } from '../models/printer/PrinterConnection';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import { PaperSize, PrintPaperType } from '../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { PrintType } from '../models/printing/PrintType';

export const DEFAULT_PAPER: PrintPaperConfig = { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm80 };

export const makeEscPosDriver = (o: Partial<PrinterDriver> = {}): PrinterDriver => ({
  type: PrinterDriverType.EscPos,
  source: DriverSource.Auto,
  config: { renderMode: RenderMode.Encoder },
  ...o,
});

export const makeTsplDriver = (o: Partial<PrinterDriver> = {}): PrinterDriver => ({
  type: PrinterDriverType.Tspl,
  source: DriverSource.Auto,
  config: { renderMode: RenderMode.Bitmap },
  ...o,
});

const DEFAULT_CONNECTION: PrinterConnection = { type: PrinterConnectionType.Lan, host: '192.168.1.10', port: 9100 };

export const makePrinter = (o: Partial<Printer> = {}): Printer => ({
  id: 'p1',
  identityKey: 'lan:192.168.1.10:9100',
  type: PrintType.Receipt,
  name: 'Máy in test',
  driver: makeEscPosDriver(),
  connection: DEFAULT_CONNECTION,
  paper: { ...DEFAULT_PAPER },
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...o,
});
```

- [ ] **Step 2: Viết lại `printerServiceTestKit.ts`**

```ts
import type { IPrinterDriver } from '../drivers/IPrinterDriver';
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { DriverSource, PrinterDriverType, RenderMode, type PrinterDriver } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { PaperSize, PrintPaperType } from '../models/paper/PrintPaperConfig';
import { type Printer } from '../models/printer/Printer';
import { PrintType } from '../models/printing/PrintType';

/**
 * Fixture dùng chung cho các file test service — nằm ngoài `__tests__/` và
 * không có đuôi `.test.` nên Jest bỏ qua.
 */
export const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue(PrinterStatus.Connected),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  print: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  ...overrides,
});

export const escposDriverEntry: PrinterDriver = { type: PrinterDriverType.EscPos, source: DriverSource.Auto, config: { renderMode: RenderMode.Encoder } };
export const tsplDriverEntry: PrinterDriver = { type: PrinterDriverType.Tspl, source: DriverSource.Auto, config: { renderMode: RenderMode.Bitmap } };

export const basePrinter: Printer = {
  id: 'p1',
  identityKey: 'lan:192.168.1.10:9100',
  type: PrintType.Receipt,
  name: 'Máy in hóa đơn quầy 1',
  driver: escposDriverEntry,
  connection: { type: PrinterConnectionType.Lan, host: '192.168.1.10', port: 9100 },
  paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm80 },
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
```

- [ ] **Step 3: Grep mọi nơi import từ 2 file này để rà theo API mới**

Run: `grep -rl "printerFixtures\|printerServiceTestKit" src/features/printer --include=*.ts --include=*.tsx`

Với mỗi file kết quả (đều là test), đọc và cập nhật lời gọi `makeEscPosDriverEntry`/`makeTsplDriverEntry` (đã xoá) → `makeEscPosDriver`/`makeTsplDriver`, bỏ tham số `contentTypes`/`media` (không còn nhận), và mọi `printer.drivers[0]` → `printer.driver`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "printerFixtures|printerServiceTestKit|makeEscPosDriverEntry|makeTsplDriverEntry"`
Expected: Không có output.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(printer): update shared test fixtures for the atomic Printer shape"
```

---

## Task 21: Viết lại 4 hook con — `useConnectionSetup`, `useProtocolDiscovery`, `useTestPrint`, `useDriverConfig`

Đây là phần thay đổi HÀNH VI lớn nhất: bỏ hẳn khái niệm "dò thêm driver thứ 2 trong 1 lần mở modal" (`showAddDriverHint`, `excludedDrivers`, `addDriverToList`, `onToggleContentType` theo từng driver, cấu hình font TrueType). Mỗi lần mở flow chỉ có 1 driver (`driver?: PrinterDriver` — `undefined` cho tới khi discovery xác nhận).

**Files:**
- Modify: `src/features/printer/hooks/addPrinter/useConnectionSetup.ts`
- Modify: `src/features/printer/hooks/addPrinter/useProtocolDiscovery.ts`
- Modify: `src/features/printer/hooks/addPrinter/useTestPrint.ts`
- Modify: `src/features/printer/hooks/addPrinter/useDriverConfig.ts`
- Modify (test tương ứng, nếu tồn tại — kiểm tra `hooks/addPrinter/__tests__/`, hiện các hook con này không có test file riêng theo convention project (chỉ `useAddPrinterFlow.test.tsx` test tích hợp cả luồng) — nếu Task này phát hiện có, cập nhật theo cùng logic.

**Interfaces:**
- Consumes: `Printer`/`PrinterDriver`/`PrinterConnectionType`/`RenderMode`/`DiscoveryStage`/`DiscoverPrinterInput`/`DiscoveryEvent` từ các task trước.
- Produces (interface MỚI dùng ở Task 22 `useAddPrinterFlow.ts`):
  - `useConnectionSetup({ initialValues, printerId, printType, hasDriver, getConnectionState, getProtocolState, resetConnectionResult })` — đổi `drivers: PrinterDriver[]` → `hasDriver: boolean`, thêm `printType: PrintType` (để check trùng `(identityKey, type)` đúng cặp).
  - `useProtocolDiscovery({ initialValues, hasDriver, connectionType, lanForm, discoveryUnsubscribeRef, buildDraftPrinter, setDriver, refreshUsbSerial, prefillDisplayName })` — đổi `drivers`/`addDriverToList` → `hasDriver`/`setDriver` (setter đơn, không append mảng).
  - `useTestPrint({ driver, displayForm, buildDraftPrinter, captureBillImage })` — CHỈ 1 nút in thử (không còn Receipt/Label riêng — `printer.type` đã cố định loại nào).
  - `useDriverConfig({ printerId, driver, setDriver, paper, setPaper })` — bỏ `onToggleContentType`/font TSPL, còn `onSelectRenderMode`/`onChangePaper`.

- [ ] **Step 1: Viết lại `useConnectionSetup.ts`**

```ts
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { getCurrentWifiIp } from '../../discovery/NetworkInfoService';
import { buildBluetoothConnection, buildLanConnection, buildUsbConnection, deviceFromConnection, resolveIdentityKey } from '../../discovery/PrinterResolver';
import { ThermalPrinterModule } from '../../adapters/native/PrinterNativeModule';
import { lanConnectionSchema, type LanConnectionValues } from '../../forms/addPrinter/LanConnectionSchema';
import type { ConnectionState, ProtocolState } from '../../components/StatusPanel';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import type { Printer } from '../../models/printer/Printer';
import type { PrinterDevice, UsbRawDevice } from '../../models/printer/PrinterDevice';
import type { PrintType } from '../../models/printing/PrintType';

/**
 * Input cho {@link useConnectionSetup}. `getConnectionState`/`getProtocolState`
 * đọc state của {@link useProtocolDiscovery} tại thời điểm handler chạy (không
 * phải render) — coordinator cung cấp qua ref bridge để phá vòng phụ thuộc.
 */
export interface UseConnectionSetupInput {
  initialValues?: Printer;
  printerId: string;
  /** Loại nội dung CỐ ĐỊNH của printer này — dùng để check trùng đúng cặp `(identityKey, type)`. */
  printType: PrintType;
  /** true khi đã xác nhận driver — khoá input kết nối, không cho đổi giữa chừng. */
  hasDriver: boolean;
  getConnectionState: () => ConnectionState;
  getProtocolState: () => ProtocolState;
  resetConnectionResult: () => void;
}

/**
 * State + hàm cho phần "cách kết nối" (USB/BLE/LAN) của luồng Thêm/Sửa máy in:
 * chọn thiết bị, nhập IP/port LAN, tự lấy IP WiFi, tính identityKey và cảnh báo
 * trùng máy in đã lưu.
 */
export const useConnectionSetup = ({
  initialValues,
  printerId,
  printType,
  hasDriver,
  getConnectionState,
  getProtocolState,
  resetConnectionResult,
}: UseConnectionSetupInput) => {
  const [connectionType, setConnectionType] = useState<PrinterConnectionType>(initialValues?.connection.type ?? PrinterConnectionType.Usb);
  const [selectedDevice, setSelectedDevice] = useState<PrinterDevice | undefined>(
    initialValues ? deviceFromConnection(initialValues.connection) : undefined,
  );
  const [identityErrorMessage, setIdentityErrorMessage] = useState<string | undefined>(undefined);
  const [detectedLanIp, setDetectedLanIp] = useState<string | null>(null);
  const [lanIpFetchError, setLanIpFetchError] = useState<string | undefined>(undefined);

  const lanForm = useForm<LanConnectionValues>({
    resolver: zodResolver(lanConnectionSchema),
    defaultValues: {
      lanIp: initialValues?.connection.type === PrinterConnectionType.Lan ? initialValues.connection.host : '',
      lanPort: initialValues?.connection.type === PrinterConnectionType.Lan ? String(initialValues.connection.port) : '',
    },
  });

  const buildLan = (values: LanConnectionValues) => ({ ip: values.lanIp, port: Number(values.lanPort) });

  /** Không cần biết protocol — xem `resolveIdentityKey`. */
  const currentIdentityKey = (): string | null => {
    try {
      if (connectionType === PrinterConnectionType.Lan) {
        const values = lanForm.getValues();

        if (!lanConnectionSchema.safeParse(values).success) {
          return null;
        }

        const { ip, port } = buildLan(values);
        return resolveIdentityKey(buildLanConnection(ip, port));
      }

      if (!selectedDevice) {
        return null;
      }

      const connection = connectionType === PrinterConnectionType.Usb ? buildUsbConnection(selectedDevice) : buildBluetoothConnection(selectedDevice);
      return resolveIdentityKey(connection);
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

    const collision = PrinterRepository.getPrinters().find((p) => p.id !== printerId && p.identityKey === key && p.type === printType);
    setIdentityErrorMessage(collision ? `Máy in này đã được thêm cho loại nội dung này với tên "${collision.name}".` : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy lại khi connectionType/selectedDevice/lan form thay đổi, đọc qua currentIdentityKey() ở trên
  }, [connectionType, selectedDevice, lanForm.watch('lanIp'), lanForm.watch('lanPort')]);

  /**
   * `UsbDevice.serialNumber` chỉ đọc được sau khi user cấp quyền USB (bấm "Kết
   * nối") — lúc scan trả `null`. Gọi lại enumerate sau khi connect thành công
   * để identityKey pin thêm serial (`usb:<vid>:<pid>:<serial>`) thay vì chỉ `vid:pid`.
   */
  const refreshUsbSerial = async (): Promise<void> => {
    if (connectionType !== PrinterConnectionType.Usb || !selectedDevice) {
      return;
    }

    const raw = selectedDevice.rawDevice as unknown as UsbRawDevice;

    if (raw.serialNumber) {
      return;
    }

    const devices = await ThermalPrinterModule.discoverPrinters(PrinterConnectionType.Usb).catch(() => []);
    const rich = devices.find((d) => d.vendorId === Number(raw.vendorId) && d.productId === Number(raw.productId));

    if (!rich?.serialNumber) {
      return;
    }

    setSelectedDevice((prev) => (prev ? { ...prev, rawDevice: { ...prev.rawDevice, serialNumber: rich.serialNumber } } : prev));
  };

  const resetIfDirty = (): void => {
    if (getConnectionState() !== 'idle' || getProtocolState() !== 'idle') {
      resetConnectionResult();
    }
  };

  const onConnectionTypeChange = (value: PrinterConnectionType): void => {
    if (hasDriver) {
      return;
    }

    setConnectionType(value);
    setSelectedDevice(undefined);
    resetIfDirty();
  };

  const onSelectDevice = (device: PrinterDevice): void => {
    if (hasDriver) {
      return;
    }

    setSelectedDevice(device);
    resetIfDirty();
  };

  const onLanIpChange = (text: string): void => {
    if (hasDriver) {
      return;
    }

    lanForm.setValue('lanIp', text);
    resetIfDirty();
  };

  const onLanPortChange = (text: string): void => {
    if (hasDriver) {
      return;
    }

    lanForm.setValue('lanPort', text);
    resetIfDirty();
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
    if (!detectedLanIp) {
      return;
    }

    onLanIpChange(detectedLanIp);
  };

  return {
    connectionType,
    selectedDevice,
    lanForm,
    detectedLanIp,
    lanIpFetchError,
    onFetchLanIp,
    onAutoFillLanIp,
    buildLan,
    currentIdentityKey,
    identityErrorMessage,
    onConnectionTypeChange,
    onSelectDevice,
    onLanIpChange,
    onLanPortChange,
    refreshUsbSerial,
  };
};
```

- [ ] **Step 2: Viết lại `useProtocolDiscovery.ts`**

```ts
import { useState, type MutableRefObject } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { DeviceScanService } from '../../discovery/DeviceScanService';
import { PrinterConnectionService } from '../../connection/PrinterConnectionService';
import { getDriverCapabilities } from '../../drivers/DriverCapabilities';
import type { ConnectionState, ProtocolState } from '../../components/StatusPanel';
import { DiscoveryStage, type DiscoveryEvent } from '../../discovery/PrinterDiscoveryService';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { DriverSource, type PrinterDriver, type PrinterDriverType } from '../../models/printer/PrinterDriver';
import type { Printer } from '../../models/printer/Printer';
import type { PrinterDeviceInfo } from '../../models/printer/PrinterDevice';
import type { LanConnectionValues } from '../../forms/addPrinter/LanConnectionSchema';

/**
 * Input cho {@link useProtocolDiscovery}. `buildDraftPrinter`/`setDriver`/
 * `refreshUsbSerial`/`prefillDisplayName` do coordinator / {@link useConnectionSetup}
 * sở hữu — hook này chỉ điều phối state machine dò protocol.
 */
export interface UseProtocolDiscoveryInput {
  initialValues?: Printer;
  hasDriver: boolean;
  connectionType: PrinterConnectionType;
  lanForm: UseFormReturn<LanConnectionValues>;
  discoveryUnsubscribeRef: MutableRefObject<(() => void) | null>;
  buildDraftPrinter: () => Printer;
  setDriver: (driver: PrinterDriver) => void;
  refreshUsbSerial: () => Promise<void>;
  prefillDisplayName: (deviceName?: string) => void;
}

/**
 * State machine kết nối + dò protocol của luồng Thêm/Sửa máy in: bấm "Kết nối"
 * → `DeviceScanService.discoverDriver`, xử lý các `DiscoveryEvent`, và nhánh
 * chọn "Printer Language" thủ công qua `PrinterConnectionService.connectDraft`.
 * Mỗi lần dò chỉ tìm ĐÚNG 1 driver — không còn khái niệm dò thêm driver thứ 2.
 */
export const useProtocolDiscovery = ({
  initialValues,
  hasDriver,
  connectionType,
  lanForm,
  discoveryUnsubscribeRef,
  buildDraftPrinter,
  setDriver,
  refreshUsbSerial,
  prefillDisplayName,
}: UseProtocolDiscoveryInput) => {
  const [connectionDirty, setConnectionDirty] = useState(!initialValues);
  const [connectionState, setConnectionState] = useState<ConnectionState>(initialValues ? 'connected' : 'idle');
  const [protocolState, setProtocolState] = useState<ProtocolState>(initialValues ? 'identified' : 'idle');
  const [lastProtocol, setLastProtocol] = useState<PrinterDriverType | undefined>(initialValues?.driver.type);
  const [deviceInfo, setDeviceInfo] = useState<PrinterDeviceInfo | undefined>(undefined);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | undefined>(undefined);

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

  const startDiscovery = (): void => {
    resetDiscoveryFields('connecting');
    discoveryUnsubscribeRef.current = DeviceScanService.discoverDriver(
      { draftPrinter: buildDraftPrinter() },
      (event: DiscoveryEvent) => {
        switch (event.stage) {
          case DiscoveryStage.Identifying:
            setProtocolState('detecting');
            break;
          case DiscoveryStage.Identified:
            if (!event.protocol || !event.driver) {
              break;
            }

            setConnectionState('connected');
            setProtocolState('identified');
            setLastProtocol(event.protocol);
            setDeviceInfo(event.deviceInfo);
            setConnectionDirty(false);
            setDriver(event.driver);
            refreshUsbSerial();
            prefillDisplayName(event.deviceInfo?.deviceName);
            break;
          case DiscoveryStage.UnknownProtocol:
            setConnectionState('idle');
            setProtocolState('unknown');
            break;
          case DiscoveryStage.Error:
            setConnectionState('error');
            setProtocolState('idle');
            setConnectionErrorMessage(event.error?.message);
            break;
          default:
            break;
        }
      },
    );
  };

  const onConnectPress = (): void => {
    if (connectionType === PrinterConnectionType.Lan) {
      lanForm.handleSubmit(() => startDiscovery())();
    } else {
      startDiscovery();
    }
  };

  const onChooseProtocol = (chosenProtocol: PrinterDriverType): void => {
    setConnectionState('connecting');
    setProtocolState('detecting');
    const draftDriver: PrinterDriver = { type: chosenProtocol, source: DriverSource.Manual, config: { ...getDriverCapabilities(chosenProtocol).defaultConfig } };
    const draftPrinter: Printer = { ...buildDraftPrinter(), driver: draftDriver };
    PrinterConnectionService.connectDraft(draftPrinter)
      .then(() => {
        setConnectionState('connected');
        setProtocolState('identified');
        setLastProtocol(chosenProtocol);
        setDeviceInfo(undefined);
        setConnectionDirty(false);
        setDriver(draftDriver);
        refreshUsbSerial();
        prefillDisplayName();
      })
      .catch((error: { message: string }) => {
        setConnectionState('error');
        setProtocolState('idle');
        setConnectionErrorMessage(error.message);
      });
  };

  return {
    connectionState,
    protocolState,
    lastProtocol,
    deviceInfo,
    connectionErrorMessage,
    connectionDirty,
    resetConnectionResult,
    onConnectPress,
    onChooseProtocol,
  };
};
```

Tham số `hasDriver` không dùng trực tiếp trong thân hook này (chỉ coordinator cần) — XOÁ khỏi `UseProtocolDiscoveryInput` nếu `eslint`/`tsc` báo unused param; giữ lại CHỈ nếu 1 nhánh nào đó thực sự cần (đọc kỹ trước khi xoá, không xoá nhầm field coordinator đang truyền).

- [ ] **Step 3: Viết lại `useTestPrint.ts`** — chỉ còn 1 nút in thử (loại nội dung = `printer.type`, không còn tách Receipt/Label)

```ts
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { PrinterPrintService } from '../../printing/PrinterPrintService';
import { buildSampleReceiptDocument, buildSampleLabelDocument } from '../../utils/sampleDocuments';
import { usesBitmapRenderMode } from '../../drivers/driverConfig';
import { PrinterErrorException } from '../../errors/PrinterError';
import type { PrintDocuments } from '../../drivers/IPrinterDriver';
import type { PrintDocument } from '../../models/printing/PrintDocument';
import { PrintType } from '../../models/printing/PrintType';
import type { Printer } from '../../models/printer/Printer';
import type { PrinterDriver } from '../../models/printer/PrinterDriver';
import type { PrinterDisplayValues } from '../../forms/addPrinter/PrinterDisplaySchema';
import type { UseBillImageCapture } from '../useBillImageCapture';

/**
 * Input cho {@link useTestPrint}. `buildDraftPrinter`/`captureBillImage` do
 * coordinator sở hữu và truyền xuống.
 */
export interface UseTestPrintInput {
  driver?: PrinterDriver;
  displayForm: UseFormReturn<PrinterDisplayValues>;
  buildDraftPrinter: () => Printer;
  captureBillImage: UseBillImageCapture['captureBillImage'];
}

/**
 * In thử trong luồng Thêm/Sửa máy in: dựng document mẫu theo `printer.type`
 * cố định, ở chế độ Bitmap thì chụp ảnh bill trước khi gửi, rồi gọi
 * `PrinterPrintService.testPrint`.
 */
export const useTestPrint = ({ driver, displayForm, buildDraftPrinter, captureBillImage }: UseTestPrintInput) => {
  const [testPrintPending, setTestPrintPending] = useState(false);
  const [testPrintErrorMessage, setTestPrintErrorMessage] = useState<string | null>(null);
  const [testPrintRowsText, setTestPrintRowsText] = useState('1');

  const resolveTestPrintDocuments = async (printer: Printer, document: PrintDocument): Promise<PrintDocuments> => {
    if (!driver || !usesBitmapRenderMode(driver)) {
      return { text: document };
    }

    const base64 = await captureBillImage(document, printer.paper);

    if (!base64) {
      return { text: document };
    }

    return { text: document, image: base64 };
  };

  const onTestPrint = async (): Promise<void> => {
    if (!driver) {
      return;
    }

    const printer = buildDraftPrinter();
    const valid = await displayForm.trigger();

    if (!valid) {
      return;
    }

    setTestPrintPending(true);
    setTestPrintErrorMessage(null);
    try {
      const sampleDocument = printer.type === PrintType.Label ? buildSampleLabelDocument() : buildSampleReceiptDocument();
      const documents = await resolveTestPrintDocuments(printer, sampleDocument);
      const options = printer.type === PrintType.Label ? { rows: Number(testPrintRowsText) } : undefined;
      await PrinterPrintService.testPrint(printer, documents, options);
    } catch (error) {
      setTestPrintErrorMessage(error instanceof PrinterErrorException ? error.message : 'In thử thất bại');
    } finally {
      setTestPrintPending(false);
    }
  };

  const clearTestPrintError = (): void => setTestPrintErrorMessage(null);

  return {
    testPrintPending,
    testPrintErrorMessage,
    setTestPrintErrorMessage,
    testPrintRowsText,
    setTestPrintRowsText,
    onTestPrint,
    clearTestPrintError,
  };
};
```

- [ ] **Step 4: Viết lại `useDriverConfig.ts`** — bỏ toggle content type + font TSPL, còn render mode + paper

```ts
import { RenderMode } from '../../models/printer/PrinterDriver';
import type { PrinterDriver } from '../../models/printer/PrinterDriver';
import { PrintPaperType } from '../../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../../models/paper/PrintPaperConfig';
import { PrinterConfigService } from '../../management/PrinterConfigService';

export interface UseDriverConfigInput {
  printerId: string;
  driver?: PrinterDriver;
  setDriver: (driver: PrinterDriver) => void;
  paper: PrintPaperConfig;
  setPaper: (paper: PrintPaperConfig) => void;
}

/**
 * Chỉnh cấu hình sau khi đã có driver: render mode (chỉ ESC/POS chọn được —
 * TSPL cố định `Bitmap`, schema ràng buộc), khổ giấy/loại giấy. Mọi thay đổi
 * persist đối xứng qua `PrinterConfigService` — no-op nếu là draft chưa lưu,
 * `Save` lo phần đó.
 */
export const useDriverConfig = ({ printerId, driver, setDriver, paper, setPaper }: UseDriverConfigInput) => {
  const onSelectRenderMode = (mode: RenderMode): void => {
    if (!driver) {
      return;
    }

    setDriver({ ...driver, config: { ...driver.config, renderMode: mode } });
    PrinterConfigService.setRenderMode(printerId, mode);
  };

  const onChangePaper = (patch: Partial<PrintPaperConfig>): void => {
    let next = { ...paper, ...patch } as PrintPaperConfig;

    if (next.type === PrintPaperType.DieCut) {
      next = { itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3, ...next };
    }

    setPaper(next);
    PrinterConfigService.setPaper(printerId, next);
  };

  return { onSelectRenderMode, onChangePaper };
};
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "useConnectionSetup|useProtocolDiscovery|useTestPrint|useDriverConfig"`
Expected: Lỗi còn lại chỉ ở `useAddPrinterFlow.ts` (chưa cập nhật, xử lý Task 22) — không lỗi bên trong 4 file vừa viết.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(printer): rewrite the 4 add-printer sub-hooks for one driver per Printer"
```

---

## Task 22: Viết lại `useAddPrinterFlow.ts` (coordinator)

**Files:**
- Modify: `src/features/printer/hooks/useAddPrinterFlow.ts`
- Modify: `src/features/printer/hooks/__tests__/useAddPrinterFlow.test.tsx`

**Interfaces:**
- Consumes: 4 hook con mới (Task 21), `Printer`/`PrinterWriteInput` mới (Task 6), `PrinterConnectionType` (Task 1), `PrinterDriverType`/`DriverSource`/`RenderMode` (Task 2), `DEFAULT_PAPER` (Task 7).
- Produces: `UseAddPrinterFlowInput { visible, initialValues?, onSaved, printType: PrintType }` (đổi `purpose?` (tuỳ chọn) → `printType` BẮT BUỘC — caller luôn biết loại nội dung: tab đang mở lúc Thêm mới, hoặc `initialValues.type` lúc Sửa). `UseAddPrinterFlow` bỏ `showAddDriverHint`/`hasEmptyContentTypeDriver`/`hasPurposeMismatchDriver`.

- [ ] **Step 1: Viết lại toàn bộ file**

```ts
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrinterRepository } from '../storage/PrinterRepository';
import type { PrinterWriteInput } from '../storage/PrinterWriteInput';
import { PrinterConnectionService } from '../connection/PrinterConnectionService';
import { useBillImageCapture } from './useBillImageCapture';
import { generateId } from '../../../utils/id';
import { printerDisplaySchema, type PrinterDisplayValues } from '../forms/addPrinter/PrinterDisplaySchema';
import type { ConnectionSectionProps } from '../components/ConnectionSection';
import type { StatusPanelProps, ConnectionState, ProtocolState } from '../components/StatusPanel';
import type { PrinterInfoCardProps } from '../components/PrinterInfoCard';
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { DriverSource, PrinterDriverType, RenderMode } from '../models/printer/PrinterDriver';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { PrintType } from '../models/printing/PrintType';
import { DEFAULT_PAPER } from '../drivers/driverConfig';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import type { Printer } from '../models/printer/Printer';
import type { UsbRawDevice } from '../models/printer/PrinterDevice';
import { dieCutMediaError } from '../paper/validation';
import { buildBluetoothConnection, buildLanConnection, buildUsbConnection } from '../discovery/PrinterResolver';
import type { PrinterConnection } from '../models/printer/PrinterConnection';
import { useConnectionSetup } from './addPrinter/useConnectionSetup';
import { useProtocolDiscovery } from './addPrinter/useProtocolDiscovery';
import { useTestPrint } from './addPrinter/useTestPrint';
import { useDriverConfig } from './addPrinter/useDriverConfig';

export interface UseAddPrinterFlowInput {
  visible: boolean;
  initialValues?: Printer;
  onSaved: () => void;
  /** Loại nội dung CỐ ĐỊNH của printer này — tab đang mở lúc Thêm mới, hoặc `initialValues.type` lúc Sửa. */
  printType: PrintType;
}

export interface UseAddPrinterFlow {
  title: string;
  connectionSection: ConnectionSectionProps;
  identityErrorMessage?: string;
  statusPanel: StatusPanelProps;
  hasDieCutMediaError: boolean;
  infoCard: PrinterInfoCardProps;
  captureNode: ReactNode;
  testPrintErrorMessage: string | null;
  saveErrorMessage: string | null;
  clearTestPrintError: () => void;
  clearSaveError: () => void;
}

/** Nhãn nút "Kết nối" theo `connectionState` hiện tại. */
const resolveConnectLabel = (connectionState: ConnectionState): string => {
  if (connectionState === 'connecting') {
    return 'Đang kết nối...';
  }

  if (connectionState === 'connected') {
    return 'Kết nối lại';
  }

  return 'Kết nối';
};

/** Placeholder — GHI ĐÈ ngay bởi `PrinterDiscoveryService` cho từng candidate lúc dò; chỉ để thoả kiểu `Printer.driver` (không optional) trước khi có driver thật. */
const PLACEHOLDER_DRIVER: PrinterDriver = { type: PrinterDriverType.EscPos, source: DriverSource.Auto, config: { renderMode: RenderMode.Encoder } };

/**
 * Toàn bộ orchestration của luồng Thêm/Sửa máy in — scan, discovery, dựng draft,
 * in thử, lưu. Tách khỏi `AddPrinterModal` để component chỉ còn render + wiring.
 *
 * Coordinator sở hữu state chồng lấn (`driver`, `paper`, `displayForm`, `autoReconnect`,
 * `buildDraftPrinter`, vòng đời kết nối) và ghép 4 hook con dưới `addPrinter/`:
 * `useConnectionSetup`, `useProtocolDiscovery`, `useTestPrint`, `useDriverConfig`.
 * Mỗi `Printer` giờ ĐÚNG 1 driver — không còn "dò thêm driver thứ 2 trong 1 lần mở".
 */
export const useAddPrinterFlow = ({ visible, initialValues, onSaved, printType }: UseAddPrinterFlowInput): UseAddPrinterFlow => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [autoReconnect, setAutoReconnect] = useState(initialValues?.autoReconnect ?? true);
  const [driver, setDriver] = useState<PrinterDriver | undefined>(initialValues?.driver);
  const [paper, setPaper] = useState<PrintPaperConfig>(initialValues?.paper ?? { ...DEFAULT_PAPER });
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const { captureNode, captureBillImage } = useBillImageCapture();
  const [liveStatus, setLiveStatus] = useState<PrinterStatus>(PrinterStatus.Idle);

  const displayForm = useForm<PrinterDisplayValues>({
    resolver: zodResolver(printerDisplaySchema),
    defaultValues: {
      name: initialValues?.name ?? '',
    },
  });

  const discoveryUnsubscribeRef = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const connectionRef = useRef<{ connectionState: ConnectionState; driver?: PrinterDriver }>({
    connectionState: initialValues ? 'connected' : 'idle',
    driver: initialValues?.driver,
  });
  // Bridge để `useConnectionSetup` đọc state của `useProtocolDiscovery` tại thời
  // điểm handler chạy — phá vòng phụ thuộc giữa 2 hook con.
  const discoveryRef = useRef<{
    connectionState: ConnectionState;
    protocolState: ProtocolState;
    resetConnectionResult: () => void;
  }>({
    connectionState: initialValues ? 'connected' : 'idle',
    protocolState: initialValues ? 'identified' : 'idle',
    resetConnectionResult: () => undefined,
  });

  const connectionSetup = useConnectionSetup({
    initialValues,
    printerId,
    printType,
    hasDriver: Boolean(driver),
    getConnectionState: () => discoveryRef.current.connectionState,
    getProtocolState: () => discoveryRef.current.protocolState,
    resetConnectionResult: () => discoveryRef.current.resetConnectionResult(),
  });
  const { connectionType, selectedDevice, lanForm, buildLan, currentIdentityKey, identityErrorMessage } = connectionSetup;

  const buildConnection = (): PrinterConnection => {
    if (connectionType === PrinterConnectionType.Lan) {
      const { ip, port } = buildLan(lanForm.getValues());
      return buildLanConnection(ip, port);
    }

    if (selectedDevice) {
      return connectionType === PrinterConnectionType.Usb ? buildUsbConnection(selectedDevice) : buildBluetoothConnection(selectedDevice);
    }

    return connectionType === PrinterConnectionType.Usb
      ? { type: PrinterConnectionType.Usb, vendorId: 0, productId: 0 }
      : { type: PrinterConnectionType.Bluetooth, deviceId: '' };
  };

  /**
   * `draftPrinter` truyền cho discovery phải ĐẦY ĐỦ — `driver.connect()` lưu
   * nó làm context sống ngay cả khi discovery thành công. `driver: driver ??
   * PLACEHOLDER_DRIVER` KHÔNG được dùng thật lúc dò (mỗi candidate tự gắn
   * driver riêng, xem `PrinterDiscoveryService`) — chỉ có ý nghĩa thật khi
   * `driver` đã có giá trị (đã identify xong, dùng cho `testPrint`/Save).
   */
  const buildDraftPrinter = (): PrinterWriteInput => {
    const usbRaw = connectionType === PrinterConnectionType.Usb ? (selectedDevice?.rawDevice as unknown as UsbRawDevice | undefined) : undefined;
    return {
      id: printerId,
      type: printType,
      name: displayForm.getValues('name') || 'Máy in mới',
      vendor: initialValues?.vendor ?? usbRaw?.manufacturerName ?? undefined,
      model: initialValues?.model ?? usbRaw?.productName ?? undefined,
      connection: buildConnection(),
      identityKey: currentIdentityKey() ?? undefined,
      capabilities: initialValues?.capabilities ?? { cutter: false },
      driver: driver ?? PLACEHOLDER_DRIVER,
      paper,
      autoReconnect,
      enabled: initialValues?.enabled ?? true,
      createdAt: initialValues?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  /** `useTestPrint`/`useProtocolDiscovery` cần `Printer` đủ — `?? ''` chỉ là fallback kiểu, không chạm tới trên thực tế khi đã có device/LAN hợp lệ. */
  const buildFullDraftPrinter = (): Printer => {
    const draft = buildDraftPrinter();
    return { ...draft, identityKey: draft.identityKey ?? '' };
  };

  /**
   * Điền sẵn "Tên hiển thị" bằng tên thiết bị khi kết nối — chỉ khi ô còn TRỐNG.
   */
  const prefillDisplayName = (deviceName?: string): void => {
    if (displayForm.getValues('name')) {
      return;
    }

    const lanIp = connectionType === PrinterConnectionType.Lan ? lanForm.getValues('lanIp') : undefined;
    displayForm.setValue(
      'name',
      deviceName ?? selectedDevice?.displayName ?? (lanIp ? `Máy in ${lanIp}` : 'Máy in mới'),
    );
  };

  const testPrint = useTestPrint({ driver, displayForm, buildDraftPrinter: buildFullDraftPrinter, captureBillImage });
  const driverConfig = useDriverConfig({ printerId, driver, setDriver, paper, setPaper });

  const protocolDiscovery = useProtocolDiscovery({
    initialValues,
    hasDriver: Boolean(driver),
    connectionType,
    lanForm,
    discoveryUnsubscribeRef,
    buildDraftPrinter: buildFullDraftPrinter,
    setDriver,
    refreshUsbSerial: connectionSetup.refreshUsbSerial,
    prefillDisplayName,
  });
  discoveryRef.current = {
    connectionState: protocolDiscovery.connectionState,
    protocolState: protocolDiscovery.protocolState,
    resetConnectionResult: protocolDiscovery.resetConnectionResult,
  };
  const { connectionState, protocolState, deviceInfo, connectionDirty } = protocolDiscovery;

  useEffect(() => {
    connectionRef.current = { connectionState, driver };
  }, [connectionState, driver]);

  useEffect(() => {
    if (!driver) {
      setLiveStatus(PrinterStatus.Idle);
      return undefined;
    }

    setLiveStatus(PrinterConnectionService.getStatusForDriver(driver.type, printerId));
    return PrinterConnectionService.onStatusChangeForDriver(driver.type, printerId, setLiveStatus);
  }, [driver, printerId]);

  useEffect(() => {
    if (!visible) {
      discoveryUnsubscribeRef.current?.();
      discoveryUnsubscribeRef.current = null;
      const current = connectionRef.current;
      if (current.connectionState === 'connected' && current.driver && !savedRef.current) {
        PrinterConnectionService.disconnectForDriver(current.driver.type, printerId).catch(() => undefined);
      }
    }
    return () => {
      discoveryUnsubscribeRef.current?.();
    };
  }, [visible, printerId]);

  // Trên phone, `PrinterManagementPanel` unmount `AddPrinterForm` khi backToList
  // với `visible` vẫn `true` → nhánh `!visible` ở trên không chạy.
  useEffect(
    () => () => {
      const current = connectionRef.current;
      if (current.connectionState === 'connected' && current.driver && !savedRef.current) {
        PrinterConnectionService.disconnectForDriver(current.driver.type, printerId).catch(() => undefined);
      }
    },
    [printerId],
  );

  const onSave = displayForm.handleSubmit(() => {
    if (!driver) {
      return;
    }

    const printer = buildDraftPrinter();

    try {
      if (initialValues) {
        PrinterRepository.updatePrinter(printer);
      } else {
        PrinterRepository.addPrinter(printer);
      }
    } catch (error) {
      setSaveErrorMessage(error instanceof Error ? error.message : 'Lưu máy in thất bại');
      return;
    }
    savedRef.current = true;
    if (liveStatus === PrinterStatus.Connected) {
      PrinterConnectionService.reconnect(printer.id).catch(() => undefined);
    } else if (printer.autoReconnect) {
      PrinterConnectionService.connect(printer.id).catch(() => undefined);
    }
    onSaved();
  });

  const connectLabel = resolveConnectLabel(connectionState);
  const connectDisabled =
    connectionState === 'connecting' ||
    (connectionType !== PrinterConnectionType.Lan && !selectedDevice) ||
    Boolean(identityErrorMessage);
  const hasDieCutMediaError = dieCutMediaError(paper) != null;

  return {
    title: initialValues ? 'Chỉnh sửa máy in' : 'Thêm máy in',
    identityErrorMessage,
    hasDieCutMediaError,
    captureNode,
    testPrintErrorMessage: testPrint.testPrintErrorMessage,
    saveErrorMessage,
    clearTestPrintError: testPrint.clearTestPrintError,
    clearSaveError: () => setSaveErrorMessage(null),
    connectionSection: {
      connectionType,
      onConnectionTypeChange: connectionSetup.onConnectionTypeChange,
      selectedDeviceId: selectedDevice?.deviceId,
      onSelectDevice: connectionSetup.onSelectDevice,
      lanIp: lanForm.watch('lanIp'),
      lanPort: lanForm.watch('lanPort'),
      onLanIpChange: connectionSetup.onLanIpChange,
      onLanPortChange: connectionSetup.onLanPortChange,
      detectedLanIp: connectionSetup.detectedLanIp,
      lanIpFetchError: connectionSetup.lanIpFetchError,
      onFetchLanIp: connectionSetup.onFetchLanIp,
      onAutoFillLanIp: connectionSetup.onAutoFillLanIp,
      lanIpError: lanForm.formState.errors.lanIp?.message,
      lanPortError: lanForm.formState.errors.lanPort?.message,
      connectLabel,
      connectDisabled,
      onConnectPress: protocolDiscovery.onConnectPress,
      disabled: Boolean(driver),
    },
    statusPanel: {
      connectionState,
      protocolState,
      protocol: protocolDiscovery.lastProtocol,
      deviceInfo,
      errorMessage: protocolDiscovery.connectionErrorMessage,
      printType,
      onChooseProtocol: protocolDiscovery.onChooseProtocol,
    },
    infoCard: {
      control: displayForm.control,
      errors: displayForm.formState.errors,
      connectionType,
      driver,
      paper,
      onChangePaper: driverConfig.onChangePaper,
      deviceInfo,
      status: liveStatus,
      autoReconnect,
      onAutoReconnectChange: setAutoReconnect,
      testPrintPending: testPrint.testPrintPending,
      onTestPrint: testPrint.onTestPrint,
      onSelectRenderMode: driverConfig.onSelectRenderMode,
      testPrintRowsText: testPrint.testPrintRowsText,
      onTestPrintRowsChange: testPrint.setTestPrintRowsText,
      printType,
      onSave,
      saveDisabled: !driver || connectionDirty || hasDieCutMediaError,
      locked: !driver,
    },
  };
};
```

Lưu ý quan trọng: `StatusPanelProps`/`PrinterInfoCardProps` đổi shape ở Task 23 (bỏ `excludedDrivers`/`drivers`/`onToggleContentType`/`hasTsplDriver`/2 nút test print riêng, thêm `printType`/`driver`/`paper`/`onChangePaper`/`onSelectRenderMode`/`onTestPrint` số ít) — file này PHẢI làm SAU Task 23 hoặc cả 2 sửa đồng thời trong cùng lượt review, nếu không `tsc` sẽ báo lỗi shape mismatch giữa 2 file. Thực hiện Step 1 ở đây xong, tiếp tục ngay Task 23 trước khi verify tsc toàn cục.

- [ ] **Step 2: Sửa `__tests__/useAddPrinterFlow.test.tsx`**

Đọc file hiện tại — đây là file test tích hợp lớn nhất của luồng, cần rà kỹ theo shape mới: `printType` bắt buộc thay `purpose?`, `driver` số ít, không còn `showAddDriverHint`/dò driver thứ 2/`hasPurposeMismatchDriver`/`hasEmptyContentTypeDriver`. Xoá mọi test case về "dò thêm driver thứ 2", "content type toggle", "purpose mismatch". Giữ/viết lại case: kết nối → identify → save (single driver), unknown_protocol → chọn tay, cleanup khi đóng modal chưa save, auto-reconnect sau save, identity trùng `(key, type)`.

- [ ] **Step 3: Verify** (chạy SAU khi hoàn thành Task 23)

Run: `npx jest src/features/printer/hooks --silent`
Expected: PASS.

- [ ] **Step 4: Commit** (gộp chung với Task 23 nếu 2 task được review cùng lượt — xem ghi chú Step 1)

```bash
git add -A
git commit -m "refactor(printer): rewrite useAddPrinterFlow coordinator for one driver per Printer"
```

---

## Task 23: Viết lại `StatusPanel.tsx`, `PrinterInfoCard.tsx`, `DriverMediaSection.tsx`, `DriverRenderModeSection.tsx`, `TestPrintPanel.tsx`

**Files:**
- Modify: `src/features/printer/components/StatusPanel.tsx`
- Modify: `src/features/printer/components/PrinterInfoCard.tsx`
- Modify: `src/features/printer/components/DriverMediaSection.tsx`
- Modify: `src/features/printer/components/DriverRenderModeSection.tsx`
- Modify: `src/features/printer/components/TestPrintPanel.tsx`

**Interfaces:**
- Consumes: output shape mới của `useAddPrinterFlow` (Task 22).
- Produces: `StatusPanelProps` bỏ `excludedDrivers`, thêm `printType`. `PrinterInfoCardProps` bỏ `drivers`/`onToggleContentType`/`hasTsplDriver`/`onSelectTsplRenderMode`/`onSelectEscPosRenderMode`/`onChangeTsplInternalFont`/`onChangeDriverMedia`/2 nút test print riêng — còn `driver?`/`paper`/`onChangePaper`/`onSelectRenderMode`/`testPrintPending`/`onTestPrint`/`printType`.

- [ ] **Step 1: Viết lại `StatusPanel.tsx`**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import { AppButton } from '../../../components/AppButton';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { getDriverCapabilities } from '../drivers/DriverCapabilities';
import { type PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import type { PrintType } from '../models/printing/PrintType';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
export type ProtocolState = 'idle' | 'detecting' | 'identified' | 'unknown';

export interface StatusPanelProps {
  connectionState: ConnectionState;
  protocolState: ProtocolState;
  protocol?: PrinterDriverType;
  deviceInfo?: PrinterDeviceInfo;
  errorMessage?: string;
  /** Lọc danh sách protocol cho phép chọn tay — ESC/POS không hỗ trợ Label. */
  printType: PrintType;
  onChooseProtocol: (protocol: PrinterDriverType) => void;
}

const protocolLabel: Record<PrinterDriverType, string> = {
  EscPos: 'ESC/POS',
  Tspl: 'TSPL',
};

const ALL_PROTOCOLS: PrinterDriverType[] = [PrinterDriverType.EscPos, PrinterDriverType.Tspl];

export const StatusPanel: React.FC<StatusPanelProps> = ({
  connectionState,
  protocolState,
  protocol,
  deviceInfo,
  errorMessage,
  printType,
  onChooseProtocol,
}) => {
  if (protocolState === 'unknown') {
    const choices = ALL_PROTOCOLS.filter((type) => getDriverCapabilities(type).contentTypes.includes(printType));
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium">Không thể tự nhận diện giao thức. Vui lòng chọn thủ công:</Text>
        <View style={styles.choiceRow}>
          {choices.map((type) => (
            <AppButton key={type} label={protocolLabel[type]} mode="contained" onPress={() => onChooseProtocol(type)} />
          ))}
        </View>
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
  choiceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  errorText: { color: '#B91C1C' },
  successText: { color: '#15803D' },
});
```

- [ ] **Step 2: Viết lại `DriverMediaSection.tsx`** — đổi prop `media` → `paper`, `driverType` thành optional (chưa có driver lúc chưa identify)

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppSelect } from '../../../components/AppSelect';
import { AppInput } from '../../../components/AppInput';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { PaperSize, PrintPaperType } from '../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { dieCutMediaError } from '../paper/validation';

const PAPER_SIZE_OPTIONS = [PaperSize.Mm58, PaperSize.Mm80, PaperSize.Mm100, PaperSize.Mm104].map((n) => ({ label: `${n}mm`, value: String(n) }));
const MEDIA_TYPE_OPTIONS = [
  { label: 'Giấy cuộn liên tục', value: PrintPaperType.Continuous },
  { label: 'Die-cut (tem rời, nhiều cột)', value: PrintPaperType.DieCut },
];

export interface DriverMediaSectionProps {
  /** `undefined` trước khi driver được xác nhận — TSPL-only field (loại giấy/die-cut) chỉ hiện khi đã biết driver là TSPL. */
  driverType?: PrinterDriverType;
  paper: PrintPaperConfig;
  disabled: boolean;
  onChange: (patch: Partial<PrintPaperConfig>) => void;
}

const parseNum = (t: string): number | undefined => (t.trim() === '' ? undefined : Number(t));
const numStr = (n: number | undefined): string => (n == null ? '' : String(n));

export const DriverMediaSection: React.FC<DriverMediaSectionProps> = ({ driverType, paper, disabled, onChange }) => {
  const isTspl = driverType === PrinterDriverType.Tspl;
  const isDieCut = paper.type === PrintPaperType.DieCut;
  const mediaError = dieCutMediaError(paper);
  return (
    <View style={styles.block}>
      <AppSelect
        label="Khổ giấy"
        value={String(paper.paperSize)}
        onSelect={(v) => onChange({ paperSize: Number(v) as PaperSize })}
        options={PAPER_SIZE_OPTIONS}
        disabled={disabled}
      />
      {isTspl ? (
        <>
          <AppSelect
            label="Loại giấy"
            value={paper.type}
            onSelect={(v) => onChange({ type: v as PrintPaperConfig['type'] })}
            options={MEDIA_TYPE_OPTIONS}
            disabled={disabled}
          />
          {isDieCut ? (
            <>
              <AppInput label="Rộng tem (mm)" keyboardType="numeric" value={numStr(paper.itemWidthMm)} onChangeText={(t) => onChange({ itemWidthMm: parseNum(t) })} disabled={disabled} />
              <AppInput label="Cao tem (mm)" keyboardType="numeric" value={numStr(paper.itemHeightMm)} onChangeText={(t) => onChange({ itemHeightMm: parseNum(t) })} disabled={disabled} />
              <AppInput label="Số cột" keyboardType="numeric" value={numStr(paper.columns)} onChangeText={(t) => onChange({ columns: parseNum(t) })} disabled={disabled} />
              <AppInput label="Khoảng cách ngang (mm)" keyboardType="numeric" value={numStr(paper.horizontalGapMm)} onChangeText={(t) => onChange({ horizontalGapMm: parseNum(t) })} disabled={disabled} />
              <AppInput label="Khoảng cách dọc (mm)" keyboardType="numeric" value={numStr(paper.verticalGapMm)} onChangeText={(t) => onChange({ verticalGapMm: parseNum(t) })} disabled={disabled} />
              {mediaError ? <Text style={styles.error}>{mediaError}</Text> : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: 8 },
  error: { color: '#B91C1C' },
});
```

- [ ] **Step 3: Viết lại `DriverRenderModeSection.tsx`** — TSPL cố định `Bitmap`, không còn selector/font cho TSPL, chỉ ESC/POS chọn `Encoder`/`Bitmap`

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppSelect } from '../../../components/AppSelect';
import { RenderMode, PrinterDriverType } from '../models/printer/PrinterDriver';
import type { PrinterDriver } from '../models/printer/PrinterDriver';

const escPosRenderModeLabel: Record<RenderMode, string> = {
  Encoder: 'Văn bản (nhanh, cần đúng codepage)',
  Bitmap: 'Bitmap (chậm hơn, đúng mọi máy)',
};

const escPosRenderModeOptions = [RenderMode.Encoder, RenderMode.Bitmap].map((mode) => ({ label: escPosRenderModeLabel[mode], value: mode }));

interface DriverRenderModeSectionProps {
  driver: PrinterDriver;
  disabled: boolean;
  onSelectRenderMode: (mode: RenderMode) => void;
}

/** TSPL cố định `Bitmap` (schema ràng buộc, TrueType/internal-font đã bỏ) — không hiện selector, chỉ ESC/POS chọn được. */
export const DriverRenderModeSection: React.FC<DriverRenderModeSectionProps> = ({ driver, disabled, onSelectRenderMode }) => {
  if (driver.type !== PrinterDriverType.EscPos) {
    return null;
  }

  return (
    <View style={styles.renderModeBlock}>
      <AppSelect
        label="Chế độ in ESC/POS"
        value={driver.config.renderMode}
        onSelect={(value) => onSelectRenderMode(value as RenderMode)}
        options={escPosRenderModeOptions}
        disabled={disabled}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  renderModeBlock: { gap: 8 },
});
```

- [ ] **Step 4: Viết lại `PrinterInfoCard.tsx`**

```tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip, List } from 'react-native-paper';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { AppInput } from '../../../components/AppInput';
import { AppSwitch } from '../../../components/AppSwitch';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import { DriverMediaSection } from './DriverMediaSection';
import { DriverRenderModeSection } from './DriverRenderModeSection';
import { TestPrintPanel } from './TestPrintPanel';
import type { PrinterDisplayValues } from '../forms/addPrinter/PrinterDisplaySchema';
import { PrintType, PRINT_TYPE_LABELS } from '../models/printing/PrintType';
import { DriverSource, RenderMode, type PrinterDriver } from '../models/printer/PrinterDriver';
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';

const connectionLabel: Record<PrinterConnectionType, string> = {
  Usb: 'USB',
  Bluetooth: 'Bluetooth',
  Lan: 'LAN',
};

const protocolLabel: Record<PrinterDriver['type'], string> = {
  EscPos: 'ESC/POS',
  Tspl: 'TSPL',
};

export interface PrinterInfoCardProps {
  control: Control<PrinterDisplayValues>;
  errors: FieldErrors<PrinterDisplayValues>;
  connectionType: PrinterConnectionType;
  /** `undefined` trước khi discovery xác nhận. */
  driver?: PrinterDriver;
  paper: PrintPaperConfig;
  onChangePaper: (patch: Partial<PrintPaperConfig>) => void;
  deviceInfo?: PrinterDeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  testPrintPending: boolean;
  onTestPrint: () => void;
  /** Chỉ có ý nghĩa khi driver là ESC/POS — TSPL cố định `Bitmap`. */
  onSelectRenderMode: (mode: RenderMode) => void;
  /** Số hàng die-cut cho "In thử" — giữ dạng text để nhập dở. */
  testPrintRowsText: string;
  onTestPrintRowsChange: (text: string) => void;
  /** Loại nội dung CỐ ĐỊNH của printer này. */
  printType: PrintType;
  onSave: () => void;
  saveDisabled: boolean;
  locked: boolean;
}

export const PrinterInfoCard: React.FC<PrinterInfoCardProps> = ({
  control,
  errors,
  connectionType,
  driver,
  paper,
  onChangePaper,
  deviceInfo,
  status,
  autoReconnect,
  onAutoReconnectChange,
  testPrintPending,
  onTestPrint,
  onSelectRenderMode,
  testPrintRowsText,
  onTestPrintRowsChange,
  printType,
  onSave,
  saveDisabled,
  locked,
}) => {
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

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

      {driver ? (
        <View style={styles.driverCard}>
          <View style={styles.row}>
            <Chip>{`Driver: ${protocolLabel[driver.type]}`}</Chip>
            <Chip>{driver.source === DriverSource.Auto ? 'Tự động nhận diện' : 'Người dùng chọn'}</Chip>
            <Chip>{`In: ${PRINT_TYPE_LABELS[printType]}`}</Chip>
          </View>
        </View>
      ) : null}

      <List.Accordion
        title="Cài đặt nâng cao"
        expanded={advancedExpanded}
        onPress={() => setAdvancedExpanded((v) => !v)}
        style={styles.advancedAccordion}
      >
        <AppSwitch label="Tự động kết nối lại" value={autoReconnect} onValueChange={onAutoReconnectChange} disabled={locked} />
        <DriverMediaSection driverType={driver?.type} paper={paper} disabled={locked} onChange={onChangePaper} />
        {driver ? <DriverRenderModeSection driver={driver} disabled={locked} onSelectRenderMode={onSelectRenderMode} /> : null}
        {printType === PrintType.Label ? (
          <AppInput label="Số hàng in thử" keyboardType="numeric" value={testPrintRowsText} onChangeText={onTestPrintRowsChange} disabled={locked} />
        ) : null}
      </List.Accordion>

      <TestPrintPanel status={status} printType={printType} testPrintPending={testPrintPending} onTestPrint={onTestPrint} />
      <AppButton label="Lưu máy in" disabled={saveDisabled} onPress={onSave} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  driverCard: { gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  advancedAccordion: { paddingHorizontal: 0 },
});
```

- [ ] **Step 5: Đọc `TestPrintPanel.tsx` hiện tại và viết lại theo props mới**

File này CHƯA được đọc đầy đủ trong lúc lập plan — đọc nội dung hiện tại trước khi sửa. Đổi props từ `{ status, canPrintReceipt, canPrintLabel, testPrintReceiptPending, testPrintLabelPending, onTestPrintReceipt, onTestPrintLabel }` (2 nút Hoá đơn/Tem riêng) sang:

```ts
export interface TestPrintPanelProps {
  status: PrinterStatus;
  printType: PrintType;
  testPrintPending: boolean;
  onTestPrint: () => void;
}
```

Chỉ còn ĐÚNG 1 nút "In thử [Hoá đơn/Tem]" (label động theo `PRINT_TYPE_LABELS[printType]`), disabled khi `status !== PrinterStatus.Connected || testPrintPending`. Giữ nguyên toàn bộ style/layout khác của file, chỉ thay phần render 2-nút thành 1-nút.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "StatusPanel|PrinterInfoCard|DriverMediaSection|DriverRenderModeSection|TestPrintPanel"`
Expected: Không có output (trừ lỗi ở `AddPrinterForm.tsx`/`PrinterManagementPanel.tsx` — xử lý Task 24).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(printer): rewrite Add Printer UI components for one driver per Printer"
```

---

## Task 24: `AddPrinterModal.tsx`, `AddPrinterForm.tsx`, `PrinterManagementPanel.tsx`, `PrinterListItem.tsx`, `usePrinterList.ts`

**Files:**
- Modify: `src/features/printer/components/AddPrinterModal.tsx`
- Modify: `src/features/printer/components/AddPrinterForm.tsx`
- Modify: `src/features/printer/components/PrinterManagementPanel.tsx`
- Modify: `src/features/printer/components/PrinterListItem.tsx`
- Modify: `src/features/printer/hooks/usePrinterList.ts`

**Interfaces:**
- Consumes: `UseAddPrinterFlowInput.printType` bắt buộc (Task 22), `Printer` mới (Task 6).
- Produces: `AddPrinterModalProps`/`AddPrinterFormProps` đổi `purpose?: PrintType` → `printType: PrintType` (bắt buộc). `PrinterManagementPanel` luôn truyền `printType` xác định (tab đang mở lúc Thêm, hoặc `editingPrinter.type` lúc Sửa).

- [ ] **Step 1: Sửa `AddPrinterModal.tsx`**

```tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import { AddPrinterForm } from './AddPrinterForm';
import type { PrintType } from '../models/printing/PrintType';
import type { Printer } from '../models/printer/Printer';

/**
 * Wrapper mỏng bọc `AddPrinterForm` trong `Modal` — chỉ dùng trên tablet.
 * Điện thoại render thẳng `AddPrinterForm` inline (xem `PrinterManagementPanel`).
 */
export interface AddPrinterModalProps {
  visible: boolean;
  initialValues?: Printer;
  onDismiss: () => void;
  onSaved: () => void;
  printType: PrintType;
}

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved, printType }) => (
  <Portal>
    <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
      <AddPrinterForm visible={visible} initialValues={initialValues} onSaved={onSaved} onBack={onDismiss} printType={printType} />
    </Modal>
  </Portal>
);

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, maxHeight: '85%' },
});
```

- [ ] **Step 2: Sửa `AddPrinterForm.tsx`** — bỏ `showAddDriverHint`/`hasEmptyContentTypeDriver`/`hasPurposeMismatchDriver` (không còn tồn tại trên `UseAddPrinterFlow`)

```tsx
import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { useAddPrinterFlow } from '../hooks/useAddPrinterFlow';
import { ConnectionSection } from './ConnectionSection';
import { StatusPanel } from './StatusPanel';
import { PrinterInfoCard } from './PrinterInfoCard';
import type { PrintType } from '../models/printing/PrintType';
import type { Printer } from '../models/printer/Printer';

/**
 * Nội dung form Thêm/Sửa máy in — không có `Modal`/`Portal`.
 * Trên điện thoại `PrinterManagementPanel` render thẳng component này thay cho danh sách;
 * trên tablet nó được bọc trong `AddPrinterModal`.
 */
export interface AddPrinterFormProps {
  visible: boolean;
  initialValues?: Printer;
  onSaved: () => void;
  onBack: () => void;
  /** Ẩn nút "‹ Quay lại" khi màn cha đã có sẵn nút back riêng. Mặc định hiện — bắt buộc với `AddPrinterModal`. */
  showBackButton?: boolean;
  /** Loại nội dung CỐ ĐỊNH của printer này — tab đang mở lúc Thêm mới, hoặc `initialValues.type` lúc Sửa. */
  printType: PrintType;
}

export const AddPrinterForm: React.FC<AddPrinterFormProps> = ({
  visible,
  initialValues,
  onSaved,
  onBack,
  showBackButton = true,
  printType,
}) => {
  const flow = useAddPrinterFlow({ visible, initialValues, onSaved, printType });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {showBackButton ? <AppButton mode="text" label="‹ Quay lại" onPress={onBack} /> : null}
        <Text variant="titleMedium">{flow.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ConnectionSection {...flow.connectionSection} />
        {flow.identityErrorMessage ? <Text style={styles.identityError}>{flow.identityErrorMessage}</Text> : null}

        <StatusPanel {...flow.statusPanel} />

        {flow.hasDieCutMediaError ? (
          <Text variant="bodySmall" style={styles.identityError}>
            Cấu hình die-cut chưa hợp lệ (khổ giấy/số cột/khoảng cách) — mở "Cài đặt nâng cao" để sửa trước khi lưu.
          </Text>
        ) : null}

        <PrinterInfoCard {...flow.infoCard} />
        {flow.captureNode}
      </ScrollView>

      <Snackbar visible={flow.testPrintErrorMessage !== null} onDismiss={flow.clearTestPrintError} duration={5000}>
        {flow.testPrintErrorMessage}
      </Snackbar>
      <Snackbar visible={flow.saveErrorMessage !== null} onDismiss={flow.clearSaveError} duration={5000}>
        {flow.saveErrorMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scrollContent: { gap: 12, paddingBottom: 24 },
  identityError: { color: '#B91C1C' },
  addDriverHint: { color: '#6B7280' },
});
```

- [ ] **Step 3: Sửa `PrinterManagementPanel.tsx`** — `purpose` (tuỳ chọn) → `printType` (luôn xác định)

```tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { useLayoutMode } from '../../../hooks/useLayoutMode';
import { usePrinterList } from '../hooks/usePrinterList';
import { PrinterList } from './PrinterList';
import { AddPrinterModal } from './AddPrinterModal';
import { AddPrinterForm } from './AddPrinterForm';
import { PrintType, PRINT_TYPE_LABELS } from '../models/printing/PrintType';
import type { Printer } from '../models/printer/Printer';

export const PrinterManagementPanel: React.FC = () => {
  const { printers, reload, ...actions } = usePrinterList();
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingPrinter, setEditingPrinter] = useState<Printer | undefined>(undefined);
  const [addSessionId, setAddSessionId] = useState(0);
  const [activeTab, setActiveTab] = useState<PrintType>(PrintType.Receipt);
  const isPhone = useLayoutMode() === 'phone';

  const openAdd = (): void => {
    setAddSessionId((n) => n + 1);
    setEditingPrinter(undefined);
    setMode('form');
  };

  const openEdit = (printer: Printer): void => {
    setEditingPrinter(printer);
    setMode('form');
  };

  const backToList = (): void => setMode('list');

  const onSaved = (): void => {
    setMode('list');
    reload();
  };

  useEffect(() => {
    if (!(isPhone && mode === 'form')) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setMode('list');
      return true;
    });
    return () => sub.remove();
  }, [isPhone, mode]);

  const formKey = editingPrinter?.id ?? `add-${addSessionId}`;
  /** Sửa: giữ nguyên `type` đã lưu (không đổi được). Thêm mới: theo tab đang mở. */
  const printType = editingPrinter ? editingPrinter.type : activeTab;

  if (isPhone && mode === 'form') {
    return (
      <View style={styles.phoneForm}>
        <AddPrinterForm
          key={formKey}
          visible
          initialValues={editingPrinter}
          onSaved={onSaved}
          onBack={backToList}
          showBackButton={false}
          printType={printType}
        />
      </View>
    );
  }

  const printersForTab = printers.filter((p) => p.type === activeTab);

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">Thiết lập máy in</Text>

      <SegmentedButtons
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as PrintType)}
        buttons={[
          { value: PrintType.Receipt, label: PRINT_TYPE_LABELS.Receipt },
          { value: PrintType.Label, label: PRINT_TYPE_LABELS.Label },
        ]}
      />

      <AppButton label={`+ Thêm máy in ${PRINT_TYPE_LABELS[activeTab]}`} onPress={openAdd} />

      <PrinterList printers={printersForTab} actions={actions} onEdit={openEdit} />

      {!isPhone && (
        <AddPrinterModal
          key={formKey}
          visible={mode === 'form'}
          initialValues={editingPrinter}
          onDismiss={backToList}
          onSaved={onSaved}
          printType={printType}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  phoneForm: { flex: 1, padding: 16 },
});
```

- [ ] **Step 4: Sửa `PrinterListItem.tsx`** — `printer.drivers`/`printer.drivers[0].config.media` → `printer.driver`/`printer.paper`

```tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, Menu, Switch } from 'react-native-paper';
import { usePrinterConnection } from '../hooks/usePrinterConnection';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { PrinterListActions } from '../hooks/usePrinterList';
import type { Printer } from '../models/printer/Printer';

export interface PrinterListItemProps {
  printer: Printer;
  actions: PrinterListActions;
  onEdit: (printer: Printer) => void;
}

const connectionLabel: Record<PrinterConnectionType, string> = {
  Usb: 'USB',
  Bluetooth: 'Bluetooth',
  Lan: 'LAN',
};

const protocolLabel: Record<PrinterDriverType, string> = {
  EscPos: 'ESC/POS',
  Tspl: 'TSPL',
};

export const PrinterListItem: React.FC<PrinterListItemProps> = ({ printer, actions, onEdit }) => {
  const status = usePrinterConnection(printer.id);
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  const closeMenu = (): void => setMenuVisible(false);
  const enabled = printer.enabled ?? true;
  const model = [printer.vendor, printer.model].filter(Boolean).join(' ');
  const subtitle = [connectionLabel[printer.connection.type], protocolLabel[printer.driver.type], `Khổ ${printer.paper.paperSize}mm`, model].filter(Boolean).join(' · ');

  const requestDelete = (): void => {
    if (status === PrinterStatus.Connected) {
      setConfirmDeleteVisible(true);
      return;
    }
    actions.remove(printer.id);
  };

  const confirmDelete = async (): Promise<void> => {
    await actions.disconnect(printer.id);
    actions.remove(printer.id);
    setConfirmDeleteVisible(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={1}>{printer.name}</Text>
        <PrinterStatusBadge status={status} />
      </View>
      <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>

      <View style={styles.actionsRow}>
        <View style={styles.enableGroup}>
          <Text style={styles.enableLabel}>{enabled ? 'Đang bật' : 'Đã tắt'}</Text>
          <Switch value={enabled} onValueChange={(value) => actions.setEnabled(printer.id, value)} />
        </View>
        <View style={styles.spacer} />
        <AppButton label="Sửa" mode="outlined" compact onPress={() => onEdit(printer)} />
        <Menu
          visible={menuVisible}
          onDismiss={closeMenu}
          anchor={<IconButton icon="dots-vertical" onPress={() => setMenuVisible(true)} />}
        >
          <Menu.Item title="Kết nối" onPress={() => { closeMenu(); actions.connect(printer.id); }} />
          <Menu.Item title="Ngắt kết nối" onPress={() => { closeMenu(); actions.disconnect(printer.id); }} />
          <Menu.Item title="Kết nối lại" onPress={() => { closeMenu(); actions.reconnect(printer.id); }} />
          <Menu.Item title="Xóa" onPress={() => { closeMenu(); requestDelete(); }} />
        </Menu>
      </View>

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
  card: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', gap: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#6B7280' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  enableGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  enableLabel: { fontSize: 12, color: '#6B7280' },
  spacer: { flex: 1 },
});
```

- [ ] **Step 5: Sửa `usePrinterList.ts`** — chỉ dòng log trong `reload`

Đổi `drivers: list.map((p) => ({ id: p.id, name: p.name, connectionType: p.connection.type, drivers: p.drivers.map((d) => d.type), enabled: p.enabled ?? true }))` thành:

```ts
printers: list.map((p) => ({ id: p.id, name: p.name, connectionType: p.connection.type, driver: p.driver.type, enabled: p.enabled ?? true })),
```

Phần còn lại của file không đổi.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit -p .`
Expected: Lỗi còn lại (nếu có) CHỈ ở các file thuộc Task 25-26 (native/adapter audit, test sweep) — không còn lỗi nào trong `src/features/printer/components/` hay `src/features/printer/hooks/` liên quan tới shape `Printer` cũ.

Run: `npx jest src/features/printer/hooks --silent`
Expected: PASS (bao gồm `useAddPrinterFlow.test.tsx` từ Task 22).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(printer): adapt printer list/management screens to the atomic Printer shape"
```

---

## Task 25: Rename enum ở tầng adapter/native — `DriverRegistry.ts`, `resolvePrinterAdapter.ts`, `NativeAdapter.ts`, `LibraryAdapter.ts`, `MockPrinterAdapter.ts`

**CẢNH BÁO QUAN TRỌNG (đã xác minh bằng grep trước khi viết task này):** `adapters/native/PrinterNativeModule.ts` định nghĩa `ConnectRequest.type: 'usb' | 'bluetooth' | 'lan'` và `adapters/native/NativeAdapter.ts` gọi `ThermalPrinterModule.connect({ type: 'bluetooth', ... })`/`{ type: 'lan', ... }` bằng STRING LITERAL VIẾT THƯỜNG — đây là payload gửi thẳng qua React Native bridge sang code Kotlin/Java native (`android/app/src/main/java/com/ndtcorepos/thermalprinter/`), HOÀN TOÀN ĐỘC LẬP với enum `PrinterConnectionType` của TypeScript. **TUYỆT ĐỐI KHÔNG đổi các literal `'usb'`/`'bluetooth'`/`'lan'` này sang PascalCase** — native code phía Android vẫn mong nhận đúng chữ thường. Chỉ đổi phần code Ở PHÍA TRÊN các literal này (nơi so sánh `connection.type === PrinterConnectionType.Lan` để QUYẾT ĐỊNH gọi nhánh nào) — phần bên trong nhánh (giá trị literal truyền cho native) giữ nguyên.

**Files:**
- Modify: `src/features/printer/drivers/DriverRegistry.ts`
- Modify: `src/features/printer/adapters/resolvePrinterAdapter.ts`
- Modify: `src/features/printer/adapters/native/NativeAdapter.ts`
- Modify: `src/features/printer/adapters/library/LibraryAdapter.ts`
- Modify: `src/features/printer/adapters/testing/MockPrinterAdapter.ts`
- Modify: mọi `__tests__/*.test.ts` tương ứng của 5 file trên.
- Verify only (KHÔNG đổi literal, chỉ xác nhận không cần sửa gì khác): `src/features/printer/adapters/native/PrinterNativeModule.ts`, `src/features/printer/transports/UsbTransport.ts`, `src/features/printer/transports/LanTransport.ts`, `src/features/printer/transports/BluetoothTransport.ts`.

- [ ] **Step 1: Viết lại `DriverRegistry.ts`**

```ts
import type { IPrinterDriver } from './IPrinterDriver';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { EscPosDriver } from './escpos/EscPosDriver';
import { TsplDriver } from './tspl/TsplDriver';

export const DriverRegistry: Record<PrinterDriverType, IPrinterDriver> = {
  [PrinterDriverType.EscPos]: new EscPosDriver(),
  [PrinterDriverType.Tspl]: new TsplDriver(),
};
```

- [ ] **Step 2: Viết lại `resolvePrinterAdapter.ts`**

```ts
import type { IPrinterAdapter } from './IPrinterAdapter';
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { PrinterDriverType } from '../models/printer/PrinterDriver';
import { NativeAdapter } from './native/NativeAdapter';
import { LibraryAdapter } from './library/LibraryAdapter';

/**
 * Chọn `IPrinterAdapter` theo driver + connectionType:
 * - **ESC/POS**: luôn `NativeAdapter` — `printText` encode ở JS, không cần `read`.
 * - **TSPL / USB**: `NativeAdapter` — ghi byte thô qua `ThermalPrinterModule` (USB không đọc được, `identify` vẫn `null`).
 * - **TSPL / BLE-LAN**: `LibraryAdapter` — `tcp-socket`/`bluetooth-classic` đọc được phản hồi (cần cho `identify` `~!T`).
 */
export const resolvePrinterAdapter = (
  driverType: PrinterDriverType,
  connectionType: PrinterConnectionType,
): IPrinterAdapter => {
  if (driverType === PrinterDriverType.EscPos) {
    return new NativeAdapter();
  }

  if (connectionType === PrinterConnectionType.Usb) {
    return new NativeAdapter();
  }

  return new LibraryAdapter();
};
```

- [ ] **Step 3: Đọc + sửa `NativeAdapter.ts`**

Đổi mọi tham chiếu kiểu `ConnectionType` (import từ `PrinterDevice`) → `PrinterConnectionType` (import từ `PrinterConnection`), và mọi so sánh `connectionType === ConnectionType.usb/.bluetooth/.lan` → `PrinterConnectionType.Usb/.Bluetooth/.Lan`. **KHÔNG đổi** các object literal truyền cho `ThermalPrinterModule.connect({ type: 'bluetooth', ... })`/`{ type: 'lan', ... }` (đã xác nhận ở Step 0 — giữ nguyên `'usb'`/`'bluetooth'`/`'lan'` viết thường, đây là field `type` của `ConnectRequest` trong `PrinterNativeModule.ts`, không phải enum của ta).

- [ ] **Step 4: Đọc + sửa `LibraryAdapter.ts`, `MockPrinterAdapter.ts`**

Áp dụng đúng phép thế rename `ConnectionType` → `PrinterConnectionType` như Task 1 Step 3. Đọc kỹ trước khi sửa — nếu phát hiện thêm chỗ nào gọi thư viện ngoài (`react-native-tcp-socket`/`react-native-bluetooth-classic`) bằng string literal viết thường tương tự Step 3, áp dụng CÙNG NGUYÊN TẮC: không đổi literal gửi ra ngoài ranh giới TypeScript của ta.

- [ ] **Step 5: Verify KHÔNG sửa `PrinterNativeModule.ts`/`transports/*.ts`**

Đọc nhanh 4 file này (`PrinterNativeModule.ts`, `UsbTransport.ts`, `LanTransport.ts`, `BluetoothTransport.ts`) — xác nhận không có import `ConnectionType`/`PrinterDriverType` từ `models/printer/` cần đổi (nếu có, áp dụng rename như trên; nếu chỉ có literal string nội bộ như `ConnectRequest.type`, không đổi gì).

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "DriverRegistry|resolvePrinterAdapter|NativeAdapter|LibraryAdapter|MockPrinterAdapter"`
Expected: Không có output.

Run: `npx jest src/features/printer/adapters src/features/printer/drivers/__tests__/DriverRegistry.web.test.ts --silent`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(printer): rename domain connection enum in adapter layer, keep native bridge literals untouched"
```

---

## Task 26: Quét toàn bộ, sửa test còn sót, xanh `npm run verify`

Task cuối — dọn mọi lỗi compile/test còn sót sau 25 task trên. Không có code sản xuất nào cần viết mới ở đây (nếu phát hiện có, đó là dấu hiệu 1 task trước bị bỏ sót — quay lại đúng task đó, đừng vá tạm ở đây).

**Files:** Bất kỳ file nào `tsc`/`eslint`/`jest` báo lỗi ở Step 1-2. Theo rà soát lúc lập plan, các file sau CHẮC CHẮN còn cần cập nhật riêng (chưa thuộc task nào ở trên) — đọc từng file, sửa theo đúng shape mới đã thống nhất xuyên suốt plan này:

- `src/features/printer/models/printer/__tests__/Printer.test.ts`
- `src/features/printer/store/__tests__/printerSlice.test.ts` (nếu có fixture `Printer`/`PrinterStatus` cần đổi)
- `src/features/printer/logging/__tests__/PrinterLogger.test.ts` (nếu log field nào tham chiếu `drivers`/enum cũ)
- `src/features/printer/hooks/__tests__/usePrinterList.test.ts` (nếu tồn tại)
- `src/features/cart/services/OrderPrintTrigger.ts` + test (đã tham chiếu `TsplFontConfig`/`installTsplFont` theo grep đầu phiên — kiểm tra lại, xoá phần liên quan TTF nếu có)
- Toàn bộ `__tests__/` còn lại dưới `src/features/printer/` chưa được liệt kê tường minh ở Task 1-25.

**Interfaces:** Không có interface mới — mục tiêu là KHỚP ĐÚNG mọi interface đã định nghĩa ở Task 1-25.

- [ ] **Step 1: Chạy type-check toàn repo**

Run: `npx tsc --noEmit -p .`
Expected: 0 lỗi. Nếu còn lỗi, với MỖI lỗi: xác định đúng nguyên nhân (enum casing sót, field `drivers`/`media`/`contentTypes` cũ còn sót, tham số `driver`/`printType` rời còn truyền cho `IPrinterDriver`...) rồi sửa tại đúng file — không thêm `as any`/`@ts-ignore` để né lỗi.

- [ ] **Step 2: Chạy lint**

Run: `npm run lint`
Expected: 0 lỗi mới (2 warning sẵn có ở `transports/__tests__/BluetoothTransport.test.ts`/`LanTransport.test.ts` về `no-var-requires` là pre-existing, không phải do refactor này — không cần sửa).

- [ ] **Step 3: Chạy toàn bộ test suite máy in**

Run: `npx jest src/features/printer --silent`
Expected: 100% PASS. Với mỗi file FAIL: đọc lỗi, xác định đâu là thay đổi hành vi THẬT SỰ cố ý (vd không còn `showAddDriverHint`, không còn `installTsplFont`) — xoá/viết lại test case đó theo đúng invariant mới đã mô tả trong các task trước; đâu là chỗ quên đổi enum/field — sửa cho khớp.

- [ ] **Step 4: Chạy `npm run verify` (type-check + lint + test toàn app)**

Run: `npm run verify`
Expected: PASS toàn bộ, không riêng module máy in — xác nhận không phá vỡ `src/features/cart/` (đã biết có tham chiếu `PrintPaperConfig`/`PrintService` từ `OrderPrintTrigger.ts`) hay bất kỳ feature nào khác import từ `src/features/printer/`.

- [ ] **Step 5: Đối chiếu ledger**

Xem lại danh sách lỗi đã ghi ở cuối Task 1, 2, 6 ("lỗi MONG ĐỢI, dọn dần") — xác nhận toàn bộ đã hết, không còn file nào trong danh sách đó vẫn lỗi.

- [ ] **Step 6: Commit cuối**

```bash
git add -A
git commit -m "refactor(printer): finish printer model redesign — full suite green"
```

Sau task này, dùng superpowers:finishing-a-development-branch để quyết định merge/PR/giữ nguyên branch.

