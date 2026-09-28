# printer-core Registry + Core (R2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1 registry duy nhất trong thư mục mới `registry/` cho dispatch và `convert()`, parser mọi ngôn ngữ trả chung `PrintParseResult`, `core/` chỉ còn contract.

**Architecture:**
- **Task 1:** thêm cặp hàm chuỗi nhị phân ↔ byte vào `encoding/`, thay bản sao trong `EscPosValidator`.
- **Task 2:** thêm `PrintParseResult`; parser TSPL/ESC-POS trả kiểu này và tự nhận cả chuỗi lẫn byte.
- **Task 3:** chuyển registry + dispatch từ `core/` sang `registry/`, tách file theo khái niệm.
- **Task 4:** `convert()` đi qua `parseFrom`/`compileTo`, xoá `ConversionRegistry`/`ConversionPath`, `printer-preview` dùng
  `SUPPORTED_LANGUAGES`, README cập nhật.
- Hành vi compile/preview/validate/convert của TSPL và ESC/POS không đổi; test hiện có là bằng chứng.

**Tech Stack:**
- TypeScript 5.9 strict.
- Jest (preset react-native) cho `printer-core`.
- Vitest cho `printer-preview`.
- `printer-core` không có dependency.

**Spec:** `docs/superpowers/specs/2026-09-28-printer-core-registry-design.md`, đợt R2 của `docs/superpowers/specs/2026-09-26-printer-core-restructure-overview.md`.

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

**Quy tắc chung của đợt tái cấu trúc** (từ file tổng):

- **Test giữ nguyên như hiện tại:**
  - Chỉ sửa đường import khi file nguồn bị tách hoặc chuyển.
  - Chỉ sửa kỳ vọng khi API đổi có chủ đích (R2).
  - Test của code bị xoá thì xoá theo.
- **Không đổi hành vi in** của TSPL và ESC/POS: cùng document → cùng lệnh máy in và cùng cảnh báo.
- **`printer-preview` phải còn chạy được:** type-check + Vitest xanh.
- **"1 file = 1 khái niệm"** cho code mới và file bị chuyển/tách ở đợt này.

**Ràng buộc khác:**

- **Branch:** làm trên `refactor/printer-core-registry` (đã có commit spec và commit của plan này). Checkout thẳng trong working directory chính — **không dùng git worktree**, không commit thẳng `main`.
- **Stage file:**
  - File chuyển/xoá được stage bởi chính `git mv`/`git rm` trong task; file sửa/thêm stage bằng lệnh `git add` cho sẵn.
  - **Không bao giờ** `git add -A` hay `git add .`. `.claude/worktrees/` giữ untracked.
- **Commit message:** dùng đúng 2 tham số `-m` cho trong task; dòng cuối là `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, nguyên văn.
- **Nơi chạy lệnh:** mọi lệnh chạy từ `C:\NDTCORE\NDTCore\NDTCore.App` bằng Git Bash.

### Cách áp code của plan

Phần **chuyển/xoá file** dùng lệnh `git mv`/`git rm` ghi sẵn trong task. Phần **sửa/thêm** nằm trong khối patch của chính file này: mỗi khối có đánh dấu `<!-- patch:<id> -->` đứng ngay trước khối `~~~diff`. Task có TDD tách 2 patch: `tNtest` (test) và `tNimpl` (code).

**Lệnh áp 1 patch** (mỗi step đã ghi sẵn lệnh đầy đủ):

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-printer-core-registry.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" <id> | git apply --ignore-whitespace -
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
  Expected: tsc không in gì; Vitest `12 passed`.

- **ESLint:**
  ```bash
  npx eslint packages/printer-core/src packages/printer-preview/src
  ```
  Expected: `0 errors`. 6 warning `react-native/no-inline-styles` trong `printer-preview` là có sẵn.

- **Line-length cho dòng đã stage:**
  ```bash
  git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
  ```
  Expected: không in gì, exit 0.

## Review Focus

Các trường hợp spec ngụ ý nhưng dễ bị bỏ sót, xếp theo khả năng gây hại cao nhất trước:

1. **ESC/POS dạng chuỗi có byte ≥ 0x80** (VD chữ đã mã hoá code page) đi qua `parseFrom`/`convert`.
   - Mong đợi: đọc đúng từng byte như khi đưa `Uint8Array`, không qua UTF-8.
   - Chốt bằng: test `binaryStringToBytes` (Task 1), test `EscPosParser` chuỗi = byte kể cả 0x80 (Task 2).
2. **`convert()` sau khi bỏ `ConversionRegistry`** cho cùng output và cảnh báo như trước, kể cả khi đích ra byte.
   - Mong đợi: ESC/POS → TSPL, TSPL → ESC/POS (ESC @ đầu, chứa `Hello`), TSPL → TSPL giữ font như trước.
   - Chốt bằng: test converter hiện có, giữ nguyên (Task 4).
3. **Ngôn ngữ lạ** ở `compileTo`/`parseFrom`/`validateFor`/`previewFor`/`convert` (nguồn và đích).
   - Mong đợi: vẫn ném `UnsupportedLanguageError` có tên ngôn ngữ trong thông báo.
   - Chốt bằng: test dispatch và converter hiện có (Task 3, Task 4).
4. **Import vòng** giữa `registry/`, `convert/`, `core/`, `validation/`, `language/`.
   - Mong đợi: không vòng; `core/` chỉ import type từ `document`/`validation`.
   - Chốt bằng: bước grep ở mục Kiểm tra cuối; Jest nạp được mọi suite.
5. **`SUPPORTED_LANGUAGES` và danh sách trong `printer-preview`** khớp registry.
   - Mong đợi: đúng `tspl`, `escpos`; thêm ngôn ngữ vào registry là tự có trong preview.
   - Chốt bằng: test `SUPPORTED_LANGUAGES` (Task 3), Vitest `printer-preview` (Task 4).

## Các quyết định lệch khỏi spec (đã chốt khi lập plan)

| # | Spec | Plan | Lý do |
|---|---|---|---|
| 1 | Kiểu kết quả parse chung tên `ParseResult` (`core/ParseResult.ts`) | Tên `PrintParseResult` (`core/PrintParseResult.ts`) | `template/parse` đã export `ParseResult` (kết quả `parseTemplate`); trùng tên làm `src/index.ts` lỗi TS2308. Tên mới đi cặp với `PrintParser` |
| 2 | Chỉ nói `TsplValidator` import qua barrel | `EscPosValidator` cũng đổi import `ESC_POS` sang barrel `language` | File này đã bị sửa ở Task 1 (thay `bytesFromSource`); quy ước 9 áp cho file được sửa |
| 3 | Test `SUPPORTED_LANGUAGES` "đổi từ" test `SUPPORTED_SOURCES/TARGETS` | Test mới nằm ở `registry/__tests__/LanguageDispatch.test.ts` (Task 3); test cũ trong `PrinterConverter.test.ts` xoá ở Task 4 | `SUPPORTED_LANGUAGES` thuộc `registry/`, test đặt cạnh code |
| 4 | — | Thêm JSDoc tiếng Việt cho `EscPosParsedCommand` và field của `TSPLParseResult` | Quy ước 1 áp cho interface được sửa |

---

### Task 1: Chuỗi nhị phân ↔ byte trong `encoding/`

**Files:**
- Create: `packages/printer-core/src/encoding/binaryStringToBytes.ts`, `packages/printer-core/src/encoding/bytesToBinaryString.ts`
- Modify: `packages/printer-core/src/encoding/index.ts`, `packages/printer-core/src/validation/languages/escpos/EscPosValidator.ts`
- Test: `packages/printer-core/src/encoding/__tests__/binaryString.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces (export qua barrel `encoding`):
  - `binaryStringToBytes(source: string): Uint8Array` — mỗi ký tự thành 1 byte (`charCodeAt & 0xff`).
  - `bytesToBinaryString(bytes: Uint8Array): string` — mỗi byte thành 1 ký tự.

- [ ] **Step 1: Kiểm tra branch và working tree**

```bash
git branch --show-current
git status --short
```

Expected: `refactor/printer-core-registry`; `git status` chỉ có `?? .claude/worktrees/`.

- [ ] **Step 2: Viết test (patch `t1test`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-printer-core-registry.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t1test | git apply --ignore-whitespace -
```

<!-- patch:t1test -->
~~~diff
diff --git a/packages/printer-core/src/encoding/__tests__/binaryString.test.ts b/packages/printer-core/src/encoding/__tests__/binaryString.test.ts
new file mode 100644
index 0000000..2927ee1
--- /dev/null
+++ b/packages/printer-core/src/encoding/__tests__/binaryString.test.ts
@@ -0,0 +1,28 @@
+import { binaryStringToBytes } from '../binaryStringToBytes';
+import { bytesToBinaryString } from '../bytesToBinaryString';
+
+describe('binaryStringToBytes', () => {
+  it('đổi mỗi ký tự thành đúng 1 byte, kể cả byte >= 0x80', () => {
+    const bytes = binaryStringToBytes('\x1b\x40\x80\xe1\xff');
+
+    expect(Array.from(bytes)).toEqual([0x1b, 0x40, 0x80, 0xe1, 0xff]);
+  });
+
+  it('chỉ giữ 8 bit thấp khi ký tự vượt quá 1 byte', () => {
+    expect(Array.from(binaryStringToBytes('Ł'))).toEqual([0x41]);
+  });
+});
+
+describe('bytesToBinaryString', () => {
+  it('đổi mỗi byte thành đúng 1 ký tự, kể cả byte >= 0x80', () => {
+    const binary = bytesToBinaryString(new Uint8Array([0x1b, 0x40, 0x80, 0xe1, 0xff]));
+
+    expect(binary).toBe('\x1b\x40\x80\xe1\xff');
+  });
+
+  it('là nghịch đảo của binaryStringToBytes', () => {
+    const bytes = new Uint8Array(Array.from({ length: 256 }, (_, value) => value));
+
+    expect(Array.from(binaryStringToBytes(bytesToBinaryString(bytes)))).toEqual(Array.from(bytes));
+  });
+});
~~~

- [ ] **Step 3: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/encoding
```

Expected: suite `binaryString.test.ts` FAIL với `Cannot find module '../binaryStringToBytes'`.

- [ ] **Step 4: Viết code (patch `t1impl`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-printer-core-registry.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t1impl | git apply --ignore-whitespace -
```

<!-- patch:t1impl -->
~~~diff
diff --git a/packages/printer-core/src/encoding/binaryStringToBytes.ts b/packages/printer-core/src/encoding/binaryStringToBytes.ts
new file mode 100644
index 0000000..a6e1d1d
--- /dev/null
+++ b/packages/printer-core/src/encoding/binaryStringToBytes.ts
@@ -0,0 +1,13 @@
+/** Giữ 8 bit thấp của mã ký tự, tức đúng 1 byte. */
+const BYTE_MASK = 0xff;
+
+/**
+ * Đổi chuỗi nhị phân (1 ký tự = 1 byte, 0-255) thành byte. Không giải mã UTF-8 vì như vậy mọi byte >= 0x80 sẽ bị
+ * đọc thành ký tự nhiều byte và hỏng.
+ */
+export function binaryStringToBytes(source: string): Uint8Array {
+  const bytes = new Uint8Array(source.length);
+  // eslint-disable-next-line no-bitwise -- giữ đúng 1 byte cho mỗi ký tự
+  for (let index = 0; index < source.length; index++) bytes[index] = source.charCodeAt(index) & BYTE_MASK;
+  return bytes;
+}
diff --git a/packages/printer-core/src/encoding/bytesToBinaryString.ts b/packages/printer-core/src/encoding/bytesToBinaryString.ts
new file mode 100644
index 0000000..ebf1eca
--- /dev/null
+++ b/packages/printer-core/src/encoding/bytesToBinaryString.ts
@@ -0,0 +1,6 @@
+/** Đổi byte thành chuỗi nhị phân 1 ký tự = 1 byte, để byte đi được qua API chỉ nhận chuỗi. */
+export function bytesToBinaryString(bytes: Uint8Array): string {
+  let binary = '';
+  for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
+  return binary;
+}
diff --git a/packages/printer-core/src/encoding/index.ts b/packages/printer-core/src/encoding/index.ts
index 050e19f..167a821 100644
--- a/packages/printer-core/src/encoding/index.ts
+++ b/packages/printer-core/src/encoding/index.ts
@@ -1,4 +1,6 @@
 export * from './CodePage';
 export * from './CodePageEncoder';
 export * from './EncodingResult';
+export * from './binaryStringToBytes';
+export * from './bytesToBinaryString';
 export * from './encoders';
diff --git a/packages/printer-core/src/validation/languages/escpos/EscPosValidator.ts b/packages/printer-core/src/validation/languages/escpos/EscPosValidator.ts
index 9d79999..f068fc8 100644
--- a/packages/printer-core/src/validation/languages/escpos/EscPosValidator.ts
+++ b/packages/printer-core/src/validation/languages/escpos/EscPosValidator.ts
@@ -1,5 +1,6 @@
-import { ESC_POS } from '../../../language/escpos/EscPosCommand';
 import type { PrintValidation } from '../../../core';
+import { binaryStringToBytes } from '../../../encoding';
+import { ESC_POS } from '../../../language';
 import type { ValidationIssue } from '../../ValidationIssue';
 import type { ValidationResult } from '../../ValidationResult';
 
@@ -36,13 +37,6 @@ const GS_PARAM_LENGTH: Record<number, number> = {
 /** Mã symbology của "GS k" từ giá trị này trở lên là dạng B (có byte độ dài); thấp hơn là dạng A (kết thúc NUL). */
 const BARCODE_FORMAT_B_MIN_TYPE = 65;
 
-function bytesFromSource(source: string): Uint8Array {
-  const bytes = new Uint8Array(source.length);
-  // eslint-disable-next-line no-bitwise -- giữ đúng 1 byte cho mỗi ký tự
-  for (let i = 0; i < source.length; i++) bytes[i] = source.charCodeAt(i) & 0xff;
-  return bytes;
-}
-
 function isPrintableOrExtended(byte: number): boolean {
   return (byte >= 0x20 && byte <= 0x7e) || byte >= 0x80;
 }
@@ -86,7 +80,7 @@ function skipRasterImage(bytes: Uint8Array, i: number): number {
  */
 export class EscPosValidator implements PrintValidation {
   validate(source: string): ValidationResult {
-    const bytes = bytesFromSource(source);
+    const bytes = binaryStringToBytes(source);
     const issues: ValidationIssue[] = [];
     let i = 0;
     let invalidRunStart = -1;
~~~

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `317 passed, 317 total`; eslint `0 errors`.

- [ ] **Step 6: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/src/encoding/__tests__/binaryString.test.ts \
  packages/printer-core/src/encoding/binaryStringToBytes.ts \
  packages/printer-core/src/encoding/bytesToBinaryString.ts \
  packages/printer-core/src/encoding/index.ts \
  packages/printer-core/src/validation/languages/escpos/EscPosValidator.ts
git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: share binary string and byte conversion in encoding" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Task 2: `PrintParseResult` chung cho parser TSPL và ESC/POS

**Files:**
- Create: `packages/printer-core/src/core/PrintParseResult.ts`
- Modify: `core/PrintParser.ts`, `core/index.ts`, `core/PrinterLanguageDefinition.ts`, `core/LanguageDispatch.ts`, `language/tspl/TsplParser.ts`, `language/escpos/EscPosParser.ts`, `validation/languages/tspl/TsplValidator.ts`, `convert/ConversionRegistry.ts`
- Test: `core/__tests__/LanguageDispatch.test.ts`, `language/escpos/__tests__/EscPosParser.test.ts`, `language/tspl/__tests__/TsplParser.test.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `binaryStringToBytes` (Task 1, barrel `encoding`).
- Produces:
  - `PrintParseResult<TCommand = unknown>` { `commands: TCommand[]`, `elements: PrintElement[]`, `widthDots?: number`, `heightDots?: number`, `warnings: string[]` } — export qua barrel `core`.
  - `PrintParser<TCommand = unknown>` { `parse(source: string | Uint8Array): PrintParseResult<TCommand>` }. Bỏ `ParsedCommands`.
  - `TsplParser implements PrintParser<TSPLCommand>`, `parse()` trả `TSPLParseResult extends PrintParseResult<TSPLCommand>` (`widthDots`, `heightDots`, `dpi` bắt buộc).
  - `EscPosParser implements PrintParser<EscPosParsedCommand>`, `parse(source: string | Uint8Array)`: chuỗi đọc 1 ký tự = 1 byte. Bỏ `EscPosParseResult`.
  - `parseTSPL`, `decodeEscPos` không còn export.
  - `parseFrom(language, source): PrintParseResult` (vẫn ở `core/LanguageDispatch.ts`; Task 3 chuyển đi).
  - `ConversionRegistry` gọi `new TsplParser().parse` / `new EscPosParser().parse` (tạm, Task 4 xoá).

- [ ] **Step 1: Viết/sửa test (patch `t2test`)**

- `TsplParser.test.ts`: gọi `parseTSPL(x)` đổi thành `new TsplParser().parse(x)` (API đổi có chủ đích).
- `EscPosParser.test.ts`: thêm ca chuỗi 1 ký tự = 1 byte cho cùng kết quả như byte.
- `LanguageDispatch.test.ts`: thêm ca `parseFrom('escpos', chuỗi)` và ca `parseFrom('tspl', …)` trả element + khổ tem.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-printer-core-registry.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t2test | git apply --ignore-whitespace -
```

<!-- patch:t2test -->
~~~diff
diff --git a/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts b/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
index b20196c..265259a 100644
--- a/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
+++ b/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
@@ -1,6 +1,7 @@
 import { compileTo, parseFrom, validateFor, previewFor } from '../LanguageDispatch';
 import { UnsupportedLanguageError } from '../PrinterCoreError';
 import type { ResolvedPrintDocument } from '../../document';
+import { bytesToBinaryString } from '../../encoding';
 
 const doc: ResolvedPrintDocument = {
   widthDots: 320,
@@ -37,6 +38,24 @@ describe('LanguageDispatch', () => {
     expect(previewFor('escpos', doc)).toContain('<svg');
   });
 
+  it('parseFrom đọc ESC/POS dạng chuỗi 1 ký tự = 1 byte giống hệt dạng byte', () => {
+    const bytes = compileTo('escpos', doc).output as Uint8Array;
+    const fromBytes = parseFrom('escpos', bytes);
+
+    const fromString = parseFrom('escpos', bytesToBinaryString(bytes));
+
+    expect(fromString.commands.length).toBeGreaterThan(0);
+    expect(fromString).toEqual(fromBytes);
+  });
+
+  it('parseFrom trả element và khổ tem dựng lại từ lệnh TSPL', () => {
+    const result = parseFrom('tspl', compileTo('tspl', doc).output as string);
+
+    expect(result.widthDots).toBe(320);
+    expect(result.heightDots).toBe(240);
+    expect(result.elements).toContainEqual(expect.objectContaining({ type: 'text', content: 'Hi' }));
+  });
+
   it('throws a clear UnsupportedLanguageError for an unknown language', () => {
     const unknown = 'unknown' as unknown as Parameters<typeof compileTo>[0];
     expect(() => compileTo(unknown, doc).output).toThrow(UnsupportedLanguageError);
diff --git a/packages/printer-core/src/language/escpos/__tests__/EscPosParser.test.ts b/packages/printer-core/src/language/escpos/__tests__/EscPosParser.test.ts
index 444e4f8..eb60ff7 100644
--- a/packages/printer-core/src/language/escpos/__tests__/EscPosParser.test.ts
+++ b/packages/printer-core/src/language/escpos/__tests__/EscPosParser.test.ts
@@ -31,6 +31,16 @@ describe('EscPosParser', () => {
     expect(textElement?.options.bold).toBe(true);
   });
 
+  it('đọc chuỗi 1 ký tự = 1 byte giống hệt dạng byte, kể cả byte >= 0x80', () => {
+    const bytes = new Uint8Array([0x1b, 0x40, 0x48, 0x69, 0x80, 0x0a]);
+    const fromBytes = new EscPosParser().parse(bytes);
+
+    const fromString = new EscPosParser().parse(String.fromCharCode(...bytes));
+
+    expect(fromString.commands.length).toBeGreaterThan(0);
+    expect(fromString).toEqual(fromBytes);
+  });
+
   it('dựng fontSize từ hệ số phóng đại GS ! theo font A 24 dots', () => {
     const bytes = new Uint8Array([0x1d, 0x21, 0x11, ...new TextEncoder().encode('Hi'), 0x0a]);
     const result = new EscPosParser().parse(bytes) as unknown as {
diff --git a/packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts b/packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts
index d8e3370..817ba3b 100644
--- a/packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts
+++ b/packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts
@@ -1,4 +1,4 @@
-import { TsplParser, parseTSPL } from '../TsplParser';
+import { TsplParser } from '../TsplParser';
 import { TsplCompiler } from '../TsplCompiler';
 import type { ResolvedPrintDocument } from '../../../document';
 
@@ -12,7 +12,7 @@ describe('TsplParser', () => {
 
   it('extracts label dimensions from SIZE and a text element from TEXT', () => {
     const source = 'SIZE 40 mm,30 mm\nGAP 3 mm,0 mm\nCLS\nTEXT 10,10,"3",0,1,1,"Hello"\nPRINT 1\n';
-    const result = parseTSPL(source);
+    const result = new TsplParser().parse(source);
     expect(result.widthDots).toBe(320); // 40mm @ 203dpi
     expect(result.heightDots).toBe(240); // 30mm @ 203dpi
     expect(result.elements).toEqual([
@@ -22,7 +22,7 @@ describe('TsplParser', () => {
 
   it('normalizes an out-of-range TEXT rotation to 0 instead of asserting it into Rotation', () => {
     const source = 'SIZE 40 mm,30 mm\nCLS\nTEXT 0,0,"3",45,1,1,"x"\n';
-    const result = parseTSPL(source);
+    const result = new TsplParser().parse(source);
     expect(result.elements).toEqual([
       { type: 'text', content: 'x', options: { x: 0, y: 0, fontSize: 24, rotation: 0 } },
     ]);
@@ -30,7 +30,7 @@ describe('TsplParser', () => {
 
   it('normalizes an out-of-range BLOCK rotation to 0 instead of asserting it into Rotation', () => {
     const source = 'SIZE 40 mm,30 mm\nCLS\nBLOCK 0,0,100,50,"3",45,1,1,"x"\n';
-    const result = parseTSPL(source);
+    const result = new TsplParser().parse(source);
     expect(result.elements).toEqual([
       { type: 'text', content: 'x', options: { x: 0, y: 0, fontSize: 24, rotation: 0, maxWidth: 100 } },
     ]);
@@ -38,7 +38,7 @@ describe('TsplParser', () => {
 
   it('parses a DIAGONAL command into a diagonal PrintElement, not a line element', () => {
     const source = 'SIZE 40 mm,30 mm\nCLS\nDIAGONAL 0,0,100,50,2\n';
-    const result = parseTSPL(source);
+    const result = new TsplParser().parse(source);
     expect(result.commands).toContainEqual({ cmd: 'DIAGONAL', x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 });
     expect(result.elements).toEqual([{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }]);
   });
@@ -57,14 +57,14 @@ describe('TsplParser', () => {
       'PRINT 1',
     ].join('\r\n');
 
-    const result = parseTSPL(source);
+    const result = new TsplParser().parse(source);
     expect(result.warnings).toEqual([]);
     const cmdNames = result.commands.map((c) => c.cmd);
     expect(cmdNames).toEqual(['SIZE', 'GAP', 'SPEED', 'DENSITY', 'DIRECTION', 'CLS', 'BOX', 'BARCODE', 'QRCODE', 'PRINT']);
   });
 
   it('flags a genuinely unrecognized command as UNKNOWN (parser-level; range/order checks are the validator\'s job)', () => {
-    const result = parseTSPL('NOTAREALCOMMAND 1,2,3\n');
+    const result = new TsplParser().parse('NOTAREALCOMMAND 1,2,3\n');
     expect(result.commands).toEqual([{ cmd: 'UNKNOWN', raw: 'NOTAREALCOMMAND 1,2,3' }]);
   });
 
@@ -115,7 +115,7 @@ describe('TsplParser', () => {
       // line break once the document is tokenized.
       expect(compiled).toContain('BITMAP 0,0,3,1,0,A\nB');
 
-      const result = parseTSPL(compiled);
+      const result = new TsplParser().parse(compiled);
       const cmdNames = result.commands.map((c) => c.cmd);
 
       // A clean round-trip would produce exactly 8 commands (SIZE, GAP,
~~~

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/core packages/printer-core/src/language/escpos packages/printer-core/src/language/tspl
```

Expected: `2 failed` — `EscPosParser › đọc chuỗi 1 ký tự = 1 byte giống hệt dạng byte, kể cả byte >= 0x80` và `LanguageDispatch › parseFrom đọc ESC/POS dạng chuỗi 1 ký tự = 1 byte giống hệt dạng byte` (chuỗi hiện cho 0 lệnh). Các ca còn lại pass.

- [ ] **Step 3: Viết code (patch `t2impl`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-printer-core-registry.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t2impl | git apply --ignore-whitespace -
```

<!-- patch:t2impl -->
~~~diff
diff --git a/packages/printer-core/src/convert/ConversionRegistry.ts b/packages/printer-core/src/convert/ConversionRegistry.ts
index 7f892e5..2950225 100644
--- a/packages/printer-core/src/convert/ConversionRegistry.ts
+++ b/packages/printer-core/src/convert/ConversionRegistry.ts
@@ -1,6 +1,6 @@
 import type { CompileResult, PrinterLanguage } from '../core';
 import type { PrintElement, ResolvedPrintDocument } from '../document';
-import { decodeEscPos, EscPosCompiler, parseTSPL, TsplCompiler } from '../language';
+import { EscPosCompiler, EscPosParser, TsplCompiler, TsplParser } from '../language';
 
 /** Những gì parser của 1 ngôn ngữ dựng lại được từ lệnh máy in. */
 export interface ParsedSource {
@@ -26,41 +26,14 @@ export interface ConversionRegistryEntry {
   compile: (document: ResolvedPrintDocument) => CompileResult<string | Uint8Array>;
 }
 
-function toText(source: string | Uint8Array): string {
-  return typeof source === 'string' ? source : new TextDecoder().decode(source);
-}
-
-/**
- * ESC/POS nhận `string` theo quy ước 1 ký tự = 1 byte (0-255), giống `EscPosValidator`, để output byte của chính
- * `convert()` đọc ngược lại được; giải mã qua UTF-8 sẽ làm hỏng mọi byte >= 0x80.
- */
-function toBytes(source: string | Uint8Array): Uint8Array {
-  if (source instanceof Uint8Array) return source;
-  const bytes = new Uint8Array(source.length);
-  // eslint-disable-next-line no-bitwise -- giữ đúng 1 byte cho mỗi ký tự
-  for (let i = 0; i < source.length; i++) bytes[i] = source.charCodeAt(i) & 0xff;
-  return bytes;
-}
-
 /** Parse/compile của từng ngôn ngữ, dùng khi chuyển lệnh từ ngôn ngữ này sang ngôn ngữ khác. */
 export const ConversionRegistry: Record<PrinterLanguage, ConversionRegistryEntry> = {
   tspl: {
-    parse: (source) => {
-      const result = parseTSPL(toText(source));
-      return {
-        elements: result.elements,
-        widthDots: result.widthDots,
-        heightDots: result.heightDots,
-        warnings: result.warnings,
-      };
-    },
+    parse: (source) => new TsplParser().parse(source),
     compile: (document) => new TsplCompiler().compile(document),
   },
   escpos: {
-    parse: (source) => {
-      const result = decodeEscPos(toBytes(source));
-      return { elements: result.elements, warnings: result.warnings };
-    },
+    parse: (source) => new EscPosParser().parse(source),
     compile: (document) => new EscPosCompiler().compile(document),
   },
 };
diff --git a/packages/printer-core/src/core/LanguageDispatch.ts b/packages/printer-core/src/core/LanguageDispatch.ts
index 69194dd..ebf41fc 100644
--- a/packages/printer-core/src/core/LanguageDispatch.ts
+++ b/packages/printer-core/src/core/LanguageDispatch.ts
@@ -2,7 +2,7 @@ import type { ResolvedPrintDocument } from '../document';
 import type { ValidationResult } from '../validation';
 import type { CompileResult } from './PrintCompiler';
 import type { PrinterFeatures } from './PrinterFeatures';
-import type { ParsedCommands } from './PrintParser';
+import type { PrintParseResult } from './PrintParseResult';
 import type { PrinterLanguage } from './PrinterLanguage';
 import type { PrinterLanguageDefinition } from './PrinterLanguageDefinition';
 import { LANGUAGE_REGISTRY } from './LanguageRegistry';
@@ -27,8 +27,8 @@ export function compileTo(
   return lookup(language, 'compiler').compiler.compile(document, features);
 }
 
-/** `source` phải đúng dạng compiler của ngôn ngữ đó sinh ra: byte cho ESC/POS, chuỗi cho TSPL. */
-export function parseFrom(language: PrinterLanguage, source: string | Uint8Array): ParsedCommands {
+/** ESC/POS nhận byte hoặc chuỗi 1 ký tự = 1 byte; TSPL nhận chuỗi hoặc byte UTF-8. */
+export function parseFrom(language: PrinterLanguage, source: string | Uint8Array): PrintParseResult {
   return lookup(language, 'parser').parser.parse(source);
 }
 
diff --git a/packages/printer-core/src/core/PrintParseResult.ts b/packages/printer-core/src/core/PrintParseResult.ts
new file mode 100644
index 0000000..318b7a4
--- /dev/null
+++ b/packages/printer-core/src/core/PrintParseResult.ts
@@ -0,0 +1,19 @@
+import type { PrintElement } from '../document';
+
+/** Kết quả chung mà parser của mọi ngôn ngữ trả. */
+export interface PrintParseResult<TCommand = unknown> {
+  /** Lệnh đọc được theo thứ tự xuất hiện; cấu trúc từng lệnh riêng theo ngôn ngữ. */
+  commands: TCommand[];
+
+  /** Element dựng lại được từ lệnh. */
+  elements: PrintElement[];
+
+  /** Khổ ngang (dots); bỏ trống khi ngôn ngữ không có lệnh khai báo khổ, để phân biệt với giá trị 0 thật. */
+  widthDots?: number;
+
+  /** Chiều dài tem (dots); bỏ trống khi ngôn ngữ không có lệnh khai báo, để phân biệt với giá trị 0 thật. */
+  heightDots?: number;
+
+  /** Lệnh không nhận diện được hoặc dữ liệu hỏng gặp khi parse. */
+  warnings: string[];
+}
diff --git a/packages/printer-core/src/core/PrintParser.ts b/packages/printer-core/src/core/PrintParser.ts
index 2a3d6e3..f77cd15 100644
--- a/packages/printer-core/src/core/PrintParser.ts
+++ b/packages/printer-core/src/core/PrintParser.ts
@@ -1,13 +1,6 @@
-/** Kết quả chung mà parser của mọi ngôn ngữ đều trả. */
-export interface ParsedCommands {
-  /** Lệnh đọc được theo thứ tự xuất hiện; cấu trúc từng lệnh riêng theo ngôn ngữ. */
-  commands: unknown[];
-
-  /** Lệnh không nhận diện được hoặc dữ liệu hỏng gặp khi parse. */
-  warnings: string[];
-}
+import type { PrintParseResult } from './PrintParseResult';
 
 /** Đọc ngược lệnh máy in thành cấu trúc để kiểm tra hoặc chuyển sang ngôn ngữ khác. */
-export interface PrintParser<TResult> {
-  parse(source: string | Uint8Array): TResult;
+export interface PrintParser<TCommand = unknown> {
+  parse(source: string | Uint8Array): PrintParseResult<TCommand>;
 }
diff --git a/packages/printer-core/src/core/PrinterLanguageDefinition.ts b/packages/printer-core/src/core/PrinterLanguageDefinition.ts
index 72e7ad5..d2a0a7e 100644
--- a/packages/printer-core/src/core/PrinterLanguageDefinition.ts
+++ b/packages/printer-core/src/core/PrinterLanguageDefinition.ts
@@ -1,5 +1,5 @@
 import type { PrintCompiler } from './PrintCompiler';
-import type { ParsedCommands, PrintParser } from './PrintParser';
+import type { PrintParser } from './PrintParser';
 import type { PrintValidation } from './PrintValidation';
 import type { PrintPreview } from './PrintPreview';
 import type { PrinterLanguage } from './PrinterLanguage';
@@ -12,8 +12,8 @@ export interface PrinterLanguageDefinition {
   /** Biên dịch document thành lệnh máy in. */
   readonly compiler: PrintCompiler<string | Uint8Array>;
 
-  /** Đọc ngược lệnh máy in thành danh sách lệnh + cảnh báo. */
-  readonly parser: PrintParser<ParsedCommands>;
+  /** Đọc ngược lệnh máy in thành lệnh, element và cảnh báo. */
+  readonly parser: PrintParser;
 
   /** Kiểm tra cú pháp chuỗi lệnh. */
   readonly validator: PrintValidation;
diff --git a/packages/printer-core/src/core/index.ts b/packages/printer-core/src/core/index.ts
index 662e038..620214b 100644
--- a/packages/printer-core/src/core/index.ts
+++ b/packages/printer-core/src/core/index.ts
@@ -1,6 +1,7 @@
 export * from './PrinterLanguage';
 export * from './PrintCompiler';
 export * from './PrinterFeatures';
+export * from './PrintParseResult';
 export * from './PrintParser';
 export * from './PrintPreview';
 export * from './PrintValidation';
diff --git a/packages/printer-core/src/language/escpos/EscPosParser.ts b/packages/printer-core/src/language/escpos/EscPosParser.ts
index 175d349..1bd0c44 100644
--- a/packages/printer-core/src/language/escpos/EscPosParser.ts
+++ b/packages/printer-core/src/language/escpos/EscPosParser.ts
@@ -1,18 +1,19 @@
-import type { PrintParser } from '../../core';
+import type { PrintParseResult, PrintParser } from '../../core';
 import type { PrintElement } from '../../document/elements';
+import { binaryStringToBytes } from '../../encoding';
 import { ESC_POS } from './EscPosCommand';
 import { EscPosFontMetrics } from './EscPosFontMetrics';
 
+/** 1 lệnh ESC/POS đọc được. */
 export interface EscPosParsedCommand {
+  /** Tên lệnh, VD `LF`. */
   name: string;
+
+  /** Byte gốc của lệnh. */
   bytes: number[];
-  params: Record<string, unknown>;
-}
 
-export interface EscPosParseResult {
-  commands: EscPosParsedCommand[];
-  elements: PrintElement[];
-  warnings: string[];
+  /** Tham số đã giải mã; field riêng theo từng lệnh. */
+  params: Record<string, unknown>;
 }
 
 // Không có trong ESC_POS dùng chung vì đó chỉ chứa byte mà compiler cần phát ra.
@@ -483,11 +484,7 @@ function parseTextRun(
   return cursor;
 }
 
-/**
- * Export riêng khỏi `EscPosParser` (vốn chỉ trả `commands`/`warnings` theo kiểu `PrintParser`)
- * vì một số nơi gọi — ví dụ dùng ESC/POS làm nguồn cross-compile — cần trực tiếp các `PrintElement` đã phục hồi.
- */
-export function decodeEscPos(data: Uint8Array): EscPosParseResult {
+function decodeEscPos(data: Uint8Array): PrintParseResult<EscPosParsedCommand> {
   const commands: EscPosParsedCommand[] = [];
   const elements: PrintElement[] = [];
   const warnings: string[] = [];
@@ -534,8 +531,10 @@ export function decodeEscPos(data: Uint8Array): EscPosParseResult {
   return { commands, elements, warnings };
 }
 
-export class EscPosParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
-  parse(bytes: Uint8Array): { commands: unknown[]; warnings: string[] } {
+/** Đọc lệnh ESC/POS; chuỗi được hiểu theo quy ước 1 ký tự = 1 byte, giống output chuỗi của `convert()`. */
+export class EscPosParser implements PrintParser<EscPosParsedCommand> {
+  parse(source: string | Uint8Array): PrintParseResult<EscPosParsedCommand> {
+    const bytes = typeof source === 'string' ? binaryStringToBytes(source) : source;
     return decodeEscPos(bytes);
   }
 }
diff --git a/packages/printer-core/src/language/tspl/TsplParser.ts b/packages/printer-core/src/language/tspl/TsplParser.ts
index 3e02f2a..fcceda5 100644
--- a/packages/printer-core/src/language/tspl/TsplParser.ts
+++ b/packages/printer-core/src/language/tspl/TsplParser.ts
@@ -1,4 +1,4 @@
-import type { PrintParser } from '../../core';
+import type { PrintParseResult, PrintParser } from '../../core';
 import type { PrintElement } from '../../document/elements';
 import type { Rotation } from '../../types';
 import { TsplFontMetrics } from './TsplFontMetrics';
@@ -215,14 +215,16 @@ export type TSPLCommand =
   | { cmd: 'GETSETTING'; params: string }
   | { cmd: 'UNKNOWN'; raw: string };
 
-/** Toàn bộ kết quả parse một chuỗi nguồn TSPL/TSPL2. */
-export interface TSPLParseResult {
-  commands: TSPLCommand[];
+/** Kết quả parse TSPL: luôn có khổ tem (mặc định khi thiếu lệnh `SIZE`) và DPI dùng khi quy đổi. */
+export interface TSPLParseResult extends PrintParseResult<TSPLCommand> {
+  /** Khổ ngang (dots) từ lệnh `SIZE`; 320 khi không có. */
   widthDots: number;
+
+  /** Chiều dài tem (dots) từ lệnh `SIZE`; 240 khi không có. */
   heightDots: number;
+
+  /** DPI dùng để đổi mm/inch sang dots; parser cố định 203. */
   dpi: number;
-  elements: PrintElement[];
-  warnings: string[];
 }
 
 const FIXED_PARSE_DPI = 203;
@@ -979,7 +981,7 @@ function parseAssignmentCommand(line: string): Extract<TSPLCommand, { cmd: 'ASSI
  * `GAPDETECT` của chính nó, `SET ` chạy trước `SET GPO`/`SET GPI`, `DOWNLOAD` chạy trước `DO` —
  * đổi thứ tự sẽ âm thầm làm một dòng rơi vào nhánh khác.
  */
-export function parseTSPL(code: string): TSPLParseResult {
+function parseTSPL(code: string): TSPLParseResult {
   const commands: TSPLCommand[] = [];
   const warnings: string[] = [];
   const elements: PrintElement[] = [];
@@ -1527,8 +1529,8 @@ export function parseTSPL(code: string): TSPLParseResult {
  * Giải mã một chuỗi lệnh TSPL/TSPL2 thành các lệnh có cấu trúc (theo dòng,
  * theo ngữ pháp từng lệnh).
  */
-export class TsplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
-  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
+export class TsplParser implements PrintParser<TSPLCommand> {
+  parse(source: string | Uint8Array): TSPLParseResult {
     const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
     return parseTSPL(code);
   }
diff --git a/packages/printer-core/src/validation/languages/tspl/TsplValidator.ts b/packages/printer-core/src/validation/languages/tspl/TsplValidator.ts
index 21bef2d..e5b3938 100644
--- a/packages/printer-core/src/validation/languages/tspl/TsplValidator.ts
+++ b/packages/printer-core/src/validation/languages/tspl/TsplValidator.ts
@@ -1,5 +1,5 @@
-import { parseTSPL } from '../../../language/tspl/TsplParser';
 import type { PrintValidation } from '../../../core';
+import { TsplParser } from '../../../language';
 import type { ValidationIssue } from '../../ValidationIssue';
 import type { ValidationResult } from '../../ValidationResult';
 
@@ -32,7 +32,7 @@ const LABEL_ELEMENT_COMMANDS = new Set([
 
 /**
  * Kiểm tra lệnh TSPL/TSPL2: thứ tự lệnh (`SIZE` đầu tiên, `CLS` trước mọi element, có `PRINT`), khoảng giá trị
- * `DENSITY`/`SPEED` và lệnh không nhận ra. Parse lại bằng `parseTSPL()` để kiểm tra trên cùng cấu trúc lệnh với parser.
+ * `DENSITY`/`SPEED` và lệnh không nhận ra. Parse lại bằng `TsplParser` để kiểm tra trên cùng cấu trúc lệnh với parser.
  */
 export class TsplValidator implements PrintValidation {
   validate(source: string): ValidationResult {
@@ -41,7 +41,7 @@ export class TsplValidator implements PrintValidation {
     }
 
     const issues: ValidationIssue[] = [];
-    const { commands } = parseTSPL(source);
+    const { commands } = new TsplParser().parse(source);
 
     const firstCmd = commands.find((c) => c.cmd !== 'UNKNOWN' && c.cmd !== 'REM');
     if (firstCmd && firstCmd.cmd !== 'SIZE') {
~~~

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `320 passed, 320 total`; `printer-preview` tsc sạch, Vitest `12 passed`; eslint `0 errors`.

- [ ] **Step 5: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/src/convert/ConversionRegistry.ts \
  packages/printer-core/src/core/LanguageDispatch.ts \
  packages/printer-core/src/core/PrintParseResult.ts \
  packages/printer-core/src/core/PrintParser.ts \
  packages/printer-core/src/core/PrinterLanguageDefinition.ts \
  packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts \
  packages/printer-core/src/core/index.ts \
  packages/printer-core/src/language/escpos/EscPosParser.ts \
  packages/printer-core/src/language/escpos/__tests__/EscPosParser.test.ts \
  packages/printer-core/src/language/tspl/TsplParser.ts \
  packages/printer-core/src/language/tspl/__tests__/TsplParser.test.ts \
  packages/printer-core/src/validation/languages/tspl/TsplValidator.ts
git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: unify printer parse results behind PrintParseResult" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Task 3: Thư mục `registry/`, `core/` chỉ còn contract

**Files:**
- Move: `core/LanguageRegistry.ts` → `registry/LanguageRegistry.ts`; `core/__tests__/LanguageDispatch.test.ts` → `registry/__tests__/LanguageDispatch.test.ts`; `core/PrinterCoreError.ts` → `core/UnsupportedLanguageError.ts`
- Delete: `core/LanguageDispatch.ts` (4 hàm dispatch sang `registry/`, mỗi hàm 1 file)
- Create: `registry/SupportedLanguages.ts`, `registry/lookupLanguage.ts`, `registry/compileTo.ts`, `registry/parseFrom.ts`, `registry/validateFor.ts`, `registry/previewFor.ts`, `registry/index.ts`, `core/CompileResult.ts`
- Modify: `registry/LanguageRegistry.ts` (import qua barrel), `core/PrintCompiler.ts` (tách `CompileResult`), `core/index.ts`, `src/index.ts` (export `./registry`)
- Test: `registry/__tests__/LanguageDispatch.test.ts` (import từ barrel `registry`, thêm ca `SUPPORTED_LANGUAGES`), `__tests__/phase2-integration.test.ts`, `convert/__tests__/PrinterConverter.test.ts` (chỉ sửa đường import)

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: `PrintParseResult`, `PrintParser` (Task 2).
- Produces (barrel `registry`, được `src/index.ts` export):
  - `LANGUAGE_REGISTRY` (giữ nguyên nội dung).
  - `SUPPORTED_LANGUAGES: readonly PrinterLanguage[]` — key của `LANGUAGE_REGISTRY`.
  - `compileTo(language, document, features?)`, `parseFrom(language, source): PrintParseResult`, `validateFor(language, source)`, `previewFor(language, document)` — chữ ký như cũ.
  - `lookupLanguage(language, capability)` chỉ dùng trong `registry/`, không export qua barrel.
- Barrel `core` còn: `PrinterLanguage`, `CompileResult`, `PrintCompiler`, `PrinterFeatures` (+ `CutterType`, `ImageMode`), `PrintParseResult`, `PrintParser`, `PrintPreview`, `PrintValidation`, `UnsupportedLanguageError`, `PrinterLanguageDefinition`.

- [ ] **Step 1: Chuyển file bằng git mv**

`core/__tests__/` chỉ có 1 file test nên sau khi chuyển là thư mục rỗng; `rmdir` xoá nó để `core/` không còn thư mục thừa.

```bash
mkdir -p packages/printer-core/src/registry/__tests__
git mv packages/printer-core/src/core/LanguageRegistry.ts packages/printer-core/src/registry/LanguageRegistry.ts
git mv packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts packages/printer-core/src/registry/__tests__/LanguageDispatch.test.ts
git mv packages/printer-core/src/core/PrinterCoreError.ts packages/printer-core/src/core/UnsupportedLanguageError.ts
rmdir packages/printer-core/src/core/__tests__
```

- [ ] **Step 2: Sửa test (patch `t3test`)**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-printer-core-registry.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t3test | git apply --ignore-whitespace -
```

<!-- patch:t3test -->
~~~diff
diff --git a/packages/printer-core/src/__tests__/phase2-integration.test.ts b/packages/printer-core/src/__tests__/phase2-integration.test.ts
index f444bdd..b13c6f2 100644
--- a/packages/printer-core/src/__tests__/phase2-integration.test.ts
+++ b/packages/printer-core/src/__tests__/phase2-integration.test.ts
@@ -3,7 +3,7 @@ import { TsplParser } from '../language/tspl/TsplParser';
 import { TsplValidator } from '../validation/languages/tspl/TsplValidator';
 import { EscPosCompiler } from '../language/escpos/EscPosCompiler';
 import { EscPosParser } from '../language/escpos/EscPosParser';
-import { compileTo, parseFrom, previewFor, validateFor } from '../core/LanguageDispatch';
+import { compileTo, parseFrom, previewFor, validateFor } from '../registry';
 import type { PrinterLanguage } from '../core/PrinterLanguage';
 import type { ResolvedPrintDocument } from '../document';
 
diff --git a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
index 8bf7c73..104d2bd 100644
--- a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
+++ b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
@@ -1,7 +1,7 @@
 import { convert } from '../PrinterConverter';
 import { SUPPORTED_SOURCES, SUPPORTED_TARGETS } from '../ConversionPath';
 import { ConversionRegistry } from '../ConversionRegistry';
-import { UnsupportedLanguageError } from '../../core/PrinterCoreError';
+import { UnsupportedLanguageError } from '../../core/UnsupportedLanguageError';
 import type { PrinterLanguage } from '../../core/PrinterLanguage';
 
 function bytesToBinaryString(bytes: number[]): string {
diff --git a/packages/printer-core/src/registry/__tests__/LanguageDispatch.test.ts b/packages/printer-core/src/registry/__tests__/LanguageDispatch.test.ts
index 265259a..4eb8c7f 100644
--- a/packages/printer-core/src/registry/__tests__/LanguageDispatch.test.ts
+++ b/packages/printer-core/src/registry/__tests__/LanguageDispatch.test.ts
@@ -1,5 +1,5 @@
-import { compileTo, parseFrom, validateFor, previewFor } from '../LanguageDispatch';
-import { UnsupportedLanguageError } from '../PrinterCoreError';
+import { compileTo, LANGUAGE_REGISTRY, parseFrom, previewFor, SUPPORTED_LANGUAGES, validateFor } from '..';
+import { UnsupportedLanguageError } from '../../core';
 import type { ResolvedPrintDocument } from '../../document';
 import { bytesToBinaryString } from '../../encoding';
 
@@ -64,6 +64,11 @@ describe('LanguageDispatch', () => {
     expect(() => previewFor(unknown, doc)).toThrow(UnsupportedLanguageError);
   });
 
+  it('SUPPORTED_LANGUAGES lấy đúng các ngôn ngữ đã đăng ký trong LANGUAGE_REGISTRY', () => {
+    expect([...SUPPORTED_LANGUAGES].sort()).toEqual(Object.keys(LANGUAGE_REGISTRY).sort());
+    expect([...SUPPORTED_LANGUAGES].sort()).toEqual(['escpos', 'tspl']);
+  });
+
   it('compileTo dùng chung compiler đã đăng ký nhưng cảnh báo không dồn sang lần compile sau', () => {
     compileTo('escpos', { ...doc, elements: [{ type: 'circle', options: { x: 0, y: 0, diameter: 10 } }] });
 
~~~

- [ ] **Step 3: Chạy test, xác nhận FAIL**

```bash
npx jest packages/printer-core/src/registry packages/printer-core/src/__tests__/phase2-integration.test.ts packages/printer-core/src/convert
```

Expected: `Test Suites: 3 failed, 3 total` với `Cannot find module '..'` (registry chưa có barrel), `Cannot find module '../registry'`, `Cannot find module './PrinterCoreError'`.

- [ ] **Step 4: Viết code (git rm + patch `t3impl`)**

```bash
git rm -q packages/printer-core/src/core/LanguageDispatch.ts
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-printer-core-registry.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t3impl | git apply --ignore-whitespace -
```

<!-- patch:t3impl -->
~~~diff
diff --git a/packages/printer-core/src/core/CompileResult.ts b/packages/printer-core/src/core/CompileResult.ts
new file mode 100644
index 0000000..d2f5bd9
--- /dev/null
+++ b/packages/printer-core/src/core/CompileResult.ts
@@ -0,0 +1,8 @@
+/** Kết quả compile: lệnh máy in + cảnh báo về những gì máy in không làm được. */
+export interface CompileResult<TOutput> {
+  /** Chuỗi lệnh (TSPL) hoặc byte (ESC/POS) để gửi tới máy in. */
+  readonly output: TOutput;
+
+  /** Field/element bị bỏ qua hoặc gộp vì ngôn ngữ không hỗ trợ; mỗi cảnh báo xuất hiện 1 lần. */
+  readonly warnings: readonly string[];
+}
diff --git a/packages/printer-core/src/core/PrintCompiler.ts b/packages/printer-core/src/core/PrintCompiler.ts
index 24951ba..b8bb35f 100644
--- a/packages/printer-core/src/core/PrintCompiler.ts
+++ b/packages/printer-core/src/core/PrintCompiler.ts
@@ -1,15 +1,7 @@
 import type { ResolvedPrintDocument } from '../document';
+import type { CompileResult } from './CompileResult';
 import type { PrinterFeatures } from './PrinterFeatures';
 
-/** Kết quả compile: lệnh máy in + cảnh báo về những gì máy in không làm được. */
-export interface CompileResult<TOutput> {
-  /** Chuỗi lệnh (TSPL) hoặc byte (ESC/POS) để gửi tới máy in. */
-  readonly output: TOutput;
-
-  /** Field/element bị bỏ qua hoặc gộp vì ngôn ngữ không hỗ trợ; mỗi cảnh báo xuất hiện 1 lần. */
-  readonly warnings: readonly string[];
-}
-
 /**
  * Biên dịch document thành lệnh máy in. Hiện chỉ ESC/POS đọc `features` (chọn code page); ngôn ngữ khác vẫn
  * nhận tham số này để mọi compiler được gọi theo cùng 1 chữ ký.
diff --git a/packages/printer-core/src/core/index.ts b/packages/printer-core/src/core/index.ts
index 620214b..6e23a86 100644
--- a/packages/printer-core/src/core/index.ts
+++ b/packages/printer-core/src/core/index.ts
@@ -1,11 +1,10 @@
 export * from './PrinterLanguage';
+export * from './CompileResult';
 export * from './PrintCompiler';
 export * from './PrinterFeatures';
 export * from './PrintParseResult';
 export * from './PrintParser';
 export * from './PrintPreview';
 export * from './PrintValidation';
-export * from './PrinterCoreError';
+export * from './UnsupportedLanguageError';
 export * from './PrinterLanguageDefinition';
-export * from './LanguageRegistry';
-export * from './LanguageDispatch';
diff --git a/packages/printer-core/src/index.ts b/packages/printer-core/src/index.ts
index 3783fcd..add46fb 100644
--- a/packages/printer-core/src/index.ts
+++ b/packages/printer-core/src/index.ts
@@ -8,6 +8,7 @@ export * from './encoding';
 export * from './language';
 export * from './preview';
 export * from './validation';
+export * from './registry';
 export * from './convert';
 export * from './catalog';
 export * from './template';
diff --git a/packages/printer-core/src/registry/LanguageRegistry.ts b/packages/printer-core/src/registry/LanguageRegistry.ts
index 2745087..bc07092 100644
--- a/packages/printer-core/src/registry/LanguageRegistry.ts
+++ b/packages/printer-core/src/registry/LanguageRegistry.ts
@@ -1,8 +1,7 @@
-import type { PrinterLanguage } from './PrinterLanguage';
-import type { PrinterLanguageDefinition } from './PrinterLanguageDefinition';
+import type { PrinterLanguage, PrinterLanguageDefinition } from '../core';
 import { EscPosCompiler, EscPosParser, TsplCompiler, TsplParser } from '../language';
-import { EscPosValidator, TsplValidator } from '../validation';
 import { EscPosPreviewRenderer, TsplPreviewRenderer } from '../preview';
+import { EscPosValidator, TsplValidator } from '../validation';
 
 /** Buộc field `language` của mỗi mục trùng với key, để 2 chỗ viết tên ngôn ngữ không thể lệch nhau. */
 type LanguageRegistry = {
diff --git a/packages/printer-core/src/registry/SupportedLanguages.ts b/packages/printer-core/src/registry/SupportedLanguages.ts
new file mode 100644
index 0000000..870b161
--- /dev/null
+++ b/packages/printer-core/src/registry/SupportedLanguages.ts
@@ -0,0 +1,5 @@
+import type { PrinterLanguage } from '../core';
+import { LANGUAGE_REGISTRY } from './LanguageRegistry';
+
+/** Ngôn ngữ printer-core hỗ trợ; lấy từ key của registry để không bao giờ lệch với những gì đã đăng ký. */
+export const SUPPORTED_LANGUAGES: readonly PrinterLanguage[] = Object.keys(LANGUAGE_REGISTRY) as PrinterLanguage[];
diff --git a/packages/printer-core/src/registry/compileTo.ts b/packages/printer-core/src/registry/compileTo.ts
new file mode 100644
index 0000000..c63b61f
--- /dev/null
+++ b/packages/printer-core/src/registry/compileTo.ts
@@ -0,0 +1,12 @@
+import type { CompileResult, PrinterFeatures, PrinterLanguage } from '../core';
+import type { ResolvedPrintDocument } from '../document';
+import { lookupLanguage } from './lookupLanguage';
+
+/** Compile document sang ngôn ngữ `language` cho máy in có năng lực `features`. */
+export function compileTo(
+  language: PrinterLanguage,
+  document: ResolvedPrintDocument,
+  features?: PrinterFeatures,
+): CompileResult<string | Uint8Array> {
+  return lookupLanguage(language, 'compiler').compiler.compile(document, features);
+}
diff --git a/packages/printer-core/src/registry/index.ts b/packages/printer-core/src/registry/index.ts
new file mode 100644
index 0000000..531cb19
--- /dev/null
+++ b/packages/printer-core/src/registry/index.ts
@@ -0,0 +1,6 @@
+export * from './LanguageRegistry';
+export * from './SupportedLanguages';
+export * from './compileTo';
+export * from './parseFrom';
+export * from './validateFor';
+export * from './previewFor';
diff --git a/packages/printer-core/src/registry/lookupLanguage.ts b/packages/printer-core/src/registry/lookupLanguage.ts
new file mode 100644
index 0000000..5c089de
--- /dev/null
+++ b/packages/printer-core/src/registry/lookupLanguage.ts
@@ -0,0 +1,12 @@
+import { UnsupportedLanguageError, type PrinterLanguage, type PrinterLanguageDefinition } from '../core';
+import { LANGUAGE_REGISTRY } from './LanguageRegistry';
+
+/**
+ * Theo kiểu thì registry luôn đủ ngôn ngữ, nhưng `language` có thể đến từ dữ liệu chưa kiểm tra kiểu (JSON,
+ * input người dùng) nên vẫn phải báo lỗi rõ thay vì văng `undefined`.
+ */
+export function lookupLanguage(language: PrinterLanguage, capability: string): PrinterLanguageDefinition {
+  const definition: PrinterLanguageDefinition | undefined = LANGUAGE_REGISTRY[language];
+  if (!definition) throw new UnsupportedLanguageError(language, capability);
+  return definition;
+}
diff --git a/packages/printer-core/src/registry/parseFrom.ts b/packages/printer-core/src/registry/parseFrom.ts
new file mode 100644
index 0000000..d050579
--- /dev/null
+++ b/packages/printer-core/src/registry/parseFrom.ts
@@ -0,0 +1,7 @@
+import type { PrinterLanguage, PrintParseResult } from '../core';
+import { lookupLanguage } from './lookupLanguage';
+
+/** ESC/POS nhận byte hoặc chuỗi 1 ký tự = 1 byte; TSPL nhận chuỗi hoặc byte UTF-8. */
+export function parseFrom(language: PrinterLanguage, source: string | Uint8Array): PrintParseResult {
+  return lookupLanguage(language, 'parser').parser.parse(source);
+}
diff --git a/packages/printer-core/src/registry/previewFor.ts b/packages/printer-core/src/registry/previewFor.ts
new file mode 100644
index 0000000..6293832
--- /dev/null
+++ b/packages/printer-core/src/registry/previewFor.ts
@@ -0,0 +1,8 @@
+import type { PrinterLanguage } from '../core';
+import type { ResolvedPrintDocument } from '../document';
+import { lookupLanguage } from './lookupLanguage';
+
+/** Vẽ preview SVG của document theo ngôn ngữ `language`. */
+export function previewFor(language: PrinterLanguage, document: ResolvedPrintDocument): string {
+  return lookupLanguage(language, 'preview renderer').previewRenderer.preview(document);
+}
diff --git a/packages/printer-core/src/registry/validateFor.ts b/packages/printer-core/src/registry/validateFor.ts
new file mode 100644
index 0000000..316afb0
--- /dev/null
+++ b/packages/printer-core/src/registry/validateFor.ts
@@ -0,0 +1,8 @@
+import type { PrinterLanguage } from '../core';
+import type { ValidationResult } from '../validation';
+import { lookupLanguage } from './lookupLanguage';
+
+/** Kiểm tra cú pháp chuỗi lệnh của ngôn ngữ `language`. */
+export function validateFor(language: PrinterLanguage, source: string): ValidationResult {
+  return lookupLanguage(language, 'validator').validator.validate(source);
+}
~~~

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `321 passed, 321 total`; `printer-preview` tsc sạch, Vitest `12 passed`; eslint `0 errors`.

- [ ] **Step 6: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/src/__tests__/phase2-integration.test.ts \
  packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts \
  packages/printer-core/src/core/CompileResult.ts \
  packages/printer-core/src/core/PrintCompiler.ts \
  packages/printer-core/src/core/index.ts \
  packages/printer-core/src/index.ts \
  packages/printer-core/src/registry/LanguageRegistry.ts \
  packages/printer-core/src/registry/SupportedLanguages.ts \
  packages/printer-core/src/registry/__tests__/LanguageDispatch.test.ts \
  packages/printer-core/src/registry/compileTo.ts \
  packages/printer-core/src/registry/index.ts \
  packages/printer-core/src/registry/lookupLanguage.ts \
  packages/printer-core/src/registry/parseFrom.ts \
  packages/printer-core/src/registry/previewFor.ts \
  packages/printer-core/src/registry/validateFor.ts
git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: move language registry and dispatch out of core" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Task 4: `convert()` dùng registry chung

**Files:**
- Delete: `packages/printer-core/src/convert/ConversionRegistry.ts`, `packages/printer-core/src/convert/ConversionPath.ts`
- Modify: `packages/printer-core/src/convert/PrinterConverter.ts`, `packages/printer-core/src/convert/ConversionResult.ts`, `packages/printer-core/src/convert/index.ts`, `packages/printer-preview/src/App.tsx`, `packages/printer-core/README.md`
- Test: `packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts` (xoá test `SUPPORTED_SOURCES/TARGETS` cùng code của nó; `SUPPORTED_LANGUAGES` đã có test ở Task 3)

**Interfaces:**
- Consumes: `parseFrom`, `compileTo`, `SUPPORTED_LANGUAGES` (Task 3, barrel `registry` / gốc `printer-core`); `bytesToBinaryString` (Task 1).
- Produces:
  - `convert(source: string, from: PrinterLanguage, to: PrinterLanguage): ConversionResult` — chữ ký và kết quả như cũ; ngôn ngữ lạ vẫn ném `UnsupportedLanguageError` (thông báo "parser"/"compiler").
  - Bỏ `ConversionRegistry`, `ParsedSource`, `ConversionRegistryEntry`, `ConversionPath`, `SUPPORTED_SOURCES`, `SUPPORTED_TARGETS`.

- [ ] **Step 1: Xoá file bằng git rm**

```bash
git rm -q packages/printer-core/src/convert/ConversionRegistry.ts packages/printer-core/src/convert/ConversionPath.ts
```

- [ ] **Step 2: Type-check, xác nhận FAIL**

```bash
npx tsc --noEmit -p packages/printer-core
```

Expected: lỗi ở `convert/index.ts`, `convert/PrinterConverter.ts`, `convert/__tests__/PrinterConverter.test.ts` (không tìm thấy module đã xoá).

- [ ] **Step 3: Áp patch `t4`**

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-28-printer-core-registry.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t4 | git apply --ignore-whitespace -
```

<!-- patch:t4 -->
~~~diff
diff --git a/packages/printer-core/README.md b/packages/printer-core/README.md
index 32401a3..6303612 100644
--- a/packages/printer-core/README.md
+++ b/packages/printer-core/README.md
@@ -53,17 +53,19 @@ src/
 ├── resolution/     # ghép template + data qua catalog, kế hoạch trang (planPages), tách repeat lồng
 ├── layout/         # đổi Length → dots theo DPI rồi xếp vị trí, sinh PrintElement[]
 ├── document/       # ResolvedPrintDocument + PrintElement (content/drawing/layout/control)
-├── core/           # contract: PrinterLanguage, PrintCompiler/Parser/Preview/Validation, PrinterFeatures,
-│                   # registry + dispatch compileTo/parseFrom/validateFor/previewFor
+├── core/           # contract: PrinterLanguage, PrintCompiler/Parser/Preview/Validation, CompileResult,
+│                   # PrintParseResult, PrinterFeatures, UnsupportedLanguageError
 ├── language/       # BitmapFont (TSPL), MagnifiedFont (ESC/POS), CompileWarnings
 │   ├── tspl/       # TsplCommand, TsplCompiler, TsplEncoder, TsplFontMetrics, TsplParser
 │   └── escpos/     # EscPosCommand, EscPosCompiler, EscPosCodePage, EscPos{Barcode,Image,QrCode}Encoder,
 │                   # EscPosFontMetrics, EscPosParser
 ├── preview/languages/{tspl,escpos}/      # preview SVG theo từng ngôn ngữ
 ├── validation/     # ValidationIssue, ValidationResult + languages/{tspl,escpos}/ validator
-├── convert/        # convert() giữa các ngôn ngữ, ConversionRegistry, SUPPORTED_SOURCES/TARGETS
+├── registry/       # LANGUAGE_REGISTRY, SUPPORTED_LANGUAGES, compileTo/parseFrom/validateFor/previewFor
+├── convert/        # convert() giữa TSPL và ESC/POS qua parseFrom + compileTo
 ├── formatting/     # TableColumn, formatTable/formatRow, validateTableColumns (bảng trong element table)
-├── encoding/       # CodePage, encodeTextForPrinter + encoders/ (CP437/857/858/866, Windows-1252/1258, UTF-8)
+├── encoding/       # CodePage, encodeTextForPrinter + encoders/ (CP437/857/858/866, Windows-1252/1258, UTF-8),
+│                   # binaryStringToBytes/bytesToBinaryString (chuỗi 1 ký tự = 1 byte)
 ├── image/          # crop/resize/threshold/dither ảnh thành bitmap đơn sắc + dithering/
 ├── symbology/      # barcode/ và qrcode/: cấu hình + validate
 └── testing/        # OrderTestCatalog — catalog đơn hàng + data mẫu dùng chung cho test (không export ra ngoài)
diff --git a/packages/printer-core/src/convert/ConversionResult.ts b/packages/printer-core/src/convert/ConversionResult.ts
index 73d7b64..ac4a305 100644
--- a/packages/printer-core/src/convert/ConversionResult.ts
+++ b/packages/printer-core/src/convert/ConversionResult.ts
@@ -4,7 +4,7 @@ import type { PrintElement } from '../document';
 export interface ConversionResult {
   /**
    * Lệnh ở ngôn ngữ đích. TSPL trả nguyên chuỗi lệnh; ESC/POS (ra byte) trả chuỗi 1 ký tự = 1 byte (0-255), lấy
-   * lại byte bằng `Uint8Array.from(output, (c) => c.charCodeAt(0))`.
+   * lại byte bằng `binaryStringToBytes(output)`.
    */
   output: string;
 
diff --git a/packages/printer-core/src/convert/PrinterConverter.ts b/packages/printer-core/src/convert/PrinterConverter.ts
index dbbb91f..cff24ff 100644
--- a/packages/printer-core/src/convert/PrinterConverter.ts
+++ b/packages/printer-core/src/convert/PrinterConverter.ts
@@ -1,6 +1,7 @@
-import { UnsupportedLanguageError, type PrinterLanguage } from '../core';
+import type { PrinterLanguage } from '../core';
 import type { ResolvedPrintDocument } from '../document';
-import { ConversionRegistry, type ConversionRegistryEntry } from './ConversionRegistry';
+import { bytesToBinaryString } from '../encoding';
+import { compileTo, parseFrom } from '../registry';
 import type { ConversionResult } from './ConversionResult';
 
 /** Khổ tem mặc định (dots) khi lệnh nguồn không khai báo khổ, VD ESC/POS không có lệnh khổ giấy. */
@@ -13,28 +14,12 @@ const DEFAULT_SPEED = 4;
 const DEFAULT_DENSITY = 8;
 const DEFAULT_COPIES = 1;
 
-/** Đổi byte đã compile thành chuỗi 1 ký tự = 1 byte, theo quy ước của `ConversionResult.output`. */
-function bytesToBinaryString(bytes: Uint8Array): string {
-  let out = '';
-  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
-  return out;
-}
-
-function lookup(language: PrinterLanguage, capability: 'conversion source' | 'conversion target'): ConversionRegistryEntry {
-  const entry: ConversionRegistryEntry | undefined = ConversionRegistry[language];
-  if (!entry) throw new UnsupportedLanguageError(language, capability);
-  return entry;
-}
-
 /**
  * Chuyển lệnh máy in từ ngôn ngữ `from` sang `to`: parse thành `PrintElement[]`, gói vào document với thiết lập
  * mặc định, rồi compile sang ngôn ngữ đích.
  */
 export function convert(source: string, from: PrinterLanguage, to: PrinterLanguage): ConversionResult {
-  const sourceEntry = lookup(from, 'conversion source');
-  const targetEntry = lookup(to, 'conversion target');
-
-  const parsed = sourceEntry.parse(source);
+  const parsed = parseFrom(from, source);
 
   const document: ResolvedPrintDocument = {
     widthDots: parsed.widthDots ?? DEFAULT_WIDTH_DOTS,
@@ -48,7 +33,7 @@ export function convert(source: string, from: PrinterLanguage, to: PrinterLangua
     elements: parsed.elements,
   };
 
-  const compiled = targetEntry.compile(document);
+  const compiled = compileTo(to, document);
   const output = typeof compiled.output === 'string' ? compiled.output : bytesToBinaryString(compiled.output);
 
   return { output, elements: parsed.elements, warnings: [...parsed.warnings, ...compiled.warnings] };
diff --git a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
index 104d2bd..cecbcbd 100644
--- a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
+++ b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
@@ -1,6 +1,4 @@
 import { convert } from '../PrinterConverter';
-import { SUPPORTED_SOURCES, SUPPORTED_TARGETS } from '../ConversionPath';
-import { ConversionRegistry } from '../ConversionRegistry';
 import { UnsupportedLanguageError } from '../../core/UnsupportedLanguageError';
 import type { PrinterLanguage } from '../../core/PrinterLanguage';
 
@@ -48,13 +46,6 @@ describe('convert', () => {
   it('throws a clear error for an unregistered target language', () => {
     expect(() => convert('SIZE 50 mm,30 mm\r\nCLS\r\nPRINT 1\r\n', 'tspl', 'made-up' as PrinterLanguage)).toThrow(UnsupportedLanguageError);
   });
-
-  it('derives SUPPORTED_SOURCES/SUPPORTED_TARGETS from ConversionRegistry, covering tspl and escpos', () => {
-    const registryKeys = Object.keys(ConversionRegistry).sort();
-    expect(registryKeys).toEqual(['escpos', 'tspl']);
-    expect([...SUPPORTED_SOURCES].sort()).toEqual(registryKeys);
-    expect([...SUPPORTED_TARGETS].sort()).toEqual(registryKeys);
-  });
 });
 
 describe('convert — cảnh báo', () => {
diff --git a/packages/printer-core/src/convert/index.ts b/packages/printer-core/src/convert/index.ts
index 6fb8766..8706e19 100644
--- a/packages/printer-core/src/convert/index.ts
+++ b/packages/printer-core/src/convert/index.ts
@@ -1,4 +1,2 @@
 export * from './PrinterConverter';
 export * from './ConversionResult';
-export * from './ConversionPath';
-export * from './ConversionRegistry';
diff --git a/packages/printer-preview/src/App.tsx b/packages/printer-preview/src/App.tsx
index 29d7011..e68564c 100644
--- a/packages/printer-preview/src/App.tsx
+++ b/packages/printer-preview/src/App.tsx
@@ -1,6 +1,6 @@
 // packages/printer-preview/src/App.tsx
 import { useEffect, useState } from 'react';
-import type { PrinterLanguage } from 'printer-core';
+import { SUPPORTED_LANGUAGES, type PrinterLanguage } from 'printer-core';
 import { CodeEditor } from './components/CodeEditor';
 import { DataEditor } from './components/DataEditor';
 import { PreviewPanel } from './components/PreviewPanel';
@@ -9,7 +9,6 @@ import { evaluateTemplate } from './evaluateTemplate';
 import { renderPreviews, defaultLanguageFor, type PagePreview } from './pipeline';
 import { defaultCode, defaultData } from './defaultSample';
 
-const LANGUAGES: readonly PrinterLanguage[] = ['tspl', 'escpos'];
 const RENDER_DEBOUNCE_MS = 500;
 
 interface RenderOutcome {
@@ -85,7 +84,7 @@ export function App() {
       </div>
       <div style={{ overflow: 'auto', padding: 8 }}>
         <select value={language} onChange={(event) => handleLanguageChange(event.target.value as PrinterLanguage)}>
-          {LANGUAGES.map((lang) => (
+          {SUPPORTED_LANGUAGES.map((lang) => (
             <option key={lang} value={lang}>
               {lang}
             </option>
~~~

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `320 passed, 320 total`; `printer-preview` tsc sạch, Vitest `12 passed`; eslint `0 errors`.

- [ ] **Step 5: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/README.md \
  packages/printer-core/src/convert/ConversionResult.ts \
  packages/printer-core/src/convert/PrinterConverter.ts \
  packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts \
  packages/printer-core/src/convert/index.ts \
  packages/printer-preview/src/App.tsx
git diff --cached -U0 -- '*.ts' '*.tsx' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: route convert through the language registry" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Kiểm tra cuối (sau Task 4)

```bash
grep -rnE "ParsedCommands|ConversionRegistry|ConversionPath|SUPPORTED_SOURCES|SUPPORTED_TARGETS|EscPosParseResult|PrinterCoreError|core/LanguageDispatch" packages/printer-core/src packages/printer-core/README.md packages/printer-preview/src
grep -rnE "^export (function|const) (parseTSPL|decodeEscPos)" packages/printer-core/src
grep -rnE "from '\.\./(language|preview|registry|convert)" packages/printer-core/src/core
grep -rnE "import [^t].*from '\.\./validation'" packages/printer-core/src/core
```

Expected: cả 4 lệnh không in gì (không còn tên cũ; `parseTSPL`/`decodeEscPos` không export; `core/` không import `language`/`preview`/`registry`/`convert`, chỉ `import type` từ `validation`).
