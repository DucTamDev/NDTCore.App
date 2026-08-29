# Printer Architecture Conformance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa feature `printer` về đúng 100% contract trong `src/features/printer/ARCHITECTURE.md` — trọng tâm là TSPL Strategy Pattern và bỏ toàn bộ fallback render.

**Architecture:** `TsplDriver` chỉ orchestration (connection lifecycle + write). Mọi render TSPL delegate cho `ITsplPrintStrategy` (thuần, config-only) resolve từ `TsplStrategyRegistry` theo `TsplDriverConfig.renderMode`. Strategy fail → print job fail cứng với `TSPL_*` error code, KHÔNG chuyển strategy khác. Font `DOWNLOAD` là lifecycle riêng, tuyệt đối không nằm trong print path.

**Tech Stack:** React Native CLI 0.86 (New Arch), TypeScript strict, Jest, Zod, Redux Toolkit, react-native-mmkv.

**Spec:** [`docs/superpowers/specs/2026-08-28-printer-architecture-conformance-design.md`](../specs/2026-08-28-printer-architecture-conformance-design.md)

## Global Constraints

- **Ngôn ngữ:** mọi text hiển thị cho user = tiếng Việt. Comment code = tiếng Việt, chỉ giải thích WHY.
- **TypeScript strict, không `any`.** Không path alias — import relative.
- **Không thêm feature/abstraction/error-handling vượt yêu cầu.**
- **Enum pattern:** const-object + derived type (`export const X = {...} as const; export type X = (typeof X)[keyof typeof X]`), không dùng `enum` keyword, không dùng bare union type cho giá trị có sẵn ở runtime.
- **Test:** chỉ file logic (services, drivers, strategies, schemas, reducers, transports, builders) có `.test.ts`, đặt trong `__tests__/` cùng cấp. Component UI thuần trình bày KHÔNG có test.
- **`npm run verify`** (type-check + lint + test) phải xanh trước **mỗi** commit.
- **Nguồn sự thật:** `src/features/printer/ARCHITECTURE.md`. `§N` / `RULE NN` trỏ tới file đó.
- **Không migrate storage** — `CURRENT_STORAGE_VERSION` chỉ bump nếu shape `Printer` đổi (kế hoạch này KHÔNG đổi shape `Printer`).
- **ESC/POS là ngoại lệ pragmatic** (§61, spec §12.2): không đi qua `Transport`, dùng `ThermalPrinterLibraryAdapter`. Không viết lại.
- **`IPrinterDriver` signature giữ nguyên** trừ: bỏ `encode()`, `printType` chuyển sang bắt buộc (spec §12.1).

---

## File Structure

### Tạo mới

| File | Trách nhiệm |
|---|---|
| `src/features/printer/drivers/tspl/strategies/tsplStrategy.types.ts` | `ITsplPrintStrategy`, `TsplStrategyContext` |
| `src/features/printer/drivers/tspl/strategies/TsplBitmapStrategy.ts` | `documents.image` (base64) → monochrome → `BITMAP` bytes |
| `src/features/printer/drivers/tspl/strategies/TsplTrueTypeStrategy.ts` | `documents.text` → `TEXT`/`BARCODE`/`QRCODE` bytes với font custom |
| `src/features/printer/drivers/tspl/strategies/__tests__/TsplBitmapStrategy.test.ts` | test bitmap strategy |
| `src/features/printer/drivers/tspl/strategies/__tests__/TsplTrueTypeStrategy.test.ts` | test truetype strategy |
| `src/features/printer/drivers/tspl/TsplStrategyRegistry.ts` | `Record<TsplRenderMode, ITsplPrintStrategy>` + `resolveTsplStrategy` |
| `src/features/printer/drivers/tspl/__tests__/TsplStrategyRegistry.test.ts` | test registry |
| `src/features/printer/drivers/escpos/EscPosTextBuilder.ts` | `buildEscPosText(paperSize, documents)` thuần |
| `src/features/printer/drivers/escpos/__tests__/EscPosTextBuilder.test.ts` | test builder |

### Sửa

| File | Sửa gì |
|---|---|
| `types/AppError.ts` | `AppErrorCode` bộ mới (§101) |
| `types/driver.types.ts` | `PrintDocumentVariants`→`PrintDocuments`, `image: string`, bỏ `encode()` khỏi `IPrinterDriver`, `printType` bắt buộc |
| `types/printer.types.ts` | bỏ `isTsplTrueTypeActive`, thêm `tsplRenderModeOf` |
| `types/printJob.types.ts` | `documentVariants`→`documents` |
| `drivers/tspl/TsplDriver.ts` | xoá `encode`/`resolveDocumentAndFont`/`encodeElements`; thêm `buildBytes` qua registry; `installTrueTypeFont`→`installTsplFont` |
| `drivers/tspl/TsplFontManager.ts` | `ensureFontInstalled`→`downloadFont`, error code mới |
| `drivers/escpos/EscPosDriver.ts` | dùng `buildEscPosText`, bỏ `encode` public, `printType` bắt buộc |
| `printing/PrinterService.ts` | `installTsplFont` orchestrate lock→connect→DOWNLOAD→disconnect→persist |
| `printing/PrintService.ts` | `imageDocumentPaperSize` key theo `renderMode` |
| `printing/PrintScheduler.ts` | rename `documentVariants`→`documents` |
| `printing/PrintRoutingService.ts` | (chỉ nếu đụng rename) |
| `services/PrinterLogger.ts` | field `operation`/`result`, `fontInstall*` events |
| `transports/*.ts` | `write()` lỗi → `PRINTER_WRITE_FAILED` |
| `hooks/useBillImageCapture.tsx` | trả `image: base64` (string) |
| `components/AddPrinterModal.tsx` | `resolveTestPrintDocuments` string image + `tsplRenderModeOf` |
| `components/PrinterInfoCard.tsx` | switch value `tsplRenderModeOf(driver) === 'truetype'` |
| `cart/services/OrderPrintTrigger.ts` | `buildPrintDocumentVariants` trả string image; rename type |
| `src/features/printer/ARCHITECTURE.md` | bỏ preamble, sync tên, §145b, Documented Deviations |
| `docs/superpowers/specs/2026-08-26-*.md`, `2026-08-27-*.md` | note supersede ở đầu file |

---

## Task 1: Error Code Taxonomy (P1)

**Files:**
- Modify: `src/features/printer/types/AppError.ts`
- Modify: `src/features/printer/types/__tests__/` (thêm test mới `AppError.test.ts` nếu chưa có)
- Modify (remap call site): `drivers/tspl/TsplDriver.ts`, `drivers/tspl/TsplFontManager.ts`, `drivers/escpos/EscPosDriver.ts`, `transports/LanTransport.ts`, `transports/BluetoothTransport.ts`, `transports/UsbTransport.ts`, `printing/PrinterService.ts`, `printing/PrintScheduler.ts`, `printing/DriverRegistry.web.ts`, `discovery/PrinterDiscoveryService.ts`
- Modify (test cập nhật code lỗi kỳ vọng): mọi `__tests__` liên quan

**Interfaces:**
- Produces: `AppErrorCode` const-object với đúng bộ §101 (xem spec §6.1) + `VALIDATION_ERROR`, `NO_AVAILABLE_PRINTER`, `UNKNOWN_ERROR`. `AppError`, `AppErrorException`, `errorCodeOf` giữ signature.

- [ ] **Step 1: Viết test cho enum mới** — `src/features/printer/types/__tests__/AppError.test.ts`

```ts
import { AppErrorCode, AppErrorException, errorCodeOf } from '../AppError';

describe('AppErrorCode', () => {
  it('có đủ bộ code §101', () => {
    const required = [
      'PRINTER_NOT_FOUND', 'PRINTER_ALREADY_EXISTS', 'PRINTER_CONNECTION_FAILED',
      'PRINTER_CONNECTION_TIMEOUT', 'PRINTER_NOT_CONNECTED', 'PRINTER_PROTOCOL_UNKNOWN',
      'PRINTER_UNSUPPORTED_CONNECTION', 'PRINTER_BUSY', 'PRINTER_WRITE_FAILED',
      'TSPL_IMAGE_REQUIRED', 'TSPL_IMAGE_INVALID', 'TSPL_IMAGE_TOO_LARGE',
      'TSPL_FONT_NOT_INSTALLED', 'TSPL_FONT_INSTALL_FAILED', 'TSPL_FONT_INVALID',
      'TSPL_RENDER_MODE_UNSUPPORTED', 'TSPL_ELEMENT_UNSUPPORTED',
      'VALIDATION_ERROR', 'NO_AVAILABLE_PRINTER', 'UNKNOWN_ERROR',
    ] as const;
    for (const code of required) expect(AppErrorCode[code]).toBe(code);
  });

  it('không còn code cũ đã bỏ', () => {
    expect((AppErrorCode as Record<string, string>).CONNECTION_ERROR).toBeUndefined();
    expect((AppErrorCode as Record<string, string>).ENCODING_FAILED).toBeUndefined();
    expect((AppErrorCode as Record<string, string>).PRINT_ERROR).toBeUndefined();
    expect((AppErrorCode as Record<string, string>).UNSUPPORTED_CONNECTION).toBeUndefined();
  });

  it('errorCodeOf trả UNKNOWN_ERROR cho lỗi không phải AppErrorException', () => {
    expect(errorCodeOf(new Error('x'))).toBe(AppErrorCode.UNKNOWN_ERROR);
    expect(errorCodeOf(new AppErrorException({ code: AppErrorCode.PRINTER_NOT_FOUND, message: 'y' }))).toBe(AppErrorCode.PRINTER_NOT_FOUND);
  });
});
```

- [ ] **Step 2: Chạy test — FAIL** (`CONNECTION_ERROR` vẫn tồn tại, code mới chưa có)

Run: `npx jest src/features/printer/types/__tests__/AppError.test.ts`
Expected: FAIL

- [ ] **Step 3: Viết `AppErrorCode` mới** — `src/features/printer/types/AppError.ts`

```ts
export const AppErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NO_AVAILABLE_PRINTER: 'NO_AVAILABLE_PRINTER',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',

  PRINTER_NOT_FOUND: 'PRINTER_NOT_FOUND',
  PRINTER_ALREADY_EXISTS: 'PRINTER_ALREADY_EXISTS',
  PRINTER_CONNECTION_FAILED: 'PRINTER_CONNECTION_FAILED',
  PRINTER_CONNECTION_TIMEOUT: 'PRINTER_CONNECTION_TIMEOUT',
  PRINTER_NOT_CONNECTED: 'PRINTER_NOT_CONNECTED',
  PRINTER_PROTOCOL_UNKNOWN: 'PRINTER_PROTOCOL_UNKNOWN',
  PRINTER_UNSUPPORTED_CONNECTION: 'PRINTER_UNSUPPORTED_CONNECTION',
  PRINTER_BUSY: 'PRINTER_BUSY',
  PRINTER_WRITE_FAILED: 'PRINTER_WRITE_FAILED',

  TSPL_IMAGE_REQUIRED: 'TSPL_IMAGE_REQUIRED',
  TSPL_IMAGE_INVALID: 'TSPL_IMAGE_INVALID',
  TSPL_IMAGE_TOO_LARGE: 'TSPL_IMAGE_TOO_LARGE',
  TSPL_FONT_NOT_INSTALLED: 'TSPL_FONT_NOT_INSTALLED',
  TSPL_FONT_INSTALL_FAILED: 'TSPL_FONT_INSTALL_FAILED',
  TSPL_FONT_INVALID: 'TSPL_FONT_INVALID',
  TSPL_RENDER_MODE_UNSUPPORTED: 'TSPL_RENDER_MODE_UNSUPPORTED',
  TSPL_ELEMENT_UNSUPPORTED: 'TSPL_ELEMENT_UNSUPPORTED',
} as const;

export type AppErrorCode = (typeof AppErrorCode)[keyof typeof AppErrorCode];
```
`AppError`, `AppErrorException`, `errorCodeOf` giữ nguyên bên dưới.

- [ ] **Step 4: Remap call site** — dùng bảng spec §6.2. Grep từng code cũ và thay:

Run: `npx grep -rn "AppErrorCode.CONNECTION_ERROR\|AppErrorCode.ENCODING_FAILED\|AppErrorCode.UNSUPPORTED_CONNECTION\|AppErrorCode.PRINT_ERROR" src/`

Thay theo bảng:
- `CONNECTION_ERROR` (connect/disconnect/permission) → `PRINTER_CONNECTION_FAILED`
- `CONNECTION_ERROR` "Máy in chưa kết nối" → `PRINTER_NOT_CONNECTED`
- `UNSUPPORTED_CONNECTION` → `PRINTER_UNSUPPORTED_CONNECTION`
- `ENCODING_FAILED` trong `TsplDriver.resolveDocumentAndFont` "Chưa có ảnh bitmap" → `TSPL_IMAGE_REQUIRED` *(hàm này sẽ bị xoá ở Task 6 — tạm thời cứ đổi code cho test xanh)*
- `ENCODING_FAILED` "Loại nội dung in không được hỗ trợ" (TsplDriver + EscPosDriver) → `TSPL_ELEMENT_UNSUPPORTED`
- `ENCODING_FAILED` "Nội dung cao..." → `TSPL_IMAGE_TOO_LARGE`
- `PrinterService.findOrThrow` `throw new Error(...)` → `throw new AppErrorException({ code: AppErrorCode.PRINTER_NOT_FOUND, message: ... })`
- `PrinterService.assertNoDuplicateIdentity` `throw new Error(...)` → `AppErrorException({ code: AppErrorCode.PRINTER_ALREADY_EXISTS, ... })`
- `PrintScheduler.toAppError` fallback `PRINT_ERROR` → `UNKNOWN_ERROR`
- `transports/*.ts` `write()` catch → `AppErrorException({ code: AppErrorCode.PRINTER_WRITE_FAILED, ... })`

- [ ] **Step 5: Cập nhật test kỳ vọng code lỗi** — grep test:

Run: `npx grep -rn "CONNECTION_ERROR\|ENCODING_FAILED\|UNSUPPORTED_CONNECTION\|PRINT_ERROR" src/**/__tests__/`
Sửa từng `expect(...).toMatchObject({ code: ... })` / `toBe(...)` theo code mới tương ứng.

- [ ] **Step 6: `npm run verify`**

Run: `npm run verify`
Expected: PASS (type-check + lint + test xanh)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(printer): error code taxonomy đủ bộ §101"
```

---

## Task 2: `PrintDocuments` rename + `image: string` (P2)

**Files:**
- Modify: `types/driver.types.ts`, `types/printJob.types.ts`
- Modify: `printing/PrintService.ts`, `printing/PrintScheduler.ts`, `printing/PrinterService.ts`
- Modify: `hooks/useBillImageCapture.tsx`, `cart/services/OrderPrintTrigger.ts`, `components/AddPrinterModal.tsx`
- Modify: `drivers/tspl/TsplDriver.ts`, `drivers/escpos/EscPosDriver.ts` (chữ ký + đọc `documents.image` as string tạm thời qua helper)
- Test: mọi `__tests__` dùng `PrintDocumentVariants` / `documentVariants`

**Interfaces:**
- Produces:
  ```ts
  export interface PrintDocuments {
    text: PrintDocument;
    image?: string; // base64 PNG, không tiền tố data:
  }
  ```
  `PrintJob.documents: PrintDocuments` (đổi từ `documentVariants`).
- Consumes: `PrintDocument` từ `printDocument.types.ts` (không đổi).

- [ ] **Step 1: Viết/ sửa test** — `types/__tests__/printJob.types.test.ts` assert field `documents`:

```ts
it('PrintJob dùng field documents (không phải documentVariants)', () => {
  const job: PrintJob = {
    id: '1', requestId: 'r', printerId: 'p', printType: PrintType.Receipt,
    documents: { text: { elements: [] } },
    status: PrintJobStatus.pending, retryCount: 0, createdAt: new Date().toISOString(),
  };
  expect(job.documents.text).toBeDefined();
});
```

- [ ] **Step 2: Chạy — FAIL** (type `documentVariants` vẫn còn)

Run: `npx jest src/features/printer/types/__tests__/printJob.types.test.ts`

- [ ] **Step 3: Đổi type** — `types/driver.types.ts`:

```ts
export interface PrintDocuments {
  /** Document text — nguồn cho ESC/POS và TSPL truetype. */
  text: PrintDocument;
  /** Base64 PNG (không tiền tố `data:`) — nguồn cho TSPL bitmap. */
  image?: string;
}
```
Xoá `PrintDocumentVariants`. `types/printJob.types.ts`: `documentVariants` → `documents`.

- [ ] **Step 4: Sweep rename** — toàn repo:

Run: `npx grep -rln "PrintDocumentVariants\|documentVariants" src/`
- `PrintDocumentVariants` → `PrintDocuments`
- `.documentVariants` → `.documents`, `documentVariants:` → `documents:`
- `PrintService.print(printType, documentVariants)` param → `documents`
- `OrderPrintTrigger.buildPrintDocumentVariants` → giữ tên hàm nhưng đổi return type + build `image: base64` (string) thay vì `{ elements: [...] }`
- `useBillImageCapture`: không đổi (đã trả `string | null`); chỗ dùng nó trong `OrderPrintTrigger` + `AddPrinterModal` build `{ text, image: base64 }`

- [ ] **Step 5: `TsplDriver` đọc `documents.image` as string tạm** — trong `resolveDocumentAndFont` / `encodeElements`, chỗ nhận `documents.image` (trước là `PrintDocument`) giờ là `string`. Tạm bọc:

```ts
// tạm thời tới Task 6 — bitmap path nhận base64 string
if (!documents.image) throw new AppErrorException({ code: AppErrorCode.TSPL_IMAGE_REQUIRED, message: 'Chưa có ảnh bitmap để in.' });
const bitmap = decodePngBase64ToMonochrome(documents.image, PAPER_IMAGE_WIDTH_PX[printer.paperSize]);
// ... encoder.image(0, 0, bitmap) trực tiếp, bỏ vòng lặp element cho nhánh image
```

- [ ] **Step 6: `npm run verify`**

Run: `npm run verify`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(printer): PrintDocumentVariants -> PrintDocuments, image la base64 string"
```

---

## Task 3: `ITsplPrintStrategy` + `TsplBitmapStrategy` (P3a)

**Files:**
- Create: `drivers/tspl/strategies/tsplStrategy.types.ts`
- Create: `drivers/tspl/strategies/TsplBitmapStrategy.ts`
- Create: `drivers/tspl/strategies/__tests__/TsplBitmapStrategy.test.ts`

**Interfaces:**
- Consumes: `TsplEncoder` (`initialize`, `image`, `cut`, `encode`), `decodePngBase64ToMonochrome` từ `utils/pngToMonochrome`, `PAPER_IMAGE_WIDTH_PX` từ `utils/paperWidth`, `DOTS_PER_MM` từ `TsplEncoder`, `AppErrorCode`/`AppErrorException`, `PrintDocuments`, `Printer`, `PrinterDriver`, `TsplRenderMode`, `PrintType`.
- Produces:
  ```ts
  export interface TsplStrategyContext {
    printer: Printer;
    driver: PrinterDriver;   // config.type === 'tspl' đã narrow bởi TsplDriver trước khi tạo
    documents: PrintDocuments;
    printType: PrintType;
    heightMm: number;
  }
  export interface ITsplPrintStrategy {
    readonly mode: TsplRenderMode;
    validate(context: TsplStrategyContext): void;
    encode(context: TsplStrategyContext): Uint8Array;
  }
  export class TsplBitmapStrategy implements ITsplPrintStrategy { readonly mode = TsplRenderMode.bitmap; ... }
  ```

- [ ] **Step 1: Viết test** — `drivers/tspl/strategies/__tests__/TsplBitmapStrategy.test.ts`

```ts
import { TsplBitmapStrategy } from '../TsplBitmapStrategy';
import type { TsplStrategyContext } from '../tsplStrategy.types';
import { AppErrorCode } from '../../../../types/AppError';
import { PrinterDriverType, TsplRenderMode } from '../../../../types/printer.types';
import { PrintType } from '../../../../types/printConfiguration.types';
import type { Printer, PrinterDriver } from '../../../../types/printer.types';

// PNG 2x2 trắng hợp lệ, base64 (không data: prefix)
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP8//8/AwMDAwMDAwAkAAP//8i0aQAAAABJRU5ErkJggg==';

const printer: Printer = {
  id: 'p1', name: 'M', drivers: [], connectionType: 'lan' as Printer['connectionType'],
  lan: { ip: '1.2.3.4', port: 9100 }, identityKey: 'lan:1.2.3.4:9100', paperSize: 80,
  autoReconnect: false, enabled: true, createdAt: '', updatedAt: '',
};
const driver: PrinterDriver = {
  type: PrinterDriverType.tspl, source: 'auto' as PrinterDriver['source'], contentTypes: [PrintType.Receipt],
  config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap },
};
const ctx = (over: Partial<TsplStrategyContext> = {}): TsplStrategyContext => ({
  printer, driver, documents: { text: { elements: [] }, image: TINY_PNG }, printType: PrintType.Receipt, heightMm: 200, ...over,
});

describe('TsplBitmapStrategy', () => {
  const s = new TsplBitmapStrategy();

  it('mode === bitmap', () => expect(s.mode).toBe(TsplRenderMode.bitmap));

  it('validate ném TSPL_IMAGE_REQUIRED khi thiếu documents.image', () => {
    expect(() => s.validate(ctx({ documents: { text: { elements: [] } } }))).toThrow();
    try { s.validate(ctx({ documents: { text: { elements: [] } } })); } catch (e) {
      expect(e).toMatchObject({ code: AppErrorCode.TSPL_IMAGE_REQUIRED });
    }
  });

  it('validate pass khi có image', () => expect(() => s.validate(ctx())).not.toThrow());

  it('encode sinh bytes chứa BITMAP và PRINT', () => {
    const bytes = s.encode(ctx());
    const ascii = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('BITMAP');
    expect(ascii).toContain('PRINT');
  });

  it('encode ném TSPL_IMAGE_INVALID khi base64 không phải PNG', () => {
    try { s.encode(ctx({ documents: { text: { elements: [] }, image: 'bm90LWEtcG5n' } })); }
    catch (e) { expect(e).toMatchObject({ code: AppErrorCode.TSPL_IMAGE_INVALID }); }
  });

  it('encode ném TSPL_IMAGE_TOO_LARGE khi ảnh cao hơn heightMm*DOTS_PER_MM', () => {
    // heightMm nhỏ để chắc chắn vượt
    try { s.encode(ctx({ heightMm: 0.01 })); }
    catch (e) { expect(e).toMatchObject({ code: AppErrorCode.TSPL_IMAGE_TOO_LARGE }); }
  });
});
```

- [ ] **Step 2: Chạy — FAIL** (module chưa tồn tại)

Run: `npx jest src/features/printer/drivers/tspl/strategies/__tests__/TsplBitmapStrategy.test.ts`
Expected: FAIL "Cannot find module"

- [ ] **Step 3: Viết `tsplStrategy.types.ts`**

```ts
import type { Printer, PrinterDriver, TsplRenderMode } from '../../../types/printer.types';
import type { PrintDocuments } from '../../../types/driver.types';
import type { PrintType } from '../../../types/printConfiguration.types';

/**
 * Input đã resolve đầy đủ cho 1 lần render TSPL. CONFIG-ONLY có chủ đích —
 * KHÔNG chứa connection state / transport / kết quả query máy in. Strategy
 * chỉ kiểm tra configuration invariant (§28, §118, §137, spec §12).
 */
export interface TsplStrategyContext {
  printer: Printer;
  /** `config.type === 'tspl'` — `TsplDriver` narrow trước khi tạo context. */
  driver: PrinterDriver;
  documents: PrintDocuments;
  printType: PrintType;
  /** mm khai báo cho `SIZE` — resolve ở `TsplDriver.resolveHeightMm`. */
  heightMm: number;
}

export interface ITsplPrintStrategy {
  readonly mode: TsplRenderMode;
  /** Ném `AppErrorException` (TSPL_*) nếu context không đủ điều kiện. KHÔNG trả bool, KHÔNG fallback. */
  validate(context: TsplStrategyContext): void;
  /** Thuần: context → raw TSPL bytes. */
  encode(context: TsplStrategyContext): Uint8Array;
}
```

- [ ] **Step 4: Viết `TsplBitmapStrategy.ts`**

```ts
import type { ITsplPrintStrategy, TsplStrategyContext } from './tsplStrategy.types';
import { TsplRenderMode } from '../../../types/printer.types';
import { AppErrorException, AppErrorCode } from '../../../types/AppError';
import { TsplEncoder, DOTS_PER_MM } from '../TsplEncoder';
import { PAPER_IMAGE_WIDTH_PX } from '../../../utils/paperWidth';
import { decodePngBase64ToMonochrome } from '../../../utils/pngToMonochrome';

/**
 * `documents.image` (base64 PNG) → monochrome 1-bit → lệnh `BITMAP` (§31-38).
 * KHÔNG fallback: thiếu ảnh / ảnh hỏng / ảnh quá cao đều là hard failure.
 */
export class TsplBitmapStrategy implements ITsplPrintStrategy {
  readonly mode = TsplRenderMode.bitmap;

  validate(context: TsplStrategyContext): void {
    if (!context.documents.image) {
      throw new AppErrorException({ code: AppErrorCode.TSPL_IMAGE_REQUIRED, message: 'Chế độ Bitmap cần ảnh bill đã render — capture ảnh thất bại hoặc chưa chạy.' });
    }
  }

  encode(context: TsplStrategyContext): Uint8Array {
    const { printer, printType, heightMm, documents } = context;
    let bitmap;
    try {
      bitmap = decodePngBase64ToMonochrome(documents.image as string, PAPER_IMAGE_WIDTH_PX[printer.paperSize]);
    } catch (error) {
      throw new AppErrorException({ code: AppErrorCode.TSPL_IMAGE_INVALID, message: 'Ảnh bill không hợp lệ (không giải mã được PNG).', cause: error });
    }
    const maxHeightPx = heightMm * DOTS_PER_MM;
    if (bitmap.heightPx > maxHeightPx) {
      throw new AppErrorException({
        code: AppErrorCode.TSPL_IMAGE_TOO_LARGE,
        message: `Nội dung cao khoảng ${Math.ceil(bitmap.heightPx / DOTS_PER_MM)}mm, vượt khổ giấy đang khai báo (${heightMm}mm) — dùng giấy dài hơn hoặc rút gọn nội dung.`,
      });
    }
    return new TsplEncoder().initialize(printer.paperSize, printType, heightMm).image(0, 0, bitmap).cut().encode();
  }
}
```

- [ ] **Step 5: Chạy — PASS**

Run: `npx jest src/features/printer/drivers/tspl/strategies/__tests__/TsplBitmapStrategy.test.ts`
Expected: PASS

- [ ] **Step 6: `npm run verify` + Commit**

```bash
git add -A
git commit -m "feat(printer): ITsplPrintStrategy + TsplBitmapStrategy"
```

---

## Task 4: `TsplTrueTypeStrategy` (P3b)

**Files:**
- Create: `drivers/tspl/strategies/TsplTrueTypeStrategy.ts`
- Create: `drivers/tspl/strategies/__tests__/TsplTrueTypeStrategy.test.ts`

**Interfaces:**
- Consumes: `ITsplPrintStrategy`/`TsplStrategyContext` (Task 3), `TsplEncoder` (`initialize`, `text`, `barcode`, `qrcode`, `cut`, `encode`), `PAPER_WIDTH_CHARS`/`formatRow` từ `utils/paperWidth`, `AppErrorCode`.
- Produces: `export class TsplTrueTypeStrategy implements ITsplPrintStrategy { readonly mode = TsplRenderMode.truetype; ... }`

- [ ] **Step 1: Viết test** — `__tests__/TsplTrueTypeStrategy.test.ts`

```ts
import { TsplTrueTypeStrategy } from '../TsplTrueTypeStrategy';
import type { TsplStrategyContext } from '../tsplStrategy.types';
import { AppErrorCode } from '../../../../types/AppError';
import { PrinterDriverType, TsplRenderMode } from '../../../../types/printer.types';
import { PrintType } from '../../../../types/printConfiguration.types';
import type { Printer, PrinterDriver } from '../../../../types/printer.types';

const printer: Printer = {
  id: 'p1', name: 'M', drivers: [], connectionType: 'lan' as Printer['connectionType'],
  lan: { ip: '1.2.3.4', port: 9100 }, identityKey: 'k', paperSize: 80,
  autoReconnect: false, enabled: true, createdAt: '', updatedAt: '',
};
const withConfig = (config: PrinterDriver['config']): PrinterDriver => ({
  type: PrinterDriverType.tspl, source: 'auto' as PrinterDriver['source'], contentTypes: [PrintType.Receipt], config,
});
const installed = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, font: { name: 'VIETFONT', fileName: 'Roboto-Regular.ttf', fontInstalled: true } });
const notInstalled = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, font: { name: 'VIETFONT', fileName: 'Roboto-Regular.ttf', fontInstalled: false } });
const bitmapMode = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap });

const ctx = (driver: PrinterDriver): TsplStrategyContext => ({
  printer, driver,
  documents: { text: { elements: [{ type: 'text', content: 'Xin chào', x: 0, y: 0 }] } },
  printType: PrintType.Receipt, heightMm: 200,
});

describe('TsplTrueTypeStrategy', () => {
  const s = new TsplTrueTypeStrategy();

  it('mode === truetype', () => expect(s.mode).toBe(TsplRenderMode.truetype));

  it('validate ném TSPL_FONT_NOT_INSTALLED khi fontInstalled=false', () => {
    try { s.validate(ctx(notInstalled)); } catch (e) { expect(e).toMatchObject({ code: AppErrorCode.TSPL_FONT_NOT_INSTALLED }); }
    expect(() => s.validate(ctx(notInstalled))).toThrow();
  });

  it('validate ném TSPL_FONT_NOT_INSTALLED khi renderMode=bitmap (gọi nhầm strategy)', () => {
    expect(() => s.validate(ctx(bitmapMode))).toThrow();
  });

  it('validate pass khi fontInstalled=true', () => expect(() => s.validate(ctx(installed))).not.toThrow());

  it('encode dùng font.name trong lệnh TEXT, có PRINT, KHÔNG có BITMAP, KHÔNG có DOWNLOAD', () => {
    const ascii = Array.from(s.encode(ctx(installed))).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('"VIETFONT"');
    expect(ascii).toContain('PRINT');
    expect(ascii).not.toContain('BITMAP');
    expect(ascii).not.toContain('DOWNLOAD');
  });

  it('encode ném TSPL_ELEMENT_UNSUPPORTED cho element lạ', () => {
    const bad = { ...ctx(installed), documents: { text: { elements: [{ type: 'weird', x: 0, y: 0 } as never] } } };
    try { s.encode(bad); } catch (e) { expect(e).toMatchObject({ code: AppErrorCode.TSPL_ELEMENT_UNSUPPORTED }); }
    expect(() => s.encode(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npx jest src/features/printer/drivers/tspl/strategies/__tests__/TsplTrueTypeStrategy.test.ts`

- [ ] **Step 3: Viết `TsplTrueTypeStrategy.ts`** — chuyển logic nhánh text/line/table/row/barcode/qrCode từ `TsplDriver.encodeElements` hiện tại:

```ts
import type { ITsplPrintStrategy, TsplStrategyContext } from './tsplStrategy.types';
import { PrinterDriverType, TsplRenderMode } from '../../../types/printer.types';
import { AppErrorException, AppErrorCode } from '../../../types/AppError';
import { TsplEncoder } from '../TsplEncoder';
import { PAPER_WIDTH_CHARS, formatRow } from '../../../utils/paperWidth';

/**
 * `documents.text` → lệnh `TEXT`/`BARCODE`/`QRCODE` dùng font custom đã
 * `DOWNLOAD` (`config.font.name`), theo sau `PRINT` (§39-42). KHÔNG đọc
 * `documents.image`, KHÔNG gửi font binary, KHÔNG fallback.
 *
 * `validate()` chỉ kiểm tra CONFIGURATION invariant đã resolve vào
 * `driver.config` — không phải runtime font detection (spec §12).
 */
export class TsplTrueTypeStrategy implements ITsplPrintStrategy {
  readonly mode = TsplRenderMode.truetype;

  validate(context: TsplStrategyContext): void {
    const { config } = context.driver;
    if (config.type !== PrinterDriverType.tspl || config.renderMode !== TsplRenderMode.truetype || !config.font?.fontInstalled) {
      throw new AppErrorException({ code: AppErrorCode.TSPL_FONT_NOT_INSTALLED, message: 'Chưa cài font TrueType cho máy in này — bật lại công tắc "In bằng font TrueType" để cài.' });
    }
  }

  encode(context: TsplStrategyContext): Uint8Array {
    const { printer, driver, documents, printType, heightMm } = context;
    if (driver.config.type !== PrinterDriverType.tspl || !driver.config.font) {
      throw new AppErrorException({ code: AppErrorCode.TSPL_FONT_NOT_INSTALLED, message: 'Thiếu cấu hình font TrueType.' });
    }
    const fontName = driver.config.font.name;
    const paperWidth = PAPER_WIDTH_CHARS[printer.paperSize];
    const encoder = new TsplEncoder().initialize(printer.paperSize, printType, heightMm);
    for (const element of documents.text.elements) {
      if (element.type === 'text') {
        encoder.text(element.x, element.y, element.content, fontName);
      } else if (element.type === 'line') {
        encoder.text(element.x, element.y, '-'.repeat(paperWidth), fontName);
      } else if (element.type === 'table') {
        element.rows.forEach((row, i) => encoder.text(element.x, element.y + i * 20, row.join('  '), fontName));
      } else if (element.type === 'row') {
        encoder.text(element.x, element.y, formatRow(element.left, element.right, paperWidth), fontName);
      } else if (element.type === 'barcode') {
        encoder.barcode(element.x, element.y, element.content);
      } else if (element.type === 'qrCode') {
        encoder.qrcode(element.x, element.y, element.content);
      } else {
        throw new AppErrorException({ code: AppErrorCode.TSPL_ELEMENT_UNSUPPORTED, message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
      }
    }
    return encoder.cut().encode();
  }
}
```

- [ ] **Step 4: Chạy — PASS**

Run: `npx jest src/features/printer/drivers/tspl/strategies/__tests__/TsplTrueTypeStrategy.test.ts`

- [ ] **Step 5: `npm run verify` + Commit**

```bash
git add -A
git commit -m "feat(printer): TsplTrueTypeStrategy"
```

---

## Task 5: `TsplStrategyRegistry` (P3c)

**Files:**
- Create: `drivers/tspl/TsplStrategyRegistry.ts`
- Create: `drivers/tspl/__tests__/TsplStrategyRegistry.test.ts`

**Interfaces:**
- Consumes: `TsplBitmapStrategy` (Task 3), `TsplTrueTypeStrategy` (Task 4), `TsplRenderMode`, `AppErrorCode`.
- Produces:
  ```ts
  export const TsplStrategyRegistry: Record<TsplRenderMode, ITsplPrintStrategy>;
  export const resolveTsplStrategy: (mode: TsplRenderMode) => ITsplPrintStrategy;
  ```

- [ ] **Step 1: Viết test** — `drivers/tspl/__tests__/TsplStrategyRegistry.test.ts`

```ts
import { TsplStrategyRegistry, resolveTsplStrategy } from '../TsplStrategyRegistry';
import { TsplRenderMode } from '../../../types/printer.types';
import { AppErrorCode } from '../../../types/AppError';

describe('TsplStrategyRegistry', () => {
  it('resolve bitmap → strategy có mode bitmap', () => {
    expect(resolveTsplStrategy(TsplRenderMode.bitmap).mode).toBe(TsplRenderMode.bitmap);
  });
  it('resolve truetype → strategy có mode truetype', () => {
    expect(resolveTsplStrategy(TsplRenderMode.truetype).mode).toBe(TsplRenderMode.truetype);
  });
  it('registry có đúng 2 key', () => {
    expect(Object.keys(TsplStrategyRegistry).sort()).toEqual(['bitmap', 'truetype']);
  });
  it('mode lạ → TSPL_RENDER_MODE_UNSUPPORTED', () => {
    try { resolveTsplStrategy('raster' as never); } catch (e) {
      expect(e).toMatchObject({ code: AppErrorCode.TSPL_RENDER_MODE_UNSUPPORTED });
    }
    expect(() => resolveTsplStrategy('raster' as never)).toThrow();
  });
});
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npx jest src/features/printer/drivers/tspl/__tests__/TsplStrategyRegistry.test.ts`

- [ ] **Step 3: Viết `TsplStrategyRegistry.ts`**

```ts
import type { ITsplPrintStrategy } from './strategies/tsplStrategy.types';
import { TsplBitmapStrategy } from './strategies/TsplBitmapStrategy';
import { TsplTrueTypeStrategy } from './strategies/TsplTrueTypeStrategy';
import { TsplRenderMode } from '../../types/printer.types';
import { AppErrorException, AppErrorCode } from '../../types/AppError';

/** `renderMode` → strategy. Nguồn resolve DUY NHẤT — `TsplDriver` không tự switch (§27-30, RULE 05). */
export const TsplStrategyRegistry: Record<TsplRenderMode, ITsplPrintStrategy> = {
  [TsplRenderMode.bitmap]: new TsplBitmapStrategy(),
  [TsplRenderMode.truetype]: new TsplTrueTypeStrategy(),
};

export const resolveTsplStrategy = (mode: TsplRenderMode): ITsplPrintStrategy => {
  const strategy = TsplStrategyRegistry[mode];
  if (!strategy) {
    throw new AppErrorException({ code: AppErrorCode.TSPL_RENDER_MODE_UNSUPPORTED, message: `Chế độ render TSPL không hỗ trợ: ${mode}` });
  }
  return strategy;
};
```

- [ ] **Step 4: Chạy — PASS + `npm run verify` + Commit**

```bash
git add -A
git commit -m "feat(printer): TsplStrategyRegistry + resolveTsplStrategy"
```

---

## Task 6: `TsplDriver` chuyển sang Strategy, xoá render inline (P3d)

**Files:**
- Modify: `drivers/tspl/TsplDriver.ts`
- Modify: `drivers/tspl/__tests__/TsplDriver.test.ts` (viết lại phần encode/render)

**Interfaces:**
- Consumes: `resolveTsplStrategy` (Task 5), `TsplStrategyContext` (Task 3).
- Produces: `TsplDriver` không còn `encode()` / `resolveDocumentAndFont` / `encodeElements`. Method public đổi: `installTrueTypeFont` giữ tạm (đổi ở Task 9). `print`/`testPrint` nhận `printType` bắt buộc.
- `private buildBytes(printer, driver, documents, printType): Uint8Array`

- [ ] **Step 1: Viết lại test render** — trong `TsplDriver.test.ts` thay các test `encode()` cũ:

```ts
// XOÁ: 'encode() falls back...', 'encode() throws ENCODING_FAILED...', block 'renderMode resolution (via encode())'
// THÊM: test qua print() (đường thật)

it('print() bitmap mode: thiếu documents.image → ném TSPL_IMAGE_REQUIRED, KHÔNG ghi bytes', async () => {
  const driver = new TsplDriver();
  await driver.connect(lanPrinter, tsplDriverEntry);
  const write = jest.spyOn(LanTransport.prototype, 'write');
  await expect(driver.print(lanPrinter.id, { text: sampleText }, PrintType.Receipt)).rejects.toMatchObject({ code: AppErrorCode.TSPL_IMAGE_REQUIRED });
  expect(write).not.toHaveBeenCalled();
});

it('print() truetype mode chưa cài font → ném TSPL_FONT_NOT_INSTALLED, KHÔNG ghi bytes', async () => {
  const driver = new TsplDriver();
  const ttDriver = { ...tsplDriverEntry, config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype } as const };
  await driver.connect(lanPrinter, ttDriver);
  const write = jest.spyOn(LanTransport.prototype, 'write');
  await expect(driver.print(lanPrinter.id, { text: sampleText }, PrintType.Receipt)).rejects.toMatchObject({ code: AppErrorCode.TSPL_FONT_NOT_INSTALLED });
  expect(write).not.toHaveBeenCalled();
});

it('print()/testPrint()/connect() KHÔNG gọi TsplFontManager.downloadFont', async () => {
  const spy = jest.spyOn(TsplFontManager.prototype, 'downloadFont' as never);
  const driver = new TsplDriver();
  await driver.connect(lanPrinter, tsplDriverEntry);
  await driver.print(lanPrinter.id, { text: sampleText, image: tinyPngBase64() }, PrintType.Receipt).catch(() => undefined);
  await driver.testPrint(lanPrinter, tsplDriverEntry, { text: sampleText, image: tinyPngBase64() }, PrintType.Receipt).catch(() => undefined);
  expect(spy).not.toHaveBeenCalled();
});
```
*(Đặt `sampleText` = `sampleDocuments.text`. `tinyPngBase64()` là helper PNG hợp lệ đã có sẵn trong file test này (dùng bởi WIP baseline commit `5727f7e`) — dùng lại, KHÔNG tạo hằng số `TINY_PNG` mới.)*

- [ ] **Step 2: Chạy — FAIL** (`driver.encode` không còn / hành vi cũ)

Run: `npx jest src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts`

- [ ] **Step 3: Sửa `TsplDriver.ts`** — xoá `encode`, `resolveDocumentAndFont`, `encodeElements` + import `TsplEncoder` (nếu chỉ còn dùng cho `resolveHeightMm` constants thì giữ import hằng số), `decodePngBase64ToMonochrome`, `PAPER_*`, `formatRow`. Thêm:

```ts
import { resolveTsplStrategy } from './TsplStrategyRegistry';
import type { TsplStrategyContext } from './strategies/tsplStrategy.types';
import { DEFAULT_LABEL_HEIGHT_MM, CONTINUOUS_HEIGHT_MM } from './TsplEncoder';

// giữ resolveHeightMm như cũ (module-level fn)

private buildBytes(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType): Uint8Array {
  if (driver.config.type !== PrinterDriverType.tspl) {
    throw new AppErrorException({ code: AppErrorCode.TSPL_RENDER_MODE_UNSUPPORTED, message: 'Driver không phải TSPL.' });
  }
  const strategy = resolveTsplStrategy(driver.config.renderMode);
  const context: TsplStrategyContext = {
    printer, driver, documents, printType, heightMm: resolveHeightMm(driver, printType),
  };
  strategy.validate(context);   // throw — KHÔNG catch, KHÔNG fallback
  return strategy.encode(context);
}
```

`print(printerId, documents, printType)`:
```ts
const context = this.contexts.get(printerId);
const transport = this.connections.get(printerId);
if (!context || !transport) {
  throw new AppErrorException({ code: AppErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });
}
const bytes = this.buildBytes(context.printer, context.driver, documents, printType);
await this.writeBytes(context.printer, transport, bytes);
```

`testPrint(printer, driver, documents, printType)`:
```ts
if (!this.connections.has(printer.id)) await this.connect(printer, driver);
const transport = this.connections.get(printer.id);
const bytes = this.buildBytes(printer, driver, documents, printType);
await this.writeBytes(printer, transport, bytes);
```
(`printType` bỏ `?` — bắt buộc.)

**QUAN TRỌNG — cầu nối interface tới Task 8:** `IPrinterDriver.encode()` CHƯA bị xoá
khỏi interface ở task này (chỉ xoá ở Task 8). Nếu `TsplDriver` không còn method
`encode`, nó hết implement `IPrinterDriver` → type-check FAIL. Vì vậy **giữ lại
1 method `encode()` thin delegate** (xoá hẳn ở Task 8 cùng lúc xoá khỏi interface):

```ts
/** @deprecated Xoá ở Task 8 khi encode() rời khỏi IPrinterDriver — chỉ để thoả interface tạm thời. */
encode(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType): Uint8Array {
  return this.buildBytes(printer, driver, documents, printType);
}
```
Test cũ gọi `driver.encode(...)` ở Task này (nếu còn) vẫn PASS qua delegate này.

- [ ] **Step 4: Chạy — PASS** (test file này + toàn bộ printer suite)

Run: `npx jest src/features/printer/drivers/tspl/`
Expected: PASS

- [ ] **Step 5: `npm run verify` + Commit**

```bash
git add -A
git commit -m "refactor(printer): TsplDriver delegate render cho Strategy, bo fallback"
```

---

## Task 7: Bỏ `isTsplTrueTypeActive` → `tsplRenderModeOf` (P4)

**Files:**
- Modify: `types/printer.types.ts`
- Modify: `printing/PrintService.ts`, `components/AddPrinterModal.tsx`, `components/PrinterInfoCard.tsx`
- Test: `printing/__tests__/PrintService.test.ts`, các test dùng `isTsplTrueTypeActive`

**Interfaces:**
- Produces: `export const tsplRenderModeOf = (driver: PrinterDriver): TsplRenderMode | null`
- Xoá: `isTsplTrueTypeActive`

- [ ] **Step 1: Viết test** — `types/__tests__/printer.types.test.ts` thêm:

```ts
import { tsplRenderModeOf, PrinterDriverType, TsplRenderMode } from '../printer.types';

describe('tsplRenderModeOf', () => {
  const tspl = (renderMode: TsplRenderMode) => ({ type: PrinterDriverType.tspl, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.tspl, renderMode } } as never);
  it('trả renderMode đã cấu hình (không quan tâm fontInstalled)', () => {
    expect(tsplRenderModeOf(tspl(TsplRenderMode.truetype))).toBe(TsplRenderMode.truetype);
    expect(tsplRenderModeOf(tspl(TsplRenderMode.bitmap))).toBe(TsplRenderMode.bitmap);
  });
  it('trả null cho driver escpos', () => {
    expect(tsplRenderModeOf({ type: PrinterDriverType.escpos, source: 'auto', contentTypes: [], config: { type: PrinterDriverType.escpos } } as never)).toBeNull();
  });
});
```
Và trong `PrintService.test.ts`: target chỉ có `tspl` renderMode `truetype` → `imageDocumentPaperSize` trả `null`; renderMode `bitmap` → trả `paperSize`.

- [ ] **Step 2: Chạy — FAIL**

Run: `npx jest src/features/printer/types/__tests__/printer.types.test.ts src/features/printer/printing/__tests__/PrintService.test.ts`

- [ ] **Step 3: Sửa `types/printer.types.ts`** — xoá `isTsplTrueTypeActive`, thêm:

```ts
/** renderMode đã CẤU HÌNH của driver TSPL (không quan tâm fontInstalled). `null` nếu không phải TSPL. */
export const tsplRenderModeOf = (driver: PrinterDriver): TsplRenderMode | null =>
  driver.config.type === PrinterDriverType.tspl ? driver.config.renderMode : null;
```

- [ ] **Step 4: Đổi call site**
- `PrintService.imageDocumentPaperSize`:
  ```ts
  const target = deps.routing.resolveTargets(printType).find(
    (t) => t.driver.type === PrinterDriverType.tspl && tsplRenderModeOf(t.driver) === TsplRenderMode.bitmap,
  );
  ```
- `AddPrinterModal.resolveTestPrintDocuments`:
  ```ts
  if (tsplRenderModeOf(driver) !== TsplRenderMode.bitmap) return { text: document };
  const base64 = await captureBillImage(document, printer.paperSize);
  if (!base64) return { text: document };
  return { text: document, image: base64 };
  ```
- `PrinterInfoCard` switch:
  ```ts
  value={tsplRenderModeOf(driver) === TsplRenderMode.truetype}
  ```
- Grep `isTsplTrueTypeActive` toàn repo → 0 kết quả.

Run: `npx grep -rn "isTsplTrueTypeActive" src/`
Expected: (không có)

- [ ] **Step 5: `npm run verify` + Commit**

```bash
git add -A
git commit -m "refactor(printer): isTsplTrueTypeActive -> tsplRenderModeOf (config intent)"
```

---

## Task 8: Bỏ `IPrinterDriver.encode()` + `EscPosTextBuilder` (P5)

**Files:**
- Create: `drivers/escpos/EscPosTextBuilder.ts`, `drivers/escpos/__tests__/EscPosTextBuilder.test.ts`
- Modify: `types/driver.types.ts` (bỏ `encode` khỏi interface), `drivers/escpos/EscPosDriver.ts`, `drivers/tspl/TsplDriver.ts` (đảm bảo không còn `encode` trong `implements`)
- Modify test: `drivers/escpos/__tests__/EscPosDriver.test.ts` (chuyển snapshot text sang `buildEscPosText`)

**Interfaces:**
- Produces: `export const buildEscPosText = (paperSize: PaperSize, documents: PrintDocuments): string`
- `IPrinterDriver` không còn `encode`. `print`/`testPrint` `printType: PrintType` (bắt buộc).

- [ ] **Step 1: Viết test** — `drivers/escpos/__tests__/EscPosTextBuilder.test.ts`

```ts
import { buildEscPosText } from '../EscPosTextBuilder';
import { AppErrorCode } from '../../../types/AppError';
import type { PrintDocuments } from '../../../types/driver.types';

describe('buildEscPosText', () => {
  it('render text/line/row/table thành text', () => {
    const docs: PrintDocuments = { text: { elements: [
      { type: 'text', content: 'Hoá đơn', x: 0, y: 0 },
      { type: 'line', x: 0, y: 0 },
      { type: 'row', left: 'Tổng', right: '10.000', x: 0, y: 0 },
    ] } };
    const out = buildEscPosText(80, docs);
    expect(out).toContain('Hoá đơn');
    expect(out).toContain('Tổng');
    expect(out.trim().split('\n').length).toBeGreaterThanOrEqual(3);
  });

  it('element không in được (barcode) → TSPL_ELEMENT_UNSUPPORTED', () => {
    const docs: PrintDocuments = { text: { elements: [{ type: 'barcode', content: 'X', x: 0, y: 0 }] } };
    try { buildEscPosText(80, docs); } catch (e) { expect(e).toMatchObject({ code: AppErrorCode.TSPL_ELEMENT_UNSUPPORTED }); }
    expect(() => buildEscPosText(80, docs)).toThrow();
  });
});
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npx jest src/features/printer/drivers/escpos/__tests__/EscPosTextBuilder.test.ts`

- [ ] **Step 3: Viết `EscPosTextBuilder.ts`** — chuyển `EscPosDriver.encodeDocumentText` private ra:

```ts
import { AppErrorException, AppErrorCode } from '../../types/AppError';
import type { PaperSize } from '../../types/printer.types';
import type { PrintDocuments } from '../../types/driver.types';
import { PAPER_WIDTH_CHARS, formatRow } from '../../utils/paperWidth';

/**
 * `documents.text` → chuỗi text ESC/POS in được. THUẦN — không connect / native
 * (§111, RULE 36). Phục vụ `EscPosDriver` nội bộ + unit test. Production ESC/POS
 * vẫn qua `ThermalPrinterLibraryAdapter.printTextAsync` (§61, ngoại lệ pragmatic).
 */
export const buildEscPosText = (paperSize: PaperSize, documents: PrintDocuments): string => {
  const paperWidth = PAPER_WIDTH_CHARS[paperSize];
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
      throw new AppErrorException({ code: AppErrorCode.TSPL_ELEMENT_UNSUPPORTED, message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
    }
  }
  return `${lines.join('\n')}\n`;
};
```

- [ ] **Step 4: Sửa `EscPosDriver.ts`** — bỏ `encodeDocumentText` private + `encode` public. `printText` gọi `buildEscPosText(printer.paperSize, documents)`. `print(printerId, documents, printType)` / `testPrint(printer, driver, documents, printType)` — `printType` bắt buộc (không dùng trong ESC/POS nhưng khớp interface).

- [ ] **Step 5: Sửa `types/driver.types.ts`** — xoá dòng `encode(...)` + JSDoc của nó khỏi `IPrinterDriver`. `print`/`testPrint`: `printType: PrintType` (bỏ `?`).

- [ ] **Step 6: Sửa `EscPosDriver.test.ts`** — test nào gọi `driver.encode(...)` → đổi sang `buildEscPosText(paperSize, documents)`. Import từ `../EscPosTextBuilder`.

- [ ] **Step 7: Chạy toàn bộ printer suite — PASS**

Run: `npx jest src/features/printer/`
Expected: PASS

- [ ] **Step 8: `npm run verify` + Commit**

```bash
git add -A
git commit -m "refactor(printer): bo IPrinterDriver.encode(), tach EscPosTextBuilder"
```

---

## Task 9: Font installation lifecycle (P6)

**Files:**
- Modify: `drivers/tspl/TsplFontManager.ts` (`ensureFontInstalled` → `downloadFont`, error code)
- Modify: `drivers/tspl/TsplDriver.ts` (`installTrueTypeFont` → `installTsplFont`)
- Modify: `printing/PrinterService.ts` (`installTsplFont` orchestrate lock→connect→DOWNLOAD→disconnect→persist)
- Modify: `components/AddPrinterModal.tsx` (call `PrinterService.installTsplFont`, giữ luồng draft)
- Test: `drivers/tspl/__tests__/TsplFontManager.test.ts`, `printing/__tests__/PrinterService.test.ts`

**Interfaces:**
- Produces:
  - `TsplFontManager.downloadFont(transport: TsplTransport, font: TsplFontConfig): Promise<void>` (đổi tên, giữ nội dung; error → `TSPL_FONT_INVALID` / `TSPL_FONT_INSTALL_FAILED` / `PRINTER_UNSUPPORTED_CONNECTION`).
  - `TsplDriver.installTsplFont(printerId: string, font: TsplFontConfig): Promise<void>` (đổi tên từ `installTrueTypeFont`).
  - `PrinterService.installTsplFont(printerId: string, font: TsplFontConfig): Promise<void>` — nay tự connect/disconnect + persist khi printer đã lưu.

- [ ] **Step 1: Sửa test `TsplFontManager.test.ts`** — đổi tên method + code lỗi:

```ts
it('non-Android → PRINTER_UNSUPPORTED_CONNECTION', async () => {
  (Platform as { OS: string }).OS = 'ios';
  await expect(new TsplFontManager().downloadFont(transport, font)).rejects.toMatchObject({ code: AppErrorCode.PRINTER_UNSUPPORTED_CONNECTION });
});
it('file rỗng → TSPL_FONT_INVALID', async () => { /* mock readFileAssets trả '' */ });
it('transport.write lỗi → TSPL_FONT_INSTALL_FAILED', async () => { /* mock write reject */ });
it('happy: gửi DOWNLOAD "<name>",<len> + binary', async () => { /* assert transport.write payload */ });
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npx jest src/features/printer/drivers/tspl/__tests__/TsplFontManager.test.ts`

- [ ] **Step 3: Sửa `TsplFontManager.ts`** — rename `ensureFontInstalled` → `downloadFont`; đổi error code theo spec §6.2 (non-android → `PRINTER_UNSUPPORTED_CONNECTION`; đọc file lỗi/rỗng/regex → `TSPL_FONT_INVALID`; transport lỗi → `TSPL_FONT_INSTALL_FAILED`). Nội dung build payload giữ nguyên.

- [ ] **Step 4: Sửa `TsplDriver.ts`** — `installTrueTypeFont` → `installTsplFont`; body:

```ts
async installTsplFont(printerId: string, font: TsplFontConfig): Promise<void> {
  const transport = this.connections.get(printerId);
  if (!transport) throw new AppErrorException({ code: AppErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });
  await this.fontManager.downloadFont(transport, font);
}
```

- [ ] **Step 5: Viết test `PrinterService.installTsplFont`** — `printing/__tests__/PrinterService.test.ts`:

```ts
it('installTsplFont: chưa connect → tự connect rồi disconnect sau khi DOWNLOAD', async () => {
  const tspl = registry.tspl as unknown as { connect: jest.Mock; disconnect: jest.Mock; getStatus: jest.Mock; installTsplFont: jest.Mock };
  tspl.getStatus.mockReturnValue(PrinterStatus.idle);
  await service.installTsplFont(savedPrinter.id, font);
  expect(tspl.connect).toHaveBeenCalled();
  expect(tspl.installTsplFont).toHaveBeenCalledWith(savedPrinter.id, font);
  expect(tspl.disconnect).toHaveBeenCalledWith(savedPrinter.id);
});

it('installTsplFont: đã connected sẵn → KHÔNG disconnect', async () => {
  const tspl = registry.tspl as never;
  (tspl as { getStatus: jest.Mock }).getStatus.mockReturnValue(PrinterStatus.connected);
  await service.installTsplFont(savedPrinter.id, font);
  expect((tspl as { disconnect: jest.Mock }).disconnect).not.toHaveBeenCalled();
});

it('installTsplFont: printer đã lưu → persist fontInstalled=true + renderMode=truetype', async () => {
  await service.installTsplFont(savedPrinter.id, font);
  const saved = service.getPrinters().find((p) => p.id === savedPrinter.id)!;
  const tsplDriver = saved.drivers.find((d) => d.type === PrinterDriverType.tspl)!;
  expect(tsplDriver.config).toMatchObject({ renderMode: TsplRenderMode.truetype, font: { fontInstalled: true } });
});

it('installTsplFont: printerId không có trong storage (draft) → resolve, KHÔNG throw, KHÔNG ghi storage', async () => {
  const before = service.getPrinters().length;
  await expect(service.installTsplFont('draft-xyz', font)).resolves.toBeUndefined();
  expect(service.getPrinters().length).toBe(before);
});
```

- [ ] **Step 6: Chạy — FAIL**

Run: `npx jest src/features/printer/printing/__tests__/PrinterService.test.ts`

- [ ] **Step 7: Sửa `PrinterService.installTsplFont`**

```ts
const installTsplFont = async (printerId: string, font: TsplFontConfig): Promise<void> => {
  const tsplDriver = getDriver(PrinterDriverType.tspl) as TsplDriver;
  const printer = getPrinters().find((p) => p.id === printerId);
  const tsplEntry = printer?.drivers.find((d) => d.type === PrinterDriverType.tspl);

  await lock.runExclusive(resourceKeyForTsplPrinterId(printerId), async () => {
    const wasConnected = tsplDriver.getStatus(printerId) === PrinterStatus.connected;
    if (!wasConnected) {
      if (!printer || !tsplEntry) {
        // draft chưa lưu: modal đã connect sẵn qua discovery — không tự connect được vì thiếu printer object
        throw new AppErrorException({ code: AppErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối — kết nối trước khi cài font.' });
      }
      await tsplDriver.connect(printer, tsplEntry);
    }
    try {
      await tsplDriver.installTsplFont(printerId, font);
    } finally {
      if (!wasConnected && printer && tsplEntry) await tsplDriver.disconnect(printerId).catch(() => undefined);
    }
  });

  // "Persist state" (§46) — chỉ khi printer đã có trong storage
  if (printer && tsplEntry && tsplEntry.config.type === PrinterDriverType.tspl) {
    savePrinters(getPrinters().map((p) => p.id !== printerId ? p : {
      ...p,
      drivers: p.drivers.map((d) => d.type !== PrinterDriverType.tspl || d.config.type !== PrinterDriverType.tspl ? d : {
        ...d, config: { ...d.config, renderMode: TsplRenderMode.truetype, font: { ...font, fontInstalled: true } },
      }),
    }));
  }
};
```
*(Lưu ý draft: `AddPrinterModal` mở connection từ discovery và giữ nó → `getStatus === connected` → nhánh `wasConnected` true, không cần printer object. Test "draft resolve" ở Step 5 mock `getStatus` connected. Cập nhật test đó cho khớp: draft PHẢI đang connected.)*

- [ ] **Step 8: Sửa test Step 5 "draft"** cho khớp Step 7:

```ts
it('installTsplFont: draft đang connected, chưa lưu storage → DOWNLOAD, không persist, không throw', async () => {
  (registry.tspl as { getStatus: jest.Mock }).getStatus.mockReturnValue(PrinterStatus.connected);
  const before = service.getPrinters().length;
  await expect(service.installTsplFont('draft-xyz', font)).resolves.toBeUndefined();
  expect(service.getPrinters().length).toBe(before);
});
```

- [ ] **Step 9: `AddPrinterModal.onToggleTsplFont`** — không đổi logic (đã gọi `PrinterService.installTsplFont(printerId, font)`; khi thành công set state React `renderMode: truetype` + `font.fontInstalled: true` cho draft). Chỉ verify vẫn compile sau rename.

- [ ] **Step 10: Chạy printer suite — PASS + `npm run verify` + Commit**

```bash
git add -A
git commit -m "refactor(printer): font lifecycle lock->connect->DOWNLOAD->disconnect->persist (§46)"
```

---

## Task 10: `PrinterLogger` fields (P7)

**Files:**
- Modify: `services/PrinterLogger.ts`
- Modify: call site truyền field mới (drivers, discovery, PrinterService font-install)
- Test: `services/__tests__/PrinterLogger.test.ts`

**Interfaces:**
- Produces: mỗi hàm logger nhận thêm không đổi tên (giữ API cũ) NHƯNG payload gửi `LoggerService` gồm `operation` + `result`. Thêm `fontInstallSucceeded` / `fontInstallFailed`.
- **KHÔNG** thêm `resourceKey` (spec §12.6).

- [ ] **Step 1: Viết test** — `services/__tests__/PrinterLogger.test.ts`

```ts
it('connectSucceeded log kèm operation=connect, result=success, KHÔNG có resourceKey', () => {
  const spy = jest.spyOn(LoggerService, 'info');
  PrinterLogger.connectSucceeded({ printerId: 'p', protocol: PrinterDriverType.tspl, connectionType: ConnectionType.lan, durationMs: 5 });
  expect(spy).toHaveBeenCalledWith('printer.connect.succeeded', expect.objectContaining({ operation: 'connect', result: 'success' }));
  const payload = spy.mock.calls[0][1] as Record<string, unknown>;
  expect(payload).not.toHaveProperty('resourceKey');
  expect(payload).not.toHaveProperty('ip');
});

it('fontInstallSucceeded / fontInstallFailed tồn tại', () => {
  expect(typeof PrinterLogger.fontInstallSucceeded).toBe('function');
  expect(typeof PrinterLogger.fontInstallFailed).toBe('function');
});
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npx jest src/features/printer/services/__tests__/PrinterLogger.test.ts`

- [ ] **Step 3: Sửa `PrinterLogger.ts`** — mỗi hàm bơm `operation` + `result` vào params trước khi gọi `LoggerService`. Thêm:

```ts
fontInstallSucceeded(params: { printerId: string; connectionType: ConnectionType; durationMs: number }): void {
  LoggerService.info('printer.font-install.succeeded', { ...params, operation: 'font-install', result: 'success' });
},
fontInstallFailed(params: { printerId: string; connectionType: ConnectionType; errorCode: AppErrorCode; durationMs: number }): void {
  LoggerService.warning('printer.font-install.failed', { ...params, operation: 'font-install', result: 'failure' });
},
```
Giữ comment đầu file (đã nói rõ không nhận MAC/IP/rawDevice/payload) — bổ sung 1 câu: "resourceKey KHÔNG log — chứa IP LAN (§106)".

- [ ] **Step 4: Wire `fontInstall*`** vào `PrinterService.installTsplFont` (try → succeeded, catch → failed rồi rethrow).

- [ ] **Step 5: Chạy — PASS + `npm run verify` + Commit**

```bash
git add -A
git commit -m "refactor(printer): PrinterLogger them operation/result, khong log resourceKey"
```

---

## Task 11: Dọn `ARCHITECTURE.md` + supersede notes (P8)

**Files:**
- Modify: `src/features/printer/ARCHITECTURE.md`
- Modify: `docs/superpowers/specs/2026-08-26-printer-architecture-refactor-design.md`, `docs/superpowers/specs/2026-08-27-tspl-truetype-font-design.md`

**Interfaces:** (không có code — chỉ doc)

- [ ] **Step 1: Xoá preamble** — xoá dòng 1-26 của `ARCHITECTURE.md` (từ "Được. Với yêu cầu..." tới "Dưới đây là bản nên dùng làm `docs/architecture/printer.md`." + `---`). File bắt đầu bằng `# Printer Feature — Production Architecture & Runtime Design`.

- [ ] **Step 2: Sync tên** theo spec §10:
  - §9: thêm câu "Codebase dùng const-object pattern: `export const PrintType = { Receipt: 'Receipt', Label: 'Label' } as const` + derived type. Giá trị không đổi."
  - §23: thay code block bằng signature thật (`scan(connectionType, onEvent): Unsubscribe`, `connect(printer, driver)`, `disconnect(printerId)`, `getStatus(printerId)`, `onStatusChange(printerId, cb)`, `identify(printerId)`, `print(printerId, documents, printType)`, `testPrint(printer, driver, documents, printType)`) + câu "KHÔNG có `encode()`. Pseudocode gốc §23 là minh hoạ; signature chuẩn xem `types/driver.types.ts`."
  - §50: sửa `TsplFontConfig` còn `{ name, fileName, fontInstalled }` — bỏ `renderMode`/`fontName`, thêm câu "`renderMode` thuộc `TsplDriverConfig` (§14, §29)."
  - §83: giữ `{ text: PrintDocument; image?: string }` — thêm câu "`text` bắt buộc trong codebase (mọi flow đều có document text)."
  - §85 `PrintJob`: thay bằng shape thật `{ id, requestId, printerId, printType, documents: PrintDocuments, status, retryCount, error?, createdAt, startedAt?, completedAt? }` + câu "`driverType` không lưu trên job — `PrintScheduler` tự tra từ printer+printType."
  - §105: bỏ `resourceKey` khỏi list field, thêm "`resourceKey` KHÔNG log — chứa IP LAN, vi phạm §106."

- [ ] **Step 3: Thêm `# 145b. TSPL Rendering Contract — Named Rules`** ngay sau §145 — 8 named rule + bảng map RULE + "testable via" (copy từ spec §10 mục 4).

- [ ] **Step 4: Thêm `# Documented Deviations`** trước §146 — copy 7 mục từ spec §12 (IPrinterDriver §23 minh hoạ, ESC/POS pragmatic path, font persist Add-flow, PrintJob giữ requestId, TSPL_ELEMENT_UNSUPPORTED dùng chung, PrinterLogger bỏ resourceKey, TrueType chưa verify phần cứng).

- [ ] **Step 5: Note supersede** — thêm vào **đầu** 2 file spec cũ:
  - `2026-08-27-...md`: `> **[2026-08-28] §7 (bảng fallback) và §9 (test theo bảng fallback) BỊ THAY THẾ** bởi \`docs/superpowers/specs/2026-08-28-printer-architecture-conformance-design.md\`: renderMode là contract cứng, không fallback. Các phần khác còn hiệu lực.`
  - `2026-08-26-...md`: `> **[2026-08-28] §7.2 (\`IPrinterDriver.encode()\` public) BỊ THAY THẾ** bởi \`.../2026-08-28-printer-architecture-conformance-design.md\`: interface không có \`encode()\`. Phần còn lại còn hiệu lực.`

- [ ] **Step 6: Commit** (không có test — doc only)

```bash
git add -A
git commit -m "docs(printer): don ARCHITECTURE.md (bo preamble, sync ten, §145b, deviations)"
```

---

## Task 12: Full sweep + invariant/RULE checklist (P9)

**Files:**
- Create: `docs/superpowers/plans/2026-08-28-printer-conformance-checklist.md` (bảng đối chiếu)
- Modify: bất kỳ chỗ nào sweep phát hiện lệch

- [ ] **Step 1: `npm run verify`** — toàn bộ xanh.

Run: `npm run verify`
Expected: PASS

- [ ] **Step 2: Grep guard các named rule** (spec §10 mục 4 "testable via"):

```bash
# Strategy Purity: strategy không import transport/adapter/storage
npx grep -rn "transports/\|adapters/\|storage/\|StorageService" src/features/printer/drivers/tspl/strategies/
# → phải rỗng

# No Download During Print: chỉ PrinterService.installTsplFont gọi downloadFont/installTsplFont
npx grep -rn "downloadFont\|\.installTsplFont(" src/features/printer/
# → chỉ TsplFontManager (định nghĩa), TsplDriver.installTsplFont, PrinterService.installTsplFont, AddPrinterModal

# TsplDriver không render
npx grep -n "decodePngBase64ToMonochrome\|encodeElements\|resolveDocumentAndFont\|TsplEncoder" src/features/printer/drivers/tspl/TsplDriver.ts
# → chỉ import hằng số DEFAULT_LABEL_HEIGHT_MM/CONTINUOUS_HEIGHT_MM (nếu còn dùng)

# Transport không hiểu document
npx grep -rn "printDocument\|Strategy\|Encoder" src/features/printer/transports/
# → phải rỗng
```

- [ ] **Step 3: Viết bảng đối chiếu** — `docs/superpowers/plans/2026-08-28-printer-conformance-checklist.md`: liệt kê 45 invariant §142 + 50 RULE §145 + 8 named rule §145b, mỗi dòng đánh `✅ conform (file:line / test)` hoặc `⚠️ deviation (spec §12.N)` hoặc `N/A (hardware)`. Không dòng nào để trống.

- [ ] **Step 4: Xử lý mọi `⚠️` không nằm trong spec §12** — nếu sweep lộ lệch chưa lường trước: sửa code cho conform, hoặc thêm vào Documented Deviations của `ARCHITECTURE.md` (chỉ khi có lý do kỹ thuật rõ ràng, ghi trong checklist).

- [ ] **Step 5: Test hardware checklist** (không tự động — cho user):

```
[ ] USB   × bitmap    — in bill 58 + 80
[ ] USB   × truetype  — cài font (DOWNLOAD) → in bill, kiểm tra dấu tiếng Việt
[ ] BT    × bitmap
[ ] BT    × truetype
[ ] LAN   × bitmap
[ ] LAN   × truetype
[ ] truetype chưa cài font → in phải BÁO LỖI rõ (không ra giấy trắng / không rơi bitmap)
[ ] mất điện máy in giữa chừng → job fail rõ, payment vẫn OK
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs(printer): checklist doi chieu 45 invariant + 50 RULE + 8 named rule"
```

- [ ] **Step 7: Merge** — theo `superpowers:finishing-a-development-branch` (squash hay merge tuỳ user), branch `refactor/printer-architecture-conformance` → `main`.

---

## Self-Review

**Spec coverage:**
- Spec §4 (Strategy Pattern) → Task 3-6. ✅
- Spec §5 (no fallback) → Task 6 (TsplDriver không catch) + Task 7 (call sites). ✅
- Spec §6 (error taxonomy) → Task 1. ✅
- Spec §7 (bỏ encode) → Task 8. ✅
- Spec §8 (font lifecycle) → Task 9. ✅
- Spec §9 (rename + logger) → Task 2 (PrintDocuments) + Task 10 (logger). ✅
- Spec §10 (ARCHITECTURE.md) → Task 11. ✅
- Spec §11 (testing) → test steps rải khắp Task 1-10 + Task 12 sweep. ✅
- Spec §12 (deviations) → Task 11 Step 4 (Documented Deviations) + Task 12 checklist. ✅
- Spec §13 phases P1-P9 → Task 1-12 (P3 tách 4 task). ✅

**Type consistency:** `PrintDocuments` (Task 2) dùng nhất quán ở Task 3-9. `TsplStrategyContext` (Task 3) — Task 4/6 dùng đúng field. `resolveTsplStrategy` (Task 5) — Task 6 gọi đúng tên. `buildEscPosText(paperSize, documents)` (Task 8) — dùng nhất quán. `downloadFont` / `installTsplFont` (Task 9) — Task 12 grep đúng tên.

**Placeholder scan:** không có TBD/TODO. Mọi step code có code block thật. Test có assertion thật.

**Gap:** Task 2 Step 5 để `TsplDriver` đọc `documents.image` as string "tạm tới Task 6" — có nghĩa giữa Task 2→6 `TsplDriver.encode` vẫn tồn tại (chưa xoá). Chấp nhận: mỗi task vẫn `npm run verify` xanh, `encode` chỉ bị xoá ở Task 6/8. Không phải placeholder — là refactor tăng dần có kiểm soát.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-28-printer-architecture-conformance.md`. Hai lựa chọn thực thi:**

**1. Subagent-Driven (khuyến nghị)** — mỗi task 1 subagent mới, review giữa các task, iterate nhanh.

**2. Inline Execution** — chạy tuần tự trong session này qua `executing-plans`, checkpoint theo cụm.

**Chọn cách nào?**
