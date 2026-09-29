# printer-core Template Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Template tự khai báo `settings` (style chữ có tên + option `boolean`/`text`/`choice`) để người dùng chỉnh mà không sửa cấu trúc; `TemplateDocument` gom thành `metadata`/`settings`/`content`; layout in đúng cỡ và cảnh báo khi tràn khổ giấy.

**Architecture:**
- **Task 1:** layout bỏ tự thu nhỏ chữ, trả `{ elements, warnings }` với cảnh báo tràn chiều rộng giấy / chiều cao tem; `printer-preview` hiện cảnh báo.
- **Task 2:** `TemplateDocument` = `schemaVersion` + `metadata` (`kind` là công dụng, bỏ `dataId`) + `settings` (khai báo + validate) + `content`; DSL `.metadata()`, `.settings()`, `.content()`.
- **Task 3:** node tham chiếu settings (`styleName`, điều kiện/segment `option`): validate cấu trúc + tham chiếu, resolver in bằng `value`, DSL `scope.style/option/optionIs` có kiểm kiểu.
- **Task 4:** mẫu `printer-preview` dùng settings; README.

**Tech Stack:**
- TypeScript 5.9 strict.
- Jest (preset react-native) cho `printer-core`.
- Vitest cho `printer-preview`.
- `printer-core` không có dependency.

**Spec:** `docs/superpowers/specs/2026-09-29-template-settings-design.md`.

## Global Constraints

**Quy ước code (bắt buộc cho mọi sub-spec)** — chép nguyên văn từ `docs/superpowers/specs/2026-09-24-print-template-pipeline-overview.md`:

1. **Field summary:** mỗi field của type/interface export có 1 dòng JSDoc **tiếng Việt** nêu ý nghĩa, đơn vị (dots, mm, `Length`...), mặc định/ràng buộc nếu có. Chỉ bỏ qua field mà tên đã hiển nhiên tuyệt đối (VD `bold`).
2. **Cách dòng:** 1 dòng trống giữa các field (kèm JSDoc của nó) trong interface; dòng trống giữa các khối logic trong hàm.
3. **Comment trong implementation:** tiếng Việt, ngắn, chỉ giải thích WHY (constraint protocol, giới hạn phần cứng, hành vi không hiển nhiên). Không mô tả lại code, không kể lịch sử.
4. **Độ dài dòng ≤ 120 ký tự**, đo bằng số ký tự thật (Node `line.length`), không đo bằng byte.
5. **Nesting ≤ 3 cấp**, dùng guard clause/early return.
6. **1 hàm 1 trách nhiệm:** switch theo loại node/element thì mỗi case là 1 hàm riêng, switch chỉ điều phối. Không hàm lồng trong hàm.
7. **Không magic number:** hằng số `UPPER_SNAKE_CASE`, tên nói rõ đơn vị.
8. **Tên đầy đủ, không viết tắt** (`options` không `o`); identifier và tên file bằng tiếng Anh.
9. **Import module khác qua barrel `index.ts`**, không deep import vào file implementation.
10. **Hàm ≥ 3 tham số** viết mỗi tham số 1 dòng.
11. **Verify trước mỗi commit:** type-check, test, eslint 0 error, line-length.

**Quy tắc riêng của đợt này** (từ spec):

- **Test giữ nguyên như hiện tại:**
  - Chỉ sửa theo cấu trúc mới (`metadata`/`settings`/`content`, `kind`, DSL `.metadata()`/`.content()`), phần bỏ `dataId`
    và phần bỏ tự thu nhỏ chữ; nội dung kiểm tra giữ nguyên.
  - Test của code bị xoá thì xoá theo.
- **Không đổi kết quả in** của template không dùng settings, trừ phần chủ đích: tem không còn tự thu nhỏ chữ.
- **`default` của settings không bao giờ được đọc khi in** (resolve/layout/compile).
- **`printer-preview` phải còn chạy được:** type-check + Vitest xanh.
- **"1 file = 1 khái niệm"** cho file mới.

**Ràng buộc khác:**

- **Branch:** làm trên `feat/template-settings` (đã có commit spec và commit của plan này). Checkout thẳng trong working directory chính — **không dùng git worktree**, không commit thẳng `main`.
- **Stage file:**
  - File chuyển/xoá được stage bởi chính `git mv`/`git rm` trong task; file sửa/thêm stage bằng lệnh `git add` cho sẵn.
  - **Không bao giờ** `git add -A` hay `git add .`. `.claude/worktrees/` giữ untracked.
- **Commit message:** dùng đúng 2 tham số `-m` cho trong task; dòng cuối là `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, nguyên văn.
- **Nơi chạy lệnh:** mọi lệnh chạy từ `C:\NDTCORE\NDTCore\NDTCore.App` bằng Git Bash.

### Cách áp code của plan

Phần **chuyển/xoá file** dùng lệnh `git mv`/`git rm` ghi sẵn trong task. Phần **sửa/thêm** nằm trong khối patch của chính file này: mỗi khối có đánh dấu `<!-- patch:<id> -->` đứng ngay trước khối `~~~diff`. Task có TDD tách 2 patch: `tNtest` (test) và `tNimpl` (code).

**Lệnh áp 1 patch** (mỗi step đã ghi sẵn lệnh đầy đủ):

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-29-template-settings.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" <id> | git apply --ignore-whitespace -
```

- `--ignore-whitespace` cần vì working tree có file CRLF lẫn LF.
- Lúc lập plan, cả 4 task đã được áp lần lượt lên clone của branch này (checkout CRLF) và cho ra đúng nội dung đã kiểm chứng.
- **Nếu `git mv`, `git rm` hoặc `git apply` báo lỗi: dừng lại, báo BLOCKED kèm nguyên văn lỗi.** Không tự sửa tay.

### Lệnh verify dùng chung

Chạy từ `NDTCore.App`:

- **Type-check `printer-core`:**
  ```bash
  npx tsc --noEmit -p packages/printer-core
  ```
  Expected: không in gì.

- **Test `printer-core`:**
  ```bash
  npx jest packages/printer-core
  ```
  Expected: con số ghi trong task, không suite fail. Lần chạy đầu khi cache nguội có thể có 1 suite lỗi — chạy lại 1 lần.

- **`printer-preview`:**
  ```bash
  (cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
  ```
  Expected: tsc không in gì; Vitest đúng con số ghi trong task.

- **ESLint:**
  ```bash
  npx eslint packages/printer-core/src packages/printer-preview/src
  ```
  Expected: `0 errors`. Warning `react-native/no-inline-styles` trong `printer-preview`: 6 có sẵn, từ Task 1 là 7 (dòng
  cảnh báo tràn tem, cùng kiểu với dòng báo lỗi hiện có).

- **Line-length cho dòng đã stage:**
  ```bash
  git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
  ```
  Expected: không in gì, exit 0.


## Review Focus

Các trường hợp spec ngụ ý nhưng dễ bị bỏ sót, xếp theo khả năng gây hại cao nhất trước:

1. **`default` lọt vào bản in** (resolver lỡ đọc `default` khi `value` là `false`/chuỗi rỗng).
   - Mong đợi: luôn in theo `value`, kể cả `false` hay `''`.
   - Chốt bằng: test resolver style lấy `value` (khác `default`), option boolean `value: false` với `default: true` (Task 3).
2. **Tên setting trùng tên thuộc tính của object** (VD option tên `toString`, `constructor`) trong JSON từ BE.
   - Mong đợi: không trỏ nhầm vào prototype; báo "settings không có …" nếu không khai báo.
   - Chốt bằng: tra cứu bằng `hasOwnProperty` ở `checkSettingReferences` và `readSetting` (Task 3); review kiểm.
3. **Text vừa có `styleName` vừa có cỡ chữ viết thẳng** (người dùng chỉnh cỡ chữ mà bản in không đổi).
   - Mong đợi: `parseTemplate`/`build()` báo lỗi ở từng thuộc tính chữ viết thẳng.
   - Chốt bằng: test `parseTemplate` và test DSL build lỗi (Task 3).
4. **Tem nội dung tràn khổ** sau khi bỏ co chữ.
   - Mong đợi: vẫn in nguyên cỡ, có cảnh báo tràn chiều cao (tem) / chiều rộng (mọi giấy); preview hiện cảnh báo.
   - Chốt bằng: test layout overflow + test `renderPreviews` (Task 1).
5. **Option `choice` với `equals` ngoài danh sách, hoặc thiếu `equals`.**
   - Mong đợi: `validateTemplateAgainstData` báo lỗi rõ; resolver không âm thầm coi là sai.
   - Chốt bằng: test tham chiếu settings (Task 3); resolver throw `ResolveError` khi thiếu `equals`.

## Các quyết định lệch khỏi spec (đã chốt khi lập plan)

| # | Spec | Plan | Lý do |
|---|---|---|---|
| 1 | Chỉ nói `TemplateDocument` gom `metadata` | `PaperSize` tách file riêng `template/PaperSize.ts`; `TemplateKind`/`TemplateLocale`/`TemplateMetadata` ở `template/TemplateMetadata.ts` | Quy tắc "1 file = 1 khái niệm" cho file mới; `PaperSize` còn được `LayoutConfig` dùng |
| 2 | Kiểm tham chiếu settings trong `validateTemplateAgainstData` | Logic nằm ở file mới `parse/checkSettingReferences.ts`, `validateTemplateAgainstData` gọi và gộp kết quả | File cũ đã ~260 dòng; tách để mỗi file 1 trách nhiệm, API công khai không đổi |
| 3 | — | Bỏ `id` khỏi `TemplateDataShape` của builder | Chỉ dùng để ghi `dataId`, nay không còn |
| 4 | — | `JsonCursor.expectEntries()` và `validateTextStyleSetting()` mới | Validate `settings` (object theo tên; style chỉ gồm thuộc tính chữ, bắt buộc có) |
| 5 | — | `printer-preview` có thêm 1 warning eslint `no-inline-styles` | Dòng cảnh báo tràn tem dùng inline style giống dòng báo lỗi có sẵn |

---

### Task 1: Layout in đúng cỡ, cảnh báo tràn khổ giấy

**Files:**
- Delete: `packages/printer-core/src/layout/TypographyProfile.ts`
- Create: `packages/printer-core/src/layout/LayoutResult.ts`
- Modify: `packages/printer-core/src/layout/LayoutEngine.ts`, `layout/LayoutConfig.ts`, `layout/index.ts`, `layout/ApproximateFontMetrics.ts`, `packages/printer-preview/src/pipeline.ts`, `packages/printer-preview/src/components/PreviewPanel.tsx`
- Test: `layout/__tests__/LayoutEngine.sizing.test.ts` (thay test co chữ bằng test tràn khổ), `layout/__tests__/LayoutEngine.test.ts`, `__tests__/template-pipeline-integration.test.ts` (gọi API mới), `packages/printer-preview/src/__tests__/pipeline.test.ts` (thêm ca tràn tem)

(Đường dẫn trong `printer-core` tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: không có.
- Produces:
  - `LayoutEngine.resolve(root: ResolvedNode, config: LayoutConfig, fontMetrics: FontMetrics): LayoutResult`.
  - `interface LayoutResult { readonly elements: PrintElement[]; readonly warnings: readonly string[] }` (barrel `layout`).
  - `LayoutConfig = { paper: PaperSize; dpi: number }` (bỏ `media`).
  - Cảnh báo: `Nội dung rộng {n} dots, vượt chiều rộng giấy {m} dots`, `Nội dung cao {n} dots, vượt chiều cao tem {m} dots`.
  - `printer-preview`: `PagePreview` trạng thái `ok` có thêm `warnings: readonly string[]`.
  - Bỏ `TypographyProfile`, `FontScaleLevel`.

- [ ] **Step 1: Kiểm tra branch và working tree**

```bash
git branch --show-current
git status --short
```

Expected: `feat/template-settings`; `git status` chỉ có `?? .claude/worktrees/`.

- [ ] **Step 2: Viết/sửa test (patch `t1test`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-29-template-settings.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t1test | git apply --ignore-whitespace -
```

<!-- patch:t1test -->
~~~diff
diff --git a/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts b/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
index b34ab3c..7da5b20 100644
--- a/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
+++ b/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
@@ -1,5 +1,5 @@
 import { EscPosCompiler } from '../language';
-import { ApproximateFontMetrics, createLayoutEngine, paperSizeToDots, type TypographyProfile } from '../layout';
+import { ApproximateFontMetrics, createLayoutEngine, paperSizeToDots } from '../layout';
 import { collectAssetIds, createDocumentResolver, type AssetProvider } from '../resolution';
 import {
   barcode,
@@ -23,7 +23,6 @@ import type { Bitmap } from '../types';
 declare function require(id: string): unknown;
 
 const LOGO: Bitmap = { data: new Uint8Array(8), width: 8, height: 8, bytesPerRow: 1 };
-const TYPOGRAPHY: TypographyProfile = { fontScaleLevels: [{ id: 'default', fontScale: 1, lineHeightScale: 1 }] };
 const PRINTER_DPI = 203;
 
 function buildReceipt() {
@@ -62,8 +61,8 @@ describe('pipeline template → resolve → layout → compile', () => {
     expect(pages).toHaveLength(1);
     if (pages[0].status !== 'ok') throw new Error(pages[0].message);
 
-    const config = { paper: template.paper, media: template.media, dpi: PRINTER_DPI };
-    const elements = createLayoutEngine().resolve(pages[0].node, config, TYPOGRAPHY, new ApproximateFontMetrics());
+    const config = { paper: template.paper, dpi: PRINTER_DPI };
+    const { elements } = createLayoutEngine().resolve(pages[0].node, config, new ApproximateFontMetrics());
 
     expect(elements.some((element) => element.type === 'text' && element.content === 'Bàn Bàn 5')).toBe(true);
     expect(elements.some((element) => element.type === 'text' && element.content === 'Giảm giá 5.000đ')).toBe(true);
@@ -134,10 +133,10 @@ describe('pipeline template → resolve → layout → compile', () => {
       assets: { get: () => undefined },
     });
 
-    const config = { paper: template.paper, media: template.media, dpi: PRINTER_DPI };
+    const config = { paper: template.paper, dpi: PRINTER_DPI };
     const texts = pages.map((page) => {
       if (page.status !== 'ok') throw new Error(page.message);
-      const elements = createLayoutEngine().resolve(page.node, config, TYPOGRAPHY, new ApproximateFontMetrics());
+      const { elements } = createLayoutEngine().resolve(page.node, config, new ApproximateFontMetrics());
       return elements.flatMap((element) => (element.type === 'text' ? [element.content] : []));
     });
     expect(texts).toEqual([
diff --git a/packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts b/packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts
index 00bf526..fbab1ff 100644
--- a/packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts
+++ b/packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts
@@ -1,4 +1,4 @@
-import { ApproximateFontMetrics, createLayoutEngine, type LayoutConfig, type TypographyProfile } from '..';
+import { ApproximateFontMetrics, createLayoutEngine, type LayoutConfig } from '..';
 import type { ResolvedNode } from '../../resolution';
 import { px } from '../../template';
 
@@ -15,11 +15,14 @@ function millimetersForDots(dots: number): number {
 function labelConfig(widthDots: number, heightDots: number): LayoutConfig {
   return {
     paper: { widthMm: millimetersForDots(widthDots), heightMm: millimetersForDots(heightDots) },
-    media: 'label',
     dpi: DOTS_EQUAL_PIXELS_DPI,
   };
 }
 
+function receiptConfig(widthDots: number): LayoutConfig {
+  return { paper: { widthMm: millimetersForDots(widthDots) }, dpi: DOTS_EQUAL_PIXELS_DPI };
+}
+
 function tallColumn(lineCount: number, fontSizePixels: number): ResolvedNode {
   return {
     type: 'container',
@@ -34,83 +37,44 @@ function tallColumn(lineCount: number, fontSizePixels: number): ResolvedNode {
   };
 }
 
-function firstTextSize(
-  root: ResolvedNode,
-  config: LayoutConfig,
-  typography: TypographyProfile,
-): number | undefined {
-  const [first] = engine.resolve(root, config, typography, fontMetrics);
-  if (first.type !== 'text') throw new Error('expected text element');
-  return first.options?.fontSize;
+// Barcode được ước lượng rộng 200 dots, nên 3 mã xếp hàng ngang rộng 600 dots.
+function wideBarcodeRow(): ResolvedNode {
+  return {
+    type: 'container',
+    id: 'row',
+    style: { direction: 'row' },
+    children: ['A', 'B', 'C'].map((value) => ({
+      type: 'barcode' as const,
+      id: value,
+      value,
+      symbology: 'code128' as const,
+    })),
+  };
 }
 
-describe('LayoutEngine — tự thu nhỏ chữ', () => {
-  it('receipt luôn dùng mức đầu tiên, không thu nhỏ', () => {
-    const receipt: LayoutConfig = {
-      paper: { widthMm: millimetersForDots(576) },
-      media: 'receipt',
-      dpi: DOTS_EQUAL_PIXELS_DPI,
-    };
-    const typography: TypographyProfile = {
-      fontScaleLevels: [
-        { id: 'large', fontScale: 1, lineHeightScale: 1 },
-        { id: 'small', fontScale: 0.5, lineHeightScale: 0.5 },
-      ],
-    };
+describe('LayoutEngine — in đúng cỡ, cảnh báo khi tràn khổ giấy', () => {
+  it('tem tràn chiều cao: giữ nguyên cỡ chữ và cảnh báo', () => {
+    const result = engine.resolve(tallColumn(10, 20), labelConfig(400, 100), fontMetrics);
+    const [first] = result.elements;
+    if (first.type !== 'text') throw new Error('expected text element');
 
-    expect(firstTextSize(tallColumn(50, 40), receipt, typography)).toBe(40);
+    expect(first.options?.fontSize).toBe(20);
+    expect(result.warnings).toEqual(['Nội dung cao 240 dots, vượt chiều cao tem 100 dots']);
   });
 
-  it('label chọn mức lớn nhất còn vừa chiều cao tem', () => {
-    const typography: TypographyProfile = {
-      fontScaleLevels: [
-        { id: 'large', fontScale: 1, lineHeightScale: 1 },
-        { id: 'medium', fontScale: 0.5, lineHeightScale: 0.5 },
-        { id: 'small', fontScale: 0.25, lineHeightScale: 0.25 },
-      ],
-    };
+  it('nội dung rộng hơn giấy: cảnh báo tràn chiều rộng ở cả tem lẫn giấy cuộn', () => {
+    const label = engine.resolve(wideBarcodeRow(), labelConfig(400, 300), fontMetrics);
+    const receipt = engine.resolve(wideBarcodeRow(), receiptConfig(400), fontMetrics);
 
-    // 10 dòng cỡ 20 tràn 100 dots; chỉ mức 0.25 vừa → 5 dots.
-    expect(firstTextSize(tallColumn(10, 20), labelConfig(400, 100), typography)).toBe(5);
+    expect(label.warnings).toEqual(['Nội dung rộng 600 dots, vượt chiều rộng giấy 400 dots']);
+    expect(receipt.warnings).toEqual(['Nội dung rộng 600 dots, vượt chiều rộng giấy 400 dots']);
   });
 
-  it('label không vừa ở mức nào thì dùng mức nhỏ nhất, không throw', () => {
-    const typography: TypographyProfile = {
-      fontScaleLevels: [
-        { id: 'large', fontScale: 1, lineHeightScale: 1 },
-        { id: 'small', fontScale: 0.1, lineHeightScale: 0.1 },
-      ],
-    };
-
-    expect(firstTextSize(tallColumn(100, 40), labelConfig(400, 10), typography)).toBe(4);
+  it('nội dung vừa khổ tem không có cảnh báo', () => {
+    expect(engine.resolve(tallColumn(2, 20), labelConfig(400, 100), fontMetrics).warnings).toEqual([]);
   });
 
-  it('thu nhỏ đồng đều cả cây, không chỉ phần bị tràn', () => {
-    const typography: TypographyProfile = {
-      fontScaleLevels: [
-        { id: 'large', fontScale: 1, lineHeightScale: 1 },
-        { id: 'small', fontScale: 0.5, lineHeightScale: 0.5 },
-      ],
-    };
-    const root: ResolvedNode = {
-      type: 'container',
-      id: 'root',
-      style: { direction: 'column' },
-      children: [
-        { type: 'text', id: 'header', value: 'HEADER', style: { fontSize: px(20) } },
-        ...Array.from({ length: 10 }, (_, index) => ({
-          type: 'text' as const,
-          id: `item${index}`,
-          value: `Item ${index}`,
-          style: { fontSize: px(20) },
-        })),
-      ],
-    };
-    const [header, item] = engine.resolve(root, labelConfig(400, 50), typography, fontMetrics);
-    if (header.type !== 'text' || item.type !== 'text') throw new Error('expected text elements');
-
-    expect(header.options?.fontSize).toBe(item.options?.fontSize);
-    // 20 × 0.5 = 10 dots.
-    expect(header.options?.fontSize).toBe(10);
+  it('giấy cuộn dài không có cảnh báo chiều cao', () => {
+    expect(engine.resolve(tallColumn(100, 40), receiptConfig(576), fontMetrics).warnings).toEqual([]);
   });
 });
diff --git a/packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts b/packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts
index 16c536a..0acac87 100644
--- a/packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts
+++ b/packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts
@@ -1,4 +1,4 @@
-import { ApproximateFontMetrics, createLayoutEngine, type LayoutConfig, type TypographyProfile } from '..';
+import { ApproximateFontMetrics, createLayoutEngine, type LayoutConfig } from '..';
 import type { ResolvedNode } from '../../resolution';
 import { mm, pt, px } from '../../template';
 
@@ -7,7 +7,6 @@ const DOTS_EQUAL_PIXELS_DPI = 96;
 
 const engine = createLayoutEngine();
 const fontMetrics = new ApproximateFontMetrics();
-const typography: TypographyProfile = { fontScaleLevels: [{ id: 'default', fontScale: 1, lineHeightScale: 1 }] };
 
 /** Khổ giấy tính bằng mm tương ứng số dots ở 96 dpi. */
 function millimetersForDots(dots: number): number {
@@ -16,7 +15,6 @@ function millimetersForDots(dots: number): number {
 
 const receiptConfig: LayoutConfig = {
   paper: { widthMm: millimetersForDots(576) },
-  media: 'receipt',
   dpi: DOTS_EQUAL_PIXELS_DPI,
 };
 
@@ -30,7 +28,7 @@ function textNode(
 
 describe('LayoutEngine', () => {
   it('text đơn thành 1 TextElement tại x=0, y=0', () => {
-    const elements = engine.resolve(textNode('t1', 'Hello', 20), receiptConfig, typography, fontMetrics);
+    const elements = engine.resolve(textNode('t1', 'Hello', 20), receiptConfig, fontMetrics).elements;
 
     expect(elements).toHaveLength(1);
     expect(elements[0]).toMatchObject({ type: 'text', content: 'Hello', options: { x: 0, y: 0, fontSize: 20 } });
@@ -43,7 +41,7 @@ describe('LayoutEngine', () => {
       style: { direction: 'column', gap: px(10) },
       children: [textNode('t1', 'A'), textNode('t2', 'B')],
     };
-    const [first, second] = engine.resolve(root, receiptConfig, typography, fontMetrics);
+    const [first, second] = engine.resolve(root, receiptConfig, fontMetrics).elements;
     if (first.type !== 'text' || second.type !== 'text') throw new Error('expected text elements');
 
     expect(first.options?.y).toBe(0);
@@ -57,7 +55,7 @@ describe('LayoutEngine', () => {
       style: { direction: 'row', gap: px(20) },
       children: [textNode('t1', 'A'), textNode('t2', 'B')],
     };
-    const [first, second] = engine.resolve(root, receiptConfig, typography, fontMetrics);
+    const [first, second] = engine.resolve(root, receiptConfig, fontMetrics).elements;
     if (first.type !== 'text' || second.type !== 'text') throw new Error('expected text elements');
 
     expect(first.options?.x).toBe(0);
@@ -71,7 +69,7 @@ describe('LayoutEngine', () => {
       style: { padding: { top: px(8), right: px(8), bottom: px(8), left: px(8) } },
       children: [textNode('t1', 'A')],
     };
-    const [element] = engine.resolve(root, receiptConfig, typography, fontMetrics);
+    const [element] = engine.resolve(root, receiptConfig, fontMetrics).elements;
 
     expect(element).toMatchObject({ type: 'text', options: { x: 8, y: 8 } });
   });
@@ -91,7 +89,7 @@ describe('LayoutEngine', () => {
         textNode('t2', 'B'),
       ],
     };
-    const [, sibling] = engine.resolve(root, receiptConfig, typography, fontMetrics);
+    const [, sibling] = engine.resolve(root, receiptConfig, fontMetrics).elements;
     if (sibling.type !== 'text') throw new Error('expected text element');
 
     expect(sibling.options?.y).toBe(fontMetrics.measure('A', { fontSize: 10 }).heightDots + 8 + 8);
@@ -109,7 +107,7 @@ describe('LayoutEngine', () => {
         { type: 'line', id: 'l1', thickness: px(2), pattern: 'solid' },
       ],
     };
-    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
+    const elements = engine.resolve(root, receiptConfig, fontMetrics).elements;
 
     expect(elements.map((element) => element.type)).toEqual(['barcode', 'qrcode', 'image', 'line']);
   });
@@ -117,13 +115,13 @@ describe('LayoutEngine', () => {
   it('container rỗng không sinh element', () => {
     const root: ResolvedNode = { type: 'container', id: 'root', children: [] };
 
-    expect(engine.resolve(root, receiptConfig, typography, fontMetrics)).toEqual([]);
+    expect(engine.resolve(root, receiptConfig, fontMetrics).elements).toEqual([]);
   });
 
   it('text dài hơn chiều rộng được ngắt thành nhiều dòng, y tăng dần', () => {
     const longText = 'This is a very long line of receipt text that should not fit on a single narrow line';
     const narrowConfig: LayoutConfig = { ...receiptConfig, paper: { widthMm: millimetersForDots(100) } };
-    const elements = engine.resolve(textNode('t1', longText), narrowConfig, typography, fontMetrics);
+    const elements = engine.resolve(textNode('t1', longText), narrowConfig, fontMetrics).elements;
 
     expect(elements.length).toBeGreaterThan(1);
     const ys = elements.map((element) => (element.type === 'text' ? (element.options?.y ?? 0) : -1));
@@ -143,7 +141,7 @@ describe('LayoutEngine', () => {
         textNode('t1', 'Hello'),
       ],
     };
-    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
+    const elements = engine.resolve(root, receiptConfig, fontMetrics).elements;
     const ys = elements.map((element) => {
       if (element.type === 'line') return element.options.y1;
       if (element.type === 'barcode' || element.type === 'qrcode') return element.options.y ?? 0;
@@ -159,14 +157,14 @@ describe('LayoutEngine', () => {
       const withDefault: ResolvedNode = { type: 'text', id: 't1', value: 'Hi', style: { fontSize: px(12) } };
       const config: LayoutConfig = { ...receiptConfig, dpi: 203 };
 
-      expect(engine.resolve(withoutSize, config, typography, fontMetrics)).toEqual(
-        engine.resolve(withDefault, config, typography, fontMetrics),
+      expect(engine.resolve(withoutSize, config, fontMetrics).elements).toEqual(
+        engine.resolve(withDefault, config, fontMetrics).elements,
       );
     });
 
     it('không kẹp cỡ rất nhỏ hay rất lớn — quy đổi là việc của compiler', () => {
-      const [small] = engine.resolve(textNode('t1', 'Hi', 1), receiptConfig, typography, fontMetrics);
-      const [large] = engine.resolve(textNode('t1', 'Hi', 200), receiptConfig, typography, fontMetrics);
+      const [small] = engine.resolve(textNode('t1', 'Hi', 1), receiptConfig, fontMetrics).elements;
+      const [large] = engine.resolve(textNode('t1', 'Hi', 200), receiptConfig, fontMetrics).elements;
 
       expect(small).toMatchObject({ options: { fontSize: 1 } });
       expect(large).toMatchObject({ options: { fontSize: 200 } });
@@ -181,7 +179,7 @@ describe('LayoutEngine', () => {
     }
 
     function typesOf(root: ResolvedNode): readonly string[] {
-      return engine.resolve(root, receiptConfig, typography, fontMetrics).map((element) => element.type);
+      return engine.resolve(root, receiptConfig, fontMetrics).elements.map((element) => element.type);
     }
 
     it('đúng 2 text với space-between thành 1 TableElement 2 cột', () => {
@@ -189,7 +187,7 @@ describe('LayoutEngine', () => {
         { type: 'text', id: 'name', value: 'Milk Tea' },
         { type: 'text', id: 'price', value: '45,000' },
       ]);
-      const [element] = engine.resolve(root, receiptConfig, typography, fontMetrics);
+      const [element] = engine.resolve(root, receiptConfig, fontMetrics).elements;
       if (element.type !== 'table') throw new Error('expected table element');
 
       const rightWidthDots = fontMetrics.measure('45,000', { fontSize: 12 }).widthDots;
@@ -223,8 +221,8 @@ describe('LayoutEngine', () => {
       [203, 16],
       [300, 24],
     ])('%i dpi: padding 2mm = %i dots, kích thước vật lý giữ nguyên', (dpi, expectedDots) => {
-      const config: LayoutConfig = { paper: { widthMm: 50, heightMm: 30 }, media: 'label', dpi };
-      const [element] = engine.resolve(paddedText, config, typography, fontMetrics);
+      const config: LayoutConfig = { paper: { widthMm: 50, heightMm: 30 }, dpi };
+      const [element] = engine.resolve(paddedText, config, fontMetrics).elements;
       if (element.type !== 'text') throw new Error('expected text element');
 
       expect(element.options?.x).toBe(expectedDots);
@@ -233,7 +231,7 @@ describe('LayoutEngine', () => {
 
     it('độ dày nét nhỏ hơn 1 dot vẫn giữ tối thiểu 1 dot', () => {
       const root: ResolvedNode = { type: 'line', id: 'l1', thickness: pt(0.1), pattern: 'solid' };
-      const [element] = engine.resolve(root, { ...receiptConfig, dpi: 203 }, typography, fontMetrics);
+      const [element] = engine.resolve(root, { ...receiptConfig, dpi: 203 }, fontMetrics).elements;
 
       expect(element).toMatchObject({ type: 'line', options: { thickness: 1 } });
     });
@@ -247,7 +245,7 @@ describe('LayoutEngine', () => {
           { type: 'qrcode', id: 'q1', value: 'XYZ', moduleSize: mm(0.5) },
         ],
       };
-      const [barcode, qrcode] = engine.resolve(root, { ...receiptConfig, dpi: 203 }, typography, fontMetrics);
+      const [barcode, qrcode] = engine.resolve(root, { ...receiptConfig, dpi: 203 }, fontMetrics).elements;
 
       expect(barcode).toMatchObject({ type: 'barcode', options: { height: 80 } });
       expect(qrcode).toMatchObject({ type: 'qrcode', options: { cellWidth: 4, y: 80 } });
@@ -262,7 +260,7 @@ describe('LayoutEngine', () => {
         pattern: 'dashed',
         style: { width: { type: 'fixed', value: mm(10) } },
       };
-      const elements = engine.resolve(root, { ...receiptConfig, dpi: 203 }, typography, fontMetrics);
+      const elements = engine.resolve(root, { ...receiptConfig, dpi: 203 }, fontMetrics).elements;
       const segments = elements.map((element) =>
         element.type === 'line' ? [element.options.x1, element.options.x2] : [],
       );
@@ -280,7 +278,7 @@ describe('LayoutEngine', () => {
     it('nét liền vẫn là 1 LineElement', () => {
       const root: ResolvedNode = { type: 'line', id: 'l1', pattern: 'solid' };
 
-      expect(engine.resolve(root, receiptConfig, typography, fontMetrics)).toEqual([
+      expect(engine.resolve(root, receiptConfig, fontMetrics).elements).toEqual([
         { type: 'line', options: { x1: 0, y1: 0, x2: 576, y2: 0, thickness: undefined } },
       ]);
     });
diff --git a/packages/printer-preview/src/__tests__/pipeline.test.ts b/packages/printer-preview/src/__tests__/pipeline.test.ts
index 8b75e55..c03238c 100644
--- a/packages/printer-preview/src/__tests__/pipeline.test.ts
+++ b/packages/printer-preview/src/__tests__/pipeline.test.ts
@@ -37,6 +37,17 @@ describe('renderPreviews', () => {
     if (previews[0].status === 'ok') expect(previews[0].svg).toContain('<svg');
   });
 
+  it('trang tràn chiều cao tem vẫn render và kèm cảnh báo', () => {
+    const lines = Array.from({ length: 20 }, (_, index) => text(`Dòng ${index}`));
+    const template = label()
+      .root(column().children(...lines))
+      .build();
+    const [page] = renderPreviews(template, templateData, { title: 'x', items: [] }, 'tspl');
+
+    expect(page.status).toBe('ok');
+    if (page.status === 'ok') expect(page.warnings).toEqual([expect.stringContaining('vượt chiều cao tem')]);
+  });
+
   it('lỗi 1 trang không ảnh hưởng trang khác', () => {
     const template = label()
       .root((scope) =>
~~~

- [ ] **Step 3: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core
(cd packages/printer-preview && npx vitest run)
```

Expected: jest `Test Suites: 3 failed` / `Tests: 25 failed, 295 passed, 320 total` (`LayoutEngine.test`, `LayoutEngine.sizing.test`, `template-pipeline-integration` — `resolve()` còn nhận typography và trả mảng); Vitest `1 failed | 12 passed` (`trang tràn chiều cao tem vẫn render và kèm cảnh báo` — chưa có `warnings`).

- [ ] **Step 4: Viết code (git rm + patch `t1impl`)**

```bash
git rm -q packages/printer-core/src/layout/TypographyProfile.ts
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-29-template-settings.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t1impl | git apply --ignore-whitespace -
```

<!-- patch:t1impl -->
~~~diff
diff --git a/packages/printer-core/src/layout/ApproximateFontMetrics.ts b/packages/printer-core/src/layout/ApproximateFontMetrics.ts
index 2504212..b565827 100644
--- a/packages/printer-core/src/layout/ApproximateFontMetrics.ts
+++ b/packages/printer-core/src/layout/ApproximateFontMetrics.ts
@@ -22,7 +22,7 @@ function dotsPerChar(fontSize: number): number {
 
 /**
  * Ước lượng kích thước/wrap text mà không cần load font thật — dùng cho auto-layout
- * (wrap theo maxWidth, auto-shrink theo `TypographyProfile`). `fontSize`/`lineHeight`
+ * (wrap theo maxWidth). `fontSize`/`lineHeight`
  * đều tính bằng dots: `fontSize` là chiều cao glyph danh nghĩa, `lineHeight` là chiều
  * cao cả dòng (glyph + khoảng cách dòng) — cùng quy ước fontSize/line-height của CSS.
  */
diff --git a/packages/printer-core/src/layout/LayoutConfig.ts b/packages/printer-core/src/layout/LayoutConfig.ts
index a606a25..ef9d904 100644
--- a/packages/printer-core/src/layout/LayoutConfig.ts
+++ b/packages/printer-core/src/layout/LayoutConfig.ts
@@ -1,13 +1,10 @@
-import type { PaperSize, TemplateMedia } from '../template';
+import type { PaperSize } from '../template';
 
 /** Thông số máy in đích để layout: khổ giấy của template + DPI của máy. */
 export interface LayoutConfig {
   /** Khổ giấy, mm — lấy từ `TemplateDocument.paper`. */
   readonly paper: PaperSize;
 
-  /** Label thì tự thu nhỏ chữ cho vừa chiều cao tem; receipt thì không. */
-  readonly media: TemplateMedia;
-
   /** Mật độ điểm của máy in, VD 203 hoặc 300. */
   readonly dpi: number;
 }
diff --git a/packages/printer-core/src/layout/LayoutEngine.ts b/packages/printer-core/src/layout/LayoutEngine.ts
index 4abf644..7f05b62 100644
--- a/packages/printer-core/src/layout/LayoutEngine.ts
+++ b/packages/printer-core/src/layout/LayoutEngine.ts
@@ -12,9 +12,9 @@ import type {
   LayoutQrCode,
   LayoutText,
 } from './LayoutNode';
-import { paperSizeToDots } from './lengthToDots';
+import type { LayoutResult } from './LayoutResult';
+import { paperSizeToDots, type PaperDots } from './lengthToDots';
 import { toLayoutNode } from './toLayoutNode';
-import type { FontScaleLevel, TypographyProfile } from './TypographyProfile';
 
 /** Toạ độ, dots. */
 interface Position {
@@ -55,25 +55,23 @@ const DEFAULT_LINE_THICKNESS_DOTS = 1;
 
 /** Xếp vị trí các node đã resolve thành `PrintElement[]` (dots) theo khổ giấy + DPI của máy in đích. */
 export class LayoutEngine {
-  /** Label tự chọn mức thu nhỏ chữ lớn nhất còn vừa chiều cao tem; receipt luôn dùng mức đầu tiên. */
+  /**
+   * In đúng cỡ template đặt, không tự thu nhỏ chữ: nội dung tràn khổ giấy vẫn được xếp nguyên và chỉ kèm cảnh báo,
+   * để người chỉnh template tự quyết (bớt nội dung hoặc chia tem bằng `maxItemsPerPage`).
+   */
   resolve(
     root: ResolvedNode,
     config: LayoutConfig,
-    typography: TypographyProfile,
     fontMetrics: FontMetrics,
-  ): PrintElement[] {
+  ): LayoutResult {
     const layoutRoot = toLayoutNode(root, config.dpi);
     const paper = paperSizeToDots(config.paper, config.dpi);
-    const levels = typography.fontScaleLevels;
-
-    const labelSize = config.media === 'label' && paper.heightDots !== undefined
-      ? { widthDots: paper.widthDots, heightDots: paper.heightDots }
-      : undefined;
-    const level = labelSize ? chooseLabelScaleLevel(layoutRoot, labelSize, levels, fontMetrics) : levels[0];
 
     const target: ArrangeTarget = { fontMetrics, elements: [] };
-    arrange(scaleTree(layoutRoot, level), ORIGIN, paper.widthDots, target);
-    return target.elements;
+    arrange(layoutRoot, ORIGIN, paper.widthDots, target);
+
+    const contentSize = measure(layoutRoot, fontMetrics, paper.widthDots);
+    return { elements: target.elements, warnings: overflowWarnings(contentSize, paper) };
   }
 }
 
@@ -82,32 +80,19 @@ export function createLayoutEngine(): LayoutEngine {
   return new LayoutEngine();
 }
 
-// Không vừa ở mức nào thì dùng mức nhỏ nhất (best-effort), không throw.
-function chooseLabelScaleLevel(
-  root: LayoutNode,
-  paper: Size,
-  levels: readonly FontScaleLevel[],
-  fontMetrics: FontMetrics,
-): FontScaleLevel {
-  const fitting = levels.find(
-    (level) => measure(scaleTree(root, level), fontMetrics, paper.widthDots).heightDots <= paper.heightDots,
-  );
-  return fitting ?? levels[levels.length - 1];
-}
-
-function scaleTree(node: LayoutNode, level: FontScaleLevel): LayoutNode {
-  if (node.type === 'container') return { ...node, children: node.children.map((child) => scaleTree(child, level)) };
-  if (node.type !== 'text') return node;
+// Giấy cuộn không có chiều cao cố định nên chỉ tem mới có cảnh báo tràn chiều cao.
+function overflowWarnings(content: Size, paper: PaperDots): string[] {
+  const warnings: string[] = [];
+  const contentWidthDots = Math.ceil(content.widthDots);
+  const contentHeightDots = Math.ceil(content.heightDots);
 
-  const { fontSize, lineHeight } = node.style;
-  return {
-    ...node,
-    style: {
-      ...node.style,
-      fontSize: fontSize === undefined ? undefined : fontSize * level.fontScale,
-      lineHeight: lineHeight === undefined ? undefined : lineHeight * level.lineHeightScale,
-    },
-  };
+  if (contentWidthDots > paper.widthDots) {
+    warnings.push(`Nội dung rộng ${contentWidthDots} dots, vượt chiều rộng giấy ${paper.widthDots} dots`);
+  }
+  if (paper.heightDots !== undefined && contentHeightDots > paper.heightDots) {
+    warnings.push(`Nội dung cao ${contentHeightDots} dots, vượt chiều cao tem ${paper.heightDots} dots`);
+  }
+  return warnings;
 }
 
 function measure(
diff --git a/packages/printer-core/src/layout/LayoutResult.ts b/packages/printer-core/src/layout/LayoutResult.ts
new file mode 100644
index 0000000..e33c19f
--- /dev/null
+++ b/packages/printer-core/src/layout/LayoutResult.ts
@@ -0,0 +1,10 @@
+import type { PrintElement } from '../document';
+
+/** Kết quả layout 1 trang: element đã xếp vị trí (dots) + cảnh báo nội dung tràn khổ giấy. */
+export interface LayoutResult {
+  /** Element đã xếp vị trí, dots. */
+  readonly elements: PrintElement[];
+
+  /** Cảnh báo tràn chiều rộng giấy hoặc chiều cao tem; rỗng khi nội dung vừa khổ. */
+  readonly warnings: readonly string[];
+}
diff --git a/packages/printer-core/src/layout/index.ts b/packages/printer-core/src/layout/index.ts
index a518ca2..e6c162e 100644
--- a/packages/printer-core/src/layout/index.ts
+++ b/packages/printer-core/src/layout/index.ts
@@ -3,6 +3,6 @@ export * from './LayoutNode';
 export * from './TextMeasurement';
 export * from './FontMetrics';
 export * from './ApproximateFontMetrics';
-export * from './TypographyProfile';
+export * from './LayoutResult';
 export { lengthToDots, strokeLengthToDots, paperSizeToDots, type PaperDots } from './lengthToDots';
 export { LayoutEngine, createLayoutEngine } from './LayoutEngine';
diff --git a/packages/printer-preview/src/components/PreviewPanel.tsx b/packages/printer-preview/src/components/PreviewPanel.tsx
index c2271fe..6116956 100644
--- a/packages/printer-preview/src/components/PreviewPanel.tsx
+++ b/packages/printer-preview/src/components/PreviewPanel.tsx
@@ -10,8 +10,15 @@ export function PreviewPanel({ previews }: PreviewPanelProps) {
     <div>
       {previews.map((preview) =>
         preview.status === 'ok' ? (
-          // previewFor() trả về chuỗi SVG do printer-core sinh ra, không phải markup từ người dùng.
-          <div key={preview.pageIndex} dangerouslySetInnerHTML={{ __html: preview.svg }} />
+          <div key={preview.pageIndex}>
+            {/* previewFor() trả về chuỗi SVG do printer-core sinh ra, không phải markup từ người dùng. */}
+            <div dangerouslySetInnerHTML={{ __html: preview.svg }} />
+            {preview.warnings.map((warning) => (
+              <div key={warning} style={{ color: 'darkorange' }}>
+                Trang {preview.pageIndex + 1}: {warning}
+              </div>
+            ))}
+          </div>
         ) : (
           <div key={preview.pageIndex} style={{ color: 'red' }}>
             Trang {preview.pageIndex + 1}: {preview.message}
diff --git a/packages/printer-preview/src/pipeline.ts b/packages/printer-preview/src/pipeline.ts
index 82b6fea..28d2f84 100644
--- a/packages/printer-preview/src/pipeline.ts
+++ b/packages/printer-preview/src/pipeline.ts
@@ -10,17 +10,8 @@ import {
   type ResolvedPrintDocument,
   type TemplateDataDefinition,
   type TemplateDocument,
-  type TypographyProfile,
 } from 'printer-core';
 
-const DEFAULT_TYPOGRAPHY: TypographyProfile = {
-  fontScaleLevels: [
-    { id: 'large', fontScale: 1, lineHeightScale: 1 },
-    { id: 'medium', fontScale: 0.75, lineHeightScale: 0.85 },
-    { id: 'small', fontScale: 0.5, lineHeightScale: 0.7 },
-  ],
-};
-
 /** DPI giả lập máy in cho preview — phổ biến nhất ở máy in nhiệt/tem. */
 const PREVIEW_DPI = 203;
 
@@ -32,17 +23,28 @@ const resolver = createDocumentResolver();
 const layoutEngine = createLayoutEngine();
 
 export type PagePreview =
-  | { readonly status: 'ok'; readonly pageIndex: number; readonly svg: string }
+  | {
+      readonly status: 'ok';
+      readonly pageIndex: number;
+      readonly svg: string;
+      readonly warnings: readonly string[];
+    }
   | { readonly status: 'error'; readonly pageIndex: number; readonly message: string };
 
-function buildResolvedDocument(
+/** Document đã layout của 1 trang, kèm cảnh báo tràn khổ giấy của layout. */
+interface LaidOutPage {
+  readonly document: ResolvedPrintDocument;
+  readonly warnings: readonly string[];
+}
+
+function layoutPage(
   template: TemplateDocument,
   page: Extract<ResolvedPage, { status: 'ok' }>,
-): ResolvedPrintDocument {
-  const layoutConfig = { paper: template.paper, media: template.media, dpi: PREVIEW_DPI };
-  const elements = layoutEngine.resolve(page.node, layoutConfig, DEFAULT_TYPOGRAPHY, fontMetrics);
+): LaidOutPage {
+  const layoutConfig = { paper: template.paper, dpi: PREVIEW_DPI };
+  const { elements, warnings } = layoutEngine.resolve(page.node, layoutConfig, fontMetrics);
   const paper = paperSizeToDots(template.paper, PREVIEW_DPI);
-  return {
+  const document: ResolvedPrintDocument = {
     widthDots: paper.widthDots,
     heightDots: paper.heightDots ?? 0,
     dpi: PREVIEW_DPI,
@@ -53,6 +55,7 @@ function buildResolvedDocument(
     copies: 1,
     elements,
   };
+  return { document, warnings };
 }
 
 function renderPage(
@@ -64,8 +67,8 @@ function renderPage(
     return { status: 'error', pageIndex: page.pageIndex, message: `${page.nodeId}: ${page.message}` };
   }
   try {
-    const document = buildResolvedDocument(template, page);
-    return { status: 'ok', pageIndex: page.pageIndex, svg: previewFor(language, document) };
+    const { document, warnings } = layoutPage(template, page);
+    return { status: 'ok', pageIndex: page.pageIndex, svg: previewFor(language, document), warnings };
   } catch (error) {
     const message = error instanceof Error ? error.message : String(error);
     return { status: 'error', pageIndex: page.pageIndex, message };
~~~

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `320 passed, 320 total`; `printer-preview` tsc sạch, Vitest `13 passed`; eslint `0 errors` (7 warnings).

- [ ] **Step 6: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/src/__tests__/template-pipeline-integration.test.ts \
  packages/printer-core/src/layout/ApproximateFontMetrics.ts \
  packages/printer-core/src/layout/LayoutConfig.ts \
  packages/printer-core/src/layout/LayoutEngine.ts \
  packages/printer-core/src/layout/LayoutResult.ts \
  packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts \
  packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts \
  packages/printer-core/src/layout/index.ts \
  packages/printer-preview/src/__tests__/pipeline.test.ts \
  packages/printer-preview/src/components/PreviewPanel.tsx \
  packages/printer-preview/src/pipeline.ts
git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: print text at template size and warn on paper overflow" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Task 2: `TemplateDocument` = metadata + settings + content

**Files:**
- Create: `template/PaperSize.ts`, `template/TemplateMetadata.ts`, `template/settings/{StyleSetting,OptionSetting,TemplateSettings,index}.ts`, `template/parse/validateMetadata.ts`, `template/parse/validateSettings.ts`, `template/builder/TemplateMetadataInput.ts`, `template/builder/TemplateSettingsInput.ts`, `template/builder/toTemplateSettings.ts`
- Modify: `template/TemplateDocument.ts`, `template/index.ts`, `template/parse/{JsonCursor,validateStyle,validateTemplateStructure,validateTemplateAgainstData}.ts`, `template/data/{TemplateDataDefinition,TemplateDataDescription}.ts` (comment), `template/builder/{TemplateDocumentBuilder,index}.ts`, `resolution/{DocumentResolver,collectAssetIds}.ts`, `layout/LayoutConfig.ts` (comment), `packages/printer-preview/src/{pipeline,defaultSample}.ts`
- Test: `template/parse/__tests__/{parseTemplate,validateTemplateAgainstData}.test.ts`, `resolution/__tests__/{DocumentResolver,collectAssetIds}.test.ts`, `template/builder/__tests__/TemplateDocumentBuilder.test.ts`, `__tests__/template-pipeline-integration.test.ts`, `packages/printer-preview/src/__tests__/{pipeline,evaluateTemplate}.test.ts`

(Đường dẫn trong `printer-core` tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `LayoutConfig = { paper, dpi }` (Task 1).
- Produces (barrel `template`):
  - `TemplateDocument { schemaVersion: 1; metadata: TemplateMetadata; settings: TemplateSettings; content: TemplateNode }`.
  - `TemplateMetadata { id; name; kind: TemplateKind; locale: TemplateLocale; paper: PaperSize }`, `TemplateKind = 'label' | 'receipt'` (thay `TemplateMedia`). Không còn `dataId`.
  - `TemplateSettings { styles: Record<string, StyleSetting>; options: Record<string, OptionSetting> }`; `StyleSetting { label; value: TextStyle; default: TextStyle }`; `OptionSetting = BooleanOptionSetting | TextOptionSetting | ChoiceOptionSetting` (`label`, `type`, `value`, `default`; `choice` thêm `choices: OptionChoice[]`); `OptionSettingType`.
  - Validate cấu trúc: đường dẫn lỗi bắt đầu bằng `metadata.`, `settings.`, `content.`.
  - DSL: `labelTemplate/receiptTemplate(data).metadata({ id, name, paper, locale? })`, `.settings({ styles?, options? })` (`default` bỏ trống = `value`), `.content(...)` (thay `.id/.name/.paper/.root`). Lỗi thiếu: `Template cần .metadata(...)`, `Template cần .content(...)`. Kiểu input: `TemplateMetadataInput`, `TemplateSettingsInput`, `StyleSettingInput`, `OptionSettingInput`, `PaperFor`.
  - `DocumentResolver.resolve` không còn so mã dữ liệu; đọc `template.content`.

- [ ] **Step 1: Viết/sửa test (patch `t2test`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-29-template-settings.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t2test | git apply --ignore-whitespace -
```

<!-- patch:t2test -->
~~~diff
diff --git a/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts b/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
index 7da5b20..492fd21 100644
--- a/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
+++ b/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
@@ -27,10 +27,8 @@ const PRINTER_DPI = 203;
 
 function buildReceipt() {
   return receiptTemplate(TEST_ORDER_DATA)
-    .id('receipt-default')
-    .name('Hoá đơn mặc định')
-    .paper({ widthMm: 72 })
-    .root((scope) =>
+    .metadata({ id: 'receipt-default', name: 'Hoá đơn mặc định', paper: { widthMm: 72 } })
+    .content((scope) =>
       column()
         .gap(mm(1))
         .children(
@@ -61,7 +59,7 @@ describe('pipeline template → resolve → layout → compile', () => {
     expect(pages).toHaveLength(1);
     if (pages[0].status !== 'ok') throw new Error(pages[0].message);
 
-    const config = { paper: template.paper, dpi: PRINTER_DPI };
+    const config = { paper: template.metadata.paper, dpi: PRINTER_DPI };
     const { elements } = createLayoutEngine().resolve(pages[0].node, config, new ApproximateFontMetrics());
 
     expect(elements.some((element) => element.type === 'text' && element.content === 'Bàn Bàn 5')).toBe(true);
@@ -74,7 +72,7 @@ describe('pipeline template → resolve → layout → compile', () => {
       expect.objectContaining({ type: 'barcode', options: expect.objectContaining({ height: 64 }) }),
     );
 
-    const paper = paperSizeToDots(template.paper, PRINTER_DPI);
+    const paper = paperSizeToDots(template.metadata.paper, PRINTER_DPI);
     const bytes = new EscPosCompiler().compile({
       widthDots: paper.widthDots,
       heightDots: paper.heightDots ?? 0,
@@ -97,10 +95,8 @@ describe('pipeline template → resolve → layout → compile', () => {
 
   it('tem món nhiều topping tách sang tem tiếp: JSON round-trip → resolve → layout từng tem', () => {
     const built = labelTemplate(TEST_ORDER_DATA)
-      .id('split-label')
-      .name('Tem tách topping')
-      .paper({ widthMm: 50, heightMm: 30 })
-      .root((scope) =>
+      .metadata({ id: 'split-label', name: 'Tem tách topping', paper: { widthMm: 50, heightMm: 30 } })
+      .content((scope) =>
         scope
           .repeat({ collection: 'items', expand: 'quantity' }, (item) =>
             column().children(
@@ -133,7 +129,7 @@ describe('pipeline template → resolve → layout → compile', () => {
       assets: { get: () => undefined },
     });
 
-    const config = { paper: template.paper, dpi: PRINTER_DPI };
+    const config = { paper: template.metadata.paper, dpi: PRINTER_DPI };
     const texts = pages.map((page) => {
       if (page.status !== 'ok') throw new Error(page.message);
       const { elements } = createLayoutEngine().resolve(page.node, config, new ApproximateFontMetrics());
diff --git a/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts b/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
index f50a6d5..e91d066 100644
--- a/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
+++ b/packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
@@ -1,5 +1,5 @@
 import { createDocumentResolver, type AssetProvider, type ResolvedNode, type ResolvedPage } from '..';
-import type { TemplateDocument, TemplateMedia, TemplateNode, TextNode } from '../../template';
+import type { TemplateDocument, TemplateKind, TemplateNode, TextNode } from '../../template';
 import { defineCollection, defineTemplateData } from '../../template/data';
 import {
   TEST_ORDER_DATA,
@@ -16,16 +16,18 @@ const LOGO_ASSETS: AssetProvider = { get: (assetId) => (assetId === 'store-logo@
 
 const resolver = createDocumentResolver();
 
-function documentWith(root: TemplateNode, media: TemplateMedia = 'receipt'): TemplateDocument {
+function documentWith(content: TemplateNode, kind: TemplateKind = 'receipt'): TemplateDocument {
   return {
     schemaVersion: 1,
-    id: 'template',
-    name: 'Template',
-    dataId: 'test-order',
-    media,
-    locale: 'vi-VN',
-    paper: media === 'label' ? { widthMm: 50, heightMm: 30 } : { widthMm: 72 },
-    root,
+    metadata: {
+      id: 'template',
+      name: 'Template',
+      kind,
+      locale: 'vi-VN',
+      paper: kind === 'label' ? { widthMm: 50, heightMm: 30 } : { widthMm: 72 },
+    },
+    settings: { styles: {}, options: {} },
+    content,
   };
 }
 
@@ -154,15 +156,12 @@ describe('DocumentResolver — scope tường minh', () => {
       variables: { orderCode: { label: 'Mã đơn', type: 'string', get: (order) => order.code } },
       collections: { lines },
     });
-    const template: TemplateDocument = {
-      ...documentWith({
-        type: 'repeat',
-        id: 'lines',
-        collection: 'lines',
-        template: { type: 'text', id: 'text', content: [{ var: 'orderCode' }, { text: '/' }, { var: 'lineCode' }] },
-      }),
-      dataId: 'shadow',
-    };
+    const template = documentWith({
+      type: 'repeat',
+      id: 'lines',
+      collection: 'lines',
+      template: { type: 'text', id: 'text', content: [{ var: 'orderCode' }, { text: '/' }, { var: 'lineCode' }] },
+    });
 
     const [page] = resolver.resolve(template, templateData.sample, { templateData, assets: NO_ASSETS });
 
@@ -678,15 +677,3 @@ describe('DocumentResolver — ảnh', () => {
     expect(statuses).toEqual(['ok', 'ok', 'ok', 'error', 'error']);
   });
 });
-
-describe('DocumentResolver — dữ liệu template', () => {
-  it('throw khi template dùng dữ liệu khác dữ liệu truyền vào', () => {
-    const template = { ...documentWith({ type: 'text', id: 't', content: [] }), dataId: 'kitchen' };
-
-    const options = { templateData: TEST_ORDER_DATA, assets: NO_ASSETS };
-
-    expect(() => resolver.resolve(template, TEST_ORDER_SAMPLE, options)).toThrow(
-      'Template dùng dữ liệu "kitchen", không phải "test-order"',
-    );
-  });
-});
diff --git a/packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts b/packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts
index fb69d4b..7a4ee84 100644
--- a/packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts
+++ b/packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts
@@ -4,13 +4,15 @@ import { TEST_ORDER_DATA, TEST_ORDER_SAMPLE } from '../../testing';
 
 const TEMPLATE: TemplateDocument = {
   schemaVersion: 1,
-  id: 'template',
-  name: 'Template',
-  dataId: 'test-order',
-  media: 'receipt',
-  locale: 'vi-VN',
-  paper: { widthMm: 72 },
-  root: {
+  metadata: {
+    id: 'template',
+    name: 'Template',
+    kind: 'receipt',
+    locale: 'vi-VN',
+    paper: { widthMm: 72 },
+  },
+  settings: { styles: {}, options: {} },
+  content: {
     type: 'container',
     id: 'root',
     children: [
diff --git a/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts b/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
index febfca9..da744c4 100644
--- a/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
+++ b/packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts
@@ -15,10 +15,8 @@ import { TEST_ORDER_DATA } from '../../../testing';
 
 function buildProductLabel() {
   return labelTemplate(TEST_ORDER_DATA)
-    .id('product-label-default')
-    .name('Tem món mặc định')
-    .paper({ widthMm: 50, heightMm: 30 })
-    .root((scope) =>
+    .metadata({ id: 'product-label-default', name: 'Tem món mặc định', paper: { widthMm: 50, heightMm: 30 } })
+    .content((scope) =>
       scope
         .repeat({ collection: 'items', expand: 'quantity' }, (item) =>
           column()
@@ -41,13 +39,15 @@ describe('labelTemplate / receiptTemplate', () => {
 
     expect(template).toEqual({
       schemaVersion: 1,
-      id: 'product-label-default',
-      name: 'Tem món mặc định',
-      dataId: 'test-order',
-      media: 'label',
-      locale: 'vi-VN',
-      paper: { widthMm: 50, heightMm: 30 },
-      root: {
+      metadata: {
+        id: 'product-label-default',
+        name: 'Tem món mặc định',
+        kind: 'label',
+        locale: 'vi-VN',
+        paper: { widthMm: 50, heightMm: 30 },
+      },
+      settings: { styles: {}, options: {} },
+      content: {
         type: 'repeat',
         id: 'repeat-1',
         collection: 'items',
@@ -90,22 +90,18 @@ describe('labelTemplate / receiptTemplate', () => {
 
   it('receipt không có chiều cao giấy', () => {
     const template = receiptTemplate(TEST_ORDER_DATA)
-      .id('receipt')
-      .name('Hoá đơn')
-      .paper({ widthMm: 72 })
-      .root((scope) => text([{ text: 'Mã đơn: ' }, scope.var('orderCode')]))
+      .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
+      .content((scope) => text([{ text: 'Mã đơn: ' }, scope.var('orderCode')]))
       .build();
 
-    expect(template.media).toBe('receipt');
-    expect(template.paper).toEqual({ widthMm: 72 });
+    expect(template.metadata.kind).toBe('receipt');
+    expect(template.metadata.paper).toEqual({ widthMm: 72 });
   });
 
   it('throw TemplateBuildError khi segment viết tay dùng biến sai scope', () => {
     const builder = receiptTemplate(TEST_ORDER_DATA)
-      .id('receipt')
-      .name('Hoá đơn')
-      .paper({ widthMm: 72 })
-      .root(text([{ var: 'itemName' }]));
+      .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
+      .content(text([{ var: 'itemName' }]));
 
     expect(() => builder.build()).toThrow(TemplateBuildError);
     expect(() => builder.build()).toThrow('biến "itemName" chỉ dùng được trong vòng lặp "Danh sách món"');
@@ -114,32 +110,66 @@ describe('labelTemplate / receiptTemplate', () => {
   it('không throw khi chỉ có cảnh báo deprecated', () => {
     const build = () =>
       receiptTemplate(TEST_ORDER_DATA)
-        .id('receipt')
-        .name('Hoá đơn')
-        .paper({ widthMm: 72 })
-        .root((scope) => scope.repeat({ collection: 'items' }, (item) => text([item.var('legacyItemName')])))
+        .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
+        .content((scope) => scope.repeat({ collection: 'items' }, (item) => text([item.var('legacyItemName')])))
         .build();
 
     expect(build).not.toThrow();
   });
 
-  it('throw khi thiếu id, name, paper hoặc root', () => {
-    expect(() => receiptTemplate(TEST_ORDER_DATA).build()).toThrow('Template cần .id(...)');
-    expect(() => receiptTemplate(TEST_ORDER_DATA).id('x').build()).toThrow('Template cần .name(...)');
-    expect(() => receiptTemplate(TEST_ORDER_DATA).id('x').name('x').build()).toThrow('Template cần .paper(...)');
-    expect(() => receiptTemplate(TEST_ORDER_DATA).id('x').name('x').paper({ widthMm: 72 }).build()).toThrow(
-      'Template cần .root(...)',
-    );
+  it('throw khi thiếu metadata hoặc content', () => {
+    const metadata = { id: 'x', name: 'x', paper: { widthMm: 72 } };
+
+    expect(() => receiptTemplate(TEST_ORDER_DATA).content(text('x')).build()).toThrow('Template cần .metadata(...)');
+    expect(() => receiptTemplate(TEST_ORDER_DATA).metadata(metadata).build()).toThrow('Template cần .content(...)');
+  });
+
+  it('settings: default bỏ trống lấy bằng value, default khai báo thì giữ nguyên', () => {
+    const template = receiptTemplate(TEST_ORDER_DATA)
+      .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
+      .settings({
+        styles: { itemName: { label: 'Tên món', value: { fontSize: px(16) } } },
+        options: {
+          showPrice: { label: 'In giá món', type: 'boolean', value: false, default: true },
+          footerText: { label: 'Dòng cuối', type: 'text', value: 'Cảm ơn quý khách' },
+        },
+      })
+      .content(text('x'))
+      .build();
+
+    expect(template.settings).toEqual({
+      styles: { itemName: { label: 'Tên món', value: { fontSize: px(16) }, default: { fontSize: px(16) } } },
+      options: {
+        showPrice: { label: 'In giá món', type: 'boolean', value: false, default: true },
+        footerText: { label: 'Dòng cuối', type: 'text', value: 'Cảm ơn quý khách', default: 'Cảm ơn quý khách' },
+      },
+    });
+    expect(parseTemplate(JSON.parse(JSON.stringify(template)))).toEqual({ ok: true, template });
+  });
+
+  it('throw TemplateBuildError khi settings không hợp lệ', () => {
+    const builder = receiptTemplate(TEST_ORDER_DATA)
+      .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
+      .settings({
+        options: {
+          priceStyle: { label: 'Kiểu giá', type: 'choice', choices: [{ value: 'short', label: '45k' }], value: 'full' },
+        },
+      })
+      .content(text('x'));
+
+    expect(() => builder.build()).toThrow('settings.options.priceStyle.value');
   });
 
   it('TypeScript chặn tên biến sai, biến sai scope và khổ giấy sai loại', () => {
     const checkTypesOnly = () => {
       // @ts-expect-error label bắt buộc heightMm
-      labelTemplate(TEST_ORDER_DATA).paper({ widthMm: 50 });
+      labelTemplate(TEST_ORDER_DATA).metadata({ id: 'x', name: 'x', paper: { widthMm: 50 } });
       // @ts-expect-error receipt không có heightMm
-      receiptTemplate(TEST_ORDER_DATA).paper({ widthMm: 72, heightMm: 30 });
+      receiptTemplate(TEST_ORDER_DATA).metadata({ id: 'x', name: 'x', paper: { widthMm: 72, heightMm: 30 } });
+      // @ts-expect-error thiếu name
+      receiptTemplate(TEST_ORDER_DATA).metadata({ id: 'x', paper: { widthMm: 72 } });
 
-      receiptTemplate(TEST_ORDER_DATA).root((scope) => {
+      receiptTemplate(TEST_ORDER_DATA).content((scope) => {
         // @ts-expect-error tên biến sai
         scope.var('orderCod');
         // @ts-expect-error biến của collection không dùng được ở gốc
@@ -160,10 +190,8 @@ describe('labelTemplate / receiptTemplate', () => {
 
   it('maxItemsPerPage trên repeat lồng và biến $part/$partCount ra đúng JSON, qua được parseTemplate', () => {
     const template = labelTemplate(TEST_ORDER_DATA)
-      .id('split-label')
-      .name('Tem tách topping')
-      .paper({ widthMm: 50, heightMm: 30 })
-      .root((scope) =>
+      .metadata({ id: 'split-label', name: 'Tem tách topping', paper: { widthMm: 50, heightMm: 30 } })
+      .content((scope) =>
         scope
           .repeat({ collection: 'items', expand: 'quantity' }, (item) =>
             column().children(
@@ -179,7 +207,7 @@ describe('labelTemplate / receiptTemplate', () => {
       )
       .build();
 
-    const outer = template.root;
+    const outer = template.content;
     if (outer.type !== 'repeat' || outer.template.type !== 'container') throw new Error('cấu trúc sai');
     expect(outer.template.children[1]).toMatchObject({ type: 'repeat', collection: 'toppings', maxItemsPerPage: 4 });
     expect(outer.template.children[2]).toMatchObject({ visibleWhen: { op: 'gt', var: '$partCount', value: 1 } });
diff --git a/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts b/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
index aaf9d57..5e2591f 100644
--- a/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
+++ b/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
@@ -3,13 +3,15 @@ import { parseTemplate } from '..';
 function validLabelJson(): Record<string, unknown> {
   return {
     schemaVersion: 1,
-    id: 'product-label-default',
-    name: 'Tem món mặc định',
-    dataId: 'test-order',
-    media: 'label',
-    locale: 'vi-VN',
-    paper: { widthMm: 50, heightMm: 30 },
-    root: {
+    metadata: {
+      id: 'product-label-default',
+      name: 'Tem món mặc định',
+      kind: 'label',
+      locale: 'vi-VN',
+      paper: { widthMm: 50, heightMm: 30 },
+    },
+    settings: { styles: {}, options: {} },
+    content: {
       type: 'container',
       id: 'root',
       style: { direction: 'column', gap: { value: 1, unit: 'mm' }, padding: uniformInsets(2) },
@@ -42,10 +44,21 @@ function uniformInsets(valueMm: number): Record<string, unknown> {
   return { top: side, right: side, bottom: side, left: side };
 }
 
-function withRoot(root: unknown): Record<string, unknown> {
-  return { ...validLabelJson(), root };
+function withContent(content: unknown): Record<string, unknown> {
+  return { ...validLabelJson(), content };
+}
+
+function withMetadata(overrides: Record<string, unknown>): Record<string, unknown> {
+  const json = validLabelJson();
+  return { ...json, metadata: { ...(json.metadata as Record<string, unknown>), ...overrides } };
 }
 
+function withSettings(settings: unknown): Record<string, unknown> {
+  return { ...validLabelJson(), settings };
+}
+
+const FONT_SIZE = { value: 16, unit: 'px' };
+
 function issuePaths(json: unknown): readonly string[] {
   const result = parseTemplate(json);
   return result.ok ? [] : result.issues.map((issue) => issue.path);
@@ -108,41 +121,31 @@ describe('parseTemplate', () => {
     expect(older).toEqual({ ok: false, issues: [{ path: 'schemaVersion', message: 'phải là 1' }] });
   });
 
-  it('từ chối template JSON còn field `catalog` thay cho `dataId`', () => {
-    const json: Record<string, unknown> = { ...validLabelJson(), catalog: 'test-order' };
-    delete json.dataId;
-
-    expect(parseTemplate(json)).toEqual({
-      ok: false,
-      issues: [{ path: 'dataId', message: 'phải là chuỗi khác rỗng' }],
-    });
-  });
-
   it('báo lỗi đơn vị độ dài sai kèm path chính xác', () => {
-    const json = withRoot({
+    const json = withContent({
       type: 'container',
       id: 'root',
       style: { padding: { ...uniformInsets(2), top: { value: 2, unit: 'cm' } } },
       children: [],
     });
 
-    expect(issuePaths(json)).toEqual(['root.style.padding.top.unit']);
+    expect(issuePaths(json)).toEqual(['content.style.padding.top.unit']);
   });
 
   it('báo lỗi độ dài âm', () => {
-    const json = withRoot({ type: 'line', id: 'line', thickness: { value: -1, unit: 'mm' } });
+    const json = withContent({ type: 'line', id: 'line', thickness: { value: -1, unit: 'mm' } });
 
-    expect(issuePaths(json)).toEqual(['root.thickness.value']);
+    expect(issuePaths(json)).toEqual(['content.thickness.value']);
   });
 
   it('báo lỗi loại node lạ thay vì bỏ qua', () => {
-    const json = withRoot({ type: 'container', id: 'root', children: [{ type: 'table', id: 't' }] });
+    const json = withContent({ type: 'container', id: 'root', children: [{ type: 'table', id: 't' }] });
 
-    expect(issuePaths(json)).toEqual(['root.children[0].type']);
+    expect(issuePaths(json)).toEqual(['content.children[0].type']);
   });
 
   it('báo lỗi id node trùng', () => {
-    const json = withRoot({
+    const json = withContent({
       type: 'container',
       id: 'root',
       children: [
@@ -151,32 +154,47 @@ describe('parseTemplate', () => {
       ],
     });
 
-    expect(issuePaths(json)).toEqual(['root.children[1].id']);
+    expect(issuePaths(json)).toEqual(['content.children[1].id']);
+  });
+
+  it('bắt buộc metadata và content', () => {
+    const json = validLabelJson();
+    delete json.metadata;
+    delete json.content;
+
+    expect(issuesOf(json)).toEqual([
+      { path: 'metadata', message: 'phải là object' },
+      { path: 'content', message: 'phải là object' },
+    ]);
+  });
+
+  it('báo lỗi kind lạ', () => {
+    expect(issuePaths(withMetadata({ kind: 'kitchen' }))).toEqual(['metadata.kind']);
   });
 
   it('bắt buộc chiều cao với label và cấm chiều cao với receipt', () => {
-    expect(issuePaths({ ...validLabelJson(), paper: { widthMm: 50 } })).toEqual(['paper.heightMm']);
-    expect(issuePaths({ ...validLabelJson(), media: 'receipt' })).toEqual(['paper.heightMm']);
+    expect(issuePaths(withMetadata({ paper: { widthMm: 50 } }))).toEqual(['metadata.paper.heightMm']);
+    expect(issuePaths(withMetadata({ kind: 'receipt' }))).toEqual(['metadata.paper.heightMm']);
   });
 
   it('báo lỗi segment không có text lẫn var, và format sai loại', () => {
-    const json = withRoot({
+    const json = withContent({
       type: 'text',
       id: 'text',
       content: [{}, { var: 'orderCode', format: { type: 'percent' } }],
     });
 
-    expect(issuePaths(json)).toEqual(['root.content[0]', 'root.content[1].format.type']);
+    expect(issuePaths(json)).toEqual(['content.content[0]', 'content.content[1].format.type']);
   });
 
   it('báo lỗi segment có cả text lẫn var', () => {
-    const json = withRoot({ type: 'text', id: 'text', content: [{ text: 'x', var: 'orderCode' }] });
+    const json = withContent({ type: 'text', id: 'text', content: [{ text: 'x', var: 'orderCode' }] });
 
-    expect(issuePaths(json)).toEqual(['root.content[0]']);
+    expect(issuePaths(json)).toEqual(['content.content[0]']);
   });
 
   it('báo lỗi điều kiện sai dạng, kể cả điều kiện lồng', () => {
-    const json = withRoot({
+    const json = withContent({
       type: 'text',
       id: 'text',
       content: [],
@@ -184,51 +202,51 @@ describe('parseTemplate', () => {
     });
 
     expect(issuePaths(json)).toEqual([
-      'root.visibleWhen.conditions[0].value',
-      'root.visibleWhen.conditions[1].op',
+      'content.visibleWhen.conditions[0].value',
+      'content.visibleWhen.conditions[1].op',
     ]);
   });
 
   it('báo lỗi ảnh khai báo cả asset lẫn var', () => {
-    const json = withRoot({ type: 'image', id: 'logo', source: { asset: 'logo@v1', var: 'storeLogo' } });
+    const json = withContent({ type: 'image', id: 'logo', source: { asset: 'logo@v1', var: 'storeLogo' } });
 
-    expect(issuePaths(json)).toEqual(['root.source']);
+    expect(issuePaths(json)).toEqual(['content.source']);
   });
 
   it('báo lỗi repeat thiếu collection và maxItemsPerPage không phải số nguyên dương', () => {
-    const json = withRoot({
+    const json = withContent({
       type: 'repeat',
       id: 'items',
       maxItemsPerPage: 0,
       template: { type: 'text', id: 'name', content: [] },
     });
 
-    expect(issuePaths(json)).toEqual(['root.collection', 'root.maxItemsPerPage']);
+    expect(issuePaths(json)).toEqual(['content.collection', 'content.maxItemsPerPage']);
   });
 
   it('chấp nhận repeat lồng tách tem khi repeat ngoài cùng có maxItemsPerPage là 1', () => {
-    const json = withRoot(itemRepeatJson('items', toppingRepeatJson(toppingNameJson(), 4), 1));
+    const json = withContent(itemRepeatJson('items', toppingRepeatJson(toppingNameJson(), 4), 1));
 
     expect(issuesOf(json)).toEqual([]);
   });
 
   it('báo lỗi repeat lồng tách tem khi repeat ngoài cùng có maxItemsPerPage khác 1', () => {
-    const json = withRoot(itemRepeatJson('items', toppingRepeatJson(toppingNameJson(), 4), 2));
+    const json = withContent(itemRepeatJson('items', toppingRepeatJson(toppingNameJson(), 4), 2));
 
     expect(issuesOf(json)).toEqual([
       {
-        path: 'root.template.maxItemsPerPage',
+        path: 'content.template.maxItemsPerPage',
         message: 'repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage là 1',
       },
     ]);
   });
 
   it('báo lỗi repeat lồng tách tem khi repeat ngoài cùng không phân trang', () => {
-    const json = withRoot(itemRepeatJson('items', toppingRepeatJson(toppingNameJson(), 4)));
+    const json = withContent(itemRepeatJson('items', toppingRepeatJson(toppingNameJson(), 4)));
 
     expect(issuesOf(json)).toEqual([
       {
-        path: 'root.template.maxItemsPerPage',
+        path: 'content.template.maxItemsPerPage',
         message: 'repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage',
       },
     ]);
@@ -236,17 +254,17 @@ describe('parseTemplate', () => {
 
   it('báo lỗi maxItemsPerPage ở repeat lồng từ tầng 2 trở xuống', () => {
     const deeper = { ...toppingRepeatJson(toppingNameJson(), 2), id: 'deeper' };
-    const json = withRoot(itemRepeatJson('items', toppingRepeatJson(deeper), 1));
+    const json = withContent(itemRepeatJson('items', toppingRepeatJson(deeper), 1));
 
     expect(issuesOf(json)).toEqual([
-      { path: 'root.template.template.maxItemsPerPage', message: 'chỉ tách tem được repeat lồng 1 tầng' },
+      { path: 'content.template.template.maxItemsPerPage', message: 'chỉ tách tem được repeat lồng 1 tầng' },
     ]);
   });
 
   it('báo lỗi khi hơn 1 repeat ngoài cùng chứa repeat lồng tách tem', () => {
     const secondName = { ...toppingNameJson(), id: 'second-topping-name' };
     const secondToppings = { ...toppingRepeatJson(secondName, 4), id: 'second-toppings' };
-    const json = withRoot({
+    const json = withContent({
       type: 'container',
       id: 'root',
       children: [
@@ -256,14 +274,14 @@ describe('parseTemplate', () => {
     });
 
     expect(issuesOf(json)).toEqual([
-      { path: 'root.children[1]', message: 'chỉ 1 repeat ngoài cùng được chứa repeat lồng có maxItemsPerPage' },
+      { path: 'content.children[1]', message: 'chỉ 1 repeat ngoài cùng được chứa repeat lồng có maxItemsPerPage' },
     ]);
   });
 
   it('không báo trùng lỗi MULTIPLE_CARRIERS khi repeat ngoài cùng thứ 2 chưa phân trang', () => {
     const unpagedName = { ...toppingNameJson(), id: 'unpaged-topping-name' };
     const unpagedToppings = { ...toppingRepeatJson(unpagedName, 4), id: 'unpaged-toppings' };
-    const json = withRoot({
+    const json = withContent({
       type: 'container',
       id: 'root',
       children: [
@@ -274,9 +292,98 @@ describe('parseTemplate', () => {
 
     expect(issuesOf(json)).toEqual([
       {
-        path: 'root.children[1].template.maxItemsPerPage',
+        path: 'content.children[1].template.maxItemsPerPage',
         message: 'repeat lồng chỉ tách tem được khi repeat ngoài cùng có maxItemsPerPage',
       },
     ]);
   });
 });
+
+describe('parseTemplate — settings', () => {
+  it('chấp nhận style có tên và đủ 3 loại option hợp lệ', () => {
+    const json = withSettings({
+      styles: {
+        itemName: {
+          label: 'Tên món',
+          value: { fontSize: FONT_SIZE, fontWeight: 'bold' },
+          default: { fontSize: FONT_SIZE },
+        },
+      },
+      options: {
+        showPrice: { label: 'In giá món', type: 'boolean', value: false, default: true },
+        footerText: { label: 'Dòng cuối', type: 'text', value: 'Wifi: abc', default: 'Cảm ơn quý khách' },
+        priceStyle: {
+          label: 'Kiểu giá',
+          type: 'choice',
+          choices: [
+            { value: 'short', label: '45k' },
+            { value: 'full', label: '45.000đ' },
+          ],
+          value: 'short',
+          default: 'full',
+        },
+      },
+    });
+
+    expect(issuesOf(json)).toEqual([]);
+  });
+
+  it('bắt buộc có settings', () => {
+    const json = validLabelJson();
+    delete json.settings;
+
+    expect(issuesOf(json)).toEqual([{ path: 'settings', message: 'phải là object' }]);
+  });
+
+  it('báo lỗi style thiếu nhãn hoặc value, và thuộc tính chữ sai', () => {
+    const json = withSettings({ styles: { itemName: { label: '', default: { fontWeight: 'heavy' } } }, options: {} });
+
+    expect(issuesOf(json)).toEqual([
+      { path: 'settings.styles.itemName.label', message: 'phải là chuỗi khác rỗng' },
+      { path: 'settings.styles.itemName.value', message: 'phải là object' },
+      { path: 'settings.styles.itemName.default.fontWeight', message: 'phải là 1 trong: "normal", "bold"' },
+    ]);
+  });
+
+  it('báo lỗi option sai kiểu giá trị theo loại, và loại option lạ', () => {
+    const json = withSettings({
+      styles: {},
+      options: {
+        showPrice: { label: 'In giá', type: 'boolean', value: 'yes', default: true },
+        footerText: { label: 'Dòng cuối', type: 'text', value: 'x', default: 1 },
+        mode: { label: 'Chế độ', type: 'slider', value: 1, default: 1 },
+      },
+    });
+
+    expect(issuesOf(json)).toEqual([
+      { path: 'settings.options.showPrice.value', message: 'phải là true hoặc false' },
+      { path: 'settings.options.footerText.default', message: 'phải là chuỗi' },
+      { path: 'settings.options.mode.type', message: 'phải là 1 trong: "boolean", "text", "choice"' },
+    ]);
+  });
+
+  it('báo lỗi option choice rỗng, lựa chọn trùng, và giá trị ngoài danh sách', () => {
+    const json = withSettings({
+      styles: {},
+      options: {
+        empty: { label: 'Rỗng', type: 'choice', choices: [], value: 'a', default: 'a' },
+        priceStyle: {
+          label: 'Kiểu giá',
+          type: 'choice',
+          choices: [
+            { value: 'short', label: '45k' },
+            { value: 'short', label: 'Ngắn' },
+          ],
+          value: 'full',
+          default: 'short',
+        },
+      },
+    });
+
+    expect(issuesOf(json)).toEqual([
+      { path: 'settings.options.empty.choices', message: 'phải có ít nhất 1 lựa chọn' },
+      { path: 'settings.options.priceStyle.choices[1].value', message: 'giá trị "short" bị trùng' },
+      { path: 'settings.options.priceStyle.value', message: 'phải là 1 trong: "short"' },
+    ]);
+  });
+});
diff --git a/packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts b/packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts
index 18fa180..9e16b74 100644
--- a/packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts
+++ b/packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts
@@ -7,13 +7,15 @@ const description = TEST_ORDER_DATA.describe();
 function documentWithRoot(root: TemplateNode): TemplateDocument {
   return {
     schemaVersion: 1,
-    id: 'template',
-    name: 'Template',
-    dataId: 'test-order',
-    media: 'receipt',
-    locale: 'vi-VN',
-    paper: { widthMm: 72 },
-    root,
+    metadata: {
+      id: 'template',
+      name: 'Template',
+      kind: 'receipt',
+      locale: 'vi-VN',
+      paper: { widthMm: 72 },
+    },
+    settings: { styles: {}, options: {} },
+    content: root,
   };
 }
 
@@ -59,17 +61,6 @@ describe('validateTemplateAgainstData', () => {
     expect(result).toEqual({ errors: [], warnings: [] });
   });
 
-  it('báo lỗi khi template dùng dữ liệu khác', () => {
-    const result = validateTemplateAgainstData(
-      { ...documentWithRoot(textOf('orderCode')), dataId: 'kitchen-ticket' },
-      description,
-    );
-
-    expect(result.errors).toEqual([
-      { path: 'dataId', message: 'template dùng dữ liệu "kitchen-ticket", không phải "test-order"' },
-    ]);
-  });
-
   it('báo lỗi biến không có trong dữ liệu template', () => {
     expect(errorsOf(textOf('missing'))).toEqual(['dữ liệu template "test-order" không có biến "missing"']);
   });
@@ -78,7 +69,7 @@ describe('validateTemplateAgainstData', () => {
     const result = validateTemplateAgainstData(documentWithRoot(textOf('itemName')), description);
 
     expect(result.errors).toEqual([
-      { path: 'root.content[0]', message: 'biến "itemName" chỉ dùng được trong vòng lặp "Danh sách món"' },
+      { path: 'content.content[0]', message: 'biến "itemName" chỉ dùng được trong vòng lặp "Danh sách món"' },
     ]);
   });
 
@@ -144,7 +135,7 @@ describe('validateTemplateAgainstData', () => {
 
     expect(result.errors).toEqual([]);
     expect(result.warnings).toEqual([
-      { path: 'root.template.content[0]', message: 'biến "legacyItemName" đã ngừng dùng: Dùng itemName' },
+      { path: 'content.template.content[0]', message: 'biến "legacyItemName" đã ngừng dùng: Dùng itemName' },
     ]);
   });
 });
diff --git a/packages/printer-preview/src/__tests__/evaluateTemplate.test.ts b/packages/printer-preview/src/__tests__/evaluateTemplate.test.ts
index b26c51e..0a65710 100644
--- a/packages/printer-preview/src/__tests__/evaluateTemplate.test.ts
+++ b/packages/printer-preview/src/__tests__/evaluateTemplate.test.ts
@@ -24,18 +24,16 @@ describe('evaluateTemplate', () => {
     const code = `${TEMPLATE_DATA_CODE}
       import { labelTemplate, text } from 'printer-core';
       export default labelTemplate(templateData)
-        .id('label')
-        .name('Tem')
-        .paper({ widthMm: 50, heightMm: 30 })
-        .root((scope) => text([scope.var('title')]))
+        .metadata({ id: 'label', name: 'Tem', paper: { widthMm: 50, heightMm: 30 } })
+        .content((scope) => text([scope.var('title')]))
         .build();
     `;
     const result = evaluateTemplate(code);
 
     expect(result.status).toBe('ok');
     if (result.status !== 'ok') return;
-    expect(result.template.media).toBe('label');
-    expect(result.template.paper).toEqual({ widthMm: 50, heightMm: 30 });
+    expect(result.template.metadata.kind).toBe('label');
+    expect(result.template.metadata.paper).toEqual({ widthMm: 50, heightMm: 30 });
     expect(result.templateData.id).toBe('demo');
   });
 
@@ -67,10 +65,8 @@ describe('evaluateTemplate', () => {
     const code = `${TEMPLATE_DATA_CODE}
       import { labelTemplate, text } from 'printer-core';
       export default labelTemplate(templateData)
-        .id('label')
-        .name('Tem')
-        .paper({ widthMm: 50, heightMm: 30 })
-        .root(text([{ var: 'itemName' }]))
+        .metadata({ id: 'label', name: 'Tem', paper: { widthMm: 50, heightMm: 30 } })
+        .content(text([{ var: 'itemName' }]))
         .build();
     `;
     const result = evaluateTemplate(code);
diff --git a/packages/printer-preview/src/__tests__/pipeline.test.ts b/packages/printer-preview/src/__tests__/pipeline.test.ts
index c03238c..20eb3ad 100644
--- a/packages/printer-preview/src/__tests__/pipeline.test.ts
+++ b/packages/printer-preview/src/__tests__/pipeline.test.ts
@@ -22,13 +22,13 @@ const templateData = defineTemplateData({
 });
 
 function label() {
-  return labelTemplate(templateData).id('label').name('Tem').paper({ widthMm: 50, heightMm: 30 });
+  return labelTemplate(templateData).metadata({ id: 'label', name: 'Tem', paper: { widthMm: 50, heightMm: 30 } });
 }
 
 describe('renderPreviews', () => {
   it('render 1 trang SVG cho label đơn giản', () => {
     const template = label()
-      .root((scope) => column().children(text([scope.var('title')])))
+      .content((scope) => column().children(text([scope.var('title')])))
       .build();
     const previews = renderPreviews(template, templateData, { title: 'Hello', items: [] }, 'tspl');
 
@@ -40,7 +40,7 @@ describe('renderPreviews', () => {
   it('trang tràn chiều cao tem vẫn render và kèm cảnh báo', () => {
     const lines = Array.from({ length: 20 }, (_, index) => text(`Dòng ${index}`));
     const template = label()
-      .root(column().children(...lines))
+      .content(column().children(...lines))
       .build();
     const [page] = renderPreviews(template, templateData, { title: 'x', items: [] }, 'tspl');
 
@@ -50,7 +50,7 @@ describe('renderPreviews', () => {
 
   it('lỗi 1 trang không ảnh hưởng trang khác', () => {
     const template = label()
-      .root((scope) =>
+      .content((scope) =>
         scope
           .repeat({ collection: 'items' }, (item) => column().children(text([item.var('itemName')])))
           .maxItemsPerPage(1),
@@ -63,12 +63,10 @@ describe('renderPreviews', () => {
   });
 
   it('defaultLanguageFor: receipt → escpos, label → tspl', () => {
-    const labelDocument = label().root(text('x')).build();
+    const labelDocument = label().content(text('x')).build();
     const receipt = receiptTemplate(templateData)
-      .id('receipt')
-      .name('Hoá đơn')
-      .paper({ widthMm: 72 })
-      .root(text('x'))
+      .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
+      .content(text('x'))
       .build();
 
     expect(defaultLanguageFor(labelDocument)).toBe('tspl');
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core
(cd packages/printer-preview && npx vitest run)
```

Expected: jest `Test Suites: 6 failed` / `Tests: 98 failed, 228 passed, 326 total` (fixture và DSL mới chưa có trong code); Vitest `6 failed | 7 passed`.

- [ ] **Step 3: Viết code (patch `t2impl`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-29-template-settings.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t2impl | git apply --ignore-whitespace -
```

<!-- patch:t2impl -->
~~~diff
diff --git a/packages/printer-core/src/layout/LayoutConfig.ts b/packages/printer-core/src/layout/LayoutConfig.ts
index ef9d904..441f76a 100644
--- a/packages/printer-core/src/layout/LayoutConfig.ts
+++ b/packages/printer-core/src/layout/LayoutConfig.ts
@@ -2,7 +2,7 @@ import type { PaperSize } from '../template';
 
 /** Thông số máy in đích để layout: khổ giấy của template + DPI của máy. */
 export interface LayoutConfig {
-  /** Khổ giấy, mm — lấy từ `TemplateDocument.paper`. */
+  /** Khổ giấy, mm — lấy từ `TemplateDocument.metadata.paper`. */
   readonly paper: PaperSize;
 
   /** Mật độ điểm của máy in, VD 203 hoặc 300. */
diff --git a/packages/printer-core/src/resolution/DocumentResolver.ts b/packages/printer-core/src/resolution/DocumentResolver.ts
index 4476b04..4bf01e7 100644
--- a/packages/printer-core/src/resolution/DocumentResolver.ts
+++ b/packages/printer-core/src/resolution/DocumentResolver.ts
@@ -9,7 +9,7 @@ import { resolveNode } from './resolveNode';
 
 /** Nguồn phụ trợ cho 1 lần resolve. */
 export interface ResolveOptions<TData> {
-  /** TemplateDataDefinition mà template dùng; `id` phải khớp `template.dataId`. */
+  /** Định nghĩa dữ liệu template dùng để đọc biến; app chọn theo `metadata.kind` của template. */
   readonly templateData: TemplateDataDefinition<TData>;
 
   /** Ảnh đã tải + decode sẵn. */
@@ -21,19 +21,12 @@ export interface ResolveOptions<TData> {
  * lặp/expand/phân trang, tra ảnh.
  */
 export class DocumentResolver {
-  /**
-   * Resolve thành các trang; lỗi data (thiếu biến bắt buộc, thiếu ảnh...) được cô lập theo trang.
-   * Throw nếu `template.dataId` khác `options.templateData.id` — đó là lỗi lập trình, không phải lỗi data.
-   */
+  /** Resolve thành các trang; lỗi data (thiếu biến bắt buộc, thiếu ảnh...) được cô lập theo trang. */
   resolve<TData>(
     template: TemplateDocument,
     data: TData,
     options: ResolveOptions<TData>,
   ): readonly ResolvedPage[] {
-    if (template.dataId !== options.templateData.id) {
-      throw new Error(`Template dùng dữ liệu "${template.dataId}", không phải "${options.templateData.id}"`);
-    }
-
     const baseContext: ResolveContext = {
       templateData: options.templateData,
       index: createTemplateDataIndex(options.templateData.describe()),
@@ -41,10 +34,10 @@ export class DocumentResolver {
       frames: [createRootFrame(data)],
       page: COUNTING_PAGE,
     };
-    const parts = planPages(template.root, baseContext);
+    const parts = planPages(template.content, baseContext);
 
     return parts.map((part, pageIndex) =>
-      resolvePage(template.root, { ...baseContext, page: pageInfo(pageIndex, parts.length, part) }),
+      resolvePage(template.content, { ...baseContext, page: pageInfo(pageIndex, parts.length, part) }),
     );
   }
 }
diff --git a/packages/printer-core/src/resolution/collectAssetIds.ts b/packages/printer-core/src/resolution/collectAssetIds.ts
index 3a33ce5..07a3f95 100644
--- a/packages/printer-core/src/resolution/collectAssetIds.ts
+++ b/packages/printer-core/src/resolution/collectAssetIds.ts
@@ -26,7 +26,7 @@ export function collectAssetIds<TData>(
     page: COUNTING_PAGE,
   };
   const assetIds = new Set<string>();
-  collectFromNode(template.root, context, assetIds);
+  collectFromNode(template.content, context, assetIds);
   return [...assetIds];
 }
 
diff --git a/packages/printer-core/src/template/PaperSize.ts b/packages/printer-core/src/template/PaperSize.ts
new file mode 100644
index 0000000..05924dc
--- /dev/null
+++ b/packages/printer-core/src/template/PaperSize.ts
@@ -0,0 +1,8 @@
+/** Khổ giấy, tính bằng mm; có `heightMm` là tem (chiều cao cố định, phân trang), không có là giấy cuộn. */
+export interface PaperSize {
+  /** Chiều rộng vùng in, mm. */
+  readonly widthMm: number;
+
+  /** Chiều cao 1 tem, mm; bỏ trống là giấy cuộn. */
+  readonly heightMm?: number;
+}
diff --git a/packages/printer-core/src/template/TemplateDocument.ts b/packages/printer-core/src/template/TemplateDocument.ts
index a4ea451..4bb7bee 100644
--- a/packages/printer-core/src/template/TemplateDocument.ts
+++ b/packages/printer-core/src/template/TemplateDocument.ts
@@ -1,46 +1,21 @@
 import type { TemplateNode } from './nodes/TemplateNode';
+import type { TemplateSettings } from './settings';
+import type { TemplateMetadata } from './TemplateMetadata';
 
 /** Phiên bản schema hiện tại của `TemplateDocument`; tăng khi đổi cấu trúc JSON, template bản cũ bị bỏ. */
 export const TEMPLATE_SCHEMA_VERSION = 1;
 
-/** Loại giấy: `label` có chiều cao cố định và phân trang, `receipt` là giấy cuộn. */
-export type TemplateMedia = 'label' | 'receipt';
-
-/** Locale quyết định dấu phân cách số; hiện chỉ hỗ trợ tiếng Việt. */
-export type TemplateLocale = 'vi-VN';
-
-/** Khổ giấy, tính bằng mm. */
-export interface PaperSize {
-  /** Chiều rộng vùng in, mm. */
-  readonly widthMm: number;
-
-  /** Chiều cao 1 tem, mm; chỉ có ở `label`. */
-  readonly heightMm?: number;
-}
-
 /** Template in dạng JSON thuần: chỉ chứa cấu trúc + placeholder, không chứa data, ảnh hay hàm. */
 export interface TemplateDocument {
   /** Phiên bản schema; phải đúng `TEMPLATE_SCHEMA_VERSION`, khác là `parseTemplate` từ chối (không migrate). */
   readonly schemaVersion: typeof TEMPLATE_SCHEMA_VERSION;
 
-  /** Mã template do người tạo đặt hoặc BE cấp. */
-  readonly id: string;
-
-  /** Tên hiển thị, VD 'Tem món mặc định'. */
-  readonly name: string;
-
-  /** Mã `TemplateDataDefinition` cung cấp biến cho template, VD 'product-label'. */
-  readonly dataId: string;
-
-  /** Loại giấy. */
-  readonly media: TemplateMedia;
-
-  /** Locale của template. */
-  readonly locale: TemplateLocale;
+  /** Thông tin chung: mã, tên, công dụng, locale, khổ giấy. */
+  readonly metadata: TemplateMetadata;
 
-  /** Khổ giấy. */
-  readonly paper: PaperSize;
+  /** Style có tên và option người dùng được chỉnh. */
+  readonly settings: TemplateSettings;
 
-  /** Node gốc. */
-  readonly root: TemplateNode;
+  /** Cây node nội dung. */
+  readonly content: TemplateNode;
 }
diff --git a/packages/printer-core/src/template/TemplateMetadata.ts b/packages/printer-core/src/template/TemplateMetadata.ts
new file mode 100644
index 0000000..0dc5d9c
--- /dev/null
+++ b/packages/printer-core/src/template/TemplateMetadata.ts
@@ -0,0 +1,25 @@
+import type { PaperSize } from './PaperSize';
+
+/** Công dụng của template, trùng `PrintType` của app: `receipt` là hoá đơn, `label` là tem. */
+export type TemplateKind = 'label' | 'receipt';
+
+/** Locale quyết định dấu phân cách số; hiện chỉ hỗ trợ tiếng Việt. */
+export type TemplateLocale = 'vi-VN';
+
+/** Thông tin chung của template. */
+export interface TemplateMetadata {
+  /** Mã template do người tạo đặt hoặc BE cấp. */
+  readonly id: string;
+
+  /** Tên hiển thị, VD 'Tem món mặc định'. */
+  readonly name: string;
+
+  /** Công dụng; app chọn dữ liệu template theo field này. */
+  readonly kind: TemplateKind;
+
+  /** Locale của template. */
+  readonly locale: TemplateLocale;
+
+  /** Khổ giấy. */
+  readonly paper: PaperSize;
+}
diff --git a/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts b/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts
index dd116bc..048a90c 100644
--- a/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts
+++ b/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts
@@ -1,19 +1,18 @@
 import type { TemplateDataDescription } from '../data';
 import { validateTemplateAgainstData, validateTemplateStructure, type TemplateIssue } from '../parse';
-import {
-  TEMPLATE_SCHEMA_VERSION,
-  type PaperSize,
-  type TemplateDocument,
-  type TemplateMedia,
-} from '../TemplateDocument';
+import { TEMPLATE_SCHEMA_VERSION, type TemplateDocument } from '../TemplateDocument';
+import type { TemplateKind, TemplateLocale } from '../TemplateMetadata';
 import { TemplateNodeIdGenerator, type BuildContext } from './BuildContext';
 import type { TemplateNodeBuilder } from './NodeBuilder';
+import type { TemplateMetadataInput } from './TemplateMetadataInput';
 import { TemplateScope } from './TemplateScope';
+import type { TemplateSettingsInput } from './TemplateSettingsInput';
+import { toTemplateSettings } from './toTemplateSettings';
 
-/** Phần dữ liệu template mà DSL cần: tên biến/collection để kiểm tra kiểu, `id` + `describe()` để validate. */
-export interface TemplateDataShape {
-  readonly id: string;
+const DEFAULT_LOCALE: TemplateLocale = 'vi-VN';
 
+/** Phần dữ liệu template mà DSL cần: tên biến/collection để kiểm tra kiểu, `describe()` để validate. */
+export interface TemplateDataShape {
   /** Biến gốc — chỉ dùng phần kiểu (tên biến) để TypeScript kiểm tra DSL, không đọc giá trị. */
   readonly variables: object;
 
@@ -30,11 +29,6 @@ export type RootScope<TTemplateData extends TemplateDataShape> = TemplateScope<
   TTemplateData['collections']
 >;
 
-/** Khổ giấy theo loại: label bắt buộc có chiều cao, receipt không có. */
-export type PaperFor<TMedia extends TemplateMedia> = TMedia extends 'label'
-  ? Required<PaperSize>
-  : Omit<PaperSize, 'heightMm'>;
-
 /** Nội dung gốc: 1 builder, hoặc callback nhận scope gốc để dùng `scope.var`/`scope.repeat`. */
 export type RootContent<TTemplateData extends TemplateDataShape> =
   | TemplateNodeBuilder
@@ -50,40 +44,32 @@ export class TemplateBuildError extends Error {
 }
 
 /** Builder của `TemplateDocument`; tạo qua `labelTemplate(templateData)` hoặc `receiptTemplate(templateData)`. */
-export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TMedia extends TemplateMedia> {
-  private templateId?: string;
-
-  private templateName?: string;
+export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TKind extends TemplateKind> {
+  private metadataInput?: TemplateMetadataInput<TKind>;
 
-  private paperSize?: PaperFor<TMedia>;
+  private settingsInput?: TemplateSettingsInput;
 
   private rootContent?: RootContent<TTemplateData>;
 
   constructor(
     private readonly templateData: TTemplateData,
-    private readonly media: TMedia,
+    private readonly kind: TKind,
   ) {}
 
-  /** Mã template (bắt buộc). */
-  id(value: string): this {
-    this.templateId = value;
-    return this;
-  }
-
-  /** Tên hiển thị (bắt buộc). */
-  name(value: string): this {
-    this.templateName = value;
+  /** Thông tin chung: mã, tên, khổ giấy (bắt buộc). */
+  metadata(value: TemplateMetadataInput<TKind>): this {
+    this.metadataInput = value;
     return this;
   }
 
-  /** Khổ giấy tính bằng mm (bắt buộc). */
-  paper(value: PaperFor<TMedia>): this {
-    this.paperSize = value;
+  /** Style có tên và option người dùng được chỉnh; bỏ qua là template không có setting nào. */
+  settings(value: TemplateSettingsInput): this {
+    this.settingsInput = value;
     return this;
   }
 
-  /** Node gốc (bắt buộc). */
-  root(content: RootContent<TTemplateData>): this {
+  /** Cây node nội dung (bắt buộc). */
+  content(content: RootContent<TTemplateData>): this {
     this.rootContent = content;
     return this;
   }
@@ -104,10 +90,8 @@ export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TM
   }
 
   private assemble(): TemplateDocument {
-    if (this.templateId === undefined) throw new Error('Template cần .id(...)');
-    if (this.templateName === undefined) throw new Error('Template cần .name(...)');
-    if (this.paperSize === undefined) throw new Error('Template cần .paper(...)');
-    if (this.rootContent === undefined) throw new Error('Template cần .root(...)');
+    if (this.metadataInput === undefined) throw new Error('Template cần .metadata(...)');
+    if (this.rootContent === undefined) throw new Error('Template cần .content(...)');
 
     const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
     const rootBuilder =
@@ -115,13 +99,15 @@ export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TM
 
     return {
       schemaVersion: TEMPLATE_SCHEMA_VERSION,
-      id: this.templateId,
-      name: this.templateName,
-      dataId: this.templateData.id,
-      media: this.media,
-      locale: 'vi-VN',
-      paper: this.paperSize,
-      root: rootBuilder.build(context),
+      metadata: {
+        id: this.metadataInput.id,
+        name: this.metadataInput.name,
+        kind: this.kind,
+        locale: this.metadataInput.locale ?? DEFAULT_LOCALE,
+        paper: this.metadataInput.paper,
+      },
+      settings: toTemplateSettings(this.settingsInput),
+      content: rootBuilder.build(context),
     };
   }
 }
diff --git a/packages/printer-core/src/template/builder/TemplateMetadataInput.ts b/packages/printer-core/src/template/builder/TemplateMetadataInput.ts
new file mode 100644
index 0000000..f870dbc
--- /dev/null
+++ b/packages/printer-core/src/template/builder/TemplateMetadataInput.ts
@@ -0,0 +1,22 @@
+import type { PaperSize } from '../PaperSize';
+import type { TemplateKind, TemplateLocale } from '../TemplateMetadata';
+
+/** Khổ giấy theo công dụng: label bắt buộc có chiều cao, receipt không có. */
+export type PaperFor<TKind extends TemplateKind> = TKind extends 'label'
+  ? Required<PaperSize>
+  : Omit<PaperSize, 'heightMm'>;
+
+/** Tham số của `.metadata(...)`; `kind` do `labelTemplate`/`receiptTemplate` quyết định. */
+export interface TemplateMetadataInput<TKind extends TemplateKind> {
+  /** Mã template. */
+  readonly id: string;
+
+  /** Tên hiển thị. */
+  readonly name: string;
+
+  /** Khổ giấy, đúng loại theo công dụng. */
+  readonly paper: PaperFor<TKind>;
+
+  /** Locale; mặc định `'vi-VN'`. */
+  readonly locale?: TemplateLocale;
+}
diff --git a/packages/printer-core/src/template/builder/TemplateSettingsInput.ts b/packages/printer-core/src/template/builder/TemplateSettingsInput.ts
new file mode 100644
index 0000000..33b49ca
--- /dev/null
+++ b/packages/printer-core/src/template/builder/TemplateSettingsInput.ts
@@ -0,0 +1,33 @@
+import type { BooleanOptionSetting, ChoiceOptionSetting, TextOptionSetting } from '../settings';
+import type { TextStyle } from '../style/TextStyle';
+
+/** Khai báo setting trong DSL: như trong JSON nhưng được bỏ trống `default`. */
+type WithOptionalDefault<TSetting extends { readonly default: unknown }> = Omit<TSetting, 'default'> &
+  Partial<Pick<TSetting, 'default'>>;
+
+/** Style có tên trong DSL; `default` bỏ trống lấy bằng `value`. */
+export interface StyleSettingInput {
+  /** Tên hiển thị trên form. */
+  readonly label: string;
+
+  /** Style chữ dùng khi in. */
+  readonly value: TextStyle;
+
+  /** Style gốc cho UI; bỏ trống lấy bằng `value`. */
+  readonly default?: TextStyle;
+}
+
+/** Option trong DSL; `default` bỏ trống lấy bằng `value`. */
+export type OptionSettingInput =
+  | WithOptionalDefault<BooleanOptionSetting>
+  | WithOptionalDefault<TextOptionSetting>
+  | WithOptionalDefault<ChoiceOptionSetting>;
+
+/** Tham số của `.settings(...)`. */
+export interface TemplateSettingsInput {
+  /** Style có tên, theo tên; bỏ trống là không có. */
+  readonly styles?: Readonly<Record<string, StyleSettingInput>>;
+
+  /** Option, theo tên; bỏ trống là không có. */
+  readonly options?: Readonly<Record<string, OptionSettingInput>>;
+}
diff --git a/packages/printer-core/src/template/builder/index.ts b/packages/printer-core/src/template/builder/index.ts
index 54591bb..0105593 100644
--- a/packages/printer-core/src/template/builder/index.ts
+++ b/packages/printer-core/src/template/builder/index.ts
@@ -18,6 +18,7 @@ export {
   TemplateBuildError,
   type TemplateDataShape,
   type RootScope,
-  type PaperFor,
   type RootContent,
 } from './TemplateDocumentBuilder';
+export type { PaperFor, TemplateMetadataInput } from './TemplateMetadataInput';
+export type { StyleSettingInput, OptionSettingInput, TemplateSettingsInput } from './TemplateSettingsInput';
diff --git a/packages/printer-core/src/template/builder/toTemplateSettings.ts b/packages/printer-core/src/template/builder/toTemplateSettings.ts
new file mode 100644
index 0000000..44307fe
--- /dev/null
+++ b/packages/printer-core/src/template/builder/toTemplateSettings.ts
@@ -0,0 +1,32 @@
+import type { OptionSetting, StyleSetting, TemplateSettings } from '../settings';
+import type { OptionSettingInput, StyleSettingInput, TemplateSettingsInput } from './TemplateSettingsInput';
+
+/** Đổi settings của DSL sang JSON: `default` bỏ trống lấy bằng `value`. */
+export function toTemplateSettings(input: TemplateSettingsInput | undefined): TemplateSettings {
+  return {
+    styles: mapRecord(input?.styles ?? {}, toStyleSetting),
+    options: mapRecord(input?.options ?? {}, toOptionSetting),
+  };
+}
+
+function toStyleSetting(style: StyleSettingInput): StyleSetting {
+  return { label: style.label, value: style.value, default: style.default ?? style.value };
+}
+
+function toOptionSetting(option: OptionSettingInput): OptionSetting {
+  switch (option.type) {
+    case 'boolean':
+      return { ...option, default: option.default ?? option.value };
+    case 'text':
+      return { ...option, default: option.default ?? option.value };
+    case 'choice':
+      return { ...option, default: option.default ?? option.value };
+  }
+}
+
+function mapRecord<TInput, TOutput>(
+  record: Readonly<Record<string, TInput>>,
+  convert: (value: TInput) => TOutput,
+): Readonly<Record<string, TOutput>> {
+  return Object.fromEntries(Object.entries(record).map(([name, value]) => [name, convert(value)]));
+}
diff --git a/packages/printer-core/src/template/data/TemplateDataDefinition.ts b/packages/printer-core/src/template/data/TemplateDataDefinition.ts
index 2d70af9..0637424 100644
--- a/packages/printer-core/src/template/data/TemplateDataDefinition.ts
+++ b/packages/printer-core/src/template/data/TemplateDataDefinition.ts
@@ -9,7 +9,7 @@ export interface TemplateDataDefinition<
   TVariables extends VariableDefinitionMap<TData> = VariableDefinitionMap<TData>,
   TCollections extends CollectionDefinitionMap<TData> = CollectionDefinitionMap<TData>,
 > extends TemplateDataReader {
-  /** Mã dữ liệu template, VD 'product-label'; template tham chiếu qua `TemplateDocument.dataId`. */
+  /** Mã dữ liệu template, VD 'product-label'. */
   readonly id: string;
 
   /** Phiên bản dữ liệu template do app tự tăng khi thêm/đổi biến. */
diff --git a/packages/printer-core/src/template/data/TemplateDataDescription.ts b/packages/printer-core/src/template/data/TemplateDataDescription.ts
index a2c60d3..18113ce 100644
--- a/packages/printer-core/src/template/data/TemplateDataDescription.ts
+++ b/packages/printer-core/src/template/data/TemplateDataDescription.ts
@@ -35,7 +35,7 @@ export interface CollectionDescription {
 
 /** Metadata JSON của cả dữ liệu template — kết quả của `templateData.describe()`. */
 export interface TemplateDataDescription {
-  /** Mã dữ liệu template, khớp với `TemplateDocument.dataId`. */
+  /** Mã dữ liệu template, VD 'product-label'. */
   readonly id: string;
 
   /** Phiên bản dữ liệu template do app tự tăng khi thêm/đổi biến. */
diff --git a/packages/printer-core/src/template/index.ts b/packages/printer-core/src/template/index.ts
index 0b6504d..421ed44 100644
--- a/packages/printer-core/src/template/index.ts
+++ b/packages/printer-core/src/template/index.ts
@@ -1,4 +1,7 @@
 export * from './TemplateDocument';
+export * from './TemplateMetadata';
+export * from './PaperSize';
+export * from './settings';
 export * from './data';
 export * from './style/Length';
 export * from './style/Dimension';
diff --git a/packages/printer-core/src/template/parse/JsonCursor.ts b/packages/printer-core/src/template/parse/JsonCursor.ts
index 341484b..48f782c 100644
--- a/packages/printer-core/src/template/parse/JsonCursor.ts
+++ b/packages/printer-core/src/template/parse/JsonCursor.ts
@@ -57,6 +57,13 @@ export class JsonCursor {
     return this.value.map((item, index) => new JsonCursor(item, `${this.path}[${index}]`, this.issues));
   }
 
+  /** Trả con trỏ của từng giá trị nếu là object (theo thứ tự key), ngược lại ghi lỗi và trả mảng rỗng. */
+  expectEntries(): readonly JsonCursor[] {
+    const object = this.expectObject();
+    if (!object) return [];
+    return Object.keys(object).map((key) => this.field(key));
+  }
+
   /** Ghi lỗi nếu không phải chuỗi khác rỗng. */
   expectNonEmptyString(): void {
     if (typeof this.value !== 'string' || this.value === '') this.report('phải là chuỗi khác rỗng');
diff --git a/packages/printer-core/src/template/parse/validateMetadata.ts b/packages/printer-core/src/template/parse/validateMetadata.ts
new file mode 100644
index 0000000..6970909
--- /dev/null
+++ b/packages/printer-core/src/template/parse/validateMetadata.ts
@@ -0,0 +1,37 @@
+import type { TemplateKind, TemplateLocale } from '../TemplateMetadata';
+import type { JsonCursor } from './JsonCursor';
+
+// Record thay cho mảng để TypeScript báo lỗi khi union thêm giá trị mà danh sách này quên cập nhật.
+const TEMPLATE_KINDS: Readonly<Record<TemplateKind, true>> = { label: true, receipt: true };
+
+const LOCALES: Readonly<Record<TemplateLocale, true>> = { 'vi-VN': true };
+
+/** Kiểm tra `metadata`: mã, tên, locale, công dụng và khổ giấy khớp công dụng. */
+export function validateMetadata(cursor: JsonCursor): void {
+  if (!cursor.expectObject()) return;
+
+  cursor.field('id').expectNonEmptyString();
+  cursor.field('name').expectNonEmptyString();
+  cursor.field('locale').expectOneOf(Object.keys(LOCALES));
+  validatePaper(cursor);
+}
+
+function validatePaper(metadata: JsonCursor): void {
+  const kind = metadata.field('kind');
+  const paper = metadata.field('paper');
+  if (!kind.expectOneOf(Object.keys(TEMPLATE_KINDS)) || !paper.expectObject()) return;
+
+  if (!isPositiveNumber(paper.field('widthMm').value)) paper.field('widthMm').report('phải là số dương (mm)');
+
+  const heightMm = paper.field('heightMm');
+  if (kind.value === 'label' && !isPositiveNumber(heightMm.value)) {
+    heightMm.report('tem (label) phải có chiều cao là số dương (mm)');
+  }
+  if (kind.value === 'receipt' && heightMm.value !== undefined) {
+    heightMm.report('giấy cuộn (receipt) không có chiều cao cố định');
+  }
+}
+
+function isPositiveNumber(value: unknown): boolean {
+  return typeof value === 'number' && Number.isFinite(value) && value > 0;
+}
diff --git a/packages/printer-core/src/template/parse/validateSettings.ts b/packages/printer-core/src/template/parse/validateSettings.ts
new file mode 100644
index 0000000..cb191bb
--- /dev/null
+++ b/packages/printer-core/src/template/parse/validateSettings.ts
@@ -0,0 +1,88 @@
+import type { OptionSettingType } from '../settings';
+import type { JsonCursor } from './JsonCursor';
+import { validateTextStyleSetting } from './validateStyle';
+
+type OptionValidator = (cursor: JsonCursor) => void;
+
+// Record thay cho mảng để TypeScript báo lỗi khi union thêm loại option mà bảng này quên cập nhật.
+const OPTION_VALIDATORS: Readonly<Record<OptionSettingType, OptionValidator>> = {
+  boolean: validateBooleanOption,
+  text: validateTextOption,
+  choice: validateChoiceOption,
+};
+
+const OPTION_TYPES: readonly string[] = Object.keys(OPTION_VALIDATORS);
+
+/** `value` dùng khi in và `default` cho UI phải cùng kiểu, nên kiểm như nhau. */
+const VALUE_FIELDS: readonly string[] = ['value', 'default'];
+
+/** Kiểm tra `settings`: nhãn, và `value`/`default` đúng kiểu theo từng style/option. */
+export function validateSettings(cursor: JsonCursor): void {
+  if (!cursor.expectObject()) return;
+
+  for (const style of cursor.field('styles').expectEntries()) validateStyleSetting(style);
+  for (const option of cursor.field('options').expectEntries()) validateOptionSetting(option);
+}
+
+function validateStyleSetting(cursor: JsonCursor): void {
+  if (!cursor.expectObject()) return;
+
+  cursor.field('label').expectNonEmptyString();
+  for (const field of VALUE_FIELDS) validateTextStyleSetting(cursor.field(field));
+}
+
+function validateOptionSetting(cursor: JsonCursor): void {
+  if (!cursor.expectObject()) return;
+
+  cursor.field('label').expectNonEmptyString();
+  const type = cursor.field('type');
+  if (!type.expectOneOf(OPTION_TYPES)) return;
+  OPTION_VALIDATORS[type.value as OptionSettingType](cursor);
+}
+
+function validateBooleanOption(cursor: JsonCursor): void {
+  for (const field of VALUE_FIELDS) {
+    if (typeof cursor.field(field).value !== 'boolean') cursor.field(field).report('phải là true hoặc false');
+  }
+}
+
+function validateTextOption(cursor: JsonCursor): void {
+  for (const field of VALUE_FIELDS) {
+    if (typeof cursor.field(field).value !== 'string') cursor.field(field).report('phải là chuỗi');
+  }
+}
+
+function validateChoiceOption(cursor: JsonCursor): void {
+  const values = validateChoices(cursor.field('choices'));
+  if (values.length === 0) return;
+  for (const field of VALUE_FIELDS) cursor.field(field).expectOneOf(values);
+}
+
+// Trả các giá trị lựa chọn hợp lệ; danh sách hỏng thì trả rỗng để không báo thêm lỗi value/default dây chuyền.
+function validateChoices(cursor: JsonCursor): readonly string[] {
+  const items = cursor.expectItems();
+  if (Array.isArray(cursor.value) && items.length === 0) cursor.report('phải có ít nhất 1 lựa chọn');
+
+  const values: string[] = [];
+  for (const item of items) {
+    const value = validateChoice(item, values);
+    if (value !== undefined) values.push(value);
+  }
+  return values;
+}
+
+function validateChoice(cursor: JsonCursor, seenValues: readonly string[]): string | undefined {
+  if (!cursor.expectObject()) return undefined;
+
+  cursor.field('label').expectNonEmptyString();
+  const value = cursor.field('value');
+  if (typeof value.value !== 'string' || value.value === '') {
+    value.report('phải là chuỗi khác rỗng');
+    return undefined;
+  }
+  if (seenValues.includes(value.value)) {
+    value.report(`giá trị "${value.value}" bị trùng`);
+    return undefined;
+  }
+  return value.value;
+}
diff --git a/packages/printer-core/src/template/parse/validateStyle.ts b/packages/printer-core/src/template/parse/validateStyle.ts
index b4dc660..348dc70 100644
--- a/packages/printer-core/src/template/parse/validateStyle.ts
+++ b/packages/printer-core/src/template/parse/validateStyle.ts
@@ -47,6 +47,16 @@ export function validateTextStyle(cursor: JsonCursor): void {
   if (cursor.value === undefined || !cursor.expectObject()) return;
 
   validateBoxFields(cursor);
+  validateTextFields(cursor);
+}
+
+/** Kiểm tra `TextStyle` bắt buộc của 1 style có tên trong `settings` (chỉ thuộc tính chữ). */
+export function validateTextStyleSetting(cursor: JsonCursor): void {
+  if (!cursor.expectObject()) return;
+  validateTextFields(cursor);
+}
+
+function validateTextFields(cursor: JsonCursor): void {
   validateOptionalLength(cursor.field('fontSize'));
   cursor.field('fontWeight').expectOptionalOneOf(FONT_WEIGHTS);
   cursor.field('textAlign').expectOptionalOneOf(TEXT_ALIGNS);
diff --git a/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts b/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
index 483d775..363305a 100644
--- a/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
+++ b/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
@@ -68,10 +68,7 @@ export function validateTemplateAgainstData(
 ): TemplateDataValidationResult {
   const index = createTemplateDataIndex(description);
   const check: TemplateDataCheck = { description, index, errors: [], warnings: [] };
-  if (template.dataId !== description.id) {
-    addError(check, 'dataId', `template dùng dữ liệu "${template.dataId}", không phải "${description.id}"`);
-  }
-  checkNode(check, template.root, 'root', ROOT_SCOPE);
+  checkNode(check, template.content, 'content', ROOT_SCOPE);
   return { errors: check.errors, warnings: check.warnings };
 }
 
diff --git a/packages/printer-core/src/template/parse/validateTemplateStructure.ts b/packages/printer-core/src/template/parse/validateTemplateStructure.ts
index 03e6dde..e590351 100644
--- a/packages/printer-core/src/template/parse/validateTemplateStructure.ts
+++ b/packages/printer-core/src/template/parse/validateTemplateStructure.ts
@@ -1,11 +1,10 @@
 import { TEMPLATE_SCHEMA_VERSION } from '../TemplateDocument';
 import { JsonCursor } from './JsonCursor';
 import type { TemplateIssue } from './TemplateIssue';
+import { validateMetadata } from './validateMetadata';
 import { validateNode } from './validateNode';
 import { validateRepeatPagination } from './validateRepeatPagination';
-
-const MEDIA_TYPES: readonly string[] = ['label', 'receipt'];
-const LOCALES: readonly string[] = ['vi-VN'];
+import { validateSettings } from './validateSettings';
 
 /** Kiểm tra cấu trúc 1 document đã ở schema hiện tại; trả danh sách lỗi (rỗng là hợp lệ). */
 export function validateTemplateStructure(document: unknown): readonly TemplateIssue[] {
@@ -16,34 +15,11 @@ export function validateTemplateStructure(document: unknown): readonly TemplateI
   if (cursor.field('schemaVersion').value !== TEMPLATE_SCHEMA_VERSION) {
     cursor.field('schemaVersion').report(`phải là ${TEMPLATE_SCHEMA_VERSION}`);
   }
-  cursor.field('id').expectNonEmptyString();
-  cursor.field('name').expectNonEmptyString();
-  cursor.field('dataId').expectNonEmptyString();
-  cursor.field('locale').expectOneOf(LOCALES);
-  validatePaper(cursor);
-  validateNode(cursor.field('root'), new Set());
+  validateMetadata(cursor.field('metadata'));
+  validateSettings(cursor.field('settings'));
+  validateNode(cursor.field('content'), new Set());
   // Ràng buộc tách tem dựa trên cấu trúc hợp lệ; chạy trên cấu trúc lỗi sẽ báo trùng lỗi kiểu.
-  if (issues.length === 0) validateRepeatPagination(cursor.field('root'));
+  if (issues.length === 0) validateRepeatPagination(cursor.field('content'));
 
   return issues;
 }
-
-function validatePaper(document: JsonCursor): void {
-  const media = document.field('media');
-  const paper = document.field('paper');
-  if (!media.expectOneOf(MEDIA_TYPES) || !paper.expectObject()) return;
-
-  if (!isPositiveNumber(paper.field('widthMm').value)) paper.field('widthMm').report('phải là số dương (mm)');
-
-  const heightMm = paper.field('heightMm');
-  if (media.value === 'label' && !isPositiveNumber(heightMm.value)) {
-    heightMm.report('tem (label) phải có chiều cao là số dương (mm)');
-  }
-  if (media.value === 'receipt' && heightMm.value !== undefined) {
-    heightMm.report('giấy cuộn (receipt) không có chiều cao cố định');
-  }
-}
-
-function isPositiveNumber(value: unknown): boolean {
-  return typeof value === 'number' && Number.isFinite(value) && value > 0;
-}
diff --git a/packages/printer-core/src/template/settings/OptionSetting.ts b/packages/printer-core/src/template/settings/OptionSetting.ts
new file mode 100644
index 0000000..39e5d7a
--- /dev/null
+++ b/packages/printer-core/src/template/settings/OptionSetting.ts
@@ -0,0 +1,59 @@
+/** 1 lựa chọn của option `choice`. */
+export interface OptionChoice {
+  /** Giá trị lưu trong `value`/`default` và dùng để so sánh trong điều kiện. */
+  readonly value: string;
+
+  /** Tên hiển thị trên form. */
+  readonly label: string;
+}
+
+/** Option bật/tắt, VD in giá món. */
+export interface BooleanOptionSetting {
+  /** Tên hiển thị trên form. */
+  readonly label: string;
+
+  readonly type: 'boolean';
+
+  /** Giá trị dùng khi in. */
+  readonly value: boolean;
+
+  /** Giá trị gốc để form hiển thị và khôi phục; không bao giờ đọc khi in. */
+  readonly default: boolean;
+}
+
+/** Option chữ tuỳ chỉnh, VD dòng cuối hoá đơn. */
+export interface TextOptionSetting {
+  /** Tên hiển thị trên form. */
+  readonly label: string;
+
+  readonly type: 'text';
+
+  /** Chữ in ra nguyên văn. */
+  readonly value: string;
+
+  /** Chữ gốc để form hiển thị và khôi phục; không bao giờ đọc khi in. */
+  readonly default: string;
+}
+
+/** Option chọn 1 trong danh sách, VD kiểu hiển thị giá. */
+export interface ChoiceOptionSetting {
+  /** Tên hiển thị trên form. */
+  readonly label: string;
+
+  readonly type: 'choice';
+
+  /** Danh sách lựa chọn; có ít nhất 1, không trùng `value`. */
+  readonly choices: readonly OptionChoice[];
+
+  /** `value` của lựa chọn dùng khi in. */
+  readonly value: string;
+
+  /** `value` của lựa chọn gốc để form hiển thị và khôi phục; không bao giờ đọc khi in. */
+  readonly default: string;
+}
+
+/** Option người dùng được chỉnh trên template. */
+export type OptionSetting = BooleanOptionSetting | TextOptionSetting | ChoiceOptionSetting;
+
+/** Loại option. */
+export type OptionSettingType = OptionSetting['type'];
diff --git a/packages/printer-core/src/template/settings/StyleSetting.ts b/packages/printer-core/src/template/settings/StyleSetting.ts
new file mode 100644
index 0000000..446bff2
--- /dev/null
+++ b/packages/printer-core/src/template/settings/StyleSetting.ts
@@ -0,0 +1,13 @@
+import type { TextStyle } from '../style/TextStyle';
+
+/** 1 style chữ có tên mà người dùng được chỉnh, VD cỡ chữ tên món. */
+export interface StyleSetting {
+  /** Tên hiển thị trên form, VD 'Tên món'. */
+  readonly label: string;
+
+  /** Style chữ dùng khi in. */
+  readonly value: TextStyle;
+
+  /** Style gốc để form hiển thị và khôi phục; không bao giờ đọc khi in. */
+  readonly default: TextStyle;
+}
diff --git a/packages/printer-core/src/template/settings/TemplateSettings.ts b/packages/printer-core/src/template/settings/TemplateSettings.ts
new file mode 100644
index 0000000..1467ea0
--- /dev/null
+++ b/packages/printer-core/src/template/settings/TemplateSettings.ts
@@ -0,0 +1,11 @@
+import type { OptionSetting } from './OptionSetting';
+import type { StyleSetting } from './StyleSetting';
+
+/** Những gì người dùng được chỉnh trên template; khi in chỉ đọc `value`, `default` chỉ dành cho UI. */
+export interface TemplateSettings {
+  /** Style chữ có tên, theo tên. */
+  readonly styles: Readonly<Record<string, StyleSetting>>;
+
+  /** Option, theo tên. */
+  readonly options: Readonly<Record<string, OptionSetting>>;
+}
diff --git a/packages/printer-core/src/template/settings/index.ts b/packages/printer-core/src/template/settings/index.ts
new file mode 100644
index 0000000..53d8f61
--- /dev/null
+++ b/packages/printer-core/src/template/settings/index.ts
@@ -0,0 +1,3 @@
+export * from './StyleSetting';
+export * from './OptionSetting';
+export * from './TemplateSettings';
diff --git a/packages/printer-preview/src/defaultSample.ts b/packages/printer-preview/src/defaultSample.ts
index 8504977..38dc338 100644
--- a/packages/printer-preview/src/defaultSample.ts
+++ b/packages/printer-preview/src/defaultSample.ts
@@ -64,10 +64,8 @@ export const templateData = defineTemplateData({
 });
 
 export default labelTemplate(templateData)
-  .id('product-label-default')
-  .name('Tem món mặc định')
-  .paper({ widthMm: 50, heightMm: 30 })
-  .root((scope) =>
+  .metadata({ id: 'product-label-default', name: 'Tem món mặc định', paper: { widthMm: 50, heightMm: 30 } })
+  .content((scope) =>
     scope
       .repeat({ collection: 'products', expand: 'quantity' }, (product) =>
         column()
diff --git a/packages/printer-preview/src/pipeline.ts b/packages/printer-preview/src/pipeline.ts
index 28d2f84..2c051ce 100644
--- a/packages/printer-preview/src/pipeline.ts
+++ b/packages/printer-preview/src/pipeline.ts
@@ -41,9 +41,9 @@ function layoutPage(
   template: TemplateDocument,
   page: Extract<ResolvedPage, { status: 'ok' }>,
 ): LaidOutPage {
-  const layoutConfig = { paper: template.paper, dpi: PREVIEW_DPI };
+  const layoutConfig = { paper: template.metadata.paper, dpi: PREVIEW_DPI };
   const { elements, warnings } = layoutEngine.resolve(page.node, layoutConfig, fontMetrics);
-  const paper = paperSizeToDots(template.paper, PREVIEW_DPI);
+  const paper = paperSizeToDots(template.metadata.paper, PREVIEW_DPI);
   const document: ResolvedPrintDocument = {
     widthDots: paper.widthDots,
     heightDots: paper.heightDots ?? 0,
@@ -86,5 +86,5 @@ export function renderPreviews(
 }
 
 export function defaultLanguageFor(template: TemplateDocument): PrinterLanguage {
-  return template.media === 'receipt' ? 'escpos' : 'tspl';
+  return template.metadata.kind === 'receipt' ? 'escpos' : 'tspl';
 }
~~~

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `326 passed, 326 total`; `printer-preview` tsc sạch, Vitest `13 passed`; eslint `0 errors`.

- [ ] **Step 5: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/src/__tests__/template-pipeline-integration.test.ts \
  packages/printer-core/src/layout/LayoutConfig.ts \
  packages/printer-core/src/resolution/DocumentResolver.ts \
  packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts \
  packages/printer-core/src/resolution/__tests__/collectAssetIds.test.ts \
  packages/printer-core/src/resolution/collectAssetIds.ts \
  packages/printer-core/src/template/PaperSize.ts \
  packages/printer-core/src/template/TemplateDocument.ts \
  packages/printer-core/src/template/TemplateMetadata.ts \
  packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts \
  packages/printer-core/src/template/builder/TemplateMetadataInput.ts \
  packages/printer-core/src/template/builder/TemplateSettingsInput.ts \
  packages/printer-core/src/template/builder/__tests__/TemplateDocumentBuilder.test.ts \
  packages/printer-core/src/template/builder/index.ts \
  packages/printer-core/src/template/builder/toTemplateSettings.ts \
  packages/printer-core/src/template/data/TemplateDataDefinition.ts \
  packages/printer-core/src/template/data/TemplateDataDescription.ts \
  packages/printer-core/src/template/index.ts \
  packages/printer-core/src/template/parse/JsonCursor.ts \
  packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts \
  packages/printer-core/src/template/parse/__tests__/validateTemplateAgainstData.test.ts \
  packages/printer-core/src/template/parse/validateMetadata.ts \
  packages/printer-core/src/template/parse/validateSettings.ts \
  packages/printer-core/src/template/parse/validateStyle.ts \
  packages/printer-core/src/template/parse/validateTemplateAgainstData.ts \
  packages/printer-core/src/template/parse/validateTemplateStructure.ts \
  packages/printer-core/src/template/settings/OptionSetting.ts \
  packages/printer-core/src/template/settings/StyleSetting.ts \
  packages/printer-core/src/template/settings/TemplateSettings.ts \
  packages/printer-core/src/template/settings/index.ts \
  packages/printer-preview/src/__tests__/evaluateTemplate.test.ts \
  packages/printer-preview/src/__tests__/pipeline.test.ts \
  packages/printer-preview/src/defaultSample.ts \
  packages/printer-preview/src/pipeline.ts
git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: split template document into metadata, settings and content" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Task 3: Node tham chiếu settings, resolver in bằng `value`

**Files:**
- Create: `template/parse/checkSettingReferences.ts`, `resolution/readSetting.ts`, `template/builder/StyleReference.ts`, `template/builder/SettingNames.ts`
- Modify: `template/content/{Segment,Condition}.ts`, `template/nodes/TextNode.ts`, `template/parse/{validateContent,validateNode,validateTemplateAgainstData}.ts`, `resolution/{ResolveContext,DocumentResolver,collectAssetIds,resolveContent,evaluateCondition,resolveNode}.ts`, `template/builder/{TemplateScope,TextBuilder,TemplateDocumentBuilder,index}.ts`
- Test: `template/parse/__tests__/parseTemplate.test.ts` (thêm), mới: `template/parse/__tests__/validateSettingReferences.test.ts`, `resolution/__tests__/resolveSettings.test.ts`, `template/builder/__tests__/TemplateSettingsDsl.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/`.)

**Interfaces:**
- Consumes: `TemplateSettings`, `OptionSetting`, `TemplateSettingsInput` (Task 2).
- Produces:
  - `TextNode.styleName?: string`; `OptionSegment { option: string }` trong `Segment`; `OptionCondition { op: 'option'; option: string; equals?: string | boolean }` trong `Condition`.
  - Validate cấu trúc: segment có đúng 1 trong `text`/`var`/`option`; điều kiện option; text có `styleName` thì không có `fontSize`/`fontWeight`/`lineHeight`/`textAlign` viết thẳng.
  - `validateTemplateAgainstData` thêm lỗi tham chiếu (`settings không có style/option "x"`, sai loại option) và cảnh báo `style/option "x" khai báo nhưng không dùng`.
  - `ResolveContext.settings: TemplateSettings`; resolver: style chữ = `settings.styles[name].value` (giữ thuộc tính hộp của node), điều kiện/segment option đọc `value`; thiếu setting → `ResolveError`.
  - DSL: `TemplateDocumentBuilder<TData, TKind, TSettings>`, `.settings<T>()` đổi kiểu builder; `scope.style(name)` → `StyleReference`, `text(...).style(ref)`; `scope.option(name)` (chỉ option `text`); `scope.optionIs(name, equals?)` (`boolean`: tuỳ chọn boolean; `choice`: bắt buộc chuỗi). Kiểu phụ: `NoSettings`, `StyleNames`, `TextOptionNames`, `ConditionOptionNames`, `OptionEqualsArguments`.

- [ ] **Step 1: Viết test (patch `t3test`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-29-template-settings.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t3test | git apply --ignore-whitespace -
```

<!-- patch:t3test -->
~~~diff
diff --git a/packages/printer-core/src/resolution/__tests__/resolveSettings.test.ts b/packages/printer-core/src/resolution/__tests__/resolveSettings.test.ts
new file mode 100644
index 0000000..6010137
--- /dev/null
+++ b/packages/printer-core/src/resolution/__tests__/resolveSettings.test.ts
@@ -0,0 +1,111 @@
+import { createDocumentResolver, type AssetProvider, type ResolvedNode, type ResolvedPage } from '..';
+import type { TemplateDocument, TemplateNode, TemplateSettings } from '../../template';
+import { TEST_ORDER_DATA, TEST_ORDER_SAMPLE } from '../../testing';
+
+const NO_ASSETS: AssetProvider = { get: () => undefined };
+
+const SETTINGS: TemplateSettings = {
+    styles: {
+      itemName: {
+        label: 'Tên món',
+        value: { fontSize: { value: 20, unit: 'px' }, fontWeight: 'bold' },
+        default: { fontSize: { value: 12, unit: 'px' } },
+      },
+    },
+    options: {
+      showPrice: { label: 'In giá món', type: 'boolean', value: false, default: true },
+      footerText: { label: 'Dòng cuối', type: 'text', value: 'Wifi: abc', default: 'Cảm ơn quý khách' },
+      priceStyle: {
+        label: 'Kiểu giá',
+        type: 'choice',
+        choices: [
+          { value: 'short', label: '45k' },
+          { value: 'full', label: '45.000đ' },
+        ],
+        value: 'full',
+        default: 'short',
+      },
+    },
+  };
+
+function resolveChildren(children: readonly TemplateNode[], settings: TemplateSettings = SETTINGS): ResolvedPage {
+  const template: TemplateDocument = {
+    schemaVersion: 1,
+    metadata: { id: 'template', name: 'Template', kind: 'receipt', locale: 'vi-VN', paper: { widthMm: 72 } },
+    settings,
+    content: { type: 'container', id: 'root', children },
+  };
+  const [page] = createDocumentResolver().resolve(template, TEST_ORDER_SAMPLE, {
+    templateData: TEST_ORDER_DATA,
+    assets: NO_ASSETS,
+  });
+  return page;
+}
+
+function resolvedChildren(page: ResolvedPage): readonly ResolvedNode[] {
+  if (page.status !== 'ok' || page.node.type !== 'container') throw new Error('trang lỗi');
+  return page.node.children;
+}
+
+function textIds(page: ResolvedPage): readonly string[] {
+  return resolvedChildren(page).map((node) => node.id);
+}
+
+function textWith(id: string, extra: Partial<Extract<TemplateNode, { type: 'text' }>>): TemplateNode {
+  return { type: 'text', id, content: [{ text: id }], ...extra };
+}
+
+describe('DocumentResolver — settings', () => {
+  it('text dùng style có tên lấy style chữ từ value (không phải default), giữ style hộp viết thẳng', () => {
+    const side = { value: 1, unit: 'mm' as const };
+    const padding = { top: side, right: side, bottom: side, left: side };
+    const page = resolveChildren([textWith('name', { styleName: 'itemName', style: { padding } })]);
+
+    expect(resolvedChildren(page)[0]).toMatchObject({
+      type: 'text',
+      style: { padding, fontSize: { value: 20, unit: 'px' }, fontWeight: 'bold' },
+    });
+  });
+
+  it('điều kiện option boolean đánh giá theo value', () => {
+    const page = resolveChildren([
+      textWith('shown-when-on', { visibleWhen: { op: 'option', option: 'showPrice' } }),
+      textWith('shown-when-off', { visibleWhen: { op: 'not', condition: { op: 'option', option: 'showPrice' } } }),
+      textWith('equals-false', { visibleWhen: { op: 'option', option: 'showPrice', equals: false } }),
+    ]);
+
+    expect(textIds(page)).toEqual(['shown-when-off', 'equals-false']);
+  });
+
+  it('điều kiện option choice so equals với value, lồng được trong and/or', () => {
+    const page = resolveChildren([
+      textWith('full', { visibleWhen: { op: 'option', option: 'priceStyle', equals: 'full' } }),
+      textWith('short', { visibleWhen: { op: 'option', option: 'priceStyle', equals: 'short' } }),
+      textWith('full-with-code', {
+        visibleWhen: {
+          op: 'and',
+          conditions: [
+            { op: 'option', option: 'priceStyle', equals: 'full' },
+            { op: 'exists', var: 'orderCode' },
+          ],
+        },
+      }),
+    ]);
+
+    expect(textIds(page)).toEqual(['full', 'full-with-code']);
+  });
+
+  it('segment option in đúng value của option text', () => {
+    const [node] = resolvedChildren(
+      resolveChildren([textWith('footer', { content: [{ text: '— ' }, { option: 'footerText' }] })]),
+    );
+
+    expect(node).toMatchObject({ type: 'text', value: '— Wifi: abc' });
+  });
+
+  it('tham chiếu setting không tồn tại lúc resolve thành lỗi trang', () => {
+    const page = resolveChildren([textWith('footer', { content: [{ option: 'header' }] })]);
+
+    expect(page).toMatchObject({ status: 'error', nodeId: 'footer', message: 'settings không có option "header"' });
+  });
+});
diff --git a/packages/printer-core/src/template/builder/__tests__/TemplateSettingsDsl.test.ts b/packages/printer-core/src/template/builder/__tests__/TemplateSettingsDsl.test.ts
new file mode 100644
index 0000000..3485278
--- /dev/null
+++ b/packages/printer-core/src/template/builder/__tests__/TemplateSettingsDsl.test.ts
@@ -0,0 +1,109 @@
+import { and, column, eq, parseTemplate, px, receiptTemplate, text } from '../..';
+import { TEST_ORDER_DATA } from '../../../testing';
+
+function receiptWithSettings() {
+  return receiptTemplate(TEST_ORDER_DATA)
+    .metadata({ id: 'receipt', name: 'Hoá đơn', paper: { widthMm: 72 } })
+    .settings({
+      styles: { itemName: { label: 'Tên món', value: { fontSize: px(16), fontWeight: 'bold' } } },
+      options: {
+        showPrice: { label: 'In giá món', type: 'boolean', value: true },
+        footerText: { label: 'Dòng cuối', type: 'text', value: 'Cảm ơn quý khách' },
+        priceStyle: {
+          label: 'Kiểu giá',
+          type: 'choice',
+          choices: [
+            { value: 'short', label: '45k' },
+            { value: 'full', label: '45.000đ' },
+          ],
+          value: 'full',
+        },
+      },
+    });
+}
+
+describe('DSL settings: scope.style / option / optionIs', () => {
+  it('sinh đúng JSON tham chiếu và qua được parseTemplate', () => {
+    const template = receiptWithSettings()
+      .content((scope) =>
+        column().children(
+          text([scope.var('orderCode')]).style(scope.style('itemName')),
+          text('Giá').visibleWhen(scope.optionIs('showPrice')),
+          text('Giá đầy đủ').visibleWhen(and(scope.optionIs('priceStyle', 'full'), eq('$page', 1))),
+          text([scope.option('footerText')]),
+        ),
+      )
+      .build();
+
+    if (template.content.type !== 'container') throw new Error('cấu trúc sai');
+    expect(template.content.children).toEqual([
+      expect.objectContaining({ styleName: 'itemName' }),
+      expect.objectContaining({ visibleWhen: { op: 'option', option: 'showPrice' } }),
+      expect.objectContaining({
+        visibleWhen: {
+          op: 'and',
+          conditions: [
+            { op: 'option', option: 'priceStyle', equals: 'full' },
+            { op: 'eq', var: '$page', value: 1 },
+          ],
+        },
+      }),
+      expect.objectContaining({ content: [{ option: 'footerText' }] }),
+    ]);
+    expect(parseTemplate(JSON.parse(JSON.stringify(template)))).toEqual({ ok: true, template });
+  });
+
+  it('scope trong repeat vẫn dùng được settings', () => {
+    const template = receiptWithSettings()
+      .content((scope) =>
+        column().children(
+          scope.repeat({ collection: 'items' }, (item) =>
+            text([item.var('itemName')]).style(item.style('itemName')).visibleWhen(item.optionIs('showPrice')),
+          ),
+          text([scope.option('footerText')]).visibleWhen(scope.optionIs('priceStyle', 'short')),
+        ),
+      )
+      .build();
+
+    expect(template.content).toMatchObject({
+      children: [
+        { template: { styleName: 'itemName', visibleWhen: { op: 'option', option: 'showPrice' } } },
+        { content: [{ option: 'footerText' }], visibleWhen: { op: 'option', option: 'priceStyle', equals: 'short' } },
+      ],
+    });
+  });
+
+  it('TypeScript chặn tên style/option sai và dùng sai loại option', () => {
+    const checkTypesOnly = () => {
+      receiptWithSettings().content((scope) => {
+        // @ts-expect-error style không khai báo
+        scope.style('total');
+        // @ts-expect-error option boolean không in được thành chữ
+        scope.option('showPrice');
+        // @ts-expect-error option text không dùng được trong điều kiện
+        scope.optionIs('footerText');
+        // @ts-expect-error option choice cần equals
+        scope.optionIs('priceStyle');
+        // @ts-expect-error option boolean so với boolean, không so với chuỗi
+        scope.optionIs('showPrice', 'yes');
+        return text('x');
+      });
+      // @ts-expect-error template không khai báo settings thì không có style nào
+      receiptTemplate(TEST_ORDER_DATA).content((scope) => text('x').style(scope.style('itemName')));
+    };
+
+    expect(checkTypesOnly).toBeInstanceOf(Function);
+  });
+
+  it('build báo lỗi khi text vừa dùng style có tên vừa đặt cỡ chữ viết thẳng', () => {
+    const builder = receiptWithSettings().content((scope) =>
+      column().children(
+        text('x').style(scope.style('itemName')).fontSize(px(10)),
+        text('Giá').visibleWhen(scope.optionIs('showPrice')),
+        text([scope.option('footerText')]).visibleWhen(scope.optionIs('priceStyle', 'full')),
+      ),
+    );
+
+    expect(() => builder.build()).toThrow('không dùng cùng styleName');
+  });
+});
diff --git a/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts b/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
index 5e2591f..1bb53ed 100644
--- a/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
+++ b/packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts
@@ -299,6 +299,71 @@ describe('parseTemplate', () => {
   });
 });
 
+describe('parseTemplate — tham chiếu settings trong node', () => {
+  it('chấp nhận styleName, segment option và điều kiện option đúng dạng', () => {
+    const json = withContent({
+      type: 'container',
+      id: 'root',
+      children: [
+        {
+          type: 'text',
+          id: 'name',
+          content: [{ text: 'x' }],
+          styleName: 'itemName',
+          style: { padding: uniformInsets(1) },
+        },
+        { type: 'text', id: 'footer', content: [{ option: 'footerText' }] },
+        { type: 'text', id: 'price', content: [{ text: 'y' }], visibleWhen: { op: 'option', option: 'showPrice' } },
+        {
+          type: 'text',
+          id: 'full-price',
+          content: [{ text: 'z' }],
+          visibleWhen: { op: 'not', condition: { op: 'option', option: 'priceStyle', equals: 'short' } },
+        },
+      ],
+    });
+
+    expect(issuesOf(json)).toEqual([]);
+  });
+
+  it('báo lỗi segment có nhiều hơn 1 trong text, var, option', () => {
+    const json = withContent({ type: 'text', id: 'text', content: [{ text: 'x', option: 'footerText' }] });
+
+    expect(issuesOf(json)).toEqual([
+      { path: 'content.content[0]', message: 'segment chỉ được có 1 trong các field "text", "var", "option"' },
+    ]);
+  });
+
+  it('báo lỗi điều kiện option thiếu tên hoặc equals sai kiểu', () => {
+    const json = withContent({
+      type: 'text',
+      id: 'text',
+      content: [],
+      visibleWhen: { op: 'or', conditions: [{ op: 'option' }, { op: 'option', option: 'priceStyle', equals: 1 }] },
+    });
+
+    expect(issuesOf(json)).toEqual([
+      { path: 'content.visibleWhen.conditions[0].option', message: 'phải là chuỗi khác rỗng' },
+      { path: 'content.visibleWhen.conditions[1].equals', message: 'phải là chuỗi hoặc boolean' },
+    ]);
+  });
+
+  it('báo lỗi text vừa có styleName vừa đặt thuộc tính chữ viết thẳng', () => {
+    const json = withContent({
+      type: 'text',
+      id: 'text',
+      content: [],
+      styleName: 'itemName',
+      style: { fontSize: FONT_SIZE, textAlign: 'center', padding: uniformInsets(1) },
+    });
+
+    expect(issuesOf(json)).toEqual([
+      { path: 'content.style.fontSize', message: 'không dùng cùng styleName (style chữ lấy từ settings)' },
+      { path: 'content.style.textAlign', message: 'không dùng cùng styleName (style chữ lấy từ settings)' },
+    ]);
+  });
+});
+
 describe('parseTemplate — settings', () => {
   it('chấp nhận style có tên và đủ 3 loại option hợp lệ', () => {
     const json = withSettings({
diff --git a/packages/printer-core/src/template/parse/__tests__/validateSettingReferences.test.ts b/packages/printer-core/src/template/parse/__tests__/validateSettingReferences.test.ts
new file mode 100644
index 0000000..c182cce
--- /dev/null
+++ b/packages/printer-core/src/template/parse/__tests__/validateSettingReferences.test.ts
@@ -0,0 +1,135 @@
+import { validateTemplateAgainstData } from '..';
+import { TEST_ORDER_DATA } from '../../../testing';
+import type { TemplateDocument, TemplateNode, TemplateSettings } from '../..';
+
+const description = TEST_ORDER_DATA.describe();
+
+const SETTINGS: TemplateSettings = {
+    styles: {
+      itemName: {
+        label: 'Tên món',
+        value: { fontSize: { value: 20, unit: 'px' }, fontWeight: 'bold' },
+        default: { fontSize: { value: 12, unit: 'px' } },
+      },
+    },
+    options: {
+      showPrice: { label: 'In giá món', type: 'boolean', value: false, default: true },
+      footerText: { label: 'Dòng cuối', type: 'text', value: 'Wifi: abc', default: 'Cảm ơn quý khách' },
+      priceStyle: {
+        label: 'Kiểu giá',
+        type: 'choice',
+        choices: [
+          { value: 'short', label: '45k' },
+          { value: 'full', label: '45.000đ' },
+        ],
+        value: 'full',
+        default: 'short',
+      },
+    },
+  };
+
+function documentWith(children: readonly TemplateNode[]): TemplateDocument {
+  return {
+    schemaVersion: 1,
+    metadata: { id: 'template', name: 'Template', kind: 'receipt', locale: 'vi-VN', paper: { widthMm: 72 } },
+    settings: SETTINGS,
+    content: { type: 'container', id: 'root', children },
+  };
+}
+
+function textWith(id: string, extra: Partial<Extract<TemplateNode, { type: 'text' }>>): TemplateNode {
+  return { type: 'text', id, content: [{ text: id }], ...extra };
+}
+
+/** Node dùng đủ mọi style/option khai báo — để các test chỉ thấy lỗi của phần mình thêm vào. */
+const USES_ALL: readonly TemplateNode[] = [
+  textWith('name', { styleName: 'itemName' }),
+  textWith('footer', { content: [{ option: 'footerText' }] }),
+  textWith('price', { visibleWhen: { op: 'option', option: 'showPrice' } }),
+  textWith('style', { visibleWhen: { op: 'option', option: 'priceStyle', equals: 'short' } }),
+];
+
+describe('validateTemplateAgainstData — tham chiếu settings', () => {
+  it('không lỗi, không cảnh báo khi mọi tham chiếu hợp lệ và mọi setting đều được dùng', () => {
+    expect(validateTemplateAgainstData(documentWith(USES_ALL), description)).toEqual({ errors: [], warnings: [] });
+  });
+
+  it('báo lỗi style hoặc option không có trong settings', () => {
+    const result = validateTemplateAgainstData(
+      documentWith([
+        ...USES_ALL,
+        textWith('bad-style', { styleName: 'total' }),
+        textWith('bad-segment', { content: [{ option: 'header' }] }),
+        textWith('bad-condition', { visibleWhen: { op: 'option', option: 'showLogo' } }),
+      ]),
+      description,
+    );
+
+    expect(result.errors).toEqual([
+      { path: 'content.children[4].styleName', message: 'settings không có style "total"' },
+      { path: 'content.children[5].content[0]', message: 'settings không có option "header"' },
+      { path: 'content.children[6].visibleWhen', message: 'settings không có option "showLogo"' },
+    ]);
+  });
+
+  it('báo lỗi dùng sai loại option', () => {
+    const result = validateTemplateAgainstData(
+      documentWith([
+        ...USES_ALL,
+        textWith('segment-boolean', { content: [{ option: 'showPrice' }] }),
+        textWith('condition-text', { visibleWhen: { op: 'option', option: 'footerText' } }),
+        textWith('choice-without-equals', { visibleWhen: { op: 'option', option: 'priceStyle' } }),
+        textWith('boolean-with-string', { visibleWhen: { op: 'option', option: 'showPrice', equals: 'yes' } }),
+        textWith('choice-outside-list', { visibleWhen: { op: 'option', option: 'priceStyle', equals: 'long' } }),
+      ]),
+      description,
+    );
+
+    expect(result.errors).toEqual([
+      { path: 'content.children[4].content[0]', message: 'option "showPrice" không phải kiểu text' },
+      {
+        path: 'content.children[5].visibleWhen',
+        message: 'option "footerText" kiểu text không dùng được trong điều kiện',
+      },
+      { path: 'content.children[6].visibleWhen', message: 'option "priceStyle" kiểu choice cần equals' },
+      { path: 'content.children[7].visibleWhen', message: 'equals của option "showPrice" phải là true hoặc false' },
+      {
+        path: 'content.children[8].visibleWhen',
+        message: 'equals của option "priceStyle" phải là 1 trong: "short", "full"',
+      },
+    ]);
+  });
+
+  it('kiểm tra cả tham chiếu trong điều kiện lồng và trong repeat', () => {
+    const result = validateTemplateAgainstData(
+      documentWith([
+        ...USES_ALL,
+        {
+          type: 'repeat',
+          id: 'items',
+          collection: 'items',
+          template: textWith('item', {
+            visibleWhen: { op: 'and', conditions: [{ op: 'exists', var: 'itemName' }, { op: 'option', option: 'x' }] },
+          }),
+        },
+      ]),
+      description,
+    );
+
+    expect(result.errors).toEqual([
+      { path: 'content.children[4].template.visibleWhen.conditions[1]', message: 'settings không có option "x"' },
+    ]);
+  });
+
+  it('cảnh báo style/option khai báo nhưng không dùng', () => {
+    const onlyStyle = documentWith([textWith('name', { styleName: 'itemName' })]);
+    const result = validateTemplateAgainstData(onlyStyle, description);
+
+    expect(result.errors).toEqual([]);
+    expect(result.warnings).toEqual([
+      { path: 'settings.options.showPrice', message: 'option "showPrice" khai báo nhưng không dùng' },
+      { path: 'settings.options.footerText', message: 'option "footerText" khai báo nhưng không dùng' },
+      { path: 'settings.options.priceStyle', message: 'option "priceStyle" khai báo nhưng không dùng' },
+    ]);
+  });
+});
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core
```

Expected: jest `Test Suites: 4 failed` / `Tests: 17 failed, 327 passed, 344 total` (`parseTemplate` phần tham chiếu, `validateSettingReferences`, `resolveSettings`, `TemplateSettingsDsl`).

- [ ] **Step 3: Viết code (patch `t3impl`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-29-template-settings.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t3impl | git apply --ignore-whitespace -
```

<!-- patch:t3impl -->
~~~diff
diff --git a/packages/printer-core/src/resolution/DocumentResolver.ts b/packages/printer-core/src/resolution/DocumentResolver.ts
index 4bf01e7..7ac0a65 100644
--- a/packages/printer-core/src/resolution/DocumentResolver.ts
+++ b/packages/printer-core/src/resolution/DocumentResolver.ts
@@ -33,6 +33,7 @@ export class DocumentResolver {
       assets: options.assets,
       frames: [createRootFrame(data)],
       page: COUNTING_PAGE,
+      settings: template.settings,
     };
     const parts = planPages(template.content, baseContext);
 
diff --git a/packages/printer-core/src/resolution/ResolveContext.ts b/packages/printer-core/src/resolution/ResolveContext.ts
index 45bd8a7..73e0bef 100644
--- a/packages/printer-core/src/resolution/ResolveContext.ts
+++ b/packages/printer-core/src/resolution/ResolveContext.ts
@@ -1,3 +1,4 @@
+import type { TemplateSettings } from '../template';
 import type { TemplateDataDefinition, TemplateDataIndex } from '../template/data';
 import type { AssetProvider } from './AssetProvider';
 
@@ -74,6 +75,9 @@ export interface ResolveContext {
 
   /** Thông tin trang đang resolve. */
   readonly page: PageInfo;
+
+  /** Settings của template; chỉ đọc `value`. */
+  readonly settings: TemplateSettings;
 }
 
 /** Tầng scope gốc chứa data của cả document. */
diff --git a/packages/printer-core/src/resolution/collectAssetIds.ts b/packages/printer-core/src/resolution/collectAssetIds.ts
index 07a3f95..03e9730 100644
--- a/packages/printer-core/src/resolution/collectAssetIds.ts
+++ b/packages/printer-core/src/resolution/collectAssetIds.ts
@@ -24,6 +24,7 @@ export function collectAssetIds<TData>(
     assets: NO_ASSETS,
     frames: [createRootFrame(data)],
     page: COUNTING_PAGE,
+    settings: template.settings,
   };
   const assetIds = new Set<string>();
   collectFromNode(template.content, context, assetIds);
diff --git a/packages/printer-core/src/resolution/evaluateCondition.ts b/packages/printer-core/src/resolution/evaluateCondition.ts
index d2bc01e..3a8122c 100644
--- a/packages/printer-core/src/resolution/evaluateCondition.ts
+++ b/packages/printer-core/src/resolution/evaluateCondition.ts
@@ -1,6 +1,8 @@
-import type { ComparisonCondition, Condition, TemplateNode } from '../template';
+import type { ComparisonCondition, Condition, OptionCondition, TemplateNode } from '../template';
 import { readVariableValue } from './readVariable';
 import type { ResolveContext } from './ResolveContext';
+import { ResolveError } from './ResolveError';
+import { readOptionSetting } from './readSetting';
 
 type NumericOperator = 'gt' | 'gte' | 'lt' | 'lte';
 
@@ -33,11 +35,28 @@ export function evaluateCondition(
       return hasValue(readVariableValue(context, condition.var, nodeId));
     case 'notEmpty':
       return isNotEmpty(readVariableValue(context, condition.var, nodeId));
+    case 'option':
+      return evaluateOptionCondition(condition, context, nodeId);
     default:
       return compare(condition, readVariableValue(context, condition.var, nodeId));
   }
 }
 
+// Không có `equals` nghĩa là "option boolean đang bật"; option text không mang nghĩa đúng/sai nên không dùng được.
+function evaluateOptionCondition(
+  condition: OptionCondition,
+  context: ResolveContext,
+  nodeId: string,
+): boolean {
+  const option = readOptionSetting(context, condition.option, nodeId);
+  if (option.type === 'text') {
+    throw new ResolveError(nodeId, `option "${condition.option}" kiểu text không dùng được trong điều kiện`);
+  }
+  if (condition.equals !== undefined) return option.value === condition.equals;
+  if (option.type === 'boolean') return option.value;
+  throw new ResolveError(nodeId, `option "${condition.option}" kiểu choice cần equals`);
+}
+
 function hasValue(value: unknown): boolean {
   return value !== undefined && value !== null;
 }
diff --git a/packages/printer-core/src/resolution/readSetting.ts b/packages/printer-core/src/resolution/readSetting.ts
new file mode 100644
index 0000000..1fbfe61
--- /dev/null
+++ b/packages/printer-core/src/resolution/readSetting.ts
@@ -0,0 +1,30 @@
+import type { OptionSetting, TextStyle } from '../template';
+import type { ResolveContext } from './ResolveContext';
+import { ResolveError } from './ResolveError';
+
+/** Style chữ của style có tên `name` — luôn là `value`, `default` chỉ dành cho UI. */
+export function readStyleSetting(
+  context: ResolveContext,
+  name: string,
+  nodeId: string,
+): TextStyle {
+  const styles = context.settings.styles;
+  if (!hasOwn(styles, name)) throw new ResolveError(nodeId, `settings không có style "${name}"`);
+  return styles[name].value;
+}
+
+/** Option `name` trong settings; throw `ResolveError` nếu không có. */
+export function readOptionSetting(
+  context: ResolveContext,
+  name: string,
+  nodeId: string,
+): OptionSetting {
+  const options = context.settings.options;
+  if (!hasOwn(options, name)) throw new ResolveError(nodeId, `settings không có option "${name}"`);
+  return options[name];
+}
+
+// Tên setting đến từ JSON nên phải tra đúng key riêng, không trúng `toString`... của prototype.
+function hasOwn(record: object, key: string): boolean {
+  return Object.prototype.hasOwnProperty.call(record, key);
+}
diff --git a/packages/printer-core/src/resolution/resolveContent.ts b/packages/printer-core/src/resolution/resolveContent.ts
index 4fbae69..23c8cf6 100644
--- a/packages/printer-core/src/resolution/resolveContent.ts
+++ b/packages/printer-core/src/resolution/resolveContent.ts
@@ -1,9 +1,13 @@
-import { formatValue, type Segment, type VariableSegment } from '../template';
+import { formatValue, type OptionSegment, type Segment, type VariableSegment } from '../template';
 import { isOptionalVariable, readVariableValue, variableTypeOf } from './readVariable';
 import type { ResolveContext } from './ResolveContext';
+import { readOptionSetting } from './readSetting';
 import { errorMessage, ResolveError } from './ResolveError';
 
-/** Ghép các segment thành chuỗi cần in: segment chữ giữ nguyên, segment biến đọc + format. */
+/**
+ * Ghép các segment thành chuỗi cần in: segment chữ giữ nguyên, segment biến đọc + format, segment option in
+ * `value` của option.
+ */
 export function resolveContent(
   segments: readonly Segment[],
   context: ResolveContext,
@@ -17,7 +21,8 @@ function resolveSegment(
   context: ResolveContext,
   nodeId: string,
 ): string {
-  if (!('var' in segment)) return segment.text;
+  if ('text' in segment) return segment.text;
+  if ('option' in segment) return resolveOptionSegment(segment, context, nodeId);
 
   const value = readVariableValue(context, segment.var, nodeId);
   if (value !== undefined && value !== null) return formatSegment(segment, value, context, nodeId);
@@ -25,6 +30,16 @@ function resolveSegment(
   throw new ResolveError(nodeId, `biến "${segment.var}" không có giá trị`);
 }
 
+function resolveOptionSegment(
+  segment: OptionSegment,
+  context: ResolveContext,
+  nodeId: string,
+): string {
+  const option = readOptionSetting(context, segment.option, nodeId);
+  if (option.type !== 'text') throw new ResolveError(nodeId, `option "${segment.option}" không phải kiểu text`);
+  return option.value;
+}
+
 function formatSegment(
   segment: VariableSegment,
   value: unknown,
diff --git a/packages/printer-core/src/resolution/resolveNode.ts b/packages/printer-core/src/resolution/resolveNode.ts
index e69a187..1579561 100644
--- a/packages/printer-core/src/resolution/resolveNode.ts
+++ b/packages/printer-core/src/resolution/resolveNode.ts
@@ -12,6 +12,7 @@ import { isNodeVisible } from './evaluateCondition';
 import { entryFrame, readRepeatEntries } from './readRepeatEntries';
 import { isOptionalVariable, readVariableValue } from './readVariable';
 import { resolveContent } from './resolveContent';
+import { readStyleSetting } from './readSetting';
 import { pushFrame, type PageInfo, type PagePart, type ResolveContext } from './ResolveContext';
 import type {
   ResolvedBarcode,
@@ -64,7 +65,18 @@ function resolveContainer(node: ContainerNode, context: ResolveContext): Resolve
 }
 
 function resolveText(node: TextNode, context: ResolveContext): ResolvedText {
-  return { type: 'text', id: node.id, value: resolveContent(node.content, context, node.id), style: node.style };
+  return {
+    type: 'text',
+    id: node.id,
+    value: resolveContent(node.content, context, node.id),
+    style: resolveTextStyle(node, context),
+  };
+}
+
+// Style có tên chỉ quản lý thuộc tính chữ; thuộc tính hộp (padding, width...) vẫn lấy từ node.
+function resolveTextStyle(node: TextNode, context: ResolveContext): ResolvedText['style'] {
+  if (node.styleName === undefined) return node.style;
+  return { ...node.style, ...readStyleSetting(context, node.styleName, node.id) };
 }
 
 function resolveLine(node: LineNode): ResolvedLine {
diff --git a/packages/printer-core/src/template/builder/SettingNames.ts b/packages/printer-core/src/template/builder/SettingNames.ts
new file mode 100644
index 0000000..5509e4d
--- /dev/null
+++ b/packages/printer-core/src/template/builder/SettingNames.ts
@@ -0,0 +1,28 @@
+type NameOf<TMap> = Extract<keyof TMap, string>;
+
+/** Settings rỗng — kiểu mặc định khi template chưa gọi `.settings(...)`. */
+export type NoSettings = Readonly<Record<never, never>>;
+
+type StylesOf<TSettings> = TSettings extends { readonly styles: infer TStyles } ? TStyles : NoSettings;
+
+type OptionsOf<TSettings> = TSettings extends { readonly options: infer TOptions } ? TOptions : NoSettings;
+
+type OptionNamesOfType<TSettings, TType extends string> = {
+  [TName in NameOf<OptionsOf<TSettings>>]: OptionsOf<TSettings>[TName] extends { readonly type: TType } ? TName : never;
+}[NameOf<OptionsOf<TSettings>>];
+
+/** Tên style có tên đã khai báo. */
+export type StyleNames<TSettings> = NameOf<StylesOf<TSettings>>;
+
+/** Tên option in được thành chữ (`text`). */
+export type TextOptionNames<TSettings> = OptionNamesOfType<TSettings, 'text'>;
+
+/** Tên option dùng được trong điều kiện (`boolean`, `choice`). */
+export type ConditionOptionNames<TSettings> = OptionNamesOfType<TSettings, 'boolean' | 'choice'>;
+
+/** Tham số `equals` của `scope.optionIs`: bắt buộc chuỗi với `choice`, tuỳ chọn boolean với `boolean`. */
+export type OptionEqualsArguments<TSettings, TName extends string> = OptionsOf<TSettings>[TName & NameOf<
+  OptionsOf<TSettings>
+>] extends { readonly type: 'choice' }
+  ? [equals: string]
+  : [equals?: boolean];
diff --git a/packages/printer-core/src/template/builder/StyleReference.ts b/packages/printer-core/src/template/builder/StyleReference.ts
new file mode 100644
index 0000000..4e2bec8
--- /dev/null
+++ b/packages/printer-core/src/template/builder/StyleReference.ts
@@ -0,0 +1,5 @@
+/** Tham chiếu 1 style có tên trong `settings` — tạo qua `scope.style(...)`, dùng với `text(...).style(...)`. */
+export interface StyleReference {
+  /** Tên style trong `settings.styles`. */
+  readonly styleName: string;
+}
diff --git a/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts b/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts
index 048a90c..5b49bf1 100644
--- a/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts
+++ b/packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts
@@ -5,6 +5,7 @@ import type { TemplateKind, TemplateLocale } from '../TemplateMetadata';
 import { TemplateNodeIdGenerator, type BuildContext } from './BuildContext';
 import type { TemplateNodeBuilder } from './NodeBuilder';
 import type { TemplateMetadataInput } from './TemplateMetadataInput';
+import type { NoSettings } from './SettingNames';
 import { TemplateScope } from './TemplateScope';
 import type { TemplateSettingsInput } from './TemplateSettingsInput';
 import { toTemplateSettings } from './toTemplateSettings';
@@ -23,16 +24,17 @@ export interface TemplateDataShape {
   describe(): TemplateDataDescription;
 }
 
-/** Scope gốc của template: biến gốc + collection cấp 1 của dữ liệu template. */
-export type RootScope<TTemplateData extends TemplateDataShape> = TemplateScope<
+/** Scope gốc của template: biến gốc + collection cấp 1 của dữ liệu template + settings đã khai báo. */
+export type RootScope<TTemplateData extends TemplateDataShape, TSettings = NoSettings> = TemplateScope<
   Extract<keyof TTemplateData['variables'], string>,
-  TTemplateData['collections']
+  TTemplateData['collections'],
+  TSettings
 >;
 
-/** Nội dung gốc: 1 builder, hoặc callback nhận scope gốc để dùng `scope.var`/`scope.repeat`. */
-export type RootContent<TTemplateData extends TemplateDataShape> =
+/** Nội dung gốc: 1 builder, hoặc callback nhận scope gốc để dùng `scope.var`/`scope.repeat`/settings. */
+export type RootContent<TTemplateData extends TemplateDataShape, TSettings = NoSettings> =
   | TemplateNodeBuilder
-  | ((scope: RootScope<TTemplateData>) => TemplateNodeBuilder);
+  | ((scope: RootScope<TTemplateData, TSettings>) => TemplateNodeBuilder);
 
 /** Lỗi khi `build()` gặp template không hợp lệ; `issues` chứa từng lỗi kèm vị trí. */
 export class TemplateBuildError extends Error {
@@ -44,12 +46,16 @@ export class TemplateBuildError extends Error {
 }
 
 /** Builder của `TemplateDocument`; tạo qua `labelTemplate(templateData)` hoặc `receiptTemplate(templateData)`. */
-export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TKind extends TemplateKind> {
+export class TemplateDocumentBuilder<
+  TTemplateData extends TemplateDataShape,
+  TKind extends TemplateKind,
+  TSettings extends TemplateSettingsInput = NoSettings,
+> {
   private metadataInput?: TemplateMetadataInput<TKind>;
 
   private settingsInput?: TemplateSettingsInput;
 
-  private rootContent?: RootContent<TTemplateData>;
+  private rootContent?: RootContent<TTemplateData, TSettings>;
 
   constructor(
     private readonly templateData: TTemplateData,
@@ -62,14 +68,20 @@ export class TemplateDocumentBuilder<TTemplateData extends TemplateDataShape, TK
     return this;
   }
 
-  /** Style có tên và option người dùng được chỉnh; bỏ qua là template không có setting nào. */
-  settings(value: TemplateSettingsInput): this {
+  /**
+   * Style có tên và option người dùng được chỉnh; bỏ qua là template không có setting nào. Gọi trước `.content(...)`
+   * để scope biết tên style/option.
+   */
+  settings<TNewSettings extends TemplateSettingsInput>(
+    value: TNewSettings,
+  ): TemplateDocumentBuilder<TTemplateData, TKind, TNewSettings> {
     this.settingsInput = value;
-    return this;
+    // Cùng 1 builder, chỉ đổi kiểu để scope của `.content(...)` biết settings vừa khai báo.
+    return this as unknown as TemplateDocumentBuilder<TTemplateData, TKind, TNewSettings>;
   }
 
   /** Cây node nội dung (bắt buộc). */
-  content(content: RootContent<TTemplateData>): this {
+  content(content: RootContent<TTemplateData, TSettings>): this {
     this.rootContent = content;
     return this;
   }
diff --git a/packages/printer-core/src/template/builder/TemplateScope.ts b/packages/printer-core/src/template/builder/TemplateScope.ts
index eb20206..81ec915 100644
--- a/packages/printer-core/src/template/builder/TemplateScope.ts
+++ b/packages/printer-core/src/template/builder/TemplateScope.ts
@@ -1,8 +1,17 @@
-import type { VariableSegment } from '../content/Segment';
+import type { OptionCondition } from '../content/Condition';
+import type { OptionSegment, VariableSegment } from '../content/Segment';
 import type { ValueFormat } from '../content/ValueFormat';
 import type { BuiltInVariableName } from '../data';
 import type { TemplateNodeBuilder } from './NodeBuilder';
 import { RepeatBuilder, type RepeatOptions } from './RepeatBuilder';
+import type {
+  ConditionOptionNames,
+  NoSettings,
+  OptionEqualsArguments,
+  StyleNames,
+  TextOptionNames,
+} from './SettingNames';
+import type { StyleReference } from './StyleReference';
 
 type NameOf<TMap> = Extract<keyof TMap, string>;
 
@@ -13,16 +22,19 @@ type ItemVariableNames<TCollection> = TCollection extends { readonly variables:
 type ChildCollections<TCollection> = TCollection extends { readonly collections: infer TChildren } ? TChildren : never;
 
 /** Scope bên trong `repeat` của collection `TName`: thêm biến của collection đó, collection con thành lặp được. */
-export type RepeatScope<TNames extends string, TCollections, TName extends NameOf<TCollections>> = TemplateScope<
-  TNames | ItemVariableNames<TCollections[TName]>,
-  ChildCollections<TCollections[TName]>
->;
+export type RepeatScope<
+  TNames extends string,
+  TCollections,
+  TName extends NameOf<TCollections>,
+  TSettings = NoSettings,
+> = TemplateScope<TNames | ItemVariableNames<TCollections[TName]>, ChildCollections<TCollections[TName]>, TSettings>;
 
 /**
- * Scope của DSL: chỉ để TypeScript kiểm tra tên biến/collection theo dữ liệu template ngay trong editor.
- * `TNames` là biến dùng được tại đây, `TCollections` là collection lặp được tại đây.
+ * Scope của DSL: chỉ để TypeScript kiểm tra tên biến/collection/setting ngay trong editor.
+ * `TNames` là biến dùng được tại đây, `TCollections` là collection lặp được tại đây, `TSettings` là settings đã
+ * khai báo.
  */
-export class TemplateScope<TNames extends string, TCollections> {
+export class TemplateScope<TNames extends string, TCollections, TSettings = NoSettings> {
   /** Segment lấy giá trị biến; gõ sai tên hoặc dùng biến ngoài scope là lỗi TypeScript. */
   var(name: TNames | BuiltInVariableName, format?: ValueFormat): VariableSegment {
     return format === undefined ? { var: name } : { var: name, format };
@@ -31,8 +43,27 @@ export class TemplateScope<TNames extends string, TCollections> {
   /** Lặp `render` cho từng phần tử của collection; callback nhận scope đã thêm biến của collection đó. */
   repeat<TName extends NameOf<TCollections>>(
     options: RepeatOptions<TName, ItemVariableNames<TCollections[TName]>>,
-    render: (scope: RepeatScope<TNames, TCollections, TName>) => TemplateNodeBuilder,
+    render: (scope: RepeatScope<TNames, TCollections, TName, TSettings>) => TemplateNodeBuilder,
   ): RepeatBuilder {
     return new RepeatBuilder(options, render(new TemplateScope()));
   }
+
+  /** Tham chiếu style có tên trong settings, dùng với `text(...).style(...)`. */
+  style(name: StyleNames<TSettings>): StyleReference {
+    return { styleName: name };
+  }
+
+  /** Segment in chữ của option kiểu `text`. */
+  option(name: TextOptionNames<TSettings>): OptionSegment {
+    return { option: name };
+  }
+
+  /** Điều kiện theo option: boolean không cần `equals` (đúng khi bật), choice bắt buộc `equals`. */
+  optionIs<TName extends ConditionOptionNames<TSettings>>(
+    name: TName,
+    ...equals: OptionEqualsArguments<TSettings, TName>
+  ): OptionCondition {
+    const [value] = equals;
+    return value === undefined ? { op: 'option', option: name } : { op: 'option', option: name, equals: value };
+  }
 }
diff --git a/packages/printer-core/src/template/builder/TextBuilder.ts b/packages/printer-core/src/template/builder/TextBuilder.ts
index f06037f..b4e4630 100644
--- a/packages/printer-core/src/template/builder/TextBuilder.ts
+++ b/packages/printer-core/src/template/builder/TextBuilder.ts
@@ -5,6 +5,7 @@ import type { TextStyle } from '../style/TextStyle';
 import type { BuildContext } from './BuildContext';
 import { NodeBuilder } from './NodeBuilder';
 import { toSegments, type SegmentInput } from './segments';
+import type { StyleReference } from './StyleReference';
 
 /** Builder của đoạn chữ. */
 export class TextBuilder extends NodeBuilder<TextNode> {
@@ -12,6 +13,8 @@ export class TextBuilder extends NodeBuilder<TextNode> {
 
   private textStyle: TextStyle = {};
 
+  private styleName?: string;
+
   constructor(content: SegmentInput) {
     super();
     this.content = toSegments(content);
@@ -32,6 +35,12 @@ export class TextBuilder extends NodeBuilder<TextNode> {
     return this;
   }
 
+  /** Dùng style có tên trong settings (tạo qua `scope.style(...)`) thay cho cỡ chữ/đậm/căn lề viết thẳng. */
+  style(reference: StyleReference): this {
+    this.styleName = reference.styleName;
+    return this;
+  }
+
   /** Hệ số chiều cao dòng so với cỡ chữ, VD 1.2. */
   lineHeight(ratio: number): this {
     this.textStyle = { ...this.textStyle, lineHeight: ratio };
@@ -44,6 +53,7 @@ export class TextBuilder extends NodeBuilder<TextNode> {
       id: this.resolveId(context, 'text'),
       ...this.visibilityField(),
       content: this.content,
+      ...(this.styleName === undefined ? {} : { styleName: this.styleName }),
       ...this.styleField({ ...this.boxStyle, ...this.textStyle }),
     };
   }
diff --git a/packages/printer-core/src/template/builder/index.ts b/packages/printer-core/src/template/builder/index.ts
index 0105593..8b02d94 100644
--- a/packages/printer-core/src/template/builder/index.ts
+++ b/packages/printer-core/src/template/builder/index.ts
@@ -10,6 +10,14 @@ export { image, ImageBuilder } from './ImageBuilder';
 export { line, LineBuilder } from './LineBuilder';
 export { RepeatBuilder, type RepeatOptions } from './RepeatBuilder';
 export { TemplateScope, type RepeatScope } from './TemplateScope';
+export type { StyleReference } from './StyleReference';
+export type {
+  NoSettings,
+  StyleNames,
+  TextOptionNames,
+  ConditionOptionNames,
+  OptionEqualsArguments,
+} from './SettingNames';
 export type { SegmentInput } from './segments';
 export {
   labelTemplate,
diff --git a/packages/printer-core/src/template/content/Condition.ts b/packages/printer-core/src/template/content/Condition.ts
index f56ac94..09954a6 100644
--- a/packages/printer-core/src/template/content/Condition.ts
+++ b/packages/printer-core/src/template/content/Condition.ts
@@ -36,5 +36,19 @@ export interface NotCondition {
   readonly condition: Condition;
 }
 
+/**
+ * Theo `value` của 1 option trong `settings`: không có `equals` thì đúng khi option boolean đang bật; có `equals` thì
+ * đúng khi `value` bằng nó (boolean hoặc `value` của 1 lựa chọn `choice`).
+ */
+export interface OptionCondition {
+  readonly op: 'option';
+
+  /** Tên option kiểu `boolean` hoặc `choice`. */
+  readonly option: string;
+
+  /** Giá trị cần bằng; bỏ trống chỉ dùng với option boolean (nghĩa là đang bật). */
+  readonly equals?: string | boolean;
+}
+
 /** Điều kiện ẩn/hiện node — data thuần, không phải biểu thức chuỗi, nên không cần parser/eval. */
-export type Condition = PresenceCondition | ComparisonCondition | GroupCondition | NotCondition;
+export type Condition = PresenceCondition | ComparisonCondition | GroupCondition | NotCondition | OptionCondition;
diff --git a/packages/printer-core/src/template/content/Segment.ts b/packages/printer-core/src/template/content/Segment.ts
index 5eb10ac..905c4e5 100644
--- a/packages/printer-core/src/template/content/Segment.ts
+++ b/packages/printer-core/src/template/content/Segment.ts
@@ -15,5 +15,11 @@ export interface VariableSegment {
   readonly format?: ValueFormat;
 }
 
+/** Đoạn in chữ của 1 option kiểu `text` trong `settings` (VD dòng cuối hoá đơn). */
+export interface OptionSegment {
+  /** Tên option kiểu `text`. */
+  readonly option: string;
+}
+
 /** 1 đoạn nội dung động của text/barcode/QR — nội dung là mảng segment ghép liền nhau. */
-export type Segment = TextSegment | VariableSegment;
+export type Segment = TextSegment | VariableSegment | OptionSegment;
diff --git a/packages/printer-core/src/template/nodes/TextNode.ts b/packages/printer-core/src/template/nodes/TextNode.ts
index f4b16fa..3520823 100644
--- a/packages/printer-core/src/template/nodes/TextNode.ts
+++ b/packages/printer-core/src/template/nodes/TextNode.ts
@@ -10,6 +10,9 @@ export interface TextNode extends TemplateNodeBase {
   /** Nội dung: các segment ghép liền nhau thành 1 chuỗi. */
   readonly content: readonly Segment[];
 
+  /** Tên style trong `settings.styles`; có thì style chữ lấy từ settings, `style` chỉ còn thuộc tính hộp. */
+  readonly styleName?: string;
+
   /** Style hộp và style chữ. */
   readonly style?: BoxStyle & TextStyle;
 }
diff --git a/packages/printer-core/src/template/parse/checkSettingReferences.ts b/packages/printer-core/src/template/parse/checkSettingReferences.ts
new file mode 100644
index 0000000..3370fa5
--- /dev/null
+++ b/packages/printer-core/src/template/parse/checkSettingReferences.ts
@@ -0,0 +1,174 @@
+import type { Condition, OptionCondition } from '../content/Condition';
+import type { Segment } from '../content/Segment';
+import type { TemplateNode } from '../nodes/TemplateNode';
+import type { OptionSetting } from '../settings';
+import type { TemplateDocument } from '../TemplateDocument';
+import type { TemplateIssue } from './TemplateIssue';
+
+/** Trạng thái 1 lần kiểm tra: settings của template, tên đã dùng, lỗi/cảnh báo gom được. */
+interface SettingReferenceCheck {
+  readonly template: TemplateDocument;
+
+  readonly usedStyles: Set<string>;
+
+  readonly usedOptions: Set<string>;
+
+  readonly errors: TemplateIssue[];
+
+  readonly warnings: TemplateIssue[];
+}
+
+/** Lỗi và cảnh báo của các tham chiếu tới `settings` trong cây node. */
+export interface SettingReferenceResult {
+  /** Tham chiếu không tồn tại hoặc dùng sai loại option. */
+  readonly errors: readonly TemplateIssue[];
+
+  /** Style/option khai báo mà không node nào dùng. */
+  readonly warnings: readonly TemplateIssue[];
+}
+
+/** Kiểm tra `styleName`, segment và điều kiện `option` trỏ đúng setting khai báo, và đúng loại option. */
+export function checkSettingReferences(template: TemplateDocument): SettingReferenceResult {
+  const check: SettingReferenceCheck = {
+    template,
+    usedStyles: new Set(),
+    usedOptions: new Set(),
+    errors: [],
+    warnings: [],
+  };
+  checkNode(check, template.content, 'content');
+  warnUnused(check);
+  return { errors: check.errors, warnings: check.warnings };
+}
+
+function checkNode(
+  check: SettingReferenceCheck,
+  node: TemplateNode,
+  path: string,
+): void {
+  if (node.visibleWhen) checkCondition(check, node.visibleWhen, `${path}.visibleWhen`);
+
+  switch (node.type) {
+    case 'container':
+      node.children.forEach((child, index) => checkNode(check, child, `${path}.children[${index}]`));
+      return;
+    case 'text':
+      if (node.styleName !== undefined) checkStyleName(check, node.styleName, `${path}.styleName`);
+      checkSegments(check, node.content, `${path}.content`);
+      return;
+    case 'barcode':
+    case 'qrcode':
+      checkSegments(check, node.content, `${path}.content`);
+      return;
+    case 'repeat':
+      checkNode(check, node.template, `${path}.template`);
+      return;
+    case 'image':
+    case 'line':
+      return;
+  }
+}
+
+function checkStyleName(
+  check: SettingReferenceCheck,
+  name: string,
+  path: string,
+): void {
+  check.usedStyles.add(name);
+  if (!hasOwn(check.template.settings.styles, name)) {
+    check.errors.push({ path, message: `settings không có style "${name}"` });
+  }
+}
+
+function checkSegments(
+  check: SettingReferenceCheck,
+  segments: readonly Segment[],
+  path: string,
+): void {
+  segments.forEach((segment, index) => {
+    if (!('option' in segment)) return;
+
+    const segmentPath = `${path}[${index}]`;
+    const option = findOption(check, segment.option, segmentPath);
+    if (option && option.type !== 'text') {
+      check.errors.push({ path: segmentPath, message: `option "${segment.option}" không phải kiểu text` });
+    }
+  });
+}
+
+function checkCondition(
+  check: SettingReferenceCheck,
+  condition: Condition,
+  path: string,
+): void {
+  switch (condition.op) {
+    case 'and':
+    case 'or':
+      condition.conditions.forEach((child, index) => checkCondition(check, child, `${path}.conditions[${index}]`));
+      return;
+    case 'not':
+      checkCondition(check, condition.condition, `${path}.condition`);
+      return;
+    case 'option':
+      checkOptionCondition(check, condition, path);
+      return;
+    default:
+      return;
+  }
+}
+
+function checkOptionCondition(
+  check: SettingReferenceCheck,
+  condition: OptionCondition,
+  path: string,
+): void {
+  const option = findOption(check, condition.option, path);
+  if (!option) return;
+
+  const message = optionConditionError(option, condition);
+  if (message !== undefined) check.errors.push({ path, message });
+}
+
+// Trả câu lỗi khi điều kiện dùng sai loại option; `undefined` là hợp lệ.
+function optionConditionError(option: OptionSetting, condition: OptionCondition): string | undefined {
+  const name = condition.option;
+  if (option.type === 'text') return `option "${name}" kiểu text không dùng được trong điều kiện`;
+  if (option.type === 'boolean') {
+    if (condition.equals === undefined || typeof condition.equals === 'boolean') return undefined;
+    return `equals của option "${name}" phải là true hoặc false`;
+  }
+  if (condition.equals === undefined) return `option "${name}" kiểu choice cần equals`;
+
+  const values = option.choices.map((choice) => choice.value);
+  if (typeof condition.equals === 'string' && values.includes(condition.equals)) return undefined;
+  return `equals của option "${name}" phải là 1 trong: ${values.map((value) => `"${value}"`).join(', ')}`;
+}
+
+function findOption(
+  check: SettingReferenceCheck,
+  name: string,
+  path: string,
+): OptionSetting | undefined {
+  check.usedOptions.add(name);
+  const options = check.template.settings.options;
+  if (hasOwn(options, name)) return options[name];
+
+  check.errors.push({ path, message: `settings không có option "${name}"` });
+  return undefined;
+}
+
+function warnUnused(check: SettingReferenceCheck): void {
+  for (const name of Object.keys(check.template.settings.styles)) {
+    if (check.usedStyles.has(name)) continue;
+    check.warnings.push({ path: `settings.styles.${name}`, message: `style "${name}" khai báo nhưng không dùng` });
+  }
+  for (const name of Object.keys(check.template.settings.options)) {
+    if (check.usedOptions.has(name)) continue;
+    check.warnings.push({ path: `settings.options.${name}`, message: `option "${name}" khai báo nhưng không dùng` });
+  }
+}
+
+// Tên setting đến từ JSON nên phải tra đúng key riêng, không trúng `toString`... của prototype.
+function hasOwn(record: object, key: string): boolean {
+  return Object.prototype.hasOwnProperty.call(record, key);
+}
diff --git a/packages/printer-core/src/template/parse/validateContent.ts b/packages/printer-core/src/template/parse/validateContent.ts
index 4163a2a..0993511 100644
--- a/packages/printer-core/src/template/parse/validateContent.ts
+++ b/packages/printer-core/src/template/parse/validateContent.ts
@@ -18,11 +18,18 @@ export function validateSegments(cursor: JsonCursor): void {
   for (const segment of cursor.expectItems()) validateSegment(segment);
 }
 
+/** Field phân biệt loại segment; mỗi segment có đúng 1 field. */
+const SEGMENT_KINDS: readonly string[] = ['text', 'var', 'option'];
+
 /** Kiểm tra `Condition` (đệ quy qua `and`/`or`/`not`). */
 export function validateCondition(cursor: JsonCursor): void {
   if (!cursor.expectObject()) return;
 
   const operator = cursor.field('op').value;
+  if (operator === 'option') {
+    validateOptionCondition(cursor);
+    return;
+  }
   if (typeof operator === 'string' && PRESENCE_OPERATORS.includes(operator)) {
     cursor.field('var').expectNonEmptyString();
     return;
@@ -45,24 +52,36 @@ export function validateCondition(cursor: JsonCursor): void {
 function validateSegment(cursor: JsonCursor): void {
   if (!cursor.expectObject()) return;
 
-  const hasText = cursor.has('text');
-  const hasVar = cursor.has('var');
-  if (hasText && hasVar) {
-    cursor.report('segment chỉ được có 1 trong 2 field "text" hoặc "var"');
+  const kinds = SEGMENT_KINDS.filter((kind) => cursor.has(kind));
+  if (kinds.length > 1) {
+    cursor.report('segment chỉ được có 1 trong các field "text", "var", "option"');
+    return;
+  }
+  if (kinds.length === 0) {
+    cursor.report('segment phải có "text", "var" hoặc "option"');
     return;
   }
-  if (hasText) {
+  if (kinds[0] === 'text') {
     if (typeof cursor.field('text').value !== 'string') cursor.field('text').report('phải là chuỗi');
     return;
   }
-  if (!hasVar) {
-    cursor.report('segment phải có "text" hoặc "var"');
+  if (kinds[0] === 'option') {
+    cursor.field('option').expectNonEmptyString();
     return;
   }
   cursor.field('var').expectNonEmptyString();
   if (cursor.has('format')) validateValueFormat(cursor.field('format'));
 }
 
+function validateOptionCondition(cursor: JsonCursor): void {
+  cursor.field('option').expectNonEmptyString();
+
+  const equalsType = typeof cursor.field('equals').value;
+  if (cursor.has('equals') && equalsType !== 'string' && equalsType !== 'boolean') {
+    cursor.field('equals').report('phải là chuỗi hoặc boolean');
+  }
+}
+
 function validateValueFormat(cursor: JsonCursor): void {
   if (!cursor.expectObject()) return;
 
diff --git a/packages/printer-core/src/template/parse/validateNode.ts b/packages/printer-core/src/template/parse/validateNode.ts
index 122ab0f..87ee86e 100644
--- a/packages/printer-core/src/template/parse/validateNode.ts
+++ b/packages/printer-core/src/template/parse/validateNode.ts
@@ -29,6 +29,9 @@ const QR_ERROR_CORRECTION_LEVELS: Readonly<Record<QrErrorCorrectionLevel, true>>
 
 const LINE_PATTERNS: readonly string[] = ['solid', 'dashed'];
 
+/** Thuộc tính chữ mà style có tên trong `settings` quản lý. */
+const TEXT_STYLE_FIELDS: readonly string[] = ['fontSize', 'fontWeight', 'lineHeight', 'textAlign'];
+
 type NodeValidator = (cursor: JsonCursor, seenIds: Set<string>) => void;
 
 const NODE_VALIDATORS: Readonly<Record<TemplateNodeType, NodeValidator>> = {
@@ -79,6 +82,17 @@ function validateContainer(cursor: JsonCursor, seenIds: Set<string>): void {
 function validateText(cursor: JsonCursor): void {
   validateSegments(cursor.field('content'));
   validateTextStyle(cursor.field('style'));
+  if (cursor.has('styleName')) validateStyleName(cursor);
+}
+
+// Nếu cho trộn, người dùng chỉnh cỡ chữ trong settings mà bản in không đổi vì bị style viết thẳng đè.
+function validateStyleName(cursor: JsonCursor): void {
+  cursor.field('styleName').expectNonEmptyString();
+
+  const style = cursor.field('style');
+  for (const field of TEXT_STYLE_FIELDS) {
+    if (style.has(field)) style.field(field).report('không dùng cùng styleName (style chữ lấy từ settings)');
+  }
 }
 
 function validateLine(cursor: JsonCursor): void {
diff --git a/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts b/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
index 363305a..abeae25 100644
--- a/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
+++ b/packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
@@ -14,6 +14,7 @@ import type { ImageNode } from '../nodes/ImageNode';
 import type { RepeatNode } from '../nodes/RepeatNode';
 import type { TemplateNode } from '../nodes/TemplateNode';
 import type { TemplateDocument } from '../TemplateDocument';
+import { checkSettingReferences } from './checkSettingReferences';
 import type { TemplateIssue } from './TemplateIssue';
 
 /** Kết quả kiểm tra template theo dữ liệu template. */
@@ -60,7 +61,8 @@ const ROOT_SCOPE: ValidationScope = { collections: [], expanded: false };
 
 /**
  * Kiểm tra template khớp dữ liệu template: biến tồn tại và dùng đúng scope, collection/expand hợp lệ, ảnh dùng biến
- * kiểu `asset`, format hợp kiểu biến. Nhận metadata (`describe()`) nên BE/designer dùng chung được.
+ * kiểu `asset`, format hợp kiểu biến; kèm tham chiếu style/option trỏ đúng `settings`. Nhận metadata (`describe()`)
+ * nên BE/designer dùng chung được.
  */
 export function validateTemplateAgainstData(
   template: TemplateDocument,
@@ -69,7 +71,12 @@ export function validateTemplateAgainstData(
   const index = createTemplateDataIndex(description);
   const check: TemplateDataCheck = { description, index, errors: [], warnings: [] };
   checkNode(check, template.content, 'content', ROOT_SCOPE);
-  return { errors: check.errors, warnings: check.warnings };
+
+  const settingReferences = checkSettingReferences(template);
+  return {
+    errors: [...check.errors, ...settingReferences.errors],
+    warnings: [...check.warnings, ...settingReferences.warnings],
+  };
 }
 
 function addError(
@@ -119,6 +126,7 @@ function checkSegments(
   scope: ValidationScope,
 ): void {
   segments.forEach((segment, index) => {
+    // Segment option do checkSettingReferences kiểm.
     if (!('var' in segment)) return;
 
     const segmentPath = `${path}[${index}]`;
@@ -208,6 +216,9 @@ function checkCondition(
     case 'not':
       checkCondition(check, condition.condition, `${path}.condition`, scope);
       return;
+    case 'option':
+      // Điều kiện option không đọc biến; checkSettingReferences kiểm.
+      return;
     default:
       checkVariableUse(check, condition.var, path, scope);
   }
~~~

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì (kể cả các `@ts-expect-error` trong test DSL đều đúng chỗ); jest `344 passed, 344 total`; `printer-preview` tsc sạch, Vitest `13 passed`; eslint `0 errors`.

- [ ] **Step 5: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/src/resolution/DocumentResolver.ts \
  packages/printer-core/src/resolution/ResolveContext.ts \
  packages/printer-core/src/resolution/__tests__/resolveSettings.test.ts \
  packages/printer-core/src/resolution/collectAssetIds.ts \
  packages/printer-core/src/resolution/evaluateCondition.ts \
  packages/printer-core/src/resolution/readSetting.ts \
  packages/printer-core/src/resolution/resolveContent.ts \
  packages/printer-core/src/resolution/resolveNode.ts \
  packages/printer-core/src/template/builder/SettingNames.ts \
  packages/printer-core/src/template/builder/StyleReference.ts \
  packages/printer-core/src/template/builder/TemplateDocumentBuilder.ts \
  packages/printer-core/src/template/builder/TemplateScope.ts \
  packages/printer-core/src/template/builder/TextBuilder.ts \
  packages/printer-core/src/template/builder/__tests__/TemplateSettingsDsl.test.ts \
  packages/printer-core/src/template/builder/index.ts \
  packages/printer-core/src/template/content/Condition.ts \
  packages/printer-core/src/template/content/Segment.ts \
  packages/printer-core/src/template/nodes/TextNode.ts \
  packages/printer-core/src/template/parse/__tests__/parseTemplate.test.ts \
  packages/printer-core/src/template/parse/__tests__/validateSettingReferences.test.ts \
  packages/printer-core/src/template/parse/checkSettingReferences.ts \
  packages/printer-core/src/template/parse/validateContent.ts \
  packages/printer-core/src/template/parse/validateNode.ts \
  packages/printer-core/src/template/parse/validateTemplateAgainstData.ts
git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: reference template settings from nodes and resolve their values" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Task 4: Mẫu `printer-preview` dùng settings, README

**Files:**
- Modify: `packages/printer-preview/src/defaultSample.ts`, `packages/printer-core/README.md`
- Test: `packages/printer-preview/src/__tests__/defaultSample.test.ts`

**Interfaces:**
- Consumes: DSL `.settings`, `scope.style`, `scope.optionIs` (Task 3); `and` (có sẵn).
- Produces: mẫu mặc định có style `productName` và option boolean `showPrice` (tắt thì tem không in giá); README mô tả `metadata`/`settings`/`content` và in đúng cỡ.

- [ ] **Step 1: Viết test (patch `t4test`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-29-template-settings.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t4test | git apply --ignore-whitespace -
```

<!-- patch:t4test -->
~~~diff
diff --git a/packages/printer-preview/src/__tests__/defaultSample.test.ts b/packages/printer-preview/src/__tests__/defaultSample.test.ts
index 89dcbaa..8ff6192 100644
--- a/packages/printer-preview/src/__tests__/defaultSample.test.ts
+++ b/packages/printer-preview/src/__tests__/defaultSample.test.ts
@@ -14,6 +14,25 @@ describe('defaultSample', () => {
     expect(previews.map((preview) => preview.status)).toEqual(['ok', 'ok']);
   });
 
+  it('mẫu khai báo settings: style tên món và option in giá; tắt option thì tem không in giá', () => {
+    const evaluated = evaluateTemplate(defaultCode);
+    if (evaluated.status !== 'ok') throw new Error(evaluated.message);
+
+    const { settings } = evaluated.template;
+    expect(Object.keys(settings.styles)).toEqual(['productName']);
+    const showPrice = settings.options.showPrice;
+    if (showPrice?.type !== 'boolean') throw new Error('mẫu cần option boolean showPrice');
+
+    const withoutPrice = {
+      ...evaluated.template,
+      settings: { ...settings, options: { ...settings.options, showPrice: { ...showPrice, value: false } } },
+    };
+    const [firstLabel] = renderPreviews(withoutPrice, evaluated.templateData, JSON.parse(defaultData), 'tspl');
+    if (firstLabel.status !== 'ok') throw new Error(firstLabel.message);
+
+    expect(firstLabel.svg).not.toContain('45.000đ');
+  });
+
   it('món 9 topping tách thành 3 tem mỗi ly (4 + 4 + 1)', () => {
     const evaluated = evaluateTemplate(defaultCode);
     if (evaluated.status !== 'ok') throw new Error(evaluated.message);
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
(cd packages/printer-preview && npx vitest run)
```

Expected: Vitest `1 failed | 13 passed` (`mẫu khai báo settings…` — mẫu chưa có `settings`).

- [ ] **Step 3: Viết code (patch `t4impl`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-29-template-settings.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t4impl | git apply --ignore-whitespace -
```

<!-- patch:t4impl -->
~~~diff
diff --git a/packages/printer-core/README.md b/packages/printer-core/README.md
index b610387..742bd2c 100644
--- a/packages/printer-core/README.md
+++ b/packages/printer-core/README.md
@@ -10,7 +10,8 @@ TemplateDocument (JSON, DSL) ──parseTemplate──▶ resolve (template data
                      └─previewFor─▶ SVG xem trước
 ```
 
-- **Template:** `TemplateDocument` là JSON thuần, độc lập DPI; DSL `labelTemplate`/`receiptTemplate` sinh ra nó.
+- **Template:** `TemplateDocument` là JSON thuần, độc lập DPI, gồm `metadata`, `settings` và `content`; DSL
+  `labelTemplate`/`receiptTemplate` sinh ra nó.
 - **Dữ liệu:** biến đọc qua định nghĩa dữ liệu template (`defineTemplateData`), không trỏ thẳng vào data.
 - **Compile:** mỗi ngôn ngữ có compiler, parser (đọc ngược lệnh), validator, preview SVG. Năng lực máy in đích
   truyền vào qua `PrinterFeatures`.
@@ -45,14 +46,16 @@ src/
 ├── template/       # TemplateDocument JSON độc lập DPI
 │   ├── data/       # dữ liệu template: defineTemplateData, defineCollection, TemplateDataReader,
 │   │               # TemplateDataIndex, biến có sẵn
+│   ├── settings/   # TemplateSettings: StyleSetting, OptionSetting (boolean/text/choice)
 │   ├── style/      # Length, Dimension, Insets, BoxStyle, LayoutStyle, TextStyle
 │   ├── content/    # Segment, ValueFormat, Condition
 │   ├── nodes/      # TemplateNode và các node container/text/image/barcode/qrcode/line/repeat
 │   ├── format/     # formatter vi-VN tự cài đặt (không dùng Intl)
 │   ├── parse/      # parseTemplate, validate cấu trúc/tách tem/theo dữ liệu template
-│   └── builder/    # DSL labelTemplate/receiptTemplate(templateData), scope.var/repeat
+│   └── builder/    # DSL labelTemplate/receiptTemplate(templateData), .metadata/.settings/.content,
+│                   # scope.var/repeat/style/option/optionIs
 ├── resolution/     # ghép template + data qua dữ liệu template, kế hoạch trang (planPages), tách repeat lồng
-├── layout/         # đổi Length → dots theo DPI rồi xếp vị trí, sinh PrintElement[]
+├── layout/         # đổi Length → dots theo DPI rồi xếp vị trí, sinh PrintElement[] + cảnh báo tràn khổ giấy
 ├── document/       # ResolvedPrintDocument + PrintElement (content/drawing/layout/control)
 ├── core/           # contract: PrinterLanguage, PrintCompiler/Parser/Preview/Validation, CompileResult,
 │                   # PrintParseResult, PrinterFeatures, UnsupportedLanguageError
@@ -84,8 +87,28 @@ Test đặt trong `__tests__/` cạnh file nguồn; test tích hợp ở `src/__
 - Biến có sẵn `$part`/`$partCount` (dùng ở mọi chỗ) cho biết tem thứ mấy trong phần tử; là 1/1 khi không tách tem.
   VD chỉ in giá ở tem đầu: `visibleWhen(eq('$part', 1))`.
 
+## Settings của template
+
+`TemplateDocument` gồm:
+
+- `metadata`: `id`, `name`, `kind` (công dụng: `receipt` là hoá đơn, `label` là tem — app chọn dữ liệu template theo
+  field này), `locale`, `paper` (có `heightMm` là tem, không có là giấy cuộn).
+- `settings`: những gì người dùng được chỉnh.
+  - `styles`: style chữ có tên (cỡ, đậm, căn lề, giãn dòng); text node tham chiếu qua `styleName` và khi đó không đặt
+    thuộc tính chữ viết thẳng.
+  - `options`: `boolean`, `text`, `choice`; node dùng qua điều kiện `{ op: 'option' }` và segment `{ option }`.
+  - Mỗi mục có `value` (dùng khi in) và `default` (chỉ để UI hiển thị/khôi phục, **không bao giờ đọc khi in**).
+- `content`: cây node.
+
+DSL: `.metadata({...})`, `.settings({...})` (gọi trước `.content`, `default` bỏ trống lấy bằng `value`), rồi
+`scope.style(...)`, `scope.option(...)`, `scope.optionIs(...)` — gõ sai tên hoặc sai loại option là lỗi TypeScript.
+`validateTemplateAgainstData` báo lỗi tham chiếu sai và cảnh báo setting khai báo mà không dùng.
+
 ## Cỡ chữ và cảnh báo compile
 
+- **In đúng cỡ:** layout không tự thu nhỏ chữ. Nội dung rộng hơn giấy, hoặc cao hơn tem, vẫn được xếp nguyên và
+  `LayoutEngine.resolve()` trả kèm cảnh báo trong `warnings`; chia nội dung dài sang nhiều tem bằng `maxItemsPerPage`.
+
 - **Cỡ chữ:** `TextOptions.fontSize` (dots) là field cỡ chữ duy nhất của `PrintElement` text.
   - Mỗi ngôn ngữ quy đổi sang lệnh native qua `language/{lang}/{Lang}FontMetrics.ts`.
   - Đây là nguồn dữ liệu font duy nhất, dùng chung cho compiler, parser (dựng lại `fontSize` best-effort) và
diff --git a/packages/printer-preview/src/defaultSample.ts b/packages/printer-preview/src/defaultSample.ts
index 38dc338..abb2a1d 100644
--- a/packages/printer-preview/src/defaultSample.ts
+++ b/packages/printer-preview/src/defaultSample.ts
@@ -1,4 +1,5 @@
 export const defaultCode = `import {
+  and,
   column,
   defineCollection,
   defineTemplateData,
@@ -65,6 +66,10 @@ export const templateData = defineTemplateData({
 
 export default labelTemplate(templateData)
   .metadata({ id: 'product-label-default', name: 'Tem món mặc định', paper: { widthMm: 50, heightMm: 30 } })
+  .settings({
+    styles: { productName: { label: 'Tên món', value: { fontSize: px(16), fontWeight: 'bold' } } },
+    options: { showPrice: { label: 'In giá món', type: 'boolean', value: true } },
+  })
   .content((scope) =>
     scope
       .repeat({ collection: 'products', expand: 'quantity' }, (product) =>
@@ -72,8 +77,8 @@ export default labelTemplate(templateData)
           .padding(insets(mm(2)))
           .gap(mm(1))
           .children(
-            text([product.var('productName')]).fontSize(px(16)).bold(),
-            text([product.var('productPrice')]).visibleWhen(eq('$part', 1)),
+            text([product.var('productName')]).style(product.style('productName')),
+            text([product.var('productPrice')]).visibleWhen(and(product.optionIs('showPrice'), eq('$part', 1))),
             product
               .repeat({ collection: 'toppings' }, (topping) => text([{ text: '+ ' }, topping.var('toppingName')]))
               .maxItemsPerPage(4),
~~~

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
npx eslint packages/printer-core/src packages/printer-preview/src
node -e "require('fs').readFileSync('packages/printer-core/README.md','utf8').split(/\r?\n/).forEach((l,i)=>{if(l.length>120)console.log(i+1,l.length)})"
```

Expected: tsc không in gì; jest `344 passed, 344 total`; `printer-preview` tsc sạch, Vitest `14 passed`; eslint `0 errors`; lệnh README không in gì.

- [ ] **Step 5: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/README.md \
  packages/printer-preview/src/__tests__/defaultSample.test.ts \
  packages/printer-preview/src/defaultSample.ts
git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "docs: show template settings in preview sample and README" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Kiểm tra cuối (sau Task 4)

```bash
grep -rnE "TemplateMedia|\bdataId\b|template\.root|TypographyProfile|FontScaleLevel" packages/printer-core packages/printer-preview/src --include=*.ts --include=*.tsx --include=*.md --exclude-dir=node_modules
grep -rn "\.default\b" packages/printer-core/src/resolution packages/printer-core/src/layout packages/printer-core/src/language
```

Expected: cả 2 lệnh không in gì (không còn tên cũ; resolve/layout/compile không đọc `default` của settings).
