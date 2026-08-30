# PrintMedia Domain (SP-A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay `Printer.paperSize` + `TsplDriverConfig.labelHeightMm` bằng một domain model media đầy đủ (`PrintMedia` per driver + `PrinterCapabilities` per printer), không đổi hành vi in.

**Architecture:** Refactor thuần domain. Thêm type `PrintMedia`/`PrinterCapabilities`, đặt `media` vào từng `PrinterDriver.config` và `capabilities` vào `Printer`. Mọi chỗ đọc `printer.paperSize` chuyển sang đọc `driver.config.media.paperSize` qua helper `paperSizeOf(driver)`. Bump storage version → reset (không migrate). Zod schema enforce ràng buộc die-cut ở task riêng. Sau SP-A app in ra kết quả y hệt hôm nay — die-cut render, cutter, số hàng là SP-B.

**Tech Stack:** React Native 0.86, TypeScript strict, Zod 3.25, Jest (babel-jest — type errors KHÔNG chặn test chạy; `npm run type-check` chạy `tsc --noEmit` riêng), react-native-mmkv (qua `StorageService`).

**Spec:** `docs/superpowers/specs/2026-08-30-print-media-domain-design.md`

## Global Constraints

- Text hiển thị cho người dùng: **tiếng Việt**.
- TypeScript strict, **không `any`**.
- Không viết comment giải thích WHAT — chỉ WHY khi không rõ.
- Test file nằm trong `__tests__/` cùng cấp file logic, đuôi `.test.ts`/`.test.tsx`. Component UI thuần **không** có test riêng.
- Commit message: `<type>: <mô tả ngắn>`, kết thúc bằng dòng `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Trước khi commit: `npm run type-check` (phải sạch) + `npx jest` (phải xanh) + `npm run lint` (0 error).
- Branch: `fix/printer-post-merge` (đã ở sẵn). KHÔNG tạo branch mới.
- `PaperSize` sau task 1 = `58 | 80 | 100 | 104` (verbatim).
- `PrintMediaType` values: `'continuous'`, `'die_cut'` (verbatim). `CutterMode` values: `'none'`, `'per_job'`, `'per_row'` (verbatim).
- Giá trị mặc định media: `{ type: 'continuous', paperSize: 80 }`. `capabilities` mặc định: `{ cutter: false }`.

---

## File Structure

**Tạo mới:**

| File | Trách nhiệm |
|------|-------------|
| `src/features/printer/testing/printerFixtures.ts` | Factory `makePrinter` / `makeEscPosDriverEntry` / `makeTsplDriverEntry` dùng chung cho test — 1 nơi cập nhật shape `Printer`, SP-B/C/D không phải sửa 16 file nữa. KHÔNG phải test file (jest chỉ nhận `__tests__/`). |

**Sửa:**

| File | Thay đổi |
|------|----------|
| `src/features/printer/types/printer.types.ts` | + `PrintMediaType`, `CutterMode`, `PrintMedia`, `PrinterCapabilities`; `PaperSize` → thêm `100 \| 104`; `TsplDriverConfig` + `media`, − `labelHeightMm`; `EscPosDriverConfig` + `media`; `Printer` + `capabilities`, − `paperSize`; + helper `mediaOf`, `paperSizeOf` |
| `src/features/printer/definitions/PrinterDriverDefinitions.ts` | `defaultConfig` mỗi driver + `media: { type:'continuous', paperSize:80 }` |
| `src/features/printer/utils/paperWidth.ts` | `PAPER_WIDTH_CHARS` + `PAPER_IMAGE_WIDTH_PX` thêm key `100`, `104` |
| `src/features/printer/drivers/tspl/TsplEncoder.ts` | `widthMm` từ ternary `58?50:72` → bảng 4 khổ; comment `labelHeightMm` → `itemHeightMm` |
| `src/features/printer/drivers/tspl/TsplDriver.ts` | `resolveHeightMm`: `driver.config.labelHeightMm` → `driver.config.media.itemHeightMm` |
| `src/features/printer/drivers/tspl/strategies/TsplBitmapStrategy.ts` | `printer.paperSize` → `paperSizeOf(context.driver)` (2 chỗ) |
| `src/features/printer/drivers/tspl/strategies/TsplTrueTypeStrategy.ts` | `printer.paperSize` → `paperSizeOf(context.driver)` (2 chỗ) |
| `src/features/printer/drivers/tspl/strategies/TsplInternalFontStrategy.ts` | `printer.paperSize` → `paperSizeOf(context.driver)` (2 chỗ) |
| `src/features/printer/drivers/escpos/EscPosDriver.ts` | `sendDocuments`: `buildEscPosText(printer.paperSize, …)` → `buildEscPosText(paperSizeOf(driver), …)`; truyền `driver` xuống `sendDocuments` |
| `src/features/printer/printing/PrintService.ts` | `imageDocumentPaperSize`: `target.printer.paperSize` → `paperSizeOf(target.driver)` |
| `src/features/printer/components/PrinterListItem.tsx` | `Khổ ${printer.paperSize}mm` → `Khổ ${printer.drivers[0]?.config.media.paperSize ?? '?'}mm` |
| `src/features/printer/hooks/useAddPrinterFlow.ts` | `buildDraftPrinter`: bỏ `paperSize`, thêm `capabilities:{cutter:false}` + map `drivers` gắn `media.paperSize` từ form; đọc `captureBillImage(document, printer.paperSize)` → dùng `paperSizeOf(driver)` |
| `src/features/printer/schemas/printerFormSchema.ts` | `paperSizeSchema` +100/104; `printerDisplaySchema.paperSize` giữ; task 1: thêm `media`/`capabilities` **permissive**, bỏ `paperSize` khỏi `printerSchema`, bỏ `labelHeightMm`. task 2: `printMediaSchema.superRefine` + ràng buộc ESC/POS |
| `src/features/printer/storage/PrinterStorage.ts` | `CURRENT_STORAGE_VERSION` 3 → 4 + comment |
| `src/features/printer/discovery/PrinterDiscoveryService.ts` | comment nhắc `paperSize` → cập nhật thành `media` |
| **16 test file** (xem Task 1 Step 11) | fixture `Printer`/`PrinterDriver` sang shape mới (dùng factory mới ở đâu hợp lý) |

---

## Task 1: Migrate `Printer` domain sang `PrintMedia` + `PrinterCapabilities`

Refactor shape `Printer` là **atomic** — đổi type là ~20 file ngừng compile. Task này làm trọn: type + mọi consumer `src/` + mọi fixture test, 1 commit, repo xanh lại, **hành vi in không đổi**. Schema validation chặt (die-cut bắt buộc field, ESC/POS chỉ continuous) tách sang Task 2.

**Files:** xem bảng "Sửa" ở trên + tạo `src/features/printer/testing/printerFixtures.ts`.

**Interfaces:**
- Produces:
  ```ts
  // types/printer.types.ts
  export type PaperSize = 58 | 80 | 100 | 104;
  export const PrintMediaType: { readonly continuous: 'continuous'; readonly dieCut: 'die_cut' };
  export type PrintMediaType = 'continuous' | 'die_cut';
  export const CutterMode: { readonly none: 'none'; readonly perJob: 'per_job'; readonly perRow: 'per_row' };
  export type CutterMode = 'none' | 'per_job' | 'per_row';
  export interface PrintMedia {
    type: PrintMediaType;
    paperSize: PaperSize;
    itemWidthMm?: number;
    itemHeightMm?: number;
    columns?: number;
    horizontalGapMm?: number;
    verticalGapMm?: number;
    cutterMode?: CutterMode;
  }
  export interface PrinterCapabilities { cutter: boolean; }
  export const mediaOf: (driver: PrinterDriver) => PrintMedia;
  export const paperSizeOf: (driver: PrinterDriver) => PaperSize;
  // TsplDriverConfig: + media: PrintMedia; − labelHeightMm
  // EscPosDriverConfig: + media: PrintMedia
  // Printer: + capabilities: PrinterCapabilities; − paperSize

  // testing/printerFixtures.ts
  export const DEFAULT_MEDIA: PrintMedia;                       // { type:'continuous', paperSize:80 }
  export const makeEscPosDriverEntry: (o?: Partial<PrinterDriver> & { media?: Partial<PrintMedia> }) => PrinterDriver;
  export const makeTsplDriverEntry: (o?: Partial<PrinterDriver> & { media?: Partial<PrintMedia>; renderMode?: TsplRenderMode }) => PrinterDriver;
  export const makePrinter: (o?: Partial<Printer>) => Printer;
  ```

- [ ] **Step 1: Cập nhật `printer.types.test.ts` cho shape mới (test đi trước)**

Sửa 2 fixture trong `src/features/printer/types/__tests__/printer.types.test.ts`:
- Fixture 1 (single tspl, LAN): bỏ dòng `paperSize: 58,`; thêm `capabilities: { cutter: false },`; trong `driver.config` thêm `media: { type: 'continuous', paperSize: 58 },`.
- Fixture 2 (escpos + tspl, USB): bỏ `paperSize: 80,`; thêm `capabilities: { cutter: false },`; mỗi `config` thêm `media: { type: 'continuous', paperSize: 80 },`.
- Thêm test mới:

```ts
import { mediaOf, paperSizeOf, PrintMediaType, CutterMode } from '../printer.types';

it('mediaOf/paperSizeOf đọc media của driver entry', () => {
  const driver: PrinterDriver = {
    type: PrinterDriverType.tspl, source: DriverSource.auto, contentTypes: [PrintType.Label],
    config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { type: PrintMediaType.dieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3 } },
  };
  expect(paperSizeOf(driver)).toBe(100);
  expect(mediaOf(driver).columns).toBe(3);
});

it('CutterMode có đủ 3 giá trị', () => {
  expect([CutterMode.none, CutterMode.perJob, CutterMode.perRow]).toEqual(['none', 'per_job', 'per_row']);
});
```

- [ ] **Step 2: Chạy type-check — xác nhận đỏ đúng chỗ**

Run: `npm run type-check`
Expected: FAIL — `printer.types.test.ts` báo `mediaOf`/`paperSizeOf`/`PrintMediaType`/`CutterMode` không tồn tại, `media` không có trên config, `capabilities` không có trên `Printer`. (Các file khác cũng đỏ — sẽ sửa ở các step sau.)

- [ ] **Step 3: Thêm type vào `printer.types.ts`**

Trong `src/features/printer/types/printer.types.ts`:

Đổi `PaperSize`:
```ts
export type PaperSize = 58 | 80 | 100 | 104;
```

Thêm (cạnh `TsplRenderMode` / `TsplCodepage`):
```ts
export const PrintMediaType = {
  /** Giấy cuộn liên tục — không khe/răng cưa vật lý. */
  continuous: 'continuous',
  /** Giấy tem rời có khe (die-cut / pre-cut), có thể nhiều cột. */
  dieCut: 'die_cut',
} as const;
export type PrintMediaType = (typeof PrintMediaType)[keyof typeof PrintMediaType];

export const CutterMode = {
  none: 'none',
  /** Cắt 1 lần sau khi in xong cả job. */
  perJob: 'per_job',
  /** Cắt sau mỗi hàng in liên tiếp. */
  perRow: 'per_row',
} as const;
export type CutterMode = (typeof CutterMode)[keyof typeof CutterMode];

/**
 * Loại giấy + layout của 1 driver. Độc lập với `PrintType` (Receipt/Label) và
 * `PrinterDriverType` — cùng 1 loại nội dung in được trên cả continuous lẫn
 * die-cut. `itemWidthMm`/`itemHeightMm`/`columns`/gap chỉ có nghĩa (và schema
 * bắt buộc — xem Task 2) khi `type === 'die_cut'`.
 */
export interface PrintMedia {
  type: PrintMediaType;
  paperSize: PaperSize;
  itemWidthMm?: number;
  itemHeightMm?: number;
  columns?: number;
  horizontalGapMm?: number;
  verticalGapMm?: number;
  /** Chỉ áp dụng continuous + `capabilities.cutter`. die_cut ⇒ ép `'none'` (Task 2). `undefined` ⇒ coi như `'none'`. */
  cutterMode?: CutterMode;
}

export interface PrinterCapabilities {
  /** Máy in có dao cắt (phần cứng). */
  cutter: boolean;
}
```

`TsplDriverConfig`: thêm `media: PrintMedia;`, **xoá** `labelHeightMm?: number;` và comment của nó.
`EscPosDriverConfig`: thêm `media: PrintMedia;` (interface đang là `{ type: 'escpos'; }`).
`Printer`: thêm `capabilities: PrinterCapabilities;`, **xoá** `paperSize: PaperSize;`.

Thêm helper (cạnh `tsplRenderModeOf`):
```ts
/** `PrintMedia` của 1 driver entry. */
export const mediaOf = (driver: PrinterDriver): PrintMedia => driver.config.media;

/** Khổ giấy hiệu dụng của 1 driver entry — thay cho `Printer.paperSize` cũ. */
export const paperSizeOf = (driver: PrinterDriver): PaperSize => driver.config.media.paperSize;
```

- [ ] **Step 4: `PrinterDriverDefinitions.ts` + test**

`src/features/printer/definitions/PrinterDriverDefinitions.ts` — import `PrintMediaType`, đổi `PRINTER_DRIVER_DEFINITIONS`:
```ts
const DEFAULT_MEDIA = { type: PrintMediaType.continuous, paperSize: 80 } as const;

export const PRINTER_DRIVER_DEFINITIONS: Record<PrinterDriverType, PrinterDriverDefinition> = {
  escpos: { contentTypes: [PrintType.Receipt], defaultConfig: { type: PrinterDriverType.escpos, media: { ...DEFAULT_MEDIA } } },
  tspl: { contentTypes: [PrintType.Receipt, PrintType.Label], defaultConfig: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { ...DEFAULT_MEDIA } } },
};
```

`src/features/printer/definitions/__tests__/PrinterDriverDefinitions.test.ts` — sửa 2 test cuối:
```ts
it('escpos default config is { type: escpos, media: continuous 80 }', () => {
  expect(PRINTER_DRIVER_DEFINITIONS.escpos.defaultConfig).toEqual({ type: PrinterDriverType.escpos, media: { type: 'continuous', paperSize: 80 } });
});

it('tspl default config is { type: tspl, renderMode: bitmap, media: continuous 80 }', () => {
  expect(PRINTER_DRIVER_DEFINITIONS.tspl.defaultConfig).toEqual({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { type: 'continuous', paperSize: 80 } });
});
```

- [ ] **Step 5: `paperWidth.ts` + `TsplEncoder.ts` khổ giấy mới**

`src/features/printer/utils/paperWidth.ts` — thêm entry (giá trị tạm, `@ 8 dot/mm`, verify ở SP-B):
```ts
export const PAPER_WIDTH_CHARS: Record<PaperSize, number> = { 58: 32, 80: 48, 100: 64, 104: 69 };
export const PAPER_IMAGE_WIDTH_PX: Record<PaperSize, number> = { 58: 384, 80: 576, 100: 768, 104: 832 };
```

`src/features/printer/drivers/tspl/TsplEncoder.ts` `initialize()` — đổi:
```ts
const widthMm = paperSize === 58 ? 50 : 72;
```
thành:
```ts
// mm in được theo khổ đầu in — số cho 100/104 là tạm, verify ở SP-B.
const PRINTABLE_WIDTH_MM: Record<PaperSize, number> = { 58: 50, 80: 72, 100: 96, 104: 104 };
```
(đặt `PRINTABLE_WIDTH_MM` ở scope module, cạnh `DOTS_PER_MM`; trong `initialize` dùng `const widthMm = PRINTABLE_WIDTH_MM[paperSize];`). Sửa comment ở JSDoc `initialize`/`DEFAULT_LABEL_HEIGHT_MM` chỗ nhắc `PrinterConfig.labelHeightMm` → `media.itemHeightMm`.

- [ ] **Step 6: Sửa consumer `src/` (drivers + services + component)**

`TsplDriver.ts` `resolveHeightMm`:
```ts
const labelHeightMm = driver.config.type === PrinterDriverType.tspl ? driver.config.media.itemHeightMm : undefined;
```

`strategies/TsplBitmapStrategy.ts` — import `paperSizeOf`; đổi `PAPER_IMAGE_WIDTH_PX[printer.paperSize]` → `PAPER_IMAGE_WIDTH_PX[paperSizeOf(context.driver)]` và `.initialize(printer.paperSize, …)` → `.initialize(paperSizeOf(context.driver), …)`. (`context.driver` đã có trong `TsplStrategyContext`.)

`strategies/TsplTrueTypeStrategy.ts` + `strategies/TsplInternalFontStrategy.ts` — tương tự: `PAPER_WIDTH_CHARS[printer.paperSize]` → `PAPER_WIDTH_CHARS[paperSizeOf(driver)]`, `.initialize(printer.paperSize, …)` → `.initialize(paperSizeOf(driver), …)` (2 file này đã destructure `driver` từ context).

`EscPosDriver.ts` — `sendDocuments(adapter, printer, documents)` thêm tham số `driver`:
```ts
private async sendDocuments(adapter: NativeAdapter, driver: PrinterDriver, documents: PrintDocuments): Promise<void> {
  const text = buildEscPosText(paperSizeOf(driver), documents);
  await adapter.printText(text, ESC_POS_PRINT_OPTIONS);
}
```
2 nơi gọi: trong `print()` → `this.sendDocuments(adapter, context.driver, documents)`; trong `testPrint()` → `this.sendDocuments(adapter, driver, documents)`. Import `paperSizeOf`.

`PrintService.ts` — import `paperSizeOf`; `imageDocumentPaperSize` return `target ? paperSizeOf(target.driver) : null;`.

`components/PrinterListItem.tsx` — `\`Khổ ${printer.paperSize}mm\`` → `\`Khổ ${printer.drivers[0]?.config.media.paperSize ?? '?'}mm\``.

`discovery/PrinterDiscoveryService.ts` — comment nhắc `paperSize` (dòng ~35, 39): đổi chữ `paperSize` thành `media` cho khớp.

- [ ] **Step 7: `useAddPrinterFlow.ts` — `buildDraftPrinter` + capture**

`buildDraftPrinter()` (dòng ~197): bỏ `paperSize: displayForm.getValues('paperSize'),`, thêm sau `identityKey`:
```ts
capabilities: { cutter: false },
drivers: drivers.map((d) => ({
  ...d,
  config: { ...d.config, media: { ...d.config.media, paperSize: displayForm.getValues('paperSize') } },
})),
```
(thay dòng `drivers,` hiện có bằng block `drivers: drivers.map(...)` trên — mọi driver entry của draft nhận khổ giấy người dùng chọn ở form, giữ hành vi "1 khổ giấy/máy" như hôm nay).

Dòng ~417 `const base64 = await captureBillImage(document, printer.paperSize);` → `captureBillImage(document, paperSizeOf(driver))` (`driver` là biến `const driver` đã có trong `runTestPrint` scope; kiểm tra tên biến tại chỗ — nếu là `driver` thì dùng luôn).

Comment dòng ~194 nhắc `paperSize` → `media`.

- [ ] **Step 8: `printerFormSchema.ts` — schema structural (permissive)**

- `paperSizeSchema`: `z.union([z.literal(58), z.literal(80), z.literal(100), z.literal(104)])`.
- `printerDisplaySchema` giữ nguyên field `paperSize: paperSizeSchema` (form vẫn có picker khổ giấy ở SP-A).
- Thêm (permissive — Task 2 mới refine):
  ```ts
  const printMediaSchema = z.object({
    type: z.enum([PrintMediaType.continuous, PrintMediaType.dieCut]),
    paperSize: paperSizeSchema,
    itemWidthMm: z.number().positive().optional(),
    itemHeightMm: z.number().positive().optional(),
    columns: z.number().int().min(1).optional(),
    horizontalGapMm: z.number().min(0).optional(),
    verticalGapMm: z.number().min(0).optional(),
    cutterMode: z.enum([CutterMode.none, CutterMode.perJob, CutterMode.perRow]).optional(),
  });
  const printerCapabilitiesSchema = z.object({ cutter: z.boolean() });
  ```
- `tsplDriverConfigSchema`: thêm `media: printMediaSchema,`; **xoá** `labelHeightMm: z.number().positive().optional(),`.
- `escPosDriverConfigSchema`: `z.object({ type: z.literal(PrinterDriverType.escpos), media: printMediaSchema })`.
- `printerSchema`: **xoá** `paperSize: paperSizeSchema,`; thêm `capabilities: printerCapabilitiesSchema,`.
- Import `PrintMediaType`, `CutterMode` từ `../types/printer.types`.

- [ ] **Step 9: `PrinterStorage.ts` — bump version**

```ts
// v4: bỏ Printer.paperSize + TsplDriverConfig.labelHeightMm, thay bằng
//     PrinterDriver.config.media (PrintMedia) + Printer.capabilities.
//     Shape Printer đổi không tương thích ngược → reset (không migrate).
const CURRENT_STORAGE_VERSION = 4;
```

- [ ] **Step 10: Tạo `testing/printerFixtures.ts`**

```ts
import { ConnectionType, DriverSource, PrinterDriverType, PrintMediaType, TsplRenderMode } from '../types/printer.types';
import type { PrintMedia, Printer, PrinterDriver } from '../types/printer.types';
import { PrintType } from '../types/printConfiguration.types';

export const DEFAULT_MEDIA: PrintMedia = { type: PrintMediaType.continuous, paperSize: 80 };

export const makeEscPosDriverEntry = (o: Partial<PrinterDriver> & { media?: Partial<PrintMedia> } = {}): PrinterDriver => ({
  type: PrinterDriverType.escpos,
  source: DriverSource.auto,
  contentTypes: [PrintType.Receipt],
  ...o,
  config: { type: PrinterDriverType.escpos, media: { ...DEFAULT_MEDIA, ...o.media }, ...(o.config as object) },
});

export const makeTsplDriverEntry = (
  o: Partial<PrinterDriver> & { media?: Partial<PrintMedia>; renderMode?: TsplRenderMode } = {},
): PrinterDriver => ({
  type: PrinterDriverType.tspl,
  source: DriverSource.auto,
  contentTypes: [PrintType.Label],
  ...o,
  config: {
    type: PrinterDriverType.tspl,
    renderMode: o.renderMode ?? TsplRenderMode.bitmap,
    media: { ...DEFAULT_MEDIA, ...o.media },
    ...(o.config as object),
  },
});

export const makePrinter = (o: Partial<Printer> = {}): Printer => ({
  id: 'p1',
  name: 'Máy in test',
  drivers: o.drivers ?? [makeEscPosDriverEntry()],
  connectionType: ConnectionType.lan,
  lan: { ip: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...o,
});
```

> **CHECKPOINT** — chạy `npm run type-check`. Mọi lỗi còn lại phải nằm trong **test file** (`__tests__/`). Nếu còn lỗi trong `src/` không phải test → thiếu 1 consumer, quay lại Step 6-9. Nếu type design sai (vd `paperSizeOf` không narrow được) → dừng, xem lại Step 3 trước khi làm 16 file fixture.

- [ ] **Step 11: Cập nhật fixture 16 test file**

Với mỗi file dưới đây, mọi object literal `Printer` bỏ `paperSize: N` → thêm `capabilities: { cutter: false }` (nếu chưa có) và đảm bảo mỗi `PrinterDriver.config` có `media: { type: 'continuous', paperSize: N }` (N = giá trị `paperSize` cũ, mặc định 80). Ưu tiên thay bằng `makePrinter`/`makeTspl…`/`makeEscPos…` khi fixture là boilerplate; giữ inline khi test cần shape rất cụ thể.

- `discovery/__tests__/PrinterDiscoveryService.test.ts` (1)
- `drivers/escpos/__tests__/EscPosDriver.test.ts` (5) — fixture `Printer` + `PrinterDriver`; assert `buildEscPosText` nhận `paperSizeOf` đúng
- `drivers/tspl/strategies/__tests__/TsplBitmapStrategy.test.ts` (1)
- `drivers/tspl/strategies/__tests__/TsplTrueTypeStrategy.test.ts` (1)
- `drivers/tspl/strategies/__tests__/TsplInternalFontStrategy.test.ts` (1) — `withConfig` helper: thêm `media` vào config; `printer` fixture bỏ `paperSize`, thêm `capabilities`
- `drivers/tspl/__tests__/TsplDriver.test.ts` (2) — nếu có test `labelHeightMm` → đổi sang `media.itemHeightMm`
- `drivers/tspl/__tests__/TsplEncoder.test.ts` — test `'initialize() emits Label SIZE … custom labelHeightMm'` vẫn hợp lệ (param `labelHeightMm` của `initialize()` **không đổi tên**, chỉ `TsplDriverConfig.labelHeightMm` bị bỏ). Thêm 1 test: `initialize(100)` → `SIZE 96 mm, …`; `initialize(104)` → `SIZE 104 mm, …`.
- `hooks/__tests__/useAddPrinterFlow.test.tsx` (2) — `savedTspl`/`bitmapTspl` fixture: bỏ `paperSize`, thêm `capabilities`, `config` + `media`. Thêm test: sau khi thêm driver + Save, `buildDraftPrinter` (qua mock `addPrinter`/`updatePrinter` arg) có `capabilities.cutter === false` và mỗi `driver.config.media.paperSize === <form paperSize>`.
- `hooks/__tests__/usePrinterList.test.tsx` (1)
- `printing/__tests__/PrinterService.test.ts` (1) — `basePrinter` + `tsplDriverEntry`
- `printing/__tests__/PrintRoutingService.test.ts` (1)
- `printing/__tests__/PrintScheduler.test.ts` (1)
- `printing/__tests__/PrintService.test.ts` (9) — local `makePrinter(id, overrides)`: bỏ `paperSize: 80`, thêm `capabilities: { cutter:false }`; các call `makePrinter('p1', { paperSize: 58 })` → `makePrinter('p1', { drivers: [makeEscPosDriverEntry({ media: { paperSize: 58 } })] })` (import factory mới); assert `imageDocumentPaperSize` trả từ `media`
- `schemas/__tests__/printerFormSchema.test.ts` (7) — fixture printer hợp lệ (dòng ~25): bỏ `paperSize: 80`, thêm `capabilities: { cutter: false }` + `config.media`; `printerDisplaySchema` test giữ nguyên (form vẫn có `paperSize`)
- `storage/__tests__/PrinterStorage.test.ts` (1) — `printer` fixture: bỏ `paperSize`, thêm `capabilities` + `config.media`. Test `'discards a legacy … older storage version'` vẫn pass (v3 fixture set thủ công vẫn < 4). Thêm assert: sau `savePrinters` + `getPrinters`, `StorageService.getItem('printer.storageVersion') === 4`.
- `store/__tests__/printerSlice.test.ts` (1)
- `types/__tests__/printer.types.test.ts` — đã làm ở Step 1

- [ ] **Step 12: Chạy toàn bộ verify**

Run: `npm run type-check` → sạch.
Run: `npx jest` → toàn bộ xanh (số test có thể +vài do test mới ở Step 1/4/11).
Run: `npm run lint` → 0 error (2 warning cũ ở `BluetoothTransport.test.ts` / `LanTransport.test.ts` chấp nhận).

Nếu đỏ: đọc lỗi, sửa fixture còn sót. KHÔNG nới type để lách.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: thay Printer.paperSize/labelHeightMm bằng PrintMedia + PrinterCapabilities (SP-A)

- printer.types.ts: PrintMedia/PrintMediaType/CutterMode/PrinterCapabilities;
  PaperSize +100|104; media per PrinterDriver.config; capabilities per Printer;
  bỏ Printer.paperSize + TsplDriverConfig.labelHeightMm; helper mediaOf/paperSizeOf
- cutover ~12 chỗ đọc printer.paperSize sang paperSizeOf(driver)
- PrinterDriverDefinitions/paperWidth/TsplEncoder: khổ 100/104 (số tạm, verify SP-B)
- printerFormSchema: media/capabilities permissive (validation chặt ở Task 2)
- PrinterStorage: version 3 -> 4 (destructive reset)
- testing/printerFixtures.ts: factory dùng chung; 16 test file sang shape mới

Hành vi in không đổi. Spec: docs/superpowers/specs/2026-08-30-print-media-domain-design.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Zod validation chặt cho `PrintMedia`

**Files:**
- Modify: `src/features/printer/schemas/printerFormSchema.ts`
- Test: `src/features/printer/schemas/__tests__/printerFormSchema.test.ts`

**Interfaces:**
- Consumes: `printMediaSchema`, `printerCapabilitiesSchema`, `printerDriverSchema`, `printerSchema` (Task 1); `PrintMediaType`, `CutterMode` từ `types/printer.types`.
- Produces: không có export mới — siết hành vi `printMediaSchema` + `printerDriverSchema` sẵn có.

- [ ] **Step 1: Viết test đỏ**

Thêm vào `printerFormSchema.test.ts` (import `makePrinter`, `makeTsplDriverEntry`, `makeEscPosDriverEntry` từ `../../testing/printerFixtures`; `PrinterService` không cần):

```ts
describe('printMediaSchema (qua printerSchema)', () => {
  const withTsplMedia = (media: unknown) =>
    printerSchema.safeParse(makePrinter({
      drivers: [{ ...makeTsplDriverEntry(), config: { type: 'tspl', renderMode: 'bitmap', media } as never }],
    }));

  it('continuous chỉ cần type + paperSize', () => {
    expect(withTsplMedia({ type: 'continuous', paperSize: 80 }).success).toBe(true);
  });

  it('paperSize 100 hợp lệ', () => {
    expect(withTsplMedia({ type: 'continuous', paperSize: 100 }).success).toBe(true);
  });

  it('die_cut thiếu columns/itemWidthMm/... → fail', () => {
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100 }).success).toBe(false);
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2 }).success).toBe(false); // thiếu verticalGapMm
  });

  it('die_cut đủ field → pass', () => {
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3 }).success).toBe(true);
  });

  it('die_cut + cutterMode != none → fail', () => {
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3, cutterMode: 'per_job' }).success).toBe(false);
  });

  it('columns < 1 → fail', () => {
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 0, horizontalGapMm: 2, verticalGapMm: 3 }).success).toBe(false);
  });
});

describe('ESC/POS media phải continuous', () => {
  it('escpos + media.type die_cut → fail', () => {
    const p = makePrinter({
      drivers: [{ ...makeEscPosDriverEntry(), config: { type: 'escpos', media: { type: 'die_cut', paperSize: 80, itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 2 } } as never }],
    });
    expect(printerSchema.safeParse(p).success).toBe(false);
  });

  it('escpos + media.type continuous → pass', () => {
    expect(printerSchema.safeParse(makePrinter({ drivers: [makeEscPosDriverEntry()] })).success).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy — xác nhận đỏ**

Run: `npx jest src/features/printer/schemas`
Expected: FAIL — die_cut thiếu field vẫn `success: true`, escpos die_cut vẫn `success: true` (schema Task 1 còn permissive).

- [ ] **Step 3: Siết `printMediaSchema` + `printerDriverSchema`**

`printMediaSchema` — bọc `.superRefine`:
```ts
const DIE_CUT_REQUIRED = ['itemWidthMm', 'itemHeightMm', 'columns', 'horizontalGapMm', 'verticalGapMm'] as const;

const printMediaSchema = z
  .object({
    type: z.enum([PrintMediaType.continuous, PrintMediaType.dieCut]),
    paperSize: paperSizeSchema,
    itemWidthMm: z.number().positive().optional(),
    itemHeightMm: z.number().positive().optional(),
    columns: z.number().int().min(1).optional(),
    horizontalGapMm: z.number().min(0).optional(),
    verticalGapMm: z.number().min(0).optional(),
    cutterMode: z.enum([CutterMode.none, CutterMode.perJob, CutterMode.perRow]).optional(),
  })
  .superRefine((m, ctx) => {
    if (m.type !== PrintMediaType.dieCut) return;
    for (const f of DIE_CUT_REQUIRED) {
      if (m[f] === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [f], message: `Giấy die-cut cần ${f}` });
    }
    if (m.cutterMode && m.cutterMode !== CutterMode.none) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cutterMode'], message: 'Giấy die-cut không cắt được (răng cưa tự tách)' });
    }
  });
```

> `z.discriminatedUnion('type', [tsplDriverConfigSchema, escPosDriverConfigSchema])` vẫn OK: `printMediaSchema` là `ZodEffects` nhưng chỉ nằm ở **field** `media`, không phải member của union — zod 3.25 chỉ cấm member union là non-object, không cấm field.

`printerDriverSchema.superRefine` — thêm nhánh cuối:
```ts
if (driver.config.type === PrinterDriverType.escpos && driver.config.media.type !== PrintMediaType.continuous) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['config', 'media', 'type'], message: 'ESC/POS chỉ in giấy cuộn liên tục' });
}
```

- [ ] **Step 4: Chạy — xanh**

Run: `npx jest src/features/printer/schemas`
Expected: PASS toàn bộ.
Run: `npm run type-check` → sạch. `npx jest` → toàn bộ xanh. `npm run lint` → 0 error.

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/schemas/printerFormSchema.ts src/features/printer/schemas/__tests__/printerFormSchema.test.ts
git commit -m "$(cat <<'EOF'
feat: validation chặt cho PrintMedia (die-cut bắt buộc field, ESC/POS chỉ continuous)

- printMediaSchema.superRefine: die_cut cần itemWidthMm/itemHeightMm/columns/
  horizontalGapMm/verticalGapMm; cutterMode phải 'none' khi die_cut
- printerDriverSchema: ESC/POS media.type phải 'continuous'

Spec: docs/superpowers/specs/2026-08-30-print-media-domain-design.md §5

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**

| Spec § | Task |
|--------|------|
| §2 Data Model (types) | T1 Step 3 |
| §2 `PaperSize` +100/104 | T1 Step 3, 5 |
| §3 media per driver config, capabilities per Printer, bỏ paperSize/labelHeightMm | T1 Step 3 |
| §4.1 defaults | T1 Step 4 |
| §4.2 `mediaOf`/`paperSizeOf` | T1 Step 3 |
| §4.3 cutover ~12 chỗ | T1 Step 6, 7 |
| §4.4 buildDraftPrinter mặc định cứng | T1 Step 7, 11 (useAddPrinterFlow.test) |
| §4.5 PAPER_* maps + TsplEncoder width | T1 Step 5 |
| §5 Zod schema (structural) | T1 Step 8 |
| §5 Zod schema (die_cut refine, ESC/POS continuous) | T2 |
| §5 không validate chéo cutterMode↔capabilities | T2 Step 3 (không thêm check chéo — đúng ý spec) |
| §6 storage bump 3→4 | T1 Step 9 |
| §7 testing | T1 Step 1/4/11, T2 Step 1 |
| §8 rủi ro (PAPER_* đoán, PrinterListItem tạm) | T1 Step 5, 6 — comment tại chỗ |

Không có gap.

**2. Placeholder scan:** Không có "TBD"/"handle edge cases"/"similar to Task N". Mọi step có code cụ thể hoặc thao tác đếm được. "giá trị tạm cho 100/104" là quyết định spec đã chốt (§8), không phải placeholder.

**3. Type consistency:**
- `paperSizeOf(driver)` / `mediaOf(driver)` — tên nhất quán T1 Step 3 → dùng ở Step 6/7, T2.
- `PrintMediaType.continuous`/`.dieCut` = `'continuous'`/`'die_cut'` — nhất quán.
- `CutterMode.none/.perJob/.perRow` = `'none'`/`'per_job'`/`'per_row'` — nhất quán.
- Factory: `makePrinter`/`makeEscPosDriverEntry`/`makeTsplDriverEntry` + `DEFAULT_MEDIA` — định nghĩa T1 Step 10, dùng Step 11 + T2.
- `PRINTABLE_WIDTH_MM` (T1 Step 5) — chỉ nội bộ `TsplEncoder.ts`.
- Schema: `printMediaSchema` permissive ở T1 Step 8, cùng tên bọc `.superRefine` ở T2 Step 3 — cùng const, siết hành vi, không đổi tên.

---

## Execution Handoff

Sau khi lưu plan, chọn cách thực thi.
