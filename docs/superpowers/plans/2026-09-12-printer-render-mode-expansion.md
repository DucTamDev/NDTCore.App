# Printer Render Mode Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let TSPL printers choose a text render mode (built-in font, no CODEPAGE/font juggling), and let both ESC/POS and TSPL choose which source produces their Bitmap-mode image — the existing `react-native-view-shot` capture (`Image`), or a new Skia off-screen renderer that draws straight from the `PrintDocument` AST (`Ast`).

**Architecture:** Add a `bitmapSource` field to `PrinterDriverConfig` (meaningful only when `renderMode === Bitmap`). Add a `TsplTextStrategy` mirroring `TsplBitmapStrategy` so TSPL can pick `Encoder` too. Add `renderDocumentToBitmap()` — a pure async function (no React tree needed) using `@shopify/react-native-skia`'s off-screen `Surface` API to rasterize `PrintDocument.elements[]` directly, producing the same base64-PNG contract `documents.image` already has. Wire `OrderPrintTrigger` to pick between the two image producers based on the resolved target's `bitmapSource`. Drivers (`EscPosDriver`, `TsplBitmapStrategy`) do not change — they only ever consume `documents.image`.

**Tech Stack:** React Native 0.86.2, TypeScript strict, Zod, Jest. New dependencies: `@shopify/react-native-skia@^2.11` (peer deps `react>=19`, `react-native>=0.78`, `react-native-worklets>=0.7`, `react-native-reanimated>=4.0` — all already satisfied by this project's installed versions) and `qrcode@^1.5` (pure-JS QR matrix generator).

**Spec:** `docs/superpowers/specs/2026-09-12-printer-render-mode-expansion-design.md`

## Global Constraints

- TypeScript strict, không dùng `any` (CLAUDE.md).
- Toàn bộ text hiển thị người dùng: tiếng Việt.
- Component UI thuần trình bày (`DriverRenderModeSection.tsx`) không có test file riêng — verify qua type-check/lint.
- File logic (services/drivers/schemas) luôn có `.test.ts` trong `__tests__/` cùng cấp.
- Driver code (`EscPosDriver.sendBitmap`, `TsplBitmapStrategy`) KHÔNG được sửa — chỉ tầng orchestration biết `bitmapSource`.
- Không phục hồi `TrueType`/`InternalFont` cho TSPL — quyết định đã chốt, không đổi.
- Không implement text-wrapping thật ở v1 — cả `TsplTextStrategy` và `renderDocumentToBitmap` không tự wrap dòng dài.
- Code128 encoder tự viết dùng bảng tra chuẩn ISO/IEC 15417 chép lại từ trí nhớ — **bắt buộc** verify bằng máy quét mã vạch thật trước khi coi Task 4 hoàn thành (xem Task 4 Step cuối).
- `npm run verify` (type-check + lint + test) phải pass trước khi coi bất kỳ task nào xong.

---

### Task 1: `BitmapSource` data model

**Files:**
- Modify: `src/features/printer/models/printer/PrinterDriver.ts`

**Interfaces:**
- Produces: `BitmapSource` (const object `{ Image: 'Image', Ast: 'Ast' }` + matching type), `PrinterDriverConfig.bitmapSource?: BitmapSource`.

- [ ] **Step 1: Add `BitmapSource` and the new field**

Edit `src/features/printer/models/printer/PrinterDriver.ts` — add after the existing `RenderMode` type export (`export type RenderMode = (typeof RenderMode)[keyof typeof RenderMode];`) and before `export interface PrinterDriverConfig`:

```ts
/**
 * Chỉ có ý nghĩa khi `renderMode === Bitmap` — chọn nguồn tạo ra
 * `documents.image`. `Image` (mặc định, backward-compat) là chụp `View` qua
 * `react-native-view-shot`; `Ast` vẽ trực tiếp từ `PrintDocument.elements[]`
 * lên canvas Skia off-screen, không mount View.
 */
export const BitmapSource = {
  Image: 'Image',
  Ast: 'Ast',
} as const;

export type BitmapSource = (typeof BitmapSource)[keyof typeof BitmapSource];
```

Then change `PrinterDriverConfig`:

```ts
export interface PrinterDriverConfig {
  renderMode: RenderMode;
  /** Chỉ có ý nghĩa khi renderMode === Bitmap. Thiếu field (printer lưu trước khi field này tồn tại) coi như `Image`. */
  bitmapSource?: BitmapSource;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS (no test file needed — this is a pure type/const addition, no runtime behavior change yet, matches how `RenderMode` itself has no dedicated test file).

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/models/printer/PrinterDriver.ts
git commit -m "feat(printer): add BitmapSource to PrinterDriverConfig"
```

---

### Task 2: Relax `PrinterSchema.ts` — TSPL can choose `Encoder`

**Files:**
- Modify: `src/features/printer/forms/addPrinter/PrinterSchema.ts:54`, `:113-115`
- Test: `src/features/printer/forms/addPrinter/__tests__/PrinterSchema.test.ts:33-42`

**Interfaces:**
- Consumes: `BitmapSource` from Task 1 (`../../models/printer/PrinterDriver`).

- [ ] **Step 1: Update the failing/changed tests first**

In `src/features/printer/forms/addPrinter/__tests__/PrinterSchema.test.ts`, replace the test at lines 33-42 (`'rejects TSPL driver with driver.config.renderMode Encoder'`) — TSPL now ACCEPTS `Encoder`:

```ts
  it('accepts TSPL driver with driver.config.renderMode Encoder', () => {
    const printer = makePrinter({
      driver: makeTsplDriver({ config: { renderMode: RenderMode.Encoder } }),
    });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('accepts TSPL driver with bitmapSource Ast when renderMode is Bitmap', () => {
    const printer = makePrinter({
      driver: makeTsplDriver({ config: { renderMode: RenderMode.Bitmap, bitmapSource: BitmapSource.Ast } }),
    });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });

  it('accepts a driver config with no bitmapSource at all (defaults to Image downstream)', () => {
    const printer = makePrinter({ driver: makeEscPosDriver({ config: { renderMode: RenderMode.Bitmap } }) });
    expect(printerSchema.safeParse(printer).success).toBe(true);
  });
```

Add the import at the top of the test file:

```ts
import { RenderMode, BitmapSource } from '../../../models/printer/PrinterDriver';
```

(replaces the existing `import { RenderMode } from '../../../models/printer/PrinterDriver';` line)

- [ ] **Step 2: Run tests to verify the renamed/new cases fail**

Run: `npm test -- PrinterSchema.test.ts`
Expected: FAIL — `'accepts TSPL driver with driver.config.renderMode Encoder'` fails because the schema still rejects it (old rule still in place).

- [ ] **Step 3: Remove the hard-coded TSPL-must-be-Bitmap rule**

In `src/features/printer/forms/addPrinter/PrinterSchema.ts`, delete these 3 lines (currently 113-115, inside the `printerSchema.superRefine`):

```ts
    if (printer.driver.type === PrinterDriverType.Tspl && printer.driver.config.renderMode !== RenderMode.Bitmap) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['driver', 'config', 'renderMode'], message: 'TSPL chỉ hỗ trợ chế độ Bitmap' });
    }
```

- [ ] **Step 4: Add `bitmapSource` to the driver config schema**

Replace line 54:

```ts
const printerDriverConfigSchema = z.object({ renderMode: z.enum([RenderMode.Encoder, RenderMode.Bitmap]) });
```

with:

```ts
const printerDriverConfigSchema = z.object({
  renderMode: z.enum([RenderMode.Encoder, RenderMode.Bitmap]),
  bitmapSource: z.enum([BitmapSource.Image, BitmapSource.Ast]).optional(),
});
```

Add `BitmapSource` to the existing import at the top of the file:

```ts
import { DriverSource, RenderMode, PrinterDriverType, BitmapSource } from '../../models/printer/PrinterDriver';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- PrinterSchema.test.ts`
Expected: PASS — all cases including the 3 new/changed ones.

- [ ] **Step 6: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/printer/forms/addPrinter/PrinterSchema.ts src/features/printer/forms/addPrinter/__tests__/PrinterSchema.test.ts
git commit -m "feat(printer): let TSPL choose Encoder render mode, validate bitmapSource"
```

---

### Task 3: `TsplTextStrategy` + wire into `TsplDriver`

**Files:**
- Create: `src/features/printer/rendering/printLayoutConstants.ts`
- Create: `src/features/printer/drivers/tspl/strategies/TsplTextStrategy.ts`
- Test: `src/features/printer/drivers/tspl/strategies/__tests__/TsplTextStrategy.test.ts`
- Modify: `src/features/printer/drivers/tspl/TsplDriver.ts:34,168-179`
- Test: `src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts` (add render-mode-switch case)

**Interfaces:**
- Consumes: `ITsplPrintStrategy`, `TsplStrategyContext` (`../tsplStrategy.types`); `TsplEncoder` (`.text()`, `.barcode()`, `.qrcode()`, `.cut()`, `.encode()`, `.initialize()`), `contentWidthChars` (`../TsplEncoder`); `formatRow` (`../../../utils/formatRow`); `resolveEffectiveCutterMode` (`../../../paper/cutter`); `RenderMode`, `PrinterErrorCode`, `PrinterErrorException`.
- Produces: `LINE_HEIGHT_DOTS`, `BARCODE_HEIGHT_DOTS`, `QRCODE_HEIGHT_DOTS` (numbers, exported from `rendering/printLayoutConstants.ts` — Task 6 reuses these under their `_PX` meaning, same unit: both TSPL dots and the Skia canvas pixel grid are 8 units/mm, see comment in the file). `TsplTextStrategy` class (`mode = RenderMode.Encoder`, `validate()`, `encode(context): Uint8Array`).

- [ ] **Step 1: Create the shared layout constants file**

```ts
// src/features/printer/rendering/printLayoutConstants.ts

/**
 * Hằng số layout dùng chung giữa `TsplTextStrategy` (đơn vị: dot TSPL) và
 * `renderDocumentToBitmap` (đơn vị: pixel canvas Skia) — CÙNG 1 giá trị vì cả
 * 2 đều theo mật độ 8 dot/mm của máy in nhiệt (`DOTS_PER_MM` ở `paper/paperSpec.ts`),
 * không phải trùng hợp: `PAPER_SIZE_SPECS[...].imageWidthPx` đã tính đúng
 * `printableWidthMm * 8` — px và dot LÀ CÙNG 1 đơn vị trong codebase này.
 *
 * `LINE_HEIGHT` ước lượng theo font built-in `"3"` của TSPL (chưa verify
 * trên phần cứng thật, ghi nhận là ước lượng — xem spec §9). `BARCODE_HEIGHT`
 * KHÔNG phải ước lượng: `TsplEncoder.barcode()` hardcode chiều cao `50` dot
 * ngay trong lệnh `BARCODE`, cộng thêm biên nhỏ. `QRCODE_HEIGHT` là ước lượng
 * (kích thước QR thật phụ thuộc độ dài nội dung/version) — v1 không wrap nên
 * chấp nhận tràn nếu QR thật lớn hơn.
 */
export const LINE_HEIGHT_DOTS = 24;
export const BARCODE_HEIGHT_DOTS = 60;
export const QRCODE_HEIGHT_DOTS = 200;
```

- [ ] **Step 2: Write the failing test for `TsplTextStrategy`**

```ts
// src/features/printer/drivers/tspl/strategies/__tests__/TsplTextStrategy.test.ts
import { TsplTextStrategy } from '../TsplTextStrategy';
import type { TsplStrategyContext } from '../tsplStrategy.types';
import { PrinterErrorCode } from '../../../../errors/PrinterError';
import { RenderMode } from '../../../../models/printer/PrinterDriver';
import { PrintType } from '../../../../models/printing/PrintType';
import type { Printer } from '../../../../models/printer/Printer';
import type { PrintPaperConfig } from '../../../../models/paper/PrintPaperConfig';
import type { PrintDocument } from '../../../../models/printing/PrintDocument';
import { makePrinter, makeTsplDriver } from '../../../../testing/printerFixtures';

const MEDIA: PrintPaperConfig = { type: 'Continuous', paperSize: 80 };

const printer: Printer = makePrinter({
  id: 'p1',
  name: 'M',
  driver: makeTsplDriver({ config: { renderMode: RenderMode.Encoder } }),
  paper: MEDIA,
});

const ctx = (document: PrintDocument, over: Partial<TsplStrategyContext> = {}): TsplStrategyContext => ({
  printer,
  documents: { text: document },
  printType: PrintType.Receipt,
  paper: MEDIA,
  rows: 1,
  ...over,
});

const asAscii = (bytes: Uint8Array): string => Array.from(bytes).map((b) => String.fromCharCode(b)).join('');

describe('TsplTextStrategy', () => {
  const s = new TsplTextStrategy();

  it('mode === Encoder', () => expect(s.mode).toBe(RenderMode.Encoder));

  it('validate không ném lỗi (không cần precondition như Bitmap)', () => {
    expect(() => s.validate(ctx({ elements: [] }))).not.toThrow();
  });

  it('encode phần tử text thành 1 lệnh TEXT tại y=0', () => {
    const ascii = asAscii(s.encode(ctx({ elements: [{ type: 'text', content: 'Xin chào', x: 0, y: 0 }] })));
    expect(ascii).toContain('TEXT 0,0,"3",0,1,1,"Xin chào"');
  });

  it('mỗi phần tử tiếp theo tăng y theo LINE_HEIGHT_DOTS', () => {
    const ascii = asAscii(
      s.encode(
        ctx({
          elements: [
            { type: 'text', content: 'Dòng 1', x: 0, y: 0 },
            { type: 'text', content: 'Dòng 2', x: 0, y: 0 },
          ],
        }),
      ),
    );
    expect(ascii).toContain('TEXT 0,0,"3"');
    expect(ascii).toContain('TEXT 0,24,"3"');
  });

  it('phần tử line thành 1 dòng gạch ngang đúng contentWidthChars', () => {
    const ascii = asAscii(s.encode(ctx({ elements: [{ type: 'line', x: 0, y: 0 }] })));
    expect(ascii).toContain(`"${'-'.repeat(48)}"`); // Mm80 → charsPerLine 48
  });

  it('phần tử row canh trái/phải qua formatRow', () => {
    const ascii = asAscii(s.encode(ctx({ elements: [{ type: 'row', left: 'Tổng', right: '10.000đ', x: 0, y: 0 }] })));
    expect(ascii).toContain('Tổng');
    expect(ascii).toContain('10.000đ');
  });

  it('phần tử table: mỗi row là 1 dòng TEXT riêng', () => {
    const ascii = asAscii(s.encode(ctx({ elements: [{ type: 'table', rows: [['a', 'b'], ['c', 'd']], x: 0, y: 0 }] })));
    expect(ascii).toContain('a  b');
    expect(ascii).toContain('c  d');
  });

  it('phần tử barcode gọi lệnh BARCODE native', () => {
    const ascii = asAscii(s.encode(ctx({ elements: [{ type: 'barcode', content: '123456', x: 0, y: 0 }] })));
    expect(ascii).toContain('BARCODE 0,0,"128",50,1,0,2,2,"123456"');
  });

  it('phần tử qrCode gọi lệnh QRCODE native', () => {
    const ascii = asAscii(s.encode(ctx({ elements: [{ type: 'qrCode', content: 'https://x', x: 0, y: 0 }] })));
    expect(ascii).toContain('QRCODE 0,0,H,4,A,0,"https://x"');
  });

  it('phần tử image ném TSPL_ELEMENT_UNSUPPORTED', () => {
    const run = () => s.encode(ctx({ elements: [{ type: 'image', data: 'x', x: 0, y: 0 }] }));
    expect(run).toThrow();
    try {
      run();
    } catch (e) {
      expect(e).toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED });
    }
  });

  it('encode kết thúc bằng PRINT rows,1', () => {
    expect(asAscii(s.encode(ctx({ elements: [] })))).toContain('PRINT 1,1');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- TsplTextStrategy.test.ts`
Expected: FAIL with "Cannot find module '../TsplTextStrategy'"

- [ ] **Step 4: Implement `TsplTextStrategy`**

```ts
// src/features/printer/drivers/tspl/strategies/TsplTextStrategy.ts
import type { ITsplPrintStrategy, TsplStrategyContext } from './tsplStrategy.types';
import { RenderMode } from '../../../models/printer/PrinterDriver';
import { PrinterErrorException, PrinterErrorCode } from '../../../errors/PrinterError';
import { TsplEncoder, contentWidthChars } from '../TsplEncoder';
import { resolveEffectiveCutterMode } from '../../../paper/cutter';
import { formatRow } from '../../../utils/formatRow';
import { LINE_HEIGHT_DOTS, BARCODE_HEIGHT_DOTS, QRCODE_HEIGHT_DOTS } from '../../../rendering/printLayoutConstants';

/**
 * Text mode TSPL — dùng font built-in `"3"` mặc định của máy in, KHÔNG tải
 * font, KHÔNG đổi CODEPAGE. Trên nhiều dòng máy font này chỉ có glyph ASCII
 * (xem comment `TsplEncoder.text()`) — chấp nhận giới hạn này, khác với
 * `TrueType`/`InternalFont` cũ (đã xoá) vốn cố sửa vấn đề này và có rủi ro
 * riêng. Không tự wrap dòng dài (spec §6) — mirror mức đơn giản của
 * `buildEscPosText` (ESC/POS Encoder).
 */
export class TsplTextStrategy implements ITsplPrintStrategy {
  readonly mode = RenderMode.Encoder;

  validate(): void {
    // Không có precondition — không cần ảnh như TsplBitmapStrategy.
  }

  encode(context: TsplStrategyContext): Uint8Array {
    const { documents, paper, printType, rows } = context;
    const encoder = new TsplEncoder().initialize(paper, printType);
    const charsPerLine = contentWidthChars(paper);
    let y = 0;

    for (const element of documents.text.elements) {
      switch (element.type) {
        case 'text':
          encoder.text(0, y, element.content);
          y += LINE_HEIGHT_DOTS;
          break;
        case 'line':
          encoder.text(0, y, '-'.repeat(charsPerLine));
          y += LINE_HEIGHT_DOTS;
          break;
        case 'row':
          encoder.text(0, y, formatRow(element.left, element.right, charsPerLine));
          y += LINE_HEIGHT_DOTS;
          break;
        case 'table':
          for (const row of element.rows) {
            encoder.text(0, y, row.join('  '));
            y += LINE_HEIGHT_DOTS;
          }
          break;
        case 'barcode':
          encoder.barcode(0, y, element.content);
          y += BARCODE_HEIGHT_DOTS;
          break;
        case 'qrCode':
          encoder.qrcode(0, y, element.content);
          y += QRCODE_HEIGHT_DOTS;
          break;
        case 'image':
          throw new PrinterErrorException({
            code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED,
            message: 'TSPL text mode không hỗ trợ phần tử image — dùng chế độ Bitmap.',
          });
      }
    }

    return encoder.cut(rows, resolveEffectiveCutterMode(paper)).encode();
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- TsplTextStrategy.test.ts`
Expected: PASS

- [ ] **Step 6: Wire the strategy switch into `TsplDriver`**

In `src/features/printer/drivers/tspl/TsplDriver.ts`:

Add the import (near the existing `TsplBitmapStrategy` import at line 9):

```ts
import { TsplTextStrategy } from './strategies/TsplTextStrategy';
```

Add `RenderMode` to the existing model import (currently `import { PrinterDriverType } from '../../models/printer/PrinterDriver';` at line 4):

```ts
import { PrinterDriverType, RenderMode } from '../../models/printer/PrinterDriver';
```

Add a second strategy instance next to the existing `const tsplBitmapStrategy = new TsplBitmapStrategy();` (line 34):

```ts
const tsplTextStrategy = new TsplTextStrategy();
```

Replace `buildBytes` (currently lines 167-179):

```ts
  /** Chọn strategy theo renderMode — y hệt cách EscPosDriver.sendDocuments() rẽ nhánh. */
  private buildBytes(printer: Printer, documents: PrintDocuments, rows: number): Uint8Array {
    const strategy = printer.driver.config.renderMode === RenderMode.Bitmap ? tsplBitmapStrategy : tsplTextStrategy;
    const context: TsplStrategyContext = {
      printer,
      documents,
      printType: printer.type,
      paper: printer.paper,
      rows,
    };

    strategy.validate(context);
    return strategy.encode(context);
  }
```

- [ ] **Step 7: Add a render-mode-switch test to `TsplDriver.test.ts`**

Read `src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts` first to match its existing mock/fixture setup exactly, then add (inside the existing `describe('TsplDriver', ...)` or top-level, matching the file's structure):

```ts
  it('renderMode Encoder gọi TsplTextStrategy (TEXT command), không cần documents.image', async () => {
    const p = makePrinter({ driver: makeTsplDriver({ config: { renderMode: RenderMode.Encoder } }) });
    // ... connect theo đúng pattern mock adapter đã có trong file, rồi:
    await driver.testPrint(p, { text: { elements: [{ type: 'text', content: 'hi', x: 0, y: 0 }] } });
    const written = /* byte cuối cùng adapter.write() nhận được, theo cách file test hiện tại assert */;
    const ascii = Array.from(written as Uint8Array).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('TEXT 0,0,"3",0,1,1,"hi"');
  });
```

(Adjust the mock-adapter wiring to match whatever pattern the existing file already uses for asserting `adapter.write()`'s argument — read the file's other `testPrint`/`print` test cases for the exact mock shape before writing this.)

- [ ] **Step 8: Run full driver test file**

Run: `npm test -- TsplDriver.test.ts`
Expected: PASS (existing Bitmap-mode tests unaffected, new Encoder-mode test passes)

- [ ] **Step 9: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/features/printer/rendering/printLayoutConstants.ts src/features/printer/drivers/tspl/strategies/TsplTextStrategy.ts src/features/printer/drivers/tspl/strategies/__tests__/TsplTextStrategy.test.ts src/features/printer/drivers/tspl/TsplDriver.ts src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts
git commit -m "feat(printer): add TsplTextStrategy, wire TsplDriver to pick strategy by renderMode"
```

**This closes out "TSPL text mode" end-to-end** — a TSPL printer can now be saved with `renderMode: Encoder` (Task 2 allows it) and prints via native `TEXT`/`BARCODE`/`QRCODE` commands (this task). The remaining tasks build the `Ast` bitmap source, independent of this.

---

### Task 4: Code128 barcode encoder

**Files:**
- Create: `src/features/printer/rendering/code128.ts`
- Test: `src/features/printer/rendering/__tests__/code128.test.ts`

**Interfaces:**
- Produces: `encodeCode128(content: string): { widths: number[]; totalModules: number }` — `widths` is the sequence of alternating bar/space module widths (starts with a bar), `totalModules` is their sum (needed by the caller to size the drawing area). Throws `PrinterErrorException({ code: PrinterErrorCode.INVALID_ARGUMENT, ... })` for characters outside Code Set B (ASCII 32-126).

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/printer/rendering/__tests__/code128.test.ts
import { encodeCode128 } from '../code128';

describe('encodeCode128', () => {
  it('starts with the Start-B pattern (211214) and ends with the Stop pattern (2331112)', () => {
    const { widths } = encodeCode128('A');
    expect(widths.slice(0, 6)).toEqual([2, 1, 1, 2, 1, 4]);
    expect(widths.slice(-7)).toEqual([2, 3, 3, 1, 1, 1, 2]);
  });

  it('encodes a single digit-only string with the correct checksum symbol', () => {
    // "1" → Start B(104) + code(49) → checksum = (104 + 49*1) % 103 = 50 → pattern for symbol 50
    const { widths } = encodeCode128('1');
    // Start(6) + data-for-"1"(6) + checksum(6) + stop(7) = 25 widths
    expect(widths).toHaveLength(6 + 6 + 6 + 7);
  });

  it('totalModules equals the sum of widths', () => {
    const { widths, totalModules } = encodeCode128('ORD-42');
    expect(totalModules).toBe(widths.reduce((sum, w) => sum + w, 0));
  });

  it('throws INVALID_ARGUMENT for a character outside ASCII 32-126', () => {
    expect(() => encodeCode128('Đơn')).toThrow();
  });

  it('throws INVALID_ARGUMENT for an empty string (Code128 needs at least one symbol)', () => {
    expect(() => encodeCode128('')).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- code128.test.ts`
Expected: FAIL with "Cannot find module '../code128'"

- [ ] **Step 3: Implement the encoder**

```ts
// src/features/printer/rendering/code128.ts
import { PrinterErrorException, PrinterErrorCode } from '../errors/PrinterError';

/**
 * Bảng tra pattern Code 128 Code-Set-B, chuẩn ISO/IEC 15417 — 103 symbol
 * (0-102) + Start A(103)/Start B(104)/Start C(105), mỗi symbol 6 chữ số độ
 * rộng module (bar,space,bar,space,bar,space); Stop(106) riêng, 7 chữ số.
 *
 * CHÉP LẠI TỪ TRÍ NHỚ — chưa đối chiếu với bản in ISO gốc. Bắt buộc verify
 * bằng máy quét mã vạch thật (điện thoại) trước khi coi tính năng này xong
 * (xem Task 4 Step cuối trong plan) — sai 1 symbol vẫn tạo ra ảnh "trông như
 * barcode" nhưng quét sai/không quét được, lỗi dạng này review code không
 * bắt được.
 */
const CODE128B_PATTERNS: number[][] = [
  [2, 1, 2, 2, 2, 2], [2, 2, 2, 1, 2, 2], [2, 2, 2, 2, 2, 1], [1, 2, 1, 2, 2, 3],
  [1, 2, 1, 3, 2, 2], [1, 3, 1, 2, 2, 2], [1, 2, 2, 2, 1, 3], [1, 2, 2, 3, 1, 2],
  [1, 3, 2, 2, 1, 2], [2, 2, 1, 2, 1, 3], [2, 2, 1, 3, 1, 2], [2, 3, 1, 2, 1, 2],
  [1, 1, 2, 2, 3, 2], [1, 2, 2, 1, 3, 2], [1, 2, 2, 2, 3, 1], [1, 1, 3, 2, 2, 2],
  [1, 2, 3, 1, 2, 2], [1, 2, 3, 2, 2, 1], [2, 2, 3, 2, 1, 1], [2, 2, 1, 1, 3, 2],
  [2, 2, 1, 2, 3, 1], [2, 1, 3, 2, 1, 2], [2, 2, 3, 1, 1, 2], [3, 1, 2, 1, 3, 1],
  [3, 1, 1, 2, 2, 2], [3, 2, 1, 1, 2, 2], [3, 2, 1, 2, 2, 1], [3, 1, 2, 2, 1, 2],
  [3, 2, 2, 1, 1, 2], [3, 2, 2, 2, 1, 1], [2, 1, 2, 1, 2, 3], [2, 1, 2, 3, 2, 1],
  [2, 3, 2, 1, 2, 1], [1, 1, 1, 3, 2, 3], [1, 3, 1, 1, 2, 3], [1, 3, 1, 3, 2, 1],
  [1, 1, 2, 3, 1, 3], [1, 3, 2, 1, 1, 3], [1, 3, 2, 3, 1, 1], [2, 1, 1, 3, 1, 3],
  [2, 3, 1, 1, 1, 3], [2, 3, 1, 3, 1, 1], [1, 1, 2, 1, 3, 3], [1, 1, 2, 3, 3, 1],
  [1, 3, 2, 1, 3, 1], [1, 1, 3, 1, 2, 3], [1, 1, 3, 3, 2, 1], [1, 3, 3, 1, 2, 1],
  [3, 1, 3, 1, 2, 1], [2, 1, 1, 3, 3, 1], [2, 3, 1, 1, 3, 1], [2, 1, 3, 1, 1, 3],
  [2, 1, 3, 3, 1, 1], [2, 1, 3, 1, 3, 1], [3, 1, 1, 1, 2, 3], [3, 1, 1, 3, 2, 1],
  [3, 3, 1, 1, 2, 1], [3, 1, 2, 1, 1, 3], [3, 1, 2, 3, 1, 1], [3, 3, 2, 1, 1, 1],
  [3, 1, 4, 1, 1, 1], [2, 2, 1, 4, 1, 1], [4, 3, 1, 1, 1, 1], [1, 1, 1, 2, 2, 4],
  [1, 1, 1, 4, 2, 2], [1, 2, 1, 1, 2, 4], [1, 2, 1, 4, 2, 1], [1, 4, 1, 1, 2, 2],
  [1, 4, 1, 2, 2, 1], [1, 1, 2, 2, 1, 4], [1, 1, 2, 4, 1, 2], [1, 2, 2, 1, 1, 4],
  [1, 2, 2, 4, 1, 1], [1, 4, 2, 1, 1, 2], [1, 4, 2, 2, 1, 1], [2, 4, 1, 2, 1, 1],
  [2, 2, 1, 1, 1, 4], [4, 1, 3, 1, 1, 1], [2, 4, 1, 1, 1, 2], [1, 3, 4, 1, 1, 1],
  [1, 1, 1, 2, 4, 2], [1, 2, 1, 1, 4, 2], [1, 2, 1, 2, 4, 1], [1, 1, 4, 2, 1, 2],
  [1, 2, 4, 1, 1, 2], [1, 2, 4, 2, 1, 1], [4, 1, 1, 2, 1, 2], [4, 2, 1, 1, 1, 2],
  [4, 2, 1, 2, 1, 1], [2, 1, 2, 1, 4, 1], [2, 1, 4, 1, 2, 1], [4, 1, 2, 1, 2, 1],
  [1, 1, 1, 1, 4, 3], [1, 1, 1, 3, 4, 1], [1, 3, 1, 1, 4, 1], [1, 1, 4, 1, 1, 3],
  [1, 1, 4, 3, 1, 1], [4, 1, 1, 1, 1, 3], [4, 1, 1, 3, 1, 1], [1, 1, 3, 1, 4, 1],
  [1, 1, 4, 1, 3, 1], [3, 1, 1, 1, 4, 1], [4, 1, 1, 1, 3, 1],
  [2, 1, 1, 4, 1, 2], [2, 1, 1, 2, 1, 4], [2, 1, 1, 2, 3, 2],
];

const START_B = 104;
const STOP_PATTERN = [2, 3, 3, 1, 1, 1, 2];

/**
 * Encode 1 chuỗi qua Code 128 Code Set B (ASCII 32-126 → code 0-94).
 * Trả về chuỗi độ rộng module bar/space (bắt đầu bằng bar) đã bao gồm
 * Start B + data + checksum + Stop, cùng tổng số module (để caller tự tính
 * bề rộng vẽ ra pixel: `totalModules * moduleWidthPx`).
 */
export const encodeCode128 = (content: string): { widths: number[]; totalModules: number } => {
  if (content.length === 0) {
    throw new PrinterErrorException({ code: PrinterErrorCode.INVALID_ARGUMENT, message: 'Nội dung barcode không được rỗng' });
  }

  const codes: number[] = [START_B];

  for (const char of content) {
    const codePoint = char.codePointAt(0) ?? -1;
    if (codePoint < 32 || codePoint > 126) {
      throw new PrinterErrorException({ code: PrinterErrorCode.INVALID_ARGUMENT, message: `Ký tự "${char}" không hỗ trợ trong Code128 Set B (cần ASCII 32-126)` });
    }
    codes.push(codePoint - 32);
  }

  let checksum = codes[0];
  for (let i = 1; i < codes.length; i += 1) {
    checksum += codes[i] * i;
  }
  codes.push(checksum % 103);

  const widths: number[] = [];
  for (const code of codes) {
    widths.push(...CODE128B_PATTERNS[code]);
  }
  widths.push(...STOP_PATTERN);

  return { widths, totalModules: widths.reduce((sum, w) => sum + w, 0) };
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- code128.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

- [ ] **Step 6: MANDATORY hardware verification (do not skip)**

This step cannot be automated — a wrong pattern in `CODE128B_PATTERNS` produces a barcode that looks structurally correct but decodes wrong or not at all.

1. Write a throwaway script (or a temporary Jest test) that calls `encodeCode128('TEST123')`, then renders the resulting `widths` as black/white bars into any image (a quick `<svg>` or even pixel-by-pixel in an image editor works — this does NOT need `renderDocumentToBitmap`, which doesn't exist until Task 7).
2. Open a barcode-scanner app on a phone (any free one) and scan the rendered image.
3. Confirm the decoded text is exactly `TEST123`.
4. Delete the throwaway script once confirmed. If it does not decode correctly, the entries in `CODE128B_PATTERNS` need correcting against a verified reference table (e.g. the table published on the Wikipedia "Code 128" article) before proceeding to Task 7.

- [ ] **Step 7: Commit**

```bash
git add src/features/printer/rendering/code128.ts src/features/printer/rendering/__tests__/code128.test.ts
git commit -m "feat(printer): add Code128 barcode encoder (hardware-verified against a real scanner)"
```

---

### Task 5: Install Skia + QR dependencies, establish the Jest mocking approach

**Files:**
- Modify: `package.json` (add `@shopify/react-native-skia`, `qrcode`, `@types/qrcode`)
- Modify: `jest.setup.js` (global mock for `@shopify/react-native-skia`, matching the existing pattern for `react-native-view-shot`)
- Create: `src/features/printer/rendering/renderDocumentToBitmap.ts` (skeleton — surface creation only, no element drawing yet)
- Test: `src/features/printer/rendering/__tests__/renderDocumentToBitmap.test.ts` (skeleton test proving the mock approach works)

**Interfaces:**
- Produces: `renderDocumentToBitmap(document: PrintDocument, media: PrintPaperConfig): Promise<string | null>` (signature only fleshed out enough to compile and return `null` on any element — Tasks 6-8 fill in real drawing).

**Why mock instead of real CanvasKit-in-Jest:** the spec's testing section proposed using `@shopify/react-native-skia`'s official Jest environment (`jestEnv`/`jestSetup`, confirmed to exist in the published package) to get real pixel output in tests. This project's existing test suite instead consistently mocks native-touching libraries globally in `jest.setup.js` (`react-native-view-shot`, `react-native-bluetooth-classic`, `react-native-tcp-socket`, `PrinterNativeModule`) and tests that call sites invoke them correctly — it never asserts on real native output. This task follows that established, lower-risk convention instead: mock `@shopify/react-native-skia` with a canvas double that **records every draw call**, and assert against the recorded calls. Real device/emulator testing (Step in Task 9's UI or manual QA) is what actually proves pixels look right.

- [ ] **Step 1: Install dependencies**

Run: `npm install @shopify/react-native-skia@^2.11.2 qrcode@^1.5.4`
Run: `npm install --save-dev @types/qrcode`

Then rebuild the native Android project once to confirm linking succeeds (this pulls in Skia's native binaries):

Run: `cd android && ./gradlew.bat :app:assembleDebug -q`
Expected: BUILD SUCCESSFUL (no Java/Gradle errors — this only proves native linking, not that the JS API is wired up yet).

- [ ] **Step 2: Add the global Jest mock**

In `jest.setup.js`, add after the existing `react-native-view-shot` mock block (after line 73):

```js
// @shopify/react-native-skia touches native bindings at import time.
// renderDocumentToBitmap.ts (and anything importing it, e.g. OrderPrintTrigger.ts)
// needs this mocked globally, same reasoning as react-native-view-shot above.
// The mock canvas RECORDS every draw call (`ops` array) instead of trying to
// render real pixels — dedicated tests assert against `ops`, matching this
// project's existing convention of testing "did we call the native API
// correctly" rather than "is the native output visually correct" (see
// renderDocumentToBitmap.test.ts for the fine-grained per-test override of
// this same mock).
jest.mock('@shopify/react-native-skia', () => {
  const makeRecordingCanvas = () => {
    const ops: unknown[] = [];
    return {
      ops,
      clear: (...args: unknown[]) => ops.push({ op: 'clear', args }),
      drawText: (...args: unknown[]) => ops.push({ op: 'drawText', args }),
      drawLine: (...args: unknown[]) => ops.push({ op: 'drawLine', args }),
      drawRect: (...args: unknown[]) => ops.push({ op: 'drawRect', args }),
      drawImage: (...args: unknown[]) => ops.push({ op: 'drawImage', args }),
    };
  };

  return {
    __esModule: true,
    Skia: {
      Surface: {
        MakeOffscreen: jest.fn((width, height) => {
          const canvas = makeRecordingCanvas();
          return {
            width: () => width,
            height: () => height,
            getCanvas: () => canvas,
            makeImageSnapshot: () => ({
              encodeToBytes: jest.fn(() => new Uint8Array([1, 2, 3])),
            }),
          };
        }),
      },
      Color: jest.fn((value: string) => value),
      Paint: jest.fn(() => ({ setColor: jest.fn(), setStrokeWidth: jest.fn() })),
      FontMgr: { System: jest.fn(() => ({ matchFamilyStyle: jest.fn(() => null) })) },
      Font: jest.fn(() => ({ measureText: jest.fn(() => ({ width: 0 })), getSize: jest.fn(() => 24) })),
    },
    ImageFormat: { PNG: 'png' },
  };
});
```

- [ ] **Step 3: Write the failing skeleton test**

```ts
// src/features/printer/rendering/__tests__/renderDocumentToBitmap.test.ts
import { renderDocumentToBitmap } from '../renderDocumentToBitmap';
import { Skia } from '@shopify/react-native-skia';
import type { PrintPaperConfig } from '../../models/paper/PrintPaperConfig';

const MEDIA: PrintPaperConfig = { type: 'Continuous', paperSize: 80 };

describe('renderDocumentToBitmap', () => {
  it('creates an offscreen surface sized to the paper width', async () => {
    await renderDocumentToBitmap({ elements: [] }, MEDIA);
    expect(Skia.Surface.MakeOffscreen).toHaveBeenCalledWith(576, expect.any(Number)); // Mm80 → imageWidthPx 576
  });

  it('returns a base64 string on success', async () => {
    const result = await renderDocumentToBitmap({ elements: [] }, MEDIA);
    expect(typeof result).toBe('string');
  });

  it('returns null if Surface.MakeOffscreen returns null (native failure)', async () => {
    (Skia.Surface.MakeOffscreen as jest.Mock).mockReturnValueOnce(null);
    expect(await renderDocumentToBitmap({ elements: [] }, MEDIA)).toBeNull();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm test -- renderDocumentToBitmap.test.ts`
Expected: FAIL with "Cannot find module '../renderDocumentToBitmap'"

- [ ] **Step 5: Implement the skeleton**

```ts
// src/features/printer/rendering/renderDocumentToBitmap.ts
import { Skia, ImageFormat } from '@shopify/react-native-skia';
import type { PrintDocument } from '../models/printing/PrintDocument';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { PrintPaperType } from '../models/paper/PrintPaperConfig';
import { PAPER_SIZE_SPECS, DOTS_PER_MM } from '../paper/paperSpec';
import { LINE_HEIGHT_DOTS as LINE_HEIGHT_PX } from './printLayoutConstants';

/** Kiểu canvas Skia thật, suy ra từ chính API đang dùng — Task 7/8 tái dùng type này cho các hàm vẽ phụ trợ (drawBarcode/drawQrCode), không định nghĩa lại. */
type SkiaSurface = ReturnType<typeof Skia.Surface.MakeOffscreen>;
export type SkiaCanvas = ReturnType<NonNullable<SkiaSurface>['getCanvas']>;

/** Cùng logic đo bề rộng với `useBillImageCapture.tsx` — die-cut theo itemWidthMm, còn lại theo khổ giấy. */
const resolveWidthPx = (media: PrintPaperConfig): number =>
  media.type === PrintPaperType.DieCut ? (media.itemWidthMm ?? 0) * DOTS_PER_MM : PAPER_SIZE_SPECS[media.paperSize].imageWidthPx;

/**
 * Đếm số dòng sẽ vẽ (không wrap — spec §6, mỗi phần tử/mỗi row trong table là
 * đúng 1 dòng) để tính chiều cao surface TRƯỚC khi tạo — Skia cần size cố
 * định ngay lúc tạo, khác `View` tự cao theo nội dung.
 */
const estimateHeightPx = (document: PrintDocument): number => {
  let lines = 0;
  for (const element of document.elements) {
    if (element.type === 'table') {
      lines += element.rows.length;
    } else {
      lines += 1;
    }
  }
  return Math.max(LINE_HEIGHT_PX, lines * LINE_HEIGHT_PX);
};

/**
 * Vẽ trực tiếp `PrintDocument.elements[]` lên canvas Skia off-screen — không
 * mount `View`, không phụ thuộc `onLayout`/`devicePixelRatio` như
 * `useBillImageCapture`. Cùng contract `(document, media) => base64 PNG |
 * null` với `CaptureBillImage` — nơi gọi (`OrderPrintTrigger`) chọn 1 trong 2
 * theo `bitmapSource`, driver không biết/không cần biết khác biệt này.
 */
export const renderDocumentToBitmap = async (document: PrintDocument, media: PrintPaperConfig): Promise<string | null> => {
  try {
    const widthPx = resolveWidthPx(media);
    const heightPx = estimateHeightPx(document);
    const surface = Skia.Surface.MakeOffscreen(widthPx, heightPx);

    if (!surface) {
      return null;
    }

    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('white'));

    // Tasks 6-8 điền phần vẽ từng loại element vào đây.

    const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG);
    return Buffer.from(bytes).toString('base64');
  } catch {
    return null;
  }
};
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test -- renderDocumentToBitmap.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full test suite to confirm the global mock doesn't break anything else**

Run: `npm test`
Expected: PASS (all existing suites green, plus the 2 new ones)

- [ ] **Step 8: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json jest.setup.js src/features/printer/rendering/renderDocumentToBitmap.ts src/features/printer/rendering/__tests__/renderDocumentToBitmap.test.ts
git commit -m "feat(printer): add react-native-skia + qrcode deps, skeleton renderDocumentToBitmap"
```

---

### Task 6: `renderDocumentToBitmap` — text/line/row/table elements

**Files:**
- Modify: `src/features/printer/rendering/renderDocumentToBitmap.ts`
- Modify: `src/features/printer/rendering/__tests__/renderDocumentToBitmap.test.ts`

**Interfaces:**
- Consumes: `formatRow` (`../utils/formatRow`) — same util TSPL/ESC/POS text builders already use.

- [ ] **Step 1: Add failing tests for each element type**

Append to `renderDocumentToBitmap.test.ts`:

```ts
  it('draws a text element via canvas.drawText at the running y offset', async () => {
    await renderDocumentToBitmap({ elements: [{ type: 'text', content: 'Xin chào', x: 0, y: 0 }] }, MEDIA);
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const drawTextCall = surface.getCanvas().ops.find((o: { op: string }) => o.op === 'drawText');
    expect(drawTextCall.args[0]).toBe('Xin chào');
  });

  it('draws a line element via canvas.drawLine spanning the full width', async () => {
    await renderDocumentToBitmap({ elements: [{ type: 'line', x: 0, y: 0 }] }, MEDIA);
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const drawLineCall = surface.getCanvas().ops.find((o: { op: string }) => o.op === 'drawLine');
    expect(drawLineCall.args[2]).toBe(576); // x1 = widthPx cho Mm80
  });

  it('draws a row element as two drawText calls (left + right)', async () => {
    await renderDocumentToBitmap({ elements: [{ type: 'row', left: 'Tổng', right: '10.000đ', x: 0, y: 0 }] }, MEDIA);
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const drawTextCalls = surface.getCanvas().ops.filter((o: { op: string }) => o.op === 'drawText');
    expect(drawTextCalls.map((c: { args: unknown[] }) => c.args[0])).toEqual(['Tổng', '10.000đ']);
  });

  it('draws each table row as its own drawText call', async () => {
    await renderDocumentToBitmap({ elements: [{ type: 'table', rows: [['a', 'b'], ['c', 'd']], x: 0, y: 0 }] }, MEDIA);
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const drawTextCalls = surface.getCanvas().ops.filter((o: { op: string }) => o.op === 'drawText');
    expect(drawTextCalls.map((c: { args: unknown[] }) => c.args[0])).toEqual(['a  b', 'c  d']);
  });

  it('sizes the surface height to the number of lines (2 lines → 2 * LINE_HEIGHT_PX, min 1 line)', async () => {
    await renderDocumentToBitmap(
      { elements: [{ type: 'text', content: 'a', x: 0, y: 0 }, { type: 'text', content: 'b', x: 0, y: 0 }] },
      MEDIA,
    );
    expect(Skia.Surface.MakeOffscreen).toHaveBeenCalledWith(576, 48);
  });
```

- [ ] **Step 2: Run to verify these fail**

Run: `npm test -- renderDocumentToBitmap.test.ts`
Expected: FAIL — no drawing happens yet, `ops` arrays are empty.

- [ ] **Step 3: Implement drawing for these 4 element types**

Replace the `// Tasks 6-8 điền phần vẽ...` comment in `renderDocumentToBitmap.ts` with:

```ts
    const font = Skia.Font(); // font hệ thống mặc định — đủ dấu tiếng Việt (Roboto trên Android), xem spec §5(b)
    const paint = Skia.Paint();
    let y = LINE_HEIGHT_PX;

    for (const element of document.elements) {
      switch (element.type) {
        case 'text':
          canvas.drawText(element.content, 0, y, paint, font);
          y += LINE_HEIGHT_PX;
          break;
        case 'line':
          canvas.drawLine(0, y, widthPx, y, paint);
          y += LINE_HEIGHT_PX;
          break;
        case 'row': {
          const rightWidth = font.measureText(element.right).width;
          canvas.drawText(element.left, 0, y, paint, font);
          canvas.drawText(element.right, widthPx - rightWidth, y, paint, font);
          y += LINE_HEIGHT_PX;
          break;
        }
        case 'table':
          for (const row of element.rows) {
            canvas.drawText(row.join('  '), 0, y, paint, font);
            y += LINE_HEIGHT_PX;
          }
          break;
        case 'barcode':
        case 'qrCode':
        case 'image':
          // Task 7 (barcode), Task 8 (qrCode). image: chưa xử lý (spec §5 — chưa từng phát sinh trong thực tế).
          break;
      }
    }
```

Also update `estimateHeightPx` — it already counts `table` rows correctly and everything else as 1 line, which matches this drawing loop's line advances exactly (no change needed there, but double check `barcode`/`qrCode` don't get counted as 1-line yet since Tasks 7-8 change their height — leave as-is for this task, Task 7/8 will adjust `estimateHeightPx` for those two cases).

- [ ] **Step 4: Run to verify tests pass**

Run: `npm test -- renderDocumentToBitmap.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/rendering/renderDocumentToBitmap.ts src/features/printer/rendering/__tests__/renderDocumentToBitmap.test.ts
git commit -m "feat(printer): draw text/line/row/table elements in renderDocumentToBitmap"
```

---

### Task 7: `renderDocumentToBitmap` — barcode drawing

**Files:**
- Modify: `src/features/printer/rendering/renderDocumentToBitmap.ts`
- Modify: `src/features/printer/rendering/__tests__/renderDocumentToBitmap.test.ts`

**Interfaces:**
- Consumes: `encodeCode128` from Task 4 (`./code128`), `BARCODE_HEIGHT_DOTS` from `./printLayoutConstants` (reused as px).

- [ ] **Step 1: Write the failing test**

```ts
  it('draws a barcode as a series of drawRect calls whose count matches the encoded bar count', async () => {
    await renderDocumentToBitmap({ elements: [{ type: 'barcode', content: 'AB', x: 0, y: 0 }] }, MEDIA);
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const rectCalls = surface.getCanvas().ops.filter((o: { op: string }) => o.op === 'drawRect');
    // encodeCode128('AB').widths has 6(start)+6+6+6(checksum)+7(stop) = 31 widths, odd indices (0,2,4,...) are bars
    expect(rectCalls.length).toBeGreaterThan(0);
    expect(rectCalls.length % 2).toBe(0); // (widths.length is even count of bar+space pairs before stop's extra bar) — assert exact count instead:
  });

  it('barcode advances y by BARCODE_HEIGHT_DOTS, not LINE_HEIGHT_PX', async () => {
    await renderDocumentToBitmap(
      { elements: [{ type: 'barcode', content: 'A', x: 0, y: 0 }, { type: 'text', content: 'after', x: 0, y: 0 }] },
      MEDIA,
    );
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const drawTextCall = surface.getCanvas().ops.find((o: { op: string }) => o.op === 'drawText');
    expect(drawTextCall.args[2]).toBe(LINE_HEIGHT_PX + BARCODE_HEIGHT_DOTS); // y của "after"
  });
```

Import `LINE_HEIGHT_DOTS as LINE_HEIGHT_PX, BARCODE_HEIGHT_DOTS` from `../printLayoutConstants` at the top of the test file.

(Replace the first test's vague `rectCalls.length % 2` assertion once you know the real bar-only count: `encodeCode128('AB').widths` has an ODD number of entries per symbol group but bars are every OTHER width starting at index 0 — simplest correct assertion: `expect(rectCalls.length).toBe(Math.ceil(encodeCode128('AB').widths.length / 2))`. Import `encodeCode128` in the test to compute the expected count directly rather than hardcoding a number.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- renderDocumentToBitmap.test.ts`
Expected: FAIL — barcode case currently does nothing.

- [ ] **Step 3: Implement barcode drawing**

Add the import at the top of `renderDocumentToBitmap.ts` (`SkiaCanvas` is the type alias already defined in Task 5's skeleton, exported from this same file — no new type needed here):

```ts
import { encodeCode128 } from './code128';
import { BARCODE_HEIGHT_DOTS as BARCODE_HEIGHT_PX } from './printLayoutConstants';
```

Add a helper function above `renderDocumentToBitmap`:

```ts
/**
 * Vẽ barcode bằng cách đi qua từng độ rộng module trong `widths` (bar, space,
 * bar, space, ...) — chỉ index CHẴN (0, 2, 4, ...) là bar (đen), index lẻ là
 * space (bỏ qua, không vẽ). `moduleWidthPx = 2` — độ rộng 1 module tối thiểu,
 * đủ để barcode fit trong khổ giấy phổ biến (chưa wrap — spec §6, tràn thì
 * chấp nhận).
 */
const MODULE_WIDTH_PX = 2;

const drawBarcode = (canvas: SkiaCanvas, content: string, x: number, y: number, paint: ReturnType<typeof Skia.Paint>): void => {
  const { widths } = encodeCode128(content);
  let cursor = x;

  widths.forEach((width, index) => {
    const barWidthPx = width * MODULE_WIDTH_PX;
    if (index % 2 === 0) {
      canvas.drawRect({ x: cursor, y, width: barWidthPx, height: BARCODE_HEIGHT_PX - 10 }, paint);
    }
    cursor += barWidthPx;
  });
};
```

In the main drawing loop, replace the `case 'barcode':` branch (currently falling through to the shared no-op with `qrCode`/`image`):

```ts
        case 'barcode':
          drawBarcode(canvas, element.content, 0, y, paint);
          y += BARCODE_HEIGHT_PX;
          break;
        case 'qrCode':
        case 'image':
          // Task 8 (qrCode). image: chưa xử lý (spec §5).
          break;
```

Update `estimateHeightPx` to account for barcode's taller height:

```ts
const estimateHeightPx = (document: PrintDocument): number => {
  let height = 0;
  for (const element of document.elements) {
    if (element.type === 'table') {
      height += element.rows.length * LINE_HEIGHT_PX;
    } else if (element.type === 'barcode') {
      height += BARCODE_HEIGHT_PX;
    } else {
      height += LINE_HEIGHT_PX;
    }
  }
  return Math.max(LINE_HEIGHT_PX, height);
};
```

(This changes the height calculation from "count lines then multiply" to "accumulate directly" — update the Task 6 test `'sizes the surface height to the number of lines...'` if its exact expected number no longer matches; recompute by hand: 2 text elements × `LINE_HEIGHT_PX` (24) = 48, unchanged.)

- [ ] **Step 4: Run to verify tests pass**

Run: `npm test -- renderDocumentToBitmap.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/rendering/renderDocumentToBitmap.ts src/features/printer/rendering/__tests__/renderDocumentToBitmap.test.ts
git commit -m "feat(printer): draw barcode elements in renderDocumentToBitmap via Code128 encoder"
```

---

### Task 8: `renderDocumentToBitmap` — QR code drawing

**Files:**
- Modify: `src/features/printer/rendering/renderDocumentToBitmap.ts`
- Modify: `src/features/printer/rendering/__tests__/renderDocumentToBitmap.test.ts`
- Modify: `jest.setup.js` (mock `qrcode` — it does synchronous filesystem-adjacent work in Node that isn't relevant in RN; mock keeps tests deterministic and fast)

**Interfaces:**
- Consumes: `qrcode` npm package's `create(content).modules` (a `{ size: number; data: Uint8Array }`-shaped `BitMatrix` — 1 byte per module, non-zero = dark), `QRCODE_HEIGHT_DOTS` (reused as px).

- [ ] **Step 1: Add the `qrcode` mock to `jest.setup.js`**

```js
// qrcode does synchronous QR-matrix math with no native dependency — mocked
// here only for deterministic, fast tests (drawQrCode.test.ts overrides
// locally with a tiny real matrix when it needs to assert actual pixel
// placement; other tests just need `create()` to not throw).
jest.mock('qrcode', () => ({
  create: jest.fn(() => ({ modules: { size: 1, data: new Uint8Array([1]) } })),
}));
```

- [ ] **Step 2: Write the failing test**

```ts
  it('draws a qrCode as a grid of drawRect calls matching the module matrix size', async () => {
    const qrcode = require('qrcode');
    (qrcode.create as jest.Mock).mockReturnValueOnce({ modules: { size: 2, data: new Uint8Array([1, 0, 0, 1]) } });
    await renderDocumentToBitmap({ elements: [{ type: 'qrCode', content: 'https://x', x: 0, y: 0 }] }, MEDIA);
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const rectCalls = surface.getCanvas().ops.filter((o: { op: string }) => o.op === 'drawRect');
    expect(rectCalls).toHaveLength(2); // chỉ 2 module "dark" (data[0]=1, data[3]=1) được vẽ, module 0 bị bỏ qua
  });

  it('qrCode advances y by QRCODE_HEIGHT_DOTS', async () => {
    await renderDocumentToBitmap(
      { elements: [{ type: 'qrCode', content: 'x', x: 0, y: 0 }, { type: 'text', content: 'after', x: 0, y: 0 }] },
      MEDIA,
    );
    const surface = (Skia.Surface.MakeOffscreen as jest.Mock).mock.results[0].value;
    const drawTextCall = surface.getCanvas().ops.find((o: { op: string }) => o.op === 'drawText');
    expect(drawTextCall.args[2]).toBe(LINE_HEIGHT_PX + QRCODE_HEIGHT_DOTS);
  });
```

Import `QRCODE_HEIGHT_DOTS` alongside the other constants already imported in the test file.

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- renderDocumentToBitmap.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement QR drawing**

Add imports to `renderDocumentToBitmap.ts`:

```ts
import { create as createQrCode } from 'qrcode';
import { QRCODE_HEIGHT_DOTS as QRCODE_HEIGHT_PX } from './printLayoutConstants';
```

Add a helper:

```ts
/** Mỗi module QR vẽ thành 1 ô vuông `QR_MODULE_PX` cạnh — cell size cố định, không co giãn theo version QR (v1, chấp nhận tràn nếu QR lớn — spec §6/§9). */
const QR_MODULE_PX = 4;

const drawQrCode = (canvas: SkiaCanvas, content: string, x: number, y: number, paint: ReturnType<typeof Skia.Paint>): void => {
  const { modules } = createQrCode(content);
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.data[row * modules.size + col] === 0) {
        continue;
      }
      canvas.drawRect({ x: x + col * QR_MODULE_PX, y: y + row * QR_MODULE_PX, width: QR_MODULE_PX, height: QR_MODULE_PX }, paint);
    }
  }
};
```

(`SkiaCanvas` is already in scope — it's the type alias defined earlier in this same file, `renderDocumentToBitmap.ts`, back in Task 5's skeleton and reused by `drawBarcode` in Task 7. No new import needed.)

Replace the `case 'qrCode':` branch:

```ts
        case 'qrCode':
          drawQrCode(canvas, element.content, 0, y, paint);
          y += QRCODE_HEIGHT_PX;
          break;
        case 'image':
          // Chưa xử lý (spec §5 — chưa từng phát sinh trong thực tế).
          break;
```

Update `estimateHeightPx` once more to add the `qrCode` branch:

```ts
    } else if (element.type === 'barcode') {
      height += BARCODE_HEIGHT_PX;
    } else if (element.type === 'qrCode') {
      height += QRCODE_HEIGHT_PX;
    } else {
```

- [ ] **Step 5: Run to verify tests pass**

Run: `npm test -- renderDocumentToBitmap.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full suite + type-check + lint**

Run: `npm run verify`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/printer/rendering/renderDocumentToBitmap.ts src/features/printer/rendering/__tests__/renderDocumentToBitmap.test.ts jest.setup.js
git commit -m "feat(printer): draw qrCode elements in renderDocumentToBitmap via qrcode lib"
```

**`renderDocumentToBitmap` is now feature-complete** (text/line/row/table/barcode/qrCode; `image` intentionally unhandled per spec §5/§9).

---

### Task 9: UI — `DriverRenderModeSection` + `bitmapSource` persistence

**Files:**
- Modify: `src/features/printer/components/DriverRenderModeSection.tsx`
- Modify: `src/features/printer/hooks/addPrinter/useDriverConfig.ts`
- Modify: `src/features/printer/management/PrinterConfigService.ts`

**Interfaces:**
- Consumes: `BitmapSource` (Task 1).
- Produces: `PrinterConfigService.setBitmapSource(printerId: string, bitmapSource: BitmapSource): void`. `DriverRenderModeSectionProps` gains `onSelectBitmapSource: (source: BitmapSource) => void`.

- [ ] **Step 1: Add `setBitmapSource` to `PrinterConfigService`**

In `src/features/printer/management/PrinterConfigService.ts`, add `BitmapSource` to the existing import:

```ts
import { RenderMode, BitmapSource } from '../models/printer/PrinterDriver';
```

Add the new setter right after `setRenderMode` (mirrors it exactly):

```ts
  const setBitmapSource = (printerId: string, bitmapSource: BitmapSource): void => {
    const printer = repository.getPrinters().find((p) => p.id === printerId);

    if (!printer) {
      return;
    }

    repository.savePrinters(
      repository.getPrinters().map((p) => (p.id !== printerId ? p : { ...p, driver: { ...p.driver, config: { ...p.driver.config, bitmapSource } } })),
    );
  };
```

Add it to the returned object:

```ts
  return { setRenderMode, setBitmapSource, setPaper };
```

- [ ] **Step 2: Update `DriverRenderModeSection.tsx`**

Full replacement:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppSelect } from '../../../components/AppSelect';
import { RenderMode, BitmapSource, PrinterDriverType } from '../models/printer/PrinterDriver';
import type { PrinterDriver } from '../models/printer/PrinterDriver';

const escPosRenderModeLabel: Record<RenderMode, string> = {
  Encoder: 'Văn bản (nhanh, cần đúng codepage)',
  Bitmap: 'Bitmap (chậm hơn, đúng mọi máy)',
};

const tsplRenderModeLabel: Record<RenderMode, string> = {
  Encoder: 'Text (font mặc định máy in — có thể không hiện dấu tiếng Việt trên một số máy)',
  Bitmap: 'Bitmap (chậm hơn, đúng mọi máy kể cả tiếng Việt)',
};

const renderModeLabelFor = (driverType: PrinterDriverType): Record<RenderMode, string> =>
  driverType === PrinterDriverType.EscPos ? escPosRenderModeLabel : tsplRenderModeLabel;

const renderModeOptionsFor = (driverType: PrinterDriverType) => {
  const labels = renderModeLabelFor(driverType);
  return [RenderMode.Encoder, RenderMode.Bitmap].map((mode) => ({ label: labels[mode], value: mode }));
};

const bitmapSourceLabel: Record<BitmapSource, string> = {
  Image: 'Chụp giao diện',
  Ast: 'Vẽ trực tiếp',
};

const bitmapSourceOptions = [BitmapSource.Image, BitmapSource.Ast].map((source) => ({ label: bitmapSourceLabel[source], value: source }));

interface DriverRenderModeSectionProps {
  driver: PrinterDriver;
  disabled: boolean;
  onSelectRenderMode: (mode: RenderMode) => void;
  onSelectBitmapSource: (source: BitmapSource) => void;
}

/** Cả ESC/POS và TSPL đều chọn được renderMode. Selector "Nguồn ảnh bitmap" chỉ hiện khi renderMode === Bitmap. */
export const DriverRenderModeSection: React.FC<DriverRenderModeSectionProps> = ({ driver, disabled, onSelectRenderMode, onSelectBitmapSource }) => (
  <View style={styles.renderModeBlock}>
    <AppSelect
      label="Chế độ in"
      value={driver.config.renderMode}
      onSelect={(value) => onSelectRenderMode(value as RenderMode)}
      options={renderModeOptionsFor(driver.type)}
      disabled={disabled}
    />
    {driver.config.renderMode === RenderMode.Bitmap ? (
      <AppSelect
        label="Nguồn ảnh bitmap"
        value={driver.config.bitmapSource ?? BitmapSource.Image}
        onSelect={(value) => onSelectBitmapSource(value as BitmapSource)}
        options={bitmapSourceOptions}
        disabled={disabled}
      />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  renderModeBlock: { gap: 8 },
});
```

- [ ] **Step 3: Update `useDriverConfig.ts`**

In `src/features/printer/hooks/addPrinter/useDriverConfig.ts`, add `BitmapSource` to the import:

```ts
import { RenderMode, BitmapSource } from '../../models/printer/PrinterDriver';
```

Add the new handler right after `onSelectRenderMode`:

```ts
  const onSelectBitmapSource = (bitmapSource: BitmapSource): void => {
    if (!driver) {
      return;
    }

    setDriver({ ...driver, config: { ...driver.config, bitmapSource } });
    PrinterConfigService.setBitmapSource(printerId, bitmapSource);
  };
```

Add it to the returned object:

```ts
  return { onSelectRenderMode, onSelectBitmapSource, onChangePaper };
```

- [ ] **Step 4: Wire the new prop through `PrinterInfoCard.tsx` and `useAddPrinterFlow.ts`**

In `src/features/printer/components/PrinterInfoCard.tsx`, add `onSelectBitmapSource: (source: BitmapSource) => void;` to `PrinterInfoCardProps` (near the existing `onSelectRenderMode` line), destructure it in the component's props, and pass it through:

```tsx
{driver ? <DriverRenderModeSection driver={driver} disabled={locked} onSelectRenderMode={onSelectRenderMode} onSelectBitmapSource={onSelectBitmapSource} /> : null}
```

Add the `BitmapSource` type import at the top of the file (alongside the existing `RenderMode` import from `../models/printer/PrinterDriver`).

In `src/features/printer/hooks/useAddPrinterFlow.ts`, add to the `infoCard` object returned at the end (near `onSelectRenderMode: driverConfig.onSelectRenderMode,`):

```ts
      onSelectBitmapSource: driverConfig.onSelectBitmapSource,
```

- [ ] **Step 5: Type-check and lint (no dedicated test file for these UI components — matches repo convention)**

Run: `npm run type-check && npm run lint`
Expected: PASS

- [ ] **Step 6: Manual verification on device/emulator**

Run: `npm run android` (or use whatever device the developer normally tests with)

1. Open "Thêm máy in", select a TSPL printer, complete discovery/connect.
2. Open "Cài đặt nâng cao" — confirm the render-mode selector now appears for TSPL too, with the TSPL-specific labels.
3. Select `Bitmap` — confirm the "Nguồn ảnh bitmap" selector appears with `Chụp giao diện`/`Vẽ trực tiếp` options.
4. Select `Encoder` — confirm the second selector disappears.
5. Repeat for an ESC/POS printer — confirm its existing labels are unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/features/printer/components/DriverRenderModeSection.tsx src/features/printer/hooks/addPrinter/useDriverConfig.ts src/features/printer/management/PrinterConfigService.ts src/features/printer/components/PrinterInfoCard.tsx src/features/printer/hooks/useAddPrinterFlow.ts
git commit -m "feat(printer): show renderMode selector for TSPL, add bitmapSource selector to UI"
```

---

### Task 10: Orchestration wiring — `PrintService` + `OrderPrintTrigger`

**Files:**
- Modify: `src/features/printer/printing/PrintService.ts`
- Modify: `src/features/cart/services/OrderPrintTrigger.ts`
- Modify: `src/features/printer/printing/__tests__/PrintService.test.ts:97-137`
- Modify: `src/features/cart/services/__tests__/OrderPrintTrigger.test.ts:129-196`

**Interfaces:**
- Consumes: `renderDocumentToBitmap` (Task 8, `../../printer/rendering/renderDocumentToBitmap`), `BitmapSource` (Task 1).
- Produces: `PrintService.imageDocumentTarget(printType: PrintType): { paper: PrintPaperConfig; bitmapSource: BitmapSource } | null` (renamed from `imageDocumentMedia`, changed return shape).

- [ ] **Step 1: Update `PrintService.test.ts`'s `imageDocumentMedia` describe block**

Replace the entire `describe('PrintService.imageDocumentMedia', ...)` block (lines 97-137) with:

```ts
describe('PrintService.imageDocumentTarget', () => {
  it('returns null when the only target uses escpos in encoder mode', () => {
    const deps = makeDeps([makePrinter({ id: 'p1' })], () => {
      throw new Error('unused');
    });
    expect(createPrintService(deps).imageDocumentTarget(PrintType.Receipt)).toBeNull();
  });

  it('returns the paper + Image bitmapSource default when the target has no bitmapSource set', () => {
    const p1 = makePrinter({
      id: 'p1',
      driver: makeEscPosDriver({ config: { renderMode: RenderMode.Bitmap } }),
      paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm58 },
    });
    const deps = makeDeps([p1], () => {
      throw new Error('unused');
    });
    expect(createPrintService(deps).imageDocumentTarget(PrintType.Receipt)).toEqual({ paper: p1.paper, bitmapSource: BitmapSource.Image });
  });

  it('returns the target driver config bitmapSource when explicitly set to Ast', () => {
    const p1 = makePrinter({
      id: 'p1',
      driver: makeTsplDriver({ config: { renderMode: RenderMode.Bitmap, bitmapSource: BitmapSource.Ast } }),
      paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm58 },
    });
    const deps = makeDeps([p1], () => {
      throw new Error('unused');
    });
    expect(createPrintService(deps).imageDocumentTarget(PrintType.Receipt)).toEqual({ paper: p1.paper, bitmapSource: BitmapSource.Ast });
  });

  it('returns the bitmap target when a mix of encoder and bitmap targets both resolve the same printType', () => {
    const p1 = makePrinter({ id: 'p1', driver: makeEscPosDriver() });
    const p2 = makePrinter({ id: 'p2', driver: makeTsplDriver(), paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm80 } });
    const deps = makeDeps([p1, p2], () => {
      throw new Error('unused');
    });
    expect(createPrintService(deps).imageDocumentTarget(PrintType.Receipt)).toEqual({ paper: p2.paper, bitmapSource: BitmapSource.Image });
  });

  it('the real exported PrintService singleton has no configured printers by default, so it returns null', () => {
    expect(PrintService.imageDocumentTarget(PrintType.Receipt)).toBeNull();
  });
});
```

Add `BitmapSource` to the existing `RenderMode` import at the top of the test file:

```ts
import { RenderMode, BitmapSource } from '../../models/printer/PrinterDriver';
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- PrintService.test.ts`
Expected: FAIL — `imageDocumentTarget` doesn't exist yet (`imageDocumentMedia` is still the exported name).

- [ ] **Step 3: Rename and change the return shape in `PrintService.ts`**

Add `BitmapSource` to the existing `PrinterDriver` model import in `PrintService.ts` (currently only `usesBitmapRenderMode` is imported from `../drivers/driverConfig` — add a new import line):

```ts
import { BitmapSource } from '../models/printer/PrinterDriver';
```

Replace `imageDocumentMedia` (lines 33-43):

```ts
  /**
   * Target (paper + bitmapSource) cần để render ảnh cho `printType` này, hoặc
   * `null` nếu không có target nào (TSPL hoặc ESC/POS) đang cấu hình
   * `renderMode: 'Bitmap'`. Nơi gọi (`OrderPrintTrigger`) chỉ nên tốn chi phí
   * capture khi có giá trị trả về — capture theo `paper` để máy die-cut chụp
   * đúng bề rộng tem (`itemWidthMm`) thay vì bề rộng giấy đầy đủ.
   */
  const imageDocumentTarget = (printType: PrintType): { paper: PrintPaperConfig; bitmapSource: BitmapSource } | null => {
    const target = deps.routing.resolveTargets(printType).find((printer) => usesBitmapRenderMode(printer.driver));
    return target ? { paper: target.paper, bitmapSource: target.driver.config.bitmapSource ?? BitmapSource.Image } : null;
  };
```

Update the final `return` statement (currently `return { print, imageDocumentMedia };`):

```ts
  return { print, imageDocumentTarget };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- PrintService.test.ts`
Expected: PASS

- [ ] **Step 5: Update `OrderPrintTrigger.ts` to pick the right image producer**

Add imports at the top of `OrderPrintTrigger.ts`:

```ts
import { renderDocumentToBitmap } from '../../printer/rendering/renderDocumentToBitmap';
import { BitmapSource } from '../../printer/models/printer/PrinterDriver';
```

Replace `buildPrintDocumentVariants` (lines 174-184):

```ts
/**
 * Chỉ render + tạo ảnh khi thật sự có máy in bitmap-mode được gán cho
 * `printType` (`PrintService.imageDocumentTarget`) — tạo ảnh tốn chi phí,
 * không làm nếu không có máy nào cần tới. Chọn đúng hàm sinh ảnh theo
 * `bitmapSource` của target đã resolve — `Ast` dùng `renderDocumentToBitmap`
 * (hàm thuần, không cần React tree), `Image` dùng `captureBillImage` (hook,
 * cần `captureNode` đã mount). Cả 2 gán vào CÙNG field `documents.image` —
 * driver không biết/không cần biết nguồn nào tạo ra ảnh.
 *
 * Capture/render thất bại (trả `null`) → gửi `text`-only cho MỌI target;
 * target nào thật sự cần ảnh (TSPL/ESC/POS bitmap) sẽ tự thất bại rõ ràng ở
 * `TsplBitmapStrategy.validate()`/`EscPosDriver.sendBitmap()` (`IMAGE_REQUIRED`)
 * thay vì âm thầm in sai — các target khác (Encoder mode) không cần ảnh nên
 * vẫn in bình thường.
 */
const buildPrintDocumentVariants = async (
  printType: PrintType,
  textDocument: PrintDocument,
  captureBillImage: CaptureBillImage,
): Promise<PrintDocuments> => {
  const target = PrintService.imageDocumentTarget(printType);
  if (!target) return { text: textDocument };
  const base64 =
    target.bitmapSource === BitmapSource.Ast
      ? await renderDocumentToBitmap(textDocument, target.paper)
      : await captureBillImage(textDocument, target.paper);
  if (!base64) return { text: textDocument };
  return { text: textDocument, image: base64 };
};
```

- [ ] **Step 6: Update `OrderPrintTrigger.test.ts`**

Rename every `PrintService.imageDocumentMedia` mock reference to `PrintService.imageDocumentTarget`, and change the mocked return shape from a bare `PrintPaperConfig` to `{ paper, bitmapSource: BitmapSource.Image }` (keeping the `Image` path exercised by the existing tests unchanged in behavior). Specifically:

Replace line 134 (`(PrintService.imageDocumentMedia as jest.Mock | undefined)?.mockReset();`):

```ts
    (PrintService.imageDocumentTarget as jest.Mock | undefined)?.mockReset();
```

Replace line 163 (`(PrintService.imageDocumentMedia as jest.Mock).mockReturnValue(null);`):

```ts
    (PrintService.imageDocumentTarget as jest.Mock).mockReturnValue(null);
```

Replace lines 171-184 (the `'captures a bill image...'` test):

```ts
  it('captures a bill image and sends it alongside the text document when a target printer uses Image bitmapSource', async () => {
    (PrintService.imageDocumentTarget as jest.Mock).mockReturnValue({
      paper: { type: PrintPaperType.Continuous, paperSize: 58 },
      bitmapSource: BitmapSource.Image,
    });
    const capture = jest.fn().mockResolvedValue('base64-png-data');
    (PrintService.print as jest.Mock).mockResolvedValue({ status: PrintResultStatus.Success, jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);

    await printReceipt(document, capture);

    expect(capture).toHaveBeenCalledWith(document, { type: PrintPaperType.Continuous, paperSize: 58 });
    expect(PrintService.print).toHaveBeenCalledWith(PrintType.Receipt, {
      text: document,
      image: 'base64-png-data',
    });
  });

  it('renders via Skia and sends the result alongside the text document when a target printer uses Ast bitmapSource', async () => {
    (PrintService.imageDocumentTarget as jest.Mock).mockReturnValue({
      paper: { type: PrintPaperType.Continuous, paperSize: 58 },
      bitmapSource: BitmapSource.Ast,
    });
    (PrintService.print as jest.Mock).mockResolvedValue({ status: PrintResultStatus.Success, jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);

    await printReceipt(document, noopCapture);

    expect(noopCapture).not.toHaveBeenCalled();
    expect(PrintService.print).toHaveBeenCalledWith(PrintType.Receipt, {
      text: document,
      image: expect.any(String),
    });
  });
```

Replace lines 186-195 (the `'falls back to text-only...'` test) — rename its mock target reference the same way:

```ts
  it('falls back to text-only when captureBillImage resolves null (capture failed)', async () => {
    (PrintService.imageDocumentTarget as jest.Mock).mockReturnValue({
      paper: { type: PrintPaperType.Continuous, paperSize: 80 },
      bitmapSource: BitmapSource.Image,
    });
    const capture = jest.fn().mockResolvedValue(null);
    (PrintService.print as jest.Mock).mockResolvedValue({ status: PrintResultStatus.Success, jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn', null);

    await printReceipt(document, capture);

    expect(PrintService.print).toHaveBeenCalledWith(PrintType.Receipt, { text: document });
  });
```

Add `BitmapSource` to the test file's imports:

```ts
import { BitmapSource } from '../../../printer/models/printer/PrinterDriver';
```

Note: the new "renders via Skia..." test exercises the REAL `renderDocumentToBitmap` (not mocked) since `jest.mock('../../../printer/printing/PrintService')` only auto-mocks `PrintService`, not `renderDocumentToBitmap` — this is intentional: it's a cheap way to get one end-to-end assertion that the wiring calls the right function and gets back a usable string, on top of `renderDocumentToBitmap.test.ts`'s own unit coverage of its internals.

- [ ] **Step 7: Run to verify it passes**

Run: `npm test -- OrderPrintTrigger.test.ts`
Expected: PASS

- [ ] **Step 8: Run the full verify suite**

Run: `npm run verify`
Expected: PASS — every test file green, no type errors, no lint errors.

- [ ] **Step 9: Commit**

```bash
git add src/features/printer/printing/PrintService.ts src/features/cart/services/OrderPrintTrigger.ts src/features/printer/printing/__tests__/PrintService.test.ts src/features/cart/services/__tests__/OrderPrintTrigger.test.ts
git commit -m "feat(printer): wire bitmapSource through PrintService/OrderPrintTrigger to pick Image vs Ast"
```

**Feature complete.** TSPL can now choose `Encoder` (Task 3) or `Bitmap` with either `Image` or `Ast` source (Tasks 1-2, 5-10); ESC/POS's existing `Encoder` behavior is untouched, and its `Bitmap` mode also gains the `Image`/`Ast` choice.

---

## Self-Review Notes

- **Spec coverage:** §2 (Task 1), §3 (Task 2), §4 (Task 3), §5 (Tasks 5-8), §6 (no-wrap — reflected directly in Tasks 3/6, no separate task needed), §7 (Task 9-10), §8 (testing — folded into each task's own test steps rather than a separate task, per "fold setup into the task whose deliverable needs it"), §9/§10 (risks/out-of-scope — reflected as comments/constraints, not separate tasks, since they are things NOT being built).
- **Testing approach changed from the spec's §8 proposal:** the spec suggested using `@shopify/react-native-skia`'s official Jest CanvasKit environment for `renderDocumentToBitmap` tests. Task 5 deliberately uses a simpler recording-mock instead, matching this codebase's existing, consistent convention (see `react-native-view-shot`, `react-native-bluetooth-classic`, `PrinterNativeModule` in `jest.setup.js`) of mocking native-touching libraries and asserting call correctness rather than real native output. This is a lower-risk, faster, more consistent choice and is called out explicitly in Task 5.
- **Code128 accuracy risk:** flagged explicitly as a Global Constraint and as Task 4's mandatory Step 6 (real barcode-scanner verification) — this is the one piece of this plan that cannot be fully verified by automated tests alone.
- **Type consistency check:** `BitmapSource` (Task 1) is imported with identical name/path across every later task (`../models/printer/PrinterDriver`). `renderDocumentToBitmap(document, media)` signature is identical everywhere it's referenced (Tasks 5-10). `PrintService.imageDocumentTarget` name and return shape (`{ paper, bitmapSource }`) is consistent between Task 10's `PrintService.ts` change and its `OrderPrintTrigger.ts` consumer.
- **`SkiaCanvas` type consistency:** defined once in Task 5's skeleton (`renderDocumentToBitmap.ts`), reused as-is by `drawBarcode` (Task 7) and `drawQrCode` (Task 8) — both defined in the same file, so no re-import or redefinition needed. Fixed during self-review: the first draft had `drawBarcode` using an inline conditional type and `drawQrCode` referencing an undefined `SkCanvas` name; both now resolve to the same real alias.
