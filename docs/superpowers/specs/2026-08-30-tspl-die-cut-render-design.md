# TSPL Die-Cut Render + Cutter (SP-B) — Design Specification

## 0. Bối cảnh

SP-B của nỗ lực `PrintMedia` (xem `2026-08-30-print-media-domain-design.md` §0 — 4 sub-project A→(B∥C)→D). SP-A đã có `PrintMedia` per `PrinterDriver.config` (`type: 'continuous' | 'die_cut'`, `paperSize`, `itemWidthMm/itemHeightMm`, `columns`, `horizontalGapMm/verticalGapMm`, `cutterMode`) + `PrinterCapabilities` per `Printer`, nhưng `TsplEncoder`/`TsplDriver` **chưa dùng** — vẫn render như trước (continuous only, `PRINT 1,1`, không lệnh cắt).

SP-B làm engine TSPL đọc trọn `PrintMedia`: render die-cut nhiều cột, phát lệnh cắt cho continuous, nhận số hàng. **SP-B KHÔNG đụng UI** (0 component thay đổi) — mọi UI (form cấu hình media, ô nhập số hàng, popup→screen) là **SP-C**. Vì vậy die-cut chỉ verify được bằng unit test trong SP-B; test die-cut trên thiết bị thật xảy ra sau SP-C.

**Điều kiện triển khai:** không có máy in die-cut / máy in TSPL có dao cắt để test. `SET CUTTER` và render multi-column theo cú pháp TSPL2 phổ biến — **chưa xác nhận trên phần cứng thật**, ghi rõ như `truetype`/`internalfont`.

---

## 1. Phạm vi SP-B

**Trong phạm vi:**

1. `PrintOptions { rows?: number }` + thêm param optional vào `IPrinterDriver.print` / `testPrint`.
2. `TsplDriver`: đọc `opts.rows` (default 1), truyền `media` + `rows` vào strategy context.
3. `TsplEncoder`: đổi `initialize(paperSize, printType, labelHeightMm, codepage)` → `initialize(media, printType, codepage)`; SIZE/GAP theo `media.type`; `cut(rows, effectiveCutterMode)` phát `SET CUTTER` + `PRINT rows,1`; helper `columnPitchDots`.
4. `TsplStrategyContext`: thêm `media: PrintMedia`, `rows: number`; bỏ `heightMm` (encoder tự tính từ media).
5. 3 strategy (`bitmap`/`truetype`/`internalfont`): die-cut → compose `columns` bản sao nội dung tại x-offset từng cột; continuous → như hôm nay.
6. `resolveEffectiveCutterMode(media)` — helper thuần.
7. `EscPosDriver`: `cut` flag gửi native tính per-call từ `resolveEffectiveCutterMode` (default `true` = **không đổi hành vi**), thay `ESC_POS_PRINT_OPTIONS` const `cut: true`.
8. Bitmap dimensions die-cut: `useBillImageCapture.captureBillImage(document, media)` (thay `paperSize`); `PrintService.imageDocumentPaperSize` → `imageDocumentMedia(printType): PrintMedia | null`; `OrderPrintTrigger` (cart) + `useAddPrinterFlow.resolveTestPrintDocuments` cập nhật.
9. Verify `PAPER_*` maps cho 100/104 — **không có hardware**, giữ số placeholder SP-A, ghi rõ.
10. Tests.

**Ngoài phạm vi (SP-C/SP-D):**

- Form cấu hình `PrintMedia` (type / dims / columns / gaps), ô nhập số hàng ở "In tem thử", `AddPrinterModal` popup→screen, xoá 2 chỗ hardcode ở `buildDraftPrinter` — **SP-C**.
- Thread `rows` qua `PrintService.print` → `PrintScheduler` → `driver.print` (đường in thật từ POS) — **SP-D**. SP-B chỉ wire `testPrint`; `TsplDriver.print` (đường routing) đọc `opts` nhưng caller chưa truyền → `rows` mặc định 1.
- `capabilities.cutter` — để **dormant**. SP-B KHÔNG đọc nó (quyết định: `cutterMode` là nguồn sự thật duy nhất cho việc cắt; `capabilities.cutter` chưa có UI, chưa có ý nghĩa runtime). SP-C cũng không làm UI cho nó.
- `cutterMode` — có trong `PrintMedia` (SP-A) nhưng SP-C **không** làm UI; giữ nguyên default (undefined → resolver coi là `per_job`).

---

## 2. Data Model

### 2.1 `PrintOptions` (`types/driver.types.ts`)

```ts
export interface PrintOptions {
  /** Số HÀNG die-cut cần in (mỗi hàng = `media.columns` con tem). Default 1. Bỏ qua nếu media continuous. */
  rows?: number;
}
```

`IPrinterDriver`:
```ts
print(printerId: string, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void>;
testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void>;
```

`EscPosDriver` implement 2 method này với `_options` không dùng (comment: "ESC/POS không có khái niệm hàng die-cut").

### 2.2 `resolveEffectiveCutterMode` (`drivers/tspl/cutter.ts` — file mới, hoặc `printer.types.ts`)

```ts
/**
 * Chế độ cắt THỰC THI, sau khi áp ràng buộc vật lý:
 * - die_cut: LUÔN 'none' — giấy die-cut tách bằng răng cưa, không cắt.
 * - continuous: `media.cutterMode ?? 'per_job'` — mặc định cắt cuối mỗi job
 *   (giữ hành vi ESC/POS hiện tại; chỉ 'none' tường minh mới tắt).
 */
export const resolveEffectiveCutterMode = (media: PrintMedia): CutterMode =>
  media.type === PrintMediaType.dieCut ? CutterMode.none : (media.cutterMode ?? CutterMode.perJob);
```

### 2.3 `TsplStrategyContext` (`drivers/tspl/strategies/tsplStrategy.types.ts`)

```ts
export interface TsplStrategyContext {
  printer: Printer;
  driver: PrinterDriver;           // config.type === 'tspl' đã narrow
  documents: PrintDocuments;
  printType: PrintType;
  media: PrintMedia;               // THÊM — = mediaOf(driver)
  rows: number;                    // THÊM — >= 1, từ PrintOptions
  // BỎ heightMm — TsplEncoder tự tính SIZE height từ media
}
```

---

## 3. `TsplEncoder` — media-aware

### 3.1 `initialize(media: PrintMedia, printType?: PrintType, codepage?: TsplCodepage): this`

Thay chữ ký `(paperSize, printType, labelHeightMm, codepage)`.

```
continuous:
  SIZE <PRINTABLE_WIDTH_MM[media.paperSize]> mm, <CONTINUOUS_HEIGHT_MM> mm   (Receipt)
  SIZE <PRINTABLE_WIDTH_MM[media.paperSize]> mm, <itemHeightMm ?? DEFAULT_LABEL_HEIGHT_MM> mm   (Label)
  GAP 0 mm, 0 mm

die_cut (bất kể printType):
  rowWidthMm = columns·itemWidthMm + (columns-1)·horizontalGapMm
  SIZE <rowWidthMm> mm, <itemHeightMm> mm
  GAP <verticalGapMm> mm, 0 mm
```

`CODEPAGE <codepage>` + `CLS` như hôm nay.

> Ghi chú: `DEFAULT_LABEL_HEIGHT_MM`/`CONTINUOUS_HEIGHT_MM` giữ nguyên nghĩa. `resolveHeightMm` ở `TsplDriver` (đọc `media.itemHeightMm`) **bị bỏ** — logic đó chuyển vào `initialize`. Clamp "nội dung cao quá khổ" ở `TsplBitmapStrategy` giờ so với `itemHeightMm·8` (die_cut) / `CONTINUOUS_HEIGHT_MM·8` (continuous).

### 3.2 `columnPitchDots(media: PrintMedia): number`

```ts
export const columnPitchDots = (media: PrintMedia): number =>
  ((media.itemWidthMm ?? 0) + (media.horizontalGapMm ?? 0)) * DOTS_PER_MM;
```
(Chỉ gọi khi `media.type === 'die_cut'` — lúc đó các field chắc chắn có, schema SP-A enforce.)

### 3.3 `cut(rows: number, mode: CutterMode): this`

```
mode === 'per_row':  SET CUTTER 1
mode === 'per_job':  SET CUTTER <rows>          // cắt sau khi in xong <rows> hàng
mode === 'none':     (không phát SET CUTTER)
--- luôn ---
PRINT <rows>,1
```

`SET CUTTER <n>` = "cắt sau mỗi n nhãn" theo TSPL2 phổ biến. **Chưa verify phần cứng.** Với continuous + `rows === 1` (đường Receipt bình thường), `per_job` → `SET CUTTER 1` → cắt sau mỗi hoá đơn.

### 3.4 `text()` / `image()` — không đổi chữ ký

Strategy tự cộng x-offset trước khi gọi (xem §4). `codepage` vẫn set ở `initialize`.

---

## 4. Strategies

`TsplDriver.buildBytes` tạo context với `media = mediaOf(driver)`, `rows = Math.max(1, Math.floor(options?.rows ?? 1))`.

### 4.1 Chung — composition helper

Mỗi strategy hiện lặp `for element of documents.text.elements`. Bọc thêm 1 vòng cột:

```ts
const cols = media.type === PrintMediaType.dieCut ? (media.columns ?? 1) : 1;
const pitch = media.type === PrintMediaType.dieCut ? columnPitchDots(media) : 0;
for (let col = 0; col < cols; col += 1) {
  const dx = col * pitch;
  for (const element of documents.text.elements) {
    // encoder.text(element.x + dx, element.y, ...)   (bitmap: encoder.image(dx, 0, bitmap))
  }
}
encoder.cut(rows, resolveEffectiveCutterMode(media));
```

- `continuous` → `cols = 1`, `dx = 0`. `rows` vẫn truyền vào `cut` → `PRINT <rows>,1` = in `rows` BẢN SAO của nội dung (giấy cuộn không có khái niệm "hàng"; `rows > 1` = nhiều bản). Đường Receipt bình thường (`PrintService.print` → scheduler) luôn `rows=1` ở SP-B (chưa thread) → `PRINT 1,1`, hành vi **giống hôm nay** trừ lệnh `SET CUTTER` mới.
- Element `barcode`/`qrCode` cũng cộng `dx`.

### 4.2 `TsplBitmapStrategy`

- decode ảnh 1 lần ở width = `media.type === 'die_cut' ? itemWidthMm·8 : PAPER_IMAGE_WIDTH_PX[paperSize]` (width này do `captureBillImage` render, xem §5 — strategy chỉ cần truyền đúng `targetWidthPx` cho `decodePngBase64ToMonochrome`).
- clamp height: `> (die_cut ? itemHeightMm·8 : CONTINUOUS_HEIGHT_MM·8)` → `TSPL_IMAGE_TOO_LARGE`.
- `for col` → `encoder.image(col·pitch, 0, bitmap)` (cùng 1 bitmap, N vị trí).
- `.cut(rows, mode)`.

### 4.3 `TsplTrueTypeStrategy` / `TsplInternalFontStrategy`

- Vòng `for col` bọc vòng element hiện có; `element.x + dx`.
- `internalfont`: `initialize(media, printType, codepage)`.
- `truetype`: `initialize(media, printType)`.

---

## 5. Bitmap dimensions (die-cut)

### 5.1 `useBillImageCapture` (`hooks/useBillImageCapture.tsx`)

```ts
captureBillImage: (document: PrintDocument, media: PrintMedia) => Promise<string | null>;
```
`widthPx = media.type === 'die_cut' ? (media.itemWidthMm ?? 0) * DOTS_PER_MM : PAPER_IMAGE_WIDTH_PX[media.paperSize]`
(import `DOTS_PER_MM` từ `TsplEncoder`, hoặc định nghĩa `DOTS_PER_MM = 8` ở `paperWidth.ts` và cả 2 nơi import — tránh vòng phụ thuộc `useBillImageCapture` → `TsplEncoder`. **Quyết định:** chuyển `DOTS_PER_MM` sang `utils/paperWidth.ts`, `TsplEncoder` re-export để không vỡ import cũ.)

### 5.2 `PrintService` (`printing/PrintService.ts`)

```ts
// Thay imageDocumentPaperSize
const imageDocumentMedia = (printType: PrintType): PrintMedia | null => {
  const target = deps.routing.resolveTargets(printType).find(
    (t) => t.driver.type === PrinterDriverType.tspl && tsplRenderModeOf(t.driver) === TsplRenderMode.bitmap,
  );
  return target ? mediaOf(target.driver) : null;
};
```
Export đổi `imageDocumentPaperSize` → `imageDocumentMedia`.

### 5.3 `OrderPrintTrigger` (`features/cart/services/OrderPrintTrigger.ts`)

- `CaptureBillImage` type: `(document: PrintDocument, media: PrintMedia) => Promise<string | null>`.
- `buildPrintDocumentVariants`: `const media = PrintService.imageDocumentMedia(printType); if (!media) return {text}; const base64 = await captureBillImage(textDocument, media);`
- Test file cập nhật fixture + type.

### 5.4 `useAddPrinterFlow.resolveTestPrintDocuments`

`captureBillImage(document, mediaOf(driver))` thay `paperSizeOf(driver)`.

---

## 6. `EscPosDriver` cut

`ESC_POS_PRINT_OPTIONS` bỏ `cut: true` khỏi const:
```ts
const ESC_POS_BASE_OPTIONS = { keepConnection: true, tailingLine: true, encoding: 'UTF8' } as const;
```
`sendDocuments`:
```ts
private async sendDocuments(adapter: NativeAdapter, driver: PrinterDriver, documents: PrintDocuments): Promise<void> {
  const cut = resolveEffectiveCutterMode(mediaOf(driver)) !== CutterMode.none;
  const text = buildEscPosText(paperSizeOf(driver), documents);
  await adapter.printText(text, { ...ESC_POS_BASE_OPTIONS, cut });
}
```
`mediaOf(driver)` với ESC/POS luôn `type: 'continuous'` (schema SP-A enforce) → `cut = (cutterMode ?? 'per_job') !== 'none'` → default `true` → **không đổi hành vi**. Chỉ đổi nếu ai đó set `cutterMode: 'none'` (chưa có UI).

---

## 7. Rủi ro / lưu ý

- **`SET CUTTER` chưa verify.** Clone firmware có thể treo/error khi nhận lệnh này mà không có dao. Giảm thiểu: `resolveEffectiveCutterMode` → `per_job` là default, nghĩa là **mọi máy TSPL continuous sẽ nhận `SET CUTTER 1`** sau SP-B. Đây là hành vi MỚI cho TSPL (hôm nay không phát lệnh cắt nào). Người dùng chốt "cứ gửi theo default" (2026-08-30). Kill-switch duy nhất hiện tại: set `cutterMode: 'none'` trong storage (chưa có UI). Ghi log rõ + doc comment.
- **die-cut multi-column chưa verify.** `SIZE` = cả hàng, `PRINT rows,1` giả định firmware in hết 1 hàng ngang rồi feed `itemHeightMm + verticalGapMm`. Đúng với TSPL2 chuẩn; clone có thể khác.
- **`PAPER_*` 100/104 vẫn là số đoán** — SP-B không có hardware để sửa. Ghi lại (không phải finding).
- **`TsplStrategyContext` bỏ `heightMm`** đụng cả 3 strategy + test — mechanical.
- Sau SP-B: continuous in **giống hôm nay** trừ (a) TSPL giờ phát `SET CUTTER 1`, (b) ESC/POS `cut` tính qua resolver (cùng kết quả `true`). die-cut render được nhưng **chưa test thiết bị** (cần SP-C làm UI cấu hình).

---

## 8. Testing

| Test | Kiểm |
|------|------|
| `TsplEncoder.test.ts` | `initialize(continuousMedia, Receipt)` → `SIZE <w>, 200` + `GAP 0,0`; `initialize(dieCutMedia)` → `SIZE <cols·itemW+gaps>, <itemH>` + `GAP <vGap>,0`; `cut(3,'per_job')` → `SET CUTTER 3\r\nPRINT 3,1`; `cut(2,'per_row')` → `SET CUTTER 1\r\nPRINT 2,1`; `cut(1,'none')` → chỉ `PRINT 1,1`, KHÔNG `SET CUTTER`; `columnPitchDots({itemWidthMm:30,horizontalGapMm:2})` → `256` |
| `cutter.test.ts` (mới) | `resolveEffectiveCutterMode`: die_cut→none bất kể `cutterMode`; continuous + undefined→per_job; continuous + 'none'→none; continuous + 'per_row'→per_row |
| `TsplBitmapStrategy.test.ts` | die_cut 3 cột → 3 lệnh `BITMAP` tại x = 0, pitch, 2·pitch; `PRINT rows,1`; clamp height so `itemHeightMm·8`; continuous → 1 `BITMAP` tại 0 (như cũ) |
| `TsplTrueTypeStrategy.test.ts` / `TsplInternalFontStrategy.test.ts` | die_cut 2 cột → mỗi element xuất hiện 2 lần, lần 2 x = `element.x + pitch`; continuous → 1 lần (như cũ) |
| `TsplDriver.test.ts` | `testPrint(..., { rows: 4 })` → bytes chứa `PRINT 4,1`; không truyền opts → `PRINT 1,1`; context có `media` + `rows` |
| `EscPosDriver.test.ts` | `sendDocuments` gọi `printText` với `cut: true` khi `cutterMode` undefined; `cut: false` khi media `cutterMode: 'none'` |
| `PrintService.test.ts` | `imageDocumentMedia` trả `media` của target TSPL bitmap; `null` nếu không có |
| `OrderPrintTrigger.test.ts` | `buildPrintDocumentVariants` gọi `captureBillImage(doc, media)` với media từ `imageDocumentMedia` |
| `useAddPrinterFlow.test.tsx` | `resolveTestPrintDocuments` gọi `captureBillImage` với `mediaOf(driver)` (die_cut → media có columns) |

Chạy: `npm run type-check` + `npx jest` + `npm run lint`.

---

## 9. File đụng (~17)

`types/driver.types.ts`, `drivers/tspl/cutter.ts` (mới), `drivers/tspl/TsplEncoder.ts`, `drivers/tspl/TsplDriver.ts`, `drivers/tspl/strategies/tsplStrategy.types.ts` + 3 strategy, `drivers/escpos/EscPosDriver.ts`, `printing/PrintService.ts`, `hooks/useBillImageCapture.tsx`, `hooks/useAddPrinterFlow.ts` (chỉ `resolveTestPrintDocuments` + `runTestPrint` truyền opts rỗng), `utils/paperWidth.ts` (`DOTS_PER_MM`), `features/cart/services/OrderPrintTrigger.ts` + test, + 9 test file.
