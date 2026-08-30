# TSPL Die-Cut Render + Cutter (SP-B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho engine TSPL đọc trọn `PrintMedia` — render die-cut nhiều cột, phát lệnh cắt cho giấy cuộn, nhận số hàng — không đụng UI.

**Architecture:** `TsplEncoder.initialize()` nhận `PrintMedia` thay `paperSize` lẻ, tự tính `SIZE`/`GAP` theo `continuous`/`die_cut`. 3 strategy bọc vòng lặp cột quanh vòng lặp element hiện có (offset x theo `columnOffsets(media)`). `cut(rows, mode)` phát `SET CUTTER` + `PRINT rows,1`. `resolveEffectiveCutterMode` ép die_cut = `none`, continuous mặc định `per_job`. ESC/POS tính `cut` flag qua cùng resolver (kết quả default không đổi). Bitmap capture + `imageDocumentMedia` thành media-aware.

**Tech Stack:** React Native 0.86, TypeScript strict, Jest (babel-jest — type errors KHÔNG chặn test chạy; `npm run type-check` riêng).

**Spec:** `docs/superpowers/specs/2026-08-30-tspl-die-cut-render-design.md`

## Global Constraints

- Text hiển thị người dùng: **tiếng Việt**. TypeScript strict, **không `any`**.
- Không comment giải thích WHAT — chỉ WHY khi không rõ.
- Test file trong `__tests__/`, đuôi `.test.ts(x)`. Component UI thuần **không** test riêng.
- Commit `<type>: <mô tả ngắn>` kết bằng `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Trước commit: `npm run type-check` sạch + `npx jest` xanh + `npm run lint` 0 error (2 warning cũ ở `BluetoothTransport.test.ts`/`LanTransport.test.ts` chấp nhận).
- Branch `fix/printer-post-merge` (đã ở sẵn). KHÔNG tạo branch mới.
- **Hành vi in continuous phải giống hôm nay**, TRỪ 3 điểm spec-sanctioned: (a) TSPL giờ phát `SET CUTTER <n>` trước `PRINT` (mới — spec §7, người dùng chốt "cứ gửi theo default"), (b) ESC/POS `cut` flag tính qua resolver nhưng ra cùng `true`, (c) TSPL **continuous + `PrintType.Label`** giờ dùng `GAP 0,0` thay `GAP 2mm` — giấy cuộn liên tục không có khe (spec §3.1); trước SP-A `GAP 2mm` gán cứng cho mọi Label là giả định sai.
- `CutterMode` values verbatim: `'none'`, `'per_job'`, `'per_row'`. `PrintMediaType`: `'continuous'`, `'die_cut'`.
- `DOTS_PER_MM = 8`. `SET CUTTER <n>` nghĩa "cắt sau mỗi n nhãn" (TSPL2 phổ biến, **chưa verify phần cứng**).
- SP-B **KHÔNG** đọc `Printer.capabilities.cutter` (dormant — `cutterMode` là nguồn sự thật duy nhất).
- SP-B **KHÔNG** đụng file UI (`components/*`, `PrinterInfoCard`, `AddPrinterModal`). `useAddPrinterFlow` chỉ đụng `resolveTestPrintDocuments`.

---

## File Structure

**Tạo mới:**

| File | Trách nhiệm |
|------|-------------|
| `src/features/printer/drivers/tspl/cutter.ts` | `resolveEffectiveCutterMode(media): CutterMode` — thuần, dùng bởi cả `TsplEncoder`-caller (strategy) lẫn `EscPosDriver` |
| `src/features/printer/drivers/tspl/__tests__/cutter.test.ts` | test cho trên |

**Sửa:**

| File | Thay đổi |
|------|----------|
| `src/features/printer/types/driver.types.ts` | + `PrintOptions { rows? }`; `IPrinterDriver.print`/`testPrint` + param `options?: PrintOptions` |
| `src/features/printer/utils/paperWidth.ts` | + `export const DOTS_PER_MM = 8` |
| `src/features/printer/drivers/tspl/TsplEncoder.ts` | `DOTS_PER_MM` re-export từ paperWidth; `initialize(media, printType?, codepage?)`; `cut(rows, mode)`; + `resolveSizeHeightMm`, `columnPitchDots`, `columnOffsets` |
| `src/features/printer/drivers/tspl/strategies/tsplStrategy.types.ts` | context + `media: PrintMedia`, `rows: number`; − `heightMm` |
| `src/features/printer/drivers/tspl/TsplDriver.ts` | − `resolveHeightMm`; `buildBytes(..., rows)`; context có `media`/`rows`; `print`/`testPrint` đọc `options?.rows` |
| `src/features/printer/drivers/tspl/strategies/TsplBitmapStrategy.ts` | `initialize(media,...)`; clamp vs `resolveSizeHeightMm`; decode width media-aware; tile theo `columnOffsets` |
| `src/features/printer/drivers/tspl/strategies/TsplTrueTypeStrategy.ts` | `initialize(media,...)`; `cut(rows,mode)`; vòng cột |
| `src/features/printer/drivers/tspl/strategies/TsplInternalFontStrategy.ts` | như trên + `codepage` |
| `src/features/printer/drivers/escpos/EscPosDriver.ts` | `print`/`testPrint` + `_options?`; `sendDocuments` tính `cut` qua resolver |
| `src/features/printer/printing/PrintService.ts` | `imageDocumentPaperSize` → `imageDocumentMedia(printType): PrintMedia \| null` |
| `src/features/printer/hooks/useBillImageCapture.tsx` | `captureBillImage(document, media: PrintMedia)`; widthPx theo media |
| `src/features/printer/hooks/useAddPrinterFlow.ts` | `resolveTestPrintDocuments` → `captureBillImage(document, mediaOf(driver))` |
| `src/features/cart/services/OrderPrintTrigger.ts` | `CaptureBillImage` type; `buildPrintDocumentVariants` dùng `imageDocumentMedia` |
| **test**: `TsplEncoder.test.ts`, `TsplBitmapStrategy.test.ts`, `TsplTrueTypeStrategy.test.ts`, `TsplInternalFontStrategy.test.ts`, `TsplDriver.test.ts`, `EscPosDriver.test.ts`, `PrintService.test.ts`, `OrderPrintTrigger.test.ts`, `useAddPrinterFlow.test.tsx` | cập nhật signature + case mới |

**Ruling (đã quyết, khác spec §5.1):** spec đề xuất chuyển `DOTS_PER_MM` sang `paperWidth.ts` để tránh vòng phụ thuộc `useBillImageCapture → TsplEncoder`. Kiểm tra: `TsplEncoder` KHÔNG import gì dẫn ngược về `useBillImageCapture` → **không có cycle**. Vẫn chuyển `DOTS_PER_MM` sang `paperWidth.ts` (util nhỏ, đã được cả `TsplBitmapStrategy` lẫn `useBillImageCapture` import) + `TsplEncoder` re-export — vì nó gọn hơn và `paperWidth.ts` là chỗ đúng cho hằng số khổ giấy. Chi phí nếu sai: 1 dòng re-export thừa.

---

## Task 1: `PrintOptions` + `resolveEffectiveCutterMode` + ESC/POS cut

**Files:**
- Modify: `src/features/printer/types/driver.types.ts`
- Create: `src/features/printer/drivers/tspl/cutter.ts`, `src/features/printer/drivers/tspl/__tests__/cutter.test.ts`
- Modify: `src/features/printer/drivers/escpos/EscPosDriver.ts`, `src/features/printer/drivers/tspl/TsplDriver.ts`
- Test: `src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts`

**Interfaces:**
- Consumes (SP-A): `PrintMedia`, `PrintMediaType`, `CutterMode`, `mediaOf`, `paperSizeOf` từ `types/printer.types`.
- Produces:
  ```ts
  // types/driver.types.ts
  export interface PrintOptions { rows?: number }
  // IPrinterDriver.print(printerId, documents, printType, options?: PrintOptions): Promise<void>
  // IPrinterDriver.testPrint(printer, driver, documents, printType, options?: PrintOptions): Promise<void>

  // drivers/tspl/cutter.ts
  export const resolveEffectiveCutterMode: (media: PrintMedia) => CutterMode;
  ```

- [ ] **Step 1: Viết test cho `resolveEffectiveCutterMode`**

Create `src/features/printer/drivers/tspl/__tests__/cutter.test.ts`:
```ts
import { resolveEffectiveCutterMode } from '../cutter';
import { CutterMode, PrintMediaType } from '../../../types/printer.types';
import type { PrintMedia } from '../../../types/printer.types';

const dieCut = (cutterMode?: CutterMode): PrintMedia => ({
  type: PrintMediaType.dieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3, cutterMode,
});
const continuous = (cutterMode?: CutterMode): PrintMedia => ({ type: PrintMediaType.continuous, paperSize: 80, cutterMode });

describe('resolveEffectiveCutterMode', () => {
  it('die_cut → luôn none, bất kể cutterMode', () => {
    expect(resolveEffectiveCutterMode(dieCut(undefined))).toBe(CutterMode.none);
    expect(resolveEffectiveCutterMode(dieCut(CutterMode.perJob))).toBe(CutterMode.none);
  });
  it('continuous + cutterMode undefined → per_job (mặc định "cứ cắt")', () => {
    expect(resolveEffectiveCutterMode(continuous(undefined))).toBe(CutterMode.perJob);
  });
  it('continuous + none → none', () => {
    expect(resolveEffectiveCutterMode(continuous(CutterMode.none))).toBe(CutterMode.none);
  });
  it('continuous + per_row → per_row', () => {
    expect(resolveEffectiveCutterMode(continuous(CutterMode.perRow))).toBe(CutterMode.perRow);
  });
});
```

- [ ] **Step 2: Chạy — đỏ**

Run: `npx jest src/features/printer/drivers/tspl/__tests__/cutter.test.ts`
Expected: FAIL — `Cannot find module '../cutter'`.

- [ ] **Step 3: Tạo `cutter.ts`**

Create `src/features/printer/drivers/tspl/cutter.ts`:
```ts
import { CutterMode, PrintMediaType } from '../../types/printer.types';
import type { PrintMedia } from '../../types/printer.types';

/**
 * Chế độ cắt THỰC THI sau khi áp ràng buộc vật lý:
 * - die_cut: LUÔN `none` — giấy die-cut tách bằng răng cưa, không có chỗ cắt.
 * - continuous: `media.cutterMode ?? 'per_job'` — mặc định cắt cuối mỗi job
 *   (giữ hành vi ESC/POS hiện tại; chỉ `'none'` tường minh mới tắt).
 *
 * KHÔNG đọc `Printer.capabilities.cutter` — field đó dormant, `cutterMode` là
 * nguồn sự thật duy nhất cho tới khi có UI (SP-C không làm, spec §1).
 */
export const resolveEffectiveCutterMode = (media: PrintMedia): CutterMode =>
  media.type === PrintMediaType.dieCut ? CutterMode.none : (media.cutterMode ?? CutterMode.perJob);
```

- [ ] **Step 4: Chạy — xanh**

Run: `npx jest src/features/printer/drivers/tspl/__tests__/cutter.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: `PrintOptions` + `IPrinterDriver`**

`src/features/printer/types/driver.types.ts` — thêm sau `PrintDocuments`:
```ts
export interface PrintOptions {
  /** Số HÀNG die-cut cần in (mỗi hàng = `media.columns` con tem). Default 1. Bỏ qua khi media continuous ở đường routing; `testPrint` dùng để in thử grid. */
  rows?: number;
}
```
`IPrinterDriver`:
```ts
  testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void>;
  print(printerId: string, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void>;
```

- [ ] **Step 6: Cho `EscPosDriver` + `TsplDriver` khớp interface**

`EscPosDriver.ts`:
- import `PrintOptions` từ `../../types/driver.types`.
- `async print(printerId: string, documents: PrintDocuments, _printType: PrintType, _options?: PrintOptions): Promise<void>` — thêm `_options?`.
- `async testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, _printType: PrintType, _options?: PrintOptions): Promise<void>` — thêm `_options?`.
- Bỏ `cut: true` khỏi const, đổi tên:
  ```ts
  const ESC_POS_BASE_OPTIONS = { keepConnection: true, tailingLine: true, encoding: 'UTF8' } as const;
  ```
- `sendDocuments`:
  ```ts
  private async sendDocuments(adapter: NativeAdapter, driver: PrinterDriver, documents: PrintDocuments): Promise<void> {
    const cut = resolveEffectiveCutterMode(mediaOf(driver)) !== CutterMode.none;
    const text = buildEscPosText(paperSizeOf(driver), documents);
    await adapter.printText(text, { ...ESC_POS_BASE_OPTIONS, cut });
  }
  ```
  import `resolveEffectiveCutterMode` từ `../tspl/cutter`, `mediaOf`/`CutterMode` từ `../../types/printer.types`.

`TsplDriver.ts`:
- import `PrintOptions`.
- `async testPrint(printer, driver, documents, printType, _options?: PrintOptions)` — thêm `_options?` (Task 2 mới wire).
- `async print(printerId, documents, printType, _options?: PrintOptions)` — thêm `_options?`.

- [ ] **Step 7: Test ESC/POS cut flag**

`src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts` — thêm (dùng `makeEscPosDriverEntry` từ `../../../testing/printerFixtures` nếu file đã dùng factory; nếu inline thì build `PrinterDriver` với `config.media.cutterMode`):
```ts
it('sendDocuments gửi cut:true khi media.cutterMode undefined (mặc định giữ hành vi cũ)', async () => {
  // ... connect printer, testPrint, rồi:
  expect(printTextMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cut: true }));
});
it('sendDocuments gửi cut:false khi media.cutterMode = none', async () => {
  // driver entry với config.media = { type:'continuous', paperSize:80, cutterMode:'none' }
  expect(printTextMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cut: false }));
});
```
(`printTextMock` = mock của `USBPrinter.printText` / adapter `printText` — theo cách file này mock native; xem các test `sendDocuments` sẵn có, tái dùng cùng setup.)

- [ ] **Step 8: Verify + commit**

Run: `npm run type-check` (sạch — `IPrinterDriver` đổi, cả 2 driver + mọi mock `IPrinterDriver` trong test phải khớp; `makeMockDriver` trong `PrinterService.test.ts` có `print`/`testPrint` mock — jest.fn khớp mọi arity, không cần sửa) + `npx jest` (xanh) + `npm run lint` (0 error).
Nếu type-check báo test mock nào thiếu → chỉ khi mock đó gõ kiểu tường minh; jest.fn() thì bỏ qua.

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: PrintOptions{rows} + resolveEffectiveCutterMode + ESC/POS cut qua resolver (SP-B t1)

- IPrinterDriver.print/testPrint + param options?: PrintOptions
- drivers/tspl/cutter.ts: resolveEffectiveCutterMode (die_cut→none, continuous→per_job default)
- EscPosDriver: cut flag tính per-call qua resolver — default vẫn true (không đổi hành vi)

Spec: docs/superpowers/specs/2026-08-30-tspl-die-cut-render-design.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `TsplEncoder` media-aware + context + strategy migration + `TsplDriver` rows

Đổi `TsplEncoder.initialize` signature = atomic (vỡ cả 3 strategy + `TsplBitmapStrategy` + test cùng lúc). Task này làm trọn: encoder + context + 3 strategy migrate signature (VẪN single-column) + `TsplDriver.buildBytes`+rows, 1 commit. Multi-column là Task 3.

**Files:**
- Modify: `src/features/printer/utils/paperWidth.ts`, `src/features/printer/drivers/tspl/TsplEncoder.ts`, `src/features/printer/drivers/tspl/strategies/tsplStrategy.types.ts`, `src/features/printer/drivers/tspl/TsplDriver.ts`, all 3 strategy files
- Test: `TsplEncoder.test.ts`, `TsplDriver.test.ts`, 3 strategy test files

**Interfaces:**
- Consumes: `PrintOptions` (Task 1), `resolveEffectiveCutterMode` (Task 1), `PrintMedia`/`PrintMediaType`/`CutterMode`/`mediaOf` (SP-A).
- Produces:
  ```ts
  // utils/paperWidth.ts
  export const DOTS_PER_MM = 8;

  // drivers/tspl/TsplEncoder.ts
  export { DOTS_PER_MM };                              // re-export cho importer cũ (TsplBitmapStrategy)
  export const resolveSizeHeightMm: (media: PrintMedia, printType: PrintType) => number;
  export const columnPitchDots: (media: PrintMedia) => number;   // (itemWidthMm + horizontalGapMm) * 8
  export const columnOffsets: (media: PrintMedia) => number[];   // die_cut → [0, pitch, 2*pitch, ...]; continuous → [0]
  // class TsplEncoder:
  //   initialize(media: PrintMedia, printType?: PrintType, codepage?: TsplCodepage): this
  //   cut(rows: number, mode: CutterMode): this
  //   text/barcode/qrcode/image — chữ ký KHÔNG đổi

  // strategies/tsplStrategy.types.ts
  // TsplStrategyContext { printer, driver, documents, printType, media: PrintMedia, rows: number }   // −heightMm
  ```

- [ ] **Step 1: `DOTS_PER_MM` sang `paperWidth.ts`**

`src/features/printer/utils/paperWidth.ts` — thêm ở đầu (sau import):
```ts
/** 203dpi — mật độ dot chuẩn máy in nhiệt TSPL (8 dot/mm). */
export const DOTS_PER_MM = 8;
```

- [ ] **Step 2: Viết test `TsplEncoder` mới (đỏ trước)**

`src/features/printer/drivers/tspl/__tests__/TsplEncoder.test.ts` — cập nhật các test `initialize(...)`/`cut()` sẵn có sang signature mới + thêm case. `decode` helper giữ nguyên. `MEDIA` fixtures:
```ts
import { PrintMediaType, CutterMode } from '../../../types/printer.types';
import type { PrintMedia } from '../../../types/printer.types';
const CONT = (paperSize = 58): PrintMedia => ({ type: PrintMediaType.continuous, paperSize });
const DIE = (): PrintMedia => ({ type: PrintMediaType.dieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3 });
```
Các test đổi:
- `initialize(58)` → `initialize(CONT(58))` ; expect `SIZE 50 mm, 200 mm` + `GAP 0 mm, 0 mm` + `CODEPAGE UTF-8` + `CLS` (Receipt mặc định).
- `initialize(58, Label)` → `initialize(CONT(58), PrintType.Label)` — nhưng continuous Label không còn `itemHeightMm` → dùng `DEFAULT_LABEL_HEIGHT_MM`: `SIZE 50 mm, 30 mm` + `GAP 0 mm, 0 mm` (continuous KHÔNG có `GAP 2mm` nữa — chỉ die_cut mới dò khe). **Ghi chú migration:** test cũ `'initialize() emits gap-sensing SIZE/GAP for Label'` đổi thành continuous-Label không dò khe; test dò khe chuyển sang die_cut.
- Test cũ `'custom labelHeightMm'` → xoá (không còn param); thay bằng die_cut height.
Case mới:
```ts
it('die_cut → SIZE cả hàng + GAP verticalGapMm', () => {
  const out = decode(new TsplEncoder().initialize(DIE()).encode());
  expect(out).toContain('SIZE 94 mm, 20 mm');   // 3*30 + 2*2
  expect(out).toContain('GAP 3 mm, 0 mm');
});
it('cut(3, per_job) → SET CUTTER 3 rồi PRINT 3,1', () => {
  const out = decode(new TsplEncoder().cut(3, CutterMode.perJob).encode());
  expect(out).toContain('SET CUTTER 3');
  expect(out.trim().endsWith('PRINT 3,1')).toBe(true);
});
it('cut(2, per_row) → SET CUTTER 1 rồi PRINT 2,1', () => {
  const out = decode(new TsplEncoder().cut(2, CutterMode.perRow).encode());
  expect(out).toContain('SET CUTTER 1');
  expect(out).toContain('PRINT 2,1');
});
it('cut(1, none) → chỉ PRINT 1,1, KHÔNG SET CUTTER', () => {
  const out = decode(new TsplEncoder().cut(1, CutterMode.none).encode());
  expect(out).not.toContain('SET CUTTER');
  expect(out.trim().endsWith('PRINT 1,1')).toBe(true);
});
```
Thêm test helper:
```ts
import { columnPitchDots, columnOffsets, resolveSizeHeightMm } from '../TsplEncoder';
it('columnPitchDots = (itemWidthMm + horizontalGapMm) * 8', () => {
  expect(columnPitchDots(DIE())).toBe(256);   // (30+2)*8
});
it('columnOffsets: die_cut → [0, pitch, 2*pitch]; continuous → [0]', () => {
  expect(columnOffsets(DIE())).toEqual([0, 256, 512]);
  expect(columnOffsets(CONT())).toEqual([0]);
});
it('resolveSizeHeightMm: die_cut → itemHeightMm; continuous Receipt → CONTINUOUS_HEIGHT_MM; continuous Label → itemHeightMm ?? DEFAULT', () => {
  expect(resolveSizeHeightMm(DIE(), PrintType.Label)).toBe(20);
  expect(resolveSizeHeightMm(CONT(), PrintType.Receipt)).toBe(200);
  expect(resolveSizeHeightMm(CONT(), PrintType.Label)).toBe(30);
});
```
Các test `text()`/`barcode()`/`qrcode()`/`image()` KHÔNG đổi (chữ ký giữ). Test `initialize(100)`/`initialize(104)` từ SP-A → `initialize(CONT(100))` → `SIZE 96 mm`; `initialize(CONT(104))` → `SIZE 104 mm`. Test codepage từ internalfont → `initialize(CONT(58), PrintType.Receipt, '1258')`.

- [ ] **Step 3: Chạy — đỏ**

Run: `npx jest src/features/printer/drivers/tspl/__tests__/TsplEncoder.test.ts`
Expected: FAIL — `initialize` nhận `PrintMedia` chứ không phải số; `columnPitchDots`/`columnOffsets`/`resolveSizeHeightMm` chưa export; `cut` chưa nhận args.

- [ ] **Step 4: Sửa `TsplEncoder.ts`**

- Import: `import { DOTS_PER_MM } from '../../utils/paperWidth';` ở đầu; **xoá** `export const DOTS_PER_MM = 8;` cũ; thêm `export { DOTS_PER_MM };`.
- Import thêm: `CutterMode, PrintMediaType` từ `'../../types/printer.types'`; `type { PrintMedia }`.
- `PRINTABLE_WIDTH_MM` giữ nguyên (`{ 58: 50, 80: 72, 100: 96, 104: 104 }`).
- Thêm hàm module-scope:
  ```ts
  /**
   * Chiều cao khai báo cho `SIZE`:
   * - die_cut → `itemHeightMm` (schema SP-A đảm bảo có).
   * - continuous Label → `itemHeightMm ?? DEFAULT_LABEL_HEIGHT_MM`.
   * - continuous Receipt (hoặc không truyền printType) → `CONTINUOUS_HEIGHT_MM`.
   */
  export const resolveSizeHeightMm = (media: PrintMedia, printType: PrintType): number => {
    if (media.type === PrintMediaType.dieCut) return media.itemHeightMm ?? DEFAULT_LABEL_HEIGHT_MM;
    if (printType === PrintType.Label) return media.itemHeightMm ?? DEFAULT_LABEL_HEIGHT_MM;
    return CONTINUOUS_HEIGHT_MM;
  };

  /** Khoảng cách tâm-đến-tâm giữa 2 cột die-cut, theo dot. Chỉ dùng khi `media.type === 'die_cut'`. */
  export const columnPitchDots = (media: PrintMedia): number =>
    ((media.itemWidthMm ?? 0) + (media.horizontalGapMm ?? 0)) * DOTS_PER_MM;

  /** x-offset (dot) cho từng cột. die_cut → `[0, pitch, ...]` (`columns` phần tử); mọi trường hợp khác → `[0]`. */
  export const columnOffsets = (media: PrintMedia): number[] => {
    if (media.type !== PrintMediaType.dieCut) return [0];
    const pitch = columnPitchDots(media);
    return Array.from({ length: media.columns ?? 1 }, (_, i) => i * pitch);
  };
  ```
- `private codepage` giữ. Bỏ `resolveHeightMm`-liên-quan nếu có.
- `initialize`:
  ```ts
  initialize(media: PrintMedia, printType: PrintType = PrintType.Receipt, codepage: TsplCodepage = TsplCodepage.utf8): this {
    this.codepage = codepage;
    const heightMm = resolveSizeHeightMm(media, printType);
    if (media.type === PrintMediaType.dieCut) {
      const rowWidthMm = (media.columns ?? 1) * (media.itemWidthMm ?? 0) + ((media.columns ?? 1) - 1) * (media.horizontalGapMm ?? 0);
      this.pushLine(`SIZE ${rowWidthMm} mm, ${heightMm} mm`);
      this.pushLine(`GAP ${media.verticalGapMm ?? 0} mm, 0 mm`);
    } else {
      this.pushLine(`SIZE ${PRINTABLE_WIDTH_MM[media.paperSize]} mm, ${heightMm} mm`);
      this.pushLine('GAP 0 mm, 0 mm');
    }
    this.pushLine(`CODEPAGE ${codepage}`);
    this.pushLine('CLS');
    return this;
  }
  ```
  > **Đổi hành vi có chủ đích:** continuous + `PrintType.Label` giờ dùng `GAP 0,0` (không dò khe) thay `GAP 2mm` — vì "giấy cuộn liên tục" theo định nghĩa không có khe. Chỉ die_cut mới `GAP <vGap>`. Đây là hệ quả đúng của việc tách axis (spec §0). Trước SP-A `GAP 2mm` gán cứng cho mọi Label — giả định sai mà spec loại bỏ.
- `cut`:
  ```ts
  cut(rows: number, mode: CutterMode): this {
    if (mode === CutterMode.perRow) this.pushLine('SET CUTTER 1');
    else if (mode === CutterMode.perJob) this.pushLine(`SET CUTTER ${rows}`);
    this.pushLine(`PRINT ${rows},1`);
    return this;
  }
  ```

- [ ] **Step 5: `TsplStrategyContext`**

`src/features/printer/drivers/tspl/strategies/tsplStrategy.types.ts`:
```ts
import type { Printer, PrinterDriver, PrintMedia, TsplRenderMode } from '../../../types/printer.types';
// ...
export interface TsplStrategyContext {
  printer: Printer;
  driver: PrinterDriver;
  documents: PrintDocuments;
  printType: PrintType;
  /** = `mediaOf(driver)`. */
  media: PrintMedia;
  /** Số hàng die-cut cần in (>= 1). Continuous: số bản sao. */
  rows: number;
}
```
Xoá dòng `heightMm`.

- [ ] **Step 6: `TsplDriver.ts`**

- Xoá hàm `resolveHeightMm` + import `DEFAULT_LABEL_HEIGHT_MM`/`CONTINUOUS_HEIGHT_MM` nếu chỉ nó dùng (kiểm tra — `CONTINUOUS_HEIGHT_MM` có thể còn dùng chỗ khác; nếu không, xoá import).
- Import `mediaOf` từ `../../types/printer.types`; `PrintOptions` từ `../../types/driver.types`.
- `buildBytes`:
  ```ts
  private buildBytes(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, rows: number): Uint8Array {
    if (driver.config.type !== PrinterDriverType.tspl) {
      throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_RENDER_MODE_UNSUPPORTED, message: 'Driver không phải TSPL.' });
    }
    const strategy = resolveTsplStrategy(driver.config.renderMode);
    const context: TsplStrategyContext = { printer, driver, documents, printType, media: mediaOf(driver), rows };
    strategy.validate(context);
    return strategy.encode(context);
  }
  ```
- `testPrint(printer, driver, documents, printType, options?: PrintOptions)`:
  `const rows = Math.max(1, Math.floor(options?.rows ?? 1));` → `this.buildBytes(printer, driver, documents, printType, rows)`.
- `print(printerId, documents, printType, options?: PrintOptions)`:
  `const rows = Math.max(1, Math.floor(options?.rows ?? 1));` → `this.buildBytes(context.printer, context.driver, documents, printType, rows)`.

- [ ] **Step 7: 3 strategy — migrate signature (single-column)**

`TsplBitmapStrategy.encode`:
```ts
encode(context: TsplStrategyContext): Uint8Array {
  const { printType, documents, media, rows } = context;
  const paperSize = paperSizeOf(context.driver);
  let bitmap;
  try {
    bitmap = decodePngBase64ToMonochrome(documents.image as string, PAPER_IMAGE_WIDTH_PX[paperSize]);
  } catch (error) { /* TSPL_IMAGE_INVALID — giữ nguyên */ }
  const maxHeightPx = resolveSizeHeightMm(media, printType) * DOTS_PER_MM;
  if (bitmap.heightPx > maxHeightPx) { /* TSPL_IMAGE_TOO_LARGE — message dùng resolveSizeHeightMm(media, printType) thay heightMm */ }
  return new TsplEncoder().initialize(media, printType).image(0, 0, bitmap).cut(rows, resolveEffectiveCutterMode(media)).encode();
}
```
import `resolveSizeHeightMm` từ `../TsplEncoder`, `resolveEffectiveCutterMode` từ `../cutter`.

`TsplTrueTypeStrategy.encode` + `TsplInternalFontStrategy.encode`:
- Bỏ `heightMm` khỏi destructure; thêm `media, rows`.
- `new TsplEncoder().initialize(media, printType)` (truetype) / `.initialize(media, printType, codepage)` (internalfont).
- Đổi `encoder.cut()` cuối → `encoder.cut(rows, resolveEffectiveCutterMode(media))`.
- `paperSizeOf(driver)` cho `PAPER_WIDTH_CHARS` giữ nguyên (dùng cho `'-'.repeat`).
- Vòng element GIỮ NGUYÊN (single-column — Task 3 thêm vòng cột).

- [ ] **Step 8: Cập nhật strategy test files (signature)**

3 file `*Strategy.test.ts` + `TsplDriver.test.ts`:
- context fixture: bỏ `heightMm`, thêm `media: <PrintMedia>`, `rows: 1`.
- assert `PRINT 1,1` vẫn xuất hiện (single-column, rows=1).
- `TsplBitmapStrategy.test.ts`: `initialize` mock/expectation đổi.
- `TsplDriver.test.ts`: thêm case `testPrint(printer, driver, docs, PrintType.Label, { rows: 4 })` → bytes chứa `PRINT 4,1`; `SET CUTTER` xuất hiện cho continuous (mặc định per_job → `SET CUTTER 4`).

- [ ] **Step 9: Verify + commit**

Run: `npm run type-check` sạch + `npx jest` xanh + `npm run lint` 0 error.
```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: TsplEncoder nhận PrintMedia + cut(rows,mode) + SET CUTTER (SP-B t2)

- initialize(media, printType?, codepage?) thay (paperSize, printType, labelHeightMm, codepage)
- SIZE/GAP theo media.type: die_cut → SIZE cả hàng + GAP verticalGapMm; continuous → GAP 0,0
- cut(rows, mode) → SET CUTTER + PRINT rows,1
- resolveSizeHeightMm / columnPitchDots / columnOffsets helpers; DOTS_PER_MM → paperWidth.ts
- TsplStrategyContext: +media +rows −heightMm; TsplDriver đọc options.rows
- continuous Label giờ GAP 0,0 (không còn giả định Label=die-cut)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Strategies multi-column + bitmap tiling + media-aware decode

**Files:**
- Modify: 3 strategy files
- Test: 3 strategy test files

**Interfaces:**
- Consumes: `columnOffsets` (Task 2), `DOTS_PER_MM` (Task 2), `mediaOf`/`PrintMediaType` (SP-A).
- Produces: (không có export mới)

- [ ] **Step 1: Viết test die_cut multi-column (đỏ trước)**

`TsplTrueTypeStrategy.test.ts` + `TsplInternalFontStrategy.test.ts`:
```ts
it('die_cut 2 cột → mỗi element xuất hiện 2 lần, lần 2 tại x = element.x + pitch', () => {
  const media = { type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3 } as const;
  const ctx = { printer, driver: withConfig({ type:'tspl', renderMode:'truetype', media, font:{name:'VF',fileName:'x.ttf',fontInstalled:true} }),
    documents: { text: { elements: [{ type:'text', content:'A', x: 10, y: 0 }] } }, printType: PrintType.Receipt, media, rows: 1 };
  const ascii = Array.from(s.encode(ctx as never)).map((b) => String.fromCharCode(b)).join('');
  // pitch = (30+2)*8 = 256 → cột 2 tại x = 10 + 256 = 266
  expect(ascii).toContain('TEXT 10,0,');
  expect(ascii).toContain('TEXT 266,0,');
});
```
`TsplBitmapStrategy.test.ts`:
```ts
it('die_cut 3 cột → 3 lệnh BITMAP tại x = 0, pitch, 2*pitch; PRINT rows,1', () => {
  // media die_cut columns:3 itemWidthMm:30 horizontalGapMm:2 → pitch 256
  // documents.image = base64 PNG nhỏ (dùng cùng fixture ảnh test sẵn có)
  const ascii = Array.from(s.encode(ctxDieCut)).map((b) => String.fromCharCode(b)).join('');
  expect((ascii.match(/BITMAP /g) ?? []).length).toBe(3);
  expect(ascii).toContain('BITMAP 0,0,');
  expect(ascii).toContain('BITMAP 256,0,');
  expect(ascii).toContain('BITMAP 512,0,');
});
it('die_cut → decode ảnh ở width = itemWidthMm * 8', () => {
  // spy/mock decodePngBase64ToMonochrome, assert gọi với targetWidth = 30*8 = 240
});
```

- [ ] **Step 2: Chạy — đỏ**

Run: `npx jest src/features/printer/drivers/tspl/strategies`
Expected: FAIL — chỉ 1 occurrence mỗi element / 1 BITMAP.

- [ ] **Step 3: `TsplTrueTypeStrategy` + `TsplInternalFontStrategy` — vòng cột**

Bọc vòng element hiện có bằng `for (const dx of columnOffsets(media))`, cộng `dx` vào MỌI x:
```ts
import { columnOffsets } from '../TsplEncoder';
// trong encode(), sau khi tạo encoder:
for (const dx of columnOffsets(media)) {
  for (const element of documents.text.elements) {
    if (element.type === 'text') encoder.text(element.x + dx, element.y, element.content, fontName);
    else if (element.type === 'line') encoder.text(element.x + dx, element.y, '-'.repeat(paperWidth), fontName);
    else if (element.type === 'table') element.rows.forEach((row, i) => encoder.text(element.x + dx, element.y + i * 20, row.join('  '), fontName));
    else if (element.type === 'row') encoder.text(element.x + dx, element.y, formatRow(element.left, element.right, paperWidth), fontName);
    else if (element.type === 'barcode') encoder.barcode(element.x + dx, element.y, element.content);
    else if (element.type === 'qrCode') encoder.qrcode(element.x + dx, element.y, element.content);
    else throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED, message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
  }
}
return encoder.cut(rows, resolveEffectiveCutterMode(media)).encode();
```
`media` từ `context.media`. `columnOffsets(media)` = `[0]` khi continuous → hành vi không đổi.

- [ ] **Step 4: `TsplBitmapStrategy` — tile + media-aware decode**

```ts
encode(context: TsplStrategyContext): Uint8Array {
  const { printType, documents, media, rows } = context;
  const paperSize = paperSizeOf(context.driver);
  const targetWidthPx = media.type === PrintMediaType.dieCut
    ? (media.itemWidthMm ?? 0) * DOTS_PER_MM
    : PAPER_IMAGE_WIDTH_PX[paperSize];
  let bitmap;
  try {
    bitmap = decodePngBase64ToMonochrome(documents.image as string, targetWidthPx);
  } catch (error) { /* TSPL_IMAGE_INVALID */ }
  const maxHeightPx = resolveSizeHeightMm(media, printType) * DOTS_PER_MM;
  if (bitmap.heightPx > maxHeightPx) { /* TSPL_IMAGE_TOO_LARGE */ }
  const encoder = new TsplEncoder().initialize(media, printType);
  for (const dx of columnOffsets(media)) encoder.image(dx, 0, bitmap);
  return encoder.cut(rows, resolveEffectiveCutterMode(media)).encode();
}
```
import `PrintMediaType` từ `'../../../types/printer.types'`, `columnOffsets` từ `'../TsplEncoder'`.

- [ ] **Step 5: Chạy — xanh**

Run: `npx jest src/features/printer/drivers/tspl` → xanh (continuous test cũ vẫn pass vì `columnOffsets` = `[0]`).

- [ ] **Step 6: Verify + commit**

`npm run type-check` + `npx jest` + `npm run lint`.
```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: 3 strategy TSPL render die-cut nhiều cột (SP-B t3)

- vòng columnOffsets(media) bọc vòng element — mỗi element/bitmap lặp `columns` lần, x += col*pitch
- TsplBitmapStrategy: decode ảnh ở itemWidthMm*8 khi die_cut, tile BITMAP theo cột
- continuous không đổi (columnOffsets = [0])

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `imageDocumentMedia` + `captureBillImage(media)` + cart/flow wiring

**Files:**
- Modify: `src/features/printer/printing/PrintService.ts`, `src/features/printer/hooks/useBillImageCapture.tsx`, `src/features/printer/hooks/useAddPrinterFlow.ts`, `src/features/cart/services/OrderPrintTrigger.ts`
- Test: `PrintService.test.ts`, `OrderPrintTrigger.test.ts`, `useAddPrinterFlow.test.tsx`

**Interfaces:**
- Consumes: `mediaOf` (SP-A), `PrintMedia` (SP-A), `DOTS_PER_MM` (Task 2), `PAPER_IMAGE_WIDTH_PX` (existing).
- Produces:
  ```ts
  // PrintService
  imageDocumentMedia(printType: PrintType): PrintMedia | null;   // thay imageDocumentPaperSize
  // useBillImageCapture
  captureBillImage: (document: PrintDocument, media: PrintMedia) => Promise<string | null>;
  // OrderPrintTrigger
  export type CaptureBillImage = (document: PrintDocument, media: PrintMedia) => Promise<string | null>;
  ```

- [ ] **Step 1: Viết test (đỏ trước)**

`PrintService.test.ts` — `describe('PrintService.imageDocumentPaperSize')` → `describe('PrintService.imageDocumentMedia')`; các assert `.toBe(58)` / `.toBe(80)` → `.toEqual({ type: 'continuous', paperSize: 58 })` v.v.; `.toBeNull()` giữ. (Fixtures TSPL bitmap target — `media` của driver quyết định.)

`OrderPrintTrigger.test.ts` — mock `PrintService.imageDocumentPaperSize` → `imageDocumentMedia`; `.mockReturnValue(58)` → `.mockReturnValue({ type: 'continuous', paperSize: 58 })`; `.mockReturnValue(null)` giữ. Assert `captureBillImage` được gọi với `(doc, { type:'continuous', paperSize:58 })`.

`useAddPrinterFlow.test.tsx` — nếu có test cho `resolveTestPrintDocuments` / test-print bitmap: assert `captureBillImage` gọi với `mediaOf(driver)` (object) thay số.

- [ ] **Step 2: Chạy — đỏ**

Run: `npx jest src/features/printer/printing/__tests__/PrintService.test.ts src/features/cart/services/__tests__/OrderPrintTrigger.test.ts`
Expected: FAIL — `imageDocumentMedia` không tồn tại / trả number.

- [ ] **Step 3: `PrintService.ts`**

```ts
import type { PrintMedia } from '../types/printer.types';
import { mediaOf, PrinterDriverType, tsplRenderModeOf, TsplRenderMode } from '../types/printer.types';
// bỏ import PaperSize nếu không còn dùng

const imageDocumentMedia = (printType: PrintType): PrintMedia | null => {
  const target = deps.routing.resolveTargets(printType).find(
    (t: PrintTarget) => t.driver.type === PrinterDriverType.tspl && tsplRenderModeOf(t.driver) === TsplRenderMode.bitmap,
  );
  return target ? mediaOf(target.driver) : null;
};
// return { print, imageDocumentMedia };
```
Sửa doc comment (`paperSize cần để render ảnh` → `media`).

- [ ] **Step 4: `useBillImageCapture.tsx`**

```ts
import { PAPER_IMAGE_WIDTH_PX, DOTS_PER_MM } from '../utils/paperWidth';
import type { PrintMedia } from '../types/printer.types';
import { PrintMediaType } from '../types/printer.types';

// interface: captureBillImage: (document: PrintDocument, media: PrintMedia) => Promise<string | null>;

const captureBillImage = useCallback(
  (document: PrintDocument, media: PrintMedia): Promise<string | null> =>
    new Promise((resolve) => {
      resolverRef.current = resolve;
      const widthPx = media.type === PrintMediaType.dieCut
        ? (media.itemWidthMm ?? 0) * DOTS_PER_MM
        : PAPER_IMAGE_WIDTH_PX[media.paperSize];
      setPending({ document, widthPx });
    }),
  [],
);
```

- [ ] **Step 5: `useAddPrinterFlow.ts` `resolveTestPrintDocuments`**

`const base64 = await captureBillImage(document, mediaOf(driver));` (thay `paperSizeOf(driver)`). Import `mediaOf` nếu chưa.

- [ ] **Step 6: `OrderPrintTrigger.ts`**

```ts
import type { PrintMedia } from '../../printer/types/printer.types';
export type CaptureBillImage = (document: PrintDocument, media: PrintMedia) => Promise<string | null>;
// bỏ import PaperSize nếu không còn dùng

const buildPrintDocumentVariants = async (printType, textDocument, captureBillImage) => {
  const media = PrintService.imageDocumentMedia(printType);
  if (!media) return { text: textDocument };
  const base64 = await captureBillImage(textDocument, media);
  if (!base64) return { text: textDocument };
  return { text: textDocument, image: base64 };
};
```
Sửa doc comment nhắc `imageDocumentPaperSize` → `imageDocumentMedia`.
Kiểm tra nơi truyền `captureBillImage` vào `OrderPrintTrigger` (component/hook cart) — nó nhận từ `useBillImageCapture`, chữ ký đã khớp sau Step 4. Nếu có adapter trung gian, sửa.

- [ ] **Step 7: Chạy — xanh + verify**

Run: `npm run type-check` sạch + `npx jest` xanh + `npm run lint` 0 error.
Chú ý: grep `imageDocumentPaperSize` toàn repo phải trả 0 kết quả (trừ CHANGELOG/spec).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: bitmap capture + imageDocumentMedia thành media-aware (SP-B t4)

- PrintService.imageDocumentPaperSize → imageDocumentMedia(): PrintMedia | null
- captureBillImage(document, media): width = die_cut ? itemWidthMm*8 : PAPER_IMAGE_WIDTH_PX[paperSize]
- OrderPrintTrigger + useAddPrinterFlow.resolveTestPrintDocuments truyền media

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**

| Spec § | Task |
|--------|------|
| §2.1 `PrintOptions` + `IPrinterDriver` | T1 Step 5-6 |
| §2.2 `resolveEffectiveCutterMode` | T1 Step 1-4 |
| §2.3 `TsplStrategyContext` (+media +rows −heightMm) | T2 Step 5 |
| §3.1 `initialize(media, printType?, codepage?)` + SIZE/GAP | T2 Step 4 |
| §3.2 `columnPitchDots` | T2 Step 4 |
| §3.3 `cut(rows, mode)` + `SET CUTTER` | T2 Step 4 |
| §3.4 text/image chữ ký không đổi | T2 (không đụng) |
| §4 strategies multi-column | T3 |
| §4.2 bitmap decode width + tiling | T3 Step 4 |
| §4.3 truetype/internalfont vòng cột | T3 Step 3 |
| §5.1 `captureBillImage(media)` + `DOTS_PER_MM` | T2 Step 1, T4 Step 4 |
| §5.2 `imageDocumentMedia` | T4 Step 3 |
| §5.3 `OrderPrintTrigger` | T4 Step 6 |
| §5.4 `useAddPrinterFlow.resolveTestPrintDocuments` | T4 Step 5 |
| §6 ESC/POS cut | T1 Step 6 |
| §8 testing | rải khắp các task Step "test" |

Không gap. `TsplDriver.print` đọc `options` nhưng `PrintScheduler`/`PrintService.print` chưa thread (spec §1 "ngoài phạm vi" → SP-D) — có chủ đích, không phải gap.

**2. Placeholder scan:** Không "TBD"/"handle edge cases". Các Step "giữ nguyên message" trỏ tới code hiện có cụ thể (`TSPL_IMAGE_INVALID`/`TSPL_IMAGE_TOO_LARGE` block đã có trong file, chỉ đổi biến `heightMm` → `resolveSizeHeightMm(media, printType)`). Test snippet có code thật. `SET CUTTER <n>` số placeholder → đã ghi rõ ở Global Constraints là chưa verify (quyết định spec, không phải TODO).

**3. Type consistency:**
- `resolveEffectiveCutterMode(media)` — T1 định nghĩa, dùng T2 (strategies) + T3 + T1 (ESC/POS). Nhất quán.
- `columnOffsets(media): number[]` / `columnPitchDots(media): number` / `resolveSizeHeightMm(media, printType): number` — T2 định nghĩa, dùng T2 (bitmap clamp) + T3. Nhất quán.
- `initialize(media, printType?, codepage?)` — T2, dùng cả 3 strategy T2+T3. `cut(rows, mode)` — T2, dùng T2+T3.
- `TsplStrategyContext` field `media`/`rows` — T2 Step 5, đọc T2 Step 7 + T3.
- `imageDocumentMedia` / `captureBillImage(_, media)` / `CaptureBillImage` — T4, tên nhất quán giữa PrintService/useBillImageCapture/OrderPrintTrigger.
- `DOTS_PER_MM` — T2 Step 1 chuyển sang `paperWidth.ts`, `TsplEncoder` re-export; `TsplBitmapStrategy` (import từ TsplEncoder — vẫn chạy nhờ re-export), `useBillImageCapture` (import từ paperWidth, T4). Nhất quán.
- `PrintOptions { rows? }` — T1, đọc T2 (`TsplDriver`).

---

## Execution Handoff

Sau khi lưu plan, chọn cách thực thi.
