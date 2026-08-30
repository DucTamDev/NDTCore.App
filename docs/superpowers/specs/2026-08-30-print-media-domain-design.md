# PrintMedia Domain — Design Specification (SP-A)

## 0. Bối cảnh — nỗ lực lớn hơn & cách tách

Hệ thống printer hiện model `PrinterDriverType` (ESC/POS, TSPL) và `PrintType`
(Receipt, Label) gần như độc lập, nhưng **ngầm giả định**:

- `PrintType.Label` → giấy die-cut (`TsplEncoder.initialize()` luôn emit `GAP 2mm`)
- `PrintType.Receipt` → giấy cuộn liên tục (`GAP 0,0`)
- Khổ giấy = `Printer.paperSize: 58 | 80` (1 con số, không phân biệt continuous/die-cut)
- Không có model dao cắt (cutter); `TsplEncoder.cut()` chỉ emit `PRINT 1,1`

Thực tế domain:

- **Cả Receipt lẫn Label** đều có thể in trên **continuous** hoặc **die-cut**.
- Die-cut có thể **nhiều cột** (vd sheet 3 cột, mỗi cột 1 con tem).
- **Cutter là thuộc tính phần cứng**, không phải hệ quả của loại giấy.

→ `PrintContentType`, `PrinterDriverType`, `PrintMedia` (loại giấy + layout) phải
là các **axis độc lập**, không map 1-1.

### Bốn sub-project

| SP | Nội dung | Phụ thuộc |
|----|----------|-----------|
| **A (spec này)** | Domain `PrintMedia` + `PrinterCapabilities` + schema + storage + cutover mọi chỗ đọc `printer.paperSize` | — |
| **B** | `TsplEncoder`/`TsplDriver` nhận trọn `PrintMedia`; render die-cut nhiều cột; cutter; `print()` nhận số hàng; bitmap dimensions theo `itemWidthMm` | A |
| **C** | UI cấu hình `PrintMedia`/`capabilities` trong màn Sửa máy in; `AddPrinterModal` (popup) → screen thật (không popup trên điện thoại) | A |
| **D** | Flow in tem từ POS: định nghĩa "loại tem" (label template), màn chọn loại tem + số hàng → in thật | B |

Thứ tự: **A → (B ∥ C) → D**. Mỗi SP có spec + plan riêng.

---

## 1. Phạm vi SP-A

**Trong phạm vi:**

1. Type mới: `PrintMedia`, `PrintMediaType`, `CutterMode`, `PrinterCapabilities`.
2. Mở rộng `PaperSize`: `58 | 80` → `58 | 80 | 100 | 104`.
3. Đặt `media: PrintMedia` vào **từng** `PrinterDriver.config` (`TsplDriverConfig` +
   `EscPosDriverConfig`); đặt `capabilities: PrinterCapabilities` vào `Printer`.
4. **Bỏ** `Printer.paperSize` và `TsplDriverConfig.labelHeightMm`.
5. Zod schema cho `PrintMedia` + `PrinterCapabilities`; ràng buộc die-cut; ràng
   buộc ESC/POS chỉ `continuous`.
6. `PRINTER_DRIVER_DEFINITIONS` mặc định `media` cho mỗi driver type.
7. Bump `PrinterStorage.CURRENT_STORAGE_VERSION` 3 → 4 (destructive reset, đúng
   convention hiện có — **không viết code migrate**).
8. Sửa mọi chỗ đọc `printer.paperSize` (~12) sang lấy từ `driver.config.media.paperSize`.
9. `buildDraftPrinter()` (trong `useAddPrinterFlow`) gắn `media`/`capabilities`
   **mặc định cứng** để app compile + chạy đúng như hiện tại.
10. Cập nhật test bị ảnh hưởng.

**Ngoài phạm vi SP-A (để SP-B/C/D):**

- `TsplEncoder` KHÔNG đổi chữ ký trong SP-A — vẫn nhận `paperSize` lẻ (trích từ
  `media.paperSize`). Render die-cut, `GAP` theo media, cutter, số hàng → **SP-B**.
- UI sửa `media`/`capabilities`, popup → screen → **SP-C**.
- Flow in tem POS, "loại tem" → **SP-D**.
- `PAPER_WIDTH_CHARS` / `PAPER_IMAGE_WIDTH_PX` cho 100/104: SP-A thêm entry với
  **giá trị tạm** + comment "cần verify phần cứng"; tinh chỉnh ở SP-B.

---

## 2. Data Model

`types/printer.types.ts`:

```ts
export type PaperSize = 58 | 80 | 100 | 104;

export const PrintMediaType = {
  /** Giấy cuộn liên tục — không có khe/răng cưa vật lý. */
  continuous: 'continuous',
  /** Giấy tem rời có khe (die-cut / pre-cut), có thể nhiều cột. */
  dieCut: 'die_cut',
} as const;
export type PrintMediaType = (typeof PrintMediaType)[keyof typeof PrintMediaType];

export const CutterMode = {
  /** Không cắt. Bắt buộc với die_cut (răng cưa tự tách). */
  none: 'none',
  /** Cắt 1 lần sau khi in xong cả job. */
  perJob: 'per_job',
  /** Cắt sau mỗi hàng in (chỉ có nghĩa với continuous + nhiều bản in liên tiếp). */
  perRow: 'per_row',
} as const;
export type CutterMode = (typeof CutterMode)[keyof typeof CutterMode];

export interface PrintMedia {
  type: PrintMediaType;
  /** Khổ đầu in / bề rộng cuộn. Luôn có, kể cả die_cut. */
  paperSize: PaperSize;

  /**
   * Chỉ die_cut. Kích thước 1 con tem. Schema bắt buộc khi `type === 'die_cut'`,
   * bỏ qua khi continuous.
   */
  itemWidthMm?: number;
  itemHeightMm?: number;
  /** Số cột die-cut trên 1 hàng. `>= 1`. Bắt buộc khi die_cut. */
  columns?: number;
  /** Khoảng cách ngang giữa 2 cột (mm). Bắt buộc khi die_cut (có thể 0). */
  horizontalGapMm?: number;
  /** Khoảng cách dọc giữa 2 hàng (mm) — tương ứng `GAP` của TSPL. Bắt buộc khi die_cut. */
  verticalGapMm?: number;

  /**
   * Chế độ cắt. Chỉ áp dụng khi `type === 'continuous'` VÀ
   * `Printer.capabilities.cutter === true`. Với die_cut schema ép `'none'`.
   * `undefined` ⇒ coi như `'none'`.
   */
  cutterMode?: CutterMode;
}

export interface PrinterCapabilities {
  /** Máy in có dao cắt (phần cứng). */
  cutter: boolean;
}
```

**Quyết định đã chốt:**

- `paperSize` **nằm trong** `PrintMedia`, không còn ở `Printer` (user: "vẫn giữ
  papersize nhưng thuộc option PrintMedia").
- `PaperSize` mở rộng `100 | 104` cho máy tem 4-inch (die-cut nhiều cột thường
  rộng hơn 58/80).
- `cutterMode` là **enum** (không phải boolean) — user chốt.
- `PrintMedia` **tách biệt theo driver** (không phải 1 cái/`Printer`) — user:
  "cần support tách biệt". Cho phép khai báo song song `(TSPL, die_cut)` và
  `(ESC/POS, continuous)` trên cùng 1 `Printer`.

---

## 3. Đặt vào đâu

```ts
export interface TsplDriverConfig {
  type: 'tspl';
  media: PrintMedia;                 // THÊM (bắt buộc)
  renderMode: TsplRenderMode;
  font?: TsplFontConfig;
  internalFont?: TsplInternalFontConfig;
  // BỎ: labelHeightMm — thông tin này giờ là media.itemHeightMm
}

export interface EscPosDriverConfig {
  type: 'escpos';
  media: PrintMedia;                 // THÊM (bắt buộc; schema ép type='continuous')
}

export interface Printer {
  id: string;
  name: string;
  vendor?: string;
  model?: string;
  drivers: PrinterDriver[];
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
  identityKey: string;
  // BỎ: paperSize
  capabilities: PrinterCapabilities; // THÊM (bắt buộc)
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- `PrintMedia` per driver: đúng "axis độc lập" — matrix `TSPL×{Receipt,Label}×{continuous,die_cut}`
  không bị cấm ở tầng cấu trúc.
- `capabilities` (dao cắt = phần cứng) ở `Printer` — 1 máy in vật lý = 1 bộ
  capability, không phụ thuộc protocol.
- Ô matrix `TSPL + Receipt + die_cut` vẫn hợp lệ về cấu trúc (không bị schema
  cấm) — chỉ là cấu hình hiếm dùng.

---

## 4. Defaults & Resolution

### 4.1 `PRINTER_DRIVER_DEFINITIONS` (`definitions/PrinterDriverDefinitions.ts`)

```ts
const DEFAULT_MEDIA: PrintMedia = { type: 'continuous', paperSize: 80 };

escpos: { contentTypes: [Receipt], defaultConfig: { type: 'escpos', media: { ...DEFAULT_MEDIA } } }
tspl:   { contentTypes: [Receipt, Label], defaultConfig: { type: 'tspl', renderMode: 'bitmap', media: { ...DEFAULT_MEDIA } } }
```

### 4.2 Resolution helper (`types/printer.types.ts` — cạnh `tsplRenderModeOf`)

```ts
/** `PrintMedia` của 1 driver entry. Trivial hôm nay (media nằm thẳng trên config),
 *  nhưng đóng gói để SP-B/C không phải lặp lại narrow `config.type`. */
export const mediaOf = (driver: PrinterDriver): PrintMedia => driver.config.media;

/** Khổ giấy hiệu dụng của 1 driver entry — thay `printer.paperSize` cũ. */
export const paperSizeOf = (driver: PrinterDriver): PaperSize => driver.config.media.paperSize;
```

### 4.3 Các chỗ đọc `printer.paperSize` hiện tại → cutover

| File | Hôm nay | SP-A |
|------|---------|------|
| `drivers/escpos/EscPosDriver.ts:130` | `buildEscPosText(printer.paperSize, ...)` | `buildEscPosText(paperSizeOf(context.driver), ...)` |
| `drivers/tspl/strategies/TsplBitmapStrategy.ts` | `PAPER_IMAGE_WIDTH_PX[printer.paperSize]`, `initialize(printer.paperSize, ...)` | `paperSizeOf(context.driver)` |
| `drivers/tspl/strategies/TsplTrueTypeStrategy.ts` | `PAPER_WIDTH_CHARS[printer.paperSize]`, `initialize(printer.paperSize, ...)` | `paperSizeOf(context.driver)` |
| `drivers/tspl/strategies/TsplInternalFontStrategy.ts` | idem | idem |
| `printing/PrintService.ts:31` `imageDocumentPaperSize` | `target.printer.paperSize` | `paperSizeOf(target.driver)` |
| `hooks/useAddPrinterFlow.ts` | form field `paperSize`, `buildDraftPrinter`, `captureBillImage(document, printer.paperSize)` | form field vẫn tên `paperSize` nhưng feed vào `media.paperSize` của **mỗi** driver entry khi build draft; `captureBillImage(document, paperSizeOf(driver))` |
| `hooks/useBillImageCapture.tsx` | `PAPER_IMAGE_WIDTH_PX[paperSize]` | không đổi (vẫn nhận `paperSize: PaperSize`) |
| `components/PrinterListItem.tsx:38` | `Khổ ${printer.paperSize}mm` | `Khổ ${printer.drivers[0]?.config.media.paperSize ?? '?'}mm` (SP-C sẽ làm hiển thị tốt hơn) |
| `discovery/PrinterDiscoveryService.ts` | comment | cập nhật comment |
| `cart/services/OrderPrintTrigger.ts` | qua `PrintService.imageDocumentPaperSize` | trong suốt (không đụng) |

### 4.4 `buildDraftPrinter()` (SP-A: mặc định cứng)

- Mỗi driver entry được thêm (`addDriverEntry`) đã lấy `defaultConfig` từ
  `PRINTER_DRIVER_DEFINITIONS` → đã có `media` mặc định. Nhưng form hiện có field
  `paperSize` (58/80) do user chọn → SP-A: khi build draft, ghi
  `config.media.paperSize = form.paperSize` cho **mọi** driver entry (giữ hành vi
  "1 khổ giấy cho cả máy" như hôm nay).
- `capabilities: { cutter: false }` cứng trong `buildDraftPrinter`.
- SP-C thay 2 chỗ này bằng UI thật.

### 4.5 `PAPER_WIDTH_CHARS` / `PAPER_IMAGE_WIDTH_PX` (`utils/paperWidth.ts`)

Thêm entry cho `100`, `104` (giá trị tạm, comment "cần verify phần cứng ở SP-B"):

```ts
PAPER_WIDTH_CHARS:  { 58: 32, 80: 48, 100: 64, 104: 69 }
PAPER_IMAGE_WIDTH_PX: { 58: 384, 80: 576, 100: 768, 104: 832 }  // 8 dot/mm ~ printable width
```

`TsplEncoder.initialize()` `widthMm = paperSize === 58 ? 50 : 72` → bảng:
`{ 58: 50, 80: 72, 100: 96, 104: 104 }` (vẫn trong SP-A vì `initialize` không đổi
chữ ký, chỉ sửa công thức width để không vỡ với size mới).

---

## 5. Zod Schema (`schemas/printerFormSchema.ts`)

```ts
const paperSizeSchema = z.union([z.literal(58), z.literal(80), z.literal(100), z.literal(104)]);

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
    if (m.type === PrintMediaType.dieCut) {
      for (const f of ['itemWidthMm', 'itemHeightMm', 'columns', 'horizontalGapMm', 'verticalGapMm'] as const) {
        if (m[f] === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [f], message: `die_cut cần ${f}` });
      }
      if (m.cutterMode && m.cutterMode !== CutterMode.none) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cutterMode'], message: 'die_cut không cắt được (răng cưa tự tách)' });
      }
    }
  });

const printerCapabilitiesSchema = z.object({ cutter: z.boolean() });

// tsplDriverConfigSchema: + media: printMediaSchema; BỎ labelHeightMm
// escPosDriverConfigSchema:
const escPosDriverConfigSchema = z.object({
  type: z.literal(PrinterDriverType.escpos),
  media: printMediaSchema.refine((m) => m.type === PrintMediaType.continuous, 'ESC/POS chỉ in giấy cuộn liên tục'),
});

// printerSchema: + capabilities: printerCapabilitiesSchema; BỎ paperSize
```

`PrinterService` (`addPrinter`/`updatePrinter`) đã gọi `printerSchema.parse()` —
tự động enforce, không cần code thêm.

**Không validate cross-field `media.cutterMode` ↔ `Printer.capabilities.cutter`**
ở SP-A: `cutterMode` nằm trong `PrinterDriver.config`, `capabilities` nằm ở
`Printer` — Zod refine chéo 2 nhánh này rườm rà và không đáng. `cutterMode`
được lưu như "ý định"; **SP-B** khi build lệnh mới bỏ qua cắt nếu
`!capabilities.cutter` (giống cách `renderMode: truetype` + chưa cài font là lỗi
in tường minh ở strategy, không phải validate lúc lưu). `cutterMode: 'per_row'`
trên continuous cũng được lưu bình thường ở SP-A — SP-B diễn giải.

---

## 6. Storage (`storage/PrinterStorage.ts`)

```ts
// v4: bỏ Printer.paperSize + TsplDriverConfig.labelHeightMm, thay bằng
//     PrinterDriver.config.media (PrintMedia) + Printer.capabilities.
//     Format Printer đổi không tương thích ngược → reset (không migrate).
const CURRENT_STORAGE_VERSION = 4;
```

Không thêm logic. `resetIfOutdated()` sẵn có xử lý.

---

## 7. Testing

| Test | Kiểm |
|------|------|
| `printerFormSchema.test.ts` | die_cut thiếu `columns`/`itemWidthMm`/... → parse fail; die_cut + `cutterMode !== 'none'` → fail; ESC/POS + `media.type='die_cut'` → fail; continuous hợp lệ → pass; `paperSize: 100` → pass; thiếu `capabilities` → fail |
| `PrinterService.test.ts` | `addPrinter` với `media`/`capabilities` hợp lệ → lưu; sai → throw; các test cũ cập nhật shape `Printer` (bỏ `paperSize`, thêm `media`+`capabilities`) |
| `PrinterStorage.test.ts` | version 3 → đọc `getPrinters()` trả `[]` (reset); ghi version 4 |
| `PrinterDriverDefinitions.test.ts` (nếu có) | `defaultConfig` mỗi driver có `media.type === 'continuous'`, `paperSize === 80` |
| `EscPosDriver.test.ts` / `Tspl*Strategy.test.ts` / `TsplEncoder.test.ts` | cập nhật fixture `Printer`/`PrinterDriver` sang shape mới; assert `buildEscPosText`/`initialize` nhận đúng `paperSize` từ `media` |
| `useAddPrinterFlow.test.tsx` | draft printer build ra có `media` (paperSize = form value) + `capabilities.cutter === false` |
| `paperWidth.test.ts` (nếu có) | `PAPER_WIDTH_CHARS`/`PAPER_IMAGE_WIDTH_PX` có key `100`, `104` |

Chạy: `npm run type-check` + `npx jest` + `npm run lint`.

---

## 8. Rủi ro / lưu ý

- **Đổi shape `Printer` = đụng nhiều fixture test.** Phần lớn mechanical; đếm
  trước để không sót (grep `paperSize:` trong `__tests__`).
- `PAPER_*` maps cho 100/104 là **giá trị đoán** — không có phần cứng verify ở
  SP-A. Đánh dấu rõ, để SP-B (có die-cut thật) chỉnh.
- `PrinterListItem` hiển thị `drivers[0]` khổ giấy — tạm chấp nhận, SP-C lo.
- Sau SP-A, app **chạy y hệt hôm nay** về mặt in (chưa có die-cut behavior) —
  đây là refactor thuần domain, không đổi output máy in.

---

## 9. Ngoài phạm vi (nhắc lại)

Render die-cut nhiều cột, `GAP` theo `verticalGapMm`, cutter emit lệnh, `print()`
nhận số hàng, bitmap width theo `itemWidthMm`, UI cấu hình media, popup → screen,
flow in tem POS, khái niệm "loại tem". → **SP-B, SP-C, SP-D**.
