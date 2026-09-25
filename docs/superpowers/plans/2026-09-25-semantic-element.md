# Semantic Element & Compile Warnings (Sub-spec C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TextOptions` chỉ còn cỡ chữ ngữ nghĩa `fontSize` (dots). Mỗi ngôn ngữ quy đổi cỡ chữ qua đúng 1 nguồn `{Lang}FontMetrics`, dùng chung cho compiler, parser và preview. `PrintCompiler.compile()` và `compileTo()` trả `{ output, warnings }`, báo mọi field bị bỏ/gộp và mọi element ngôn ngữ không có lệnh tương ứng.

**Architecture:** `LayoutEngine` đưa thẳng `fontSize` (dots) vào `TextOptions`, không còn `toMagnification()`. Mỗi `language/{lang}/` có thêm `{Lang}FontMetrics.ts`, dựa trên 1 trong 3 cách tính:
- `BitmapFont.ts`: chọn font bitmap + hệ số phóng đại (TSPL, EPL, CPCL).
- `MagnifiedFont.ts`: 1 font phóng đại nguyên (DPL, SBPL, ESC/POS, Star PRNT).
- Dots trực tiếp (ZPL, IPL).

Compiler gom cảnh báo bằng `CompileWarnings` (`language/`), tạo mới cho mỗi lần `compile()`. Output của mọi element không hỗ trợ giữ nguyên như cũ (vẫn không phát lệnh), chỉ thêm cảnh báo.

**Tech Stack:**
- TypeScript 5.9 strict.
- Jest (preset react-native) cho `printer-core`.
- `printer-preview` (Vitest) không đổi code nhưng phải còn xanh.
- `printer-core` không có dependency.

**Spec:** `docs/superpowers/specs/2026-09-23-printer-core-semantic-element-design.md`. Spec này thuộc kiến trúc tổng `docs/superpowers/specs/2026-09-24-print-template-pipeline-overview.md`.

## Global Constraints

**Quy ước code (bắt buộc cho mọi sub-spec)** — chép nguyên văn từ overview:

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

**Ràng buộc khác:**

- **Branch:** làm trên `refactor/semantic-element`. Branch này tạo từ `main` (`d940d7c`) và đã chứa commit của chính file plan này. Checkout thẳng trong working directory chính, **không dùng git worktree**, không commit thẳng `main`.
- **Dependency:** `printer-core` giữ zero-dependency.
- **Stage file:** chỉ stage đúng file của task (lệnh `git add` cho sẵn trong từng task). **Không bao giờ** `git add -A` hay `git add .`.
- **Commit message:** dạng `<type>: <mô tả ngắn>`, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Nơi chạy lệnh:** mọi lệnh chạy từ `C:\NDTCORE\NDTCore\NDTCore.App` bằng Git Bash.
- **Phạm vi quy ước 4 và 10:** chỉ áp cho dòng plan này thêm hoặc sửa. Dòng cũ đã dài sẵn trong file test mà plan không đụng tới thì để nguyên, không reformat.

### Cách áp code của plan

Code của mỗi task nằm trong các khối patch của chính file này. Mỗi khối có đánh dấu `<!-- patch:<id> -->` đứng ngay trước khối `~~~diff`. Mỗi task có 1 patch test (`tN-test`) và 1 patch implementation (`tN-impl`). Task 10 có thêm `t10-docs`.

**Vì sao dùng patch:** thay đổi chạm 90 file, phần lớn là sửa vài dòng trong file đã có. Nếu chép nguyên cả file, plan sẽ dài gấp nhiều lần và dễ chép sai.

**Lệnh áp 1 patch:** thay `<id>` bằng id cụ thể; mỗi step đã ghi sẵn lệnh đầy đủ.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" <id> | git apply --ignore-whitespace -
```

- `--ignore-whitespace` cần thiết vì working tree có file CRLF lẫn LF (autocrlf).
- Lúc lập plan, cả 21 patch đã được áp lần lượt lên clone của `main` `d940d7c` (checkout CRLF) và cho ra đúng nội dung đã kiểm chứng.
- **Nếu `git apply` báo lỗi: dừng lại, báo BLOCKED kèm nguyên văn lỗi.** Không tự sửa tay để "vá cho khớp" — lỗi apply nghĩa là trạng thái trước task khác với trạng thái plan giả định.

### Lệnh verify dùng chung

Mọi task dùng các lệnh sau (chạy từ `NDTCore.App`):

- **Type-check:**
  ```bash
  npx tsc --noEmit -p packages/printer-core
  ```
  Expected: không in gì.

- **Full test `printer-core`:**
  ```bash
  npx jest packages/printer-core
  ```
  Expected: `Tests: N passed, N total`, không có suite fail. Mỗi task ghi con số N đo được lúc lập plan.

  Lần chạy đầu tiên khi cache Jest còn nguội có thể có 1 suite lỗi. Lúc lập plan đã gặp 1 lần với config thật, rồi xanh ở 2 lần chạy lại, kể cả `--no-cache`. Gặp trường hợp này thì chạy lại 1 lần; nếu vẫn fail thì đó là lỗi thật.

- **ESLint cho file đã stage:**
  ```bash
  npx eslint $(git diff --cached --name-only -- '*.ts')
  ```
  Expected: không in gì.

- **Line-length cho dòng đã stage:**
  ```bash
  git diff --cached -U0 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
  ```
  Expected: không in gì, exit 0.

### Cửa sổ chuyển tiếp (Task 2 → Task 9)

Task 2 cho `LayoutEngine` phát `fontSize` thay cho `size`. Nhưng compiler của từng ngôn ngữ chỉ đọc `fontSize` từ task migrate ngôn ngữ đó trở đi (Task 3-9). Trong cửa sổ này:
- Chữ đi qua template → layout sẽ in cỡ mặc định ở những ngôn ngữ chưa migrate.
- Type-check và toàn bộ test vẫn phải xanh ở mọi task.

Task 10 xoá hẳn `font`/`size`/`xScale`/`yScale` sau khi mọi ngôn ngữ đã migrate.

## Review Focus

Các trường hợp spec ngụ ý nhưng test cũ không phủ, xếp theo khả năng gây hại cao nhất trước. Mỗi dòng đã có test chốt trong task sở hữu code.

1. **Element `cut` với `mode: 'off'`** ở ngôn ngữ không có lệnh cắt (EPL, CPCL, DPL, SBPL, IPL), và ZPL `mode: 'off'` kèm `rows`.
   - Mong đợi: **không** cảnh báo, vì người dùng không yêu cầu cắt.
   - Chốt bằng: `CompileWarnings.unsupportedCut()` và test ở Task 4, 5, 6, 7.
2. **Gọi `compileTo()` nhiều lần cho cùng 1 ngôn ngữ.** Compiler trong registry là instance dùng chung.
   - Mong đợi: cảnh báo của lần trước không dồn sang lần sau.
   - Chốt bằng: test `LanguageDispatch` ở Task 4.
3. **Chữ cỡ mặc định của template** (12px ≈ 25.4 dots ở 203 dpi) in trên ESC/POS.
   - Mong đợi: in cỡ thường, không phát `GS !` phóng to. Font gốc của ESC/POS đã là 24 dots.
   - Chốt bằng: test ở Task 8.
4. **Chuyển TSPL → TSPL** (parse rồi compile lại) với font gốc được phóng đại, VD font `"3"` × 2 = 48 dots.
   - Mong đợi: chiều cao in giữ nguyên, dù mã font có thể đổi (thành `"5"` × 1).
   - Chốt bằng: test converter ở Task 3.
5. **Cỡ chữ lẻ** sau khi đổi px → dots (VD 18.75, 24.6) ở ngôn ngữ nhận dots trực tiếp (ZPL, IPL).
   - Mong đợi: làm tròn thành số nguyên, không phát số thập phân vào lệnh.
   - Chốt bằng: test `ZplFontMetrics` (Task 6) và `IplFontMetrics` (Task 7).

## Các quyết định lệch khỏi spec (đã chốt khi lập plan)

| # | Spec | Plan | Lý do |
|---|---|---|---|
| 1 | Mỗi `{Lang}FontMetrics.ts` export hàm tự do `fontSizeToNative()`/`nativeToFontSize()` | Export 1 object const `{Lang}FontMetrics` có các method đó | 9 ngôn ngữ cùng re-export qua barrel `language/index.ts` nên tên hàm tự do sẽ trùng nhau |
| 2 | Tham số `fontSizeDots: number` | `fontSizeDots: number \| undefined`; bỏ trống thì dùng font/hệ số mặc định, output giống hệt trước | `TextOptions.fontSize` là optional |
| 3 | DPL, SBPL, IPL thuộc nhóm bitmap `{ font, magnification }` | DPL, SBPL dùng nhóm 1 font phóng đại (`fontSizeToMagnification`/`magnificationToFontSize`, chung `MagnifiedFont.ts` với ESC/POS, Star PRNT). IPL nhận dots trực tiếp (`{ heightDots, widthDots }`) | Compiler DPL/SBPL chỉ dùng 1 font cố định; clause `h`/`w` của IPL là dots |
| 4 | ZPL `nativeToFontSize(font, heightDots)` | `nativeToFontSize(heightDots)`, IPL cũng vậy | Chỉ dùng font scalable `'0'` nên tham số font thừa |
| 5 | Bảng font giữ nguyên số trong các PreviewRenderer hiện tại | ESC/POS, Star PRNT: font gốc 24 dots (Font A 12×24) thay vì 12. ZPL: mặc định 30 dots theo compiler thay vì 18 | Preview cũ vẽ chữ nhỏ bằng nửa bản in thật; spec yêu cầu hết lệch 18/30 |
| 6 | Không nói CPCL | CPCL luôn phát size `0` và đạt cỡ chữ bằng cách chọn font (`maxMagnification = 1`) | Tham số size của lệnh `TEXT` CPCL là mã biến thể font, không phải hệ số nhân |
| 7 | Không nói nơi đặt bộ gom cảnh báo | `CompileWarnings` ở `language/`, không ở `core/` | Đặt ở `core/` tạo vòng import lúc chạy: core barrel → `LanguageRegistry` → preview → language barrel → compiler → core |
| 8 | Cảnh báo cho danh sách case trong bảng spec | Cảnh báo cho **mọi** element bị bỏ vì thiếu lệnh (thêm box/line ở ESC/POS/Star PRNT, diagonal ở EPL/DPL/SBPL/IPL). Cảnh báo trùng nội dung chỉ giữ 1. `cut` với `mode: 'off'` không cảnh báo | Mục tiêu 3 của spec là "mọi case"; tránh ngập danh sách; `off` nghĩa là không yêu cầu cắt |
| 9 | Mọi Parser đổi sang `nativeToFontSize()` | Chỉ đổi parser trước đây có dựng lại cỡ chữ (TSPL, EPL, CPCL, ZPL, ESC/POS). Parser DPL, SBPL, IPL, Star PRNT không dựng cỡ chữ nên giữ nguyên | Không thêm capability mới (non-goal của spec) |
| 10 | Cập nhật `document/builder/markup/MarkupBuilder.ts` | Không có việc | File đã bị xoá từ trước, không còn trong code |
| 11 | Không nói `PreviewRenderer.renderPreview` | Đổi thành `renderPreview(document, fontHeight: FontHeightResolver)` | Preview dùng chung phải lấy chiều cao chữ từ FontMetrics của ngôn ngữ gọi. Consumer duy nhất là preview DPL/SBPL/IPL; `printer-preview` chỉ dùng `previewFor()` |

## Cấu trúc file sau khi xong

```text
packages/printer-core/src/
├── core/PrintCompiler.ts            # + CompileResult<TOutput>; compile() trả CompileResult
├── core/LanguageDispatch.ts         # compileTo() trả CompileResult<string | Uint8Array>
├── convert/                         # ConversionRegistry/PrinterConverter gộp cảnh báo parse + compile
├── document/elements/content/TextElement.ts   # TextOptions: + fontSize, − font/size/xScale/yScale
├── layout/LayoutEngine.ts           # − toMagnification, phát fontSize
├── language/
│   ├── CompileWarnings.ts           # MỚI — gom cảnh báo 1 lần compile
│   ├── BitmapFont.ts                # MỚI — chọn font bitmap + hệ số (TSPL, EPL, CPCL)
│   ├── MagnifiedFont.ts             # MỚI — 1 font phóng đại (DPL, SBPL, ESC/POS, Star PRNT)
│   └── {lang}/{Lang}FontMetrics.ts  # MỚI — 9 file, nguồn font duy nhất của từng ngôn ngữ
└── preview/
    ├── PreviewRenderer.ts           # renderPreview(document, fontHeight)
    └── languages/*/                 # đọc chiều cao chữ từ {Lang}FontMetrics
packages/printer-core/README.md      # mục "Cỡ chữ và cảnh báo compile" + cây thư mục
```

---

### Task 1: Contract `CompileResult` + `CompileWarnings` + `TextOptions.fontSize`

**Files:**
- Create: `language/CompileWarnings.ts`
- Modify: `convert/ConversionRegistry.ts`, `convert/ConversionResult.ts`, `convert/PrinterConverter.ts`, `core/LanguageDispatch.ts`, `core/PrintCompiler.ts`, `document/elements/content/TextElement.ts`, `language/cpcl/CpclCompiler.ts`, `language/dpl/DplCompiler.ts`, `language/epl/EplCompiler.ts`, `language/escpos/EscPosCompiler.ts`, `language/ipl/IplCompiler.ts`, `language/sbpl/SbplCompiler.ts`, `language/starprnt/StarPrntCompiler.ts`, `language/tspl/TsplCompiler.ts`, `language/zpl/ZplCompiler.ts`
- Test: `__tests__/phase2-integration.test.ts`, `__tests__/template-pipeline-integration.test.ts`, `core/__tests__/LanguageDispatch.test.ts`, `language/__tests__/CompileWarnings.test.ts` (mới), `language/cpcl/__tests__/CpclCompiler.test.ts`, `language/dpl/__tests__/DplCompiler.test.ts`, `language/epl/__tests__/EplCompiler.test.ts`, `language/escpos/__tests__/EscPosCompiler.test.ts`, `language/ipl/__tests__/IplCompiler.test.ts`, `language/sbpl/__tests__/SbplCompiler.test.ts`, `language/starprnt/__tests__/StarPrntCompiler.test.ts`, `language/tspl/__tests__/TsplCompiler.test.ts`, `language/tspl/__tests__/TsplParser.test.ts`, `language/zpl/__tests__/ZplCompiler.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: không có.
- Produces:
  - `core/PrintCompiler.ts`:
    - `interface CompileResult<TOutput> { readonly output: TOutput; readonly warnings: readonly string[] }`
    - `PrintCompiler<TOutput>.compile(document, encoding?): CompileResult<TOutput>`
  - `language/CompileWarnings.ts` — `class CompileWarnings`:
    - `constructor(languageName: string)`
    - `add(message: string): void`
    - `unsupportedElement(elementType: PrintElement['type']): void` — câu cảnh báo cố định:
      `Element "<type>" bị bỏ qua — <languageName> không có lệnh tương ứng.`
    - `toArray(): readonly string[]`
    - Cảnh báo trùng nội dung chỉ giữ 1. Không export qua barrel `language/index.ts` — chỉ compiler trong `language/` dùng.
    - Task 4 thêm `unsupportedCut(options)`.
  - `core/LanguageDispatch.ts`: `compileTo(language, document, profile?): CompileResult<string | Uint8Array>`.
  - Compiler:
    - Mọi `{Lang}Compiler.compile()` và hàm `compileToTSPL/ZPL/EPL/CPCL/DPL/SBPL/IPL(document)` trả `CompileResult`.
    - Ở task này `warnings` luôn là `[]`; từng ngôn ngữ bật cảnh báo ở Task 3-9.
  - `convert/`:
    - `ConversionRegistry`: `compile(document, profile?)` trả `CompileResult`.
    - `convert()` trả `warnings = [...cảnh báo parse, ...cảnh báo compile]`.
  - `TextOptions.fontSize?: number` (dots). `font`/`size`/`xScale`/`yScale` gắn `@deprecated` cho tới Task 10.

**Ghi chú:** phần lớn patch test chỉ đổi `compiler.compile(...)` → `compiler.compile(...).output`. Vài dòng test cũ quá 120 ký tự vì nối thêm `.output` đã được xuống dòng.

- [ ] **Step 1: Kiểm tra branch và working tree**

```bash
git branch --show-current
git status --short
git log --oneline -2
```

Expected:
- Branch là `refactor/semantic-element`.
- Commit mới nhất là commit plan (`docs: add semantic element implementation plan`), commit trước đó là `d940d7c`.
- `git status` chỉ có file untracked (`??`, VD `.claude/worktrees/`).

Nếu có thay đổi chưa commit ở file đã track: **dừng lại, hỏi user** xử lý. Không tự stash hay revert.

- [ ] **Step 2: Áp patch test**

Patch test làm các việc sau:
- Thêm `language/__tests__/CompileWarnings.test.ts`.
- Thêm test `compileTo` trả `{ output, warnings }`.
- Đổi mọi test compiler/converter/integration sang đọc `.output`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t1-test | git apply --ignore-whitespace -
```

<!-- patch:t1-test -->
~~~diff
diff --git a/packages/printer-core/src/__tests__/phase2-integration.test.ts b/packages/printer-core/src/__tests__/phase2-integration.test.ts
index fb8168d..d086ec9 100644
--- a/packages/printer-core/src/__tests__/phase2-integration.test.ts
+++ b/packages/printer-core/src/__tests__/phase2-integration.test.ts
@@ -38,7 +38,7 @@ const doc: ResolvedPrintDocument = {
 
 describe('Phase 1 end-to-end', () => {
   it('compiles, parses, and validates a document as TSPL', () => {
-    const tspl = new TsplCompiler().compile(doc);
+    const tspl = new TsplCompiler().compile(doc).output;
     expect(new TsplValidator().validate(tspl).valid).toBe(true);
     expect(new TsplParser().parse(tspl).commands.length).toBeGreaterThan(0);
 
@@ -52,7 +52,7 @@ describe('Phase 1 end-to-end', () => {
   });
 
   it('compiles and parses the same document as ESC/POS', () => {
-    const bytes = new EscPosCompiler().compile(doc);
+    const bytes = new EscPosCompiler().compile(doc).output;
     expect(new EscPosParser().parse(bytes).commands.length).toBeGreaterThan(0);
 
     // `cut` compiles to a `GS V m` sequence (mode 'full', no explicit rows -> function A, m=0x00).
@@ -77,7 +77,7 @@ const BINARY_LANGUAGES = new Set<PrinterLanguage>(['escpos', 'starprnt']);
 describe('Phase 2 end-to-end: full 9-language coverage', () => {
   describe.each(ALL_LANGUAGES)('%s', (language) => {
     it('compiles, parses, validates, and previews the representative document', () => {
-      const compiled = compileTo(language, doc);
+      const compiled = compileTo(language, doc).output;
       const isBinary = BINARY_LANGUAGES.has(language);
       expect(compiled instanceof Uint8Array).toBe(isBinary);
 
diff --git a/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts b/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
index 1f48c92..c8c20e5 100644
--- a/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
+++ b/packages/printer-core/src/__tests__/template-pipeline-integration.test.ts
@@ -72,7 +72,7 @@ describe('pipeline template → resolve → layout → compile', () => {
       direction: 'forward',
       copies: 1,
       elements,
-    });
+    }).output;
     expect(bytes).toBeInstanceOf(Uint8Array);
     expect(bytes.length).toBeGreaterThan(0);
   });
diff --git a/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts b/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
index 711f9a8..6626d49 100644
--- a/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
+++ b/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
@@ -15,8 +15,15 @@ const doc: ResolvedPrintDocument = {
 };
 
 describe('LanguageDispatch', () => {
+  it('compileTo trả output kèm danh sách cảnh báo', () => {
+    const result = compileTo('tspl', doc);
+
+    expect(typeof result.output).toBe('string');
+    expect(result.warnings).toEqual([]);
+  });
+
   it('routes "tspl" to TsplCompiler/TsplParser/TsplValidator/TsplPreviewRenderer', () => {
-    const tspl = compileTo('tspl', doc);
+    const tspl = compileTo('tspl', doc).output;
     expect(typeof tspl).toBe('string');
     expect(parseFrom('tspl', tspl as string).commands.length).toBeGreaterThan(0);
     expect(validateFor('tspl', tspl as string).valid).toBe(true);
@@ -24,14 +31,14 @@ describe('LanguageDispatch', () => {
   });
 
   it('routes "escpos" to EscPosCompiler/EscPosParser/EscPosValidator/EscPosPreviewRenderer', () => {
-    const bytes = compileTo('escpos', doc);
+    const bytes = compileTo('escpos', doc).output;
     expect(bytes).toBeInstanceOf(Uint8Array);
     expect(parseFrom('escpos', bytes as Uint8Array).commands.length).toBeGreaterThan(0);
     expect(previewFor('escpos', doc)).toContain('<svg');
   });
 
   it('routes "zpl" to ZplCompiler/ZplParser/ZplValidator/ZplPreviewRenderer', () => {
-    const zpl = compileTo('zpl', doc);
+    const zpl = compileTo('zpl', doc).output;
     expect(typeof zpl).toBe('string');
     expect(parseFrom('zpl', zpl as string).commands.length).toBeGreaterThan(0);
     expect(validateFor('zpl', zpl as string).valid).toBe(true);
@@ -39,7 +46,7 @@ describe('LanguageDispatch', () => {
   });
 
   it('routes "epl" to EplCompiler/EplParser/EplValidator/EplPreviewRenderer', () => {
-    const epl = compileTo('epl', doc);
+    const epl = compileTo('epl', doc).output;
     expect(typeof epl).toBe('string');
     expect(parseFrom('epl', epl as string).commands.length).toBeGreaterThan(0);
     expect(validateFor('epl', epl as string).valid).toBe(true);
@@ -47,7 +54,7 @@ describe('LanguageDispatch', () => {
   });
 
   it('routes "cpcl" to CpclCompiler/CpclParser/CpclValidator/CpclPreviewRenderer', () => {
-    const cpcl = compileTo('cpcl', doc);
+    const cpcl = compileTo('cpcl', doc).output;
     expect(typeof cpcl).toBe('string');
     expect(parseFrom('cpcl', cpcl as string).commands.length).toBeGreaterThan(0);
     expect(validateFor('cpcl', cpcl as string).valid).toBe(true);
@@ -55,7 +62,7 @@ describe('LanguageDispatch', () => {
   });
 
   it('routes "dpl" to DplCompiler/DplParser/DplValidator/DplPreviewRenderer', () => {
-    const dpl = compileTo('dpl', doc);
+    const dpl = compileTo('dpl', doc).output;
     expect(typeof dpl).toBe('string');
     expect(parseFrom('dpl', dpl as string).commands.length).toBeGreaterThan(0);
     expect(validateFor('dpl', dpl as string).valid).toBe(true);
@@ -63,7 +70,7 @@ describe('LanguageDispatch', () => {
   });
 
   it('routes "sbpl" to SbplCompiler/SbplParser/SbplValidator/SbplPreviewRenderer', () => {
-    const sbpl = compileTo('sbpl', doc);
+    const sbpl = compileTo('sbpl', doc).output;
     expect(typeof sbpl).toBe('string');
     expect(parseFrom('sbpl', sbpl as string).commands.length).toBeGreaterThan(0);
     expect(validateFor('sbpl', sbpl as string).valid).toBe(true);
@@ -71,14 +78,14 @@ describe('LanguageDispatch', () => {
   });
 
   it('routes "starprnt" to StarPrntCompiler/StarPrntParser/StarPrntValidator/StarPrntPreviewRenderer', () => {
-    const bytes = compileTo('starprnt', doc);
+    const bytes = compileTo('starprnt', doc).output;
     expect(bytes).toBeInstanceOf(Uint8Array);
     expect(parseFrom('starprnt', bytes as Uint8Array).commands.length).toBeGreaterThan(0);
     expect(previewFor('starprnt', doc)).toContain('<svg');
   });
 
   it('routes "ipl" to IplCompiler/IplParser/IplValidator/IplPreviewRenderer', () => {
-    const ipl = compileTo('ipl', doc);
+    const ipl = compileTo('ipl', doc).output;
     expect(typeof ipl).toBe('string');
     expect(parseFrom('ipl', ipl as string).commands.length).toBeGreaterThan(0);
     expect(validateFor('ipl', ipl as string).valid).toBe(true);
@@ -87,7 +94,7 @@ describe('LanguageDispatch', () => {
 
   it('throws a clear UnsupportedLanguageError for an unknown language', () => {
     const unknown = 'unknown' as unknown as Parameters<typeof compileTo>[0];
-    expect(() => compileTo(unknown, doc)).toThrow(UnsupportedLanguageError);
+    expect(() => compileTo(unknown, doc).output).toThrow(UnsupportedLanguageError);
     expect(() => parseFrom(unknown, '')).toThrow(UnsupportedLanguageError);
     expect(() => validateFor(unknown, '')).toThrow(UnsupportedLanguageError);
     expect(() => previewFor(unknown, doc)).toThrow(UnsupportedLanguageError);
diff --git a/packages/printer-core/src/language/__tests__/CompileWarnings.test.ts b/packages/printer-core/src/language/__tests__/CompileWarnings.test.ts
new file mode 100644
index 0000000..33960e0
--- /dev/null
+++ b/packages/printer-core/src/language/__tests__/CompileWarnings.test.ts
@@ -0,0 +1,27 @@
+import { CompileWarnings } from '../CompileWarnings';
+
+describe('CompileWarnings', () => {
+  it('giữ cảnh báo theo thứ tự thêm vào', () => {
+    const warnings = new CompileWarnings('ZPL');
+    warnings.add('A');
+    warnings.add('B');
+
+    expect(warnings.toArray()).toEqual(['A', 'B']);
+  });
+
+  it('cảnh báo trùng nội dung chỉ giữ 1', () => {
+    const warnings = new CompileWarnings('EPL');
+    warnings.unsupportedElement('circle');
+    warnings.unsupportedElement('circle');
+    warnings.unsupportedElement('ellipse');
+
+    expect(warnings.toArray()).toEqual([
+      'Element "circle" bị bỏ qua — EPL không có lệnh tương ứng.',
+      'Element "ellipse" bị bỏ qua — EPL không có lệnh tương ứng.',
+    ]);
+  });
+
+  it('chưa thêm gì thì rỗng', () => {
+    expect(new CompileWarnings('TSPL').toArray()).toEqual([]);
+  });
+});
diff --git a/packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts b/packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts
index b2407a8..69c9a23 100644
--- a/packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts
+++ b/packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts
@@ -15,21 +15,27 @@ const baseDoc: Omit<ResolvedPrintDocument, 'elements'> = {
 describe('CpclCompiler', () => {
   it('compiles a text element to a TEXT command with its position and content on the following line', () => {
     const compiler = new CpclCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hello CPCL', options: { x: 10, y: 20, font: '5', size: 1 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hello CPCL', options: { x: 10, y: 20, font: '5', size: 1 } }],
+    }).output;
 
     expect(output).toContain('TEXT 5 1 10 20\r\nHello CPCL');
   });
 
   it('appends the rotation to the TEXT command name when rotated', () => {
     const compiler = new CpclCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Rot', options: { x: 5, y: 5, rotation: 90 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Rot', options: { x: 5, y: 5, rotation: 90 } }],
+    }).output;
 
     expect(output).toContain('TEXT90 2 0 5 5\r\nRot');
   });
 
   it('wraps the whole document with !/TONE/SPEED/PAGE-WIDTH header commands and a trailing PRINT', () => {
     const compiler = new CpclCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [] });
+    const output = compiler.compile({ ...baseDoc, elements: [] }).output;
 
     const lines = output.trim().split('\r\n');
     expect(lines[0]).toBe('! 0 203 203 240 1');
@@ -42,28 +48,40 @@ describe('CpclCompiler', () => {
   it('emits an EG command with the hex-encoded bitmap payload', () => {
     const compiler = new CpclCompiler();
     const bitmap = { data: new Uint8Array([0xff, 0x00, 0xa5]), width: 24, height: 1, bytesPerRow: 3 };
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'image', bitmap, options: { x: 10, y: 10 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'image', bitmap, options: { x: 10, y: 10 } }],
+    }).output;
 
     expect(output).toContain('EG 3 1 10 10 FF00A5');
   });
 
   it('generates a box command', () => {
     const compiler = new CpclCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'box', options: { x: 5, y: 5, width: 200, height: 100, thickness: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'box', options: { x: 5, y: 5, width: 200, height: 100, thickness: 2 } }],
+    }).output;
 
     expect(output).toContain('BOX 5 5 205 105 2');
   });
 
   it('generates a LINE command for an axis-aligned line', () => {
     const compiler = new CpclCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }],
+    }).output;
 
     expect(output).toContain('LINE 10 50 300 50 2');
   });
 
   it('generates the same LINE command shape for a genuinely diagonal line, since CPCL LINE draws between any two points', () => {
     const compiler = new CpclCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }],
+    }).output;
 
     expect(output).toContain('LINE 0 0 100 50 2');
   });
@@ -86,7 +104,7 @@ describe('CpclCompiler', () => {
           },
         },
       ],
-    });
+    }).output;
 
     expect(output).toContain('hello');
     expect(output).toContain('world');
@@ -106,20 +124,23 @@ describe('CpclCompiler', () => {
       compiler.compile({
         ...baseDoc,
         elements: [{ type: 'table', options: { x: 5, y: 20, columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
-      }),
+      }).output,
     ).toThrow(/positive width/);
   });
 
   it('handles multiple copies', () => {
     const compiler = new CpclCompiler();
-    const output = compiler.compile({ ...baseDoc, copies: 10, elements: [] });
+    const output = compiler.compile({ ...baseDoc, copies: 10, elements: [] }).output;
 
     expect(output.trim().split('\r\n')[0]).toBe('! 0 203 203 240 10');
   });
 
   it('handles raw passthrough', () => {
     const compiler = new CpclCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: '! U1 setvar "device.friendly_name" "test"' }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'raw', content: '! U1 setvar "device.friendly_name" "test"' }],
+    }).output;
 
     expect(output).toContain('! U1 setvar "device.friendly_name" "test"');
   });
@@ -128,7 +149,7 @@ describe('CpclCompiler', () => {
     const compilerA = new CpclCompiler();
     const compilerB = new CpclCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [
@@ -138,7 +159,7 @@ describe('CpclCompiler', () => {
         { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
         { type: 'cut', options: { mode: 'full' } },
       ],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
@@ -147,11 +168,11 @@ describe('CpclCompiler', () => {
     const compilerA = new CpclCompiler();
     const compilerB = new CpclCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [{ type: 'pageBreak' }, { type: 'spacer', options: { size: 10 } }, { type: 'row', options: {} }, { type: 'column', options: {} }],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
@@ -161,7 +182,7 @@ describe('CpclCompiler', () => {
     const output = compiler.compile({
       ...baseDoc,
       elements: [{ type: 'barcode', options: { x: 5, y: 5, symbology: 'code128', content: '123456789' } }],
-    });
+    }).output;
 
     expect(output).toContain('BARCODE 128 2 2 50 5 5 123456789');
   });
@@ -171,7 +192,7 @@ describe('CpclCompiler', () => {
     const output = compiler.compile({
       ...baseDoc,
       elements: [{ type: 'qrcode', options: { x: 10, y: 10, content: 'hello' } }],
-    });
+    }).output;
 
     expect(output).toContain('B QR10,10\r\nM2\r\nU6\r\nMA,hello\r\nENDQR');
   });
diff --git a/packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts b/packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts
index 7fe2b4b..efe94d3 100644
--- a/packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts
+++ b/packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts
@@ -15,7 +15,7 @@ const baseDoc: Omit<ResolvedPrintDocument, 'elements'> = {
 describe('DplCompiler', () => {
   it('wraps the whole document with an STX L header, D/S/A setup commands, a trailing Q and E', () => {
     const compiler = new DplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [] });
+    const output = compiler.compile({ ...baseDoc, elements: [] }).output;
 
     expect(output).toContain('\x02L');
     expect(output).toContain('D08');
@@ -27,14 +27,17 @@ describe('DplCompiler', () => {
 
   it('handles multiple copies', () => {
     const compiler = new DplCompiler();
-    const output = compiler.compile({ ...baseDoc, copies: 5, elements: [] });
+    const output = compiler.compile({ ...baseDoc, copies: 5, elements: [] }).output;
 
     expect(output).toContain('Q0005');
   });
 
   it('compiles a text element to a fixed-field record carrying its position and content', () => {
     const compiler = new DplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hello DPL', options: { x: 10, y: 20 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hello DPL', options: { x: 10, y: 20 } }],
+    }).output;
 
     expect(output).toContain('0010');
     expect(output).toContain('0020');
@@ -43,7 +46,10 @@ describe('DplCompiler', () => {
 
   it('encodes rotation 90 as record rotation code 2', () => {
     const compiler = new DplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Rot', options: { x: 10, y: 20, rotation: 90 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Rot', options: { x: 10, y: 20, rotation: 90 } }],
+    }).output;
 
     const lines = output.split('\r\n').filter((l) => l.includes('Rot'));
     expect(lines).toHaveLength(1);
@@ -52,7 +58,10 @@ describe('DplCompiler', () => {
 
   it('generates a box record carrying its position and dimensions', () => {
     const compiler = new DplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'box', options: { x: 5, y: 5, width: 100, height: 80, thickness: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'box', options: { x: 5, y: 5, width: 100, height: 80, thickness: 2 } }],
+    }).output;
 
     expect(output).toContain('0005');
     expect(output).toContain('0100');
@@ -61,7 +70,10 @@ describe('DplCompiler', () => {
 
   it('generates a horizontal line record', () => {
     const compiler = new DplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }],
+    }).output;
 
     expect(output).toContain('0010');
     expect(output).toContain('0050');
@@ -70,7 +82,10 @@ describe('DplCompiler', () => {
 
   it('generates a vertical line record', () => {
     const compiler = new DplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'line', options: { x1: 10, y1: 10, x2: 10, y2: 90, thickness: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'line', options: { x1: 10, y1: 10, x2: 10, y2: 90, thickness: 2 } }],
+    }).output;
 
     expect(output).toContain('0010');
     expect(output).toContain('0080');
@@ -81,7 +96,7 @@ describe('DplCompiler', () => {
     const output = compiler.compile({
       ...baseDoc,
       elements: [{ type: 'image', bitmap: { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 }, options: { x: 0, y: 0 } }],
-    });
+    }).output;
 
     // Header: rotation('1') + col(0000) + row(0000) + h(0001, =height) + w(0002, =bytesPerRow) + fixed('0005').
     // Portakal's buggy version emits exactly this and nothing more — proving
@@ -97,7 +112,10 @@ describe('DplCompiler', () => {
   it('appends exactly bytesPerRow * height payload bytes after the image header, matching bitmap.data byte for byte', () => {
     const compiler = new DplCompiler();
     const bitmap = { data: new Uint8Array([0xff, 0x00, 0xa5]), width: 24, height: 1, bytesPerRow: 3 };
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'image', bitmap, options: { x: 1, y: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'image', bitmap, options: { x: 1, y: 2 } }],
+    }).output;
 
     const header = '1000100020001' + '0003' + '0005';
     const headerIndex = output.indexOf(header);
@@ -126,7 +144,7 @@ describe('DplCompiler', () => {
           },
         },
       ],
-    });
+    }).output;
 
     expect(output).toContain('hello');
     expect(output).toContain('world');
@@ -140,13 +158,13 @@ describe('DplCompiler', () => {
       compiler.compile({
         ...baseDoc,
         elements: [{ type: 'table', options: { x: 5, y: 20, columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
-      }),
+      }).output,
     ).toThrow(/positive width/);
   });
 
   it('handles raw passthrough', () => {
     const compiler = new DplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: 'CUSTOM' }] });
+    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: 'CUSTOM' }] }).output;
 
     expect(output).toContain('CUSTOM');
   });
@@ -155,7 +173,7 @@ describe('DplCompiler', () => {
     const compilerA = new DplCompiler();
     const compilerB = new DplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [
@@ -166,7 +184,7 @@ describe('DplCompiler', () => {
         { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
         { type: 'cut', options: { mode: 'full' } },
       ],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
@@ -179,14 +197,14 @@ describe('DplCompiler', () => {
     const compilerA = new DplCompiler();
     const compilerB = new DplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [
         { type: 'barcode', options: { x: 5, y: 5, symbology: 'code128', content: '123456789' } },
         { type: 'qrcode', options: { x: 10, y: 10, content: 'hello' } },
       ],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
@@ -195,11 +213,11 @@ describe('DplCompiler', () => {
     const compilerA = new DplCompiler();
     const compilerB = new DplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [{ type: 'pageBreak' }, { type: 'spacer', options: { size: 10 } }, { type: 'row', options: {} }, { type: 'column', options: {} }],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
diff --git a/packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts b/packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts
index 5059820..49edea6 100644
--- a/packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts
+++ b/packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts
@@ -15,21 +15,27 @@ const baseDoc: Omit<ResolvedPrintDocument, 'elements'> = {
 describe('EplCompiler', () => {
   it('compiles a text element to an A command carrying its position and content', () => {
     const compiler = new EplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hello EPL', options: { x: 10, y: 20, font: '3', size: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hello EPL', options: { x: 10, y: 20, font: '3', size: 2 } }],
+    }).output;
 
     expect(output).toContain('A10,20,0,3,2,2,N,"Hello EPL"');
   });
 
   it('generates reverse text with the R flag', () => {
     const compiler = new EplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Reverse', options: { x: 10, y: 20, reverse: true } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Reverse', options: { x: 10, y: 20, reverse: true } }],
+    }).output;
 
     expect(output).toContain('A10,20,0,2,1,1,R,"Reverse"');
   });
 
   it('wraps the whole document with N/q/Q/S/D header commands and a trailing P', () => {
     const compiler = new EplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [] });
+    const output = compiler.compile({ ...baseDoc, elements: [] }).output;
 
     const lines = output.trim().split('\n');
     expect(lines[0]).toBe('N');
@@ -45,7 +51,7 @@ describe('EplCompiler', () => {
     const output = compiler.compile({
       ...baseDoc,
       elements: [{ type: 'image', bitmap: { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 }, options: {} }],
-    });
+    }).output;
 
     expect(output).toContain('GW');
     expect(output.trim().split('\n').some((line) => line === 'GW0,0,2,1,')).toBe(false); // must not end at a bare trailing comma
@@ -54,7 +60,10 @@ describe('EplCompiler', () => {
   it('appends the actual bitmap bytes after the GW header, not just a longer string', () => {
     const compiler = new EplCompiler();
     const bitmap = { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 };
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'image', bitmap, options: { x: 10, y: 10 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'image', bitmap, options: { x: 10, y: 10 } }],
+    }).output;
 
     const headerIndex = output.indexOf('GW10,10,2,1,');
     expect(headerIndex).toBeGreaterThanOrEqual(0);
@@ -69,7 +78,10 @@ describe('EplCompiler', () => {
   it('inverts each payload byte relative to bitmap.data, per GW\'s documented inverted polarity (0=black, 1=white)', () => {
     const compiler = new EplCompiler();
     const bitmap = { data: new Uint8Array([0xff, 0x00, 0xa5]), width: 24, height: 1, bytesPerRow: 3 };
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'image', bitmap, options: { x: 0, y: 0 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'image', bitmap, options: { x: 0, y: 0 } }],
+    }).output;
 
     const header = 'GW0,0,3,1,';
     const headerIndex = output.indexOf(header);
@@ -83,14 +95,20 @@ describe('EplCompiler', () => {
 
   it('generates a box command', () => {
     const compiler = new EplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'box', options: { x: 5, y: 5, width: 200, height: 100, thickness: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'box', options: { x: 5, y: 5, width: 200, height: 100, thickness: 2 } }],
+    }).output;
 
     expect(output).toContain('X5,5,205,105,2');
   });
 
   it('generates a horizontal line via LO', () => {
     const compiler = new EplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }],
+    }).output;
 
     expect(output).toContain('LO10,50,290,2');
   });
@@ -113,7 +131,7 @@ describe('EplCompiler', () => {
           },
         },
       ],
-    });
+    }).output;
 
     expect(output).toContain('hello');
     expect(output).toContain('world');
@@ -133,20 +151,20 @@ describe('EplCompiler', () => {
       compiler.compile({
         ...baseDoc,
         elements: [{ type: 'table', options: { x: 5, y: 20, columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
-      }),
+      }).output,
     ).toThrow(/positive width/);
   });
 
   it('handles multiple copies', () => {
     const compiler = new EplCompiler();
-    const output = compiler.compile({ ...baseDoc, copies: 10, elements: [] });
+    const output = compiler.compile({ ...baseDoc, copies: 10, elements: [] }).output;
 
     expect(output.trim().endsWith('P10')).toBe(true);
   });
 
   it('handles raw passthrough', () => {
     const compiler = new EplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: 'OD' }] });
+    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: 'OD' }] }).output;
 
     expect(output).toContain('OD');
   });
@@ -155,7 +173,7 @@ describe('EplCompiler', () => {
     const compilerA = new EplCompiler();
     const compilerB = new EplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [
@@ -166,7 +184,7 @@ describe('EplCompiler', () => {
         { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
         { type: 'cut', options: { mode: 'full' } },
       ],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
@@ -175,11 +193,11 @@ describe('EplCompiler', () => {
     const compilerA = new EplCompiler();
     const compilerB = new EplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [{ type: 'pageBreak' }, { type: 'spacer', options: { size: 10 } }, { type: 'row', options: {} }, { type: 'column', options: {} }],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
@@ -189,7 +207,7 @@ describe('EplCompiler', () => {
     const output = compiler.compile({
       ...baseDoc,
       elements: [{ type: 'barcode', options: { x: 5, y: 5, symbology: 'code128', content: '123456789' } }],
-    });
+    }).output;
 
     expect(output).toContain('B5,5,0,3,2,2,50,B,"123456789"');
   });
@@ -199,7 +217,7 @@ describe('EplCompiler', () => {
     const output = compiler.compile({
       ...baseDoc,
       elements: [{ type: 'qrcode', options: { x: 10, y: 10, content: 'hello' } }],
-    });
+    }).output;
 
     expect(output).toContain('b10,10,0,"QR",4,M,"hello"');
   });
diff --git a/packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts b/packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts
index 26062dc..6ef7f38 100644
--- a/packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts
+++ b/packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts
@@ -35,7 +35,7 @@ describe('EscPosCompiler', () => {
         elements: [{ type: 'text', content: 'café', options: {} }],
       },
       undefined, // falls back to DEFAULT_ENCODING (nativeUtf8: false)
-    );
+    ).output;
     const naiveUtf8 = new TextEncoder().encode('café');
     // The café substring should NOT appear as raw UTF-8 bytes when a non-native-UTF8 encoding is used.
     expect(containsSubsequence(bytes, naiveUtf8)).toBe(false);
@@ -57,7 +57,7 @@ describe('EscPosCompiler', () => {
         elements: [{ type: 'text', content: 'café', options: {} }],
       },
       nativeUtf8Encoding,
-    );
+    ).output;
     const naiveUtf8 = new TextEncoder().encode('café');
     expect(containsSubsequence(bytes, naiveUtf8)).toBe(true);
   });
@@ -74,7 +74,7 @@ describe('EscPosCompiler', () => {
       direction: 'forward',
       copies: 1,
       elements: [{ type: 'barcode', options: { symbology: 'code128', content: 'ABC123' } }],
-    });
+    }).output;
     const parsed = new EscPosParser().parse(bytes);
     expect(parsed.commands.length).toBeGreaterThan(0);
   });
@@ -91,7 +91,7 @@ describe('EscPosCompiler', () => {
       direction: 'forward',
       copies: 1,
       elements: [{ type: 'barcode', options: { symbology: 'code128', content: 'ABC123' } }],
-    });
+    }).output;
     const parsed = new EscPosParser().parse(bytes) as { commands: EscPosParsedCommand[]; warnings: string[] };
     const barcodeCommand = parsed.commands.find((c) => c.name === 'GS k');
 
@@ -112,7 +112,7 @@ describe('EscPosCompiler', () => {
       direction: 'forward',
       copies: 1,
       elements: [{ type: 'qrcode', options: { content: 'hello-qr' } }],
-    });
+    }).output;
     const parsed = new EscPosParser().parse(bytes) as { commands: EscPosParsedCommand[]; warnings: string[] };
     const twoDCommands = parsed.commands.filter((c) => c.name === 'GS ( k');
 
@@ -129,7 +129,7 @@ describe('EscPosCompiler', () => {
     const bytes = new EscPosCompiler().compile({
       widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'cut', options: { mode: 'full' } }],
-    });
+    }).output;
     expect(Array.from(bytes)).toEqual(expect.arrayContaining([0x1d, 0x56, 0x00]));
   });
 
@@ -137,7 +137,7 @@ describe('EscPosCompiler', () => {
     const bytes = new EscPosCompiler().compile({
       widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'cut', options: { mode: 'full', rows: 3 } }],
-    });
+    }).output;
     // GS V m n (function B): m=0x41 selects full cut, n=3 feeds 3 lines before cutting.
     expect(Array.from(bytes)).toEqual(expect.arrayContaining([0x1d, 0x56, 0x41, 0x03]));
   });
@@ -146,7 +146,7 @@ describe('EscPosCompiler', () => {
     const bytes = new EscPosCompiler().compile({
       widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'cut', options: { mode: 'partial', rows: 5 } }],
-    });
+    }).output;
     expect(Array.from(bytes)).toEqual(expect.arrayContaining([0x1d, 0x56, 0x42, 0x05]));
   });
 
@@ -154,11 +154,11 @@ describe('EscPosCompiler', () => {
     const withCut = new EscPosCompiler().compile({
       widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'cut', options: { mode: 'off' } }],
-    });
+    }).output;
     const withoutCut = new EscPosCompiler().compile({
       widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [],
-    });
+    }).output;
     expect(withCut).toEqual(withoutCut);
   });
 
@@ -166,7 +166,7 @@ describe('EscPosCompiler', () => {
     const bytes = new EscPosCompiler().compile({
       widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'table', options: { columns: [{ width: 10 }], rows: [['hello']] } }],
-    });
+    }).output;
     const text = new TextDecoder().decode(bytes);
     expect(text).toContain('hello');
   });
@@ -176,7 +176,7 @@ describe('EscPosCompiler', () => {
       new EscPosCompiler().compile({
         widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
         elements: [{ type: 'table', options: { columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
-      }),
+      }).output,
     ).toThrow(/positive width/);
   });
 
@@ -192,11 +192,11 @@ describe('EscPosCompiler', () => {
       const withEl = new EscPosCompiler().compile({
         widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
         elements: [el],
-      });
+      }).output;
       const without = new EscPosCompiler().compile({
         widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
         elements: [],
-      });
+      }).output;
       expect(withEl).toEqual(without);
     }
   });
diff --git a/packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts b/packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts
index d2bcdc7..c88faf5 100644
--- a/packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts
+++ b/packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts
@@ -15,7 +15,7 @@ const baseDoc: Omit<ResolvedPrintDocument, 'elements'> = {
 describe('IplCompiler', () => {
   it('wraps the whole document with create-format/program-mode headers and a trailing print/end-format', () => {
     const compiler = new IplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [] });
+    const output = compiler.compile({ ...baseDoc, elements: [] }).output;
 
     expect(output).toContain('\x02\x1bC1\x03');
     expect(output).toContain('\x02\x1bP\x03');
@@ -25,7 +25,7 @@ describe('IplCompiler', () => {
 
   it('generates label size config from heightDots/widthDots', () => {
     const compiler = new IplCompiler();
-    const output = compiler.compile({ ...baseDoc, heightDots: 240, widthDots: 320, elements: [] });
+    const output = compiler.compile({ ...baseDoc, heightDots: 240, widthDots: 320, elements: [] }).output;
 
     expect(output).toContain('<SI>L240');
     expect(output).toContain('<SI>W320');
@@ -33,7 +33,7 @@ describe('IplCompiler', () => {
 
   it('generates speed and density config', () => {
     const compiler = new IplCompiler();
-    const output = compiler.compile({ ...baseDoc, speed: 6, density: 10, elements: [] });
+    const output = compiler.compile({ ...baseDoc, speed: 6, density: 10, elements: [] }).output;
 
     expect(output).toContain('<SI>S60');
     expect(output).toContain('<SI>d10');
@@ -41,14 +41,17 @@ describe('IplCompiler', () => {
 
   it('generates multiple copies', () => {
     const compiler = new IplCompiler();
-    const output = compiler.compile({ ...baseDoc, copies: 5, elements: [] });
+    const output = compiler.compile({ ...baseDoc, copies: 5, elements: [] }).output;
 
     expect(output).toContain('\x1bM5');
   });
 
   it('compiles a text element to an H field record carrying its position and content', () => {
     const compiler = new IplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hello IPL', options: { x: 50, y: 30 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hello IPL', options: { x: 50, y: 30 } }],
+    }).output;
 
     expect(output).toContain('H1;o50,30');
     expect(output).toContain('Hello IPL');
@@ -56,7 +59,10 @@ describe('IplCompiler', () => {
 
   it('encodes rotation 90 as format code 1 in the H field', () => {
     const compiler = new IplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Rotated', options: { x: 10, y: 20, rotation: 90 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Rotated', options: { x: 10, y: 20, rotation: 90 } }],
+    }).output;
 
     expect(output).toContain(';f1;');
   });
@@ -66,7 +72,7 @@ describe('IplCompiler', () => {
     const output = compiler.compile({
       ...baseDoc,
       elements: [{ type: 'box', options: { x: 10, y: 20, width: 200, height: 100, thickness: 2 } }],
-    });
+    }).output;
 
     expect(output).toContain('W1;o10,20');
     expect(output).toContain('l200');
@@ -79,7 +85,7 @@ describe('IplCompiler', () => {
     const output = compiler.compile({
       ...baseDoc,
       elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }],
-    });
+    }).output;
 
     expect(output).toContain('L1;o10,50');
     expect(output).toContain('l290');
@@ -90,7 +96,7 @@ describe('IplCompiler', () => {
     const output = compiler.compile({
       ...baseDoc,
       elements: [{ type: 'line', options: { x1: 50, y1: 10, x2: 50, y2: 200 } }],
-    });
+    }).output;
 
     expect(output).toContain(';f1;');
     expect(output).toContain('l190');
@@ -98,7 +104,7 @@ describe('IplCompiler', () => {
 
   it('handles raw passthrough', () => {
     const compiler = new IplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: 'CUSTOM_CMD' }] });
+    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: 'CUSTOM_CMD' }] }).output;
 
     expect(output).toContain('CUSTOM_CMD');
   });
@@ -121,7 +127,7 @@ describe('IplCompiler', () => {
           },
         },
       ],
-    });
+    }).output;
 
     expect(output).toContain('hello');
     expect(output).toContain('world');
@@ -137,7 +143,7 @@ describe('IplCompiler', () => {
       compiler.compile({
         ...baseDoc,
         elements: [{ type: 'table', options: { x: 5, y: 20, columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
-      }),
+      }).output,
     ).toThrow(/positive width/);
   });
 
@@ -145,7 +151,7 @@ describe('IplCompiler', () => {
     const compilerA = new IplCompiler();
     const compilerB = new IplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [
@@ -156,7 +162,7 @@ describe('IplCompiler', () => {
         { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
         { type: 'cut', options: { mode: 'full' } },
       ],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
@@ -170,14 +176,14 @@ describe('IplCompiler', () => {
     const compilerA = new IplCompiler();
     const compilerB = new IplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [
         { type: 'barcode', options: { x: 5, y: 5, symbology: 'code128', content: '123456789' } },
         { type: 'qrcode', options: { x: 10, y: 10, content: 'hello' } },
       ],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
@@ -186,11 +192,11 @@ describe('IplCompiler', () => {
     const compilerA = new IplCompiler();
     const compilerB = new IplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [{ type: 'pageBreak' }, { type: 'spacer', options: { size: 10 } }, { type: 'row', options: {} }, { type: 'column', options: {} }],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
@@ -207,7 +213,7 @@ describe('IplCompiler', () => {
     const output = compiler.compile({
       ...baseDoc,
       elements: [{ type: 'image', bitmap: { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 }, options: { x: 5, y: 6 } }],
-    });
+    }).output;
 
     const header = '\x02G1;o5,6;f0;w2;h1;';
     const headerIndex = output.indexOf(header);
@@ -220,7 +226,10 @@ describe('IplCompiler', () => {
   it('appends exactly bytesPerRow * height payload bytes after the graphic field header, matching bitmap.data byte for byte', () => {
     const compiler = new IplCompiler();
     const bitmap = { data: new Uint8Array([0xff, 0x00, 0xa5]), width: 24, height: 1, bytesPerRow: 3 };
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'image', bitmap, options: { x: 1, y: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'image', bitmap, options: { x: 1, y: 2 } }],
+    }).output;
 
     const header = '\x02G1;o1,2;f0;w3;h1;';
     const headerIndex = output.indexOf(header);
diff --git a/packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts b/packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts
index ea39029..eda8dd6 100644
--- a/packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts
+++ b/packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts
@@ -15,7 +15,7 @@ const baseDoc: Omit<ResolvedPrintDocument, 'elements'> = {
 describe('SbplCompiler', () => {
   it('wraps the whole document with ESC A start, ESC CS clear, and a trailing ESC Z', () => {
     const compiler = new SbplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [] });
+    const output = compiler.compile({ ...baseDoc, elements: [] }).output;
 
     expect(output).toContain('\x1bA');
     expect(output).toContain('\x1bCS');
@@ -24,7 +24,10 @@ describe('SbplCompiler', () => {
 
   it('compiles a text element to H/V position, L magnification, and a K9B text field', () => {
     const compiler = new SbplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hello SATO', options: { x: 100, y: 50, size: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hello SATO', options: { x: 100, y: 50, size: 2 } }],
+    }).output;
 
     expect(output).toContain('\x1bH0100');
     expect(output).toContain('\x1bV0050');
@@ -34,15 +37,24 @@ describe('SbplCompiler', () => {
 
   it('defaults size to 1x1 magnification when omitted', () => {
     const compiler = new SbplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hi', options: { x: 0, y: 0 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hi', options: { x: 0, y: 0 } }],
+    }).output;
 
     expect(output).toContain('\x1bL0101');
   });
 
   it('emits a rotation command only when rotation is set', () => {
     const compiler = new SbplCompiler();
-    const rotated = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Rotated', options: { x: 10, y: 20, rotation: 90 } }] });
-    const notRotated = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Flat', options: { x: 10, y: 20 } }] });
+    const rotated = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Rotated', options: { x: 10, y: 20, rotation: 90 } }],
+    }).output;
+    const notRotated = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Flat', options: { x: 10, y: 20 } }],
+    }).output;
 
     expect(rotated).toContain('\x1b%1');
     expect(notRotated).not.toContain('\x1b%');
@@ -50,8 +62,14 @@ describe('SbplCompiler', () => {
 
   it('maps each rotation to its ESC % suffix', () => {
     const compiler = new SbplCompiler();
-    const r180 = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'X', options: { rotation: 180 } }] });
-    const r270 = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'X', options: { rotation: 270 } }] });
+    const r180 = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'X', options: { rotation: 180 } }],
+    }).output;
+    const r270 = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'X', options: { rotation: 270 } }],
+    }).output;
 
     expect(r180).toContain('\x1b%2');
     expect(r270).toContain('\x1b%3');
@@ -60,7 +78,10 @@ describe('SbplCompiler', () => {
   it('emits an ESC GM command with the hex-encoded bitmap payload and its byte-count size prefix', () => {
     const compiler = new SbplCompiler();
     const bitmap = { data: new Uint8Array([0xff, 0x00]), width: 8, height: 2, bytesPerRow: 1 };
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'image', bitmap, options: { x: 10, y: 10 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'image', bitmap, options: { x: 10, y: 10 } }],
+    }).output;
 
     expect(output).toContain('\x1bH0010');
     expect(output).toContain('\x1bV0010');
@@ -69,7 +90,10 @@ describe('SbplCompiler', () => {
 
   it('generates a box via H/V position plus an FW draw command', () => {
     const compiler = new SbplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'box', options: { x: 10, y: 20, width: 200, height: 100, thickness: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'box', options: { x: 10, y: 20, width: 200, height: 100, thickness: 2 } }],
+    }).output;
 
     expect(output).toContain('\x1bH0010');
     expect(output).toContain('\x1bV0020');
@@ -78,14 +102,20 @@ describe('SbplCompiler', () => {
 
   it('generates a horizontal line via FW...H', () => {
     const compiler = new SbplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }],
+    }).output;
 
     expect(output).toContain('\x1bFW02H0290');
   });
 
   it('generates a vertical line via FW...V', () => {
     const compiler = new SbplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'line', options: { x1: 50, y1: 10, x2: 50, y2: 200, thickness: 1 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'line', options: { x1: 50, y1: 10, x2: 50, y2: 200, thickness: 1 } }],
+    }).output;
 
     expect(output).toContain('\x1bFW01V0190');
   });
@@ -94,23 +124,26 @@ describe('SbplCompiler', () => {
     const compilerA = new SbplCompiler();
     const compilerB = new SbplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
-    const diagonalOutput = compilerB.compile({ ...baseDoc, elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
+    const diagonalOutput = compilerB.compile({
+      ...baseDoc,
+      elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }],
+    }).output;
 
     expect(diagonalOutput).toBe(emptyOutput);
   });
 
   it('handles raw passthrough', () => {
     const compiler = new SbplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: '\x1bKC1' }] });
+    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: '\x1bKC1' }] }).output;
 
     expect(output).toContain('\x1bKC1');
   });
 
   it('emits ESC Q with the copy count when copies > 1, and omits it for a single copy', () => {
     const compiler = new SbplCompiler();
-    const multi = compiler.compile({ ...baseDoc, copies: 3, elements: [] });
-    const single = compiler.compile({ ...baseDoc, copies: 1, elements: [] });
+    const multi = compiler.compile({ ...baseDoc, copies: 3, elements: [] }).output;
+    const single = compiler.compile({ ...baseDoc, copies: 1, elements: [] }).output;
 
     expect(multi).toContain('\x1bQ3');
     expect(single).not.toContain('\x1bQ');
@@ -134,7 +167,7 @@ describe('SbplCompiler', () => {
           },
         },
       ],
-    });
+    }).output;
 
     expect(output).toContain('hello');
     expect(output).toContain('world');
@@ -150,7 +183,7 @@ describe('SbplCompiler', () => {
       compiler.compile({
         ...baseDoc,
         elements: [{ type: 'table', options: { x: 5, y: 20, columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
-      }),
+      }).output,
     ).toThrow(/positive width/);
   });
 
@@ -158,7 +191,7 @@ describe('SbplCompiler', () => {
     const compilerA = new SbplCompiler();
     const compilerB = new SbplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [
@@ -168,7 +201,7 @@ describe('SbplCompiler', () => {
         { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
         { type: 'cut', options: { mode: 'full' } },
       ],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
@@ -177,11 +210,11 @@ describe('SbplCompiler', () => {
     const compilerA = new SbplCompiler();
     const compilerB = new SbplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [{ type: 'pageBreak' }, { type: 'spacer', options: { size: 10 } }, { type: 'row', options: {} }, { type: 'column', options: {} }],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
@@ -190,14 +223,14 @@ describe('SbplCompiler', () => {
     const compilerA = new SbplCompiler();
     const compilerB = new SbplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [
         { type: 'barcode', options: { x: 0, y: 0, symbology: 'code128', content: '123' } },
         { type: 'qrcode', options: { x: 0, y: 0, content: 'hi' } },
       ],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
diff --git a/packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts b/packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts
index ce570f9..62145e9 100644
--- a/packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts
+++ b/packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts
@@ -6,24 +6,30 @@ const BASE = { widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, de
 
 describe('StarPrntCompiler', () => {
   it('starts with ESC @ (initialize)', () => {
-    const bytes = new StarPrntCompiler().compile({ ...BASE, elements: [] });
+    const bytes = new StarPrntCompiler().compile({ ...BASE, elements: [] }).output;
     expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
   });
 
   it('returns a Uint8Array', () => {
-    const bytes = new StarPrntCompiler().compile({ ...BASE, elements: [] });
+    const bytes = new StarPrntCompiler().compile({ ...BASE, elements: [] }).output;
     expect(bytes).toBeInstanceOf(Uint8Array);
   });
 
   it('generates text content followed by a line feed', () => {
-    const bytes = new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'Hello Star' }] });
+    const bytes = new StarPrntCompiler().compile({
+      ...BASE,
+      elements: [{ type: 'text', content: 'Hello Star' }],
+    }).output;
     const text = new TextDecoder().decode(bytes);
     expect(text).toContain('Hello Star');
   });
 
   it('generates Star alignment: ESC GS a n for a centered text element', () => {
     const bytes = Array.from(
-      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'Center', options: { align: 'center' } }] }),
+      new StarPrntCompiler().compile({
+        ...BASE,
+        elements: [{ type: 'text', content: 'Center', options: { align: 'center' } }],
+      }).output,
     );
     const idx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x1d && bytes[i + 2] === 0x61);
     expect(idx).toBeGreaterThan(-1);
@@ -32,7 +38,10 @@ describe('StarPrntCompiler', () => {
 
   it('generates Star bold: ESC E (on) then ESC F (off)', () => {
     const bytes = Array.from(
-      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'Bold', options: { bold: true } }] }),
+      new StarPrntCompiler().compile({
+        ...BASE,
+        elements: [{ type: 'text', content: 'Bold', options: { bold: true } }],
+      }).output,
     );
     const onIdx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x45);
     const offIdx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x46);
@@ -42,7 +51,8 @@ describe('StarPrntCompiler', () => {
 
   it('generates Star size magnification: ESC i h w', () => {
     const bytes = Array.from(
-      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'Big', options: { size: 3 } }] }),
+      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'Big', options: { size: 3 } }] })
+        .output,
     );
     const idx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x69);
     expect(idx).toBeGreaterThan(-1);
@@ -52,7 +62,9 @@ describe('StarPrntCompiler', () => {
 
   it('generates Star raster mode for an image element, one raster row per bitmap row', () => {
     const bitmap = { data: new Uint8Array([0xff, 0x00, 0xaa, 0x55]), width: 8, height: 4, bytesPerRow: 1 };
-    const bytes = Array.from(new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'image', bitmap, options: {} }] }));
+    const bytes = Array.from(
+      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'image', bitmap, options: {} }] }).output,
+    );
 
     const enterIdx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x2a && bytes[i + 2] === 0x72 && bytes[i + 3] === 0x41);
     const exitIdx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x2a && bytes[i + 2] === 0x72 && bytes[i + 3] === 0x42);
@@ -67,28 +79,39 @@ describe('StarPrntCompiler', () => {
   });
 
   it('passes raw bytes straight through', () => {
-    const bytes = Array.from(new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'raw', content: new Uint8Array([0x07]) }] }));
+    const bytes = Array.from(
+      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'raw', content: new Uint8Array([0x07]) }] }).output,
+    );
     expect(bytes).toContain(0x07);
   });
 
   it('emits ESC d 1 for a cut element with mode "partial"', () => {
-    const bytes = Array.from(new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'cut', options: { mode: 'partial' } }] }));
+    const bytes = Array.from(
+      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'cut', options: { mode: 'partial' } }] }).output,
+    );
     expect(bytes.slice(-3)).toEqual([0x1b, 0x64, 1]);
   });
 
   it('emits the same ESC d 1 command for a cut element with mode "full" (no distinct full-cut byte is grounded in the source protocol)', () => {
-    const bytes = Array.from(new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'cut', options: { mode: 'full' } }] }));
+    const bytes = Array.from(
+      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'cut', options: { mode: 'full' } }] }).output,
+    );
     expect(bytes.slice(-3)).toEqual([0x1b, 0x64, 1]);
   });
 
   it('emits nothing for a cut element with mode "off"', () => {
-    const withCut = new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'cut', options: { mode: 'off' } }] });
-    const without = new StarPrntCompiler().compile({ ...BASE, elements: [] });
+    const withCut = new StarPrntCompiler().compile({
+      ...BASE,
+      elements: [{ type: 'cut', options: { mode: 'off' } }],
+    }).output;
+    const without = new StarPrntCompiler().compile({ ...BASE, elements: [] }).output;
     expect(withCut).toEqual(without);
   });
 
   it('does not append a trailing cut when no cut element is present', () => {
-    const bytes = Array.from(new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'no cut here' }] }));
+    const bytes = Array.from(
+      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'no cut here' }] }).output,
+    );
     expect(bytes.slice(-3)).not.toEqual([0x1b, 0x64, 1]);
   });
 
@@ -96,7 +119,7 @@ describe('StarPrntCompiler', () => {
     const bytes = new StarPrntCompiler().compile({
       ...BASE,
       elements: [{ type: 'table', options: { columns: [{ width: 10 }], rows: [['hello']] } }],
-    });
+    }).output;
     expect(new TextDecoder().decode(bytes)).toContain('hello');
   });
 
@@ -105,7 +128,7 @@ describe('StarPrntCompiler', () => {
       new StarPrntCompiler().compile({
         ...BASE,
         elements: [{ type: 'table', options: { columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
-      }),
+      }).output,
     ).toThrow(/positive width/);
   });
 
@@ -113,8 +136,8 @@ describe('StarPrntCompiler', () => {
     const encoding = STAR_PROFILES['star-tsp143']!.features;
     const elements: PrintElement[] = [{ type: 'text', content: 'Profile', options: { bold: true, size: 2 } }];
 
-    const withEncoding = new StarPrntCompiler().compile({ ...BASE, elements }, encoding);
-    const withoutEncoding = new StarPrntCompiler().compile({ ...BASE, elements });
+    const withEncoding = new StarPrntCompiler().compile({ ...BASE, elements }, encoding).output;
+    const withoutEncoding = new StarPrntCompiler().compile({ ...BASE, elements }).output;
 
     expect(withEncoding).toEqual(withoutEncoding);
     expect(new TextDecoder().decode(withEncoding)).toContain('Profile');
@@ -136,9 +159,9 @@ describe('StarPrntCompiler', () => {
       { type: 'barcode', options: { symbology: 'code128', content: 'ABC123' } },
       { type: 'qrcode', options: { content: 'hello-qr' } },
     ];
-    const without = new StarPrntCompiler().compile({ ...BASE, elements: [] });
+    const without = new StarPrntCompiler().compile({ ...BASE, elements: [] }).output;
     for (const el of noOpElements) {
-      const withEl = new StarPrntCompiler().compile({ ...BASE, elements: [el] });
+      const withEl = new StarPrntCompiler().compile({ ...BASE, elements: [el] }).output;
       expect(withEl).toEqual(without);
     }
   });
diff --git a/packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts b/packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts
index 4a7cbac..befa813 100644
--- a/packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts
+++ b/packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts
@@ -8,7 +8,7 @@ describe('TsplCompiler', () => {
     const output = compiler.compile({
       widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'image', bitmap: { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 }, options: {} }],
-    });
+    }).output;
     expect(output).toContain('BITMAP');
     expect(output.trim().endsWith('BITMAP 0,0,2,1,0,')).toBe(false); // must not end with a bare trailing comma
   });
@@ -19,7 +19,7 @@ describe('TsplCompiler', () => {
     const output = compiler.compile({
       widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'image', bitmap, options: {} }],
-    });
+    }).output;
 
     const headerIndex = output.indexOf('BITMAP 0,0,2,1,0,');
     expect(headerIndex).toBeGreaterThanOrEqual(0);
@@ -36,7 +36,7 @@ describe('TsplCompiler', () => {
         { type: 'text', content: 'Hello', options: { x: 10, y: 10 } },
         { type: 'box', options: { x: 0, y: 0, width: 100, height: 50, thickness: 2 } },
       ],
-    });
+    }).output;
 
     const lines = output.trim().split('\r\n');
     expect(lines[0]).toBe('SIZE 40 mm,30 mm');
@@ -51,7 +51,7 @@ describe('TsplCompiler', () => {
     const output = compiler.compile({
       widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'text', content: 'Say "hello"', options: { x: 10, y: 10 } }],
-    });
+    }).output;
 
     const lines = output.trim().split('\r\n');
     expect(lines).toContain('TEXT 10,10,"2",0,1,1,"Say \\"hello\\""');
@@ -65,7 +65,7 @@ describe('TsplCompiler', () => {
     const output = compiler.compile({
       widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }],
-    });
+    }).output;
 
     expect(output).toContain('DIAGONAL 0,0,100,50,2');
     expect(output).not.toContain('BAR ');
@@ -76,7 +76,7 @@ describe('TsplCompiler', () => {
     const output = compiler.compile({
       widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'line', options: { x1: 0, y1: 10, x2: 100, y2: 10, thickness: 2 } }],
-    });
+    }).output;
 
     expect(output).toContain('BAR 0,10,100,2');
     expect(output).not.toContain('DIAGONAL');
@@ -87,7 +87,7 @@ describe('TsplCompiler', () => {
     const output = compiler.compile({
       widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'cut', options: { mode: 'off' } }],
-    });
+    }).output;
 
     const lines = output.trim().split('\r\n');
     expect(lines).toContain('SET CUTTER OFF');
@@ -98,7 +98,7 @@ describe('TsplCompiler', () => {
     const output = compiler.compile({
       widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'cut', options: { mode: 'full', rows: 3 } }],
-    });
+    }).output;
 
     const lines = output.trim().split('\r\n');
     expect(lines).toContain('SET CUTTER 3');
@@ -109,7 +109,7 @@ describe('TsplCompiler', () => {
     const output = compiler.compile({
       widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
       elements: [{ type: 'cut', options: { mode: 'partial' } }],
-    });
+    }).output;
 
     const lines = output.trim().split('\r\n');
     expect(lines).toContain('SET CUTTER 1');
@@ -133,7 +133,7 @@ describe('TsplCompiler', () => {
           },
         },
       ],
-    });
+    }).output;
 
     expect(output).toContain(TSPL_COMMAND.TEXT);
     expect(output).toContain('hello');
@@ -165,7 +165,7 @@ describe('TsplCompiler', () => {
             },
           },
         ],
-      }),
+      }).output,
     ).toThrow(/positive width/);
   });
 
@@ -176,7 +176,7 @@ describe('TsplCompiler', () => {
       widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
     };
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [
@@ -185,7 +185,7 @@ describe('TsplCompiler', () => {
         { type: 'row', options: {} },
         { type: 'column', options: {} },
       ],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
diff --git a/packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts b/packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts
index c65a7a3..3efc6ef 100644
--- a/packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts
+++ b/packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts
@@ -103,7 +103,7 @@ describe('TsplParser', () => {
         elements: [{ type: 'image', bitmap: { data: new Uint8Array([0x41, 0x0a, 0x42]), width: 24, height: 1, bytesPerRow: 3 }, options: {} }],
       };
 
-      const compiled = new TsplCompiler().compile(doc);
+      const compiled = new TsplCompiler().compile(doc).output;
       // Compiled BITMAP line: `BITMAP 0,0,3,1,0,A\nB` — the payload's own
       // 0x0A byte (between "A" and "B") is indistinguishable from a real
       // line break once the document is tokenized.
diff --git a/packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts b/packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts
index 8a88dc8..185c406 100644
--- a/packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts
+++ b/packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts
@@ -16,7 +16,10 @@ const baseDoc: Omit<ResolvedPrintDocument, 'elements'> = {
 describe('ZplCompiler', () => {
   it('compiles a text element to ^FO/^FD carrying its position and content', () => {
     const compiler = new ZplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hello', options: { x: 10, y: 20 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hello', options: { x: 10, y: 20 } }],
+    }).output;
 
     expect(output).toContain('^FO10,20');
     expect(output).toContain('^FDHello^FS');
@@ -24,7 +27,7 @@ describe('ZplCompiler', () => {
 
   it('wraps the whole document in ^XA...^XZ with ^PW/^LL/^PQ set from the document', () => {
     const compiler = new ZplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [] });
+    const output = compiler.compile({ ...baseDoc, elements: [] }).output;
 
     expect(output.startsWith('^XA')).toBe(true);
     expect(output).toContain('^PW320');
@@ -38,7 +41,7 @@ describe('ZplCompiler', () => {
     const output = compiler.compile({
       ...baseDoc,
       elements: [{ type: 'barcode', options: { x: 5, y: 5, symbology: 'code128', content: '123456789' } }],
-    });
+    }).output;
 
     const parsed = new ZplParser().parse(output);
     expect(parsed.warnings).toEqual([]);
@@ -66,7 +69,7 @@ describe('ZplCompiler', () => {
           },
         },
       ],
-    });
+    }).output;
 
     expect(output).toContain('hello');
     expect(output).toContain('world');
@@ -91,7 +94,7 @@ describe('ZplCompiler', () => {
             options: { x: 5, y: 20, columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] },
           },
         ],
-      }),
+      }).output,
     ).toThrow(/positive width/);
   });
 
@@ -99,7 +102,7 @@ describe('ZplCompiler', () => {
     const compilerA = new ZplCompiler();
     const compilerB = new ZplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [
@@ -107,7 +110,7 @@ describe('ZplCompiler', () => {
         { type: 'reverse', options: { x: 0, y: 0, width: 10, height: 10 } },
         { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
       ],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
@@ -116,18 +119,18 @@ describe('ZplCompiler', () => {
     const compilerA = new ZplCompiler();
     const compilerB = new ZplCompiler();
 
-    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
+    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
     const noOpOutput = compilerB.compile({
       ...baseDoc,
       elements: [{ type: 'pageBreak' }, { type: 'spacer', options: { size: 10 } }, { type: 'row', options: {} }, { type: 'column', options: {} }],
-    });
+    }).output;
 
     expect(noOpOutput).toBe(emptyOutput);
   });
 
   it('emits ^MMC for cut mode "full" and ^MMT for cut mode "off"', () => {
-    const on = new ZplCompiler().compile({ ...baseDoc, elements: [{ type: 'cut', options: { mode: 'full' } }] });
-    const off = new ZplCompiler().compile({ ...baseDoc, elements: [{ type: 'cut', options: { mode: 'off' } }] });
+    const on = new ZplCompiler().compile({ ...baseDoc, elements: [{ type: 'cut', options: { mode: 'full' } }] }).output;
+    const off = new ZplCompiler().compile({ ...baseDoc, elements: [{ type: 'cut', options: { mode: 'off' } }] }).output;
 
     expect(on).toContain('^MMC');
     expect(off).toContain('^MMT');
@@ -135,7 +138,10 @@ describe('ZplCompiler', () => {
 
   it('emits a DIAGONAL-style ^GD command for a diagonal element, not a ^GB box', () => {
     const compiler = new ZplCompiler();
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }],
+    }).output;
 
     expect(output).toContain('^GD100,50,2,B,R');
   });
@@ -143,7 +149,10 @@ describe('ZplCompiler', () => {
   it('appends the actual bitmap bytes as uppercase hex after the ^GFA header', () => {
     const compiler = new ZplCompiler();
     const bitmap = { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 };
-    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'image', bitmap, options: { x: 0, y: 0 } }] });
+    const output = compiler.compile({
+      ...baseDoc,
+      elements: [{ type: 'image', bitmap, options: { x: 0, y: 0 } }],
+    }).output;
 
     expect(output).toContain('^GFA,2,2,2,FF00');
   });
~~~

- [ ] **Step 3: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/__tests__/phase2-integration.test.ts packages/printer-core/src/__tests__/template-pipeline-integration.test.ts packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts packages/printer-core/src/language/__tests__/CompileWarnings.test.ts packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts
```

Expected: FAIL — mọi test đọc `.output` nhận `undefined` vì compiler còn trả thẳng chuỗi/bytes; suite `CompileWarnings` lỗi import. Lúc lập plan: `Tests: 123 failed, 39 passed, 162 total` (số đếm có thể lệch nếu suite lỗi import; điều kiện bắt buộc là có test fail).

- [ ] **Step 4: Áp patch implementation**

Patch implementation làm các việc sau:
- Thêm `CompileResult` và `language/CompileWarnings.ts`.
- Đổi 9 compiler, `LanguageDispatch`, `ConversionRegistry`, `PrinterConverter` sang `CompileResult`.
- Thêm `TextOptions.fontSize`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t1-impl | git apply --ignore-whitespace -
```

<!-- patch:t1-impl -->
~~~diff
diff --git a/packages/printer-core/src/convert/ConversionRegistry.ts b/packages/printer-core/src/convert/ConversionRegistry.ts
index 8348d90..293194a 100644
--- a/packages/printer-core/src/convert/ConversionRegistry.ts
+++ b/packages/printer-core/src/convert/ConversionRegistry.ts
@@ -1,3 +1,4 @@
+import type { CompileResult } from '../core';
 import type { PrinterLanguage } from '../core/PrinterLanguage';
 import type { ResolvedPrintDocument } from '../document';
 import type { PrinterProfile } from '../profile';
@@ -32,7 +33,7 @@ export interface ParsedSource {
 /** One `PrinterLanguage`'s parse/compile pair, looked up by `PrinterConverter`. */
 export interface ConversionRegistryEntry {
   parse: (source: string | Uint8Array) => ParsedSource;
-  compile: (document: ResolvedPrintDocument, profile?: PrinterProfile) => string | Uint8Array;
+  compile: (document: ResolvedPrintDocument, profile?: PrinterProfile) => CompileResult<string | Uint8Array>;
 }
 
 function toText(source: string | Uint8Array): string {
diff --git a/packages/printer-core/src/convert/ConversionResult.ts b/packages/printer-core/src/convert/ConversionResult.ts
index 9b483b6..e04b1b9 100644
--- a/packages/printer-core/src/convert/ConversionResult.ts
+++ b/packages/printer-core/src/convert/ConversionResult.ts
@@ -17,6 +17,9 @@ export interface ConversionResult {
   output: string;
   /** Elements recovered from parsing the source, before target compilation. */
   elements: PrintElement[];
-  /** Warnings raised while parsing the source (e.g. unrecognized commands). */
+  /**
+   * Cảnh báo khi parse source (VD lệnh không nhận diện được) và khi compile sang
+   * ngôn ngữ đích (VD element không hỗ trợ).
+   */
   warnings: string[];
 }
diff --git a/packages/printer-core/src/convert/PrinterConverter.ts b/packages/printer-core/src/convert/PrinterConverter.ts
index c0d978d..0e8a301 100644
--- a/packages/printer-core/src/convert/PrinterConverter.ts
+++ b/packages/printer-core/src/convert/PrinterConverter.ts
@@ -54,7 +54,7 @@ export function convert(source: string, from: PrinterLanguage, to: PrinterLangua
   };
 
   const compiled = targetEntry.compile(document);
-  const output = typeof compiled === 'string' ? compiled : bytesToBinaryString(compiled);
+  const output = typeof compiled.output === 'string' ? compiled.output : bytesToBinaryString(compiled.output);
 
-  return { output, elements: parsed.elements, warnings: parsed.warnings };
+  return { output, elements: parsed.elements, warnings: [...parsed.warnings, ...compiled.warnings] };
 }
diff --git a/packages/printer-core/src/core/LanguageDispatch.ts b/packages/printer-core/src/core/LanguageDispatch.ts
index 70f6119..bd8a1db 100644
--- a/packages/printer-core/src/core/LanguageDispatch.ts
+++ b/packages/printer-core/src/core/LanguageDispatch.ts
@@ -1,6 +1,7 @@
 import type { ResolvedPrintDocument } from '../document';
 import type { PrinterProfile } from '../profile';
 import type { ValidationResult } from '../validation/ValidationResult';
+import type { CompileResult } from './PrintCompiler';
 import type { PrinterLanguage } from './PrinterLanguage';
 import type { PrinterLanguageDefinition } from './PrinterLanguageDefinition';
 import { LANGUAGE_REGISTRY } from './LanguageRegistry';
@@ -24,7 +25,11 @@ function lookup(language: PrinterLanguage, capability: string): PrinterLanguageD
  * nine languages — tspl, escpos, zpl, epl, cpcl, dpl, sbpl, starprnt, ipl —
  * has a real compiler in this package, so there is no stub branch here.
  */
-export function compileTo(language: PrinterLanguage, document: ResolvedPrintDocument, profile?: PrinterProfile): string | Uint8Array {
+export function compileTo(
+  language: PrinterLanguage,
+  document: ResolvedPrintDocument,
+  profile?: PrinterProfile,
+): CompileResult<string | Uint8Array> {
   return lookup(language, 'compiler').compiler.compile(document, profile?.features);
 }
 
diff --git a/packages/printer-core/src/core/PrintCompiler.ts b/packages/printer-core/src/core/PrintCompiler.ts
index ec357de..509a9a3 100644
--- a/packages/printer-core/src/core/PrintCompiler.ts
+++ b/packages/printer-core/src/core/PrintCompiler.ts
@@ -6,6 +6,15 @@ export interface TextEncodingOptions {
   codePages?: number[];
 }
 
+/** Kết quả compile: lệnh máy in + cảnh báo về những gì máy in không làm được. */
+export interface CompileResult<TOutput> {
+  /** Chuỗi lệnh (ngôn ngữ dạng text) hoặc byte (ESC/POS, Star PRNT) để gửi tới máy in. */
+  readonly output: TOutput;
+
+  /** Field/element bị bỏ qua hoặc gộp vì ngôn ngữ không hỗ trợ; mỗi cảnh báo xuất hiện 1 lần. */
+  readonly warnings: readonly string[];
+}
+
 /**
  * `encoding` is part of the contract so every language compiler can be invoked
  * through one uniform call shape. Only `EscPosCompiler` acts on it today (code
@@ -13,5 +22,5 @@ export interface TextEncodingOptions {
  * protocol has a grounded encoding-selection command to drive from it.
  */
 export interface PrintCompiler<TOutput = string | Uint8Array> {
-  compile(document: ResolvedPrintDocument, encoding?: TextEncodingOptions): TOutput;
+  compile(document: ResolvedPrintDocument, encoding?: TextEncodingOptions): CompileResult<TOutput>;
 }
diff --git a/packages/printer-core/src/document/elements/content/TextElement.ts b/packages/printer-core/src/document/elements/content/TextElement.ts
index f25d22d..228e94e 100644
--- a/packages/printer-core/src/document/elements/content/TextElement.ts
+++ b/packages/printer-core/src/document/elements/content/TextElement.ts
@@ -8,16 +8,19 @@ export interface TextOptions {
   /** Toạ độ Y, tính bằng dots. */
   y?: number;
 
-  /** Tên/mã font gốc của máy in — ý nghĩa khác nhau tuỳ từng ngôn ngữ. */
+  /** Cỡ chữ (chiều cao glyph danh nghĩa), dots; mỗi compiler tự quy đổi sang font/hệ số phóng đại của máy in. */
+  fontSize?: number;
+
+  /** @deprecated Dùng `fontSize`. Tên/mã font gốc của máy in — ý nghĩa khác nhau tuỳ từng ngôn ngữ. */
   font?: string;
 
-  /** Hệ số phóng đại font (thường 1-8 tuỳ ngôn ngữ). */
+  /** @deprecated Dùng `fontSize`. Hệ số phóng đại font (thường 1-8 tuỳ ngôn ngữ). */
   size?: number;
 
-  /** Hệ số phóng đại ngang riêng, dùng cho ngôn ngữ tách scale x/y khỏi `size`. */
+  /** @deprecated Dùng `fontSize`. Hệ số phóng đại ngang riêng. */
   xScale?: number;
 
-  /** Hệ số phóng đại dọc riêng, dùng cho ngôn ngữ tách scale x/y khỏi `size`. */
+  /** @deprecated Dùng `fontSize`. Hệ số phóng đại dọc riêng. */
   yScale?: number;
 
   /** Góc xoay của text. */
diff --git a/packages/printer-core/src/language/CompileWarnings.ts b/packages/printer-core/src/language/CompileWarnings.ts
new file mode 100644
index 0000000..62d03bb
--- /dev/null
+++ b/packages/printer-core/src/language/CompileWarnings.ts
@@ -0,0 +1,27 @@
+import type { PrintElement } from '../document';
+
+/**
+ * Gom cảnh báo trong 1 lần compile. Trùng nội dung thì chỉ giữ 1, để document có nhiều element
+ * cùng loại không làm ngập danh sách cảnh báo.
+ */
+export class CompileWarnings {
+  private readonly messages = new Set<string>();
+
+  /** `languageName` là tên hiển thị của ngôn ngữ trong câu cảnh báo, VD `ESC/POS`. */
+  constructor(private readonly languageName: string) {}
+
+  /** Thêm 1 cảnh báo tuỳ ý (field bị bỏ qua, giá trị bị gộp...). */
+  add(message: string): void {
+    this.messages.add(message);
+  }
+
+  /** Cảnh báo cả element bị bỏ qua vì ngôn ngữ không có lệnh tương ứng. */
+  unsupportedElement(elementType: PrintElement['type']): void {
+    this.add(`Element "${elementType}" bị bỏ qua — ${this.languageName} không có lệnh tương ứng.`);
+  }
+
+  /** Danh sách cảnh báo theo thứ tự xuất hiện. */
+  toArray(): readonly string[] {
+    return [...this.messages];
+  }
+}
diff --git a/packages/printer-core/src/language/cpcl/CpclCompiler.ts b/packages/printer-core/src/language/cpcl/CpclCompiler.ts
index 4714323..3eb7804 100644
--- a/packages/printer-core/src/language/cpcl/CpclCompiler.ts
+++ b/packages/printer-core/src/language/cpcl/CpclCompiler.ts
@@ -1,6 +1,6 @@
 import type { ResolvedPrintDocument } from '../../document';
 import type { PrintElement, TextOptions } from '../../document/elements';
-import type { PrintCompiler, TextEncodingOptions } from '../../core';
+import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import type { BarcodeSymbology } from '../../symbology/barcode';
 import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';
 import { CPCL_COMMAND } from './CpclCommand';
@@ -216,7 +216,7 @@ export function compileToCPCL(document: ResolvedPrintDocument): string {
  * vào để khớp chữ ký gọi dùng chung của `PrintCompiler`, không thực sự dùng.
  */
 export class CpclCompiler implements PrintCompiler<string> {
-  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
-    return compileToCPCL(document);
+  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
+    return { output: compileToCPCL(document), warnings: [] };
   }
 }
diff --git a/packages/printer-core/src/language/dpl/DplCompiler.ts b/packages/printer-core/src/language/dpl/DplCompiler.ts
index 50aa3eb..bef7eda 100644
--- a/packages/printer-core/src/language/dpl/DplCompiler.ts
+++ b/packages/printer-core/src/language/dpl/DplCompiler.ts
@@ -7,7 +7,7 @@ import type {
   LineOptions,
   TableOptions,
 } from '../../document/elements';
-import type { PrintCompiler, TextEncodingOptions } from '../../core';
+import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import type { Rotation, Bitmap } from '../../types';
 import { DPL_COMMAND } from './DplCommand';
 import { encodeDplBitmapPayload } from './DplEncoder';
@@ -229,7 +229,7 @@ export function compileToDPL(document: ResolvedPrintDocument): string {
  * đi không được chạy qua một bộ mã hoá UTF-8 thông thường.
  */
 export class DplCompiler implements PrintCompiler<string> {
-  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
-    return compileToDPL(document);
+  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
+    return { output: compileToDPL(document), warnings: [] };
   }
 }
diff --git a/packages/printer-core/src/language/epl/EplCompiler.ts b/packages/printer-core/src/language/epl/EplCompiler.ts
index a406de0..f4ba163 100644
--- a/packages/printer-core/src/language/epl/EplCompiler.ts
+++ b/packages/printer-core/src/language/epl/EplCompiler.ts
@@ -7,7 +7,7 @@ import type {
   LineOptions,
   TableOptions,
 } from '../../document/elements';
-import type { PrintCompiler, TextEncodingOptions } from '../../core';
+import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import type { BarcodeSymbology, BarcodeConfig } from '../../symbology/barcode';
 import type { QrCodeConfig, QrErrorCorrectionLevel } from '../../symbology/qrcode';
 import type { Rotation, Bitmap } from '../../types';
@@ -240,7 +240,7 @@ export function compileToEPL(document: ResolvedPrintDocument): string {
  * này qua một bộ mã hoá UTF-8 ngây thơ khi chuyển thành byte truyền dây.
  */
 export class EplCompiler implements PrintCompiler<string> {
-  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
-    return compileToEPL(document);
+  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
+    return { output: compileToEPL(document), warnings: [] };
   }
 }
diff --git a/packages/printer-core/src/language/escpos/EscPosCompiler.ts b/packages/printer-core/src/language/escpos/EscPosCompiler.ts
index cbfa891..3adbfea 100644
--- a/packages/printer-core/src/language/escpos/EscPosCompiler.ts
+++ b/packages/printer-core/src/language/escpos/EscPosCompiler.ts
@@ -1,6 +1,6 @@
 import type { ResolvedPrintDocument } from '../../document';
 import type { PrintElement, TextOptions, CutOptions, TableOptions } from '../../document/elements';
-import type { PrintCompiler, TextEncodingOptions } from '../../core';
+import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import { ESC_POS, concatEscPosBytes } from './EscPosCommand';
 import { encodeEscPosText } from './EscPosCodePage';
 import { encodeEscPosImage } from './EscPosImageEncoder';
@@ -149,13 +149,13 @@ function compileElement(element: PrintElement, encoding: TextEncodingOptions | u
 }
 
 export class EscPosCompiler implements PrintCompiler<Uint8Array> {
-  compile(document: ResolvedPrintDocument, encoding?: TextEncodingOptions): Uint8Array {
+  compile(document: ResolvedPrintDocument, encoding?: TextEncodingOptions): CompileResult<Uint8Array> {
     const chunks: Uint8Array[] = [new Uint8Array([ESC_POS.ESC, ESC_POS.INIT])];
 
     for (const element of document.elements) {
       chunks.push(...compileElement(element, encoding));
     }
 
-    return concatEscPosBytes(chunks);
+    return { output: concatEscPosBytes(chunks), warnings: [] };
   }
 }
diff --git a/packages/printer-core/src/language/ipl/IplCompiler.ts b/packages/printer-core/src/language/ipl/IplCompiler.ts
index 5ae5d40..376b4a2 100644
--- a/packages/printer-core/src/language/ipl/IplCompiler.ts
+++ b/packages/printer-core/src/language/ipl/IplCompiler.ts
@@ -7,7 +7,7 @@ import type {
   LineOptions,
   TableOptions,
 } from '../../document/elements';
-import type { PrintCompiler, TextEncodingOptions } from '../../core';
+import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import type { Bitmap, Rotation } from '../../types';
 import { IPL_COMMAND } from './IplCommand';
 import { encodeIplBitmapPayload } from './IplEncoder';
@@ -232,7 +232,7 @@ export function compileToIPL(document: ResolvedPrintDocument): string {
  * byte thô). Nơi gọi không được encode UTF-8 thẳng khi document có image.
  */
 export class IplCompiler implements PrintCompiler<string> {
-  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
-    return compileToIPL(document);
+  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
+    return { output: compileToIPL(document), warnings: [] };
   }
 }
diff --git a/packages/printer-core/src/language/sbpl/SbplCompiler.ts b/packages/printer-core/src/language/sbpl/SbplCompiler.ts
index b182951..e5cd633 100644
--- a/packages/printer-core/src/language/sbpl/SbplCompiler.ts
+++ b/packages/printer-core/src/language/sbpl/SbplCompiler.ts
@@ -7,7 +7,7 @@ import type {
   LineElement,
   TableElement,
 } from '../../document/elements';
-import type { PrintCompiler, TextEncodingOptions } from '../../core';
+import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import type { Rotation } from '../../types';
 import { SBPL_COMMAND } from './SbplCommand';
 import { encodeSbplBitmapPayload } from './SbplEncoder';
@@ -221,7 +221,7 @@ export function compileToSBPL(document: ResolvedPrintDocument): string {
  * khớp chữ ký chung của `PrintCompiler`, không thực sự được dùng.
  */
 export class SbplCompiler implements PrintCompiler<string> {
-  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
-    return compileToSBPL(document);
+  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
+    return { output: compileToSBPL(document), warnings: [] };
   }
 }
diff --git a/packages/printer-core/src/language/starprnt/StarPrntCompiler.ts b/packages/printer-core/src/language/starprnt/StarPrntCompiler.ts
index f971038..5a51435 100644
--- a/packages/printer-core/src/language/starprnt/StarPrntCompiler.ts
+++ b/packages/printer-core/src/language/starprnt/StarPrntCompiler.ts
@@ -1,6 +1,6 @@
 import type { ResolvedPrintDocument } from '../../document';
 import type { PrintElement, TextOptions } from '../../document/elements';
-import type { PrintCompiler, TextEncodingOptions } from '../../core';
+import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import {
   BYTE_MASK,
   STAR_PRNT,
@@ -142,13 +142,13 @@ function compileElement(element: PrintElement): Uint8Array[] {
  * `compileTextElement` (đầu ra văn bản luôn UTF-8).
  */
 export class StarPrntCompiler implements PrintCompiler<Uint8Array> {
-  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): Uint8Array {
+  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<Uint8Array> {
     const chunks: Uint8Array[] = [new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.INIT])];
 
     for (const element of document.elements) {
       chunks.push(...compileElement(element));
     }
 
-    return concatStarPrntBytes(chunks);
+    return { output: concatStarPrntBytes(chunks), warnings: [] };
   }
 }
diff --git a/packages/printer-core/src/language/tspl/TsplCompiler.ts b/packages/printer-core/src/language/tspl/TsplCompiler.ts
index 4cd475e..d7b2622 100644
--- a/packages/printer-core/src/language/tspl/TsplCompiler.ts
+++ b/packages/printer-core/src/language/tspl/TsplCompiler.ts
@@ -1,5 +1,5 @@
 import type { ResolvedPrintDocument } from '../../document';
-import type { PrintCompiler, TextEncodingOptions } from '../../core';
+import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import type { BarcodeSymbology } from '../../symbology/barcode';
 import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';
 import type { Direction } from '../../types';
@@ -309,7 +309,7 @@ export class TsplCompiler implements PrintCompiler<string> {
    * UTF-8 cho phần còn lại) mà package này chưa hỗ trợ — nằm ngoài phạm vi ở
    * đây; đây là ghi chú về một giới hạn đã biết, không phải một chỗ cần sửa.
    */
-  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
-    return compileToTSPL(document);
+  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
+    return { output: compileToTSPL(document), warnings: [] };
   }
 }
diff --git a/packages/printer-core/src/language/zpl/ZplCompiler.ts b/packages/printer-core/src/language/zpl/ZplCompiler.ts
index 9b2ba3e..c383e5a 100644
--- a/packages/printer-core/src/language/zpl/ZplCompiler.ts
+++ b/packages/printer-core/src/language/zpl/ZplCompiler.ts
@@ -12,7 +12,7 @@ import type {
   CutElement,
   TableElement,
 } from '../../document/elements';
-import type { PrintCompiler, TextEncodingOptions } from '../../core';
+import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import type { BarcodeSymbology } from '../../symbology/barcode';
 import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';
 import type { Rotation } from '../../types';
@@ -320,7 +320,7 @@ export function compileToZPL(document: ResolvedPrintDocument): string {
  * chỉ nhận vào để khớp chữ ký chung của `PrintCompiler`, không được dùng.
  */
 export class ZplCompiler implements PrintCompiler<string> {
-  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): string {
-    return compileToZPL(document);
+  compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
+    return { output: compileToZPL(document), warnings: [] };
   }
 }
~~~

- [ ] **Step 5: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/__tests__/phase2-integration.test.ts packages/printer-core/src/__tests__/template-pipeline-integration.test.ts packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts packages/printer-core/src/language/__tests__/CompileWarnings.test.ts packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts
```

Expected: PASS — `Tests: 165 passed, 165 total`.

- [ ] **Step 6: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 85 passed, 85 total Tests: 598 passed, 598 total`.

- [ ] **Step 7: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/__tests__/phase2-integration.test.ts \
  packages/printer-core/src/__tests__/template-pipeline-integration.test.ts \
  packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts \
  packages/printer-core/src/language/__tests__/CompileWarnings.test.ts \
  packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts \
  packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts \
  packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts \
  packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts \
  packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts \
  packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts \
  packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts \
  packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts \
  packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts \
  packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts \
  packages/printer-core/src/convert/ConversionRegistry.ts \
  packages/printer-core/src/convert/ConversionResult.ts \
  packages/printer-core/src/convert/PrinterConverter.ts \
  packages/printer-core/src/core/LanguageDispatch.ts \
  packages/printer-core/src/core/PrintCompiler.ts \
  packages/printer-core/src/document/elements/content/TextElement.ts \
  packages/printer-core/src/language/CompileWarnings.ts \
  packages/printer-core/src/language/cpcl/CpclCompiler.ts \
  packages/printer-core/src/language/dpl/DplCompiler.ts \
  packages/printer-core/src/language/epl/EplCompiler.ts \
  packages/printer-core/src/language/escpos/EscPosCompiler.ts \
  packages/printer-core/src/language/ipl/IplCompiler.ts \
  packages/printer-core/src/language/sbpl/SbplCompiler.ts \
  packages/printer-core/src/language/starprnt/StarPrntCompiler.ts \
  packages/printer-core/src/language/tspl/TsplCompiler.ts \
  packages/printer-core/src/language/zpl/ZplCompiler.ts
npx eslint $(git diff --cached --name-only -- '*.ts')
git diff --cached -U0 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: return compile warnings alongside compiler output" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: eslint và line-length không in gì; commit thành công.

---
### Task 2: `LayoutEngine` phát `fontSize` (dots), bỏ `toMagnification`

**Files:**
- Modify: `layout/LayoutEngine.ts`
- Test: `layout/__tests__/LayoutEngine.sizing.test.ts`, `layout/__tests__/LayoutEngine.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `TextOptions.fontSize` (Task 1).
- Produces:
  - Text element do `LayoutEngine.resolve()` sinh ra có `options.fontSize = node.style.fontSize`. Đây là dots, đã đổi từ `Length` ở `toLayoutNode`; không kẹp, không làm tròn.
  - Không còn `options.size`.
  - Xoá `toMagnification`, `DOTS_PER_MAGNIFICATION_STEP`, `MIN_MAGNIFICATION`, `MAX_MAGNIFICATION`.

**Ghi chú:** từ task này tới Task 9 là cửa sổ chuyển tiếp — xem mục "Cửa sổ chuyển tiếp" ở đầu plan.

- [ ] **Step 1: Áp patch test**

Test layout đổi kỳ vọng từ `size` (hệ số 1-8) sang `fontSize` (dots). Thêm test cỡ rất nhỏ/rất lớn đi thẳng xuống element, không bị kẹp.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t2-test | git apply --ignore-whitespace -
```

<!-- patch:t2-test -->
~~~diff
diff --git a/packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts b/packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts
index d6080ac..00bf526 100644
--- a/packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts
+++ b/packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts
@@ -41,7 +41,7 @@ function firstTextSize(
 ): number | undefined {
   const [first] = engine.resolve(root, config, typography, fontMetrics);
   if (first.type !== 'text') throw new Error('expected text element');
-  return first.options?.size;
+  return first.options?.fontSize;
 }
 
 describe('LayoutEngine — tự thu nhỏ chữ', () => {
@@ -58,8 +58,7 @@ describe('LayoutEngine — tự thu nhỏ chữ', () => {
       ],
     };
 
-    // 40 dots ở mức 1 → hệ số round(40/12) = 3.
-    expect(firstTextSize(tallColumn(50, 40), receipt, typography)).toBe(3);
+    expect(firstTextSize(tallColumn(50, 40), receipt, typography)).toBe(40);
   });
 
   it('label chọn mức lớn nhất còn vừa chiều cao tem', () => {
@@ -71,8 +70,8 @@ describe('LayoutEngine — tự thu nhỏ chữ', () => {
       ],
     };
 
-    // 10 dòng cỡ 20 tràn 100 dots; chỉ mức 0.25 vừa → 5 dots → hệ số 1.
-    expect(firstTextSize(tallColumn(10, 20), labelConfig(400, 100), typography)).toBe(1);
+    // 10 dòng cỡ 20 tràn 100 dots; chỉ mức 0.25 vừa → 5 dots.
+    expect(firstTextSize(tallColumn(10, 20), labelConfig(400, 100), typography)).toBe(5);
   });
 
   it('label không vừa ở mức nào thì dùng mức nhỏ nhất, không throw', () => {
@@ -83,7 +82,7 @@ describe('LayoutEngine — tự thu nhỏ chữ', () => {
       ],
     };
 
-    expect(firstTextSize(tallColumn(100, 40), labelConfig(400, 10), typography)).toBe(1);
+    expect(firstTextSize(tallColumn(100, 40), labelConfig(400, 10), typography)).toBe(4);
   });
 
   it('thu nhỏ đồng đều cả cây, không chỉ phần bị tràn', () => {
@@ -110,8 +109,8 @@ describe('LayoutEngine — tự thu nhỏ chữ', () => {
     const [header, item] = engine.resolve(root, labelConfig(400, 50), typography, fontMetrics);
     if (header.type !== 'text' || item.type !== 'text') throw new Error('expected text elements');
 
-    expect(header.options?.size).toBe(item.options?.size);
-    // 20 × 0.5 = 10 dots → hệ số 1 (chưa thu nhỏ là 2).
-    expect(header.options?.size).toBe(1);
+    expect(header.options?.fontSize).toBe(item.options?.fontSize);
+    // 20 × 0.5 = 10 dots.
+    expect(header.options?.fontSize).toBe(10);
   });
 });
diff --git a/packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts b/packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts
index b4a0732..16c536a 100644
--- a/packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts
+++ b/packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts
@@ -33,8 +33,7 @@ describe('LayoutEngine', () => {
     const elements = engine.resolve(textNode('t1', 'Hello', 20), receiptConfig, typography, fontMetrics);
 
     expect(elements).toHaveLength(1);
-    // 20 dots → hệ số phóng đại round(20/12) = 2.
-    expect(elements[0]).toMatchObject({ type: 'text', content: 'Hello', options: { x: 0, y: 0, size: 2 } });
+    expect(elements[0]).toMatchObject({ type: 'text', content: 'Hello', options: { x: 0, y: 0, fontSize: 20 } });
   });
 
   it('xếp con theo cột có gap', () => {
@@ -154,7 +153,7 @@ describe('LayoutEngine', () => {
     expect(ys).toEqual([0, 2, 82, 202]);
   });
 
-  describe('cỡ chữ (dots) → hệ số phóng đại 1-8', () => {
+  describe('cỡ chữ đi thẳng xuống element (dots)', () => {
     it('không đặt fontSize thì dùng DEFAULT_FONT_SIZE (12px)', () => {
       const withoutSize: ResolvedNode = { type: 'text', id: 't1', value: 'Hi' };
       const withDefault: ResolvedNode = { type: 'text', id: 't1', value: 'Hi', style: { fontSize: px(12) } };
@@ -165,12 +164,12 @@ describe('LayoutEngine', () => {
       );
     });
 
-    it('cỡ rất nhỏ kẹp về 1, cỡ rất lớn kẹp về 8', () => {
+    it('không kẹp cỡ rất nhỏ hay rất lớn — quy đổi là việc của compiler', () => {
       const [small] = engine.resolve(textNode('t1', 'Hi', 1), receiptConfig, typography, fontMetrics);
       const [large] = engine.resolve(textNode('t1', 'Hi', 200), receiptConfig, typography, fontMetrics);
 
-      expect(small).toMatchObject({ options: { size: 1 } });
-      expect(large).toMatchObject({ options: { size: 8 } });
+      expect(small).toMatchObject({ options: { fontSize: 1 } });
+      expect(large).toMatchObject({ options: { fontSize: 200 } });
     });
   });
 
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts
```

Expected: FAIL — element vẫn mang `size` thay vì `fontSize`. Lúc lập plan: `Tests: 6 failed, 17 passed, 23 total` (số đếm có thể lệch nếu suite lỗi import; điều kiện bắt buộc là có test fail).

- [ ] **Step 3: Áp patch implementation**

Xoá `toMagnification()` và 3 hằng số của nó; `arrangeText` gán `fontSize: node.style.fontSize`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t2-impl | git apply --ignore-whitespace -
```

<!-- patch:t2-impl -->
~~~diff
diff --git a/packages/printer-core/src/layout/LayoutEngine.ts b/packages/printer-core/src/layout/LayoutEngine.ts
index 00d6b1b..4abf644 100644
--- a/packages/printer-core/src/layout/LayoutEngine.ts
+++ b/packages/printer-core/src/layout/LayoutEngine.ts
@@ -53,13 +53,6 @@ const QR_APPROXIMATE_SIZE_DOTS = 120;
 
 const DEFAULT_LINE_THICKNESS_DOTS = 1;
 
-// `TextOptions.size` của compiler là hệ số phóng đại 1-8 của font máy in, không phải dots — ~12 dots cho 1 bậc.
-const DOTS_PER_MAGNIFICATION_STEP = 12;
-
-const MIN_MAGNIFICATION = 1;
-
-const MAX_MAGNIFICATION = 8;
-
 /** Xếp vị trí các node đã resolve thành `PrintElement[]` (dots) theo khổ giấy + DPI của máy in đích. */
 export class LayoutEngine {
   /** Label tự chọn mức thu nhỏ chữ lớn nhất còn vừa chiều cao tem; receipt luôn dùng mức đầu tiên. */
@@ -219,12 +212,6 @@ function lineLengthDots(node: LayoutLine, availableWidthDots: number): number {
   return width?.type === 'fixed' ? width.value : availableWidthDots;
 }
 
-function toMagnification(fontSizeDots: number | undefined): number | undefined {
-  if (fontSizeDots === undefined) return undefined;
-  const magnification = Math.round(fontSizeDots / DOTS_PER_MAGNIFICATION_STEP);
-  return Math.min(MAX_MAGNIFICATION, Math.max(MIN_MAGNIFICATION, magnification));
-}
-
 function arrange(
   node: LayoutNode,
   origin: Position,
@@ -267,7 +254,7 @@ function arrangeText(
       options: {
         x: origin.x,
         y: lineY,
-        size: toMagnification(node.style.fontSize),
+        fontSize: node.style.fontSize,
         align: node.style.textAlign,
         bold: node.style.fontWeight === 'bold',
       },
~~~

- [ ] **Step 4: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts
```

Expected: PASS — `Tests: 23 passed, 23 total`.

- [ ] **Step 5: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 85 passed, 85 total Tests: 598 passed, 598 total`.

- [ ] **Step 6: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts \
  packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts \
  packages/printer-core/src/layout/LayoutEngine.ts
npx eslint $(git diff --cached --name-only -- '*.ts')
git diff --cached -U0 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: emit semantic fontSize from LayoutEngine" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: eslint và line-length không in gì; commit thành công.

---
### Task 3: TSPL: `BitmapFont` + `TsplFontMetrics` + cảnh báo cắt partial

**Files:**
- Create: `language/BitmapFont.ts`, `language/tspl/TsplFontMetrics.ts`
- Modify: `language/tspl/TsplCompiler.ts`, `language/tspl/TsplParser.ts`, `language/tspl/index.ts`, `preview/languages/tspl/TsplPreviewRenderer.ts`
- Test: `convert/__tests__/PrinterConverter.test.ts`, `language/tspl/__tests__/TsplCompiler.test.ts`, `language/tspl/__tests__/TsplFontMetrics.test.ts` (mới), `language/tspl/__tests__/TsplParser.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `CompileResult`, `CompileWarnings` (Task 1); `TextOptions.fontSize`.
- Produces:
  - `language/BitmapFont.ts` (Task 4, 5 dùng lại):
    - `interface BitmapFontSize { readonly width: number; readonly height: number }` — dots ở hệ số 1.
    - `type BitmapFontTable = Readonly<Record<string, BitmapFontSize>>`
    - `interface BitmapFontSet { fonts; selectable: readonly string[]; defaultFont: string; maxMagnification: number }`
    - `interface BitmapFontChoice { readonly font: string; readonly magnification: number }`
    - `chooseBitmapFont(fontSizeDots: number | undefined, fontSet): BitmapFontChoice`:
      - Chọn chiều cao gần nhất.
      - Khi bằng nhau thì ưu tiên hệ số nhỏ, rồi tới thứ tự `selectable`.
      - `undefined` → `{ font: defaultFont, magnification: 1 }`.
    - `bitmapFontHeight(font, magnification, fontSet): number`
    - `bitmapFontSize(font, fontSet): BitmapFontSize` — mã font lạ thì dùng font mặc định.
  - `language/tspl/TsplFontMetrics.ts` — `const TsplFontMetrics`, export qua `language/tspl/index.ts`:
    - Thông số: font 1-8; tự chọn 1-5; mặc định `'2'`; hệ số tối đa 10.
    - `fontSizeToNative(fontSizeDots: number | undefined): BitmapFontChoice`
    - `nativeToFontSize(font: string, magnification: number): number`
    - `characterSize(font: string): BitmapFontSize`
  - `TsplCompiler`:
    - `TEXT`/`BLOCK` dùng font + hệ số từ `fontSize`.
    - Cảnh báo `CutOptions.mode "partial" được in như "full" — TSPL không phân biệt cắt một phần.`
  - `TsplParser`: `options.fontSize = TsplFontMetrics.nativeToFontSize(font, yMultiplier)`, không còn `font`/`size`.
  - `TsplPreviewRenderer`: đọc chiều cao chữ từ `TsplFontMetrics`.

- [ ] **Step 1: Áp patch test**

Patch test làm các việc sau:
- Thêm `TsplFontMetrics.test.ts`.
- Thêm test cỡ chữ và cảnh báo cho `TsplCompiler`.
- Đổi kỳ vọng `TsplParser` và converter (nguồn TSPL) sang `fontSize`.
- Thêm test TSPL → TSPL giữ chiều cao chữ (Review Focus 4).

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t3-test | git apply --ignore-whitespace -
```

<!-- patch:t3-test -->
~~~diff
diff --git a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
index fc49bc8..30275dc 100644
--- a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
+++ b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
@@ -20,7 +20,9 @@ describe('convert', () => {
     expect(result.output).toContain('^XA');
     expect(result.output).toContain('^FDHello^FS');
     expect(result.output).toContain('^XZ');
-    expect(result.elements).toEqual([{ type: 'text', content: 'Hello', options: { x: 10, y: 10, font: '3', rotation: 0, size: 1 } }]);
+    expect(result.elements).toEqual([
+      { type: 'text', content: 'Hello', options: { x: 10, y: 10, fontSize: 24, rotation: 0 } },
+    ]);
     expect(result.warnings).toEqual([]);
   });
 
@@ -55,7 +57,7 @@ describe('convert', () => {
   it('converts a TSPL label to recognizable EPL syntax', () => {
     const result = convert(TSPL_SOURCE, 'tspl', 'epl');
 
-    expect(result.output).toContain('A10,10,0,3,1,1,N,"Hello"');
+    expect(result.output).toContain('A10,10,0,2,1,1,N,"Hello"');
     expect(result.output).toContain('q400');
     expect(result.warnings).toEqual([]);
   });
@@ -74,7 +76,7 @@ describe('convert', () => {
   it('converts a TSPL label to recognizable CPCL syntax', () => {
     const result = convert(TSPL_SOURCE, 'tspl', 'cpcl');
 
-    expect(result.output).toContain('TEXT 3 1 10 10\r\nHello');
+    expect(result.output).toContain('TEXT 2 0 10 10\r\nHello');
     expect(result.output).toContain('PAGE-WIDTH 400');
     expect(result.output).toContain('PRINT');
   });
@@ -180,4 +182,14 @@ describe('convert', () => {
     expect([...SUPPORTED_SOURCES].sort()).toEqual(registryKeys);
     expect([...SUPPORTED_TARGETS].sort()).toEqual(registryKeys);
   });
+
+  it('TSPL → TSPL giữ nguyên chiều cao chữ in ra dù mã font có thể đổi', () => {
+    const source = 'SIZE 50 mm,30 mm\r\nCLS\r\nTEXT 10,10,"3",0,2,2,"Big"\r\nPRINT 1\r\n';
+
+    const firstPass = convert(source, 'tspl', 'tspl');
+    const secondPass = convert(firstPass.output as string, 'tspl', 'tspl');
+
+    expect(firstPass.elements[0]).toMatchObject({ options: { fontSize: 48 } });
+    expect(secondPass.elements[0]).toMatchObject({ options: { fontSize: 48 } });
+  });
 });
diff --git a/packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts b/packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts
index befa813..d166691 100644
--- a/packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts
+++ b/packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts
@@ -190,3 +190,58 @@ describe('TsplCompiler', () => {
     expect(noOpOutput).toBe(emptyOutput);
   });
 });
+
+describe('TsplCompiler — cỡ chữ và cảnh báo', () => {
+  const baseDocument: Omit<ResolvedPrintDocument, 'elements'> = {
+    widthDots: 320,
+    heightDots: 240,
+    dpi: 203,
+    gapDots: 24,
+    speed: 4,
+    density: 8,
+    direction: 'forward',
+    copies: 1,
+  };
+
+  function compileElements(elements: ResolvedPrintDocument['elements']) {
+    return new TsplCompiler().compile({ ...baseDocument, elements });
+  }
+
+  it('chọn font + hệ số nhân theo fontSize (dots)', () => {
+    const { output } = compileElements([{ type: 'text', content: 'Hi', options: { x: 10, y: 10, fontSize: 40 } }]);
+
+    expect(output).toContain('TEXT 10,10,"2",0,2,2,"Hi"');
+  });
+
+  it('không khai báo fontSize thì dùng font 2 ở hệ số 1', () => {
+    const { output } = compileElements([{ type: 'text', content: 'Hi', options: { x: 10, y: 10 } }]);
+
+    expect(output).toContain('TEXT 10,10,"2",0,1,1,"Hi"');
+  });
+
+  it('BLOCK dùng cùng font + hệ số với TEXT', () => {
+    const { output } = compileElements([
+      { type: 'text', content: 'Hi', options: { x: 0, y: 0, fontSize: 48, maxWidth: 200 } },
+    ]);
+
+    expect(output).toContain('BLOCK 0,0,200,200,"5",0,1,1,0,1,"Hi"');
+  });
+
+  it('cảnh báo khi cắt partial vì TSPL không phân biệt, cắt full thì không', () => {
+    expect(compileElements([{ type: 'cut', options: { mode: 'partial' } }]).warnings).toEqual([
+      'CutOptions.mode "partial" được in như "full" — TSPL không phân biệt cắt một phần.',
+    ]);
+    expect(compileElements([{ type: 'cut', options: { mode: 'full' } }]).warnings).toEqual([]);
+  });
+
+  it('element TSPL hỗ trợ đầy đủ thì không có cảnh báo', () => {
+    const { warnings } = compileElements([
+      { type: 'circle', options: { x: 0, y: 0, diameter: 20 } },
+      { type: 'ellipse', options: { x: 0, y: 0, width: 20, height: 10 } },
+      { type: 'reverse', options: { x: 0, y: 0, width: 20, height: 10 } },
+      { type: 'erase', options: { x: 0, y: 0, width: 20, height: 10 } },
+    ]);
+
+    expect(warnings).toEqual([]);
+  });
+});
diff --git a/packages/printer-core/src/language/tspl/__tests__/TsplFontMetrics.test.ts b/packages/printer-core/src/language/tspl/__tests__/TsplFontMetrics.test.ts
new file mode 100644
index 0000000..2063888
--- /dev/null
+++ b/packages/printer-core/src/language/tspl/__tests__/TsplFontMetrics.test.ts
@@ -0,0 +1,41 @@
+import { TsplFontMetrics } from '..';
+
+describe('TsplFontMetrics', () => {
+  it('không khai báo cỡ chữ thì dùng font 2 ở hệ số 1', () => {
+    expect(TsplFontMetrics.fontSizeToNative(undefined)).toEqual({ font: '2', magnification: 1 });
+  });
+
+  it.each([
+    [12, { font: '1', magnification: 1 }],
+    [20, { font: '2', magnification: 1 }],
+    [25, { font: '3', magnification: 1 }],
+    [48, { font: '5', magnification: 1 }],
+    [96, { font: '5', magnification: 2 }],
+    [100, { font: '2', magnification: 5 }],
+  ])('%i dots → %j', (fontSizeDots, expected) => {
+    expect(TsplFontMetrics.fontSizeToNative(fontSizeDots)).toEqual(expected);
+  });
+
+  it('không tự chọn font OCR 6-8', () => {
+    for (const fontSizeDots of [19, 25, 27]) {
+      expect(['6', '7', '8']).not.toContain(TsplFontMetrics.fontSizeToNative(fontSizeDots).font);
+    }
+  });
+
+  it('không vượt hệ số nhân 10', () => {
+    expect(TsplFontMetrics.fontSizeToNative(10000)).toEqual({ font: '5', magnification: 10 });
+  });
+
+  it('round-trip: chiều cao đọc ngược bằng chiều cao font đã chọn', () => {
+    for (const fontSizeDots of [12, 20, 24, 32, 40, 64, 96]) {
+      const native = TsplFontMetrics.fontSizeToNative(fontSizeDots);
+
+      expect(TsplFontMetrics.nativeToFontSize(native.font, native.magnification)).toBe(fontSizeDots);
+    }
+  });
+
+  it('đọc ngược font lạ theo font mặc định', () => {
+    expect(TsplFontMetrics.nativeToFontSize('0', 2)).toBe(40);
+    expect(TsplFontMetrics.characterSize('0')).toEqual({ width: 12, height: 20 });
+  });
+});
diff --git a/packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts b/packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts
index 3efc6ef..d8e3370 100644
--- a/packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts
+++ b/packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts
@@ -15,19 +15,25 @@ describe('TsplParser', () => {
     const result = parseTSPL(source);
     expect(result.widthDots).toBe(320); // 40mm @ 203dpi
     expect(result.heightDots).toBe(240); // 30mm @ 203dpi
-    expect(result.elements).toEqual([{ type: 'text', content: 'Hello', options: { x: 10, y: 10, font: '3', rotation: 0, size: 1 } }]);
+    expect(result.elements).toEqual([
+      { type: 'text', content: 'Hello', options: { x: 10, y: 10, fontSize: 24, rotation: 0 } },
+    ]);
   });
 
   it('normalizes an out-of-range TEXT rotation to 0 instead of asserting it into Rotation', () => {
     const source = 'SIZE 40 mm,30 mm\nCLS\nTEXT 0,0,"3",45,1,1,"x"\n';
     const result = parseTSPL(source);
-    expect(result.elements).toEqual([{ type: 'text', content: 'x', options: { x: 0, y: 0, font: '3', rotation: 0, size: 1 } }]);
+    expect(result.elements).toEqual([
+      { type: 'text', content: 'x', options: { x: 0, y: 0, fontSize: 24, rotation: 0 } },
+    ]);
   });
 
   it('normalizes an out-of-range BLOCK rotation to 0 instead of asserting it into Rotation', () => {
     const source = 'SIZE 40 mm,30 mm\nCLS\nBLOCK 0,0,100,50,"3",45,1,1,"x"\n';
     const result = parseTSPL(source);
-    expect(result.elements).toEqual([{ type: 'text', content: 'x', options: { x: 0, y: 0, font: '3', rotation: 0, size: 1, maxWidth: 100 } }]);
+    expect(result.elements).toEqual([
+      { type: 'text', content: 'x', options: { x: 0, y: 0, fontSize: 24, rotation: 0, maxWidth: 100 } },
+    ]);
   });
 
   it('parses a DIAGONAL command into a diagonal PrintElement, not a line element', () => {
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts packages/printer-core/src/language/tspl/__tests__/TsplFontMetrics.test.ts packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts
```

Expected: FAIL — `TsplFontMetrics` chưa tồn tại; compiler còn đọc `size`/`font`; parser còn trả `size`. Lúc lập plan: `Tests: 21 failed, 33 passed, 54 total` (số đếm có thể lệch nếu suite lỗi import; điều kiện bắt buộc là có test fail).

- [ ] **Step 3: Áp patch implementation**

Patch implementation làm các việc sau:
- Thêm `BitmapFont.ts` và `TsplFontMetrics.ts`.
- Chuyển compiler, parser, preview TSPL sang dùng metrics.
- Bật cảnh báo cắt partial.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t3-impl | git apply --ignore-whitespace -
```

<!-- patch:t3-impl -->
~~~diff
diff --git a/packages/printer-core/src/language/BitmapFont.ts b/packages/printer-core/src/language/BitmapFont.ts
new file mode 100644
index 0000000..10b383d
--- /dev/null
+++ b/packages/printer-core/src/language/BitmapFont.ts
@@ -0,0 +1,71 @@
+/** Kích thước 1 ký tự của font bitmap có sẵn trong máy in, ở hệ số phóng đại 1. */
+export interface BitmapFontSize {
+  /** Độ rộng 1 ký tự, dots. */
+  readonly width: number;
+
+  /** Chiều cao 1 ký tự, dots. */
+  readonly height: number;
+}
+
+/** Bảng font bitmap của 1 ngôn ngữ, theo mã font native. */
+export type BitmapFontTable = Readonly<Record<string, BitmapFontSize>>;
+
+/** Bộ font bitmap của 1 ngôn ngữ và giới hạn chọn font theo cỡ chữ. */
+export interface BitmapFontSet {
+  /** Mọi font máy in có sẵn — dùng để đọc ngược cỡ chữ khi parse. */
+  readonly fonts: BitmapFontTable;
+
+  /** Font được tự chọn theo cỡ chữ, theo thứ tự ưu tiên khi cao bằng nhau (loại font chuyên dụng như OCR). */
+  readonly selectable: readonly string[];
+
+  /** Font dùng khi element không khai báo cỡ chữ, hoặc mã font đọc được không có trong bảng. */
+  readonly defaultFont: string;
+
+  /** Hệ số phóng đại lớn nhất lệnh TEXT của ngôn ngữ nhận được. */
+  readonly maxMagnification: number;
+}
+
+/** Font native + hệ số phóng đại nguyên cho 1 cỡ chữ. */
+export interface BitmapFontChoice {
+  /** Mã font native, VD `'2'`. */
+  readonly font: string;
+
+  /** Hệ số phóng đại nguyên, từ 1. */
+  readonly magnification: number;
+}
+
+/**
+ * Chọn font + hệ số phóng đại có chiều cao gần `fontSizeDots` nhất. Khi bằng nhau thì ưu tiên hệ số nhỏ
+ * (font gốc to nét hơn font nhỏ phóng đại), rồi tới thứ tự trong `selectable`.
+ * Không khai báo cỡ chữ thì dùng font mặc định ở hệ số 1, giữ nguyên output cũ của compiler.
+ */
+export function chooseBitmapFont(fontSizeDots: number | undefined, fontSet: BitmapFontSet): BitmapFontChoice {
+  if (fontSizeDots === undefined) return { font: fontSet.defaultFont, magnification: 1 };
+
+  let best: BitmapFontChoice = { font: fontSet.defaultFont, magnification: 1 };
+  let bestDifference = Number.POSITIVE_INFINITY;
+  for (let magnification = 1; magnification <= fontSet.maxMagnification; magnification++) {
+    for (const font of fontSet.selectable) {
+      const difference = Math.abs(fontSet.fonts[font].height * magnification - fontSizeDots);
+      if (difference < bestDifference) {
+        best = { font, magnification };
+        bestDifference = difference;
+      }
+    }
+  }
+  return best;
+}
+
+/** Chiều cao chữ thật (dots) khi in `font` ở `magnification`; mã font lạ thì tính theo font mặc định. */
+export function bitmapFontHeight(
+  font: string,
+  magnification: number,
+  fontSet: BitmapFontSet,
+): number {
+  return bitmapFontSize(font, fontSet).height * magnification;
+}
+
+/** Kích thước 1 ký tự ở hệ số 1 của `font`; mã font lạ thì dùng font mặc định. */
+export function bitmapFontSize(font: string, fontSet: BitmapFontSet): BitmapFontSize {
+  return fontSet.fonts[font] ?? fontSet.fonts[fontSet.defaultFont];
+}
diff --git a/packages/printer-core/src/language/tspl/TsplCompiler.ts b/packages/printer-core/src/language/tspl/TsplCompiler.ts
index d7b2622..01881e0 100644
--- a/packages/printer-core/src/language/tspl/TsplCompiler.ts
+++ b/packages/printer-core/src/language/tspl/TsplCompiler.ts
@@ -1,5 +1,6 @@
 import type { ResolvedPrintDocument } from '../../document';
 import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
+import { CompileWarnings } from '../CompileWarnings';
 import type { BarcodeSymbology } from '../../symbology/barcode';
 import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';
 import type { Direction } from '../../types';
@@ -21,14 +22,19 @@ import type {
 } from '../../document/elements';
 import { TSPL_COMMAND } from './TsplCommand';
 import { encodeTsplBitmapPayload } from './TsplEncoder';
+import { TsplFontMetrics } from './TsplFontMetrics';
 import { formatTable, validateTableColumns } from '../../formatting';
 
+/** Tên ngôn ngữ trong câu cảnh báo. */
+const TSPL_LANGUAGE_NAME = 'TSPL';
+
+const CUT_PARTIAL_WARNING = 'CutOptions.mode "partial" được in như "full" — TSPL không phân biệt cắt một phần.';
+
 const MM_PER_INCH = 25.4;
 
 // Giá trị on-wire của lệnh TSPL2 DIRECTION.
 const TSPL_DIRECTION_VALUE: Record<Direction, 0 | 1> = { forward: 0, reverse: 1 };
 
-const DEFAULT_FONT = '2';
 const DEFAULT_ROTATION = 0;
 
 // Mã symbology theo cú pháp lệnh BARCODE.
@@ -52,12 +58,13 @@ const DEFAULT_QR_ECC: QrErrorCorrectionLevel = 'M';
 // Trường mode của lệnh QRCODE: 'A' (auto) hoặc 'M' (manual) — luôn dùng auto.
 const QR_MODE_AUTO = 'A';
 
-/**
- * Phải khớp `TSPL_FONTS['2'].h` bên `TsplPreviewRenderer` (20 dot) — các dòng
- * table dùng `DEFAULT_FONT` không override, nên preview và output in phải
- * đồng bộ chiều cao dòng.
- */
-const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 20;
+/** Font của dòng table — table không có cỡ chữ riêng nên dùng font mặc định. */
+const TABLE_ROW_FONT = TsplFontMetrics.fontSizeToNative(undefined);
+
+const DEFAULT_TABLE_ROW_HEIGHT_DOTS = TsplFontMetrics.nativeToFontSize(
+  TABLE_ROW_FONT.font,
+  TABLE_ROW_FONT.magnification,
+);
 
 const DEFAULT_CUT_ROWS = 1;
 
@@ -70,10 +77,8 @@ function compileTextElement(content: string, textOptions: TextOptions | undefine
   const options = textOptions ?? {};
   const x = options.x ?? 0;
   const y = options.y ?? 0;
-  const font = options.font ?? DEFAULT_FONT;
+  const { font, magnification } = TsplFontMetrics.fontSizeToNative(options.fontSize);
   const rotation = options.rotation ?? DEFAULT_ROTATION;
-  const xMul = options.xScale ?? options.size ?? 1;
-  const yMul = options.yScale ?? options.size ?? 1;
   const escaped = escapeTsplString(content);
 
   if (options.maxWidth) {
@@ -82,11 +87,11 @@ function compileTextElement(content: string, textOptions: TextOptions | undefine
     const spacing = options.lineSpacing ?? 0;
     return (
       `${TSPL_COMMAND.BLOCK} ${x},${y},${maxWidth},${maxWidth},"${font}",${rotation},` +
-      `${xMul},${yMul},${spacing},${align},"${escaped}"`
+      `${magnification},${magnification},${spacing},${align},"${escaped}"`
     );
   }
 
-  return `${TSPL_COMMAND.TEXT} ${x},${y},"${font}",${rotation},${xMul},${yMul},"${escaped}"`;
+  return `${TSPL_COMMAND.TEXT} ${x},${y},"${font}",${rotation},${magnification},${magnification},"${escaped}"`;
 }
 
 function compileImageElement(element: ImageElement): string {
@@ -160,9 +165,10 @@ function compileEraseElement(element: EraseElement): string {
  * TSPL không phân biệt cắt full/partial (không có khái niệm như `GS V` của
  * ESC/POS) — `mode` chỉ dùng để chọn bật/tắt cutter.
  */
-function compileCutElement(element: CutElement): string {
+function compileCutElement(element: CutElement, warnings: CompileWarnings): string {
   const mode = element.options?.mode ?? 'full';
   if (mode === 'off') return `${TSPL_COMMAND.SET_CUTTER} OFF`;
+  if (mode === 'partial') warnings.add(CUT_PARTIAL_WARNING);
   const rows = element.options?.rows ?? DEFAULT_CUT_ROWS;
   return `${TSPL_COMMAND.SET_CUTTER} ${rows}`;
 }
@@ -204,7 +210,7 @@ function compileQrCodeElement(element: QrCodeElement): string {
   return `${TSPL_COMMAND.QRCODE} ${x},${y},${ecc},${cellWidth},${QR_MODE_AUTO},${rotation},"${escaped}"`;
 }
 
-function compileElement(element: PrintElement): string {
+function compileElement(element: PrintElement, warnings: CompileWarnings): string {
   switch (element.type) {
     case 'text':
       return compileTextElement(element.content, element.options);
@@ -237,7 +243,7 @@ function compileElement(element: PrintElement): string {
       return typeof element.content === 'string' ? element.content : '';
 
     case 'cut':
-      return compileCutElement(element);
+      return compileCutElement(element, warnings);
 
     case 'table':
       return compileTableElement(element);
@@ -260,9 +266,10 @@ function compileElement(element: PrintElement): string {
   }
 }
 
-/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh TSPL/TSPL2. */
-export function compileToTSPL(document: ResolvedPrintDocument): string {
+/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh TSPL/TSPL2 kèm cảnh báo. */
+export function compileToTSPL(document: ResolvedPrintDocument): CompileResult<string> {
   const lines: string[] = [];
+  const warnings = new CompileWarnings(TSPL_LANGUAGE_NAME);
   const dpi = document.dpi;
   const widthMM = Math.round((document.widthDots / dpi) * MM_PER_INCH);
   const heightMM = document.heightDots > 0 ? Math.round((document.heightDots / dpi) * MM_PER_INCH) : 0;
@@ -278,12 +285,12 @@ export function compileToTSPL(document: ResolvedPrintDocument): string {
   for (const element of document.elements) {
     // Một element no-op (hoặc `raw` rỗng) compile ra `''` — bỏ qua để không
     // đẩy một dòng trống thừa vào output nối bằng `\r\n`.
-    const line = compileElement(element);
+    const line = compileElement(element, warnings);
     if (line) lines.push(line);
   }
 
   lines.push(`${TSPL_COMMAND.PRINT} ${document.copies}`);
-  return lines.join('\r\n') + '\r\n';
+  return { output: lines.join('\r\n') + '\r\n', warnings: warnings.toArray() };
 }
 
 /**
@@ -310,6 +317,6 @@ export class TsplCompiler implements PrintCompiler<string> {
    * đây; đây là ghi chú về một giới hạn đã biết, không phải một chỗ cần sửa.
    */
   compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
-    return { output: compileToTSPL(document), warnings: [] };
+    return compileToTSPL(document);
   }
 }
diff --git a/packages/printer-core/src/language/tspl/TsplFontMetrics.ts b/packages/printer-core/src/language/tspl/TsplFontMetrics.ts
new file mode 100644
index 0000000..63124b1
--- /dev/null
+++ b/packages/printer-core/src/language/tspl/TsplFontMetrics.ts
@@ -0,0 +1,47 @@
+import {
+  bitmapFontHeight,
+  bitmapFontSize,
+  chooseBitmapFont,
+  type BitmapFontChoice,
+  type BitmapFontSet,
+  type BitmapFontSize,
+} from '../BitmapFont';
+
+/** Hệ số nhân của lệnh TEXT/BLOCK TSPL nhận giá trị 1-10. */
+const TSPL_MAX_MAGNIFICATION = 10;
+
+/** Font bitmap có sẵn của TSPL, theo TSPL/TSPL2 Programming Manual. */
+const TSPL_FONT_SET: BitmapFontSet = {
+  fonts: {
+    '1': { width: 8, height: 12 },
+    '2': { width: 12, height: 20 },
+    '3': { width: 16, height: 24 },
+    '4': { width: 24, height: 32 },
+    '5': { width: 32, height: 48 },
+    '6': { width: 14, height: 19 },
+    '7': { width: 21, height: 27 },
+    '8': { width: 14, height: 25 },
+  },
+  // Font 6-8 là OCR-B/OCR-A, không dùng cho chữ thường nên không tự chọn.
+  selectable: ['1', '2', '3', '4', '5'],
+  defaultFont: '2',
+  maxMagnification: TSPL_MAX_MAGNIFICATION,
+};
+
+/** Quy đổi cỡ chữ (dots) ↔ font + hệ số nhân của lệnh TEXT/BLOCK TSPL — nguồn font duy nhất của TSPL. */
+export const TsplFontMetrics = {
+  /** Font + hệ số nhân gần cỡ chữ nhất; bỏ trống cỡ chữ thì dùng font `2` ở hệ số 1. */
+  fontSizeToNative(fontSizeDots: number | undefined): BitmapFontChoice {
+    return chooseBitmapFont(fontSizeDots, TSPL_FONT_SET);
+  },
+
+  /** Chiều cao chữ thật (dots) của 1 cặp font + hệ số nhân đọc từ lệnh TSPL. */
+  nativeToFontSize(font: string, magnification: number): number {
+    return bitmapFontHeight(font, magnification, TSPL_FONT_SET);
+  },
+
+  /** Kích thước 1 ký tự ở hệ số 1 của `font` — preview dùng để tính độ rộng chữ. */
+  characterSize(font: string): BitmapFontSize {
+    return bitmapFontSize(font, TSPL_FONT_SET);
+  },
+};
diff --git a/packages/printer-core/src/language/tspl/TsplParser.ts b/packages/printer-core/src/language/tspl/TsplParser.ts
index d10fb63..7531744 100644
--- a/packages/printer-core/src/language/tspl/TsplParser.ts
+++ b/packages/printer-core/src/language/tspl/TsplParser.ts
@@ -1,6 +1,7 @@
 import type { PrintParser } from '../../core';
 import type { PrintElement } from '../../document/elements';
 import type { Rotation } from '../../types';
+import { TsplFontMetrics } from './TsplFontMetrics';
 
 /**
  * Toàn bộ lệnh TSPL/TSPL2 mà parser nhận diện.
@@ -486,7 +487,11 @@ function parseTextCommand(
 
   return {
     command: { cmd: 'TEXT', x, y, font, rotation, xMul, yMul, alignment, content },
-    element: { type: 'text', content, options: { x, y, font, rotation: normalizeRotation(rotation), size: xMul } },
+    element: {
+      type: 'text',
+      content,
+      options: { x, y, fontSize: TsplFontMetrics.nativeToFontSize(font, yMul), rotation: normalizeRotation(rotation) },
+    },
   };
 }
 
@@ -511,7 +516,13 @@ function parseBlockCommand(
     element: {
       type: 'text',
       content,
-      options: { x, y, font, rotation: normalizeRotation(rotation), size: xMul, maxWidth: width },
+      options: {
+        x,
+        y,
+        fontSize: TsplFontMetrics.nativeToFontSize(font, yMul),
+        rotation: normalizeRotation(rotation),
+        maxWidth: width,
+      },
     },
   };
 }
diff --git a/packages/printer-core/src/language/tspl/index.ts b/packages/printer-core/src/language/tspl/index.ts
index 3da1d75..d9f3748 100644
--- a/packages/printer-core/src/language/tspl/index.ts
+++ b/packages/printer-core/src/language/tspl/index.ts
@@ -2,3 +2,4 @@ export * from './TsplCompiler';
 export * from './TsplCommand';
 export * from './TsplEncoder';
 export * from './TsplParser';
+export * from './TsplFontMetrics';
diff --git a/packages/printer-core/src/preview/languages/tspl/TsplPreviewRenderer.ts b/packages/printer-core/src/preview/languages/tspl/TsplPreviewRenderer.ts
index b296bfd..ed967dd 100644
--- a/packages/printer-core/src/preview/languages/tspl/TsplPreviewRenderer.ts
+++ b/packages/printer-core/src/preview/languages/tspl/TsplPreviewRenderer.ts
@@ -2,24 +2,7 @@ import type { ResolvedPrintDocument } from '../../../document';
 import type { PrintElement } from '../../../document/elements';
 import type { PrintPreview } from '../../../core';
 import { formatTable, validateTableColumns } from '../../../formatting';
-
-/** Kích thước pixel font bitmap có sẵn của TSPL, theo TSPL/TSPL2 Programming Manual. */
-const TSPL_FONTS: Record<string, { width: number; height: number }> = {
-  '1': { width: 8, height: 12 },
-  '2': { width: 12, height: 20 },
-  '3': { width: 16, height: 24 },
-  '4': { width: 24, height: 32 },
-  '5': { width: 32, height: 48 },
-  '6': { width: 14, height: 19 },
-  '7': { width: 21, height: 27 },
-  '8': { width: 14, height: 25 },
-};
-
-const DEFAULT_FONT = '2';
-const DEFAULT_TTF_POINT_SIZE = 12;
-/** Xấp xỉ 1pt ~ 2.82 dots ở 203 DPI — dùng cho font "0"/TrueType không có trong `TSPL_FONTS`. */
-const DOTS_PER_POINT_AT_203_DPI = 2.82;
-const TTF_CHAR_WIDTH_RATIO = 1.7;
+import { TsplFontMetrics } from '../../../language';
 
 const TEXT_BASELINE_RATIO = 0.85;
 const DEFAULT_LINE_THICKNESS = 1;
@@ -40,29 +23,15 @@ function escapeXml(text: string): string {
   return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
 }
 
-function getTsplFont(font: string | undefined) {
-  return TSPL_FONTS[font ?? DEFAULT_FONT];
+/** Chiều cao chữ thật khi máy in TSPL in cỡ chữ này — cùng font/hệ số mà compiler chọn. */
+function getFontHeight(fontSize: number | undefined): number {
+  const native = TsplFontMetrics.fontSizeToNative(fontSize);
+  return TsplFontMetrics.nativeToFontSize(native.font, native.magnification);
 }
 
-function getFontHeight(font: string | undefined, size: number | undefined, yScale: number | undefined): number {
-  const tsplFont = getTsplFont(font);
-
-  if (tsplFont) {
-    const scale = yScale && yScale > 1 ? yScale : size ?? 1;
-    return tsplFont.height * scale;
-  }
-
-  return (size ?? DEFAULT_TTF_POINT_SIZE) * DOTS_PER_POINT_AT_203_DPI;
-}
-
-function getCharWidth(font: string | undefined, size: number | undefined, xScale: number | undefined): number {
-  const tsplFont = getTsplFont(font);
-
-  if (tsplFont) {
-    return tsplFont.width * (xScale ?? size ?? 1);
-  }
-
-  return (size ?? DEFAULT_TTF_POINT_SIZE) * TTF_CHAR_WIDTH_RATIO;
+function getCharWidth(fontSize: number | undefined): number {
+  const native = TsplFontMetrics.fontSizeToNative(fontSize);
+  return TsplFontMetrics.characterSize(native.font).width * native.magnification;
 }
 
 function renderText(
@@ -88,7 +57,7 @@ function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): st
   const options = element.options ?? {};
   const x = options.x ?? 0;
   const y = options.y ?? 0;
-  const fontSize = getFontHeight(options.font, options.size, options.yScale);
+  const fontSize = getFontHeight(options.fontSize);
   const baselineY = y + fontSize * TEXT_BASELINE_RATIO;
   const rotation = options.rotation ? ` transform="rotate(${options.rotation} ${x} ${y})"` : '';
 
@@ -96,7 +65,7 @@ function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): st
     return renderText(element.content, x, baselineY, fontSize, options.bold ?? false, rotation, INK_COLOR);
   }
 
-  const charWidth = getCharWidth(options.font, options.size, options.xScale);
+  const charWidth = getCharWidth(options.fontSize);
   const backgroundWidth = element.content.length * charWidth + REVERSE_MARGIN * 2;
   const backgroundHeight = fontSize + REVERSE_MARGIN * 2;
 
@@ -250,7 +219,7 @@ function renderTableElement(element: Extract<PrintElement, { type: 'table' }>):
   const { options } = element;
   const x = options.x ?? 0;
   const y = options.y ?? 0;
-  const rowHeight = getFontHeight(undefined, 1, undefined);
+  const rowHeight = getFontHeight(undefined);
   const rowBaselineOffset = rowHeight * TEXT_BASELINE_RATIO;
 
   validateTableColumns(options.columns);
~~~

- [ ] **Step 4: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts packages/printer-core/src/language/tspl/__tests__/TsplFontMetrics.test.ts packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts
```

Expected: PASS — `Tests: 54 passed, 54 total`.

- [ ] **Step 5: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 86 passed, 86 total Tests: 615 passed, 615 total`.

- [ ] **Step 6: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts \
  packages/printer-core/src/language/tspl/__tests__/TsplCompiler.test.ts \
  packages/printer-core/src/language/tspl/__tests__/TsplFontMetrics.test.ts \
  packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts \
  packages/printer-core/src/language/BitmapFont.ts \
  packages/printer-core/src/language/tspl/TsplCompiler.ts \
  packages/printer-core/src/language/tspl/TsplFontMetrics.ts \
  packages/printer-core/src/language/tspl/TsplParser.ts \
  packages/printer-core/src/language/tspl/index.ts \
  packages/printer-core/src/preview/languages/tspl/TsplPreviewRenderer.ts
npx eslint $(git diff --cached --name-only -- '*.ts')
git diff --cached -U0 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: add TSPL font metrics and compile warnings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: eslint và line-length không in gì; commit thành công.

---
### Task 4: EPL: `EplFontMetrics` + cảnh báo element không hỗ trợ + `unsupportedCut`

**Files:**
- Create: `language/epl/EplFontMetrics.ts`
- Modify: `language/CompileWarnings.ts`, `language/epl/EplCompiler.ts`, `language/epl/EplParser.ts`, `language/epl/index.ts`, `preview/languages/epl/EplPreviewRenderer.ts`
- Test: `convert/__tests__/PrinterConverter.test.ts`, `core/__tests__/LanguageDispatch.test.ts`, `language/__tests__/CompileWarnings.test.ts`, `language/epl/__tests__/EplCompiler.test.ts`, `language/epl/__tests__/EplFontMetrics.test.ts` (mới), `language/epl/__tests__/EplParser.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `BitmapFont.ts` (Task 3), `CompileWarnings` (Task 1).
- Produces:
  - `CompileWarnings.unsupportedCut(options: CutOptions | undefined): void`:
    - `mode: 'off'` → không báo.
    - Ngược lại báo như `unsupportedElement('cut')`.
    - Task 5, 7 dùng lại.
  - `language/epl/EplFontMetrics.ts` — `const EplFontMetrics`:
    - Thông số: tự chọn font 1-4 (font 5 chỉ có chữ hoa); hệ số tối đa 6.
    - Cùng 3 method với `TsplFontMetrics`.
  - `EplCompiler`:
    - Cảnh báo diagonal, circle, ellipse, reverse, erase.
    - Cảnh báo cut qua `unsupportedCut`.
  - `EplParser`: `fontSize = EplFontMetrics.nativeToFontSize(font, verticalMultiplier)`.
  - `EplPreviewRenderer`: dùng metrics.

- [ ] **Step 1: Áp patch test**

Patch test làm các việc sau:
- Thêm `EplFontMetrics.test.ts` và test cỡ chữ/cảnh báo EPL.
- Thêm test `unsupportedCut` trong `CompileWarnings.test.ts`.
- Thêm test `compileTo` không dồn cảnh báo giữa 2 lần gọi (Review Focus 2).
- Thêm test cut `off` không cảnh báo (Review Focus 1).
- Đổi kỳ vọng parser/converter sang `fontSize`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t4-test | git apply --ignore-whitespace -
```

<!-- patch:t4-test -->
~~~diff
diff --git a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
index 30275dc..56251f9 100644
--- a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
+++ b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
@@ -49,7 +49,7 @@ describe('convert', () => {
     expect(result.output).toContain('^FDHello EPL^FS');
     expect(result.output).toContain('^XZ');
     expect(result.elements).toEqual([
-      { type: 'text', content: 'Hello EPL', options: { x: 10, y: 20, rotation: 0, font: '2', size: 1, reverse: undefined } },
+      { type: 'text', content: 'Hello EPL', options: { x: 10, y: 20, rotation: 0, fontSize: 16, reverse: undefined } },
     ]);
     expect(result.warnings).toEqual([]);
   });
@@ -57,7 +57,7 @@ describe('convert', () => {
   it('converts a TSPL label to recognizable EPL syntax', () => {
     const result = convert(TSPL_SOURCE, 'tspl', 'epl');
 
-    expect(result.output).toContain('A10,10,0,2,1,1,N,"Hello"');
+    expect(result.output).toContain('A10,10,0,4,1,1,N,"Hello"');
     expect(result.output).toContain('q400');
     expect(result.warnings).toEqual([]);
   });
diff --git a/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts b/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
index 6626d49..e01b8a7 100644
--- a/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
+++ b/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
@@ -99,4 +99,10 @@ describe('LanguageDispatch', () => {
     expect(() => validateFor(unknown, '')).toThrow(UnsupportedLanguageError);
     expect(() => previewFor(unknown, doc)).toThrow(UnsupportedLanguageError);
   });
+
+  it('compileTo dùng chung compiler đã đăng ký nhưng cảnh báo không dồn sang lần compile sau', () => {
+    compileTo('epl', { ...doc, elements: [{ type: 'circle', options: { x: 0, y: 0, diameter: 10 } }] });
+
+    expect(compileTo('epl', doc).warnings).toEqual([]);
+  });
 });
diff --git a/packages/printer-core/src/language/__tests__/CompileWarnings.test.ts b/packages/printer-core/src/language/__tests__/CompileWarnings.test.ts
index 33960e0..c4e03c7 100644
--- a/packages/printer-core/src/language/__tests__/CompileWarnings.test.ts
+++ b/packages/printer-core/src/language/__tests__/CompileWarnings.test.ts
@@ -24,4 +24,18 @@ describe('CompileWarnings', () => {
   it('chưa thêm gì thì rỗng', () => {
     expect(new CompileWarnings('TSPL').toArray()).toEqual([]);
   });
+
+  it('cut bật (mặc định full) thì báo element cut bị bỏ qua', () => {
+    const warnings = new CompileWarnings('EPL');
+    warnings.unsupportedCut(undefined);
+
+    expect(warnings.toArray()).toEqual(['Element "cut" bị bỏ qua — EPL không có lệnh tương ứng.']);
+  });
+
+  it('cut tắt (mode off) thì không có gì để báo', () => {
+    const warnings = new CompileWarnings('EPL');
+    warnings.unsupportedCut({ mode: 'off' });
+
+    expect(warnings.toArray()).toEqual([]);
+  });
 });
diff --git a/packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts b/packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts
index 49edea6..65ba523 100644
--- a/packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts
+++ b/packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts
@@ -17,7 +17,7 @@ describe('EplCompiler', () => {
     const compiler = new EplCompiler();
     const output = compiler.compile({
       ...baseDoc,
-      elements: [{ type: 'text', content: 'Hello EPL', options: { x: 10, y: 20, font: '3', size: 2 } }],
+      elements: [{ type: 'text', content: 'Hello EPL', options: { x: 10, y: 20, fontSize: 40 } }],
     }).output;
 
     expect(output).toContain('A10,20,0,3,2,2,N,"Hello EPL"');
@@ -222,3 +222,56 @@ describe('EplCompiler', () => {
     expect(output).toContain('b10,10,0,"QR",4,M,"hello"');
   });
 });
+
+describe('EplCompiler — cỡ chữ và cảnh báo', () => {
+  it('không khai báo fontSize thì dùng font 2 ở hệ số 1', () => {
+    const { output } = new EplCompiler().compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hi', options: { x: 1, y: 2 } }],
+    });
+
+    expect(output).toContain('A1,2,0,2,1,1,N,"Hi"');
+  });
+
+  it('cảnh báo từng loại element EPL2 không có lệnh, mỗi loại 1 lần', () => {
+    const { warnings } = new EplCompiler().compile({
+      ...baseDoc,
+      elements: [
+        { type: 'diagonal', options: { x1: 0, y1: 0, x2: 10, y2: 10 } },
+        { type: 'circle', options: { x: 0, y: 0, diameter: 20 } },
+        { type: 'circle', options: { x: 5, y: 5, diameter: 20 } },
+        { type: 'ellipse', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'reverse', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'erase', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'cut', options: { mode: 'full' } },
+      ],
+    });
+
+    expect(warnings).toEqual(
+      ['diagonal', 'circle', 'ellipse', 'reverse', 'erase', 'cut'].map(
+        (type) => `Element "${type}" bị bỏ qua — EPL không có lệnh tương ứng.`,
+      ),
+    );
+  });
+
+  it('element được hỗ trợ thì không có cảnh báo', () => {
+    const { warnings } = new EplCompiler().compile({
+      ...baseDoc,
+      elements: [
+        { type: 'text', content: 'Hi', options: { fontSize: 24 } },
+        { type: 'box', options: { x: 0, y: 0, width: 10, height: 10 } },
+      ],
+    });
+
+    expect(warnings).toEqual([]);
+  });
+
+  it('cut tắt (mode off) không cần lệnh cắt nên không cảnh báo', () => {
+    const { warnings } = new EplCompiler().compile({
+      ...baseDoc,
+      elements: [{ type: 'cut', options: { mode: 'off' } }],
+    });
+
+    expect(warnings).toEqual([]);
+  });
+});
diff --git a/packages/printer-core/src/language/epl/__tests__/EplFontMetrics.test.ts b/packages/printer-core/src/language/epl/__tests__/EplFontMetrics.test.ts
new file mode 100644
index 0000000..6df76d6
--- /dev/null
+++ b/packages/printer-core/src/language/epl/__tests__/EplFontMetrics.test.ts
@@ -0,0 +1,38 @@
+import { EplFontMetrics } from '..';
+
+describe('EplFontMetrics', () => {
+  it('không khai báo cỡ chữ thì dùng font 2 ở hệ số 1', () => {
+    expect(EplFontMetrics.fontSizeToNative(undefined)).toEqual({ font: '2', magnification: 1 });
+  });
+
+  it.each([
+    [12, { font: '1', magnification: 1 }],
+    [16, { font: '2', magnification: 1 }],
+    [25, { font: '4', magnification: 1 }],
+    [40, { font: '3', magnification: 2 }],
+    [48, { font: '4', magnification: 2 }],
+  ])('%i dots → %j', (fontSizeDots, expected) => {
+    expect(EplFontMetrics.fontSizeToNative(fontSizeDots)).toEqual(expected);
+  });
+
+  it('không tự chọn font 5 (chỉ có chữ hoa)', () => {
+    expect(EplFontMetrics.fontSizeToNative(48).font).not.toBe('5');
+  });
+
+  it('không vượt hệ số nhân 6', () => {
+    expect(EplFontMetrics.fontSizeToNative(10000)).toEqual({ font: '4', magnification: 6 });
+  });
+
+  it('round-trip: chiều cao đọc ngược bằng chiều cao font đã chọn', () => {
+    for (const fontSizeDots of [12, 16, 20, 24, 32, 48, 72]) {
+      const native = EplFontMetrics.fontSizeToNative(fontSizeDots);
+
+      expect(EplFontMetrics.nativeToFontSize(native.font, native.magnification)).toBe(fontSizeDots);
+    }
+  });
+
+  it('đọc ngược font 5 và font lạ', () => {
+    expect(EplFontMetrics.nativeToFontSize('5', 1)).toBe(48);
+    expect(EplFontMetrics.nativeToFontSize('9', 2)).toBe(32);
+  });
+});
diff --git a/packages/printer-core/src/language/epl/__tests__/EplParser.test.ts b/packages/printer-core/src/language/epl/__tests__/EplParser.test.ts
index f624cf7..cf6896a 100644
--- a/packages/printer-core/src/language/epl/__tests__/EplParser.test.ts
+++ b/packages/printer-core/src/language/epl/__tests__/EplParser.test.ts
@@ -16,7 +16,7 @@ describe('EplParser', () => {
     expect(result.widthDots).toBe(320);
     expect(result.heightDots).toBe(240);
     expect(result.elements).toEqual([
-      { type: 'text', content: 'Hello', options: { x: 10, y: 20, rotation: 0, font: '2', size: 1, reverse: undefined } },
+      { type: 'text', content: 'Hello', options: { x: 10, y: 20, rotation: 0, fontSize: 16, reverse: undefined } },
     ]);
   });
 
@@ -24,7 +24,9 @@ describe('EplParser', () => {
     const source = 'A5,5,1,3,2,2,R,"Rot"';
     const result = parseEPL(source);
 
-    expect(result.elements).toEqual([{ type: 'text', content: 'Rot', options: { x: 5, y: 5, rotation: 90, font: '3', size: 2, reverse: true } }]);
+    expect(result.elements).toEqual([
+      { type: 'text', content: 'Rot', options: { x: 5, y: 5, rotation: 90, fontSize: 40, reverse: true } },
+    ]);
   });
 
   it('parses an X command into a box PrintElement', () => {
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts packages/printer-core/src/language/__tests__/CompileWarnings.test.ts packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts packages/printer-core/src/language/epl/__tests__/EplFontMetrics.test.ts packages/printer-core/src/language/epl/__tests__/EplParser.test.ts
```

Expected: FAIL — `EplFontMetrics` và `unsupportedCut` chưa tồn tại; EPL chưa phát cảnh báo. Lúc lập plan: `Tests: 18 failed, 55 passed, 73 total` (số đếm có thể lệch nếu suite lỗi import; điều kiện bắt buộc là có test fail).

- [ ] **Step 3: Áp patch implementation**

Patch implementation làm các việc sau:
- Thêm `EplFontMetrics.ts` và `CompileWarnings.unsupportedCut`.
- Chuyển compiler, parser, preview EPL sang dùng metrics.
- Bật cảnh báo.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t4-impl | git apply --ignore-whitespace -
```

<!-- patch:t4-impl -->
~~~diff
diff --git a/packages/printer-core/src/language/CompileWarnings.ts b/packages/printer-core/src/language/CompileWarnings.ts
index 62d03bb..2c4c615 100644
--- a/packages/printer-core/src/language/CompileWarnings.ts
+++ b/packages/printer-core/src/language/CompileWarnings.ts
@@ -1,4 +1,4 @@
-import type { PrintElement } from '../document';
+import type { CutOptions, PrintElement } from '../document';
 
 /**
  * Gom cảnh báo trong 1 lần compile. Trùng nội dung thì chỉ giữ 1, để document có nhiều element
@@ -20,6 +20,13 @@ export class CompileWarnings {
     this.add(`Element "${elementType}" bị bỏ qua — ${this.languageName} không có lệnh tương ứng.`);
   }
 
+  /** Cảnh báo element `cut` bị bỏ qua; `mode: 'off'` nghĩa là không cần cắt nên không có gì để báo. */
+  unsupportedCut(options: CutOptions | undefined): void {
+    if (options?.mode === 'off') return;
+
+    this.unsupportedElement('cut');
+  }
+
   /** Danh sách cảnh báo theo thứ tự xuất hiện. */
   toArray(): readonly string[] {
     return [...this.messages];
diff --git a/packages/printer-core/src/language/epl/EplCompiler.ts b/packages/printer-core/src/language/epl/EplCompiler.ts
index f4ba163..3490e9d 100644
--- a/packages/printer-core/src/language/epl/EplCompiler.ts
+++ b/packages/printer-core/src/language/epl/EplCompiler.ts
@@ -11,10 +11,15 @@ import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../co
 import type { BarcodeSymbology, BarcodeConfig } from '../../symbology/barcode';
 import type { QrCodeConfig, QrErrorCorrectionLevel } from '../../symbology/qrcode';
 import type { Rotation, Bitmap } from '../../types';
+import { CompileWarnings } from '../CompileWarnings';
 import { EPL_COMMAND } from './EplCommand';
 import { encodeEplBitmapPayload } from './EplEncoder';
+import { EplFontMetrics } from './EplFontMetrics';
 import { formatTable, validateTableColumns } from '../../formatting';
 
+/** Tên ngôn ngữ trong câu cảnh báo. */
+const EPL_LANGUAGE_NAME = 'EPL';
+
 /**
  * Mã xoay EPL2 (`0`/`1`/`2`/`3` — trường xoay riêng của lệnh `A`/`B`/`b`) ứng
  * với một `Rotation` cho trước, theo EPL2 Programmer's Guide.
@@ -32,20 +37,15 @@ function eplRotation(rotation: Rotation | undefined): 0 | 1 | 2 | 3 {
   }
 }
 
-const DEFAULT_FONT = '2';
-
 function compileTextElement(content: string, options: TextOptions | undefined): string {
   const resolvedOptions = options ?? {};
   const x = resolvedOptions.x ?? 0;
   const y = resolvedOptions.y ?? 0;
   const rotationCode = eplRotation(resolvedOptions.rotation);
-  const font = resolvedOptions.font ?? DEFAULT_FONT;
-  const horizontalMultiplier = resolvedOptions.xScale ?? resolvedOptions.size ?? 1;
-  const verticalMultiplier = resolvedOptions.yScale ?? resolvedOptions.size ?? 1;
+  const { font, magnification } = EplFontMetrics.fontSizeToNative(resolvedOptions.fontSize);
   const reverseFlag = resolvedOptions.reverse ? 'R' : 'N';
   const header = `${EPL_COMMAND.TEXT}${x},${y},${rotationCode},${font}`;
-  const scale = `${horizontalMultiplier},${verticalMultiplier}`;
-  return `${header},${scale},${reverseFlag},"${content}"`;
+  return `${header},${magnification},${magnification},${reverseFlag},"${content}"`;
 }
 
 function compileImageElement(bitmap: Bitmap, options: ImageOptions | undefined): string {
@@ -84,12 +84,13 @@ function compileLineElement(options: LineOptions): string {
   return `${EPL_COMMAND.LINE}${options.x1},${options.y1},${width},${thickness}`;
 }
 
-/**
- * Chiều cao dòng (dots) dùng để xếp chồng các dòng bảng — khớp chiều cao
- * glyph của font mặc định ("2") trong bảng font tích hợp EPL2 (10w x 16h,
- * xem `EPL_FONTS['2']` của `EplPreviewRenderer`).
- */
-const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 16;
+/** Font của dòng bảng — bảng không có cỡ chữ riêng nên dùng font mặc định. */
+const TABLE_ROW_FONT = EplFontMetrics.fontSizeToNative(undefined);
+
+const DEFAULT_TABLE_ROW_HEIGHT_DOTS = EplFontMetrics.nativeToFontSize(
+  TABLE_ROW_FONT.font,
+  TABLE_ROW_FONT.magnification,
+);
 
 function compileTableElement(options: TableOptions): string {
   const x = options.x ?? 0;
@@ -156,7 +157,7 @@ function compileQrCodeElement(options: QrCodeConfig): string {
   return `${header},${cellWidth},${errorCorrection},"${options.content}"`;
 }
 
-function compileElement(element: PrintElement): string {
+function compileElement(element: PrintElement, warnings: CompileWarnings): string {
   switch (element.type) {
     case 'text':
       return compileTextElement(element.content, element.options);
@@ -170,25 +171,23 @@ function compileElement(element: PrintElement): string {
     case 'line':
       return compileLineElement(element.options);
 
-    // EPL2 không có lệnh vẽ đường chéo gốc (`LO` chỉ vẽ được thanh theo trục) — no-op có chủ đích.
+    // EPL2 không có lệnh vẽ đường chéo (`LO` chỉ vẽ thanh theo trục), hình tròn, ellipse, vùng reverse,
+    // vùng xoá hay cắt giấy (khác `^MM` của ZPL, `SET CUTTER` của TSPL) — bỏ qua và báo cảnh báo.
     case 'diagonal':
-      return '';
-
-    // Không có lệnh EPL2 gốc cho hình tròn, ellipse, vùng reverse-print hay vùng xoá độc lập — no-op có chủ đích.
     case 'circle':
     case 'ellipse':
     case 'reverse':
     case 'erase':
+      warnings.unsupportedElement(element.type);
       return '';
 
-    case 'raw':
-      return typeof element.content === 'string' ? element.content : '';
-
-    // Không có lệnh cắt giấy được tài liệu hoá trong EPL2 (khác với `^MM` của
-    // ZPL hay `SET CUTTER` của TSPL) — no-op có chủ đích.
     case 'cut':
+      warnings.unsupportedCut(element.options);
       return '';
 
+    case 'raw':
+      return typeof element.content === 'string' ? element.content : '';
+
     case 'table':
       return compileTableElement(element.options);
 
@@ -208,8 +207,10 @@ function compileElement(element: PrintElement): string {
   }
 }
 
-export function compileToEPL(document: ResolvedPrintDocument): string {
+/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh EPL2 kèm cảnh báo. */
+export function compileToEPL(document: ResolvedPrintDocument): CompileResult<string> {
   const lines: string[] = [];
+  const warnings = new CompileWarnings(EPL_LANGUAGE_NAME);
 
   lines.push(EPL_COMMAND.CLEAR_IMAGE_BUFFER);
   lines.push(`${EPL_COMMAND.LABEL_WIDTH}${document.widthDots}`);
@@ -222,12 +223,12 @@ export function compileToEPL(document: ResolvedPrintDocument): string {
   for (const element of document.elements) {
     // Một phần tử no-op (hoặc `raw` rỗng) compile ra `''` — bỏ qua để không
     // đẩy một dòng trống thừa vào chuỗi kết quả nối bằng `\n`.
-    const line = compileElement(element);
+    const line = compileElement(element, warnings);
     if (line) lines.push(line);
   }
 
   lines.push(`${EPL_COMMAND.PRINT}${document.copies}`);
-  return lines.join('\n') + '\n';
+  return { output: lines.join('\n') + '\n', warnings: warnings.toArray() };
 }
 
 /**
@@ -241,6 +242,6 @@ export function compileToEPL(document: ResolvedPrintDocument): string {
  */
 export class EplCompiler implements PrintCompiler<string> {
   compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
-    return { output: compileToEPL(document), warnings: [] };
+    return compileToEPL(document);
   }
 }
diff --git a/packages/printer-core/src/language/epl/EplFontMetrics.ts b/packages/printer-core/src/language/epl/EplFontMetrics.ts
new file mode 100644
index 0000000..27483ed
--- /dev/null
+++ b/packages/printer-core/src/language/epl/EplFontMetrics.ts
@@ -0,0 +1,44 @@
+import {
+  bitmapFontHeight,
+  bitmapFontSize,
+  chooseBitmapFont,
+  type BitmapFontChoice,
+  type BitmapFontSet,
+  type BitmapFontSize,
+} from '../BitmapFont';
+
+/** Hệ số nhân ngang của lệnh `A` EPL2 chỉ nhận 1-6 (dọc nhận tới 9) — dùng chung 1 hệ số cho cả 2 chiều. */
+const EPL_MAX_MAGNIFICATION = 6;
+
+/** Font bitmap có sẵn của EPL2, theo EPL2 Programmer's Guide. */
+const EPL_FONT_SET: BitmapFontSet = {
+  fonts: {
+    '1': { width: 8, height: 12 },
+    '2': { width: 10, height: 16 },
+    '3': { width: 12, height: 20 },
+    '4': { width: 14, height: 24 },
+    '5': { width: 32, height: 48 },
+  },
+  // Font 5 chỉ có chữ hoa nên không tự chọn cho nội dung bất kỳ.
+  selectable: ['1', '2', '3', '4'],
+  defaultFont: '2',
+  maxMagnification: EPL_MAX_MAGNIFICATION,
+};
+
+/** Quy đổi cỡ chữ (dots) ↔ font + hệ số nhân của lệnh `A` EPL2 — nguồn font duy nhất của EPL. */
+export const EplFontMetrics = {
+  /** Font + hệ số nhân gần cỡ chữ nhất; bỏ trống cỡ chữ thì dùng font `2` ở hệ số 1. */
+  fontSizeToNative(fontSizeDots: number | undefined): BitmapFontChoice {
+    return chooseBitmapFont(fontSizeDots, EPL_FONT_SET);
+  },
+
+  /** Chiều cao chữ thật (dots) của 1 cặp font + hệ số nhân dọc đọc từ lệnh `A`. */
+  nativeToFontSize(font: string, magnification: number): number {
+    return bitmapFontHeight(font, magnification, EPL_FONT_SET);
+  },
+
+  /** Kích thước 1 ký tự ở hệ số 1 của `font` — preview dùng để tính độ rộng chữ. */
+  characterSize(font: string): BitmapFontSize {
+    return bitmapFontSize(font, EPL_FONT_SET);
+  },
+};
diff --git a/packages/printer-core/src/language/epl/EplParser.ts b/packages/printer-core/src/language/epl/EplParser.ts
index 04e0721..c47b0a3 100644
--- a/packages/printer-core/src/language/epl/EplParser.ts
+++ b/packages/printer-core/src/language/epl/EplParser.ts
@@ -1,6 +1,7 @@
 import type { PrintParser } from '../../core';
 import type { PrintElement } from '../../document/elements';
 import type { Rotation } from '../../types';
+import { EplFontMetrics } from './EplFontMetrics';
 
 /**
  * Một lệnh EPL2 đã giải mã: ký tự lệnh một chữ cái, theo sau là phần văn bản
@@ -52,8 +53,7 @@ function parseTextCommand(line: string): PrintElement | undefined {
       x: Number(match[1]),
       y: Number(match[2]),
       rotation: eplRotationFromCode(Number(match[3])),
-      font: match[4],
-      size: Number(match[5]),
+      fontSize: EplFontMetrics.nativeToFontSize(match[4], Number(match[6])),
       reverse: match[7] === 'R' || undefined,
     },
   };
diff --git a/packages/printer-core/src/language/epl/index.ts b/packages/printer-core/src/language/epl/index.ts
index 602b963..e2167f3 100644
--- a/packages/printer-core/src/language/epl/index.ts
+++ b/packages/printer-core/src/language/epl/index.ts
@@ -2,3 +2,4 @@ export * from './EplCompiler';
 export * from './EplCommand';
 export * from './EplEncoder';
 export * from './EplParser';
+export * from './EplFontMetrics';
diff --git a/packages/printer-core/src/preview/languages/epl/EplPreviewRenderer.ts b/packages/printer-core/src/preview/languages/epl/EplPreviewRenderer.ts
index f44d114..37e3277 100644
--- a/packages/printer-core/src/preview/languages/epl/EplPreviewRenderer.ts
+++ b/packages/printer-core/src/preview/languages/epl/EplPreviewRenderer.ts
@@ -2,19 +2,8 @@ import type { ResolvedPrintDocument } from '../../../document';
 import type { PrintElement } from '../../../document/elements/PrintElement';
 import type { PrintPreview } from '../../../core';
 import { formatTable, validateTableColumns } from '../../../formatting';
+import { EplFontMetrics } from '../../../language';
 
-/** Kích thước pixel font bitmap có sẵn của EPL2, theo EPL2 Programmer's Guide. */
-const EPL_FONTS: Record<string, { width: number; height: number }> = {
-  '1': { width: 8, height: 12 },
-  '2': { width: 10, height: 16 },
-  '3': { width: 12, height: 20 },
-  '4': { width: 14, height: 24 },
-  '5': { width: 32, height: 48 },
-};
-
-const DEFAULT_FONT = '2';
-const FALLBACK_FONT_HEIGHT = 16;
-const FALLBACK_CHAR_WIDTH = 10;
 const TEXT_BASELINE_RATIO = 0.85;
 const DEFAULT_LINE_THICKNESS = 1;
 const REVERSE_MARGIN = 1;
@@ -28,18 +17,15 @@ const INK_COLOR = '#000';
 const PAPER_COLOR = '#fff';
 const FONT_FAMILY = 'monospace';
 
-function getEplFont(font: string | undefined) {
-  return EPL_FONTS[font ?? DEFAULT_FONT];
+/** Chiều cao chữ thật khi máy in EPL2 in cỡ chữ này — cùng font/hệ số mà compiler chọn. */
+function getFontHeight(fontSize: number | undefined): number {
+  const native = EplFontMetrics.fontSizeToNative(fontSize);
+  return EplFontMetrics.nativeToFontSize(native.font, native.magnification);
 }
 
-function getFontHeight(font: string | undefined, size: number | undefined): number {
-  const eplFont = getEplFont(font);
-  return eplFont ? eplFont.height * (size ?? 1) : (size ?? 1) * FALLBACK_FONT_HEIGHT;
-}
-
-function getCharWidth(font: string | undefined, size: number | undefined): number {
-  const eplFont = getEplFont(font);
-  return eplFont ? eplFont.width * (size ?? 1) : (size ?? 1) * FALLBACK_CHAR_WIDTH;
+function getCharWidth(fontSize: number | undefined): number {
+  const native = EplFontMetrics.fontSizeToNative(fontSize);
+  return EplFontMetrics.characterSize(native.font).width * native.magnification;
 }
 
 function escapeXml(text: string): string {
@@ -64,7 +50,7 @@ function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): st
   const options = element.options ?? {};
   const x = options.x ?? 0;
   const y = options.y ?? 0;
-  const fontSize = getFontHeight(options.font, options.size);
+  const fontSize = getFontHeight(options.fontSize);
   const baselineY = y + fontSize * TEXT_BASELINE_RATIO;
   const rotation = options.rotation ? ` transform="rotate(${options.rotation} ${x} ${y})"` : '';
 
@@ -72,7 +58,7 @@ function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): st
     return renderText(element.content, x, baselineY, fontSize, rotation, INK_COLOR);
   }
 
-  const charWidth = getCharWidth(options.font, options.size);
+  const charWidth = getCharWidth(options.fontSize);
   const textWidth = element.content.length * charWidth;
   const backgroundWidth = textWidth + REVERSE_MARGIN * 2;
   const backgroundHeight = fontSize + REVERSE_MARGIN * 2;
@@ -149,7 +135,7 @@ function renderTableElement(element: Extract<PrintElement, { type: 'table' }>):
   const { options } = element;
   const x = options.x ?? 0;
   const y = options.y ?? 0;
-  const rowHeight = getFontHeight(undefined, 1);
+  const rowHeight = getFontHeight(undefined);
   const rowBaselineOffset = rowHeight * TEXT_BASELINE_RATIO;
 
   validateTableColumns(options.columns);
~~~

- [ ] **Step 4: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts packages/printer-core/src/language/__tests__/CompileWarnings.test.ts packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts packages/printer-core/src/language/epl/__tests__/EplFontMetrics.test.ts packages/printer-core/src/language/epl/__tests__/EplParser.test.ts
```

Expected: PASS — `Tests: 73 passed, 73 total`.

- [ ] **Step 5: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 87 passed, 87 total Tests: 632 passed, 632 total`.

- [ ] **Step 6: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts \
  packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts \
  packages/printer-core/src/language/__tests__/CompileWarnings.test.ts \
  packages/printer-core/src/language/epl/__tests__/EplCompiler.test.ts \
  packages/printer-core/src/language/epl/__tests__/EplFontMetrics.test.ts \
  packages/printer-core/src/language/epl/__tests__/EplParser.test.ts \
  packages/printer-core/src/language/CompileWarnings.ts \
  packages/printer-core/src/language/epl/EplCompiler.ts \
  packages/printer-core/src/language/epl/EplFontMetrics.ts \
  packages/printer-core/src/language/epl/EplParser.ts \
  packages/printer-core/src/language/epl/index.ts \
  packages/printer-core/src/preview/languages/epl/EplPreviewRenderer.ts
npx eslint $(git diff --cached --name-only -- '*.ts')
git diff --cached -U0 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: add EPL font metrics and compile warnings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: eslint và line-length không in gì; commit thành công.

---
### Task 5: CPCL: `CpclFontMetrics` + cảnh báo

**Files:**
- Create: `language/cpcl/CpclFontMetrics.ts`
- Modify: `language/cpcl/CpclCompiler.ts`, `language/cpcl/CpclParser.ts`, `language/cpcl/index.ts`, `preview/languages/cpcl/CpclPreviewRenderer.ts`
- Test: `convert/__tests__/PrinterConverter.test.ts`, `language/cpcl/__tests__/CpclCompiler.test.ts`, `language/cpcl/__tests__/CpclFontMetrics.test.ts` (mới), `language/cpcl/__tests__/CpclParser.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `BitmapFont.ts`, `CompileWarnings.unsupportedCut` (Task 4).
- Produces:
  - `language/cpcl/CpclFontMetrics.ts` — `const CpclFontMetrics`:
    - Hệ số tối đa 1: compiler luôn phát size `0`, cỡ chữ đạt bằng cách chọn font.
    - `nativeToFontSize(font, size)` = chiều cao font × `max(1, size)`.
    - `characterSize(font)`.
  - `CpclCompiler`:
    - Cảnh báo circle, ellipse, reverse, erase và cut (qua `unsupportedCut`).
    - Cảnh báo `BarcodeConfig.readable` khi field này được khai báo.
  - `CpclParser`: `fontSize = CpclFontMetrics.nativeToFontSize(font, size)`.
  - `CpclPreviewRenderer`: dùng `characterSize(...).height`.

- [ ] **Step 1: Áp patch test**

Patch test làm các việc sau:
- Thêm `CpclFontMetrics.test.ts`.
- Thêm test cỡ chữ và cảnh báo CPCL, gồm cut `off` không cảnh báo.
- Đổi kỳ vọng parser/converter sang `fontSize`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t5-test | git apply --ignore-whitespace -
```

<!-- patch:t5-test -->
~~~diff
diff --git a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
index 56251f9..0d5a371 100644
--- a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
+++ b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
@@ -69,14 +69,14 @@ describe('convert', () => {
 
     expect(result.output).toContain('^XA');
     expect(result.output).toContain('^FDHello CPCL^FS');
-    expect(result.elements).toEqual([{ type: 'text', content: 'Hello CPCL', options: { x: 10, y: 20, font: '2', size: 0 } }]);
+    expect(result.elements).toEqual([{ type: 'text', content: 'Hello CPCL', options: { x: 10, y: 20, fontSize: 12 } }]);
     expect(result.warnings).toEqual([]);
   });
 
   it('converts a TSPL label to recognizable CPCL syntax', () => {
     const result = convert(TSPL_SOURCE, 'tspl', 'cpcl');
 
-    expect(result.output).toContain('TEXT 2 0 10 10\r\nHello');
+    expect(result.output).toContain('TEXT 5 0 10 10\r\nHello');
     expect(result.output).toContain('PAGE-WIDTH 400');
     expect(result.output).toContain('PRINT');
   });
diff --git a/packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts b/packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts
index 69c9a23..82f654c 100644
--- a/packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts
+++ b/packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts
@@ -17,10 +17,10 @@ describe('CpclCompiler', () => {
     const compiler = new CpclCompiler();
     const output = compiler.compile({
       ...baseDoc,
-      elements: [{ type: 'text', content: 'Hello CPCL', options: { x: 10, y: 20, font: '5', size: 1 } }],
+      elements: [{ type: 'text', content: 'Hello CPCL', options: { x: 10, y: 20, fontSize: 24 } }],
     }).output;
 
-    expect(output).toContain('TEXT 5 1 10 20\r\nHello CPCL');
+    expect(output).toContain('TEXT 5 0 10 20\r\nHello CPCL');
   });
 
   it('appends the rotation to the TEXT command name when rotated', () => {
@@ -197,3 +197,60 @@ describe('CpclCompiler', () => {
     expect(output).toContain('B QR10,10\r\nM2\r\nU6\r\nMA,hello\r\nENDQR');
   });
 });
+
+describe('CpclCompiler — cỡ chữ và cảnh báo', () => {
+  it('không khai báo fontSize thì dùng font 2 ở cỡ gốc', () => {
+    const { output } = new CpclCompiler().compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hi', options: { x: 1, y: 2 } }],
+    });
+
+    expect(output).toContain('TEXT 2 0 1 2\r\nHi');
+  });
+
+  it('cảnh báo element CPCL không có lệnh', () => {
+    const { warnings } = new CpclCompiler().compile({
+      ...baseDoc,
+      elements: [
+        { type: 'circle', options: { x: 0, y: 0, diameter: 20 } },
+        { type: 'ellipse', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'reverse', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'erase', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'cut' },
+      ],
+    });
+
+    expect(warnings).toEqual(
+      ['circle', 'ellipse', 'reverse', 'erase', 'cut'].map(
+        (type) => `Element "${type}" bị bỏ qua — CPCL không có lệnh tương ứng.`,
+      ),
+    );
+  });
+
+  it('cảnh báo khi barcode khai báo readable', () => {
+    const barcode = { symbology: 'code128' as const, content: '123' };
+    const withReadable = new CpclCompiler().compile({
+      ...baseDoc,
+      elements: [{ type: 'barcode', options: { ...barcode, readable: true } }],
+    });
+    const withoutReadable = new CpclCompiler().compile({
+      ...baseDoc,
+      elements: [{ type: 'barcode', options: barcode }],
+    });
+
+    expect(withReadable.warnings).toEqual([
+      'BarcodeConfig.readable bị bỏ qua — CPCL bật/tắt chữ dưới mã vạch bằng lệnh trạng thái riêng, ' +
+        'không phải tham số của BARCODE.',
+    ]);
+    expect(withoutReadable.warnings).toEqual([]);
+  });
+
+  it('cut tắt (mode off) không cần lệnh cắt nên không cảnh báo', () => {
+    const { warnings } = new CpclCompiler().compile({
+      ...baseDoc,
+      elements: [{ type: 'cut', options: { mode: 'off' } }],
+    });
+
+    expect(warnings).toEqual([]);
+  });
+});
diff --git a/packages/printer-core/src/language/cpcl/__tests__/CpclFontMetrics.test.ts b/packages/printer-core/src/language/cpcl/__tests__/CpclFontMetrics.test.ts
new file mode 100644
index 0000000..7b6a19c
--- /dev/null
+++ b/packages/printer-core/src/language/cpcl/__tests__/CpclFontMetrics.test.ts
@@ -0,0 +1,33 @@
+import { CpclFontMetrics } from '..';
+
+describe('CpclFontMetrics', () => {
+  it('không khai báo cỡ chữ thì dùng font 2', () => {
+    expect(CpclFontMetrics.fontSizeToNative(undefined)).toEqual({ font: '2', magnification: 1 });
+  });
+
+  it.each([
+    [9, '0'],
+    [12, '2'],
+    [24, '5'],
+    [27, '6'],
+    [47, '4'],
+    [48, '1'],
+    [200, '1'],
+  ])('%i dots → font %s ở cỡ gốc', (fontSizeDots, font) => {
+    expect(CpclFontMetrics.fontSizeToNative(fontSizeDots)).toEqual({ font, magnification: 1 });
+  });
+
+  it('round-trip: chiều cao đọc ngược bằng chiều cao font đã chọn', () => {
+    for (const fontSizeDots of [9, 12, 24, 27, 47, 48]) {
+      const native = CpclFontMetrics.fontSizeToNative(fontSizeDots);
+
+      expect(CpclFontMetrics.nativeToFontSize(native.font, 0)).toBe(fontSizeDots);
+    }
+  });
+
+  it('đọc ngược: size 0 là cỡ gốc, size lớn hơn coi như hệ số nhân', () => {
+    expect(CpclFontMetrics.nativeToFontSize('5', 0)).toBe(24);
+    expect(CpclFontMetrics.nativeToFontSize('5', 2)).toBe(48);
+    expect(CpclFontMetrics.nativeToFontSize('9', 0)).toBe(12);
+  });
+});
diff --git a/packages/printer-core/src/language/cpcl/__tests__/CpclParser.test.ts b/packages/printer-core/src/language/cpcl/__tests__/CpclParser.test.ts
index 3db49b6..c3c7f2d 100644
--- a/packages/printer-core/src/language/cpcl/__tests__/CpclParser.test.ts
+++ b/packages/printer-core/src/language/cpcl/__tests__/CpclParser.test.ts
@@ -16,14 +16,14 @@ describe('CpclParser', () => {
     expect(result.dpi).toBe(203);
     expect(result.heightDots).toBe(240);
     expect(result.widthDots).toBe(320);
-    expect(result.elements).toEqual([{ type: 'text', content: 'Hello', options: { x: 10, y: 20, font: '2', size: 0 } }]);
+    expect(result.elements).toEqual([{ type: 'text', content: 'Hello', options: { x: 10, y: 20, fontSize: 12 } }]);
   });
 
   it('parses a rotated text field (TEXT90) into the right element, consuming the data line that follows', () => {
     const source = 'TEXT90 5 1 5 5\r\nRot';
     const result = parseCPCL(source);
 
-    expect(result.elements).toEqual([{ type: 'text', content: 'Rot', options: { x: 5, y: 5, font: '5', size: 1 } }]);
+    expect(result.elements).toEqual([{ type: 'text', content: 'Rot', options: { x: 5, y: 5, fontSize: 24 } }]);
   });
 
   it('parses a BOX command into a box PrintElement', () => {
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts packages/printer-core/src/language/cpcl/__tests__/CpclFontMetrics.test.ts packages/printer-core/src/language/cpcl/__tests__/CpclParser.test.ts
```

Expected: FAIL — `CpclFontMetrics` chưa tồn tại; CPCL chưa phát cảnh báo. Lúc lập plan: `Tests: 17 failed, 37 passed, 54 total` (số đếm có thể lệch nếu suite lỗi import; điều kiện bắt buộc là có test fail).

- [ ] **Step 3: Áp patch implementation**

Patch implementation làm các việc sau:
- Thêm `CpclFontMetrics.ts`.
- Chuyển compiler, parser, preview CPCL sang dùng metrics.
- Bật cảnh báo.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t5-impl | git apply --ignore-whitespace -
```

<!-- patch:t5-impl -->
~~~diff
diff --git a/packages/printer-core/src/language/cpcl/CpclCompiler.ts b/packages/printer-core/src/language/cpcl/CpclCompiler.ts
index 3eb7804..a2253f6 100644
--- a/packages/printer-core/src/language/cpcl/CpclCompiler.ts
+++ b/packages/printer-core/src/language/cpcl/CpclCompiler.ts
@@ -3,18 +3,27 @@ import type { PrintElement, TextOptions } from '../../document/elements';
 import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import type { BarcodeSymbology } from '../../symbology/barcode';
 import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';
+import { CompileWarnings } from '../CompileWarnings';
 import { CPCL_COMMAND } from './CpclCommand';
 import { encodeCpclBitmapPayload } from './CpclEncoder';
+import { CpclFontMetrics } from './CpclFontMetrics';
 import { formatTable, validateTableColumns } from '../../formatting';
 
-const DEFAULT_FONT = '2';
+/** Tên ngôn ngữ trong câu cảnh báo. */
+const CPCL_LANGUAGE_NAME = 'CPCL';
 
-/**
- * Chiều cao dòng (dots) khi xếp chồng các dòng đã format của bảng — khớp
- * chiều cao glyph của font "2" (20w x 12h) trong `CPCL_FONTS` của
- * `CpclPreviewRenderer`, vì các dòng bảng dùng `DEFAULT_FONT`.
- */
-const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 12;
+const BARCODE_READABLE_WARNING =
+  'BarcodeConfig.readable bị bỏ qua — CPCL bật/tắt chữ dưới mã vạch bằng lệnh trạng thái riêng, ' +
+  'không phải tham số của BARCODE.';
+
+/** Trường `size` của lệnh `TEXT`: `0` là cỡ gốc của font. */
+const CPCL_BASE_FONT_SIZE = 0;
+
+/** Chiều cao dòng bảng — bảng không có cỡ chữ riêng nên dùng font mặc định. */
+const DEFAULT_TABLE_ROW_HEIGHT_DOTS = CpclFontMetrics.nativeToFontSize(
+  CpclFontMetrics.fontSizeToNative(undefined).font,
+  CPCL_BASE_FONT_SIZE,
+);
 
 /**
  * Token loại mã vạch của lệnh `BARCODE`, theo bảng Bar Code Field trong CPCL
@@ -53,18 +62,17 @@ const TONE_SCALE = 200;
 
 /**
  * `TEXT <font> <size> <x> <y>` theo CPCL Programmer's Manual — chuỗi dữ liệu
- * nằm trên dòng riêng ngay sau, không inline. `size` mặc định `0`: font tích
- * hợp của CPCL coi đây là size gốc của chính nó, không phải "không có chữ".
+ * nằm trên dòng riêng ngay sau, không inline. `size` luôn `0` (cỡ gốc của font):
+ * cỡ chữ được đáp ứng bằng cách chọn font, xem `CpclFontMetrics`.
  */
 function compileTextElement(content: string, options: TextOptions | undefined): string {
   const textOptions = options ?? {};
   const x = textOptions.x ?? 0;
   const y = textOptions.y ?? 0;
-  const font = textOptions.font ?? DEFAULT_FONT;
-  const size = textOptions.size ?? 0;
+  const { font } = CpclFontMetrics.fontSizeToNative(textOptions.fontSize);
   const rotation = textOptions.rotation ?? 0;
   const command = rotation === 0 ? CPCL_COMMAND.TEXT : `${CPCL_COMMAND.TEXT}${rotation}`;
-  return `${command} ${font} ${size} ${x} ${y}\r\n${content}`;
+  return `${command} ${font} ${CPCL_BASE_FONT_SIZE} ${x} ${y}\r\n${content}`;
 }
 
 function compileImageElement(element: Extract<PrintElement, { type: 'image' }>): string {
@@ -106,8 +114,12 @@ function compileTableElement(element: Extract<PrintElement, { type: 'table' }>):
 
 // Suy ra từ ngữ pháp lệnh BARCODE trong CPCL Programmer's Manual — chưa có ground truth để đối
 // chiếu, nên xác minh lại trên máy in thật.
-function compileBarcodeElement(element: Extract<PrintElement, { type: 'barcode' }>): string {
+function compileBarcodeElement(
+  element: Extract<PrintElement, { type: 'barcode' }>,
+  warnings: CompileWarnings,
+): string {
   const options = element.options;
+  if (options.readable !== undefined) warnings.add(BARCODE_READABLE_WARNING);
   const x = options.x ?? 0;
   const y = options.y ?? 0;
   const type = CPCL_BARCODE_TYPE[options.symbology];
@@ -142,7 +154,7 @@ function compileQrcodeElement(element: Extract<PrintElement, { type: 'qrcode' }>
   return qrLines.join('\r\n');
 }
 
-function compileElement(element: PrintElement): string {
+function compileElement(element: PrintElement, warnings: CompileWarnings): string {
   switch (element.type) {
     case 'text':
       return compileTextElement(element.content, element.options);
@@ -157,21 +169,22 @@ function compileElement(element: PrintElement): string {
     case 'diagonal':
       return compileLineElement(element);
 
-    // CPCL không có lệnh tích hợp để vẽ hình tròn/ellipse/vùng reverse-print/vùng erase độc lập
-    // — no-op thay vì bịa ngữ pháp lệnh mới.
+    // CPCL không có lệnh vẽ hình tròn/ellipse/vùng reverse-print/vùng erase độc lập, cũng không có lệnh
+    // cắt giấy được tài liệu hoá — bỏ qua và báo cảnh báo thay vì bịa ngữ pháp lệnh mới.
     case 'circle':
     case 'ellipse':
     case 'reverse':
     case 'erase':
+      warnings.unsupportedElement(element.type);
       return '';
 
-    case 'raw':
-      return typeof element.content === 'string' ? element.content : '';
-
-    // Không có lệnh cắt giấy nào được tài liệu hoá trong CPCL — no-op.
     case 'cut':
+      warnings.unsupportedCut(element.options);
       return '';
 
+    case 'raw':
+      return typeof element.content === 'string' ? element.content : '';
+
     case 'table':
       return compileTableElement(element);
 
@@ -184,15 +197,17 @@ function compileElement(element: PrintElement): string {
       return '';
 
     case 'barcode':
-      return compileBarcodeElement(element);
+      return compileBarcodeElement(element, warnings);
 
     case 'qrcode':
       return compileQrcodeElement(element);
   }
 }
 
-export function compileToCPCL(document: ResolvedPrintDocument): string {
+/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh CPCL kèm cảnh báo. */
+export function compileToCPCL(document: ResolvedPrintDocument): CompileResult<string> {
   const lines: string[] = [];
+  const warnings = new CompileWarnings(CPCL_LANGUAGE_NAME);
 
   const height = document.heightDots > 0 ? document.heightDots : DEFAULT_HEIGHT_DOTS;
   lines.push(`${CPCL_COMMAND.SESSION_START} 0 ${document.dpi} ${document.dpi} ${height} ${document.copies}`);
@@ -202,12 +217,12 @@ export function compileToCPCL(document: ResolvedPrintDocument): string {
 
   for (const element of document.elements) {
     // Bỏ qua để tránh dòng trống thừa khi join bằng \r\n (no-op hoặc raw rỗng biên dịch ra '').
-    const line = compileElement(element);
+    const line = compileElement(element, warnings);
     if (line) lines.push(line);
   }
 
   lines.push(CPCL_COMMAND.PRINT);
-  return lines.join('\r\n') + '\r\n';
+  return { output: lines.join('\r\n') + '\r\n', warnings: warnings.toArray() };
 }
 
 /**
@@ -217,6 +232,6 @@ export function compileToCPCL(document: ResolvedPrintDocument): string {
  */
 export class CpclCompiler implements PrintCompiler<string> {
   compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
-    return { output: compileToCPCL(document), warnings: [] };
+    return compileToCPCL(document);
   }
 }
diff --git a/packages/printer-core/src/language/cpcl/CpclFontMetrics.ts b/packages/printer-core/src/language/cpcl/CpclFontMetrics.ts
new file mode 100644
index 0000000..420317e
--- /dev/null
+++ b/packages/printer-core/src/language/cpcl/CpclFontMetrics.ts
@@ -0,0 +1,51 @@
+import {
+  bitmapFontHeight,
+  bitmapFontSize,
+  chooseBitmapFont,
+  type BitmapFontChoice,
+  type BitmapFontSet,
+  type BitmapFontSize,
+} from '../BitmapFont';
+
+/**
+ * Compiler chỉ chọn font theo cỡ chữ, không phóng đại: trường `size` của lệnh `TEXT` CPCL chọn biến thể cỡ
+ * riêng của từng font (0 = cỡ gốc), không phải hệ số nhân dùng chung được cho mọi font.
+ */
+const CPCL_MAX_MAGNIFICATION = 1;
+
+/** Font bitmap có sẵn của CPCL, theo Zebra CPCL Font Manual (ZQ210/ZQ220). */
+const CPCL_FONT_SET: BitmapFontSet = {
+  fonts: {
+    '0': { width: 8, height: 9 },
+    '1': { width: 16, height: 48 },
+    '2': { width: 20, height: 12 },
+    '4': { width: 25, height: 47 },
+    '5': { width: 16, height: 24 },
+    '6': { width: 28, height: 27 },
+    '7': { width: 12, height: 24 },
+  },
+  selectable: ['0', '2', '5', '7', '6', '4', '1'],
+  defaultFont: '2',
+  maxMagnification: CPCL_MAX_MAGNIFICATION,
+};
+
+/** Quy đổi cỡ chữ (dots) ↔ font + trường `size` của lệnh `TEXT` CPCL — nguồn font duy nhất của CPCL. */
+export const CpclFontMetrics = {
+  /** Font có chiều cao gần cỡ chữ nhất (luôn ở cỡ gốc); bỏ trống cỡ chữ thì dùng font `2`. */
+  fontSizeToNative(fontSizeDots: number | undefined): BitmapFontChoice {
+    return chooseBitmapFont(fontSizeDots, CPCL_FONT_SET);
+  },
+
+  /**
+   * Chiều cao chữ (dots) ước lượng từ font + trường `size` đọc được — best-effort: coi `size` như hệ số nhân,
+   * `0` là cỡ gốc.
+   */
+  nativeToFontSize(font: string, size: number): number {
+    return bitmapFontHeight(font, Math.max(1, size), CPCL_FONT_SET);
+  },
+
+  /** Kích thước 1 ký tự ở cỡ gốc của `font`. */
+  characterSize(font: string): BitmapFontSize {
+    return bitmapFontSize(font, CPCL_FONT_SET);
+  },
+};
diff --git a/packages/printer-core/src/language/cpcl/CpclParser.ts b/packages/printer-core/src/language/cpcl/CpclParser.ts
index d781ec1..23337f0 100644
--- a/packages/printer-core/src/language/cpcl/CpclParser.ts
+++ b/packages/printer-core/src/language/cpcl/CpclParser.ts
@@ -1,5 +1,6 @@
 import type { PrintParser } from '../../core';
 import type { PrintElement } from '../../document/elements';
+import { CpclFontMetrics } from './CpclFontMetrics';
 
 /**
  * Một lệnh CPCL đã decode: động từ lệnh và các token whitespace-split theo
@@ -59,7 +60,7 @@ function parseTextElement(parts: string[], content: string): PrintElement {
   return {
     type: 'text',
     content,
-    options: { x, y, font, size },
+    options: { x, y, fontSize: CpclFontMetrics.nativeToFontSize(font, size) },
   };
 }
 
diff --git a/packages/printer-core/src/language/cpcl/index.ts b/packages/printer-core/src/language/cpcl/index.ts
index bb2f06f..fddc414 100644
--- a/packages/printer-core/src/language/cpcl/index.ts
+++ b/packages/printer-core/src/language/cpcl/index.ts
@@ -2,3 +2,4 @@ export * from './CpclCompiler';
 export * from './CpclCommand';
 export * from './CpclEncoder';
 export * from './CpclParser';
+export * from './CpclFontMetrics';
diff --git a/packages/printer-core/src/preview/languages/cpcl/CpclPreviewRenderer.ts b/packages/printer-core/src/preview/languages/cpcl/CpclPreviewRenderer.ts
index c645ddb..03cb622 100644
--- a/packages/printer-core/src/preview/languages/cpcl/CpclPreviewRenderer.ts
+++ b/packages/printer-core/src/preview/languages/cpcl/CpclPreviewRenderer.ts
@@ -1,20 +1,8 @@
 import type { ResolvedPrintDocument } from '../../../document';
 import type { PrintElement } from '../../../document/elements/PrintElement';
 import type { PrintPreview } from '../../../core';
+import { CpclFontMetrics } from '../../../language';
 
-/** Kích thước pixel font bitmap có sẵn của CPCL, theo Zebra CPCL Font Manual (ZQ210/ZQ220). */
-const CPCL_FONTS: Record<string, { width: number; height: number }> = {
-  '0': { width: 8, height: 9 },
-  '1': { width: 16, height: 48 },
-  '2': { width: 20, height: 12 },
-  '4': { width: 25, height: 47 },
-  '5': { width: 16, height: 24 },
-  '6': { width: 28, height: 27 },
-  '7': { width: 12, height: 24 },
-};
-
-const DEFAULT_FONT = '2';
-const FALLBACK_FONT_HEIGHT = 12;
 const TEXT_BASELINE_RATIO = 0.85;
 const DEFAULT_LINE_THICKNESS = 1;
 
@@ -27,14 +15,9 @@ const INK_COLOR = '#000';
 const PAPER_COLOR = '#fff';
 const FONT_FAMILY = 'monospace';
 
-function getCpclFont(font: string | undefined) {
-  return CPCL_FONTS[font ?? DEFAULT_FONT];
-}
-
-function resolveFontSize(font: string | undefined, size: number | undefined): number {
-  const cpclFont = getCpclFont(font);
-  if (cpclFont) return cpclFont.height * Math.max(1, size ?? 1);
-  return (size ?? 1) * FALLBACK_FONT_HEIGHT;
+/** Chiều cao chữ thật khi máy in CPCL in cỡ chữ này — cùng font mà compiler chọn. */
+function resolveFontSize(fontSize: number | undefined): number {
+  return CpclFontMetrics.characterSize(CpclFontMetrics.fontSizeToNative(fontSize).font).height;
 }
 
 function escapeXml(text: string): string {
@@ -45,7 +28,7 @@ function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): st
   const options = element.options ?? {};
   const x = options.x ?? 0;
   const y = options.y ?? 0;
-  const fontSize = resolveFontSize(options.font, options.size);
+  const fontSize = resolveFontSize(options.fontSize);
   const baselineY = y + fontSize * TEXT_BASELINE_RATIO;
 
   return (
~~~

- [ ] **Step 4: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts packages/printer-core/src/language/cpcl/__tests__/CpclFontMetrics.test.ts packages/printer-core/src/language/cpcl/__tests__/CpclParser.test.ts
```

Expected: PASS — `Tests: 54 passed, 54 total`.

- [ ] **Step 5: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 88 passed, 88 total Tests: 646 passed, 646 total`.

- [ ] **Step 6: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts \
  packages/printer-core/src/language/cpcl/__tests__/CpclCompiler.test.ts \
  packages/printer-core/src/language/cpcl/__tests__/CpclFontMetrics.test.ts \
  packages/printer-core/src/language/cpcl/__tests__/CpclParser.test.ts \
  packages/printer-core/src/language/cpcl/CpclCompiler.ts \
  packages/printer-core/src/language/cpcl/CpclFontMetrics.ts \
  packages/printer-core/src/language/cpcl/CpclParser.ts \
  packages/printer-core/src/language/cpcl/index.ts \
  packages/printer-core/src/preview/languages/cpcl/CpclPreviewRenderer.ts
npx eslint $(git diff --cached --name-only -- '*.ts')
git diff --cached -U0 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: add CPCL font metrics and compile warnings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: eslint và line-length không in gì; commit thành công.

---
### Task 6: ZPL: `ZplFontMetrics` + cảnh báo `rows`/QR rotation

**Files:**
- Create: `language/zpl/ZplFontMetrics.ts`
- Modify: `language/zpl/ZplCompiler.ts`, `language/zpl/ZplParser.ts`, `language/zpl/index.ts`, `preview/languages/zpl/ZplPreviewRenderer.ts`
- Test: `convert/__tests__/PrinterConverter.test.ts`, `language/zpl/__tests__/ZplCompiler.test.ts`, `language/zpl/__tests__/ZplFontMetrics.test.ts` (mới), `language/zpl/__tests__/ZplParser.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `CompileWarnings`.
- Produces:
  - `language/zpl/ZplFontMetrics.ts`:
    - `interface ZplNativeFont { font; heightDots; widthDots }`
    - `const ZplFontMetrics`:
      - `fontSizeToNative(fontSizeDots: number | undefined): ZplNativeFont` — font `'0'`, làm tròn, tối thiểu 1, mặc định 30.
      - `nativeToFontSize(heightDots: number): number`
  - `ZplCompiler`, câu cảnh báo cố định:
    - `CutOptions.rows bị bỏ qua — ZPL chỉ hỗ trợ cắt sau mỗi label, không hỗ trợ cắt mỗi N label.` — chỉ khi thật sự cắt, `mode: 'off'` thì không báo.
    - `QrCodeConfig.rotation bị bỏ qua — lệnh ^BQ của ZPL chỉ in ổn định ở hướng N.` — khi rotation khác 0.
    - Cảnh báo ellipse, reverse, erase.
  - `ZplParser`: `fontSize` từ chiều cao `^A`.
  - `ZplPreviewRenderer`: font 0 cao theo metrics (hết lệch 18/30).

- [ ] **Step 1: Áp patch test**

Patch test làm các việc sau:
- Thêm `ZplFontMetrics.test.ts` (gồm cỡ lẻ 18.75 → 19, Review Focus 5).
- Thêm test cỡ chữ và cảnh báo ZPL, gồm `off` kèm `rows` không cảnh báo.
- Thêm test converter gộp cảnh báo compile.
- Đổi kỳ vọng parser sang `fontSize`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t6-test | git apply --ignore-whitespace -
```

<!-- patch:t6-test -->
~~~diff
diff --git a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
index 0d5a371..25d81f8 100644
--- a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
+++ b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
@@ -182,6 +182,16 @@ describe('convert', () => {
     expect([...SUPPORTED_SOURCES].sort()).toEqual(registryKeys);
     expect([...SUPPORTED_TARGETS].sort()).toEqual(registryKeys);
   });
+});
+
+describe('convert — cảnh báo', () => {
+  it('gộp cảnh báo compile của ngôn ngữ đích vào kết quả', () => {
+    const source = 'SIZE 50 mm,30 mm\r\nCLS\r\nCIRCLE 10,10,50,2\r\nPRINT 1\r\n';
+
+    expect(convert(source, 'tspl', 'epl').warnings).toEqual([
+      'Element "circle" bị bỏ qua — EPL không có lệnh tương ứng.',
+    ]);
+  });
 
   it('TSPL → TSPL giữ nguyên chiều cao chữ in ra dù mã font có thể đổi', () => {
     const source = 'SIZE 50 mm,30 mm\r\nCLS\r\nTEXT 10,10,"3",0,2,2,"Big"\r\nPRINT 1\r\n';
diff --git a/packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts b/packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts
index 185c406..32bf43b 100644
--- a/packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts
+++ b/packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts
@@ -157,3 +157,49 @@ describe('ZplCompiler', () => {
     expect(output).toContain('^GFA,2,2,2,FF00');
   });
 });
+
+describe('ZplCompiler — cỡ chữ và cảnh báo', () => {
+  function compileElements(elements: ResolvedPrintDocument['elements']) {
+    return new ZplCompiler().compile({ ...baseDoc, elements });
+  }
+
+  it('fontSize (dots) thành chiều cao/rộng của ^A0', () => {
+    const { output } = compileElements([{ type: 'text', content: 'Hi', options: { x: 1, y: 2, fontSize: 24 } }]);
+
+    expect(output).toContain('^FO1,2^A0N,24,24^FDHi^FS');
+  });
+
+  it('không khai báo fontSize thì dùng ^A0 cao 30 dots', () => {
+    const { output } = compileElements([{ type: 'text', content: 'Hi', options: { x: 1, y: 2 } }]);
+
+    expect(output).toContain('^FO1,2^A0N,30,30^FDHi^FS');
+  });
+
+  it('cảnh báo CutOptions.rows vì ZPL chỉ cắt sau mỗi label', () => {
+    expect(compileElements([{ type: 'cut', options: { mode: 'full', rows: 3 } }]).warnings).toEqual([
+      'CutOptions.rows bị bỏ qua — ZPL chỉ hỗ trợ cắt sau mỗi label, không hỗ trợ cắt mỗi N label.',
+    ]);
+    expect(compileElements([{ type: 'cut', options: { mode: 'full' } }]).warnings).toEqual([]);
+    expect(compileElements([{ type: 'cut', options: { mode: 'off', rows: 3 } }]).warnings).toEqual([]);
+  });
+
+  it('cảnh báo QrCodeConfig.rotation khác 0', () => {
+    expect(compileElements([{ type: 'qrcode', options: { content: 'x', rotation: 90 } }]).warnings).toEqual([
+      'QrCodeConfig.rotation bị bỏ qua — lệnh ^BQ của ZPL chỉ in ổn định ở hướng N.',
+    ]);
+    expect(compileElements([{ type: 'qrcode', options: { content: 'x', rotation: 0 } }]).warnings).toEqual([]);
+  });
+
+  it('cảnh báo ellipse/reverse/erase, không cảnh báo circle', () => {
+    const { warnings } = compileElements([
+      { type: 'circle', options: { x: 0, y: 0, diameter: 20 } },
+      { type: 'ellipse', options: { x: 0, y: 0, width: 20, height: 10 } },
+      { type: 'reverse', options: { x: 0, y: 0, width: 20, height: 10 } },
+      { type: 'erase', options: { x: 0, y: 0, width: 20, height: 10 } },
+    ]);
+
+    expect(warnings).toEqual(
+      ['ellipse', 'reverse', 'erase'].map((type) => `Element "${type}" bị bỏ qua — ZPL không có lệnh tương ứng.`),
+    );
+  });
+});
diff --git a/packages/printer-core/src/language/zpl/__tests__/ZplFontMetrics.test.ts b/packages/printer-core/src/language/zpl/__tests__/ZplFontMetrics.test.ts
new file mode 100644
index 0000000..c419e2c
--- /dev/null
+++ b/packages/printer-core/src/language/zpl/__tests__/ZplFontMetrics.test.ts
@@ -0,0 +1,24 @@
+import { ZplFontMetrics } from '..';
+
+describe('ZplFontMetrics', () => {
+  it('không khai báo cỡ chữ thì dùng font 0 cao 30 dots', () => {
+    expect(ZplFontMetrics.fontSizeToNative(undefined)).toEqual({ font: '0', heightDots: 30, widthDots: 30 });
+  });
+
+  it('cỡ chữ đi thẳng thành chiều cao/rộng dots, làm tròn', () => {
+    expect(ZplFontMetrics.fontSizeToNative(25)).toEqual({ font: '0', heightDots: 25, widthDots: 25 });
+    expect(ZplFontMetrics.fontSizeToNative(18.75)).toEqual({ font: '0', heightDots: 19, widthDots: 19 });
+  });
+
+  it('không cho chiều cao 0', () => {
+    expect(ZplFontMetrics.fontSizeToNative(0.2).heightDots).toBe(1);
+  });
+
+  it('round-trip: chiều cao đọc ngược bằng cỡ chữ nguyên ban đầu', () => {
+    for (const fontSizeDots of [10, 24, 30, 60]) {
+      expect(ZplFontMetrics.nativeToFontSize(ZplFontMetrics.fontSizeToNative(fontSizeDots).heightDots)).toBe(
+        fontSizeDots,
+      );
+    }
+  });
+});
diff --git a/packages/printer-core/src/language/zpl/__tests__/ZplParser.test.ts b/packages/printer-core/src/language/zpl/__tests__/ZplParser.test.ts
index 56edc76..8507237 100644
--- a/packages/printer-core/src/language/zpl/__tests__/ZplParser.test.ts
+++ b/packages/printer-core/src/language/zpl/__tests__/ZplParser.test.ts
@@ -22,7 +22,11 @@ describe('ZplParser', () => {
     expect(result.widthDots).toBe(320);
     expect(result.heightDots).toBe(240);
     expect(result.elements).toEqual([
-      { type: 'text', content: 'Hello', options: { x: 10, y: 20, font: '0', size: 1, xScale: 30, yScale: 30, reverse: undefined, maxWidth: undefined, align: undefined } },
+      {
+        type: 'text',
+        content: 'Hello',
+        options: { x: 10, y: 20, fontSize: 30, reverse: undefined, maxWidth: undefined, align: undefined },
+      },
     ]);
   });
 
@@ -30,7 +34,11 @@ describe('ZplParser', () => {
     const source = '^XA^FT10,50^A0N,20,20^FDBase^FS^XZ';
     const result = parseZPL(source);
     expect(result.elements).toEqual([
-      { type: 'text', content: 'Base', options: { x: 10, y: 30, font: '0', size: 1, xScale: 20, yScale: 20, reverse: undefined, maxWidth: undefined, align: undefined } },
+      {
+        type: 'text',
+        content: 'Base',
+        options: { x: 10, y: 30, fontSize: 20, reverse: undefined, maxWidth: undefined, align: undefined },
+      },
     ]);
   });
 
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts packages/printer-core/src/language/zpl/__tests__/ZplFontMetrics.test.ts packages/printer-core/src/language/zpl/__tests__/ZplParser.test.ts
```

Expected: FAIL — `ZplFontMetrics` chưa tồn tại; ZPL còn đọc `size`, chưa phát cảnh báo. Lúc lập plan: `Tests: 10 failed, 38 passed, 48 total` (số đếm có thể lệch nếu suite lỗi import; điều kiện bắt buộc là có test fail).

- [ ] **Step 3: Áp patch implementation**

Patch implementation làm các việc sau:
- Thêm `ZplFontMetrics.ts`.
- Chuyển compiler, parser, preview ZPL sang dùng metrics.
- Bật cảnh báo.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t6-impl | git apply --ignore-whitespace -
```

<!-- patch:t6-impl -->
~~~diff
diff --git a/packages/printer-core/src/language/zpl/ZplCompiler.ts b/packages/printer-core/src/language/zpl/ZplCompiler.ts
index c383e5a..c43df55 100644
--- a/packages/printer-core/src/language/zpl/ZplCompiler.ts
+++ b/packages/printer-core/src/language/zpl/ZplCompiler.ts
@@ -16,10 +16,19 @@ import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../co
 import type { BarcodeSymbology } from '../../symbology/barcode';
 import type { QrErrorCorrectionLevel } from '../../symbology/qrcode';
 import type { Rotation } from '../../types';
+import { CompileWarnings } from '../CompileWarnings';
 import { ZPL_COMMAND } from './ZplCommand';
 import { encodeZplBitmapPayload } from './ZplEncoder';
+import { ZplFontMetrics } from './ZplFontMetrics';
 import { formatTable, validateTableColumns } from '../../formatting';
 
+/** Tên ngôn ngữ trong câu cảnh báo. */
+const ZPL_LANGUAGE_NAME = 'ZPL';
+
+const CUT_ROWS_WARNING = 'CutOptions.rows bị bỏ qua — ZPL chỉ hỗ trợ cắt sau mỗi label, không hỗ trợ cắt mỗi N label.';
+
+const QR_ROTATION_WARNING = 'QrCodeConfig.rotation bị bỏ qua — lệnh ^BQ của ZPL chỉ in ổn định ở hướng N.';
+
 /** Ký tự field-orientation của `^A`/`^B`/`^BQ`: N=0°, R=90° CW, I=180°, B=270° CW. */
 function zplOrientation(rotation: Rotation | undefined): string {
   switch (rotation) {
@@ -34,9 +43,6 @@ function zplOrientation(rotation: Rotation | undefined): string {
   }
 }
 
-const DEFAULT_FONT = '0';
-/** Số dot chiều cao font `^A` ứng với 1 đơn vị `TextOptions.size` — hệ số quy đổi riêng của ZPL. */
-const FONT_HEIGHT_UNIT = 30;
 /** Giá trị dùng làm "không giới hạn" cho tham số max-lines của `^FB`. */
 const MAX_FIELD_BLOCK_LINES = 999;
 
@@ -45,12 +51,10 @@ function compileTextElement(content: string, options: TextOptions | undefined):
   const x = textOptions.x ?? 0;
   const y = textOptions.y ?? 0;
   const orientation = zplOrientation(textOptions.rotation);
-  const font = textOptions.font ?? DEFAULT_FONT;
-  const h = (textOptions.size ?? 1) * FONT_HEIGHT_UNIT;
-  const w = textOptions.xScale ?? h;
+  const { font, heightDots, widthDots } = ZplFontMetrics.fontSizeToNative(textOptions.fontSize);
 
   let command = `${ZPL_COMMAND.FIELD_ORIGIN}${x},${y}`;
-  command += `^A${font}${orientation},${h},${w}`;
+  command += `^A${font}${orientation},${heightDots},${widthDots}`;
 
   if (textOptions.maxWidth) {
     const justify = textOptions.align === 'center' ? 'C' : textOptions.align === 'right' ? 'R' : 'L';
@@ -117,8 +121,8 @@ const QR_MODEL = 2;
  */
 const QR_MODE_AUTO = 'A';
 
-/** Bằng `FONT_HEIGHT_UNIT` vì các dòng bảng dùng `DEFAULT_FONT` không override size. */
-const DEFAULT_TABLE_ROW_HEIGHT_DOTS = FONT_HEIGHT_UNIT;
+/** Dòng bảng không có cỡ chữ riêng nên cao bằng chữ ở cỡ mặc định. */
+const DEFAULT_TABLE_ROW_HEIGHT_DOTS = ZplFontMetrics.fontSizeToNative(undefined).heightDots;
 
 function compileImageElement(element: ImageElement): string {
   const options = element.options ?? {};
@@ -179,9 +183,12 @@ function compileCircleElement(element: CircleElement): string {
 
 // `CutOptions.rows` không có lệnh ZPL tương ứng — `^MM` cắt sau mỗi label
 // một khi bật, không hỗ trợ "cắt mỗi N label" nên trường này bị bỏ qua.
-function compileCutElement(element: CutElement): string {
+function compileCutElement(element: CutElement, warnings: CompileWarnings): string {
   const mode = element.options?.mode ?? 'full';
-  return mode === 'off' ? `${ZPL_COMMAND.PRINT_MODE}T` : `${ZPL_COMMAND.PRINT_MODE}C`;
+  if (mode === 'off') return `${ZPL_COMMAND.PRINT_MODE}T`;
+
+  if (element.options?.rows !== undefined) warnings.add(CUT_ROWS_WARNING);
+  return `${ZPL_COMMAND.PRINT_MODE}C`;
 }
 
 function compileTableElement(element: TableElement): string {
@@ -218,8 +225,9 @@ function compileBarcodeElement(element: BarcodeElement): string {
 
 // Firmware `^BQ` chỉ hỗ trợ ổn định orientation "N" (không đủ N/R/I/B như
 // `^A`/`^B<type>`) nên `rotation` không được áp dụng ở đây.
-function compileQrcodeElement(element: QrCodeElement): string {
+function compileQrcodeElement(element: QrCodeElement, warnings: CompileWarnings): string {
   const options = element.options;
+  if (options.rotation !== undefined && options.rotation !== 0) warnings.add(QR_ROTATION_WARNING);
   const x = options.x ?? 0;
   const y = options.y ?? 0;
   const magnification = options.cellWidth ?? DEFAULT_QR_MAGNIFICATION;
@@ -230,7 +238,7 @@ function compileQrcodeElement(element: QrCodeElement): string {
   );
 }
 
-function compileElement(element: PrintElement): string {
+function compileElement(element: PrintElement, warnings: CompileWarnings): string {
   switch (element.type) {
     case 'text':
       return compileTextElement(element.content, element.options);
@@ -254,17 +262,18 @@ function compileElement(element: PrintElement): string {
       return compileCircleElement(element);
 
     // ZPL không có lệnh gốc cho viền ellipse, vùng reverse-print độc lập,
-    // hay vùng erase độc lập — no-op có chủ đích.
+    // hay vùng erase độc lập — bỏ qua và báo cảnh báo.
     case 'ellipse':
     case 'reverse':
     case 'erase':
+      warnings.unsupportedElement(element.type);
       return '';
 
     case 'raw':
       return typeof element.content === 'string' ? element.content : '';
 
     case 'cut':
-      return compileCutElement(element);
+      return compileCutElement(element, warnings);
 
     case 'table':
       return compileTableElement(element);
@@ -281,7 +290,7 @@ function compileElement(element: PrintElement): string {
       return compileBarcodeElement(element);
 
     case 'qrcode':
-      return compileQrcodeElement(element);
+      return compileQrcodeElement(element, warnings);
   }
 }
 
@@ -291,8 +300,10 @@ const DARKNESS_SCALE = 2;
 /** Giá trị `^CI` cho bảng mã UTF-8 — `^CI28` chọn UTF-8 theo Zebra ZPL II Programming Guide. */
 const CI_ENCODING_UTF8 = 28;
 
-export function compileToZPL(document: ResolvedPrintDocument): string {
+/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh ZPL II kèm cảnh báo. */
+export function compileToZPL(document: ResolvedPrintDocument): CompileResult<string> {
   const lines: string[] = [];
+  const warnings = new CompileWarnings(ZPL_LANGUAGE_NAME);
 
   lines.push(ZPL_COMMAND.START_FORMAT);
   lines.push(`${ZPL_COMMAND.PRINT_WIDTH}${document.widthDots}`);
@@ -306,13 +317,13 @@ export function compileToZPL(document: ResolvedPrintDocument): string {
   for (const element of document.elements) {
     // Một element no-op (hoặc `raw` rỗng) biên dịch ra `''` — bỏ qua để
     // không đẩy một dòng trống thừa vào output nối bằng `\n`.
-    const line = compileElement(element);
+    const line = compileElement(element, warnings);
     if (line) lines.push(line);
   }
 
   lines.push(`${ZPL_COMMAND.PRINT_QUANTITY}${document.copies}`);
   lines.push(ZPL_COMMAND.END_FORMAT);
-  return lines.join('\n') + '\n';
+  return { output: lines.join('\n') + '\n', warnings: warnings.toArray() };
 }
 
 /**
@@ -321,6 +332,6 @@ export function compileToZPL(document: ResolvedPrintDocument): string {
  */
 export class ZplCompiler implements PrintCompiler<string> {
   compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
-    return { output: compileToZPL(document), warnings: [] };
+    return compileToZPL(document);
   }
 }
diff --git a/packages/printer-core/src/language/zpl/ZplFontMetrics.ts b/packages/printer-core/src/language/zpl/ZplFontMetrics.ts
new file mode 100644
index 0000000..f75ef43
--- /dev/null
+++ b/packages/printer-core/src/language/zpl/ZplFontMetrics.ts
@@ -0,0 +1,34 @@
+/** Font native + kích thước dots cho lệnh `^A` ZPL. */
+export interface ZplNativeFont {
+  /** Mã font ZPL; luôn `0` (CG Triumvirate, co giãn được). */
+  readonly font: string;
+
+  /** Chiều cao chữ, dots — tham số `h` của `^A`. */
+  readonly heightDots: number;
+
+  /** Độ rộng chữ, dots — tham số `w` của `^A`. */
+  readonly widthDots: number;
+}
+
+/** Font `0` co giãn tới đúng chiều cao dots được yêu cầu, nên không cần chọn font bitmap. */
+const ZPL_SCALABLE_FONT = '0';
+
+/** Chiều cao `^A` khi element không khai báo cỡ chữ. */
+const DEFAULT_FONT_HEIGHT_DOTS = 30;
+
+/** ZPL không nhận chiều cao 0 cho `^A`. */
+const MIN_FONT_HEIGHT_DOTS = 1;
+
+/** Quy đổi cỡ chữ (dots) ↔ tham số `^A` ZPL — nguồn font duy nhất của ZPL. */
+export const ZplFontMetrics = {
+  /** Font `0` với chiều cao = rộng = cỡ chữ (làm tròn dots); bỏ trống cỡ chữ thì dùng 30 dots. */
+  fontSizeToNative(fontSizeDots: number | undefined): ZplNativeFont {
+    const heightDots = Math.max(MIN_FONT_HEIGHT_DOTS, Math.round(fontSizeDots ?? DEFAULT_FONT_HEIGHT_DOTS));
+    return { font: ZPL_SCALABLE_FONT, heightDots, widthDots: heightDots };
+  },
+
+  /** Cỡ chữ (dots) từ tham số chiều cao của `^A`/`^CF` — mọi font ZPL đều co giãn theo tham số này. */
+  nativeToFontSize(heightDots: number): number {
+    return heightDots;
+  },
+};
diff --git a/packages/printer-core/src/language/zpl/ZplParser.ts b/packages/printer-core/src/language/zpl/ZplParser.ts
index f4234a0..cd1d424 100644
--- a/packages/printer-core/src/language/zpl/ZplParser.ts
+++ b/packages/printer-core/src/language/zpl/ZplParser.ts
@@ -1,6 +1,7 @@
 import type { PrintParser } from '../../core';
 import type { PrintElement } from '../../document/elements';
 import type { Alignment } from '../../types';
+import { ZplFontMetrics } from './ZplFontMetrics';
 
 /**
  * Một lệnh ZPL đã giải mã: mã lệnh có tiền tố `^`/`~`, phần text thô nằm giữa nó và
@@ -203,10 +204,7 @@ function buildClosedFieldElement(state: ZplParserState): PrintElement {
     options: {
       x: state.fieldX,
       y: adjustedY,
-      font: state.currentFont,
-      size: 1,
-      xScale: state.currentFontWidth,
-      yScale: state.currentFontHeight,
+      fontSize: ZplFontMetrics.nativeToFontSize(state.currentFontHeight),
       reverse: state.fieldReverse || undefined,
       maxWidth: state.fieldBlockWidth || undefined,
       align,
diff --git a/packages/printer-core/src/language/zpl/index.ts b/packages/printer-core/src/language/zpl/index.ts
index 377814f..5298087 100644
--- a/packages/printer-core/src/language/zpl/index.ts
+++ b/packages/printer-core/src/language/zpl/index.ts
@@ -2,3 +2,4 @@ export * from './ZplCompiler';
 export * from './ZplCommand';
 export * from './ZplEncoder';
 export * from './ZplParser';
+export * from './ZplFontMetrics';
diff --git a/packages/printer-core/src/preview/languages/zpl/ZplPreviewRenderer.ts b/packages/printer-core/src/preview/languages/zpl/ZplPreviewRenderer.ts
index 2d9889a..c8f6f7d 100644
--- a/packages/printer-core/src/preview/languages/zpl/ZplPreviewRenderer.ts
+++ b/packages/printer-core/src/preview/languages/zpl/ZplPreviewRenderer.ts
@@ -2,41 +2,9 @@ import type { ResolvedPrintDocument } from '../../../document';
 import type { PrintElement } from '../../../document/elements/PrintElement';
 import type { PrintPreview } from '../../../core';
 import { formatTable, validateTableColumns } from '../../../formatting';
+import { ZplFontMetrics } from '../../../language';
 
-/**
- * Kích thước pixel font bitmap có sẵn của ZPL ở 203 DPI, theo Zebra ZPL II
- * Programming Guide. Font "0" (CG Triumvirate) co giãn được — entry của nó
- * chỉ là giá trị nền, kích thước thật lấy từ tham số height/width của `^A`/`^CF`.
- */
-const ZPL_FONTS: Record<string, { width: number; height: number }> = {
-  A: { width: 5, height: 9 },
-  B: { width: 7, height: 11 },
-  C: { width: 10, height: 18 },
-  D: { width: 10, height: 18 },
-  E: { width: 15, height: 28 },
-  F: { width: 13, height: 26 },
-  G: { width: 40, height: 60 },
-  H: { width: 13, height: 21 },
-  P: { width: 18, height: 20 },
-  Q: { width: 24, height: 28 },
-  R: { width: 31, height: 35 },
-  S: { width: 35, height: 40 },
-  T: { width: 42, height: 48 },
-  U: { width: 53, height: 59 },
-  V: { width: 71, height: 80 },
-  '0': { width: 15, height: 18 },
-};
-
-const DEFAULT_FONT_CODE = '0';
-/**
- * Trên ngưỡng này, `yScale` (từ tham số height của `^A`/`^CF`) được tin dùng
- * trực tiếp thay vì bảng `ZPL_FONTS` cố định.
- */
-const YSCALE_TRUST_THRESHOLD = 10;
-const DEFAULT_FALLBACK_FONT_SIZE = 18;
-const FALLBACK_SIZE_MULTIPLIER = 12;
 const PROPORTIONAL_FONT_BASELINE_RATIO = 0.78;
-const MONOSPACE_FONT_BASELINE_RATIO = 0.82;
 const PROPORTIONAL_FONT_FAMILY = "'Helvetica Neue', Helvetica, Arial, sans-serif";
 const MONOSPACE_FONT_FAMILY = 'monospace';
 const TABLE_ROW_BASELINE_RATIO = 0.85;
@@ -72,32 +40,9 @@ const QR_TEXT_OFFSET = 15;
 const QR_TEXT_FONT_SIZE = 14;
 const DEFAULT_QR_CELL_WIDTH = 4;
 
-function isProportionalFont(font: string | undefined): boolean {
-  return (font ?? DEFAULT_FONT_CODE) === DEFAULT_FONT_CODE;
-}
-
-function getZplFont(font: string | undefined) {
-  return ZPL_FONTS[(font ?? DEFAULT_FONT_CODE).toUpperCase()];
-}
-
-function getFontSize(
-  font: string | undefined,
-  size: number | undefined,
-  yScale: number | undefined,
-): number {
-  if (yScale && yScale > YSCALE_TRUST_THRESHOLD) return yScale;
-  const zplFont = getZplFont(font);
-  if (zplFont) return zplFont.height * (size ?? 1);
-  return size ? size * FALLBACK_SIZE_MULTIPLIER : DEFAULT_FALLBACK_FONT_SIZE;
-}
-
-/** Font "0" (proportional) nằm cao hơn 1 chút so với các font bitmap A-H, do ascent khác nhau. */
-function getBaselineRatio(font: string | undefined): number {
-  return isProportionalFont(font) ? PROPORTIONAL_FONT_BASELINE_RATIO : MONOSPACE_FONT_BASELINE_RATIO;
-}
-
-function getFontFamily(font: string | undefined): string {
-  return isProportionalFont(font) ? PROPORTIONAL_FONT_FAMILY : MONOSPACE_FONT_FAMILY;
+/** Chiều cao chữ thật khi máy in ZPL in cỡ chữ này — cùng tham số `^A` mà compiler phát. */
+function getFontSize(fontSize: number | undefined): number {
+  return ZplFontMetrics.fontSizeToNative(fontSize).heightDots;
 }
 
 function escapeXml(text: string): string {
@@ -108,9 +53,10 @@ function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): st
   const options = element.options ?? {};
   const x = options.x ?? 0;
   const y = options.y ?? 0;
-  const fontSize = getFontSize(options.font, options.size, options.yScale);
-  const baselineRatio = getBaselineRatio(options.font);
-  const fontFamily = getFontFamily(options.font);
+  const fontSize = getFontSize(options.fontSize);
+  // Compiler luôn in text bằng font 0 (CG Triumvirate, chữ tỉ lệ).
+  const baselineRatio = PROPORTIONAL_FONT_BASELINE_RATIO;
+  const fontFamily = PROPORTIONAL_FONT_FAMILY;
   const fontWeight = options.bold ? 'bold' : 'normal';
   const rotation = options.rotation ? ` transform="rotate(${options.rotation} ${x} ${y})"` : '';
 
@@ -282,7 +228,7 @@ function renderTableElement(element: Extract<PrintElement, { type: 'table' }>):
   const { options } = element;
   const x = options.x ?? 0;
   const y = options.y ?? 0;
-  const rowHeight = getFontSize(undefined, 1, undefined);
+  const rowHeight = getFontSize(undefined);
   const rowBaselineOffset = rowHeight * TABLE_ROW_BASELINE_RATIO;
 
   validateTableColumns(options.columns);
~~~

- [ ] **Step 4: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts packages/printer-core/src/language/zpl/__tests__/ZplFontMetrics.test.ts packages/printer-core/src/language/zpl/__tests__/ZplParser.test.ts
```

Expected: PASS — `Tests: 48 passed, 48 total`.

- [ ] **Step 5: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 89 passed, 89 total Tests: 656 passed, 656 total`.

- [ ] **Step 6: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts \
  packages/printer-core/src/language/zpl/__tests__/ZplCompiler.test.ts \
  packages/printer-core/src/language/zpl/__tests__/ZplFontMetrics.test.ts \
  packages/printer-core/src/language/zpl/__tests__/ZplParser.test.ts \
  packages/printer-core/src/language/zpl/ZplCompiler.ts \
  packages/printer-core/src/language/zpl/ZplFontMetrics.ts \
  packages/printer-core/src/language/zpl/ZplParser.ts \
  packages/printer-core/src/language/zpl/index.ts \
  packages/printer-core/src/preview/languages/zpl/ZplPreviewRenderer.ts
npx eslint $(git diff --cached --name-only -- '*.ts')
git diff --cached -U0 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: add ZPL font metrics and compile warnings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: eslint và line-length không in gì; commit thành công.

---
### Task 7: DPL, SBPL, IPL: `MagnifiedFont` + metrics + preview dùng chung nhận chiều cao chữ

**Files:**
- Create: `language/MagnifiedFont.ts`, `language/dpl/DplFontMetrics.ts`, `language/ipl/IplFontMetrics.ts`, `language/sbpl/SbplFontMetrics.ts`
- Modify: `language/dpl/DplCompiler.ts`, `language/dpl/index.ts`, `language/ipl/IplCompiler.ts`, `language/ipl/index.ts`, `language/sbpl/SbplCompiler.ts`, `language/sbpl/index.ts`, `preview/PreviewRenderer.ts`, `preview/languages/dpl/DplPreviewRenderer.ts`, `preview/languages/ipl/IplPreviewRenderer.ts`, `preview/languages/sbpl/SbplPreviewRenderer.ts`
- Test: `language/dpl/__tests__/DplCompiler.test.ts`, `language/dpl/__tests__/DplFontMetrics.test.ts` (mới), `language/ipl/__tests__/IplCompiler.test.ts`, `language/ipl/__tests__/IplFontMetrics.test.ts` (mới), `language/sbpl/__tests__/SbplCompiler.test.ts`, `language/sbpl/__tests__/SbplFontMetrics.test.ts` (mới), `preview/__tests__/PreviewRenderer.test.ts`, `preview/languages/dpl/__tests__/DplPreviewRenderer.test.ts`, `preview/languages/ipl/__tests__/IplPreviewRenderer.test.ts`, `preview/languages/sbpl/__tests__/SbplPreviewRenderer.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `CompileWarnings.unsupportedCut` (Task 4).
- Produces:
  - `language/MagnifiedFont.ts` (Task 8, 9 dùng lại):
    - `interface MagnifiedFont { readonly baseHeightDots: number; readonly maxMagnification: number }`
    - `chooseMagnification(fontSizeDots: number | undefined, font: MagnifiedFont): number`:
      - Làm tròn gần nhất (.5 lên), kẹp `1..maxMagnification`.
      - `undefined` → 1.
    - `magnifiedHeight(magnification, font): number`
  - `DplFontMetrics` (font `'9'`, gốc 12 dots, tối đa 9) và `SbplFontMetrics` (gốc 12 dots, tối đa 12):
    - `fontSizeToMagnification(fontSizeDots: number | undefined): number`
    - `magnificationToFontSize(magnification: number): number`
  - `IplFontMetrics`:
    - `interface IplNativeFont { heightDots; widthDots }`
    - `fontSizeToNative(fontSizeDots: number | undefined): IplNativeFont` — làm tròn, tối thiểu 1, mặc định 12.
    - `nativeToFontSize(heightDots): number`
  - `preview/PreviewRenderer.ts`:
    - `type FontHeightResolver = (fontSizeDots: number | undefined) => number`
    - `renderPreview(document, fontHeight: FontHeightResolver): string`
  - DPL/SBPL/IPL compiler:
    - Cảnh báo diagonal, circle, ellipse, reverse, erase, barcode, qrcode.
    - Cảnh báo cut qua `unsupportedCut`.
    - `compileTextField` của IPL xuống dòng từng tham số.
  - Parser DPL/SBPL/IPL không đổi (trước đây không dựng cỡ chữ).

- [ ] **Step 1: Áp patch test**

Patch test làm các việc sau:
- Thêm 3 file test metrics.
- Test compiler cho `fontSize` và cảnh báo (gồm cut `off`); SBPL đổi `size: 2` → `fontSize: 24`.
- Test preview dùng chung đổi sang truyền resolver.
- Test preview DPL/SBPL/IPL kiểm `font-size` đúng chiều cao in thật (fontSize 30 → 36 ở DPL/SBPL vì làm tròn lên hệ số 3; IPL giữ 30).

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t7-test | git apply --ignore-whitespace -
```

<!-- patch:t7-test -->
~~~diff
diff --git a/packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts b/packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts
index efe94d3..64d0534 100644
--- a/packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts
+++ b/packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts
@@ -221,4 +221,56 @@ describe('DplCompiler', () => {
 
     expect(noOpOutput).toBe(emptyOutput);
   });
+
+  it('fontSize 24 → font 9 phóng đại 2 lần ở cả trường cao và rộng', () => {
+    const { output } = new DplCompiler().compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hi', options: { x: 5, y: 5, fontSize: 24 } }],
+    });
+
+    expect(output).toContain('1' + '0005' + '0005' + '0002' + '0002' + '000' + '9' + 'Hi');
+  });
+  it('cảnh báo từng loại element DPL không có lệnh, mỗi loại 1 lần', () => {
+    const { warnings } = new DplCompiler().compile({
+      ...baseDoc,
+      elements: [
+        { type: 'diagonal', options: { x1: 0, y1: 0, x2: 10, y2: 10 } },
+        { type: 'circle', options: { x: 0, y: 0, diameter: 20 } },
+        { type: 'circle', options: { x: 5, y: 5, diameter: 20 } },
+        { type: 'ellipse', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'reverse', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'erase', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'cut', options: { mode: 'full' } },
+        { type: 'barcode', options: { x: 0, y: 0, symbology: 'code128', content: '123' } },
+        { type: 'qrcode', options: { x: 0, y: 0, content: 'hi' } },
+      ],
+    });
+
+    expect(warnings).toEqual(
+      ['diagonal', 'circle', 'ellipse', 'reverse', 'erase', 'cut', 'barcode', 'qrcode'].map(
+        (type) => `Element "${type}" bị bỏ qua — DPL không có lệnh tương ứng.`,
+      ),
+    );
+  });
+
+  it('element được hỗ trợ thì không có cảnh báo', () => {
+    const { warnings } = new DplCompiler().compile({
+      ...baseDoc,
+      elements: [
+        { type: 'text', content: 'Hi', options: { fontSize: 24 } },
+        { type: 'box', options: { x: 0, y: 0, width: 10, height: 10 } },
+      ],
+    });
+
+    expect(warnings).toEqual([]);
+  });
+
+  it('cut tắt (mode off) không cần lệnh cắt nên không cảnh báo', () => {
+    const { warnings } = new DplCompiler().compile({
+      ...baseDoc,
+      elements: [{ type: 'cut', options: { mode: 'off' } }],
+    });
+
+    expect(warnings).toEqual([]);
+  });
 });
diff --git a/packages/printer-core/src/language/dpl/__tests__/DplFontMetrics.test.ts b/packages/printer-core/src/language/dpl/__tests__/DplFontMetrics.test.ts
new file mode 100644
index 0000000..487bb26
--- /dev/null
+++ b/packages/printer-core/src/language/dpl/__tests__/DplFontMetrics.test.ts
@@ -0,0 +1,21 @@
+import { DplFontMetrics } from '..';
+
+describe('DplFontMetrics', () => {
+  it('không khai báo cỡ chữ thì dùng hệ số 1', () => {
+    expect(DplFontMetrics.fontSizeToMagnification(undefined)).toBe(1);
+  });
+
+  it('làm tròn theo bậc 12 dots, kẹp trong 1..9', () => {
+    expect(DplFontMetrics.fontSizeToMagnification(1)).toBe(1);
+    expect(DplFontMetrics.fontSizeToMagnification(25)).toBe(2);
+    expect(DplFontMetrics.fontSizeToMagnification(10000)).toBe(9);
+  });
+
+  it('round-trip: chiều cao đọc ngược bằng cỡ chữ là bội số 12 dots', () => {
+    for (const fontSizeDots of [12, 24, 36, 48]) {
+      const magnification = DplFontMetrics.fontSizeToMagnification(fontSizeDots);
+
+      expect(DplFontMetrics.magnificationToFontSize(magnification)).toBe(fontSizeDots);
+    }
+  });
+});
diff --git a/packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts b/packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts
index c88faf5..f9f00a7 100644
--- a/packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts
+++ b/packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts
@@ -242,4 +242,56 @@ describe('IplCompiler', () => {
     // confirming no stray bytes leak between payload and frame close.
     expect(output.slice(headerIndex + header.length + 3, headerIndex + header.length + 4)).toBe('\x03');
   });
+
+  it('fontSize 30 → clause h30 và w30 tính bằng dots', () => {
+    const { output } = new IplCompiler().compile({
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hi', options: { x: 5, y: 5, fontSize: 30 } }],
+    });
+
+    expect(output).toContain(';h30;w30;');
+  });
+  it('cảnh báo từng loại element IPL không có lệnh, mỗi loại 1 lần', () => {
+    const { warnings } = new IplCompiler().compile({
+      ...baseDoc,
+      elements: [
+        { type: 'diagonal', options: { x1: 0, y1: 0, x2: 10, y2: 10 } },
+        { type: 'circle', options: { x: 0, y: 0, diameter: 20 } },
+        { type: 'circle', options: { x: 5, y: 5, diameter: 20 } },
+        { type: 'ellipse', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'reverse', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'erase', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'cut', options: { mode: 'full' } },
+        { type: 'barcode', options: { x: 0, y: 0, symbology: 'code128', content: '123' } },
+        { type: 'qrcode', options: { x: 0, y: 0, content: 'hi' } },
+      ],
+    });
+
+    expect(warnings).toEqual(
+      ['diagonal', 'circle', 'ellipse', 'reverse', 'erase', 'cut', 'barcode', 'qrcode'].map(
+        (type) => `Element "${type}" bị bỏ qua — IPL không có lệnh tương ứng.`,
+      ),
+    );
+  });
+
+  it('element được hỗ trợ thì không có cảnh báo', () => {
+    const { warnings } = new IplCompiler().compile({
+      ...baseDoc,
+      elements: [
+        { type: 'text', content: 'Hi', options: { fontSize: 24 } },
+        { type: 'box', options: { x: 0, y: 0, width: 10, height: 10 } },
+      ],
+    });
+
+    expect(warnings).toEqual([]);
+  });
+
+  it('cut tắt (mode off) không cần lệnh cắt nên không cảnh báo', () => {
+    const { warnings } = new IplCompiler().compile({
+      ...baseDoc,
+      elements: [{ type: 'cut', options: { mode: 'off' } }],
+    });
+
+    expect(warnings).toEqual([]);
+  });
 });
diff --git a/packages/printer-core/src/language/ipl/__tests__/IplFontMetrics.test.ts b/packages/printer-core/src/language/ipl/__tests__/IplFontMetrics.test.ts
new file mode 100644
index 0000000..dc22183
--- /dev/null
+++ b/packages/printer-core/src/language/ipl/__tests__/IplFontMetrics.test.ts
@@ -0,0 +1,16 @@
+import { IplFontMetrics } from '..';
+
+describe('IplFontMetrics', () => {
+  it('không khai báo cỡ chữ thì dùng 12 dots', () => {
+    expect(IplFontMetrics.fontSizeToNative(undefined)).toEqual({ heightDots: 12, widthDots: 12 });
+  });
+
+  it('cỡ chữ đi thẳng thành clause h/w dots, làm tròn, tối thiểu 1', () => {
+    expect(IplFontMetrics.fontSizeToNative(24.6)).toEqual({ heightDots: 25, widthDots: 25 });
+    expect(IplFontMetrics.fontSizeToNative(0.1)).toEqual({ heightDots: 1, widthDots: 1 });
+  });
+
+  it('round-trip: chiều cao đọc ngược bằng cỡ chữ nguyên ban đầu', () => {
+    expect(IplFontMetrics.nativeToFontSize(IplFontMetrics.fontSizeToNative(30).heightDots)).toBe(30);
+  });
+});
diff --git a/packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts b/packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts
index eda8dd6..c005492 100644
--- a/packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts
+++ b/packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts
@@ -26,7 +26,7 @@ describe('SbplCompiler', () => {
     const compiler = new SbplCompiler();
     const output = compiler.compile({
       ...baseDoc,
-      elements: [{ type: 'text', content: 'Hello SATO', options: { x: 100, y: 50, size: 2 } }],
+      elements: [{ type: 'text', content: 'Hello SATO', options: { x: 100, y: 50, fontSize: 24 } }],
     }).output;
 
     expect(output).toContain('\x1bH0100');
@@ -234,4 +234,48 @@ describe('SbplCompiler', () => {
 
     expect(noOpOutput).toBe(emptyOutput);
   });
+
+  it('cảnh báo từng loại element SBPL không có lệnh, mỗi loại 1 lần', () => {
+    const { warnings } = new SbplCompiler().compile({
+      ...baseDoc,
+      elements: [
+        { type: 'diagonal', options: { x1: 0, y1: 0, x2: 10, y2: 10 } },
+        { type: 'circle', options: { x: 0, y: 0, diameter: 20 } },
+        { type: 'circle', options: { x: 5, y: 5, diameter: 20 } },
+        { type: 'ellipse', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'reverse', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'erase', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'cut', options: { mode: 'full' } },
+        { type: 'barcode', options: { x: 0, y: 0, symbology: 'code128', content: '123' } },
+        { type: 'qrcode', options: { x: 0, y: 0, content: 'hi' } },
+      ],
+    });
+
+    expect(warnings).toEqual(
+      ['diagonal', 'circle', 'ellipse', 'reverse', 'erase', 'cut', 'barcode', 'qrcode'].map(
+        (type) => `Element "${type}" bị bỏ qua — SBPL không có lệnh tương ứng.`,
+      ),
+    );
+  });
+
+  it('element được hỗ trợ thì không có cảnh báo', () => {
+    const { warnings } = new SbplCompiler().compile({
+      ...baseDoc,
+      elements: [
+        { type: 'text', content: 'Hi', options: { fontSize: 24 } },
+        { type: 'box', options: { x: 0, y: 0, width: 10, height: 10 } },
+      ],
+    });
+
+    expect(warnings).toEqual([]);
+  });
+
+  it('cut tắt (mode off) không cần lệnh cắt nên không cảnh báo', () => {
+    const { warnings } = new SbplCompiler().compile({
+      ...baseDoc,
+      elements: [{ type: 'cut', options: { mode: 'off' } }],
+    });
+
+    expect(warnings).toEqual([]);
+  });
 });
diff --git a/packages/printer-core/src/language/sbpl/__tests__/SbplFontMetrics.test.ts b/packages/printer-core/src/language/sbpl/__tests__/SbplFontMetrics.test.ts
new file mode 100644
index 0000000..55ef308
--- /dev/null
+++ b/packages/printer-core/src/language/sbpl/__tests__/SbplFontMetrics.test.ts
@@ -0,0 +1,21 @@
+import { SbplFontMetrics } from '..';
+
+describe('SbplFontMetrics', () => {
+  it('không khai báo cỡ chữ thì dùng hệ số 1', () => {
+    expect(SbplFontMetrics.fontSizeToMagnification(undefined)).toBe(1);
+  });
+
+  it('làm tròn theo bậc 12 dots, kẹp trong 1..12', () => {
+    expect(SbplFontMetrics.fontSizeToMagnification(1)).toBe(1);
+    expect(SbplFontMetrics.fontSizeToMagnification(25)).toBe(2);
+    expect(SbplFontMetrics.fontSizeToMagnification(10000)).toBe(12);
+  });
+
+  it('round-trip: chiều cao đọc ngược bằng cỡ chữ là bội số 12 dots', () => {
+    for (const fontSizeDots of [12, 24, 36, 48]) {
+      const magnification = SbplFontMetrics.fontSizeToMagnification(fontSizeDots);
+
+      expect(SbplFontMetrics.magnificationToFontSize(magnification)).toBe(fontSizeDots);
+    }
+  });
+});
diff --git a/packages/printer-core/src/preview/__tests__/PreviewRenderer.test.ts b/packages/printer-core/src/preview/__tests__/PreviewRenderer.test.ts
index 0592a6a..28dea6a 100644
--- a/packages/printer-core/src/preview/__tests__/PreviewRenderer.test.ts
+++ b/packages/printer-core/src/preview/__tests__/PreviewRenderer.test.ts
@@ -13,9 +13,30 @@ const baseDoc: Omit<ResolvedPrintDocument, 'elements'> = {
   copies: 1,
 };
 
+/** Chiều cao chữ cố định cho các test không kiểm tra cỡ chữ. */
+const TEST_FONT_HEIGHT = 12;
+
+function render(document: ResolvedPrintDocument): string {
+  return renderPreview(document, () => TEST_FONT_HEIGHT);
+}
+
 describe('renderPreview (shared default SVG renderer)', () => {
+  it('lấy chiều cao chữ từ resolver của ngôn ngữ, truyền vào fontSize của element', () => {
+    const received: Array<number | undefined> = [];
+    const svg = renderPreview(
+      { ...baseDoc, elements: [{ type: 'text', content: 'Hi', options: { x: 0, y: 0, fontSize: 30 } }] },
+      (fontSizeDots) => {
+        received.push(fontSizeDots);
+        return 36;
+      },
+    );
+
+    expect(received).toEqual([30]);
+    expect(svg).toContain('font-size="36"');
+  });
+
   it('renders an SVG wrapper sized from the document dots, with a dots/DPI caption', () => {
-    const svg = renderPreview({ ...baseDoc, elements: [] });
+    const svg = render({ ...baseDoc, elements: [] });
 
     expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
     expect(svg).toContain('width="340"'); // 320 + 2*10 padding
@@ -23,26 +44,32 @@ describe('renderPreview (shared default SVG renderer)', () => {
   });
 
   it('renders a text element as an SVG <text>, escaping markup-significant characters', () => {
-    const svg = renderPreview({ ...baseDoc, elements: [{ type: 'text', content: 'A & B < C', options: { x: 5, y: 5 } }] });
+    const svg = render({ ...baseDoc, elements: [{ type: 'text', content: 'A & B < C', options: { x: 5, y: 5 } }] });
 
     expect(svg).toContain('<text x="5"');
     expect(svg).toContain('A &amp; B &lt; C');
   });
 
   it('renders a box element as an SVG <rect>', () => {
-    const svg = renderPreview({ ...baseDoc, elements: [{ type: 'box', options: { x: 0, y: 0, width: 20, height: 20, thickness: 20 } }] });
+    const svg = render({
+      ...baseDoc,
+      elements: [{ type: 'box', options: { x: 0, y: 0, width: 20, height: 20, thickness: 20 } }],
+    });
 
     expect(svg).toContain('<rect x="0" y="0" width="20" height="20" fill="#000"');
   });
 
   it('renders a genuinely diagonal line element as an SVG <line>', () => {
-    const svg = renderPreview({ ...baseDoc, elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }] });
+    const svg = render({
+      ...baseDoc,
+      elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }],
+    });
 
     expect(svg).toContain('<line x1="0" y1="0" x2="100" y2="50" stroke="#000" stroke-width="2"/>');
   });
 
   it('renders a table element into stacked <text> rows carrying its cell content', () => {
-    const svg = renderPreview({
+    const svg = render({
       ...baseDoc,
       elements: [
         {
@@ -68,7 +95,7 @@ describe('renderPreview (shared default SVG renderer)', () => {
 
   it('throws a clear error when a table column has a non-positive width instead of silently dropping its content', () => {
     expect(() =>
-      renderPreview({
+      render({
         ...baseDoc,
         elements: [{ type: 'table', options: { x: 0, y: 0, columns: [{ width: 10 }, { width: 0 }], rows: [['a', 'b']] } }],
       }),
@@ -76,7 +103,7 @@ describe('renderPreview (shared default SVG renderer)', () => {
   });
 
   it('produces identical output for pageBreak/spacer/row/column/cut no-ops vs. an empty-elements baseline', () => {
-    const emptySvg = renderPreview({ ...baseDoc, elements: [] });
+    const emptySvg = render({ ...baseDoc, elements: [] });
 
     const noOpElements: PrintElement[] = [
       { type: 'pageBreak' },
@@ -86,27 +113,27 @@ describe('renderPreview (shared default SVG renderer)', () => {
       { type: 'cut', options: { mode: 'full' } },
     ];
     for (const el of noOpElements) {
-      const svg = renderPreview({ ...baseDoc, elements: [el] });
+      const svg = render({ ...baseDoc, elements: [el] });
       expect(svg).toBe(emptySvg);
     }
   });
 
   it('produces identical output for barcode/qrcode no-ops vs. an empty-elements baseline, matching the absence of any barcode/QR rendering in portakal\'s shared preview', () => {
-    const emptySvg = renderPreview({ ...baseDoc, elements: [] });
+    const emptySvg = render({ ...baseDoc, elements: [] });
 
     const noOpElements: PrintElement[] = [
       { type: 'barcode', options: { x: 0, y: 0, symbology: 'code128', content: '123' } },
       { type: 'qrcode', options: { x: 0, y: 0, content: 'hi' } },
     ];
     for (const el of noOpElements) {
-      const svg = renderPreview({ ...baseDoc, elements: [el] });
+      const svg = render({ ...baseDoc, elements: [el] });
       expect(svg).toBe(emptySvg);
     }
   });
 
   it('previews an image element without throwing', () => {
     expect(() =>
-      renderPreview({
+      render({
         ...baseDoc,
         elements: [{ type: 'image', bitmap: { data: new Uint8Array([0xff]), width: 8, height: 1, bytesPerRow: 1 } }],
       }),
diff --git a/packages/printer-core/src/preview/languages/dpl/__tests__/DplPreviewRenderer.test.ts b/packages/printer-core/src/preview/languages/dpl/__tests__/DplPreviewRenderer.test.ts
index de16474..84c5bd6 100644
--- a/packages/printer-core/src/preview/languages/dpl/__tests__/DplPreviewRenderer.test.ts
+++ b/packages/printer-core/src/preview/languages/dpl/__tests__/DplPreviewRenderer.test.ts
@@ -1,5 +1,4 @@
 import { DplPreviewRenderer } from '../DplPreviewRenderer';
-import { renderPreview } from '../../../PreviewRenderer';
 import type { ResolvedPrintDocument } from '../../../../document';
 
 const baseDoc: ResolvedPrintDocument = {
@@ -15,10 +14,15 @@ const baseDoc: ResolvedPrintDocument = {
 };
 
 describe('DplPreviewRenderer', () => {
-  it('delegates straight to the shared renderPreview(), with no DPL-specific customization', () => {
-    const svg = new DplPreviewRenderer().preview(baseDoc);
+  it('vẽ chữ với chiều cao DPL thật in ra cho fontSize 30 (làm tròn lên hệ số 3)', () => {
+    const doc: ResolvedPrintDocument = {
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hi', options: { x: 5, y: 5, fontSize: 30 } }],
+    };
+
+    const svg = new DplPreviewRenderer().preview(doc);
 
-    expect(svg).toBe(renderPreview(baseDoc));
+    expect(svg).toContain('font-size="36"');
   });
 
   it('renders a non-empty SVG containing the text content', () => {
diff --git a/packages/printer-core/src/preview/languages/ipl/__tests__/IplPreviewRenderer.test.ts b/packages/printer-core/src/preview/languages/ipl/__tests__/IplPreviewRenderer.test.ts
index 8330fe8..95a8ad2 100644
--- a/packages/printer-core/src/preview/languages/ipl/__tests__/IplPreviewRenderer.test.ts
+++ b/packages/printer-core/src/preview/languages/ipl/__tests__/IplPreviewRenderer.test.ts
@@ -1,5 +1,4 @@
 import { IplPreviewRenderer } from '../IplPreviewRenderer';
-import { renderPreview } from '../../../PreviewRenderer';
 import type { ResolvedPrintDocument } from '../../../../document';
 
 const baseDoc: ResolvedPrintDocument = {
@@ -15,10 +14,15 @@ const baseDoc: ResolvedPrintDocument = {
 };
 
 describe('IplPreviewRenderer', () => {
-  it('delegates straight to the shared renderPreview(), with no IPL-specific customization', () => {
-    const svg = new IplPreviewRenderer().preview(baseDoc);
+  it('vẽ chữ với chiều cao IPL thật in ra cho fontSize 30', () => {
+    const doc: ResolvedPrintDocument = {
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hi', options: { x: 5, y: 5, fontSize: 30 } }],
+    };
+
+    const svg = new IplPreviewRenderer().preview(doc);
 
-    expect(svg).toBe(renderPreview(baseDoc));
+    expect(svg).toContain('font-size="30"');
   });
 
   it('renders a non-empty SVG containing the text content', () => {
diff --git a/packages/printer-core/src/preview/languages/sbpl/__tests__/SbplPreviewRenderer.test.ts b/packages/printer-core/src/preview/languages/sbpl/__tests__/SbplPreviewRenderer.test.ts
index ac8e044..6f2d81e 100644
--- a/packages/printer-core/src/preview/languages/sbpl/__tests__/SbplPreviewRenderer.test.ts
+++ b/packages/printer-core/src/preview/languages/sbpl/__tests__/SbplPreviewRenderer.test.ts
@@ -1,5 +1,4 @@
 import { SbplPreviewRenderer } from '../SbplPreviewRenderer';
-import { renderPreview } from '../../../PreviewRenderer';
 import type { ResolvedPrintDocument } from '../../../../document';
 
 const baseDoc: ResolvedPrintDocument = {
@@ -15,10 +14,15 @@ const baseDoc: ResolvedPrintDocument = {
 };
 
 describe('SbplPreviewRenderer', () => {
-  it('delegates straight to the shared renderPreview(), with no SBPL-specific customization', () => {
-    const svg = new SbplPreviewRenderer().preview(baseDoc);
+  it('vẽ chữ với chiều cao SBPL thật in ra cho fontSize 30 (làm tròn lên hệ số 3)', () => {
+    const doc: ResolvedPrintDocument = {
+      ...baseDoc,
+      elements: [{ type: 'text', content: 'Hi', options: { x: 5, y: 5, fontSize: 30 } }],
+    };
+
+    const svg = new SbplPreviewRenderer().preview(doc);
 
-    expect(svg).toBe(renderPreview(baseDoc));
+    expect(svg).toContain('font-size="36"');
   });
 
   it('renders a non-empty SVG containing the text content', () => {
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts packages/printer-core/src/language/dpl/__tests__/DplFontMetrics.test.ts packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts packages/printer-core/src/language/ipl/__tests__/IplFontMetrics.test.ts packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts packages/printer-core/src/language/sbpl/__tests__/SbplFontMetrics.test.ts packages/printer-core/src/preview/__tests__/PreviewRenderer.test.ts packages/printer-core/src/preview/languages/dpl/__tests__/DplPreviewRenderer.test.ts packages/printer-core/src/preview/languages/ipl/__tests__/IplPreviewRenderer.test.ts packages/printer-core/src/preview/languages/sbpl/__tests__/SbplPreviewRenderer.test.ts
```

Expected: FAIL — metrics chưa tồn tại; compiler chưa cảnh báo; `renderPreview` chưa nhận resolver. Lúc lập plan: `Tests: 19 failed, 66 passed, 85 total` (số đếm có thể lệch nếu suite lỗi import; điều kiện bắt buộc là có test fail).

- [ ] **Step 3: Áp patch implementation**

Patch implementation làm các việc sau:
- Thêm `MagnifiedFont.ts` và 3 file metrics.
- Chuyển 3 compiler sang metrics và bật cảnh báo.
- Đổi `renderPreview` nhận `FontHeightResolver`; 3 preview truyền chiều cao từ metrics.
- Bỏ logic `size`/`yScale`/font tỉ lệ của preview dùng chung.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t7-impl | git apply --ignore-whitespace -
```

<!-- patch:t7-impl -->
~~~diff
diff --git a/packages/printer-core/src/language/MagnifiedFont.ts b/packages/printer-core/src/language/MagnifiedFont.ts
new file mode 100644
index 0000000..f3ef86f
--- /dev/null
+++ b/packages/printer-core/src/language/MagnifiedFont.ts
@@ -0,0 +1,20 @@
+/** Font cố định của máy in chỉ đổi cỡ bằng hệ số phóng đại nguyên (không chọn được font khác). */
+export interface MagnifiedFont {
+  /** Chiều cao chữ ở hệ số 1, dots. */
+  readonly baseHeightDots: number;
+
+  /** Hệ số phóng đại lớn nhất lệnh của ngôn ngữ nhận được. */
+  readonly maxMagnification: number;
+}
+
+/** Hệ số phóng đại cho chiều cao gần `fontSizeDots` nhất; bỏ trống cỡ chữ thì dùng hệ số 1. */
+export function chooseMagnification(fontSizeDots: number | undefined, font: MagnifiedFont): number {
+  if (fontSizeDots === undefined) return 1;
+  const magnification = Math.round(fontSizeDots / font.baseHeightDots);
+  return Math.min(font.maxMagnification, Math.max(1, magnification));
+}
+
+/** Chiều cao chữ thật (dots) khi in ở `magnification`. */
+export function magnifiedHeight(magnification: number, font: MagnifiedFont): number {
+  return font.baseHeightDots * magnification;
+}
diff --git a/packages/printer-core/src/language/dpl/DplCompiler.ts b/packages/printer-core/src/language/dpl/DplCompiler.ts
index bef7eda..32fab6a 100644
--- a/packages/printer-core/src/language/dpl/DplCompiler.ts
+++ b/packages/printer-core/src/language/dpl/DplCompiler.ts
@@ -9,10 +9,15 @@ import type {
 } from '../../document/elements';
 import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import type { Rotation, Bitmap } from '../../types';
+import { CompileWarnings } from '../CompileWarnings';
 import { DPL_COMMAND } from './DplCommand';
 import { encodeDplBitmapPayload } from './DplEncoder';
+import { DplFontMetrics } from './DplFontMetrics';
 import { formatTable, validateTableColumns } from '../../formatting';
 
+/** Tên ngôn ngữ trong câu cảnh báo. */
+const DPL_LANGUAGE_NAME = 'DPL';
+
 /**
  * Độ rộng cố định (số chữ số, đệm số 0 bên trái) của phần lớn trường số
  * trong bản ghi DPL.
@@ -40,7 +45,8 @@ const IMAGE_RECORD_TYPE_FIELD = '0005';
 /** Trường mẫu (pattern) cố định của bản ghi Line — bản ghi Box không có trường này. */
 const LINE_RECORD_PATTERN_FIELD = '0002';
 
-const DEFAULT_FONT = '9';
+/** Font duy nhất compiler dùng; cỡ chữ đạt được bằng hệ số phóng đại, xem `DplFontMetrics`. */
+const TEXT_FONT = '9';
 
 /**
  * Mã xoay bản ghi (`1`-`4`, chữ số đầu của bản ghi text/box/line) ứng với
@@ -64,12 +70,12 @@ function compileTextElement(content: string, options: TextOptions | undefined):
   const x = resolvedOptions.x ?? 0;
   const y = resolvedOptions.y ?? 0;
   const rotationCode = dplRotation(resolvedOptions.rotation);
-  const font = resolvedOptions.font ?? DEFAULT_FONT;
-  const heightField = String(resolvedOptions.size ?? 1).padStart(FIELD_WIDTH, '0');
+  const magnification = DplFontMetrics.fontSizeToMagnification(resolvedOptions.fontSize);
+  const heightField = String(magnification).padStart(FIELD_WIDTH, '0');
   const widthField = heightField;
   const col = String(x).padStart(FIELD_WIDTH, '0');
   const row = String(y).padStart(FIELD_WIDTH, '0');
-  return `${rotationCode}${col}${row}${heightField}${widthField}${TEXT_RECORD_RESERVED_FIELD}${font}${content}`;
+  return `${rotationCode}${col}${row}${heightField}${widthField}${TEXT_RECORD_RESERVED_FIELD}${TEXT_FONT}${content}`;
 }
 
 function compileImageElement(bitmap: Bitmap, options: ImageOptions | undefined): string {
@@ -144,7 +150,7 @@ function compileTableElement(options: TableOptions): string {
     .join('\r\n');
 }
 
-function compileElement(element: PrintElement): string {
+function compileElement(element: PrintElement, warnings: CompileWarnings): string {
   switch (element.type) {
     case 'text':
       return compileTextElement(element.content, element.options);
@@ -158,26 +164,25 @@ function compileElement(element: PrintElement): string {
     case 'line':
       return compileLineElement(element.options);
 
-    // DPL không có lệnh vẽ chéo — no-op có chủ đích, không phải case bị thiếu.
+    // DPL không có lệnh vẽ chéo, circle/ellipse/reverse-fill/erase, cắt giấy; cũng chưa có tài liệu đáng tin
+    // cho cú pháp Bar Code Field — bỏ qua và báo cảnh báo thay vì bịa cú pháp bản ghi mới.
     case 'diagonal':
-      return '';
-
-    // DPL không có lệnh gốc cho circle/ellipse/reverse-fill/erase — no-op có
-    // chủ đích thay vì bịa cú pháp bản ghi mới cho chúng.
     case 'circle':
     case 'ellipse':
     case 'reverse':
     case 'erase':
+    case 'barcode':
+    case 'qrcode':
+      warnings.unsupportedElement(element.type);
       return '';
 
-    case 'raw':
-      return typeof element.content === 'string' ? element.content : '';
-
-    // Không có lệnh cắt giấy nào được ghi nhận trong giao thức DPL — no-op
-    // có chủ đích.
     case 'cut':
+      warnings.unsupportedCut(element.options);
       return '';
 
+    case 'raw':
+      return typeof element.content === 'string' ? element.content : '';
+
     case 'table':
       return compileTableElement(element.options);
 
@@ -188,18 +193,13 @@ function compileElement(element: PrintElement): string {
     case 'row':
     case 'column':
       return '';
-
-    // Không có tài liệu tham chiếu đáng tin cậy nào cho cú pháp Bar Code
-    // Field của DPL — no-op có chủ đích thay vì suy đoán cấu trúc bản ghi.
-    case 'barcode':
-    case 'qrcode':
-      return '';
   }
 }
 
-/** Biên dịch một `ResolvedPrintDocument` thành chuỗi lệnh DPL của Honeywell/Datamax. */
-export function compileToDPL(document: ResolvedPrintDocument): string {
+/** Biên dịch một `ResolvedPrintDocument` thành chuỗi lệnh DPL của Honeywell/Datamax kèm cảnh báo. */
+export function compileToDPL(document: ResolvedPrintDocument): CompileResult<string> {
   const lines: string[] = [];
+  const warnings = new CompileWarnings(DPL_LANGUAGE_NAME);
 
   lines.push(DPL_COMMAND.ENTER_LABEL_FORMAT);
   lines.push(`${DPL_COMMAND.DENSITY}${String(document.density).padStart(DENSITY_SPEED_FIELD_WIDTH, '0')}`);
@@ -209,13 +209,13 @@ export function compileToDPL(document: ResolvedPrintDocument): string {
   for (const element of document.elements) {
     // Bỏ qua phần tử biên dịch ra `''` (no-op hoặc `raw` rỗng) để tránh dòng
     // trống thừa khi nối bằng `\r\n`.
-    const line = compileElement(element);
+    const line = compileElement(element, warnings);
     if (line) lines.push(line);
   }
 
   lines.push(`${DPL_COMMAND.QUANTITY}${String(document.copies).padStart(FIELD_WIDTH, '0')}`);
   lines.push(DPL_COMMAND.END);
-  return lines.join('\r\n') + '\r\n';
+  return { output: lines.join('\r\n') + '\r\n', warnings: warnings.toArray() };
 }
 
 /**
@@ -230,6 +230,6 @@ export function compileToDPL(document: ResolvedPrintDocument): string {
  */
 export class DplCompiler implements PrintCompiler<string> {
   compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
-    return { output: compileToDPL(document), warnings: [] };
+    return compileToDPL(document);
   }
 }
diff --git a/packages/printer-core/src/language/dpl/DplFontMetrics.ts b/packages/printer-core/src/language/dpl/DplFontMetrics.ts
new file mode 100644
index 0000000..c594a36
--- /dev/null
+++ b/packages/printer-core/src/language/dpl/DplFontMetrics.ts
@@ -0,0 +1,17 @@
+import { chooseMagnification, magnifiedHeight, type MagnifiedFont } from '../MagnifiedFont';
+
+/** Font `9` của DPL, phóng đại qua 2 trường chiều cao/rộng của bản ghi text (1-9). */
+const DPL_FONT: MagnifiedFont = { baseHeightDots: 12, maxMagnification: 9 };
+
+/** Quy đổi cỡ chữ (dots) ↔ hệ số phóng đại của bản ghi text DPL — nguồn font duy nhất của DPL. */
+export const DplFontMetrics = {
+  /** Hệ số phóng đại gần cỡ chữ nhất; bỏ trống cỡ chữ thì dùng hệ số 1. */
+  fontSizeToMagnification(fontSizeDots: number | undefined): number {
+    return chooseMagnification(fontSizeDots, DPL_FONT);
+  },
+
+  /** Chiều cao chữ thật (dots) ở 1 hệ số phóng đại. */
+  magnificationToFontSize(magnification: number): number {
+    return magnifiedHeight(magnification, DPL_FONT);
+  },
+};
diff --git a/packages/printer-core/src/language/dpl/index.ts b/packages/printer-core/src/language/dpl/index.ts
index 2dbece0..d48fef6 100644
--- a/packages/printer-core/src/language/dpl/index.ts
+++ b/packages/printer-core/src/language/dpl/index.ts
@@ -2,3 +2,4 @@ export * from './DplCompiler';
 export * from './DplCommand';
 export * from './DplEncoder';
 export * from './DplParser';
+export * from './DplFontMetrics';
diff --git a/packages/printer-core/src/language/ipl/IplCompiler.ts b/packages/printer-core/src/language/ipl/IplCompiler.ts
index 376b4a2..07d8c57 100644
--- a/packages/printer-core/src/language/ipl/IplCompiler.ts
+++ b/packages/printer-core/src/language/ipl/IplCompiler.ts
@@ -9,14 +9,16 @@ import type {
 } from '../../document/elements';
 import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import type { Bitmap, Rotation } from '../../types';
+import { CompileWarnings } from '../CompileWarnings';
 import { IPL_COMMAND } from './IplCommand';
 import { encodeIplBitmapPayload } from './IplEncoder';
+import { IplFontMetrics } from './IplFontMetrics';
 import { formatTable, validateTableColumns } from '../../formatting';
 
 const { STX, ETX, ESC } = IPL_COMMAND;
 
-/** Hệ số quy đổi `size` sang dots, dùng cho cả clause `h` và `w` của field `H` (không hỗ trợ chọn font tường minh). */
-const FONT_SIZE_UNIT_DOTS = 12;
+/** Tên ngôn ngữ trong câu cảnh báo. */
+const IPL_LANGUAGE_NAME = 'IPL';
 
 /** Font id cố định trong clause `d` của field `H` — không hỗ trợ chọn font khác. */
 const TEXT_FONT_ID = 3;
@@ -60,14 +62,18 @@ function iplRotation(rotation: Rotation | undefined): 0 | 1 | 2 | 3 {
   }
 }
 
-function compileTextField(fieldNum: number, content: string, options: TextOptions | undefined): string {
+function compileTextField(
+  fieldNum: number,
+  content: string,
+  options: TextOptions | undefined,
+): string {
   const resolvedOptions = options ?? {};
   const x = resolvedOptions.x ?? 0;
   const y = resolvedOptions.y ?? 0;
   const rotationCode = iplRotation(resolvedOptions.rotation);
-  const size = (resolvedOptions.size ?? 1) * FONT_SIZE_UNIT_DOTS;
+  const { heightDots, widthDots } = IplFontMetrics.fontSizeToNative(resolvedOptions.fontSize);
   return (
-    `${STX}${IPL_COMMAND.FIELD_TEXT}${fieldNum};o${x},${y};f${rotationCode};h${size};w${size};` +
+    `${STX}${IPL_COMMAND.FIELD_TEXT}${fieldNum};o${x},${y};f${rotationCode};h${heightDots};w${widthDots};` +
     `c${TEXT_CHARSET_ID};d${TEXT_FONT_ID},${content}${ETX}`
   );
 }
@@ -140,7 +146,11 @@ function compileTableElement(options: TableOptions, nextFieldNum: () => number):
     .join('\r\n');
 }
 
-function compileElement(element: PrintElement, nextFieldNum: () => number): string {
+function compileElement(
+  element: PrintElement,
+  nextFieldNum: () => number,
+  warnings: CompileWarnings,
+): string {
   switch (element.type) {
     case 'text':
       return compileTextField(nextFieldNum(), element.content, element.options);
@@ -154,25 +164,25 @@ function compileElement(element: PrintElement, nextFieldNum: () => number): stri
     case 'line':
       return compileLineElement(nextFieldNum(), element.options);
 
-    // Field Line của IPL không hỗ trợ vẽ chéo — no-op có chủ đích.
+    // Field Line của IPL không vẽ chéo; IPL không có lệnh circle/ellipse/reverse/erase hay cutter; không đủ
+    // tài liệu đáng tin cho cấu trúc record barcode — bỏ qua và báo cảnh báo thay vì bịa cú pháp field.
     case 'diagonal':
-      return '';
-
-    // IPL không có lệnh gốc cho circle/ellipse/reverse/erase — no-op có chủ
-    // đích, không tự bịa cú pháp field mới.
     case 'circle':
     case 'ellipse':
     case 'reverse':
     case 'erase':
+    case 'barcode':
+    case 'qrcode':
+      warnings.unsupportedElement(element.type);
       return '';
 
-    case 'raw':
-      return typeof element.content === 'string' ? element.content : '';
-
-    // Không có lệnh cutter nào được ghi nhận trong tài liệu IPL — no-op có chủ đích.
     case 'cut':
+      warnings.unsupportedCut(element.options);
       return '';
 
+    case 'raw':
+      return typeof element.content === 'string' ? element.content : '';
+
     case 'table':
       return compileTableElement(element.options, nextFieldNum);
 
@@ -183,18 +193,13 @@ function compileElement(element: PrintElement, nextFieldNum: () => number): stri
     case 'row':
     case 'column':
       return '';
-
-    // Không đủ tài liệu IPL đáng tin cậy để xác định bảng chọn loại/cấu
-    // trúc record barcode — no-op có chủ đích thay vì tự bịa cú pháp field.
-    case 'barcode':
-    case 'qrcode':
-      return '';
   }
 }
 
-/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh IPL (Intermec/Honeywell). */
-export function compileToIPL(document: ResolvedPrintDocument): string {
+/** Compile một `ResolvedPrintDocument` thành chuỗi lệnh IPL (Intermec/Honeywell) kèm cảnh báo. */
+export function compileToIPL(document: ResolvedPrintDocument): CompileResult<string> {
   const lines: string[] = [];
+  const warnings = new CompileWarnings(IPL_LANGUAGE_NAME);
 
   lines.push(`${STX}${ESC}${IPL_COMMAND.CREATE_FORMAT}${ETX}`);
   lines.push(`${STX}${ESC}${IPL_COMMAND.PROGRAM_MODE}${ETX}`);
@@ -210,7 +215,7 @@ export function compileToIPL(document: ResolvedPrintDocument): string {
 
   for (const element of document.elements) {
     // compileElement() trả '' cho no-op — bỏ qua để tránh dòng trống thừa khi join bằng \r\n.
-    const line = compileElement(element, nextFieldNum);
+    const line = compileElement(element, nextFieldNum, warnings);
     if (line) lines.push(line);
   }
 
@@ -220,7 +225,7 @@ export function compileToIPL(document: ResolvedPrintDocument): string {
   }
   lines.push(`${STX}${ESC}${IPL_COMMAND.END_FORMAT}${ETX}`);
 
-  return lines.join('\r\n') + '\r\n';
+  return { output: lines.join('\r\n') + '\r\n', warnings: warnings.toArray() };
 }
 
 /**
@@ -233,6 +238,6 @@ export function compileToIPL(document: ResolvedPrintDocument): string {
  */
 export class IplCompiler implements PrintCompiler<string> {
   compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
-    return { output: compileToIPL(document), warnings: [] };
+    return compileToIPL(document);
   }
 }
diff --git a/packages/printer-core/src/language/ipl/IplFontMetrics.ts b/packages/printer-core/src/language/ipl/IplFontMetrics.ts
new file mode 100644
index 0000000..c50476d
--- /dev/null
+++ b/packages/printer-core/src/language/ipl/IplFontMetrics.ts
@@ -0,0 +1,31 @@
+/** Kích thước dots cho clause `h`/`w` của field text `H` IPL. */
+export interface IplNativeFont {
+  /** Chiều cao chữ, dots — clause `h`. */
+  readonly heightDots: number;
+
+  /** Độ rộng chữ, dots — clause `w`. */
+  readonly widthDots: number;
+}
+
+/** Chiều cao chữ khi element không khai báo cỡ chữ. */
+const DEFAULT_FONT_HEIGHT_DOTS = 12;
+
+/** IPL không nhận chiều cao 0. */
+const MIN_FONT_HEIGHT_DOTS = 1;
+
+/**
+ * Quy đổi cỡ chữ (dots) ↔ clause `h`/`w` của IPL — nguồn font duy nhất của IPL. Font/charset của IPL cố định,
+ * cỡ chữ đi thẳng vào clause tính bằng dots nên không cần chọn font.
+ */
+export const IplFontMetrics = {
+  /** Chiều cao = rộng = cỡ chữ (làm tròn dots); bỏ trống cỡ chữ thì dùng 12 dots. */
+  fontSizeToNative(fontSizeDots: number | undefined): IplNativeFont {
+    const heightDots = Math.max(MIN_FONT_HEIGHT_DOTS, Math.round(fontSizeDots ?? DEFAULT_FONT_HEIGHT_DOTS));
+    return { heightDots, widthDots: heightDots };
+  },
+
+  /** Cỡ chữ (dots) từ clause `h` đọc được. */
+  nativeToFontSize(heightDots: number): number {
+    return heightDots;
+  },
+};
diff --git a/packages/printer-core/src/language/ipl/index.ts b/packages/printer-core/src/language/ipl/index.ts
index aa35cbb..7ae3a59 100644
--- a/packages/printer-core/src/language/ipl/index.ts
+++ b/packages/printer-core/src/language/ipl/index.ts
@@ -2,3 +2,4 @@ export * from './IplCompiler';
 export * from './IplCommand';
 export * from './IplEncoder';
 export * from './IplParser';
+export * from './IplFontMetrics';
diff --git a/packages/printer-core/src/language/sbpl/SbplCompiler.ts b/packages/printer-core/src/language/sbpl/SbplCompiler.ts
index e5cd633..fd57198 100644
--- a/packages/printer-core/src/language/sbpl/SbplCompiler.ts
+++ b/packages/printer-core/src/language/sbpl/SbplCompiler.ts
@@ -9,10 +9,15 @@ import type {
 } from '../../document/elements';
 import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import type { Rotation } from '../../types';
+import { CompileWarnings } from '../CompileWarnings';
 import { SBPL_COMMAND } from './SbplCommand';
 import { encodeSbplBitmapPayload } from './SbplEncoder';
+import { SbplFontMetrics } from './SbplFontMetrics';
 import { formatTable, validateTableColumns } from '../../formatting';
 
+/** Tên ngôn ngữ trong câu cảnh báo. */
+const SBPL_LANGUAGE_NAME = 'SBPL';
+
 const ESC = SBPL_COMMAND.ESC;
 const SBPL_LINE_SEPARATOR = '\r\n';
 
@@ -28,8 +33,6 @@ const THICKNESS_FIELD_DIGITS = 2;
 /** Số chữ số tiền tố độ dài payload trong trường đồ hoạ (`GM`). */
 const IMAGE_SIZE_FIELD_DIGITS = 5;
 
-/** Hệ số phóng đại mặc định khi `TextOptions.size` không được set. */
-const DEFAULT_TEXT_MAGNIFICATION = 1;
 /**
  * Độ dày nét vẽ mặc định của máy in khi `thickness` không được set (áp dụng
  * cho cả box lẫn line).
@@ -66,8 +69,8 @@ function compileTextElement(content: string, options: TextOptions | undefined):
   ];
   // Rotation 0 để mặc định máy in tự xử lý, không phát `<ESC>%0` tường minh.
   if (options?.rotation) lines.push(sbplRotationCommand(options.rotation));
-  const rawMagnification = options?.size ?? DEFAULT_TEXT_MAGNIFICATION;
-  const magnification = String(rawMagnification).padStart(MAGNIFICATION_FIELD_DIGITS, '0');
+  const magnificationValue = SbplFontMetrics.fontSizeToMagnification(options?.fontSize);
+  const magnification = String(magnificationValue).padStart(MAGNIFICATION_FIELD_DIGITS, '0');
   lines.push(`${ESC}${SBPL_COMMAND.MAGNIFICATION}${magnification}${magnification}`);
   lines.push(`${ESC}${SBPL_COMMAND.TEXT}${content}`);
   return lines.join(SBPL_LINE_SEPARATOR);
@@ -140,7 +143,7 @@ function compileTableElement(element: TableElement): string {
     .join(SBPL_LINE_SEPARATOR);
 }
 
-function compileElement(element: PrintElement): string {
+function compileElement(element: PrintElement, warnings: CompileWarnings): string {
   switch (element.type) {
     case 'text':
       return compileTextElement(element.content, element.options);
@@ -154,24 +157,25 @@ function compileElement(element: PrintElement): string {
     case 'line':
       return compileLineElement(element);
 
-    // `<ESC>FW` không vẽ chéo được thật sự (chỉ axis-aligned) — no-op.
+    // `<ESC>FW` không vẽ chéo được; SBPL không có lệnh hình tròn/ellipse/reverse/erase hay cutter; cấu trúc
+    // trường barcode 1D/2D của SATO chưa được tài liệu nào xác thực — bỏ qua và báo cảnh báo.
     case 'diagonal':
-      return '';
-
-    // Không có lệnh SBPL gốc cho hình tròn, ellipse, reverse-print, hoặc erase độc lập.
     case 'circle':
     case 'ellipse':
     case 'reverse':
     case 'erase':
+    case 'barcode':
+    case 'qrcode':
+      warnings.unsupportedElement(element.type);
       return '';
 
-    case 'raw':
-      return typeof element.content === 'string' ? element.content : '';
-
-    // Không có lệnh cutter SBPL gốc.
     case 'cut':
+      warnings.unsupportedCut(element.options);
       return '';
 
+    case 'raw':
+      return typeof element.content === 'string' ? element.content : '';
+
     case 'table':
       return compileTableElement(element);
 
@@ -182,29 +186,24 @@ function compileElement(element: PrintElement): string {
     case 'row':
     case 'column':
       return '';
-
-    // Cấu trúc trường barcode 1D/2D thực tế của SATO không được xác thực bởi
-    // tài liệu nào sẵn có — no-op thay vì đoán mò bảng chọn loại/field shape.
-    case 'barcode':
-    case 'qrcode':
-      return '';
   }
 }
 
 /**
- * Compile một `ResolvedPrintDocument` thành chuỗi lệnh SBPL của SATO. Lệnh
+ * Compile một `ResolvedPrintDocument` thành chuỗi lệnh SBPL của SATO kèm cảnh báo. Lệnh
  * thiết lập phiên của SBPL không mang trường width/height/speed/density —
  * các thiết lập đó được cấu hình ở cấp máy in, ngoài phạm vi document này.
  */
-export function compileToSBPL(document: ResolvedPrintDocument): string {
+export function compileToSBPL(document: ResolvedPrintDocument): CompileResult<string> {
   const lines: string[] = [];
+  const warnings = new CompileWarnings(SBPL_LANGUAGE_NAME);
 
   lines.push(`${ESC}${SBPL_COMMAND.START}`);
   lines.push(`${ESC}${SBPL_COMMAND.CLEAR}`);
 
   for (const element of document.elements) {
     // Bỏ qua kết quả rỗng (element no-op) để không đẩy dòng trống thừa vào output.
-    const line = compileElement(element);
+    const line = compileElement(element, warnings);
     if (line) lines.push(line);
   }
 
@@ -213,7 +212,7 @@ export function compileToSBPL(document: ResolvedPrintDocument): string {
     lines.push(`${ESC}${SBPL_COMMAND.QUANTITY}${document.copies}`);
   }
   lines.push(`${ESC}${SBPL_COMMAND.END}`);
-  return lines.join(SBPL_LINE_SEPARATOR) + SBPL_LINE_SEPARATOR;
+  return { output: lines.join(SBPL_LINE_SEPARATOR) + SBPL_LINE_SEPARATOR, warnings: warnings.toArray() };
 }
 
 /**
@@ -222,6 +221,6 @@ export function compileToSBPL(document: ResolvedPrintDocument): string {
  */
 export class SbplCompiler implements PrintCompiler<string> {
   compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<string> {
-    return { output: compileToSBPL(document), warnings: [] };
+    return compileToSBPL(document);
   }
 }
diff --git a/packages/printer-core/src/language/sbpl/SbplFontMetrics.ts b/packages/printer-core/src/language/sbpl/SbplFontMetrics.ts
new file mode 100644
index 0000000..2710c74
--- /dev/null
+++ b/packages/printer-core/src/language/sbpl/SbplFontMetrics.ts
@@ -0,0 +1,17 @@
+import { chooseMagnification, magnifiedHeight, type MagnifiedFont } from '../MagnifiedFont';
+
+/** Font mặc định của SBPL, phóng đại qua trường `L` (2 chữ số mỗi chiều, 1-12). */
+const SBPL_FONT: MagnifiedFont = { baseHeightDots: 12, maxMagnification: 12 };
+
+/** Quy đổi cỡ chữ (dots) ↔ hệ số phóng đại trường `L` của SBPL — nguồn font duy nhất của SBPL. */
+export const SbplFontMetrics = {
+  /** Hệ số phóng đại gần cỡ chữ nhất; bỏ trống cỡ chữ thì dùng hệ số 1. */
+  fontSizeToMagnification(fontSizeDots: number | undefined): number {
+    return chooseMagnification(fontSizeDots, SBPL_FONT);
+  },
+
+  /** Chiều cao chữ thật (dots) ở 1 hệ số phóng đại. */
+  magnificationToFontSize(magnification: number): number {
+    return magnifiedHeight(magnification, SBPL_FONT);
+  },
+};
diff --git a/packages/printer-core/src/language/sbpl/index.ts b/packages/printer-core/src/language/sbpl/index.ts
index 5f3600e..62747d7 100644
--- a/packages/printer-core/src/language/sbpl/index.ts
+++ b/packages/printer-core/src/language/sbpl/index.ts
@@ -2,3 +2,4 @@ export * from './SbplCompiler';
 export * from './SbplCommand';
 export * from './SbplEncoder';
 export * from './SbplParser';
+export * from './SbplFontMetrics';
diff --git a/packages/printer-core/src/preview/PreviewRenderer.ts b/packages/printer-core/src/preview/PreviewRenderer.ts
index 1d98993..ba6e8ad 100644
--- a/packages/printer-core/src/preview/PreviewRenderer.ts
+++ b/packages/printer-core/src/preview/PreviewRenderer.ts
@@ -4,8 +4,8 @@ import { formatTable, validateTableColumns } from '../formatting';
 
 /**
  * Renderer SVG mặc định, dùng chung cho các ngôn ngữ không có preview riêng
- * (DPL, SBPL, IPL). Cỡ chữ tính theo công thức chung size/yScale, không phải
- * bảng font thật của từng máy in — khớp với cách các ngôn ngữ này uỷ quyền.
+ * (DPL, SBPL, IPL). Chiều cao chữ do ngôn ngữ gọi truyền vào qua `FontHeightResolver`
+ * từ FontMetrics của nó, để preview khớp đúng cỡ chữ compiler phát ra.
  */
 
 const CANVAS_PADDING = 10;
@@ -17,15 +17,12 @@ const INK_COLOR = '#000';
 const PAPER_COLOR = '#fff';
 const DEFAULT_LINE_THICKNESS = 1;
 
-const MIN_FONT_SIZE = 8;
-const BASE_GLYPH_HEIGHT = 12;
-const YSCALE_TRUST_THRESHOLD = 10;
-const PROPORTIONAL_FONT_BASELINE_RATIO = 0.78;
 const MONOSPACE_FONT_BASELINE_RATIO = 0.82;
-const PROPORTIONAL_FONT_CODE = '0';
-const PROPORTIONAL_FONT_FAMILY = "'Helvetica Neue', Helvetica, Arial, sans-serif";
 const MONOSPACE_FONT_FAMILY = 'monospace';
 
+/** Chiều cao chữ thật (dots) mà máy in sẽ in cho một cỡ chữ ngữ nghĩa — lấy từ FontMetrics của ngôn ngữ. */
+export type FontHeightResolver = (fontSizeDots: number | undefined) => number;
+
 /**
  * Không có bảng font-metrics để tính khoảng cách dòng, nên dùng giá trị cố
  * định — cố ý trùng lặp với DplCompiler.ts, vì 2 file ở 2 layer khác nhau,
@@ -40,34 +37,14 @@ function escapeXml(text: string): string {
   return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
 }
 
-/**
- * `yScale` vượt ngưỡng này được coi là chiều cao dots thật, dùng trực tiếp;
- * ngược lại `size` sẽ nhân với chiều cao glyph cơ sở.
- */
-function resolveFontSize(size: number, yScale: number | undefined): number {
-  if (yScale && yScale > YSCALE_TRUST_THRESHOLD) return yScale;
-  return Math.max(MIN_FONT_SIZE, size * BASE_GLYPH_HEIGHT);
-}
-
-/**
- * Tỉ lệ chiều cao ô glyph dùng để đặt baseline bên dưới `y` — font tỉ lệ
- * (proportional) nằm cao hơn 1 chút so với font monospace/bitmap.
- */
-function resolveBaselineRatio(font: string | undefined): number {
-  return font === PROPORTIONAL_FONT_CODE ? PROPORTIONAL_FONT_BASELINE_RATIO : MONOSPACE_FONT_BASELINE_RATIO;
-}
-
-function resolveFontFamily(font: string | undefined): string {
-  return font === PROPORTIONAL_FONT_CODE ? PROPORTIONAL_FONT_FAMILY : MONOSPACE_FONT_FAMILY;
-}
-
-function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): string {
+function renderTextElement(
+  element: Extract<PrintElement, { type: 'text' }>,
+  fontHeight: FontHeightResolver,
+): string {
   const options = element.options ?? {};
   const x = options.x ?? 0;
   const y = options.y ?? 0;
-  const fontSize = resolveFontSize(options.size ?? 1, options.yScale);
-  const baselineRatio = resolveBaselineRatio(options.font);
-  const fontFamily = resolveFontFamily(options.font);
+  const fontSize = fontHeight(options.fontSize);
   const fontWeight = options.bold ? 'bold' : 'normal';
   const textDecoration = options.underline ? ' text-decoration="underline"' : '';
   const rotation = options.rotation ? ` transform="rotate(${options.rotation} ${x} ${y})"` : '';
@@ -84,12 +61,12 @@ function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): st
   }
 
   const fill = options.reverse ? PAPER_COLOR : INK_COLOR;
-  const baselineY = Math.round((y + fontSize * baselineRatio) * 100) / 100;
+  const baselineY = Math.round((y + fontSize * MONOSPACE_FONT_BASELINE_RATIO) * 100) / 100;
 
   return (
     `<text x="${textX}" y="${baselineY}" fill="${fill}" ` +
     `font-size="${fontSize}" font-weight="${fontWeight}" ` +
-    `font-family="${fontFamily}"${textAnchor}${textDecoration}${rotation}>` +
+    `font-family="${MONOSPACE_FONT_FAMILY}"${textAnchor}${textDecoration}${rotation}>` +
     `${escapeXml(element.content)}</text>`
   );
 }
@@ -221,10 +198,10 @@ function renderTableElement(element: Extract<PrintElement, { type: 'table' }>):
     .join('');
 }
 
-function renderElement(element: PrintElement): string {
+function renderElement(element: PrintElement, fontHeight: FontHeightResolver): string {
   switch (element.type) {
     case 'text':
-      return renderTextElement(element);
+      return renderTextElement(element, fontHeight);
 
     case 'image':
       return renderImageElement(element);
@@ -276,11 +253,8 @@ function renderElement(element: PrintElement): string {
   }
 }
 
-/**
- * Render preview của document thành SVG, dùng công thức font chung theo
- * size thay vì bảng font thật của một ngôn ngữ máy in cụ thể nào.
- */
-export function renderPreview(document: ResolvedPrintDocument): string {
+/** Render preview của document thành SVG; `fontHeight` quy đổi cỡ chữ theo FontMetrics của ngôn ngữ gọi. */
+export function renderPreview(document: ResolvedPrintDocument, fontHeight: FontHeightResolver): string {
   const documentWidth = document.widthDots;
   const documentHeight = document.heightDots > 0 ? document.heightDots : DEFAULT_CANVAS_HEIGHT;
   const svgWidth = documentWidth + CANVAS_PADDING * 2;
@@ -289,7 +263,7 @@ export function renderPreview(document: ResolvedPrintDocument): string {
   let renderedElements = '';
 
   for (const element of document.elements) {
-    renderedElements += renderElement(element);
+    renderedElements += renderElement(element, fontHeight);
   }
 
   const captionText = `${documentWidth}×${documentHeight} dots (${document.dpi} DPI)`;
diff --git a/packages/printer-core/src/preview/languages/dpl/DplPreviewRenderer.ts b/packages/printer-core/src/preview/languages/dpl/DplPreviewRenderer.ts
index b9a0920..546e876 100644
--- a/packages/printer-core/src/preview/languages/dpl/DplPreviewRenderer.ts
+++ b/packages/printer-core/src/preview/languages/dpl/DplPreviewRenderer.ts
@@ -1,10 +1,16 @@
 import type { ResolvedPrintDocument } from '../../../document';
 import type { PrintPreview } from '../../../core';
+import { DplFontMetrics } from '../../../language';
 import { renderPreview } from '../../PreviewRenderer';
 
-/** Preview renderer của DPL — chỉ uỷ quyền cho `renderPreview()` dùng chung, không có tuỳ biến riêng cho DPL. */
+/** Chiều cao chữ DPL thật in ra — cỡ chữ làm tròn về hệ số phóng đại gần nhất như compiler. */
+function dplFontHeight(fontSizeDots: number | undefined): number {
+  return DplFontMetrics.magnificationToFontSize(DplFontMetrics.fontSizeToMagnification(fontSizeDots));
+}
+
+/** Preview renderer của DPL — uỷ quyền cho `renderPreview()` dùng chung với chiều cao chữ từ `DplFontMetrics`. */
 export class DplPreviewRenderer implements PrintPreview {
   preview(document: ResolvedPrintDocument): string {
-    return renderPreview(document);
+    return renderPreview(document, dplFontHeight);
   }
 }
diff --git a/packages/printer-core/src/preview/languages/ipl/IplPreviewRenderer.ts b/packages/printer-core/src/preview/languages/ipl/IplPreviewRenderer.ts
index 7d0b80a..5860ad9 100644
--- a/packages/printer-core/src/preview/languages/ipl/IplPreviewRenderer.ts
+++ b/packages/printer-core/src/preview/languages/ipl/IplPreviewRenderer.ts
@@ -1,10 +1,16 @@
 import type { ResolvedPrintDocument } from '../../../document';
 import type { PrintPreview } from '../../../core';
+import { IplFontMetrics } from '../../../language';
 import { renderPreview } from '../../PreviewRenderer';
 
-/** Preview renderer của IPL — chỉ uỷ quyền cho `renderPreview()` dùng chung, không có tuỳ biến riêng cho IPL. */
+/** Chiều cao chữ IPL thật in ra — clause `h` compiler phát cho cỡ chữ này. */
+function iplFontHeight(fontSizeDots: number | undefined): number {
+  return IplFontMetrics.fontSizeToNative(fontSizeDots).heightDots;
+}
+
+/** Preview renderer của IPL — uỷ quyền cho `renderPreview()` dùng chung với chiều cao chữ từ `IplFontMetrics`. */
 export class IplPreviewRenderer implements PrintPreview {
   preview(document: ResolvedPrintDocument): string {
-    return renderPreview(document);
+    return renderPreview(document, iplFontHeight);
   }
 }
diff --git a/packages/printer-core/src/preview/languages/sbpl/SbplPreviewRenderer.ts b/packages/printer-core/src/preview/languages/sbpl/SbplPreviewRenderer.ts
index 72a22f0..2e9bf75 100644
--- a/packages/printer-core/src/preview/languages/sbpl/SbplPreviewRenderer.ts
+++ b/packages/printer-core/src/preview/languages/sbpl/SbplPreviewRenderer.ts
@@ -1,10 +1,16 @@
 import type { ResolvedPrintDocument } from '../../../document';
 import type { PrintPreview } from '../../../core';
+import { SbplFontMetrics } from '../../../language';
 import { renderPreview } from '../../PreviewRenderer';
 
-/** Preview renderer của SBPL — chỉ uỷ quyền cho `renderPreview()` dùng chung, không có tuỳ biến riêng cho SBPL. */
+/** Chiều cao chữ SBPL thật in ra — cỡ chữ làm tròn về hệ số phóng đại gần nhất như compiler. */
+function sbplFontHeight(fontSizeDots: number | undefined): number {
+  return SbplFontMetrics.magnificationToFontSize(SbplFontMetrics.fontSizeToMagnification(fontSizeDots));
+}
+
+/** Preview renderer của SBPL — uỷ quyền cho `renderPreview()` dùng chung với chiều cao chữ từ `SbplFontMetrics`. */
 export class SbplPreviewRenderer implements PrintPreview {
   preview(document: ResolvedPrintDocument): string {
-    return renderPreview(document);
+    return renderPreview(document, sbplFontHeight);
   }
 }
~~~

- [ ] **Step 4: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts packages/printer-core/src/language/dpl/__tests__/DplFontMetrics.test.ts packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts packages/printer-core/src/language/ipl/__tests__/IplFontMetrics.test.ts packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts packages/printer-core/src/language/sbpl/__tests__/SbplFontMetrics.test.ts packages/printer-core/src/preview/__tests__/PreviewRenderer.test.ts packages/printer-core/src/preview/languages/dpl/__tests__/DplPreviewRenderer.test.ts packages/printer-core/src/preview/languages/ipl/__tests__/IplPreviewRenderer.test.ts packages/printer-core/src/preview/languages/sbpl/__tests__/SbplPreviewRenderer.test.ts
```

Expected: PASS — `Tests: 85 passed, 85 total`.

- [ ] **Step 5: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 92 passed, 92 total Tests: 677 passed, 677 total`.

- [ ] **Step 6: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/language/dpl/__tests__/DplCompiler.test.ts \
  packages/printer-core/src/language/dpl/__tests__/DplFontMetrics.test.ts \
  packages/printer-core/src/language/ipl/__tests__/IplCompiler.test.ts \
  packages/printer-core/src/language/ipl/__tests__/IplFontMetrics.test.ts \
  packages/printer-core/src/language/sbpl/__tests__/SbplCompiler.test.ts \
  packages/printer-core/src/language/sbpl/__tests__/SbplFontMetrics.test.ts \
  packages/printer-core/src/preview/__tests__/PreviewRenderer.test.ts \
  packages/printer-core/src/preview/languages/dpl/__tests__/DplPreviewRenderer.test.ts \
  packages/printer-core/src/preview/languages/ipl/__tests__/IplPreviewRenderer.test.ts \
  packages/printer-core/src/preview/languages/sbpl/__tests__/SbplPreviewRenderer.test.ts \
  packages/printer-core/src/language/MagnifiedFont.ts \
  packages/printer-core/src/language/dpl/DplCompiler.ts \
  packages/printer-core/src/language/dpl/DplFontMetrics.ts \
  packages/printer-core/src/language/dpl/index.ts \
  packages/printer-core/src/language/ipl/IplCompiler.ts \
  packages/printer-core/src/language/ipl/IplFontMetrics.ts \
  packages/printer-core/src/language/ipl/index.ts \
  packages/printer-core/src/language/sbpl/SbplCompiler.ts \
  packages/printer-core/src/language/sbpl/SbplFontMetrics.ts \
  packages/printer-core/src/language/sbpl/index.ts \
  packages/printer-core/src/preview/PreviewRenderer.ts \
  packages/printer-core/src/preview/languages/dpl/DplPreviewRenderer.ts \
  packages/printer-core/src/preview/languages/ipl/IplPreviewRenderer.ts \
  packages/printer-core/src/preview/languages/sbpl/SbplPreviewRenderer.ts
npx eslint $(git diff --cached --name-only -- '*.ts')
git diff --cached -U0 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: add DPL, SBPL and IPL font metrics and compile warnings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: eslint và line-length không in gì; commit thành công.

---
### Task 8: ESC/POS: `EscPosFontMetrics` + cảnh báo element vẽ

**Files:**
- Create: `language/escpos/EscPosFontMetrics.ts`
- Modify: `language/escpos/EscPosCompiler.ts`, `language/escpos/EscPosParser.ts`, `language/escpos/index.ts`, `preview/languages/escpos/EscPosPreviewRenderer.ts`
- Test: `convert/__tests__/PrinterConverter.test.ts`, `language/escpos/__tests__/EscPosCompiler.test.ts`, `language/escpos/__tests__/EscPosFontMetrics.test.ts` (mới), `language/escpos/__tests__/EscPosParser.test.ts`, `preview/languages/escpos/__tests__/EscPosPreviewRenderer.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `MagnifiedFont.ts` (Task 7), `CompileWarnings`.
- Produces:
  - `language/escpos/EscPosFontMetrics.ts` — `const EscPosFontMetrics`:
    - Font A 12×24: gốc 24 dots; tối đa hệ số 8 (1 nibble của `GS ! n`).
    - Method giống `DplFontMetrics`.
  - `EscPosCompiler`:
    - Hệ số > 1 thì phát `GS ! ((m-1) << 4 | (m-1))` trước chữ và `GS ! 0` sau chữ.
    - Cảnh báo box, line, diagonal, circle, ellipse, reverse, erase.
  - `EscPosParser`: `fontSize = magnificationToFontSize(max(width, height))`. Không có `GS !` thì là 24.
  - `EscPosPreviewRenderer`: chiều cao dòng từ metrics.

- [ ] **Step 1: Áp patch test**

Patch test làm các việc sau:
- Thêm `EscPosFontMetrics.test.ts`.
- Thêm test compiler: `fontSize` 48 → `GS ! 0x11`; 24 và 25.375 (cỡ mặc định template, Review Focus 3) → không `GS !`; cảnh báo.
- Thêm test parser và preview.
- Đổi converter ESC/POS → TSPL từ `size: 1` sang `fontSize: 24`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t8-test | git apply --ignore-whitespace -
```

<!-- patch:t8-test -->
~~~diff
diff --git a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
index 25d81f8..88eb96f 100644
--- a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
+++ b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
@@ -37,7 +37,13 @@ describe('convert', () => {
     expect(result.output).toContain('TEXT');
     expect(result.output).toContain('"Hello"');
     expect(result.output).toContain('PRINT');
-    expect(result.elements).toEqual([{ type: 'text', content: 'Hello', options: { align: 'left', bold: undefined, underline: undefined, size: 1 } }]);
+    expect(result.elements).toEqual([
+      {
+        type: 'text',
+        content: 'Hello',
+        options: { align: 'left', bold: undefined, underline: undefined, fontSize: 24 },
+      },
+    ]);
   });
 
   it('converts an EPL label to recognizable ZPL syntax', () => {
diff --git a/packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts b/packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts
index 6ef7f38..056e085 100644
--- a/packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts
+++ b/packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts
@@ -200,4 +200,67 @@ describe('EscPosCompiler', () => {
       expect(withEl).toEqual(without);
     }
   });
+
+  it('fontSize 48 → GS ! 0x11 (phóng đại 2 lần mỗi chiều) trước chữ và reset GS ! 0 sau chữ', () => {
+    const bytes = new EscPosCompiler().compile({
+      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
+      elements: [{ type: 'text', content: 'Hi', options: { fontSize: 48 } }],
+    }).output;
+
+    expect(containsSubsequence(bytes, new Uint8Array([0x1d, 0x21, 0x11, 0x48, 0x69, 0x0a]))).toBe(true);
+    expect(containsSubsequence(bytes, new Uint8Array([0x1d, 0x21, 0x00]))).toBe(true);
+  });
+
+  it('fontSize 24 là cỡ gốc của font A nên không phát GS !', () => {
+    const bytes = new EscPosCompiler().compile({
+      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
+      elements: [{ type: 'text', content: 'Hi', options: { fontSize: 24 } }],
+    }).output;
+
+    expect(containsSubsequence(bytes, new Uint8Array([0x1d, 0x21]))).toBe(false);
+  });
+
+  it('cảnh báo từng loại element ESC/POS không có lệnh vẽ, mỗi loại 1 lần', () => {
+    const { warnings } = new EscPosCompiler().compile({
+      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
+      elements: [
+        { type: 'box', options: { x: 0, y: 0, width: 10, height: 10 } },
+        { type: 'line', options: { x1: 0, y1: 0, x2: 10, y2: 0 } },
+        { type: 'diagonal', options: { x1: 0, y1: 0, x2: 10, y2: 10 } },
+        { type: 'circle', options: { x: 0, y: 0, diameter: 20 } },
+        { type: 'circle', options: { x: 5, y: 5, diameter: 20 } },
+        { type: 'ellipse', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'reverse', options: { x: 0, y: 0, width: 20, height: 10 } },
+        { type: 'erase', options: { x: 0, y: 0, width: 20, height: 10 } },
+      ],
+    });
+
+    expect(warnings).toEqual(
+      ['box', 'line', 'diagonal', 'circle', 'ellipse', 'reverse', 'erase'].map(
+        (type) => `Element "${type}" bị bỏ qua — ESC/POS không có lệnh tương ứng.`,
+      ),
+    );
+  });
+
+  it('element được hỗ trợ thì không có cảnh báo', () => {
+    const { warnings } = new EscPosCompiler().compile({
+      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
+      elements: [
+        { type: 'text', content: 'Hi', options: { fontSize: 48 } },
+        { type: 'qrcode', options: { x: 0, y: 0, content: 'hi' } },
+        { type: 'cut', options: { mode: 'partial', rows: 3 } },
+      ],
+    });
+
+    expect(warnings).toEqual([]);
+  });
+
+  it('cỡ chữ mặc định của template (12px ≈ 25.4 dots ở 203 dpi) in cỡ thường, không phát GS !', () => {
+    const bytes = new EscPosCompiler().compile({
+      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
+      elements: [{ type: 'text', content: 'Hi', options: { fontSize: 25.375 } }],
+    }).output;
+
+    expect(containsSubsequence(bytes, new Uint8Array([0x1d, 0x21]))).toBe(false);
+  });
 });
diff --git a/packages/printer-core/src/language/escpos/__tests__/EscPosFontMetrics.test.ts b/packages/printer-core/src/language/escpos/__tests__/EscPosFontMetrics.test.ts
new file mode 100644
index 0000000..245a729
--- /dev/null
+++ b/packages/printer-core/src/language/escpos/__tests__/EscPosFontMetrics.test.ts
@@ -0,0 +1,21 @@
+import { EscPosFontMetrics } from '..';
+
+describe('EscPosFontMetrics', () => {
+  it('không khai báo cỡ chữ thì dùng hệ số 1', () => {
+    expect(EscPosFontMetrics.fontSizeToMagnification(undefined)).toBe(1);
+  });
+
+  it('làm tròn theo bậc 24 dots của font A, kẹp trong 1..8', () => {
+    expect(EscPosFontMetrics.fontSizeToMagnification(1)).toBe(1);
+    expect(EscPosFontMetrics.fontSizeToMagnification(40)).toBe(2);
+    expect(EscPosFontMetrics.fontSizeToMagnification(10000)).toBe(8);
+  });
+
+  it('round-trip: chiều cao đọc ngược bằng cỡ chữ là bội số 24 dots', () => {
+    for (const fontSizeDots of [24, 48, 72, 192]) {
+      const magnification = EscPosFontMetrics.fontSizeToMagnification(fontSizeDots);
+
+      expect(EscPosFontMetrics.magnificationToFontSize(magnification)).toBe(fontSizeDots);
+    }
+  });
+});
diff --git a/packages/printer-core/src/language/escpos/__tests__/EscPosParser.test.ts b/packages/printer-core/src/language/escpos/__tests__/EscPosParser.test.ts
index 385e831..444e4f8 100644
--- a/packages/printer-core/src/language/escpos/__tests__/EscPosParser.test.ts
+++ b/packages/printer-core/src/language/escpos/__tests__/EscPosParser.test.ts
@@ -30,4 +30,13 @@ describe('EscPosParser', () => {
     expect(textElement?.options.align).toBe('center');
     expect(textElement?.options.bold).toBe(true);
   });
+
+  it('dựng fontSize từ hệ số phóng đại GS ! theo font A 24 dots', () => {
+    const bytes = new Uint8Array([0x1d, 0x21, 0x11, ...new TextEncoder().encode('Hi'), 0x0a]);
+    const result = new EscPosParser().parse(bytes) as unknown as {
+      elements: Array<{ type: string; options: Record<string, unknown> }>;
+    };
+
+    expect(result.elements.find((el) => el.type === 'text')?.options.fontSize).toBe(48);
+  });
 });
diff --git a/packages/printer-core/src/preview/languages/escpos/__tests__/EscPosPreviewRenderer.test.ts b/packages/printer-core/src/preview/languages/escpos/__tests__/EscPosPreviewRenderer.test.ts
index 7b8c366..108146f 100644
--- a/packages/printer-core/src/preview/languages/escpos/__tests__/EscPosPreviewRenderer.test.ts
+++ b/packages/printer-core/src/preview/languages/escpos/__tests__/EscPosPreviewRenderer.test.ts
@@ -25,4 +25,13 @@ describe('EscPosPreviewRenderer', () => {
     });
     expect(svg).toContain('<svg');
   });
+
+  it('vẽ chữ với chiều cao ESC/POS thật in ra cho fontSize 50 (làm tròn về hệ số 2)', () => {
+    const svg = new EscPosPreviewRenderer().preview({
+      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1,
+      elements: [{ type: 'text', content: 'hi', options: { fontSize: 50 } }],
+    });
+
+    expect(svg).toContain('font-size="48"');
+  });
 });
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts packages/printer-core/src/language/escpos/__tests__/EscPosFontMetrics.test.ts packages/printer-core/src/language/escpos/__tests__/EscPosParser.test.ts packages/printer-core/src/preview/languages/escpos/__tests__/EscPosPreviewRenderer.test.ts
```

Expected: FAIL — `EscPosFontMetrics` chưa tồn tại; compiler còn đọc `size`. Lúc lập plan: `Tests: 8 failed, 38 passed, 46 total` (số đếm có thể lệch nếu suite lỗi import; điều kiện bắt buộc là có test fail).

- [ ] **Step 3: Áp patch implementation**

Patch implementation làm các việc sau:
- Thêm `EscPosFontMetrics.ts`.
- Chuyển compiler, parser, preview ESC/POS sang dùng metrics.
- Bật cảnh báo.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t8-impl | git apply --ignore-whitespace -
```

<!-- patch:t8-impl -->
~~~diff
diff --git a/packages/printer-core/src/language/escpos/EscPosCompiler.ts b/packages/printer-core/src/language/escpos/EscPosCompiler.ts
index 3adbfea..664e000 100644
--- a/packages/printer-core/src/language/escpos/EscPosCompiler.ts
+++ b/packages/printer-core/src/language/escpos/EscPosCompiler.ts
@@ -7,6 +7,11 @@ import { encodeEscPosImage } from './EscPosImageEncoder';
 import { encodeEscPosBarcode } from './EscPosBarcodeEncoder';
 import { encodeEscPosQrCode } from './EscPosQrCodeEncoder';
 import { formatTable, validateTableColumns } from '../../formatting';
+import { CompileWarnings } from '../CompileWarnings';
+import { EscPosFontMetrics } from './EscPosFontMetrics';
+
+/** Tên ngôn ngữ trong câu cảnh báo. */
+const ESC_POS_LANGUAGE_NAME = 'ESC/POS';
 
 /** Giá trị "n" của ESC a n (căn lề). */
 const ALIGN_LEFT = 0;
@@ -17,9 +22,8 @@ const ALIGN_RIGHT = 2;
 const FEATURE_ON = 1;
 const FEATURE_OFF = 0;
 
-/** Mặt nạ/độ dịch bit dùng để đóng gói hệ số phóng to width/height vào 2 nibble của GS ! n. */
-const SIZE_MAGNIFICATION_MASK = 0x07;
-const SIZE_HEIGHT_NIBBLE_SHIFT = 4;
+/** Độ dịch bit của nibble độ rộng trong `GS ! n` — nibble thấp là độ cao. */
+const SIZE_WIDTH_NIBBLE_SHIFT = 4;
 
 /**
  * Giá trị "m" của GS V m [n] — chọn cắt toàn phần/một phần cho từng dạng lệnh
@@ -54,13 +58,12 @@ function compileTextElement(
   if (options.bold) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.BOLD, FEATURE_ON]));
   if (options.underline) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.UNDERLINE, FEATURE_ON]));
 
-  if (options.size !== undefined && options.size > 1) {
-    const magnification = options.size - 1;
-    // GS ! n đóng nibble cao=height, nibble thấp=width — ở đây dùng chung 1 giá trị magnification.
-    // eslint-disable-next-line no-bitwise
-    const nibble = magnification & SIZE_MAGNIFICATION_MASK;
+  const magnification = EscPosFontMetrics.fontSizeToMagnification(options.fontSize);
+  if (magnification > 1) {
+    // Mỗi nibble lưu (hệ số - 1); phóng đại đều 2 chiều để giữ tỉ lệ chữ.
+    const nibble = magnification - 1;
     // eslint-disable-next-line no-bitwise
-    const sizeByte = (nibble << SIZE_HEIGHT_NIBBLE_SHIFT) | nibble;
+    const sizeByte = (nibble << SIZE_WIDTH_NIBBLE_SHIFT) | nibble;
     chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.SIZE, sizeByte]));
   }
 
@@ -71,9 +74,7 @@ function compileTextElement(
 
   if (options.bold) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.BOLD, FEATURE_OFF]));
   if (options.underline) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.UNDERLINE, FEATURE_OFF]));
-  if (options.size !== undefined && options.size > 1) {
-    chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.SIZE, FEATURE_OFF]));
-  }
+  if (magnification > 1) chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.SIZE, FEATURE_OFF]));
   if (options.reverse) chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.REVERSE, FEATURE_OFF]));
   chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.ALIGN, ALIGN_LEFT]));
 
@@ -106,7 +107,11 @@ function compileTableElement(options: TableOptions, encoding: TextEncodingOption
   return chunks;
 }
 
-function compileElement(element: PrintElement, encoding: TextEncodingOptions | undefined): Uint8Array[] {
+function compileElement(
+  element: PrintElement,
+  encoding: TextEncodingOptions | undefined,
+  warnings: CompileWarnings,
+): Uint8Array[] {
   switch (element.type) {
     case 'text':
       return compileTextElement(element.content, element.options, encoding);
@@ -123,7 +128,7 @@ function compileElement(element: PrintElement, encoding: TextEncodingOptions | u
     case 'raw':
       return [typeof element.content === 'string' ? encodeEscPosText(element.content, encoding) : element.content];
 
-    // ESC/POS không có lệnh vẽ vector nguyên sinh nên các element này là no-op có chủ đích, không phải thiếu sót.
+    // ESC/POS không có lệnh vẽ vector nguyên sinh — bỏ qua và báo cảnh báo.
     case 'box':
     case 'line':
     case 'diagonal':
@@ -131,6 +136,7 @@ function compileElement(element: PrintElement, encoding: TextEncodingOptions | u
     case 'ellipse':
     case 'reverse':
     case 'erase':
+      warnings.unsupportedElement(element.type);
       return [];
 
     // Package chưa có engine auto-layout hàng-cột — placeholder chờ thiết kế, không phải bug.
@@ -151,11 +157,12 @@ function compileElement(element: PrintElement, encoding: TextEncodingOptions | u
 export class EscPosCompiler implements PrintCompiler<Uint8Array> {
   compile(document: ResolvedPrintDocument, encoding?: TextEncodingOptions): CompileResult<Uint8Array> {
     const chunks: Uint8Array[] = [new Uint8Array([ESC_POS.ESC, ESC_POS.INIT])];
+    const warnings = new CompileWarnings(ESC_POS_LANGUAGE_NAME);
 
     for (const element of document.elements) {
-      chunks.push(...compileElement(element, encoding));
+      chunks.push(...compileElement(element, encoding, warnings));
     }
 
-    return { output: concatEscPosBytes(chunks), warnings: [] };
+    return { output: concatEscPosBytes(chunks), warnings: warnings.toArray() };
   }
 }
diff --git a/packages/printer-core/src/language/escpos/EscPosFontMetrics.ts b/packages/printer-core/src/language/escpos/EscPosFontMetrics.ts
new file mode 100644
index 0000000..90471be
--- /dev/null
+++ b/packages/printer-core/src/language/escpos/EscPosFontMetrics.ts
@@ -0,0 +1,17 @@
+import { chooseMagnification, magnifiedHeight, type MagnifiedFont } from '../MagnifiedFont';
+
+/** Font A 12×24 của ESC/POS, phóng đại qua 1 nibble của `GS ! n` (1-8 lần mỗi chiều). */
+const ESC_POS_FONT: MagnifiedFont = { baseHeightDots: 24, maxMagnification: 8 };
+
+/** Quy đổi cỡ chữ (dots) ↔ hệ số phóng đại `GS ! n` của ESC/POS — nguồn font duy nhất của ESC/POS. */
+export const EscPosFontMetrics = {
+  /** Hệ số phóng đại gần cỡ chữ nhất; bỏ trống cỡ chữ thì dùng hệ số 1. */
+  fontSizeToMagnification(fontSizeDots: number | undefined): number {
+    return chooseMagnification(fontSizeDots, ESC_POS_FONT);
+  },
+
+  /** Chiều cao chữ thật (dots) ở 1 hệ số phóng đại. */
+  magnificationToFontSize(magnification: number): number {
+    return magnifiedHeight(magnification, ESC_POS_FONT);
+  },
+};
diff --git a/packages/printer-core/src/language/escpos/EscPosParser.ts b/packages/printer-core/src/language/escpos/EscPosParser.ts
index 919b796..175d349 100644
--- a/packages/printer-core/src/language/escpos/EscPosParser.ts
+++ b/packages/printer-core/src/language/escpos/EscPosParser.ts
@@ -1,6 +1,7 @@
 import type { PrintParser } from '../../core';
 import type { PrintElement } from '../../document/elements';
 import { ESC_POS } from './EscPosCommand';
+import { EscPosFontMetrics } from './EscPosFontMetrics';
 
 export interface EscPosParsedCommand {
   name: string;
@@ -475,7 +476,7 @@ function parseTextRun(
       align: state.align,
       bold: state.bold || undefined,
       underline: state.underline || undefined,
-      size: Math.max(state.sizeWidth, state.sizeHeight),
+      fontSize: EscPosFontMetrics.magnificationToFontSize(Math.max(state.sizeWidth, state.sizeHeight)),
     },
   });
 
diff --git a/packages/printer-core/src/language/escpos/index.ts b/packages/printer-core/src/language/escpos/index.ts
index a01c37a..4b6ba37 100644
--- a/packages/printer-core/src/language/escpos/index.ts
+++ b/packages/printer-core/src/language/escpos/index.ts
@@ -5,3 +5,4 @@ export * from './EscPosImageEncoder';
 export * from './EscPosBarcodeEncoder';
 export * from './EscPosQrCodeEncoder';
 export * from './EscPosParser';
+export * from './EscPosFontMetrics';
diff --git a/packages/printer-core/src/preview/languages/escpos/EscPosPreviewRenderer.ts b/packages/printer-core/src/preview/languages/escpos/EscPosPreviewRenderer.ts
index b9b66b0..259148d 100644
--- a/packages/printer-core/src/preview/languages/escpos/EscPosPreviewRenderer.ts
+++ b/packages/printer-core/src/preview/languages/escpos/EscPosPreviewRenderer.ts
@@ -1,9 +1,9 @@
 import type { ResolvedPrintDocument } from '../../../document';
 import type { PrintElement } from '../../../document/elements/PrintElement';
 import type { PrintPreview } from '../../../core';
+import { EscPosFontMetrics } from '../../../language';
 
 const DEFAULT_RECEIPT_WIDTH = 576;
-const BASE_FONT_HEIGHT = 12;
 const LINE_HEIGHT_PAD = 4;
 const TOP_MARGIN = 10;
 const CANVAS_PADDING = 5;
@@ -32,9 +32,9 @@ function resolveTextX(align: string, receiptWidth: number): number {
   return TEXT_EDGE_MARGIN;
 }
 
-/** Chiều cao dòng theo hệ số phóng đại `size` của ESC/POS (base 12 dots/bước). */
-function resolveFontSize(size: number): number {
-  return size * BASE_FONT_HEIGHT;
+/** Chiều cao chữ ESC/POS thật in ra — cỡ chữ làm tròn về hệ số phóng đại gần nhất như compiler. */
+function resolveFontSize(fontSizeDots: number | undefined): number {
+  return EscPosFontMetrics.magnificationToFontSize(EscPosFontMetrics.fontSizeToMagnification(fontSizeDots));
 }
 
 function renderTextLine(
@@ -43,7 +43,7 @@ function renderTextLine(
   y: number,
 ): string {
   const options = element.options ?? {};
-  const fontSize = resolveFontSize(options.size ?? 1);
+  const fontSize = resolveFontSize(options.fontSize);
   const align = options.align ?? 'left';
   const textAnchor = resolveTextAnchor(align);
   const x = resolveTextX(align, receiptWidth);
@@ -79,7 +79,7 @@ export class EscPosPreviewRenderer implements PrintPreview {
     for (const element of document.elements) {
       if (element.type !== 'text') continue;
       body += renderTextLine(element, receiptWidth, y);
-      y += resolveFontSize(element.options?.size ?? 1) + LINE_HEIGHT_PAD;
+      y += resolveFontSize(element.options?.fontSize) + LINE_HEIGHT_PAD;
     }
 
     const contentHeight = Math.max(y + TOP_MARGIN, MIN_CANVAS_HEIGHT);
~~~

- [ ] **Step 4: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts packages/printer-core/src/language/escpos/__tests__/EscPosFontMetrics.test.ts packages/printer-core/src/language/escpos/__tests__/EscPosParser.test.ts packages/printer-core/src/preview/languages/escpos/__tests__/EscPosPreviewRenderer.test.ts
```

Expected: PASS — `Tests: 46 passed, 46 total`.

- [ ] **Step 5: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 93 passed, 93 total Tests: 687 passed, 687 total`.

- [ ] **Step 6: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts \
  packages/printer-core/src/language/escpos/__tests__/EscPosCompiler.test.ts \
  packages/printer-core/src/language/escpos/__tests__/EscPosFontMetrics.test.ts \
  packages/printer-core/src/language/escpos/__tests__/EscPosParser.test.ts \
  packages/printer-core/src/preview/languages/escpos/__tests__/EscPosPreviewRenderer.test.ts \
  packages/printer-core/src/language/escpos/EscPosCompiler.ts \
  packages/printer-core/src/language/escpos/EscPosFontMetrics.ts \
  packages/printer-core/src/language/escpos/EscPosParser.ts \
  packages/printer-core/src/language/escpos/index.ts \
  packages/printer-core/src/preview/languages/escpos/EscPosPreviewRenderer.ts
npx eslint $(git diff --cached --name-only -- '*.ts')
git diff --cached -U0 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: add ESC/POS font metrics and compile warnings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: eslint và line-length không in gì; commit thành công.

---
### Task 9: Star PRNT: `StarPrntFontMetrics` + cảnh báo cắt và element không hỗ trợ

**Files:**
- Create: `language/starprnt/StarPrntFontMetrics.ts`
- Modify: `language/starprnt/StarPrntCompiler.ts`, `language/starprnt/index.ts`, `preview/languages/starprnt/StarPrntPreviewRenderer.ts`
- Test: `language/starprnt/__tests__/StarPrntCompiler.test.ts`, `language/starprnt/__tests__/StarPrntFontMetrics.test.ts` (mới), `preview/languages/starprnt/__tests__/StarPrntPreviewRenderer.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `MagnifiedFont.ts`, `CompileWarnings`.
- Produces:
  - `language/starprnt/StarPrntFontMetrics.ts` — `const StarPrntFontMetrics`:
    - Gốc 24 dots; tối đa hệ số 6; byte của `ESC i h w` = hệ số.
  - `StarPrntCompiler`, câu cảnh báo cố định (`mode: 'off'` thì không báo):
    - `CutOptions.rows bị bỏ qua — lệnh cắt ESC d của Star PRNT chỉ nhận 1 tham số cố định.`
    - `CutOptions.mode "partial" được in như "full" — Star PRNT không có lệnh cắt một phần riêng.`
    - Cảnh báo box, line, diagonal, circle, ellipse, reverse, erase, barcode, qrcode.
  - `StarPrntPreviewRenderer`: chiều cao dòng từ metrics.
  - Parser Star PRNT không đổi.

- [ ] **Step 1: Áp patch test**

Patch test làm các việc sau:
- Thêm `StarPrntFontMetrics.test.ts`.
- Thêm test compiler: `fontSize` 72 → `ESC i 3 3`; 24 → không `ESC i`; các cảnh báo.
- Thêm test preview.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t9-test | git apply --ignore-whitespace -
```

<!-- patch:t9-test -->
~~~diff
diff --git a/packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts b/packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts
index 62145e9..63538c3 100644
--- a/packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts
+++ b/packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts
@@ -49,11 +49,9 @@ describe('StarPrntCompiler', () => {
     expect(offIdx).toBeGreaterThan(onIdx);
   });
 
-  it('generates Star size magnification: ESC i h w', () => {
-    const bytes = Array.from(
-      new StarPrntCompiler().compile({ ...BASE, elements: [{ type: 'text', content: 'Big', options: { size: 3 } }] })
-        .output,
-    );
+  it('fontSize 72 → ESC i 3 3 (phóng đại 3 lần font 24 dots)', () => {
+    const elements: PrintElement[] = [{ type: 'text', content: 'Big', options: { fontSize: 72 } }];
+    const bytes = Array.from(new StarPrntCompiler().compile({ ...BASE, elements }).output);
     const idx = bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x69);
     expect(idx).toBeGreaterThan(-1);
     expect(bytes[idx + 2]).toBe(3);
@@ -134,7 +132,7 @@ describe('StarPrntCompiler', () => {
 
   it('accepts an encoding argument without changing its output (Star PRNT text is not yet encoding-driven)', () => {
     const encoding = STAR_PROFILES['star-tsp143']!.features;
-    const elements: PrintElement[] = [{ type: 'text', content: 'Profile', options: { bold: true, size: 2 } }];
+    const elements: PrintElement[] = [{ type: 'text', content: 'Profile', options: { bold: true, fontSize: 48 } }];
 
     const withEncoding = new StarPrntCompiler().compile({ ...BASE, elements }, encoding).output;
     const withoutEncoding = new StarPrntCompiler().compile({ ...BASE, elements }).output;
@@ -165,4 +163,62 @@ describe('StarPrntCompiler', () => {
       expect(withEl).toEqual(without);
     }
   });
+
+  it('fontSize 24 là cỡ gốc nên không phát ESC i', () => {
+    const elements: PrintElement[] = [{ type: 'text', content: 'Hi', options: { fontSize: 24 } }];
+    const bytes = Array.from(new StarPrntCompiler().compile({ ...BASE, elements }).output);
+
+    expect(bytes.findIndex((b, i) => b === 0x1b && bytes[i + 1] === 0x69)).toBe(-1);
+  });
+
+  it('cảnh báo CutOptions.rows bị bỏ qua và mode partial bị gộp, mỗi loại 1 lần', () => {
+    const { warnings } = new StarPrntCompiler().compile({
+      ...BASE,
+      elements: [
+        { type: 'cut', options: { mode: 'partial', rows: 3 } },
+        { type: 'cut', options: { mode: 'partial', rows: 2 } },
+      ],
+    });
+
+    expect(warnings).toEqual([
+      'CutOptions.rows bị bỏ qua — lệnh cắt ESC d của Star PRNT chỉ nhận 1 tham số cố định.',
+      'CutOptions.mode "partial" được in như "full" — Star PRNT không có lệnh cắt một phần riêng.',
+    ]);
+  });
+
+  it('cut full không rows và cut off thì không có cảnh báo', () => {
+    const { warnings } = new StarPrntCompiler().compile({
+      ...BASE,
+      elements: [
+        { type: 'cut', options: { mode: 'full' } },
+        { type: 'cut', options: { mode: 'off', rows: 3 } },
+      ],
+    });
+
+    expect(warnings).toEqual([]);
+  });
+
+  it('cảnh báo từng loại element Star PRNT không có lệnh, mỗi loại 1 lần', () => {
+    const { warnings } = new StarPrntCompiler().compile({
+      ...BASE,
+      elements: [
+        { type: 'box', options: { x: 0, y: 0, width: 10, height: 10 } },
+        { type: 'line', options: { x1: 0, y1: 0, x2: 10, y2: 0 } },
+        { type: 'diagonal', options: { x1: 0, y1: 0, x2: 5, y2: 5 } },
+        { type: 'circle', options: { x: 0, y: 0, diameter: 10 } },
+        { type: 'circle', options: { x: 5, y: 5, diameter: 10 } },
+        { type: 'ellipse', options: { x: 0, y: 0, width: 10, height: 5 } },
+        { type: 'reverse', options: { x: 0, y: 0, width: 10, height: 10 } },
+        { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
+        { type: 'barcode', options: { symbology: 'code128', content: 'ABC123' } },
+        { type: 'qrcode', options: { content: 'hello-qr' } },
+      ],
+    });
+
+    expect(warnings).toEqual(
+      ['box', 'line', 'diagonal', 'circle', 'ellipse', 'reverse', 'erase', 'barcode', 'qrcode'].map(
+        (type) => `Element "${type}" bị bỏ qua — Star PRNT không có lệnh tương ứng.`,
+      ),
+    );
+  });
 });
diff --git a/packages/printer-core/src/language/starprnt/__tests__/StarPrntFontMetrics.test.ts b/packages/printer-core/src/language/starprnt/__tests__/StarPrntFontMetrics.test.ts
new file mode 100644
index 0000000..858726f
--- /dev/null
+++ b/packages/printer-core/src/language/starprnt/__tests__/StarPrntFontMetrics.test.ts
@@ -0,0 +1,21 @@
+import { StarPrntFontMetrics } from '..';
+
+describe('StarPrntFontMetrics', () => {
+  it('không khai báo cỡ chữ thì dùng hệ số 1', () => {
+    expect(StarPrntFontMetrics.fontSizeToMagnification(undefined)).toBe(1);
+  });
+
+  it('làm tròn theo bậc 24 dots, kẹp trong 1..6', () => {
+    expect(StarPrntFontMetrics.fontSizeToMagnification(1)).toBe(1);
+    expect(StarPrntFontMetrics.fontSizeToMagnification(80)).toBe(3);
+    expect(StarPrntFontMetrics.fontSizeToMagnification(10000)).toBe(6);
+  });
+
+  it('round-trip: chiều cao đọc ngược bằng cỡ chữ là bội số 24 dots', () => {
+    for (const fontSizeDots of [24, 48, 72, 144]) {
+      const magnification = StarPrntFontMetrics.fontSizeToMagnification(fontSizeDots);
+
+      expect(StarPrntFontMetrics.magnificationToFontSize(magnification)).toBe(fontSizeDots);
+    }
+  });
+});
diff --git a/packages/printer-core/src/preview/languages/starprnt/__tests__/StarPrntPreviewRenderer.test.ts b/packages/printer-core/src/preview/languages/starprnt/__tests__/StarPrntPreviewRenderer.test.ts
index da2bfa0..5318d34 100644
--- a/packages/printer-core/src/preview/languages/starprnt/__tests__/StarPrntPreviewRenderer.test.ts
+++ b/packages/printer-core/src/preview/languages/starprnt/__tests__/StarPrntPreviewRenderer.test.ts
@@ -34,4 +34,13 @@ describe('StarPrntPreviewRenderer', () => {
     // no such handling — the text stays plain black-on-white, no `fill="#000"/>` box.
     expect(svg).not.toContain('fill="#000"/>');
   });
+
+  it('vẽ chữ với chiều cao Star PRNT thật in ra cho fontSize 50 (làm tròn về hệ số 2)', () => {
+    const svg = new StarPrntPreviewRenderer().preview({
+      ...BASE,
+      elements: [{ type: 'text', content: 'hi', options: { fontSize: 50 } }],
+    });
+
+    expect(svg).toContain('font-size="48"');
+  });
 });
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts packages/printer-core/src/language/starprnt/__tests__/StarPrntFontMetrics.test.ts packages/printer-core/src/preview/languages/starprnt/__tests__/StarPrntPreviewRenderer.test.ts
```

Expected: FAIL — `StarPrntFontMetrics` chưa tồn tại; compiler còn đọc `size`, chưa cảnh báo. Lúc lập plan: `Tests: 7 failed, 22 passed, 29 total` (số đếm có thể lệch nếu suite lỗi import; điều kiện bắt buộc là có test fail).

- [ ] **Step 3: Áp patch implementation**

Patch implementation làm các việc sau:
- Thêm `StarPrntFontMetrics.ts`.
- Chuyển compiler và preview Star PRNT sang dùng metrics.
- Bật cảnh báo.
- Bỏ import `BYTE_MASK` không còn dùng trong compiler.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t9-impl | git apply --ignore-whitespace -
```

<!-- patch:t9-impl -->
~~~diff
diff --git a/packages/printer-core/src/language/starprnt/StarPrntCompiler.ts b/packages/printer-core/src/language/starprnt/StarPrntCompiler.ts
index 5a51435..76ca8ca 100644
--- a/packages/printer-core/src/language/starprnt/StarPrntCompiler.ts
+++ b/packages/printer-core/src/language/starprnt/StarPrntCompiler.ts
@@ -2,7 +2,6 @@ import type { ResolvedPrintDocument } from '../../document';
 import type { PrintElement, TextOptions } from '../../document/elements';
 import type { CompileResult, PrintCompiler, TextEncodingOptions } from '../../core';
 import {
-  BYTE_MASK,
   STAR_PRNT,
   STAR_PRNT_ALIGN_VALUE,
   STAR_PRNT_CUT_VALUE,
@@ -12,6 +11,18 @@ import {
 } from './StarPrntCommand';
 import { encodeStarPrntImage } from './StarPrntEncoder';
 import { formatTable, validateTableColumns } from '../../formatting';
+import { CompileWarnings } from '../CompileWarnings';
+import { StarPrntFontMetrics } from './StarPrntFontMetrics';
+
+/** Tên ngôn ngữ trong câu cảnh báo. */
+const STAR_PRNT_LANGUAGE_NAME = 'Star PRNT';
+
+/** Cảnh báo khi `CutOptions.rows` bị bỏ qua. */
+const CUT_ROWS_WARNING = 'CutOptions.rows bị bỏ qua — lệnh cắt ESC d của Star PRNT chỉ nhận 1 tham số cố định.';
+
+/** Cảnh báo khi cắt một phần bị gộp thành cắt toàn phần. */
+const CUT_PARTIAL_WARNING =
+  'CutOptions.mode "partial" được in như "full" — Star PRNT không có lệnh cắt một phần riêng.';
 
 function alignByte(align: TextOptions['align']): number {
   switch (align) {
@@ -35,10 +46,8 @@ function compileTextElement(content: string, options: TextOptions | undefined):
     chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.UNDERLINE, STAR_PRNT_UNDERLINE_VALUE.ON]));
   }
 
-  if (resolvedOptions.size !== undefined && resolvedOptions.size > 1) {
-    // Kẹp hệ số phóng to về đúng 1 byte, theo định dạng lệnh "ESC i h w".
-    // eslint-disable-next-line no-bitwise
-    const magnification = resolvedOptions.size & BYTE_MASK;
+  const magnification = StarPrntFontMetrics.fontSizeToMagnification(resolvedOptions.fontSize);
+  if (magnification > 1) {
     chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.SIZE, magnification, magnification]));
   }
 
@@ -52,7 +61,7 @@ function compileTextElement(content: string, options: TextOptions | undefined):
   if (resolvedOptions.underline) {
     chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.UNDERLINE, STAR_PRNT_UNDERLINE_VALUE.OFF]));
   }
-  if (resolvedOptions.size !== undefined && resolvedOptions.size > 1) {
+  if (magnification > 1) {
     chunks.push(
       new Uint8Array([
         STAR_PRNT.ESC,
@@ -72,10 +81,16 @@ function compileTextElement(content: string, options: TextOptions | undefined):
  * Mode, nên 'partial' và 'full' đều dùng chung `STAR_PRNT_CUT_VALUE`. `rows`
  * bị bỏ qua vì ESC d chỉ nhận đúng 1 tham số cố định.
  */
-function compileCutElement(element: Extract<PrintElement, { type: 'cut' }>): Uint8Array[] {
+function compileCutElement(
+  element: Extract<PrintElement, { type: 'cut' }>,
+  warnings: CompileWarnings,
+): Uint8Array[] {
   const mode = element.options?.mode ?? 'full';
   if (mode === 'off') return [];
 
+  if (element.options?.rows !== undefined) warnings.add(CUT_ROWS_WARNING);
+  if (mode === 'partial') warnings.add(CUT_PARTIAL_WARNING);
+
   return [new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.CUT, STAR_PRNT_CUT_VALUE])];
 }
 
@@ -89,7 +104,7 @@ function compileTableElement(element: Extract<PrintElement, { type: 'table' }>):
   return chunks;
 }
 
-function compileElement(element: PrintElement): Uint8Array[] {
+function compileElement(element: PrintElement, warnings: CompileWarnings): Uint8Array[] {
   switch (element.type) {
     case 'text':
       return compileTextElement(element.content, element.options);
@@ -100,7 +115,7 @@ function compileElement(element: PrintElement): Uint8Array[] {
     case 'raw':
       return [typeof element.content === 'string' ? new TextEncoder().encode(element.content) : element.content];
 
-    // Star Line Mode không có lệnh vẽ vector nào; các loại này là no-op có chủ đích.
+    // Star Line Mode không có lệnh vẽ vector nào — bỏ qua và báo cảnh báo.
     case 'box':
     case 'line':
     case 'diagonal':
@@ -108,6 +123,7 @@ function compileElement(element: PrintElement): Uint8Array[] {
     case 'ellipse':
     case 'reverse':
     case 'erase':
+      warnings.unsupportedElement(element.type);
       return [];
 
     // Star Line Mode không có nguyên hàm ngắt trang / tiến N dot / tự động bố
@@ -120,13 +136,14 @@ function compileElement(element: PrintElement): Uint8Array[] {
 
     // Star Line Mode có định nghĩa lệnh barcode ("ESC b ...") và ký hiệu 2D
     // ("ESC GS y ..."), nhưng không có cấu trúc byte nào ở đây được xác thực
-    // đủ để phát ra mà không phải đoán mò field. No-op có chủ đích, không phải bug.
+    // đủ để phát ra mà không phải đoán mò field — bỏ qua và báo cảnh báo.
     case 'barcode':
     case 'qrcode':
+      warnings.unsupportedElement(element.type);
       return [];
 
     case 'cut':
-      return compileCutElement(element);
+      return compileCutElement(element, warnings);
 
     case 'table':
       return compileTableElement(element);
@@ -144,11 +161,12 @@ function compileElement(element: PrintElement): Uint8Array[] {
 export class StarPrntCompiler implements PrintCompiler<Uint8Array> {
   compile(document: ResolvedPrintDocument, _encoding?: TextEncodingOptions): CompileResult<Uint8Array> {
     const chunks: Uint8Array[] = [new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.INIT])];
+    const warnings = new CompileWarnings(STAR_PRNT_LANGUAGE_NAME);
 
     for (const element of document.elements) {
-      chunks.push(...compileElement(element));
+      chunks.push(...compileElement(element, warnings));
     }
 
-    return { output: concatStarPrntBytes(chunks), warnings: [] };
+    return { output: concatStarPrntBytes(chunks), warnings: warnings.toArray() };
   }
 }
diff --git a/packages/printer-core/src/language/starprnt/StarPrntFontMetrics.ts b/packages/printer-core/src/language/starprnt/StarPrntFontMetrics.ts
new file mode 100644
index 0000000..c5979e7
--- /dev/null
+++ b/packages/printer-core/src/language/starprnt/StarPrntFontMetrics.ts
@@ -0,0 +1,17 @@
+import { chooseMagnification, magnifiedHeight, type MagnifiedFont } from '../MagnifiedFont';
+
+/** Font 24 dots của Star Line Mode, phóng đại qua `ESC i h w` (1-6 lần mỗi chiều). */
+const STAR_PRNT_FONT: MagnifiedFont = { baseHeightDots: 24, maxMagnification: 6 };
+
+/** Quy đổi cỡ chữ (dots) ↔ hệ số phóng đại `ESC i h w` của Star PRNT — nguồn font duy nhất của Star PRNT. */
+export const StarPrntFontMetrics = {
+  /** Hệ số phóng đại gần cỡ chữ nhất; bỏ trống cỡ chữ thì dùng hệ số 1. */
+  fontSizeToMagnification(fontSizeDots: number | undefined): number {
+    return chooseMagnification(fontSizeDots, STAR_PRNT_FONT);
+  },
+
+  /** Chiều cao chữ thật (dots) ở 1 hệ số phóng đại. */
+  magnificationToFontSize(magnification: number): number {
+    return magnifiedHeight(magnification, STAR_PRNT_FONT);
+  },
+};
diff --git a/packages/printer-core/src/language/starprnt/index.ts b/packages/printer-core/src/language/starprnt/index.ts
index ae32605..fece8e2 100644
--- a/packages/printer-core/src/language/starprnt/index.ts
+++ b/packages/printer-core/src/language/starprnt/index.ts
@@ -2,3 +2,4 @@ export * from './StarPrntCompiler';
 export * from './StarPrntCommand';
 export * from './StarPrntEncoder';
 export * from './StarPrntParser';
+export * from './StarPrntFontMetrics';
diff --git a/packages/printer-core/src/preview/languages/starprnt/StarPrntPreviewRenderer.ts b/packages/printer-core/src/preview/languages/starprnt/StarPrntPreviewRenderer.ts
index c9bb989..40a8595 100644
--- a/packages/printer-core/src/preview/languages/starprnt/StarPrntPreviewRenderer.ts
+++ b/packages/printer-core/src/preview/languages/starprnt/StarPrntPreviewRenderer.ts
@@ -1,9 +1,9 @@
 import type { ResolvedPrintDocument } from '../../../document';
 import type { PrintElement } from '../../../document/elements/PrintElement';
 import type { PrintPreview } from '../../../core';
+import { StarPrntFontMetrics } from '../../../language';
 
 const DEFAULT_RECEIPT_WIDTH = 576;
-const BASE_FONT_HEIGHT = 12;
 const LINE_HEIGHT_PAD = 4;
 const TOP_MARGIN = 10;
 const CANVAS_PADDING = 5;
@@ -32,9 +32,9 @@ function resolveTextX(align: string, receiptWidth: number): number {
   return TEXT_EDGE_MARGIN;
 }
 
-/** Chiều cao dòng theo hệ số phóng đại `size` của Star PRNT (base 12 dots/bước). */
-function resolveFontSize(size: number): number {
-  return size * BASE_FONT_HEIGHT;
+/** Chiều cao chữ Star PRNT thật in ra — cỡ chữ làm tròn về hệ số phóng đại gần nhất như compiler. */
+function resolveFontSize(fontSizeDots: number | undefined): number {
+  return StarPrntFontMetrics.magnificationToFontSize(StarPrntFontMetrics.fontSizeToMagnification(fontSizeDots));
 }
 
 /**
@@ -47,7 +47,7 @@ function renderTextLine(
   y: number,
 ): string {
   const options = element.options ?? {};
-  const fontSize = resolveFontSize(options.size ?? 1);
+  const fontSize = resolveFontSize(options.fontSize);
   const align = options.align ?? 'left';
   const textAnchor = resolveTextAnchor(align);
   const x = resolveTextX(align, receiptWidth);
@@ -71,7 +71,7 @@ export class StarPrntPreviewRenderer implements PrintPreview {
     for (const element of document.elements) {
       if (element.type !== 'text') continue;
       body += renderTextLine(element, receiptWidth, y);
-      y += resolveFontSize(element.options?.size ?? 1) + LINE_HEIGHT_PAD;
+      y += resolveFontSize(element.options?.fontSize) + LINE_HEIGHT_PAD;
     }
 
     const contentHeight = Math.max(y + TOP_MARGIN, MIN_CANVAS_HEIGHT);
~~~

- [ ] **Step 4: Chạy test của task, xác nhận PASS**

```bash
npx jest packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts packages/printer-core/src/language/starprnt/__tests__/StarPrntFontMetrics.test.ts packages/printer-core/src/preview/languages/starprnt/__tests__/StarPrntPreviewRenderer.test.ts
```

Expected: PASS — `Tests: 29 passed, 29 total`.

- [ ] **Step 5: Verify toàn package**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

Expected: tsc không in gì; jest `Test Suites: 94 passed, 94 total Tests: 695 passed, 695 total`.

- [ ] **Step 6: Stage, eslint, line-length, commit**

```bash
git add \
  packages/printer-core/src/language/starprnt/__tests__/StarPrntCompiler.test.ts \
  packages/printer-core/src/language/starprnt/__tests__/StarPrntFontMetrics.test.ts \
  packages/printer-core/src/preview/languages/starprnt/__tests__/StarPrntPreviewRenderer.test.ts \
  packages/printer-core/src/language/starprnt/StarPrntCompiler.ts \
  packages/printer-core/src/language/starprnt/StarPrntFontMetrics.ts \
  packages/printer-core/src/language/starprnt/index.ts \
  packages/printer-core/src/preview/languages/starprnt/StarPrntPreviewRenderer.ts
npx eslint $(git diff --cached --name-only -- '*.ts')
git diff --cached -U0 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "feat: add Star PRNT font metrics and compile warnings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: eslint và line-length không in gì; commit thành công.

---
### Task 10: Xoá `font`/`size`/`xScale`/`yScale` khỏi `TextOptions` + README

**Files:**
- Modify: `document/elements/content/TextElement.ts`, `packages/printer-core/README.md`
- Test: `__tests__/phase2-integration.test.ts`

- Docs: `packages/printer-core/README.md`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: mọi ngôn ngữ đã đọc `fontSize` (Task 3-9).
- Produces:
  - `TextOptions` chỉ còn field ngữ nghĩa: `x`, `y`, `fontSize`, `rotation`, `bold`, `underline`, `reverse`, `align`, `maxWidth`, `lineSpacing`.
  - README `printer-core` mô tả `fontSize`, `{Lang}FontMetrics`, `CompileResult` và bảng cảnh báo theo ngôn ngữ.

- [ ] **Step 1: Áp patch implementation (xoá field) — xác nhận type-check FAIL**

Task này là bước xoá, nên "RED" là lỗi type-check ở chỗ còn dùng field cũ.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t10-impl | git apply --ignore-whitespace -
npx tsc --noEmit -p packages/printer-core
```

<!-- patch:t10-impl -->
~~~diff
diff --git a/packages/printer-core/src/document/elements/content/TextElement.ts b/packages/printer-core/src/document/elements/content/TextElement.ts
index 228e94e..31638ee 100644
--- a/packages/printer-core/src/document/elements/content/TextElement.ts
+++ b/packages/printer-core/src/document/elements/content/TextElement.ts
@@ -11,18 +11,6 @@ export interface TextOptions {
   /** Cỡ chữ (chiều cao glyph danh nghĩa), dots; mỗi compiler tự quy đổi sang font/hệ số phóng đại của máy in. */
   fontSize?: number;
 
-  /** @deprecated Dùng `fontSize`. Tên/mã font gốc của máy in — ý nghĩa khác nhau tuỳ từng ngôn ngữ. */
-  font?: string;
-
-  /** @deprecated Dùng `fontSize`. Hệ số phóng đại font (thường 1-8 tuỳ ngôn ngữ). */
-  size?: number;
-
-  /** @deprecated Dùng `fontSize`. Hệ số phóng đại ngang riêng. */
-  xScale?: number;
-
-  /** @deprecated Dùng `fontSize`. Hệ số phóng đại dọc riêng. */
-  yScale?: number;
-
   /** Góc xoay của text. */
   rotation?: Rotation;
 
~~~

Expected: FAIL — đúng 1 lỗi: `src/__tests__/phase2-integration.test.ts(21,…): error TS2353: Object literal may only specify known properties, and 'size' does not exist in type 'TextOptions'.`

- [ ] **Step 2: Áp patch test (đổi `size: 2` → `fontSize: 24`) — xác nhận PASS**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t10-test | git apply --ignore-whitespace -
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
```

<!-- patch:t10-test -->
~~~diff
diff --git a/packages/printer-core/src/__tests__/phase2-integration.test.ts b/packages/printer-core/src/__tests__/phase2-integration.test.ts
index d086ec9..9d96a6a 100644
--- a/packages/printer-core/src/__tests__/phase2-integration.test.ts
+++ b/packages/printer-core/src/__tests__/phase2-integration.test.ts
@@ -18,7 +18,7 @@ const doc: ResolvedPrintDocument = {
   direction: 'forward',
   copies: 1,
   elements: [
-    { type: 'text', content: 'Hello World', options: { x: 10, y: 10, size: 2 } },
+    { type: 'text', content: 'Hello World', options: { x: 10, y: 10, fontSize: 24 } },
     { type: 'barcode', options: { symbology: 'code128', content: '123456789' } },
     {
       type: 'table',
~~~

Expected: tsc không in gì; jest `Test Suites: 94 passed, 94 total Tests: 695 passed, 695 total`.

- [ ] **Step 3: Kiểm tra không còn chỗ nào dùng field cũ ngoài package**

```bash
grep -rnE "\b(xScale|yScale)\b|toMagnification" packages/printer-core/src packages/printer-preview/src src || echo CLEAN
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
```

Expected: in `CLEAN`; `printer-preview` type-check sạch, Vitest `3 passed` file / `11 passed` test.

- [ ] **Step 4: Stage, eslint, line-length, commit code**

```bash
git add \
  packages/printer-core/src/__tests__/phase2-integration.test.ts \
  packages/printer-core/src/document/elements/content/TextElement.ts
npx eslint $(git diff --cached --name-only -- '*.ts')
git diff --cached -U0 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: remove native font fields from TextOptions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Cập nhật README**

README thêm mục "Cỡ chữ và cảnh báo compile" (kèm bảng cảnh báo theo ngôn ngữ) và bổ sung file mới vào cây `language/`, `preview/`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-25-semantic-element.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t10-docs | git apply --ignore-whitespace -
```

<!-- patch:t10-docs -->
~~~diff
diff --git a/packages/printer-core/README.md b/packages/printer-core/README.md
index da062a3..b7617e6 100644
--- a/packages/printer-core/README.md
+++ b/packages/printer-core/README.md
@@ -171,23 +171,28 @@ src/
 │
 ├── language/                        # MỚI — gộp compiler/{lang} + parser/{lang}
 │   │                                 # (KHÔNG gồm validation, KHÔNG gồm preview)
+│   ├── CompileWarnings.ts            # gom cảnh báo của 1 lần compile (field bỏ/gộp, element không hỗ trợ)
+│   ├── BitmapFont.ts                 # chọn font bitmap + hệ số phóng đại (TSPL, EPL, CPCL)
+│   ├── MagnifiedFont.ts              # 1 font phóng đại nguyên (DPL, SBPL, ESC/POS, Star PRNT)
 │   ├── tspl/      (đổi tên từ `tsc` — TSC chỉ còn dùng cho tên hãng)
-│   │   ├── TsplCommand.ts, TsplCompiler.ts, TsplEncoder.ts, TsplParser.ts, index.ts
-│   ├── zpl/       ├── ZplCommand.ts, ZplCompiler.ts, ZplEncoder.ts, ZplParser.ts, index.ts
-│   ├── epl/       ├── EplCommand.ts, EplCompiler.ts, EplEncoder.ts, EplParser.ts, index.ts
-│   ├── cpcl/      ├── CpclCommand.ts, CpclCompiler.ts, CpclEncoder.ts, CpclParser.ts, index.ts
-│   ├── dpl/       ├── DplCommand.ts, DplCompiler.ts, DplEncoder.ts, DplParser.ts, index.ts
-│   ├── ipl/       ├── IplCommand.ts, IplCompiler.ts, IplEncoder.ts, IplParser.ts, index.ts
-│   ├── sbpl/      ├── SbplCommand.ts, SbplCompiler.ts, SbplEncoder.ts, SbplParser.ts, index.ts
+│   │   ├── TsplCommand.ts, TsplCompiler.ts, TsplEncoder.ts, TsplFontMetrics.ts, TsplParser.ts, index.ts
+│   ├── zpl/       ├── ZplCommand.ts, ZplCompiler.ts, ZplEncoder.ts, ZplFontMetrics.ts, ZplParser.ts, index.ts
+│   ├── epl/       ├── EplCommand.ts, EplCompiler.ts, EplEncoder.ts, EplFontMetrics.ts, EplParser.ts, index.ts
+│   ├── cpcl/      ├── CpclCommand.ts, CpclCompiler.ts, CpclEncoder.ts, CpclFontMetrics.ts, CpclParser.ts,
+│   │              │   index.ts
+│   ├── dpl/       ├── DplCommand.ts, DplCompiler.ts, DplEncoder.ts, DplFontMetrics.ts, DplParser.ts, index.ts
+│   ├── ipl/       ├── IplCommand.ts, IplCompiler.ts, IplEncoder.ts, IplFontMetrics.ts, IplParser.ts, index.ts
+│   ├── sbpl/      ├── SbplCommand.ts, SbplCompiler.ts, SbplEncoder.ts, SbplFontMetrics.ts, SbplParser.ts,
+│   │              │   index.ts
 │   ├── escpos/    ├── EscPosCommand.ts, EscPosCompiler.ts, EscPosCodePage.ts,
-│   │              │   EscPosBarcodeEncoder.ts, EscPosImageEncoder.ts,
+│   │              │   EscPosBarcodeEncoder.ts, EscPosImageEncoder.ts, EscPosFontMetrics.ts,
 │   │              │   EscPosQrCodeEncoder.ts, EscPosParser.ts, index.ts
 │   └── starprnt/  └── StarPrntCommand.ts, StarPrntCompiler.ts, StarPrntEncoder.ts,
-│                      StarPrntParser.ts, index.ts
+│                      StarPrntFontMetrics.ts, StarPrntParser.ts, index.ts
 │
 ├── preview/                          # THU GỌN + thêm per-language subfolder
-│   ├── PreviewRenderer.ts            # KHÔNG đổi — implementation dùng chung
-│   │                                 # cho Dpl/Sbpl/Ipl (giữ nguyên vị trí + nội dung)
+│   ├── PreviewRenderer.ts            # implementation dùng chung cho Dpl/Sbpl/Ipl — chiều cao
+│   │                                 # chữ do FontMetrics của ngôn ngữ gọi truyền vào
 │   ├── index.ts
 │   └── languages/
 │       ├── tspl/TsplPreviewRenderer.ts     (MỚI — thêm 1 cấp thư mục theo lang)
@@ -240,6 +245,26 @@ src/
     ├── template-pipeline-integration.test.ts, phase2-integration.test.ts
 ```
 
+## Cỡ chữ và cảnh báo compile
+
+- `TextOptions.fontSize` (dots) là field cỡ chữ duy nhất của `PrintElement` text. Mỗi ngôn ngữ tự quy đổi
+  sang lệnh native qua `language/{lang}/{Lang}FontMetrics.ts` — đây là nguồn dữ liệu font duy nhất, dùng
+  chung cho compiler, parser (dựng lại `fontSize` best-effort) và preview.
+- `PrintCompiler.compile()` và `compileTo()` trả `{ output, warnings }`. `warnings` liệt kê field bị bỏ
+  qua/gộp và element ngôn ngữ không có lệnh tương ứng; `output` giữ nguyên hành vi cũ (element không hỗ
+  trợ vẫn không phát lệnh nào). Cảnh báo trùng nội dung chỉ xuất hiện 1 lần; `cut` với `mode: 'off'`
+  không cảnh báo vì không yêu cầu cắt.
+
+| Ngôn ngữ | Element bị bỏ qua (có cảnh báo) | Field bị bỏ/gộp (có cảnh báo) |
+|---|---|---|
+| TSPL | — | `CutOptions.mode: 'partial'` in như `'full'` |
+| EPL | diagonal, circle, ellipse, reverse, erase, cut | — |
+| CPCL | circle, ellipse, reverse, erase, cut | `BarcodeConfig.readable` |
+| ZPL | ellipse, reverse, erase | `CutOptions.rows`, `QrCodeConfig.rotation` |
+| DPL, SBPL, IPL | diagonal, circle, ellipse, reverse, erase, cut, barcode, qrcode | — |
+| ESC/POS | box, line, diagonal, circle, ellipse, reverse, erase | — |
+| Star PRNT | box, line, diagonal, circle, ellipse, reverse, erase, barcode, qrcode | `CutOptions.rows`, `CutOptions.mode: 'partial'` |
+
 ## Scripts
 
 ```bash
~~~

- [ ] **Step 6: Commit README**

```bash
git add packages/printer-core/README.md
git commit -m "docs: document fontSize and compile warnings in printer-core README" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Verify cuối cùng toàn branch**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
npx eslint packages/printer-core/src
git diff main -U0 -- 'packages/printer-core/*.ts' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git status --short
```

Expected: tsc sạch; jest `Test Suites: 94 passed, 94 total Tests: 695 passed, 695 total`; eslint không in gì; line-length không in gì; `git status` chỉ còn file untracked có sẵn từ trước (VD `.claude/worktrees/`).

