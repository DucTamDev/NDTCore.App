# Printer Feature — Architecture Conformance Refactor — Design Specification

**Ngày:** 2026-08-28
**Trạng thái:** Chốt để lập plan
**Branch:** `refactor/printer-architecture-conformance`
**Scope:** `NDTCore.App/src/features/printer/` + các call site trong `src/features/cart/`

---

## 1. Mục tiêu

Đưa toàn bộ feature `printer` về **đúng 100%** contract trong
[`src/features/printer/ARCHITECTURE.md`](../../../src/features/printer/ARCHITECTURE.md) —
tài liệu này là **nguồn sự thật duy nhất** (architecture contract). Mọi
tham chiếu `§N` / `RULE NN` trong spec này trỏ tới ARCHITECTURE.md.

Codebase hiện đã conform ~90%. Refactor này đóng các gap còn lại, trong đó
gap lớn nhất là **TSPL Strategy Pattern** (§27-30) và **bỏ toàn bộ fallback
render** (§33, §41, §102, §130, RULE 08-12).

## 2. Nguồn sự thật & văn bản bị thay thế

- **Chuẩn:** `src/features/printer/ARCHITECTURE.md`. Khi code và doc lệch nhau
  → sửa code (trừ các mục liệt kê ở §12 "Deviations & Reconciliations").
- **Bị thay thế (superseded):**
  - [`2026-08-27-tspl-truetype-font-design.md`](2026-08-27-tspl-truetype-font-design.md)
    **§7 (bảng fallback CỨNG)** và **§9 (test theo bảng fallback)** — bị thay
    bởi mô hình no-fallback của ARCHITECTURE.md §41/§130. Các phần khác của
    spec 2026-08-27 (§1-6, §8, §10 — font asset, `TsplFontManager` trách
    nhiệm, UI switch) vẫn còn hiệu lực.
  - [`2026-08-26-printer-architecture-refactor-design.md`](2026-08-26-printer-architecture-refactor-design.md)
    **§7.2 (`IPrinterDriver.encode()` public)** — bị thay bởi §23 (interface
    không có `encode`). Phần còn lại (layering, identity, resource lock,
    migration) vẫn còn hiệu lực và đã được ARCHITECTURE.md kế thừa.
- Sau khi merge: thêm 1 dòng note ở đầu 2 file trên trỏ về spec này.

## 3. Gap Analysis

### 3.1 Đã conform (không đụng tới)

| Vùng | File | Rule |
|---|---|---|
| Facade quản lý | `printing/PrinterService.ts` | §6, RULE 03 |
| Entry in production | `printing/PrintService.ts` | §7, RULE 02 |
| Routing | `printing/PrintRoutingService.ts` | §77-79, RULE 40 |
| Scheduler | `printing/PrintScheduler.ts` | §84-86, RULE 41 |
| Lock + resource key | `printing/PrinterConnectionLock.ts` | §87-92, RULE 24-27, 42 |
| Driver registry (+ web) | `printing/DriverRegistry.ts`, `.web.ts` | §24, §107 |
| Discovery (identify thật, USB→unknown) | `discovery/PrinterDiscoveryService.ts` | §63-72, RULE 20-23 |
| Identity key | `discovery/PrinterResolver.ts` | §18-20, RULE 29-30 |
| Storage + version + destructive reset | `storage/PrinterStorage.ts` | §75-76, RULE 28, 36 |
| Schema enforce invariant ở service boundary | `schemas/printerFormSchema.ts` | §114-116 |
| Transports (chỉ truyền byte) | `transports/*.ts` | §56-60, RULE 35, 46 |
| Adapters (native boundary) | `adapters/*.ts` | §61-62, §112, RULE 05 |
| `TsplEncoder` thuần, không connect | `drivers/tspl/TsplEncoder.ts` | §54-55, RULE 36 |
| Payment isolation, fire-and-forget | `cart/services/OrderPrintTrigger.ts` | §103-104, §124, RULE 32 |
| Capture ảnh trước driver, chỉ khi routing cần | `hooks/useBillImageCapture.tsx`, `OrderPrintTrigger.ts` | §80-82 |
| Logger scrub IP/MAC/payload | `services/PrinterLogger.ts` | §106, RULE 34 |
| Runtime state không persist | `types/printer.types.ts` (`Printer` không có field status) | §21, §134, RULE 28 |

### 3.2 Gap cần refactor

| # | Gap | Rule / § |
|---|---|---|
| **G1** | `TsplDriver` render inline (`resolveDocumentAndFont`, `encodeElements`, `encode`). Chưa có `ITsplPrintStrategy` / `TsplBitmapStrategy` / `TsplTrueTypeStrategy` / `TsplStrategyRegistry`. | §25-31, §144, RULE 05-07, 37, 45 |
| **G2** | Fallback ngầm truetype→bitmap trong `resolveDocumentAndFont`. Helper `isTsplTrueTypeActive` gộp "renderMode configured" với "fontInstalled". | §33, §41, §102, §130, RULE 08-12 |
| **G3** | Error codes generic (`ENCODING_FAILED`, `CONNECTION_ERROR`). Thiếu toàn bộ taxonomy §101. | §100-101, RULE 31 |
| **G4** | `IPrinterDriver.encode()` tồn tại — §23 không có. | §23, RULE 44 |
| **G5** | `TsplFontManager.ensureFontInstalled` — tên `ensure*` là concept §47/§131 cấm. | §47, §131, RULE 17-18 |
| **G6** | Font install phụ thuộc connection do modal mở sẵn; không tự `lock→connect→DOWNLOAD→disconnect→persist`. | §46, §96, §126, RULE 49 |
| **G7** | Tên type/method lệch doc: `PrintDocumentVariants`→`PrintDocuments`, `installTrueTypeFont`→`installTsplFont`, `documentVariants`→`documents`. | §7, §23, §45, §83, §85 |
| **G8** | `PrintService.imageDocumentPaperSize` / `AddPrinterModal.resolveTestPrintDocuments` / `PrinterInfoCard` key theo `isTsplTrueTypeActive` (effective) thay vì `renderMode` (configured). | §80, §130 |
| **G9** | `PrintJob` shape lệch §85 (`documentVariants` vs `documents`). | §85 |
| **G10** | `PrinterLogger` thiếu field `operation` / `resourceKey` / `result` (§105) — cần reconcile với §106 (không log IP). | §105-106, RULE 33-34 |
| **G11** | `ARCHITECTURE.md` có preamble chat (dòng 1-26) và tên lệch code thật. | — |
| **G12** | `TsplDriver.test.ts` + test liên quan phải viết lại theo Strategy + bảng no-fallback. | §120 |

---

## 4. G1 — TSPL Strategy Pattern

### 4.1 File mới

```
src/features/printer/drivers/tspl/
├── strategies/
│   ├── tsplStrategy.types.ts          # ITsplPrintStrategy, TsplStrategyContext
│   ├── TsplBitmapStrategy.ts
│   ├── TsplTrueTypeStrategy.ts
│   └── __tests__/
│       ├── TsplBitmapStrategy.test.ts
│       └── TsplTrueTypeStrategy.test.ts
├── TsplStrategyRegistry.ts
└── __tests__/TsplStrategyRegistry.test.ts
```

### 4.2 `tsplStrategy.types.ts`

```ts
import type { Printer, PrinterDriver, TsplRenderMode } from '../../../types/printer.types';
import type { PrintDocuments } from '../../../types/driver.types';
import type { PrintType } from '../../../types/printConfiguration.types';

/**
 * Input đã resolve đầy đủ cho 1 lần render TSPL — strategy KHÔNG đọc storage,
 * KHÔNG chạm transport/native, KHÔNG biết connectionType (§118, §137, RULE 37).
 */
export interface TsplStrategyContext {
  printer: Printer;
  /** `config.type === 'tspl'` — TsplDriver đã narrow trước khi tạo context. */
  driver: PrinterDriver;
  documents: PrintDocuments;
  printType: PrintType;
  /** mm khai báo cho `SIZE` — Label → `config.labelHeightMm ?? DEFAULT_LABEL_HEIGHT_MM`; Receipt → `CONTINUOUS_HEIGHT_MM`. Resolve ở TsplDriver. */
  heightMm: number;
}

export interface ITsplPrintStrategy {
  readonly mode: TsplRenderMode;
  /** Ném `AppErrorException` (code TSPL_*) nếu context không đủ điều kiện render. KHÔNG trả bool, KHÔNG fallback (§28, §41, RULE 12). */
  validate(context: TsplStrategyContext): void;
  /** Thuần: context → raw TSPL bytes. Test gọi thẳng, không cần transport/printer thật (§28). */
  encode(context: TsplStrategyContext): Uint8Array;
}
```

### 4.3 `TsplBitmapStrategy`

- `mode = TsplRenderMode.bitmap`.
- `validate`: `!context.documents.image` → ném `TSPL_IMAGE_REQUIRED` (§32, RULE 11).
- `encode`:
  1. `decodePngBase64ToMonochrome(documents.image, PAPER_IMAGE_WIDTH_PX[printer.paperSize])` — resize theo paper width (§34, §35).
  2. `bitmap.heightPx > heightMm * DOTS_PER_MM` → ném `TSPL_IMAGE_TOO_LARGE` (§38, RULE 18). Không crop, không shrink.
  3. Nếu decode ném lỗi (PNG hỏng) → bọc thành `TSPL_IMAGE_INVALID`.
  4. `new TsplEncoder().initialize(paperSize, printType, heightMm).image(0, 0, bitmap).cut().encode()`.
- Quirk `byte ^ 0xff` **giữ nguyên trong `TsplEncoder.image()`** — không lan ra strategy (§37).
- Chuyển nguyên logic nhánh `element.type === 'image'` hiện có trong `TsplDriver.encodeElements`.

### 4.4 `TsplTrueTypeStrategy`

- `mode = TsplRenderMode.truetype`.
- `validate`: `driver.config.type !== 'tspl' || driver.config.renderMode !== 'truetype' || !driver.config.font?.fontInstalled` → ném `TSPL_FONT_NOT_INSTALLED` (§40, RULE 10).
- `encode`:
  - `fontName = driver.config.font!.name`.
  - Duyệt `documents.text.elements`, phát `TEXT` / `BARCODE` / `QRCODE` / line / row / table qua `TsplEncoder`, `fontName` cho mọi lệnh `TEXT`.
  - Element không hỗ trợ → ném `TSPL_ELEMENT_UNSUPPORTED` (§42 gửi TEXT/PRINT, RULE 12).
  - Không đọc `documents.image`. Không gửi font binary (§42).
- Chuyển nguyên logic nhánh text/line/table/row/barcode/qrCode hiện có trong `TsplDriver.encodeElements`.

### 4.5 `TsplStrategyRegistry`

```ts
export const TsplStrategyRegistry: Record<TsplRenderMode, ITsplPrintStrategy> = {
  bitmap: new TsplBitmapStrategy(),
  truetype: new TsplTrueTypeStrategy(),
};
export const resolveTsplStrategy = (mode: TsplRenderMode): ITsplPrintStrategy => {
  const strategy = TsplStrategyRegistry[mode];
  if (!strategy) throw new AppErrorException({ code: AppErrorCode.TSPL_RENDER_MODE_UNSUPPORTED, message: `TSPL render mode không hỗ trợ: ${mode}` });
  return strategy;
};
```

### 4.6 `TsplDriver` sau refactor

Chỉ orchestration (§25-26, RULE 37, 43). Bỏ: `encode`, `resolveDocumentAndFont`, `encodeElements`, import `decodePngBase64ToMonochrome` / `PAPER_*` / `formatRow`.

```
scan / connect / disconnect / getStatus / onStatusChange / identify — giữ nguyên
installTsplFont(printerId, font)  — đổi tên từ installTrueTypeFont (G5, G7)

private buildBytes(printer, driver, documents, printType): Uint8Array {
  const config = driver.config;              // đã biết type === 'tspl'
  const strategy = resolveTsplStrategy(config.renderMode);
  const ctx: TsplStrategyContext = { printer, driver, documents, printType, heightMm: resolveHeightMm(driver, printType) };
  strategy.validate(ctx);                     // throw — KHÔNG catch, KHÔNG fallback
  return strategy.encode(ctx);
}

print(printerId, documents, printType)     → context lookup → buildBytes → writeBytes
testPrint(printer, driver, documents, printType) → connect-nếu-cần → buildBytes → writeBytes
```

`TsplDriver` không còn giữ `resolveDocumentAndFont` → không còn đường nào chọn
"text thay vì image" hay ngược lại. `config.renderMode` quyết định strategy,
strategy quyết định đọc `documents.text` hay `documents.image`.

---

## 5. G2 — Bỏ fallback render

### 5.1 Nguyên tắc (§130, RULE 08-12)

`config.renderMode` là **contract cứng**. Không tồn tại khái niệm "effective
mode ≠ configured mode". Khi strategy không render được → ném lỗi hard, job
`failed`, `PrintScheduler` ghi `job.error` (code TSPL_*). `OrderPrintTrigger`
nuốt lỗi + log warning → payment không bị ảnh hưởng (§103, RULE 32).

### 5.2 Bỏ `isTsplTrueTypeActive`

Xoá hàm trong `types/printer.types.ts`. Thay bằng:

```ts
/** renderMode đã CẤU HÌNH của driver TSPL (không quan tâm fontInstalled). `null` nếu không phải driver TSPL. */
export const tsplRenderModeOf = (driver: PrinterDriver): TsplRenderMode | null =>
  driver.config.type === PrinterDriverType.tspl ? driver.config.renderMode : null;
```

### 5.3 Đổi call site

| File | Cũ | Mới |
|---|---|---|
| `drivers/tspl/TsplDriver.ts` | `isTsplTrueTypeActive` trong `resolveDocumentAndFont` | xoá hàm — §4.6 |
| `printing/PrintService.ts` `imageDocumentPaperSize` | target `tspl && !isTsplTrueTypeActive(driver)` | target `tspl && tsplRenderModeOf(driver) === 'bitmap'` |
| `components/AddPrinterModal.tsx` `resolveTestPrintDocuments` | `driver.type !== tspl \|\| isTsplTrueTypeActive(driver)` → text-only | `tsplRenderModeOf(driver) !== 'bitmap'` → text-only |
| `components/PrinterInfoCard.tsx` switch `value` | `isTsplTrueTypeActive(driver)` | `tsplRenderModeOf(driver) === 'truetype'` |

### 5.4 Hệ quả có chủ đích

- User bật switch TrueType → `installTsplFont` chạy → **chỉ khi resolve** modal
  mới set `config.renderMode = 'truetype'` + `font.fontInstalled = true`
  (`AddPrinterModal.onToggleTsplFont` hiện tại đã đúng — khi fail giữ
  `renderMode: 'bitmap'`). ⇒ config đã lưu không bao giờ ở trạng thái
  `truetype + fontInstalled:false`.
- Nếu máy in mất font sau đó (§51-52) → print job **fail cứng**
  `TSPL_FONT_NOT_INSTALLED`, KHÔNG in bitmap thay thế. User tự tắt/bật lại
  switch để `DOWNLOAD` lại (§52, RULE 16 vẫn cấm DOWNLOAD tự động lúc print).

---

## 6. G3 — Error Code Taxonomy (§100-101)

### 6.1 `types/AppError.ts` — `AppErrorCode` sau refactor

Định nghĩa **đủ bộ §101** + các code hiện có còn dùng:

```ts
export const AppErrorCode = {
  // Giữ (còn call site)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NO_AVAILABLE_PRINTER: 'NO_AVAILABLE_PRINTER',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',

  // §101 — printer lifecycle
  PRINTER_NOT_FOUND: 'PRINTER_NOT_FOUND',
  PRINTER_ALREADY_EXISTS: 'PRINTER_ALREADY_EXISTS',
  PRINTER_CONNECTION_FAILED: 'PRINTER_CONNECTION_FAILED',
  PRINTER_CONNECTION_TIMEOUT: 'PRINTER_CONNECTION_TIMEOUT',
  PRINTER_NOT_CONNECTED: 'PRINTER_NOT_CONNECTED',
  PRINTER_PROTOCOL_UNKNOWN: 'PRINTER_PROTOCOL_UNKNOWN',
  PRINTER_UNSUPPORTED_CONNECTION: 'PRINTER_UNSUPPORTED_CONNECTION',
  PRINTER_BUSY: 'PRINTER_BUSY',
  PRINTER_WRITE_FAILED: 'PRINTER_WRITE_FAILED',

  // §101 — TSPL rendering
  TSPL_IMAGE_REQUIRED: 'TSPL_IMAGE_REQUIRED',
  TSPL_IMAGE_INVALID: 'TSPL_IMAGE_INVALID',
  TSPL_IMAGE_TOO_LARGE: 'TSPL_IMAGE_TOO_LARGE',
  TSPL_FONT_NOT_INSTALLED: 'TSPL_FONT_NOT_INSTALLED',
  TSPL_FONT_INSTALL_FAILED: 'TSPL_FONT_INSTALL_FAILED',
  TSPL_FONT_INVALID: 'TSPL_FONT_INVALID',
  TSPL_RENDER_MODE_UNSUPPORTED: 'TSPL_RENDER_MODE_UNSUPPORTED',
  TSPL_ELEMENT_UNSUPPORTED: 'TSPL_ELEMENT_UNSUPPORTED',
} as const;
```

Bỏ: `CONNECTION_ERROR`, `UNSUPPORTED_CONNECTION`, `PRINT_ERROR`,
`ENCODING_FAILED` (thay bằng code cụ thể bên dưới).

### 6.2 Mapping call site hiện tại → code mới

| Call site | Cũ | Mới |
|---|---|---|
| `PrinterService.findOrThrow` (throw `Error`) | `Error` | `PRINTER_NOT_FOUND` |
| `PrinterService.assertNoDuplicateIdentity` (throw `Error`) | `Error` | `PRINTER_ALREADY_EXISTS` |
| `TsplDriver.connect` / `EscPosDriver.connect` lỗi transport/permission | `CONNECTION_ERROR` | `PRINTER_CONNECTION_FAILED` |
| `TsplDriver.print` / `EscPosDriver.print` khi chưa có transport/context | `CONNECTION_ERROR` "Máy in chưa kết nối" | `PRINTER_NOT_CONNECTED` |
| `*.disconnect` lỗi | `CONNECTION_ERROR` | `PRINTER_CONNECTION_FAILED` |
| transport `write()` lỗi | (raw / `CONNECTION_ERROR`) | `PRINTER_WRITE_FAILED` |
| `scan` khi platform/connection không hỗ trợ | `UNSUPPORTED_CONNECTION` | `PRINTER_UNSUPPORTED_CONNECTION` |
| `DriverRegistry.web` mọi thao tác native | `UNSUPPORTED_CONNECTION` | `PRINTER_UNSUPPORTED_CONNECTION` |
| `TsplBitmapStrategy.validate` thiếu ảnh | `ENCODING_FAILED` | `TSPL_IMAGE_REQUIRED` |
| `TsplBitmapStrategy.encode` PNG hỏng | `ENCODING_FAILED` | `TSPL_IMAGE_INVALID` |
| `TsplBitmapStrategy.encode` quá cao | `ENCODING_FAILED` | `TSPL_IMAGE_TOO_LARGE` |
| `TsplTrueTypeStrategy.validate` chưa cài font | (fallback) | `TSPL_FONT_NOT_INSTALLED` |
| strategy element lạ | `ENCODING_FAILED` | `TSPL_ELEMENT_UNSUPPORTED` |
| `resolveTsplStrategy` mode lạ | — | `TSPL_RENDER_MODE_UNSUPPORTED` |
| `TsplFontManager` name sai regex / file rỗng | `VALIDATION_ERROR` | `TSPL_FONT_INVALID` |
| `TsplFontManager` transport lỗi lúc DOWNLOAD | `CONNECTION_ERROR` | `TSPL_FONT_INSTALL_FAILED` |
| `TsplFontManager` non-Android | `UNSUPPORTED_CONNECTION` | `PRINTER_UNSUPPORTED_CONNECTION` |
| `PrintScheduler.toAppError` fallback | `PRINT_ERROR` | `UNKNOWN_ERROR` |
| `errorCodeOf` fallback | `UNKNOWN_ERROR` | `UNKNOWN_ERROR` (giữ) |
| `EscPosTextBuilder` element không render được (barcode/image/qr) | `ENCODING_FAILED` | `TSPL_ELEMENT_UNSUPPORTED` (dùng chung tên "element unsupported"; xem §12.5) |
| discovery emit unknown_protocol (event, không throw) | — | thêm code `PRINTER_PROTOCOL_UNKNOWN` cho nhánh caller cần AppError |

`PRINTER_CONNECTION_TIMEOUT` / `PRINTER_BUSY`: định nghĩa để đủ bộ §101;
wire khi transport có timeout thật / lock từ chối — không tạo call site giả.

---

## 7. G4 — Bỏ `IPrinterDriver.encode()`

### 7.1 `types/driver.types.ts`

```ts
export interface PrintDocuments {
  /** Document text — nguồn cho ESC/POS và TSPL truetype. */
  text: PrintDocument;
  /** Base64 PNG (không tiền tố `data:`) — nguồn cho TSPL bitmap. Strategy tự dựng bitmap từ chuỗi này. */
  image?: string;
}

export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (e: DeviceScanEvent) => void): Unsubscribe;
  connect(printer: Printer, driver: PrinterDriver): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, cb: (s: PrinterStatus) => void): Unsubscribe;
  identify(printerId: string): Promise<PrinterDeviceInfo | null>;
  print(printerId: string, documents: PrintDocuments, printType: PrintType): Promise<void>;
  testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType): Promise<void>;
  // KHÔNG có encode() — §23
}
```

`printType` chuyển từ optional (`printType?`) sang **bắt buộc** (§23, §41, §85
đều truyền `printType`). Mọi call site đã có `printType` sẵn (routing/testPrint).

### 7.2 TSPL

`encode()` biến mất khỏi driver. Điểm test thuần = `strategy.encode(ctx)`
(§28). Snapshot test `TsplDriver` chuyển sang test strategy trực tiếp.

### 7.3 ESC/POS

Tách builder thuần ra module riêng — `drivers/escpos/EscPosTextBuilder.ts`:

```ts
/** document text → chuỗi text ESC/POS in được. Thuần, không connect/native — chỉ phục vụ test + `EscPosDriver` nội bộ (§111, RULE 36). */
export const buildEscPosText = (paperSize: PaperSize, documents: PrintDocuments): string;
```

`EscPosDriver` gọi `buildEscPosText(...)` nội bộ (thay `encodeDocumentText`
private + `encode` public). `EscPosDriver.test.ts` test qua `buildEscPosText`.
Production ESC/POS vẫn qua `ThermalPrinterLibraryAdapter.printTextAsync`
(§61, ngoại lệ pragmatic — không đổi).

### 7.4 `PrintDocuments.image` đổi `PrintDocument` → `string`

- `hooks/useBillImageCapture.tsx` + `OrderPrintTrigger.buildPrintDocumentVariants`
  + `AddPrinterModal.resolveTestPrintDocuments`: trả `{ text, image: base64 }`
  thay vì `{ text, image: { elements: [{ type:'image', data: base64 }] } }`.
- `TsplBitmapStrategy` nhận `string`, tự `decodePngBase64ToMonochrome`.
- `types/printDocument.types.ts`: element `image` vẫn giữ (dùng cho
  `BillImagePreview` nội bộ) nhưng không còn nằm trong `PrintDocuments`.

---

## 8. G5 + G6 — Font installation lifecycle (§43-49, §96, §126)

### 8.1 `TsplFontManager` — đổi tên method

```ts
export class TsplFontManager {
  /** Đọc TTF asset → validate byte → build `DOWNLOAD "<name>",<len>` + binary → `transport.write`. KHÔNG connect, KHÔNG set state (§53, RULE 38). Ném TSPL_FONT_INVALID / TSPL_FONT_INSTALL_FAILED / PRINTER_UNSUPPORTED_CONNECTION. */
  async downloadFont(transport: TsplTransport, font: TsplFontConfig): Promise<void>;
}
```

`ensureFontInstalled` → `downloadFont` (§47/§131: không dùng khái niệm
`ensure*`). Nội dung hàm giữ nguyên, chỉ đổi tên + đổi error code (§6.2).

### 8.2 `TsplDriver` — đổi tên method

`installTrueTypeFont(printerId, font)` → `installTsplFont(printerId, font)`
(§45). Nội dung: lookup transport → `fontManager.downloadFont(transport, font)`.
Nếu chưa connect → ném `PRINTER_NOT_CONNECTED` (caller `PrinterService` lo
connect, §8.3).

### 8.3 `PrinterService.installTsplFont` — orchestrate đúng §46/§126

```
installTsplFont(printerId, font):
  lock.runExclusive(resourceKeyForTsplPrinterId(printerId), async () => {
    const tspl = getDriver('tspl') as TsplDriver;
    const wasConnected = tspl.getStatus(printerId) === 'connected';
    if (!wasConnected) await tspl.connect(printer, tsplDriverEntry);   // §46 "Connect"
    try {
      await tspl.installTsplFont(printerId, font);                      // DOWNLOAD
    } finally {
      if (!wasConnected) await tspl.disconnect(printerId).catch(() => undefined);  // §46 "Disconnect" — chỉ đóng cái mình mở
    }
  })
  // "Persist state" (§46) — xem §8.4
```

- Toàn bộ trong `lock.runExclusive` → không interleave với print trên cùng
  resource (§96, RULE 24).
- `connect`/`disconnect` **chỉ khi hàm tự mở** connection (§95 "Driver Connect
  Reuse" — modal đang mở connection từ discovery thì tái dùng, không đóng của
  người khác).
- `resolveTargets`/print path **không bao giờ** gọi `installTsplFont` /
  `downloadFont` (§47, §131, RULE 17). Test bảo vệ: grep print path.

### 8.4 "Persist state" (§46 bước cuối) — reconcile với Add-flow

- **Printer đã có trong storage:** `PrinterService.installTsplFont` sau khi
  DOWNLOAD thành công tự `savePrinters(...)` set `config.font.fontInstalled = true`
  + `config.renderMode = 'truetype'` cho driver TSPL của printer đó.
- **Draft (đang thêm mới, chưa Save):** `installTsplFont` chỉ resolve/throw.
  `AddPrinterModal.onToggleTsplFont` set state React (hiện tại đã làm) → đi
  vào `buildDraftPrinter()` khi Save. Không có gì để persist vì printer chưa
  tồn tại. Đây là reconcile bắt buộc — §46 giả định printer đã tồn tại; xem §12.3.

---

## 9. G7 + G9 + G10 — Rename & Logger

### 9.1 Rename cơ học (toàn repo, gồm test)

| Cũ | Mới | § |
|---|---|---|
| type `PrintDocumentVariants` | `PrintDocuments` | §7, §83 |
| `PrintJob.documentVariants` | `PrintJob.documents` | §85 |
| `PrintService`/`PrintScheduler`/`OrderPrintTrigger` biến `documentVariants` | `documents` | §85 |
| `TsplFontManager.ensureFontInstalled` | `downloadFont` | §47 |
| `TsplDriver.installTrueTypeFont` | `installTsplFont` | §45 |
| `isTsplTrueTypeActive` | `tsplRenderModeOf` (đổi semantics, §5.2) | §130 |
| `discovery/PrinterDiscoveryService.ts` `DiscoveryStage` | giữ (khớp §64 "stage") | — |

`PrintJob` giữ `requestId` / `retryCount` / `status` / timestamps (§12.4).

### 9.2 `PrinterLogger` (§105-106)

Thêm field vào mọi event, chuẩn hoá key theo §105 nhưng **bỏ `resourceKey`**
(chứa IP LAN → vi phạm §106). Field cuối:

```
printerId | operation | driverType | connectionType | durationMs | result | errorCode
```

- `operation`: `'scan' | 'connect' | 'disconnect' | 'discovery' | 'test-print' | 'print' | 'font-install'`.
- `result`: `'success' | 'failure'`.
- `resourceKey`: **không log** — thay bằng không gì (connectionType + driverType
  đã đủ để debug concurrency mà không lộ IP). Ghi chú lý do trong code +
  cập nhật ARCHITECTURE.md §105 (§12.6).
- Thêm `PrinterLogger.fontInstall{Succeeded,Failed}` (§126) + `printStarted`
  nếu cần cho §94 lifecycle (tuỳ chọn — chỉ nếu test cần).

---

## 10. G11 — Dọn ARCHITECTURE.md

Sửa **tại chỗ** `src/features/printer/ARCHITECTURE.md`:

1. **Xoá dòng 1-26** (preamble hội thoại "Được. Với yêu cầu...", "Dưới đây là
   bản nên dùng làm..."). File bắt đầu từ `# Printer Feature — Production
   Architecture & Runtime Design`.
2. **Sync tên với code sau refactor:**
   - §9 `PrintType`: ghi rõ codebase dùng const-object pattern
     (`export const PrintType = { Receipt, Label } as const`) + derived type —
     giá trị `'Receipt' | 'Label'` không đổi.
   - §23 `IPrinterDriver`: cập nhật signature thật (§12.1) — `scan` streaming,
     `connect(printer, driver)`, `identify(printerId)`, thêm ghi chú "pseudocode
     §23 gốc là minh hoạ; signature thật xem `types/driver.types.ts`".
   - §50 `TsplFontConfig`: sửa còn `{ name, fileName, fontInstalled }` —
     `renderMode` thuộc `TsplDriverConfig` (§14, §29), không thuộc font config.
   - §85 `PrintJob`: cập nhật shape thật (`id, requestId, printerId, printType,
     documents, status, retryCount, error?, *At`).
   - §105: bỏ `resourceKey` khỏi danh sách field, thêm câu "resourceKey KHÔNG
     log vì chứa IP (§106)".
   - §101: giữ nguyên (đã là target của §6.1).
3. **Thêm mục "Documented Deviations"** vào cuối (trước §146) — copy từ §12
   spec này (ESC/POS pragmatic path, scan streaming, per-driver connect, draft
   font persist, TrueType chưa verify phần cứng, iOS không có đường font/USB).
4. Không đổi nội dung 50 RULE / 45 invariant / các flow §124-145.

---

## 11. Testing (§120)

### 11.1 Unit (bắt buộc, `__tests__/` cạnh file logic)

| Unit | Test chính |
|---|---|
| `TsplBitmapStrategy` | thiếu `image` → `TSPL_IMAGE_REQUIRED`; PNG hỏng → `TSPL_IMAGE_INVALID`; cao quá `heightMm` → `TSPL_IMAGE_TOO_LARGE`; happy path → bytes chứa `BITMAP` + `PRINT`; width resize theo paperSize 58/80 |
| `TsplTrueTypeStrategy` | `fontInstalled:false` → `TSPL_FONT_NOT_INSTALLED`; `renderMode:'bitmap'` truyền nhầm → `TSPL_FONT_NOT_INSTALLED`; happy → `TEXT "<fontName>"` + `PRINT`, không có `BITMAP`, không có `DOWNLOAD`; element lạ → `TSPL_ELEMENT_UNSUPPORTED` |
| `TsplStrategyRegistry` | `resolveTsplStrategy('bitmap'|'truetype')` trả đúng instance; mode lạ → `TSPL_RENDER_MODE_UNSUPPORTED` |
| `TsplDriver` (viết lại) | `print` bitmap: chưa có `documents.image` → job ném `TSPL_IMAGE_REQUIRED` (KHÔNG in text); `print` truetype chưa cài font → `TSPL_FONT_NOT_INSTALLED` (KHÔNG in bitmap); `print`/`testPrint`/`connect`/reconnect **không** gọi `downloadFont` (spy) |
| `EscPosTextBuilder` | các element → text đúng; barcode/image → `TSPL_ELEMENT_UNSUPPORTED` |
| `TsplFontManager.downloadFont` | build đúng `DOWNLOAD "<name>",<len>` + binary; non-Android → `PRINTER_UNSUPPORTED_CONNECTION`; file rỗng → `TSPL_FONT_INVALID`; transport lỗi → `TSPL_FONT_INSTALL_FAILED` |
| `PrinterService.installTsplFont` | trong lock; tự connect khi chưa connect + disconnect sau; KHÔNG disconnect nếu đã connected sẵn; persist `fontInstalled/renderMode` cho printer đã lưu; draft không persist |
| `PrintService.imageDocumentPaperSize` | có target `tspl` renderMode `bitmap` → trả paperSize; chỉ có `tspl` renderMode `truetype` → `null`; `escpos` → `null` |
| `AppError` | mọi code §101 tồn tại; `errorCodeOf` fallback `UNKNOWN_ERROR` |

### 11.2 Regression (giữ xanh)

`PrintScheduler` / `PrintRoutingService` / `PrinterConnectionLock` /
`PrinterService` / `discoverProtocol` / `printerFormSchema` / transports /
`OrderPrintTrigger` — cập nhật theo rename, logic không đổi.

### 11.3 Hardware (§121) — ngoài phạm vi tự động

Ghi lại checklist trong plan; user tự test trên máy thật (USB/BT/LAN ×
bitmap/truetype/DOWNLOAD). TrueType vẫn **chưa xác nhận phần cứng** (§12.5).

### 11.4 `npm run verify` (type-check + lint + test) xanh trước mỗi commit.

---

## 12. Deviations & Reconciliations

Chỗ ARCHITECTURE.md không thể theo 100% literal vì tự mâu thuẫn hoặc pseudocode
làm regress hành vi thật. **Cần bạn xác nhận lúc review spec.**

### 12.1 `IPrinterDriver` §23 signature là minh hoạ

§23 viết `scan(): Promise<PrinterDevice[]>`, `connect(printer)`,
`onStatusChange(listener)`. Signature thật giữ nguyên:
- `scan(connectionType, onEvent): Unsubscribe` — Bluetooth discovery stream
  ~12s + cần huỷ; đổi sang `Promise` mất khả năng cancel + loading state.
- `connect(printer, driver)` — 1 `Printer` có ≤ 2 driver, mỗi driver connect
  bằng config/transport riêng (§15, §64 flow cũng connect từng candidate).
- `onStatusChange(printerId, cb)` — status theo từng printer.
→ Chỉ đổi: **bỏ `encode()`** + `printType` bắt buộc. Cập nhật §23 trong doc
thành signature thật (§10.2).

### 12.2 `EscPosDriver` không đi qua `Transport`

§56-61 mô tả Transport chung; ESC/POS dùng thư viện vendor gộp
connect+encode+write (đã ghi ở `2026-08-26 §2.3`, ARCHITECTURE.md §61 cũng
thừa nhận). Giữ ngoại lệ. `EscPosTextBuilder` thuần chỉ phục vụ test.

### 12.3 Font persist khi Add-flow (§46 bước "Persist state")

§46/§126 giả định printer đã tồn tại. Trong `AddPrinterModal` (thêm mới),
printer chưa có trong storage khi user bật switch TrueType. Reconcile:
`installTsplFont` chỉ persist nếu printer có trong storage; draft do modal
mang vào `buildDraftPrinter()` lúc Save (§8.4).

### 12.4 `PrintJob` giữ field ngoài §85

§85 chỉ liệt kê `id, printerId, driverType, printType, documents, createdAt`.
Giữ thêm `requestId` (gộp job multi-target từ 1 lệnh `PrintService.print` —
cần cho §128-129 failure isolation), `status`, `retryCount`, `error?`,
`startedAt?`, `completedAt?` (scheduler lifecycle §86, §94). **Không thêm**
`driverType` vào job như §85 gợi ý — `PrintScheduler.resourceKeyFor` đã tự tra
driver từ `printer + printType`, thêm field là trùng nguồn sự thật. Cập nhật
§85 doc cho khớp shape thật.

### 12.5 `TSPL_ELEMENT_UNSUPPORTED` dùng cho cả ESC/POS

§101 chỉ có `TSPL_ELEMENT_UNSUPPORTED`. ESC/POS text builder gặp element
không in được (barcode/image) cũng ném code này (không có `ESCPOS_*` trong
§101). Chấp nhận tên "TSPL_" hơi rộng nghĩa, hoặc thêm `ELEMENT_UNSUPPORTED`
generic — **đề xuất: dùng `TSPL_ELEMENT_UNSUPPORTED`** để bám §101 100%.

### 12.6 `PrinterLogger` bỏ `resourceKey` (§105 vs §106)

§105 liệt kê `resourceKey` là field log; §106 cấm log IP; resourceKey TSPL
LAN = `tspl:lan:<ip>:<port>`. Ưu tiên §106 → không log `resourceKey`.
Cập nhật §105 doc.

### 12.7 TrueType chưa xác nhận phần cứng

Cú pháp `DOWNLOAD` + `TEXT "<font>"` theo TSPL2 phổ biến, **chưa test máy
thật** (kế thừa `2026-08-27 §2`). No-fallback nghĩa là nếu cú pháp sai trên
firmware cụ thể → in fail thật (trước đây fallback bitmap che được). User
phải test phần cứng trước khi bật TrueType ở production. Ghi rõ trong
ARCHITECTURE.md "Documented Deviations" + comment `TsplTrueTypeStrategy`.

---

## 13. Build Sequence (cho writing-plans)

Mỗi phase = commit độc lập, `npm run verify` xanh.

1. **P1 — Error taxonomy.** `AppErrorCode` bộ mới + mapping call site hiện có
   (§6). Rename cơ học `CONNECTION_ERROR`... Cập nhật test. *(không đổi hành vi
   ngoài mã lỗi)*
2. **P2 — `PrintDocuments` rename + `image: string`.** Type + `PrintJob.documents`
   + call site (`PrintService`, `PrintScheduler`, `OrderPrintTrigger`,
   `useBillImageCapture`, `AddPrinterModal`). *(chưa đụng strategy)*
3. **P3 — TSPL Strategy Pattern.** `tsplStrategy.types.ts` +
   `TsplBitmapStrategy` + `TsplTrueTypeStrategy` + `TsplStrategyRegistry` +
   test. `TsplDriver` chuyển sang `resolveTsplStrategy` + `buildBytes`, xoá
   `encode`/`resolveDocumentAndFont`/`encodeElements`. **Bỏ fallback** tại đây.
4. **P4 — Bỏ `isTsplTrueTypeActive`.** `tsplRenderModeOf` + đổi 4 call site
   (§5.3). Test `imageDocumentPaperSize` + modal.
5. **P5 — Bỏ `IPrinterDriver.encode()`.** `EscPosTextBuilder` + `EscPosDriver`
   nội bộ hoá + `printType` bắt buộc. Viết lại `EscPosDriver.test` /
   `TsplDriver.test` snapshot.
6. **P6 — Font lifecycle.** `downloadFont` rename + `TsplDriver.installTsplFont`
   + `PrinterService.installTsplFont` orchestrate lock→connect→DOWNLOAD→
   disconnect→persist (§8). Test print-path-no-DOWNLOAD.
7. **P7 — Logger.** Field `operation`/`result`, bỏ `resourceKey`,
   `fontInstall*` events.
8. **P8 — Dọn `ARCHITECTURE.md`** (§10) + note supersede vào 2 spec cũ +
   "Documented Deviations".
9. **P9 — Full sweep.** `npm run verify`; grep `no-fallback` guard; đối chiếu
   45 invariant §142 + 50 RULE §145 từng dòng, ghi bảng "conform / N/A" vào
   cuối plan.

---

## 14. Ngoài phạm vi

- Verify phần cứng TrueType / `DOWNLOAD` (§121 hardware matrix) — user tự test.
- iOS font path / iOS USB (§4 spec 2026-08-27 — Android-only, giữ nguyên).
- `PRINTER_CONNECTION_TIMEOUT` / `PRINTER_BUSY` wiring thật (chỉ định nghĩa).
- Đổi `IPrinterDriver` sang signature §23 literal (§12.1).
- Redesign UI ngoài đổi 1 dòng `PrinterInfoCard` switch value (§5.3).
- Multi-font / UI chọn font (§10 spec 2026-08-27).
