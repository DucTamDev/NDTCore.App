# printer-core Cleanup (R1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `printer-core` chỉ còn TSPL + ESC/POS, không còn code chết, `testing/` không lộ ra API công khai, README và comment đúng hiện trạng theo quy ước.

**Architecture:** Toàn bộ là xoá và dọn, không thêm tính năng:
- **Xoá:** 7 ngôn ngữ, preview dùng chung của chúng, và code chết đã liệt kê trong spec. Dùng `git rm`.
- **Sửa theo sau:** registry, convert, barrel và test chỉ còn nhắc TSPL/ESC-POS.
- **Hành vi giữ nguyên:** hành vi compile/parse/validate/preview của TSPL và ESC/POS không đổi. Test hiện có của 2 ngôn ngữ giữ nguyên là bằng chứng.

**Tech Stack:**
- TypeScript 5.9 strict.
- Jest (preset react-native) cho `printer-core`.
- Vitest cho `printer-preview`.
- `printer-core` không có dependency.

**Spec:** `docs/superpowers/specs/2026-09-26-printer-core-cleanup-design.md`, đợt R1 của `docs/superpowers/specs/2026-09-26-printer-core-restructure-overview.md`.

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
  - Test của code bị xoá thì xoá theo.
  - Test đang dùng ngôn ngữ bị xoá làm ví dụ thì đổi sang TSPL/ESC-POS.
- **Không đổi hành vi in** của TSPL và ESC/POS: cùng document → cùng lệnh máy in và cùng cảnh báo.
- **`printer-preview` phải còn chạy được:** type-check + Vitest xanh.

**Ràng buộc khác:**

- **Branch:** làm trên `refactor/printer-core-cleanup` (đã có commit spec và commit của plan này). Checkout thẳng trong working directory chính — **không dùng git worktree**, không commit thẳng `main`.
- **Stage file:**
  - File bị xoá được stage bởi chính `git rm` trong task; file sửa stage bằng lệnh `git add` cho sẵn.
  - **Không bao giờ** `git add -A` hay `git add .`. `.claude/worktrees/` giữ untracked.
- **Commit message:** dùng đúng 2 tham số `-m` cho trong task; dòng cuối là `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, nguyên văn.
- **Nơi chạy lệnh:** mọi lệnh chạy từ `C:\NDTCORE\NDTCore\NDTCore.App` bằng Git Bash.

### Cách áp code của plan

Phần **xoá** dùng lệnh `git rm` ghi sẵn trong task. Phần **sửa** nằm trong khối patch của chính file này: mỗi khối có đánh dấu `<!-- patch:<id> -->` đứng ngay trước khối `~~~diff`, mỗi task 1 patch `tN`.

**Lệnh áp 1 patch** (mỗi step đã ghi sẵn lệnh đầy đủ):

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-printer-core-cleanup.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" <id> | git apply --ignore-whitespace -
```

- `--ignore-whitespace` cần vì working tree có file CRLF lẫn LF.
- Lúc lập plan, cả 4 task (git rm + patch) đã được áp lần lượt lên clone của branch này (checkout CRLF) và cho ra đúng nội dung đã kiểm chứng.
- **Nếu `git rm` hoặc `git apply` báo lỗi: dừng lại, báo BLOCKED kèm nguyên văn lỗi.** Không tự sửa tay.

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
  git diff --cached -U0 -- '*.ts' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
  ```
  Expected: không in gì, exit 0.

## Review Focus

Các trường hợp spec ngụ ý nhưng dễ bị bỏ sót, xếp theo khả năng gây hại cao nhất trước:

1. **Chuyển đổi `convert()` giữa TSPL và ESC/POS** sau khi registry chỉ còn 2 mục.
   - Mong đợi: ESC/POS → TSPL và TSPL → TSPL vẫn đúng như trước; ngôn ngữ lạ báo `UnsupportedLanguageError`.
   - Chốt bằng: test converter giữ lại trong Task 1.
2. **Cảnh báo compile dồn giữa 2 lần `compileTo()`** trên compiler dùng chung trong registry.
   - Mong đợi: không dồn. Test này trước dùng EPL, Task 1 đổi sang ESC/POS (ESC/POS cũng cảnh báo hình tròn).
3. **Chuỗi ESC/POS dạng 1 ký tự = 1 byte có byte ≥ 0x80** khi `convert()` từ ESC/POS.
   - Mong đợi: đọc đúng byte, không qua UTF-8. `toBytes` giữ nguyên logic; chỉ đổi comment.
4. **`printer-preview` chọn ngôn ngữ:** danh sách chỉ còn `tspl`, `escpos`.
   - Mong đợi: trang preview không còn chọn được ngôn ngữ đã xoá; Vitest xanh.
5. **Import `testing/` từ bên ngoài package** (qua `printer-core`) không còn.
   - Mong đợi: test trong package vẫn import `testing/` bằng đường dẫn tương đối và xanh; `printer-preview` không dùng `testing/`.

## Các quyết định lệch khỏi spec (đã chốt khi lập plan)

| # | Spec | Plan | Lý do |
|---|---|---|---|
| 1 | Xoá hàm `encodeTcvn3`, "giữ phần encoder đang được dùng" | Xoá cả file `encoding/encoders/Tcvn3Encoder.ts` + test | Cả file chỉ có `encodeTcvn3` và kiểu `Tcvn3Mapping`, không nơi nào dùng; không còn phần nào để giữ |
| 2 | `document/__tests__/PrintDocument.test.ts` chỉ đổi tên `describe` nếu còn nhắc `PrintDocument` | Đổi `describe` thành `PrintElement / ResolvedPrintDocument`; giữ tên file | Test vẫn kiểm tra `PrintElement`/`ResolvedPrintDocument`; đổi tên file là việc của R5 |
| 3 | Chỉ nói bỏ comment nhắc ngôn ngữ đã xoá trong `convert/` | Task 1 viết lại toàn bộ comment/JSDoc của 4 file `convert/` sang tiếng Việt, và đổi import sang barrel | Các file này bị sửa gần hết trong Task 1; viết comment đúng quy ước ngay để Task 4 không sửa lại lần nữa |
| 4 | Task comment chỉ đổi comment | Task 4 thêm JSDoc tiếng Việt cho field của vài interface đang thiếu (`ValidationIssue`, `ValidationResult`, `ImageSource`, `QrCodeModel`, `BarcodeValidationIssue`, `CodePage`, `EncodingResult`) | Quy ước 1 áp cho mọi file được sửa |

## Phát hiện ngoài phạm vi (không sửa trong R1)

- **Tiếng Việt có dấu trên ESC/POS thành `?`:** `encoding/encoders/Windows1258Encoder.ts` (CP1258, bảng mã tiếng Việt) có định nghĩa nhưng **không** nằm trong `CODE_PAGE_LIST` của `encoding/CodePageEncoder.ts`. Với máy ESC/POS không bật `nativeUtf8`, chữ tiếng Việt có dấu hiện bị mã hoá thành `?`. Đây là thay đổi hành vi, cần quyết định riêng.

---

### Task 1: Xoá 7 ngôn ngữ, chỉ giữ TSPL và ESC/POS

**Files:**
- Delete: `language/`, `preview/languages/`, `validation/languages/` của ZPL, EPL, CPCL, DPL, SBPL, Star PRNT, IPL (kể cả `__tests__` bên trong); `preview/PreviewRenderer.ts` + test
- Modify: `__tests__/phase2-integration.test.ts`, `convert/ConversionPath.ts`, `convert/ConversionRegistry.ts`, `convert/ConversionResult.ts`, `convert/PrinterConverter.ts`, `convert/__tests__/PrinterConverter.test.ts`, `core/LanguageRegistry.ts`, `core/PrinterLanguage.ts`, `core/__tests__/LanguageDispatch.test.ts`, `language/index.ts`, `preview/index.ts`, `preview/languages/index.ts`, `validation/index.ts`, `packages/printer-preview/src/App.tsx`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: không có.
- Produces:
  - `PrinterLanguage = 'tspl' | 'escpos'`.
  - `LANGUAGE_REGISTRY`, `ConversionRegistry` chỉ còn mục `tspl`, `escpos`; `SUPPORTED_SOURCES`/`SUPPORTED_TARGETS` = `['tspl', 'escpos']`.
  - Chữ ký `compileTo`/`parseFrom`/`validateFor`/`previewFor`/`convert` không đổi.
  - `printer-preview` chỉ cho chọn `tspl`, `escpos`.

- [ ] **Step 1: Kiểm tra branch và working tree**

```bash
git branch --show-current
git status --short
git log --oneline -2
```

Expected:
- Branch là `refactor/printer-core-cleanup`.
- Commit mới nhất là `docs: add printer-core cleanup implementation plan`, trước đó là `docs: add printer-core restructure overview and cleanup design`.
- `git status` chỉ có file untracked (`??`, VD `.claude/worktrees/`).

Nếu có thay đổi chưa commit ở file đã track: **dừng lại, hỏi user**. Không tự stash hay revert.

- [ ] **Step 2: Xoá file bằng git rm**

```bash
git rm -rq packages/printer-core/src/language/{zpl,epl,cpcl,dpl,sbpl,starprnt,ipl} packages/printer-core/src/preview/languages/{zpl,epl,cpcl,dpl,sbpl,starprnt,ipl} packages/printer-core/src/validation/languages/{zpl,epl,cpcl,dpl,sbpl,starprnt,ipl}
git rm -q packages/printer-core/src/preview/PreviewRenderer.ts packages/printer-core/src/preview/__tests__/PreviewRenderer.test.ts
```

- [ ] **Step 3: Type-check, xác nhận FAIL**

```bash
npx tsc --noEmit -p packages/printer-core
```

Expected: FAIL — lỗi ở các file còn tham chiếu phần đã xoá (registry, convert, barrel, test tích hợp/dispatch/convert). Lúc lập plan: 64 lỗi `error TS`.

- [ ] **Step 4: Áp patch**

Patch làm các việc sau:
- **Registry, convert, barrel:** chỉ còn TSPL/ESC-POS; `convert/` viết lại comment tiếng Việt và import qua barrel.
- **`printer-preview`:** danh sách ngôn ngữ rút còn `tspl`, `escpos`.
- **Test:**
  - Bỏ ca của 7 ngôn ngữ trong `phase2-integration.test.ts`, `LanguageDispatch.test.ts`, `PrinterConverter.test.ts`.
  - 2 test dùng EPL làm ví dụ cảnh báo đổi sang ESC/POS.
  - Bỏ hằng `TSPL_SOURCE` không còn dùng.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-printer-core-cleanup.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t1 | git apply --ignore-whitespace -
```

<!-- patch:t1 -->
~~~diff
diff --git a/packages/printer-core/src/__tests__/phase2-integration.test.ts b/packages/printer-core/src/__tests__/phase2-integration.test.ts
index 9d96a6a..f444bdd 100644
--- a/packages/printer-core/src/__tests__/phase2-integration.test.ts
+++ b/packages/printer-core/src/__tests__/phase2-integration.test.ts
@@ -65,16 +65,11 @@ describe('Phase 1 end-to-end', () => {
   });
 });
 
-// All 9 `PrinterLanguage` values now have a real implementation (Phase 2
-// complete). Two of them — "escpos" and "starprnt" — compile to raw
-// `Uint8Array` (binary protocols); the rest compile to `string`. That split
-// is an intentional, documented protocol difference (see `LanguageDispatch`'s
-// own unit test, which likewise only runs `validateFor` on the string-source
-// languages), not something this loop should paper over.
-const ALL_LANGUAGES: readonly PrinterLanguage[] = ['tspl', 'escpos', 'zpl', 'epl', 'cpcl', 'dpl', 'sbpl', 'starprnt', 'ipl'];
-const BINARY_LANGUAGES = new Set<PrinterLanguage>(['escpos', 'starprnt']);
+// ESC/POS compile ra `Uint8Array` (giao thức nhị phân), TSPL ra `string`; validateFor chỉ nhận chuỗi.
+const ALL_LANGUAGES: readonly PrinterLanguage[] = ['tspl', 'escpos'];
+const BINARY_LANGUAGES = new Set<PrinterLanguage>(['escpos']);
 
-describe('Phase 2 end-to-end: full 9-language coverage', () => {
+describe('Phase 2 end-to-end: mọi ngôn ngữ được hỗ trợ', () => {
   describe.each(ALL_LANGUAGES)('%s', (language) => {
     it('compiles, parses, validates, and previews the representative document', () => {
       const compiled = compileTo(language, doc).output;
diff --git a/packages/printer-core/src/convert/ConversionPath.ts b/packages/printer-core/src/convert/ConversionPath.ts
index 926029f..5a3aaf4 100644
--- a/packages/printer-core/src/convert/ConversionPath.ts
+++ b/packages/printer-core/src/convert/ConversionPath.ts
@@ -1,23 +1,20 @@
-import type { PrinterLanguage } from '../core/PrinterLanguage';
+import type { PrinterLanguage } from '../core';
 import { ConversionRegistry } from './ConversionRegistry';
 
-/** A single source-to-target conversion pair. */
+/** 1 cặp chuyển đổi nguồn → đích. */
 export interface ConversionPath {
+  /** Ngôn ngữ của lệnh nguồn. */
   from: PrinterLanguage;
+
+  /** Ngôn ngữ cần chuyển sang. */
   to: PrinterLanguage;
 }
 
-/**
- * Derived from `ConversionRegistry`'s own keys rather than hand-maintained,
- * so this list can never drift out of sync with what the registry actually
- * supports — unlike portakal's `SUPPORTED_SOURCES`/`SUPPORTED_TARGETS`,
- * which are two separately hand-written arrays that could silently diverge
- * from `parseSource()`/`compileTarget()`'s own switch statements.
- */
+// Lấy từ chính key của registry để danh sách không bao giờ lệch với những gì registry hỗ trợ.
 const REGISTERED_LANGUAGES = Object.keys(ConversionRegistry) as PrinterLanguage[];
 
-/** Every `PrinterLanguage` usable as a conversion source. */
+/** Các ngôn ngữ dùng được làm nguồn chuyển đổi. */
 export const SUPPORTED_SOURCES: PrinterLanguage[] = [...REGISTERED_LANGUAGES];
 
-/** Every `PrinterLanguage` usable as a conversion target. */
+/** Các ngôn ngữ dùng được làm đích chuyển đổi. */
 export const SUPPORTED_TARGETS: PrinterLanguage[] = [...REGISTERED_LANGUAGES];
diff --git a/packages/printer-core/src/convert/ConversionRegistry.ts b/packages/printer-core/src/convert/ConversionRegistry.ts
index debd363..7f892e5 100644
--- a/packages/printer-core/src/convert/ConversionRegistry.ts
+++ b/packages/printer-core/src/convert/ConversionRegistry.ts
@@ -1,37 +1,28 @@
-import type { CompileResult } from '../core';
-import type { PrinterLanguage } from '../core/PrinterLanguage';
-import type { ResolvedPrintDocument } from '../document';
-import type { PrintElement } from '../document/elements/PrintElement';
-import { parseTSPL } from '../language/tspl/TsplParser';
-import { TsplCompiler } from '../language/tspl/TsplCompiler';
-import { parseZPL } from '../language/zpl/ZplParser';
-import { ZplCompiler } from '../language/zpl/ZplCompiler';
-import { parseEPL } from '../language/epl/EplParser';
-import { EplCompiler } from '../language/epl/EplCompiler';
-import { parseCPCL } from '../language/cpcl/CpclParser';
-import { CpclCompiler } from '../language/cpcl/CpclCompiler';
-import { parseDPL } from '../language/dpl/DplParser';
-import { DplCompiler } from '../language/dpl/DplCompiler';
-import { parseSBPL } from '../language/sbpl/SbplParser';
-import { SbplCompiler } from '../language/sbpl/SbplCompiler';
-import { decodeEscPos } from '../language/escpos/EscPosParser';
-import { EscPosCompiler } from '../language/escpos/EscPosCompiler';
-import { decodeStarPrnt } from '../language/starprnt/StarPrntParser';
-import { StarPrntCompiler } from '../language/starprnt/StarPrntCompiler';
-import { parseIPL } from '../language/ipl/IplParser';
-import { IplCompiler } from '../language/ipl/IplCompiler';
+import type { CompileResult, PrinterLanguage } from '../core';
+import type { PrintElement, ResolvedPrintDocument } from '../document';
+import { decodeEscPos, EscPosCompiler, parseTSPL, TsplCompiler } from '../language';
 
-/** Elements plus whatever dimension/warning data a language's parser is able to recover from source code. Width/height are omitted (not `0`) when a language's parser has no notion of them, so `PrinterConverter` can tell "not provided" apart from a real `0`. */
+/** Những gì parser của 1 ngôn ngữ dựng lại được từ lệnh máy in. */
 export interface ParsedSource {
+  /** Element dựng lại từ lệnh. */
   elements: PrintElement[];
+
+  /** Khổ ngang (dots); bỏ trống khi ngôn ngữ không có lệnh khai báo khổ, để phân biệt với giá trị 0 thật. */
   widthDots?: number;
+
+  /** Chiều dài tem (dots); bỏ trống khi ngôn ngữ không có lệnh khai báo, để phân biệt với giá trị 0 thật. */
   heightDots?: number;
+
+  /** Lệnh không nhận diện được hoặc dữ liệu hỏng gặp khi parse. */
   warnings: string[];
 }
 
-/** One `PrinterLanguage`'s parse/compile pair, looked up by `PrinterConverter`. */
+/** Cặp parse/compile của 1 ngôn ngữ mà `convert()` tra cứu. */
 export interface ConversionRegistryEntry {
+  /** Đọc lệnh máy in thành element. */
   parse: (source: string | Uint8Array) => ParsedSource;
+
+  /** Compile document thành lệnh của ngôn ngữ này. */
   compile: (document: ResolvedPrintDocument) => CompileResult<string | Uint8Array>;
 }
 
@@ -40,78 +31,31 @@ function toText(source: string | Uint8Array): string {
 }
 
 /**
- * Byte-oriented languages (escpos, starprnt) treat a `string` source as a
- * binary string — one character per byte (0-255) — the same convention
- * `EscPosValidator`/`StarPrntValidator` already use, so a value produced by
- * `PrinterConverter`'s own byte-target encoding round-trips back into bytes
- * without going through a lossy text codec (e.g. UTF-8) that would corrupt
- * any byte >= 0x80.
+ * ESC/POS nhận `string` theo quy ước 1 ký tự = 1 byte (0-255), giống `EscPosValidator`, để output byte của chính
+ * `convert()` đọc ngược lại được; giải mã qua UTF-8 sẽ làm hỏng mọi byte >= 0x80.
  */
 function toBytes(source: string | Uint8Array): Uint8Array {
   if (source instanceof Uint8Array) return source;
   const bytes = new Uint8Array(source.length);
-  // eslint-disable-next-line no-bitwise -- clamping each char code to a single byte
+  // eslint-disable-next-line no-bitwise -- giữ đúng 1 byte cho mỗi ký tự
   for (let i = 0; i < source.length; i++) bytes[i] = source.charCodeAt(i) & 0xff;
   return bytes;
 }
 
-/**
- * Looks up a `PrinterLanguage`'s parser and compiler for cross-compilation.
- * Replaces portakal's two hardcoded switch statements (`parseSource()`/
- * `compileTarget()` in `convert.ts`) with a genuine lookup table.
- *
- * Unlike portakal's `SourceLanguage`, every language here is a valid
- * conversion source, including escpos and starprnt: their parsers
- * (`decodeEscPos`, `decodeStarPrnt`) already recover real `PrintElement[]`
- * from byte input, the same as any text-protocol language's parser — there
- * was no technical reason to keep them target-only.
- */
+/** Parse/compile của từng ngôn ngữ, dùng khi chuyển lệnh từ ngôn ngữ này sang ngôn ngữ khác. */
 export const ConversionRegistry: Record<PrinterLanguage, ConversionRegistryEntry> = {
   tspl: {
     parse: (source) => {
       const result = parseTSPL(toText(source));
-      return { elements: result.elements, widthDots: result.widthDots, heightDots: result.heightDots, warnings: result.warnings };
+      return {
+        elements: result.elements,
+        widthDots: result.widthDots,
+        heightDots: result.heightDots,
+        warnings: result.warnings,
+      };
     },
     compile: (document) => new TsplCompiler().compile(document),
   },
-  zpl: {
-    parse: (source) => {
-      const result = parseZPL(toText(source));
-      return { elements: result.elements, widthDots: result.widthDots, heightDots: result.heightDots, warnings: result.warnings };
-    },
-    compile: (document) => new ZplCompiler().compile(document),
-  },
-  epl: {
-    parse: (source) => {
-      const result = parseEPL(toText(source));
-      // EPL's own parser initializes heightDots to 0 when no `Q` (label
-      // length) command appears — falsy, not a real dimension, so it's
-      // dropped here and left for PrinterConverter's default to fill in.
-      return { elements: result.elements, widthDots: result.widthDots, heightDots: result.heightDots || undefined, warnings: result.warnings };
-    },
-    compile: (document) => new EplCompiler().compile(document),
-  },
-  cpcl: {
-    parse: (source) => {
-      const result = parseCPCL(toText(source));
-      return { elements: result.elements, widthDots: result.widthDots, heightDots: result.heightDots, warnings: result.warnings };
-    },
-    compile: (document) => new CpclCompiler().compile(document),
-  },
-  dpl: {
-    parse: (source) => {
-      const result = parseDPL(toText(source));
-      return { elements: result.elements, widthDots: result.widthDots, warnings: result.warnings };
-    },
-    compile: (document) => new DplCompiler().compile(document),
-  },
-  sbpl: {
-    parse: (source) => {
-      const result = parseSBPL(toText(source));
-      return { elements: result.elements, warnings: result.warnings };
-    },
-    compile: (document) => new SbplCompiler().compile(document),
-  },
   escpos: {
     parse: (source) => {
       const result = decodeEscPos(toBytes(source));
@@ -119,18 +63,4 @@ export const ConversionRegistry: Record<PrinterLanguage, ConversionRegistryEntry
     },
     compile: (document) => new EscPosCompiler().compile(document),
   },
-  starprnt: {
-    parse: (source) => {
-      const result = decodeStarPrnt(toBytes(source));
-      return { elements: result.elements, warnings: result.warnings };
-    },
-    compile: (document) => new StarPrntCompiler().compile(document),
-  },
-  ipl: {
-    parse: (source) => {
-      const result = parseIPL(toText(source));
-      return { elements: result.elements, widthDots: result.widthDots, heightDots: result.heightDots, warnings: result.warnings };
-    },
-    compile: (document) => new IplCompiler().compile(document),
-  },
 };
diff --git a/packages/printer-core/src/convert/ConversionResult.ts b/packages/printer-core/src/convert/ConversionResult.ts
index e04b1b9..73d7b64 100644
--- a/packages/printer-core/src/convert/ConversionResult.ts
+++ b/packages/printer-core/src/convert/ConversionResult.ts
@@ -1,22 +1,16 @@
-import type { PrintElement } from '../document/elements/PrintElement';
+import type { PrintElement } from '../document';
 
-/**
- * Result of converting printer source code from one `PrinterLanguage` to
- * another (see `convert()` in `PrinterConverter.ts`).
- */
+/** Kết quả chuyển lệnh máy in từ ngôn ngữ này sang ngôn ngữ khác (xem `convert()`). */
 export interface ConversionResult {
   /**
-   * Compiled output in the target language. A string-producing target
-   * (tspl, zpl, epl, cpcl, dpl, sbpl, ipl) returns its native text as-is. A
-   * byte-producing target (escpos, starprnt) is returned as a binary
-   * string — one character per output byte (0-255) — matching this
-   * package's existing escpos/starprnt convention (see `EscPosValidator`'s
-   * `bytesFromSource()`). Recover the raw bytes with
-   * `Uint8Array.from(output, (c) => c.charCodeAt(0))`.
+   * Lệnh ở ngôn ngữ đích. TSPL trả nguyên chuỗi lệnh; ESC/POS (ra byte) trả chuỗi 1 ký tự = 1 byte (0-255), lấy
+   * lại byte bằng `Uint8Array.from(output, (c) => c.charCodeAt(0))`.
    */
   output: string;
-  /** Elements recovered from parsing the source, before target compilation. */
+
+  /** Element dựng lại khi parse lệnh nguồn, trước khi compile sang ngôn ngữ đích. */
   elements: PrintElement[];
+
   /**
    * Cảnh báo khi parse source (VD lệnh không nhận diện được) và khi compile sang
    * ngôn ngữ đích (VD element không hỗ trợ).
diff --git a/packages/printer-core/src/convert/PrinterConverter.ts b/packages/printer-core/src/convert/PrinterConverter.ts
index 0e8a301..dbbb91f 100644
--- a/packages/printer-core/src/convert/PrinterConverter.ts
+++ b/packages/printer-core/src/convert/PrinterConverter.ts
@@ -1,10 +1,9 @@
-import type { PrinterLanguage } from '../core/PrinterLanguage';
+import { UnsupportedLanguageError, type PrinterLanguage } from '../core';
 import type { ResolvedPrintDocument } from '../document';
-import { UnsupportedLanguageError } from '../core/PrinterCoreError';
 import { ConversionRegistry, type ConversionRegistryEntry } from './ConversionRegistry';
 import type { ConversionResult } from './ConversionResult';
 
-/** Fallback label dimensions for a source language whose parser has no notion of them (e.g. sbpl) or didn't find a sizing command in this particular document (e.g. dpl) — matches portakal's own `convert()` fallback. */
+/** Khổ tem mặc định (dots) khi lệnh nguồn không khai báo khổ, VD ESC/POS không có lệnh khổ giấy. */
 const DEFAULT_WIDTH_DOTS = 320;
 const DEFAULT_HEIGHT_DOTS = 240;
 
@@ -14,7 +13,7 @@ const DEFAULT_SPEED = 4;
 const DEFAULT_DENSITY = 8;
 const DEFAULT_COPIES = 1;
 
-/** Encodes compiled bytes as the same one-character-per-byte binary string `ConversionResult.output` documents. */
+/** Đổi byte đã compile thành chuỗi 1 ký tự = 1 byte, theo quy ước của `ConversionResult.output`. */
 function bytesToBinaryString(bytes: Uint8Array): string {
   let out = '';
   for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
@@ -28,12 +27,8 @@ function lookup(language: PrinterLanguage, capability: 'conversion source' | 'co
 }
 
 /**
- * Converts printer source code from one `PrinterLanguage` to another: parses
- * `source` into this package's shared `PrintElement[]` representation via
- * `from`'s registered parser, wraps it in a minimal `ResolvedPrintDocument`,
- * then compiles it for `to` via its registered compiler. Ported from
- * portakal's `convert()`, now dispatching through `ConversionRegistry`
- * instead of two switch statements.
+ * Chuyển lệnh máy in từ ngôn ngữ `from` sang `to`: parse thành `PrintElement[]`, gói vào document với thiết lập
+ * mặc định, rồi compile sang ngôn ngữ đích.
  */
 export function convert(source: string, from: PrinterLanguage, to: PrinterLanguage): ConversionResult {
   const sourceEntry = lookup(from, 'conversion source');
diff --git a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
index d3dad53..3513604 100644
--- a/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
+++ b/packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts
@@ -8,24 +8,7 @@ function bytesToBinaryString(bytes: number[]): string {
   return String.fromCharCode(...bytes);
 }
 
-/** One 50x30mm label carrying a single text field — the shared input for every "TSPL to X" case below. */
-const TSPL_SOURCE = 'SIZE 50 mm,30 mm\r\nCLS\r\nTEXT 10,10,"3",0,1,1,"Hello"\r\nPRINT 1\r\n';
-
 describe('convert', () => {
-  it('converts a TSPL label to recognizable ZPL syntax', () => {
-    const tsplSource = TSPL_SOURCE;
-
-    const result = convert(tsplSource, 'tspl', 'zpl');
-
-    expect(result.output).toContain('^XA');
-    expect(result.output).toContain('^FDHello^FS');
-    expect(result.output).toContain('^XZ');
-    expect(result.elements).toEqual([
-      { type: 'text', content: 'Hello', options: { x: 10, y: 10, fontSize: 24, rotation: 0 } },
-    ]);
-    expect(result.warnings).toEqual([]);
-  });
-
   it('converts an ESC/POS byte stream to recognizable TSPL syntax', () => {
     // ESC @ (init) + "Hello" (printable ASCII) + LF
     const escposSource = bytesToBinaryString([0x1b, 0x40, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x0a]);
@@ -46,145 +29,18 @@ describe('convert', () => {
     ]);
   });
 
-  it('converts an EPL label to recognizable ZPL syntax', () => {
-    const eplSource = ['N', 'q320', 'Q240,24', 'A10,20,0,2,1,1,N,"Hello EPL"'].join('\n');
-
-    const result = convert(eplSource, 'epl', 'zpl');
-
-    expect(result.output).toContain('^XA');
-    expect(result.output).toContain('^FDHello EPL^FS');
-    expect(result.output).toContain('^XZ');
-    expect(result.elements).toEqual([
-      { type: 'text', content: 'Hello EPL', options: { x: 10, y: 20, rotation: 0, fontSize: 16, reverse: undefined } },
-    ]);
-    expect(result.warnings).toEqual([]);
-  });
-
-  it('converts a TSPL label to recognizable EPL syntax', () => {
-    const result = convert(TSPL_SOURCE, 'tspl', 'epl');
-
-    expect(result.output).toContain('A10,10,0,4,1,1,N,"Hello"');
-    expect(result.output).toContain('q400');
-    expect(result.warnings).toEqual([]);
-  });
-
-  it('converts a CPCL label to recognizable ZPL syntax', () => {
-    const cpclSource = ['! 0 203 203 240 1', 'PAGE-WIDTH 320', 'TEXT 2 0 10 20', 'Hello CPCL', 'PRINT'].join('\r\n');
-
-    const result = convert(cpclSource, 'cpcl', 'zpl');
-
-    expect(result.output).toContain('^XA');
-    expect(result.output).toContain('^FDHello CPCL^FS');
-    expect(result.elements).toEqual([{ type: 'text', content: 'Hello CPCL', options: { x: 10, y: 20, fontSize: 12 } }]);
-    expect(result.warnings).toEqual([]);
-  });
-
-  it('converts a TSPL label to recognizable CPCL syntax', () => {
-    const result = convert(TSPL_SOURCE, 'tspl', 'cpcl');
-
-    expect(result.output).toContain('TEXT 5 0 10 10\r\nHello');
-    expect(result.output).toContain('PAGE-WIDTH 400');
-    expect(result.output).toContain('PRINT');
-  });
-
-  it('converts a DPL label to recognizable ZPL syntax', () => {
-    // DplParser recovers content with a fixed 20-char offset guess, which is
-    // one short for a single-digit font — hence the leading "9" surviving
-    // into the converted text. Asserted as-is: the conversion path must not
-    // quietly differ from what the parser actually produces.
-    const record = '1' + '0010' + '0020' + '0001' + '0001' + '0009' + 'Hello';
-    const dplSource = ['\x02L', 'A0320', record, 'E'].join('\r\n');
-
-    const result = convert(dplSource, 'dpl', 'zpl');
-
-    expect(result.output).toContain('^XA');
-    expect(result.output).toContain('^FD9Hello^FS');
-    expect(result.elements).toEqual([{ type: 'text', content: '9Hello', options: { x: 10, y: 20 } }]);
-  });
-
-  it('converts a TSPL label to recognizable DPL syntax', () => {
-    const result = convert(TSPL_SOURCE, 'tspl', 'dpl');
-
-    expect(result.output).toContain('\x02L');
-    expect(result.output).toContain('Hello');
-    expect(result.output).toContain('A0400');
-  });
-
-  it('converts an SBPL label to recognizable ZPL syntax', () => {
-    const sbplSource = '\x1bA\x1bCS\x1bH0100\x1bV0050\x1bL0202\x1bK9BHello SATO\x1bZ';
-
-    const result = convert(sbplSource, 'sbpl', 'zpl');
-
-    expect(result.output).toContain('^XA');
-    expect(result.output).toContain('^FDHello SATO^FS');
-    expect(result.elements).toEqual([{ type: 'text', content: 'Hello SATO', options: { x: 100, y: 50 } }]);
-    expect(result.warnings).toEqual([]);
-  });
-
-  it('converts a TSPL label to recognizable SBPL syntax', () => {
-    const result = convert(TSPL_SOURCE, 'tspl', 'sbpl');
-
-    expect(result.output).toContain('\x1bA');
-    expect(result.output).toContain('\x1bH0010');
-    expect(result.output).toContain('\x1bV0010');
-    expect(result.output).toContain('\x1bK9BHello');
-    expect(result.output).toContain('\x1bZ');
-  });
-
-  it('converts an IPL label to recognizable ZPL syntax', () => {
-    const iplSource = ['\x02<SI>W320\x03', '\x02<SI>L240\x03', '\x02H1;o50,30;f0;h12;w12;c26;d3,Hello IPL\x03'].join('');
-
-    const result = convert(iplSource, 'ipl', 'zpl');
-
-    expect(result.output).toContain('^XA');
-    expect(result.output).toContain('^FDHello IPL^FS');
-    expect(result.elements).toContainEqual({ type: 'text', content: 'Hello IPL', options: { x: 50, y: 30 } });
-    expect(result.warnings).toEqual([]);
-  });
-
-  it('converts a TSPL label to recognizable IPL syntax', () => {
-    const result = convert(TSPL_SOURCE, 'tspl', 'ipl');
-
-    expect(result.output).toContain('\x02\x1bC1\x03');
-    expect(result.output).toContain('H1;o10,10');
-    expect(result.output).toContain('Hello');
-    expect(result.output).toContain('\x02R\x03');
-  });
-
-  it('converts a Star PRNT byte stream to recognizable ZPL syntax', () => {
-    // ESC @ (init) + "Hello Star" + LF
-    const starSource = bytesToBinaryString([0x1b, 0x40, ...Array.from(new TextEncoder().encode('Hello Star')), 0x0a]);
-
-    const result = convert(starSource, 'starprnt', 'zpl');
-
-    expect(result.output).toContain('^XA');
-    expect(result.output).toContain('^FDHello Star^FS');
-    expect(result.elements).toEqual([{ type: 'text', content: 'Hello Star', options: { align: 'left', bold: undefined } }]);
-    expect(result.warnings).toEqual([]);
-  });
-
-  it('converts a TSPL label to a Star PRNT byte stream, returned as a one-char-per-byte binary string', () => {
-    const result = convert(TSPL_SOURCE, 'tspl', 'starprnt');
-
-    // ESC @ (initialize) leads every Star PRNT document this package emits.
-    expect(result.output.slice(0, 2)).toBe('\x1b\x40');
-    expect(result.output).toContain('Hello');
-    // ESC GS a n (alignment) is Star-specific and proves this isn't ESC/POS output.
-    expect(result.output).toContain('\x1b\x1da');
-  });
-
   it('throws a clear error for an unregistered source language', () => {
-    expect(() => convert('irrelevant', 'made-up' as PrinterLanguage, 'zpl')).toThrow(UnsupportedLanguageError);
-    expect(() => convert('irrelevant', 'made-up' as PrinterLanguage, 'zpl')).toThrow(/made-up/);
+    expect(() => convert('irrelevant', 'made-up' as PrinterLanguage, 'tspl')).toThrow(UnsupportedLanguageError);
+    expect(() => convert('irrelevant', 'made-up' as PrinterLanguage, 'tspl')).toThrow(/made-up/);
   });
 
   it('throws a clear error for an unregistered target language', () => {
     expect(() => convert('SIZE 50 mm,30 mm\r\nCLS\r\nPRINT 1\r\n', 'tspl', 'made-up' as PrinterLanguage)).toThrow(UnsupportedLanguageError);
   });
 
-  it('derives SUPPORTED_SOURCES/SUPPORTED_TARGETS from ConversionRegistry, covering all 9 languages', () => {
+  it('derives SUPPORTED_SOURCES/SUPPORTED_TARGETS from ConversionRegistry, covering tspl and escpos', () => {
     const registryKeys = Object.keys(ConversionRegistry).sort();
-    expect(registryKeys).toHaveLength(9);
+    expect(registryKeys).toEqual(['escpos', 'tspl']);
     expect([...SUPPORTED_SOURCES].sort()).toEqual(registryKeys);
     expect([...SUPPORTED_TARGETS].sort()).toEqual(registryKeys);
   });
@@ -194,8 +50,8 @@ describe('convert — cảnh báo', () => {
   it('gộp cảnh báo compile của ngôn ngữ đích vào kết quả', () => {
     const source = 'SIZE 50 mm,30 mm\r\nCLS\r\nCIRCLE 10,10,50,2\r\nPRINT 1\r\n';
 
-    expect(convert(source, 'tspl', 'epl').warnings).toEqual([
-      'Element "circle" bị bỏ qua — EPL không có lệnh tương ứng.',
+    expect(convert(source, 'tspl', 'escpos').warnings).toEqual([
+      'Element "circle" bị bỏ qua — ESC/POS không có lệnh tương ứng.',
     ]);
   });
 
diff --git a/packages/printer-core/src/core/LanguageRegistry.ts b/packages/printer-core/src/core/LanguageRegistry.ts
index 4a6e638..2745087 100644
--- a/packages/printer-core/src/core/LanguageRegistry.ts
+++ b/packages/printer-core/src/core/LanguageRegistry.ts
@@ -1,54 +1,15 @@
 import type { PrinterLanguage } from './PrinterLanguage';
 import type { PrinterLanguageDefinition } from './PrinterLanguageDefinition';
-import {
-  CpclCompiler,
-  CpclParser,
-  DplCompiler,
-  DplParser,
-  EplCompiler,
-  EplParser,
-  EscPosCompiler,
-  EscPosParser,
-  IplCompiler,
-  IplParser,
-  SbplCompiler,
-  SbplParser,
-  StarPrntCompiler,
-  StarPrntParser,
-  TsplCompiler,
-  TsplParser,
-  ZplCompiler,
-  ZplParser,
-} from '../language';
-import {
-  CpclValidator,
-  DplValidator,
-  EplValidator,
-  EscPosValidator,
-  IplValidator,
-  SbplValidator,
-  StarPrntValidator,
-  TsplValidator,
-  ZplValidator,
-} from '../validation';
-import {
-  CpclPreviewRenderer,
-  DplPreviewRenderer,
-  EplPreviewRenderer,
-  EscPosPreviewRenderer,
-  IplPreviewRenderer,
-  SbplPreviewRenderer,
-  StarPrntPreviewRenderer,
-  TsplPreviewRenderer,
-  ZplPreviewRenderer,
-} from '../preview';
+import { EscPosCompiler, EscPosParser, TsplCompiler, TsplParser } from '../language';
+import { EscPosValidator, TsplValidator } from '../validation';
+import { EscPosPreviewRenderer, TsplPreviewRenderer } from '../preview';
 
 /** Buộc field `language` của mỗi mục trùng với key, để 2 chỗ viết tên ngôn ngữ không thể lệch nhau. */
 type LanguageRegistry = {
   readonly [Language in PrinterLanguage]: PrinterLanguageDefinition & { readonly language: Language };
 };
 
-/** Bộ xử lý của cả 9 ngôn ngữ; thiếu ngôn ngữ nào là lỗi type-check. */
+/** Bộ xử lý của từng ngôn ngữ; thiếu ngôn ngữ nào là lỗi type-check. */
 export const LANGUAGE_REGISTRY: LanguageRegistry = {
   tspl: {
     language: 'tspl',
@@ -64,53 +25,4 @@ export const LANGUAGE_REGISTRY: LanguageRegistry = {
     validator: new EscPosValidator(),
     previewRenderer: new EscPosPreviewRenderer(),
   },
-  zpl: {
-    language: 'zpl',
-    compiler: new ZplCompiler(),
-    parser: new ZplParser(),
-    validator: new ZplValidator(),
-    previewRenderer: new ZplPreviewRenderer(),
-  },
-  epl: {
-    language: 'epl',
-    compiler: new EplCompiler(),
-    parser: new EplParser(),
-    validator: new EplValidator(),
-    previewRenderer: new EplPreviewRenderer(),
-  },
-  cpcl: {
-    language: 'cpcl',
-    compiler: new CpclCompiler(),
-    parser: new CpclParser(),
-    validator: new CpclValidator(),
-    previewRenderer: new CpclPreviewRenderer(),
-  },
-  dpl: {
-    language: 'dpl',
-    compiler: new DplCompiler(),
-    parser: new DplParser(),
-    validator: new DplValidator(),
-    previewRenderer: new DplPreviewRenderer(),
-  },
-  sbpl: {
-    language: 'sbpl',
-    compiler: new SbplCompiler(),
-    parser: new SbplParser(),
-    validator: new SbplValidator(),
-    previewRenderer: new SbplPreviewRenderer(),
-  },
-  starprnt: {
-    language: 'starprnt',
-    compiler: new StarPrntCompiler(),
-    parser: new StarPrntParser(),
-    validator: new StarPrntValidator(),
-    previewRenderer: new StarPrntPreviewRenderer(),
-  },
-  ipl: {
-    language: 'ipl',
-    compiler: new IplCompiler(),
-    parser: new IplParser(),
-    validator: new IplValidator(),
-    previewRenderer: new IplPreviewRenderer(),
-  },
 };
diff --git a/packages/printer-core/src/core/PrinterLanguage.ts b/packages/printer-core/src/core/PrinterLanguage.ts
index 18f300e..8967444 100644
--- a/packages/printer-core/src/core/PrinterLanguage.ts
+++ b/packages/printer-core/src/core/PrinterLanguage.ts
@@ -1,2 +1,2 @@
 /** Ngôn ngữ lệnh máy in mà printer-core compile, parse, validate và preview được. */
-export type PrinterLanguage = 'tspl' | 'zpl' | 'epl' | 'cpcl' | 'dpl' | 'sbpl' | 'escpos' | 'starprnt' | 'ipl';
+export type PrinterLanguage = 'tspl' | 'escpos';
diff --git a/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts b/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
index e01b8a7..b20196c 100644
--- a/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
+++ b/packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
@@ -37,61 +37,6 @@ describe('LanguageDispatch', () => {
     expect(previewFor('escpos', doc)).toContain('<svg');
   });
 
-  it('routes "zpl" to ZplCompiler/ZplParser/ZplValidator/ZplPreviewRenderer', () => {
-    const zpl = compileTo('zpl', doc).output;
-    expect(typeof zpl).toBe('string');
-    expect(parseFrom('zpl', zpl as string).commands.length).toBeGreaterThan(0);
-    expect(validateFor('zpl', zpl as string).valid).toBe(true);
-    expect(previewFor('zpl', doc)).toContain('<svg');
-  });
-
-  it('routes "epl" to EplCompiler/EplParser/EplValidator/EplPreviewRenderer', () => {
-    const epl = compileTo('epl', doc).output;
-    expect(typeof epl).toBe('string');
-    expect(parseFrom('epl', epl as string).commands.length).toBeGreaterThan(0);
-    expect(validateFor('epl', epl as string).valid).toBe(true);
-    expect(previewFor('epl', doc)).toContain('<svg');
-  });
-
-  it('routes "cpcl" to CpclCompiler/CpclParser/CpclValidator/CpclPreviewRenderer', () => {
-    const cpcl = compileTo('cpcl', doc).output;
-    expect(typeof cpcl).toBe('string');
-    expect(parseFrom('cpcl', cpcl as string).commands.length).toBeGreaterThan(0);
-    expect(validateFor('cpcl', cpcl as string).valid).toBe(true);
-    expect(previewFor('cpcl', doc)).toContain('<svg');
-  });
-
-  it('routes "dpl" to DplCompiler/DplParser/DplValidator/DplPreviewRenderer', () => {
-    const dpl = compileTo('dpl', doc).output;
-    expect(typeof dpl).toBe('string');
-    expect(parseFrom('dpl', dpl as string).commands.length).toBeGreaterThan(0);
-    expect(validateFor('dpl', dpl as string).valid).toBe(true);
-    expect(previewFor('dpl', doc)).toContain('<svg');
-  });
-
-  it('routes "sbpl" to SbplCompiler/SbplParser/SbplValidator/SbplPreviewRenderer', () => {
-    const sbpl = compileTo('sbpl', doc).output;
-    expect(typeof sbpl).toBe('string');
-    expect(parseFrom('sbpl', sbpl as string).commands.length).toBeGreaterThan(0);
-    expect(validateFor('sbpl', sbpl as string).valid).toBe(true);
-    expect(previewFor('sbpl', doc)).toContain('<svg');
-  });
-
-  it('routes "starprnt" to StarPrntCompiler/StarPrntParser/StarPrntValidator/StarPrntPreviewRenderer', () => {
-    const bytes = compileTo('starprnt', doc).output;
-    expect(bytes).toBeInstanceOf(Uint8Array);
-    expect(parseFrom('starprnt', bytes as Uint8Array).commands.length).toBeGreaterThan(0);
-    expect(previewFor('starprnt', doc)).toContain('<svg');
-  });
-
-  it('routes "ipl" to IplCompiler/IplParser/IplValidator/IplPreviewRenderer', () => {
-    const ipl = compileTo('ipl', doc).output;
-    expect(typeof ipl).toBe('string');
-    expect(parseFrom('ipl', ipl as string).commands.length).toBeGreaterThan(0);
-    expect(validateFor('ipl', ipl as string).valid).toBe(true);
-    expect(previewFor('ipl', doc)).toContain('<svg');
-  });
-
   it('throws a clear UnsupportedLanguageError for an unknown language', () => {
     const unknown = 'unknown' as unknown as Parameters<typeof compileTo>[0];
     expect(() => compileTo(unknown, doc).output).toThrow(UnsupportedLanguageError);
@@ -101,8 +46,8 @@ describe('LanguageDispatch', () => {
   });
 
   it('compileTo dùng chung compiler đã đăng ký nhưng cảnh báo không dồn sang lần compile sau', () => {
-    compileTo('epl', { ...doc, elements: [{ type: 'circle', options: { x: 0, y: 0, diameter: 10 } }] });
+    compileTo('escpos', { ...doc, elements: [{ type: 'circle', options: { x: 0, y: 0, diameter: 10 } }] });
 
-    expect(compileTo('epl', doc).warnings).toEqual([]);
+    expect(compileTo('escpos', doc).warnings).toEqual([]);
   });
 });
diff --git a/packages/printer-core/src/language/index.ts b/packages/printer-core/src/language/index.ts
index c5f956c..216400d 100644
--- a/packages/printer-core/src/language/index.ts
+++ b/packages/printer-core/src/language/index.ts
@@ -1,9 +1,2 @@
 export * from './tspl';
-export * from './zpl';
-export * from './epl';
-export * from './cpcl';
-export * from './dpl';
-export * from './ipl';
-export * from './sbpl';
 export * from './escpos';
-export * from './starprnt';
diff --git a/packages/printer-core/src/preview/index.ts b/packages/printer-core/src/preview/index.ts
index d544df6..71a94e8 100644
--- a/packages/printer-core/src/preview/index.ts
+++ b/packages/printer-core/src/preview/index.ts
@@ -1,2 +1 @@
-export * from './PreviewRenderer';
 export * from './languages';
diff --git a/packages/printer-core/src/preview/languages/index.ts b/packages/printer-core/src/preview/languages/index.ts
index c5f956c..216400d 100644
--- a/packages/printer-core/src/preview/languages/index.ts
+++ b/packages/printer-core/src/preview/languages/index.ts
@@ -1,9 +1,2 @@
 export * from './tspl';
-export * from './zpl';
-export * from './epl';
-export * from './cpcl';
-export * from './dpl';
-export * from './ipl';
-export * from './sbpl';
 export * from './escpos';
-export * from './starprnt';
diff --git a/packages/printer-core/src/validation/index.ts b/packages/printer-core/src/validation/index.ts
index 55a7cbe..593b343 100644
--- a/packages/printer-core/src/validation/index.ts
+++ b/packages/printer-core/src/validation/index.ts
@@ -1,11 +1,4 @@
 export * from './ValidationResult';
 export * from './ValidationIssue';
 export * from './languages/tspl';
-export * from './languages/zpl';
-export * from './languages/epl';
 export * from './languages/escpos';
-export * from './languages/cpcl';
-export * from './languages/dpl';
-export * from './languages/sbpl';
-export * from './languages/starprnt';
-export * from './languages/ipl';
diff --git a/packages/printer-preview/src/App.tsx b/packages/printer-preview/src/App.tsx
index 15fedd3..29d7011 100644
--- a/packages/printer-preview/src/App.tsx
+++ b/packages/printer-preview/src/App.tsx
@@ -9,17 +9,7 @@ import { evaluateTemplate } from './evaluateTemplate';
 import { renderPreviews, defaultLanguageFor, type PagePreview } from './pipeline';
 import { defaultCode, defaultData } from './defaultSample';
 
-const LANGUAGES: readonly PrinterLanguage[] = [
-  'tspl',
-  'zpl',
-  'epl',
-  'cpcl',
-  'dpl',
-  'sbpl',
-  'escpos',
-  'starprnt',
-  'ipl',
-];
+const LANGUAGES: readonly PrinterLanguage[] = ['tspl', 'escpos'];
 const RENDER_DEBOUNCE_MS = 500;
 
 interface RenderOutcome {
~~~

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `328 passed, 328 total`; `printer-preview` tsc sạch, Vitest `12 passed`; eslint `0 errors`.

- [ ] **Step 6: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/src/__tests__/phase2-integration.test.ts \
  packages/printer-core/src/convert/ConversionPath.ts \
  packages/printer-core/src/convert/ConversionRegistry.ts \
  packages/printer-core/src/convert/ConversionResult.ts \
  packages/printer-core/src/convert/PrinterConverter.ts \
  packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts \
  packages/printer-core/src/core/LanguageRegistry.ts \
  packages/printer-core/src/core/PrinterLanguage.ts \
  packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts \
  packages/printer-core/src/language/index.ts \
  packages/printer-core/src/preview/index.ts \
  packages/printer-core/src/preview/languages/index.ts \
  packages/printer-core/src/validation/index.ts \
  packages/printer-preview/src/App.tsx
git diff --cached -U0 -- '*.ts' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: drop printer languages other than TSPL and ESC/POS" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Task 2: Xoá code chết

**Files:**
- Delete: `receipt/`, `PrintDocument`, `PairFormatter`/`SeparatorFormatter`/`WordWrapper`, `HexDump`/`PrintDataAssertion`, `FontStyle`/`FontWeight`, `Tcvn3Encoder` và test của chúng
- Modify: `document/__tests__/PrintDocument.test.ts`, `document/elements/layout/PageBreakElement.ts`, `document/index.ts`, `encoding/CodePageEncoder.ts`, `encoding/encoders/index.ts`, `formatting/index.ts`, `index.ts`, `language/tspl/TsplCommand.ts`, `language/tspl/TsplParser.ts`, `testing/index.ts`, `types/index.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - Không còn `receipt/`, `PrintDocument`, `formatPair`, `separator`, `wordWrap`, `hexDump`, `assertPrintDataEqual`/`assertPrintDataContains`, `FontStyle`, `FontWeight`, `encodeTcvn3`.
  - Không còn `parseTsplSummary`, `isASCII`, `PageBreakOptions`, `TsplCommandName`.
  - Các module khác giữ nguyên API.

- [ ] **Step 1: Xoá file bằng git rm**

```bash
git rm -rq packages/printer-core/src/receipt
git rm -q packages/printer-core/src/document/PrintDocument.ts packages/printer-core/src/formatting/PairFormatter.ts packages/printer-core/src/formatting/SeparatorFormatter.ts packages/printer-core/src/formatting/WordWrapper.ts
git rm -q packages/printer-core/src/testing/HexDump.ts packages/printer-core/src/testing/PrintDataAssertion.ts packages/printer-core/src/types/FontStyle.ts packages/printer-core/src/types/FontWeight.ts
git rm -q packages/printer-core/src/encoding/encoders/Tcvn3Encoder.ts
git rm -q packages/printer-core/src/encoding/encoders/__tests__/Tcvn3Encoder.test.ts packages/printer-core/src/formatting/__tests__/PairFormatter.test.ts
git rm -q packages/printer-core/src/testing/__tests__/HexDump.test.ts packages/printer-core/src/testing/__tests__/PrintDataAssertion.test.ts
```

- [ ] **Step 2: Type-check, xác nhận FAIL**

```bash
npx tsc --noEmit -p packages/printer-core
```

Expected: FAIL — lỗi ở các barrel (`index.ts`) còn export file đã xoá. Lúc lập plan: 10 lỗi `error TS`.

- [ ] **Step 3: Áp patch**

Patch làm các việc sau:
- Gỡ export của file đã xoá khỏi barrel.
- Xoá `parseTsplSummary` (`TsplParser.ts`), `isASCII` (`CodePageEncoder.ts`), `PageBreakOptions`, `TsplCommandName`.
- Đổi tên `describe` trong `PrintDocument.test.ts`.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-printer-core-cleanup.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t2 | git apply --ignore-whitespace -
```

<!-- patch:t2 -->
~~~diff
diff --git a/packages/printer-core/src/document/__tests__/PrintDocument.test.ts b/packages/printer-core/src/document/__tests__/PrintDocument.test.ts
index 2ddd26e..a3d0df2 100644
--- a/packages/printer-core/src/document/__tests__/PrintDocument.test.ts
+++ b/packages/printer-core/src/document/__tests__/PrintDocument.test.ts
@@ -1,7 +1,7 @@
 import type { PrintElement } from '../elements/PrintElement';
 import type { ResolvedPrintDocument } from '../index';
 
-describe('PrintDocument element union', () => {
+describe('PrintElement / ResolvedPrintDocument', () => {
   it('accepts a barcode element alongside portakal-native element types', () => {
     const elements: PrintElement[] = [
       { type: 'text', content: 'hi', options: {} },
diff --git a/packages/printer-core/src/document/elements/layout/PageBreakElement.ts b/packages/printer-core/src/document/elements/layout/PageBreakElement.ts
index c0f25f6..f75cbde 100644
--- a/packages/printer-core/src/document/elements/layout/PageBreakElement.ts
+++ b/packages/printer-core/src/document/elements/layout/PageBreakElement.ts
@@ -1,6 +1,3 @@
-/** Options đánh dấu ngắt trang — không mang cấu hình, chỉ đánh dấu vị trí trong danh sách element. */
-export type PageBreakOptions = Record<string, never>;
-
 /** Một dấu ngắt trang — không mang cấu hình, chỉ đánh dấu vị trí trong danh sách element. */
 export interface PageBreakElement {
   type: 'pageBreak';
diff --git a/packages/printer-core/src/document/index.ts b/packages/printer-core/src/document/index.ts
index 7ee2f1f..60ce0a1 100644
--- a/packages/printer-core/src/document/index.ts
+++ b/packages/printer-core/src/document/index.ts
@@ -1,3 +1,2 @@
-export * from './PrintDocument';
 export * from './ResolvedPrintDocument';
 export * from './elements';
diff --git a/packages/printer-core/src/encoding/CodePageEncoder.ts b/packages/printer-core/src/encoding/CodePageEncoder.ts
index 7fce12e..1dbd7f6 100644
--- a/packages/printer-core/src/encoding/CodePageEncoder.ts
+++ b/packages/printer-core/src/encoding/CodePageEncoder.ts
@@ -30,17 +30,6 @@ export function findCodePage(id: number): CodePage | undefined {
   return CODE_PAGES[id];
 }
 
-/** Check if a string contains only ASCII printable characters (plus newline/CR). */
-export function isASCII(text: string): boolean {
-  for (let i = 0; i < text.length; i++) {
-    const codePoint = text.charCodeAt(i);
-    if (codePoint < 0x20 || codePoint > 0x7e) {
-      if (codePoint !== 0x0a && codePoint !== 0x0d) return false;
-    }
-  }
-  return true;
-}
-
 function findByte(char: string, codePages: readonly CodePage[]): { codePage: CodePage; byte: number } | null {
   for (const codePage of codePages) {
     const byte = REVERSE_INDEX.get(codePage)?.get(char);
diff --git a/packages/printer-core/src/encoding/encoders/index.ts b/packages/printer-core/src/encoding/encoders/index.ts
index 5d92c3a..a854e97 100644
--- a/packages/printer-core/src/encoding/encoders/index.ts
+++ b/packages/printer-core/src/encoding/encoders/index.ts
@@ -5,4 +5,3 @@ export * from './Windows1252Encoder';
 export * from './Windows1258Encoder';
 export * from './Cp866Encoder';
 export * from './Cp857Encoder';
-export * from './Tcvn3Encoder';
diff --git a/packages/printer-core/src/formatting/index.ts b/packages/printer-core/src/formatting/index.ts
index 4b951dc..cadeef6 100644
--- a/packages/printer-core/src/formatting/index.ts
+++ b/packages/printer-core/src/formatting/index.ts
@@ -1,7 +1,4 @@
 export * from './TableColumn';
-export * from './PairFormatter';
 export * from './TableFormatter';
 export * from './RowFormatter';
 export * from './validateTableColumns';
-export * from './SeparatorFormatter';
-export * from './WordWrapper';
diff --git a/packages/printer-core/src/index.ts b/packages/printer-core/src/index.ts
index 5f3ff08..0b09576 100644
--- a/packages/printer-core/src/index.ts
+++ b/packages/printer-core/src/index.ts
@@ -1,7 +1,6 @@
 export * from './core';
 export * from './types';
 export * from './document';
-export * from './receipt';
 export * from './formatting';
 export * from './symbology';
 export * from './image';
diff --git a/packages/printer-core/src/language/tspl/TsplCommand.ts b/packages/printer-core/src/language/tspl/TsplCommand.ts
index bc3c409..e8c7fbd 100644
--- a/packages/printer-core/src/language/tspl/TsplCommand.ts
+++ b/packages/printer-core/src/language/tspl/TsplCommand.ts
@@ -24,5 +24,3 @@ export const TSPL_COMMAND = {
    */
   SET_CUTTER: 'SET CUTTER',
 } as const;
-
-export type TsplCommandName = (typeof TSPL_COMMAND)[keyof typeof TSPL_COMMAND];
diff --git a/packages/printer-core/src/language/tspl/TsplParser.ts b/packages/printer-core/src/language/tspl/TsplParser.ts
index 7531744..3e02f2a 100644
--- a/packages/printer-core/src/language/tspl/TsplParser.ts
+++ b/packages/printer-core/src/language/tspl/TsplParser.ts
@@ -1523,15 +1523,6 @@ export function parseTSPL(code: string): TSPLParseResult {
   return { commands, widthDots, heightDots, dpi, elements, warnings };
 }
 
-/**
- * Bản parse rút gọn — chỉ trả về kích thước nhãn và các element render được
- * cho preview, dành cho nơi gọi không cần mọi lệnh thô.
- */
-export function parseTsplSummary(code: string): { widthDots: number; heightDots: number; elements: PrintElement[] } {
-  const result = parseTSPL(code);
-  return { widthDots: result.widthDots, heightDots: result.heightDots, elements: result.elements };
-}
-
 /**
  * Giải mã một chuỗi lệnh TSPL/TSPL2 thành các lệnh có cấu trúc (theo dòng,
  * theo ngữ pháp từng lệnh).
diff --git a/packages/printer-core/src/testing/index.ts b/packages/printer-core/src/testing/index.ts
index 45f0a93..bf5d7ab 100644
--- a/packages/printer-core/src/testing/index.ts
+++ b/packages/printer-core/src/testing/index.ts
@@ -1,3 +1 @@
-export * from './PrintDataAssertion';
-export * from './HexDump';
 export * from './OrderTestCatalog';
diff --git a/packages/printer-core/src/types/index.ts b/packages/printer-core/src/types/index.ts
index 7f19b78..0b57443 100644
--- a/packages/printer-core/src/types/index.ts
+++ b/packages/printer-core/src/types/index.ts
@@ -5,6 +5,4 @@ export * from './Unit';
 export * from './Alignment';
 export * from './Rotation';
 export * from './Direction';
-export * from './FontWeight';
-export * from './FontStyle';
 export * from './Bitmap';
~~~

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `314 passed, 314 total`; eslint `0 errors`.

- [ ] **Step 5: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/src/document/__tests__/PrintDocument.test.ts \
  packages/printer-core/src/document/elements/layout/PageBreakElement.ts \
  packages/printer-core/src/document/index.ts \
  packages/printer-core/src/encoding/CodePageEncoder.ts \
  packages/printer-core/src/encoding/encoders/index.ts \
  packages/printer-core/src/formatting/index.ts \
  packages/printer-core/src/index.ts \
  packages/printer-core/src/language/tspl/TsplCommand.ts \
  packages/printer-core/src/language/tspl/TsplParser.ts \
  packages/printer-core/src/testing/index.ts \
  packages/printer-core/src/types/index.ts
git diff --cached -U0 -- '*.ts' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: remove dead code from printer-core" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Task 3: `testing/` không export ra ngoài + README đúng hiện trạng

**Files:**
- Modify: `packages/printer-core/README.md`, `index.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: Task 1-2.
- Produces:
  - `src/index.ts` không còn `export * from './testing'`; test trong package vẫn import `testing/` bằng đường dẫn tương đối.
  - README mô tả 2 ngôn ngữ, cây thư mục đúng code sau R1, bảng cảnh báo 2 dòng.

- [ ] **Step 1: Áp patch**

Patch làm các việc sau:
- Bỏ `export * from './testing'` trong `src/index.ts`.
- Viết lại `packages/printer-core/README.md`: giới thiệu, ranh giới với app, cây thư mục, phân trang tem, cỡ chữ và cảnh báo compile.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-printer-core-cleanup.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t3 | git apply --ignore-whitespace -
```

<!-- patch:t3 -->
~~~diff
diff --git a/packages/printer-core/README.md b/packages/printer-core/README.md
index 1b5fdc2..0b33e1d 100644
--- a/packages/printer-core/README.md
+++ b/packages/printer-core/README.md
@@ -1,270 +1,102 @@
 # printer-core
 
-Core thuần TypeScript cho feature máy in của NDTCorePOS: mô hình document/label,
-compiler + parser + validator + preview cho các ngôn ngữ máy in, mã hoá
-barcode/QR/ảnh (dithering), receipt layout. Năng lực máy in đích truyền vào compiler qua `PrinterFeatures`.
+Core thuần TypeScript cho feature máy in của NDTCorePOS, không dependency, không phụ thuộc React Native.
 
-Mục tiêu dài hạn là mirror đầy đủ chức năng của
-[portakal](https://github.com/productdevbook/portakal) (SDK ngôn ngữ máy in mã
-nguồn mở, zero-dependency) — không trim bớt ngôn ngữ, để giữ khả năng mở rộng
-sang các giao thức máy in khác ngoài ESC/POS + TSPL mà app đang dùng hôm nay.
+Package hỗ trợ 2 ngôn ngữ máy in mà app dùng: **TSPL** (máy in tem) và **ESC/POS** (máy in hoá đơn). Luồng chính:
 
-> **Trạng thái hiện tại: đầy đủ, package đã hoàn chỉnh.** Cả 9 ngôn ngữ máy in
-> và `convert/` đều đã có logic thật — không còn file placeholder (`export {}`)
-> nào. Cụ thể:
->
-> **Đã có logic thật:**
-> - Nền tảng: types, document model, core dispatch (`PrintCompiler`/`Parser`/
->   `Preview`/`Validation` theo ngôn ngữ)
-> - Encoding: code page (Cp437/858/866/857, Windows1252/1258) + tiếng Việt
->   (TCVN3, CP1258)
-> - `image/`: dithering ảnh (threshold, Floyd-Steinberg, Atkinson, ordered)
-> - `symbology/barcode/`, `symbology/qrcode/`: lớp mô tả + validate (chưa render ảnh module thật)
-> - `receipt/`: layout công thức in hoá đơn (pair/table/separator, word wrap)
-> - `PrinterFeatures` (`core/`): năng lực máy in đích (dao cắt, ngăn kéo tiền,
->   kiểu ảnh, CJK, UTF-8, code page) do app khai báo, truyền vào `compileTo()`;
->   dữ liệu máy in theo hãng/model là việc của app
-> - `document/builder/`: fluent builder API (PrintBuilder/LabelBuilder/ReceiptBuilder)
->   và `document/builder/markup/`: markup DSL kiểu HTML (`<label>...</label>`)
-> - **Cả 9 ngôn ngữ máy in** (TSC/TSPL, ESC/POS, ZPL, EPL, CPCL, DPL, SBPL,
->   Star PRNT, IPL): đầy đủ pipeline compile → parse → validate → preview (SVG)
-> - `convert/`: cross-compiler giữa các ngôn ngữ (parse ngôn ngữ A → dựng lại
->   `PrintElement[]` → compile sang ngôn ngữ B)
-> - `testing/` (PrintDataAssertion, HexDump, catalog đơn hàng dùng cho test)
->
-> Có bài test tích hợp end-to-end thật chứng minh cả 9 ngôn ngữ hoạt động đúng:
-> `src/__tests__/phase2-integration.test.ts` — dựng một document thật (text +
-> barcode + table + cut), compile/parse/validate/preview lần lượt qua tất cả
-> 9 `PrinterLanguage` bằng `core/LanguageDispatch.ts`, cộng thêm 2 test chi
-> tiết riêng cho ESC/POS và TSC kế thừa từ Phase 1.
->
-> **Chưa có consumer nào dùng package này** — app hiện vẫn giữ logic in ấn
-> trùng lặp của riêng nó. Việc chuyển app sang dùng `printer-core` thay vì
-> logic riêng là việc khác, để sau.
->
-> **Giới hạn đã biết (không thuộc phạm vi port này):**
-> - Chuỗi string trong `TsplCompiler.compile().output` trộn lẫn hai kiểu encoding
->   byte khác nhau (text UTF-8 và payload bitmap dạng latin-1 one-char-per-byte)
->   khi document có element ảnh — xem JSDoc trên `TsplCompiler.compile()`
->   (`src/language/tspl/TsplCompiler.ts`) để biết chi tiết trước khi dùng output
->   TSPL compile ra để gửi máy in thật.
-> - `Tcvn3Encoder` chỉ phủ một phần bảng mã TCVN3 (partial coverage) — xem
->   JSDoc trên `Tcvn3Encoder` (`src/encoding/encoders/Tcvn3Encoder.ts`) để biết
->   phạm vi ký tự đã hỗ trợ.
+```text
+TemplateDocument (JSON, DSL) ──parseTemplate──▶ resolve (catalog + data) ──▶ layout (dots)
+  ──▶ PrintElement[] ──compileTo──▶ lệnh TSPL / ESC/POS  { output, warnings }
+                     └─previewFor─▶ SVG xem trước
+```
+
+- **Template:** `TemplateDocument` là JSON thuần, độc lập DPI; DSL `labelTemplate`/`receiptTemplate` sinh ra nó.
+- **Dữ liệu:** biến đọc qua catalog (`defineCatalog`), không trỏ thẳng vào data.
+- **Compile:** mỗi ngôn ngữ có compiler, parser (đọc ngược lệnh), validator, preview SVG. Năng lực máy in đích
+  truyền vào qua `PrinterFeatures`.
+- **Chuyển đổi:** `convert()` chuyển lệnh giữa TSPL và ESC/POS.
+- **Phụ trợ:** mã hoá chữ theo code page (CP437/857/858/866, Windows-1252/1258), xử lý ảnh (dithering) và mô tả
+  barcode/QR.
+
+**Giới hạn đã biết:** khi document có ảnh, chuỗi trong `TsplCompiler.compile().output` trộn text UTF-8 với payload
+bitmap dạng 1 ký tự = 1 byte. Xem JSDoc của `TsplCompiler.compile()` trước khi gửi output này tới máy in thật.
 
 ## Ranh giới với `src/features/printer`
 
-- **`printer-core`** — tính toán thuần, đồng bộ, không phụ thuộc React Native:
-  dựng document/label, biên dịch ra lệnh máy in, parse ngược, validate, preview
-  SVG, mã hoá bitmap/barcode/QR. Không biết gì về USB/Bluetooth/LAN, AsyncStorage
-  hay React; chỉ nhận năng lực máy in đích qua `PrinterFeatures`.
-- **`src/features/printer`** (giữ nguyên) — mọi thứ cần I/O hoặc API của React
-  Native: transport (USB/BT/LAN), adapter (native/library/vendor), dữ liệu máy in
-  theo hãng/model (map sang `PrinterFeatures`), kết nối,
-  discovery, permission, storage, hook, component UI, orchestration
-  (PrintScheduler/PrintService).
+- **`printer-core`:** tính toán thuần, đồng bộ.
+  - Dựng template, resolve, layout, biên dịch ra lệnh máy in, parse ngược, validate.
+  - Preview SVG, mã hoá bitmap/barcode/QR.
+  - Không biết gì về USB/Bluetooth/LAN, AsyncStorage hay React; chỉ nhận năng lực máy in đích qua
+    `PrinterFeatures`.
+- **`src/features/printer`** (app): mọi thứ cần I/O hoặc API của React Native.
+  - Transport (USB/BT/LAN), adapter (native/library/vendor).
+  - Dữ liệu máy in theo hãng/model (map sang `PrinterFeatures`).
+  - Kết nối, discovery, permission, storage, hook, component UI.
+  - Orchestration (PrintScheduler/PrintService).
 
 ## Cấu trúc
 
 ```text
 src/
 ├── index.ts
-│
-├── types/                     # KHÔNG đổi — primitive/value types thực sự generic
-│   ├── Alignment.ts, Bitmap.ts, Direction.ts, FontStyle.ts, FontWeight.ts,
-│   │   Point.ts, Rect.ts, Rotation.ts, Size.ts, Unit.ts, index.ts
-│
-├── catalog/                   # Cầu nối template ↔ data: biến có tên theo loại nội dung
-│   ├── VariableType.ts, VariableSpec.ts, CatalogCollection.ts, CatalogDescription.ts,
-│   │   Catalog.ts, BuiltInVariable.ts, CatalogRegistry.ts, describeCatalog.ts,
-│   │   defineCatalog.ts, CatalogIndex.ts, index.ts
-│
-├── template/                  # TemplateDocument JSON thuần, độc lập DPI
-│   ├── TemplateDocument.ts, index.ts
-│   ├── style/                  # Length.ts, Dimension.ts, Insets.ts, BoxStyle.ts,
-│   │                           # LayoutStyle.ts, TextStyle.ts
-│   ├── content/                # Segment.ts, ValueFormat.ts, Condition.ts
-│   ├── nodes/                  # TemplateNode.ts, TemplateNodeBase.ts, ContainerNode.ts,
-│   │                           # TextNode.ts, ImageNode.ts, BarcodeNode.ts,
-│   │                           # QrCodeNode.ts, LineNode.ts, RepeatNode.ts
-│   ├── format/                 # formatter vi-VN tự cài đặt (không dùng Intl)
-│   ├── parse/                  # parseTemplate, migrateTemplate, validate cấu trúc,
-│   │                           # validateTemplateAgainstCatalog
-│   └── builder/                # DSL: labelTemplate/receiptTemplate(catalog), scope.var/repeat
-│
-├── resolution/                 # Ghép template + data qua catalog, stack scope tường minh
-│   ├── DocumentResolver.ts, ResolveContext.ts, readVariable.ts, resolveContent.ts,
-│   │   evaluateCondition.ts, readRepeatEntries.ts, resolveNode.ts, planPages.ts,
-│   │   collectAssetIds.ts, AssetProvider.ts, ResolvedNode.ts, ResolvedPage.ts,
-│   │   ResolveError.ts, index.ts
-│
-├── layout/                     # Đổi Length → dots theo DPI rồi xếp vị trí
-│   ├── LayoutConfig.ts, lengthToDots.ts, LayoutNode.ts, toLayoutNode.ts,
-│   │   LayoutEngine.ts, FontMetrics.ts, ApproximateFontMetrics.ts,
-│   │   TextMeasurement.ts, TypographyProfile.ts, index.ts
-│
-├── document/
-│   ├── PrintDocument.ts, ResolvedPrintDocument.ts, index.ts    # KHÔNG đổi vị trí (đã ở document/)
-│   │
-│   └── elements/                # MỚI — gộp builder/PrintElement.ts +
-│       │                        # builder/content|drawing|layout|printer/*
-│       ├── PrintElement.ts      # từ builder/PrintElement.ts (union type)
-│       ├── content/             # từ builder/content/
-│       │   ├── BarcodeElement.ts, ImageElement.ts, QrCodeElement.ts,
-│       │   │   RawElement.ts, TextElement.ts, index.ts
-│       ├── drawing/              # từ builder/drawing/ — KHÔNG chia nhỏ thêm
-│       │   │                     # thành shape/line/effect (xem "Quyết định
-│       │   │                     # KHÔNG áp dụng" bên dưới)
-│       │   ├── BoxElement.ts, CircleElement.ts, DiagonalElement.ts,
-│       │   │   EllipseElement.ts, EraseElement.ts, LineElement.ts,
-│       │   │   ReverseElement.ts, index.ts
-│       ├── layout/                # từ builder/layout/
-│       │   ├── ColumnElement.ts, PageBreakElement.ts, RowElement.ts,
-│       │   │   SpacerElement.ts, TableElement.ts, index.ts
-│       └── control/                # từ builder/printer/ (đổi tên `printer`→`control`,
-│           │                        # khớp đúng ý nghĩa: CutElement là lệnh điều
-│           │                        # khiển máy in, không phải nội dung in)
-│           ├── CutElement.ts, index.ts
-│
-├── symbology/                    # MỚI — gộp barcode/ + qrcode/ (root cũ)
-│   ├── barcode/
-│   │   ├── BarcodeConfig.ts, BarcodeType.ts, BarcodeValidator.ts, index.ts
-│   └── qrcode/
-│       ├── QrCodeConfig.ts, QrCodeErrorCorrection.ts, QrCodeModel.ts,
-│       │   QrCodeValidator.ts, index.ts
-│
-├── formatting/                    # MỚI — phần dùng chung, generic của receipt/ cũ
-│   ├── TableColumn.ts             # rename từ receipt/ReceiptColumn.ts
-│   ├── PairFormatter.ts           # KHÔNG đổi tên, chỉ đổi vị trí
-│   ├── TableFormatter.ts          # KHÔNG đổi tên, chỉ đổi vị trí
-│   ├── SeparatorFormatter.ts      # KHÔNG đổi tên, chỉ đổi vị trí
-│   ├── WordWrapper.ts             # KHÔNG đổi tên, chỉ đổi vị trí
-│   ├── RowFormatter.ts            # rename từ receipt/ReceiptFormatter.ts
-│   ├── validateTableColumns.ts    # KHÔNG đổi tên, chỉ đổi vị trí
-│   └── index.ts
-│
-├── receipt/                        # THU GỌN — chỉ còn phần thật sự receipt-specific
-│   ├── ReceiptLayout.ts            # cập nhật import TableColumn thay ReceiptColumn
-│   └── index.ts
-│
-├── image/                          # KHÔNG đổi
-│   ├── ImageCrop.ts, ImageDither.ts, ImageResize.ts, ImageSource.ts,
-│   │   ImageThreshold.ts, ImageTransform.ts, MonochromeBitmap.ts,
-│   │   RgbaImage.ts, index.ts
-│   └── dithering/
-│       ├── AtkinsonDither.ts, DitherAlgorithm.ts, FloydSteinbergDither.ts,
-│       │   OrderedDither.ts, ThresholdDither.ts, index.ts
-│
-├── encoding/                       # KHÔNG đổi
-│   ├── CodePage.ts, CodePageEncoder.ts, EncodingResult.ts, index.ts
-│   └── encoders/
-│       ├── Cp437Encoder.ts, Cp857Encoder.ts, Cp858Encoder.ts,
-│       │   Cp866Encoder.ts, Tcvn3Encoder.ts, Utf8Encoder.ts,
-│       │   Windows1252Encoder.ts, Windows1258Encoder.ts, index.ts
-│
-├── core/                           # THU GỌN — chỉ còn contract, KHÔNG implementation
-│   ├── LanguageDispatch.ts, LanguageRegistry.ts, PrinterLanguage.ts,
-│   │   PrinterLanguageDefinition.ts, PrinterCoreError.ts,
-│   │   PrintCompiler.ts, PrintParser.ts, PrintPreview.ts, PrintValidation.ts,
-│   │   PrinterFeatures.ts, index.ts     # PrinterFeatures: năng lực máy in đích truyền vào compiler
-│
-├── language/                        # MỚI — gộp compiler/{lang} + parser/{lang}
-│   │                                 # (KHÔNG gồm validation, KHÔNG gồm preview)
-│   ├── CompileWarnings.ts            # gom cảnh báo của 1 lần compile (field bỏ/gộp, element không hỗ trợ)
-│   ├── BitmapFont.ts                 # chọn font bitmap + hệ số phóng đại (TSPL, EPL, CPCL)
-│   ├── MagnifiedFont.ts              # 1 font phóng đại nguyên (DPL, SBPL, ESC/POS, Star PRNT)
-│   ├── tspl/      (đổi tên từ `tsc` — TSC chỉ còn dùng cho tên hãng)
-│   │   ├── TsplCommand.ts, TsplCompiler.ts, TsplEncoder.ts, TsplFontMetrics.ts, TsplParser.ts, index.ts
-│   ├── zpl/       ├── ZplCommand.ts, ZplCompiler.ts, ZplEncoder.ts, ZplFontMetrics.ts, ZplParser.ts, index.ts
-│   ├── epl/       ├── EplCommand.ts, EplCompiler.ts, EplEncoder.ts, EplFontMetrics.ts, EplParser.ts, index.ts
-│   ├── cpcl/      ├── CpclCommand.ts, CpclCompiler.ts, CpclEncoder.ts, CpclFontMetrics.ts, CpclParser.ts,
-│   │              │   index.ts
-│   ├── dpl/       ├── DplCommand.ts, DplCompiler.ts, DplEncoder.ts, DplFontMetrics.ts, DplParser.ts, index.ts
-│   ├── ipl/       ├── IplCommand.ts, IplCompiler.ts, IplEncoder.ts, IplFontMetrics.ts, IplParser.ts, index.ts
-│   ├── sbpl/      ├── SbplCommand.ts, SbplCompiler.ts, SbplEncoder.ts, SbplFontMetrics.ts, SbplParser.ts,
-│   │              │   index.ts
-│   ├── escpos/    ├── EscPosCommand.ts, EscPosCompiler.ts, EscPosCodePage.ts,
-│   │              │   EscPosBarcodeEncoder.ts, EscPosImageEncoder.ts, EscPosFontMetrics.ts,
-│   │              │   EscPosQrCodeEncoder.ts, EscPosParser.ts, index.ts
-│   └── starprnt/  └── StarPrntCommand.ts, StarPrntCompiler.ts, StarPrntEncoder.ts,
-│                      StarPrntFontMetrics.ts, StarPrntParser.ts, index.ts
-│
-├── preview/                          # THU GỌN + thêm per-language subfolder
-│   ├── PreviewRenderer.ts            # implementation dùng chung cho Dpl/Sbpl/Ipl — chiều cao
-│   │                                 # chữ do FontMetrics của ngôn ngữ gọi truyền vào
-│   ├── index.ts
-│   └── languages/
-│       ├── tspl/TsplPreviewRenderer.ts     (MỚI — thêm 1 cấp thư mục theo lang)
-│       ├── zpl/ZplPreviewRenderer.ts
-│       ├── epl/EplPreviewRenderer.ts
-│       ├── cpcl/CpclPreviewRenderer.ts
-│       ├── dpl/DplPreviewRenderer.ts
-│       ├── ipl/IplPreviewRenderer.ts
-│       ├── sbpl/SbplPreviewRenderer.ts
-│       ├── escpos/EscPosPreviewRenderer.ts
-│       └── starprnt/StarPrntPreviewRenderer.ts
-│       (mỗi thư mục có index.ts riêng — MỚI)
-│
-├── validation/                        # THU GỌN + languages/{lang}/ giữ nguyên
-│   │                                  # cấu trúc hiện có (đã đúng theo pattern mới)
-│   ├── ValidationIssue.ts, ValidationResult.ts, index.ts
-│   └── languages/                     # đổi tên từ validation/{lang}/ trực tiếp
-│       │                              # → validation/languages/{lang}/ (thêm 1 cấp
-│       │                              #   `languages/`, khớp preview/languages/)
-│       ├── tspl/TsplValidator.ts, index.ts
-│       ├── zpl/ZplValidator.ts, index.ts
-│       ├── epl/EplValidator.ts, index.ts
-│       ├── cpcl/CpclValidator.ts, index.ts
-│       ├── dpl/DplValidator.ts, index.ts
-│       ├── ipl/IplValidator.ts, index.ts
-│       ├── sbpl/SbplValidator.ts, index.ts
-│       ├── escpos/EscPosValidator.ts, index.ts
-│       └── starprnt/StarPrntValidator.ts, index.ts
-│
-├── convert/                            # KHÔNG đổi tên (giữ nguyên `convert`,
-│   │                                   # không đổi thành `conversion`)
-│   ├── ConversionPath.ts, ConversionRegistry.ts, ConversionResult.ts,
-│   │   PrinterConverter.ts, index.ts
-│
-├── testing/
-│   ├── HexDump.ts, OrderTestCatalog.ts, PrintDataAssertion.ts, index.ts
-│
-└── __tests__/                            # integration test ở root
-    ├── template-pipeline-integration.test.ts, phase2-integration.test.ts
+├── types/          # Alignment, Bitmap, Direction, Point, Rect, Rotation, Size, Unit
+├── catalog/        # biến có tên theo loại nội dung: defineCatalog, defineCollection, CatalogIndex, biến có sẵn
+├── template/       # TemplateDocument JSON độc lập DPI
+│   ├── style/      # Length, Dimension, Insets, BoxStyle, LayoutStyle, TextStyle
+│   ├── content/    # Segment, ValueFormat, Condition
+│   ├── nodes/      # TemplateNode và các node container/text/image/barcode/qrcode/line/repeat
+│   ├── format/     # formatter vi-VN tự cài đặt (không dùng Intl)
+│   ├── parse/      # parseTemplate, migrateTemplate, validate cấu trúc/tách tem/theo catalog
+│   └── builder/    # DSL labelTemplate/receiptTemplate(catalog), scope.var/repeat
+├── resolution/     # ghép template + data qua catalog, kế hoạch trang (planPages), tách repeat lồng
+├── layout/         # đổi Length → dots theo DPI rồi xếp vị trí, sinh PrintElement[]
+├── document/       # ResolvedPrintDocument + PrintElement (content/drawing/layout/control)
+├── core/           # contract: PrinterLanguage, PrintCompiler/Parser/Preview/Validation, PrinterFeatures,
+│                   # registry + dispatch compileTo/parseFrom/validateFor/previewFor
+├── language/       # BitmapFont (TSPL), MagnifiedFont (ESC/POS), CompileWarnings
+│   ├── tspl/       # TsplCommand, TsplCompiler, TsplEncoder, TsplFontMetrics, TsplParser
+│   └── escpos/     # EscPosCommand, EscPosCompiler, EscPosCodePage, EscPos{Barcode,Image,QrCode}Encoder,
+│                   # EscPosFontMetrics, EscPosParser
+├── preview/languages/{tspl,escpos}/      # preview SVG theo từng ngôn ngữ
+├── validation/     # ValidationIssue, ValidationResult + languages/{tspl,escpos}/ validator
+├── convert/        # convert() giữa các ngôn ngữ, ConversionRegistry, SUPPORTED_SOURCES/TARGETS
+├── formatting/     # TableColumn, formatTable/formatRow, validateTableColumns (bảng trong element table)
+├── encoding/       # CodePage, encodeTextForPrinter + encoders/ (CP437/857/858/866, Windows-1252/1258, UTF-8)
+├── image/          # crop/resize/threshold/dither ảnh thành bitmap đơn sắc + dithering/
+├── symbology/      # barcode/ và qrcode/: cấu hình + validate
+└── testing/        # OrderTestCatalog — catalog đơn hàng + data mẫu dùng chung cho test (không export ra ngoài)
 ```
 
+Test đặt trong `__tests__/` cạnh file nguồn; test tích hợp ở `src/__tests__/`.
+
 ## Phân trang tem
 
 - `repeat` ngoài cùng có `maxItemsPerPage` chia phần tử (sau `expand`) thành từng trang/tem.
-- `repeat` lồng ngay bên trong nó cũng có thể khai báo `maxItemsPerPage` (VD topping mỗi tem tối đa 4); phần dư in
-  sang tem tiếp theo, tem tiếp in lại toàn bộ nội dung của phần tử. Điều kiện: repeat ngoài cùng có
-  `maxItemsPerPage` là 1, chỉ lồng 1 tầng, và chỉ 1 repeat ngoài cùng được chứa repeat lồng tách tem —
-  `parseTemplate` báo lỗi nếu vi phạm.
+- `repeat` lồng ngay bên trong nó cũng có thể khai báo `maxItemsPerPage` (VD topping mỗi tem tối đa 4):
+  - Phần dư in sang tem tiếp theo; tem tiếp in lại toàn bộ nội dung của phần tử.
+  - Điều kiện: repeat ngoài cùng có `maxItemsPerPage` là 1, chỉ lồng 1 tầng, và chỉ 1 repeat ngoài cùng được chứa
+    repeat lồng tách tem. `parseTemplate` báo lỗi nếu vi phạm.
 - Biến có sẵn `$part`/`$partCount` (dùng ở mọi chỗ) cho biết tem thứ mấy trong phần tử; là 1/1 khi không tách tem.
   VD chỉ in giá ở tem đầu: `visibleWhen(eq('$part', 1))`.
 
 ## Cỡ chữ và cảnh báo compile
 
-- `TextOptions.fontSize` (dots) là field cỡ chữ duy nhất của `PrintElement` text. Mỗi ngôn ngữ tự quy đổi
-  sang lệnh native qua `language/{lang}/{Lang}FontMetrics.ts` — đây là nguồn dữ liệu font duy nhất, dùng
-  chung cho compiler, parser (dựng lại `fontSize` best-effort) và preview.
-- `PrintCompiler.compile()` và `compileTo()` trả `{ output, warnings }`. `warnings` liệt kê field bị bỏ
-  qua/gộp và element ngôn ngữ không có lệnh tương ứng; `output` giữ nguyên hành vi cũ (element không hỗ
-  trợ vẫn không phát lệnh nào). Cảnh báo trùng nội dung chỉ xuất hiện 1 lần; `cut` với `mode: 'off'`
-  không cảnh báo vì không yêu cầu cắt.
-- Với các compiler chỉ phát output dạng chuỗi (TSPL, ZPL, EPL, CPCL, DPL, SBPL, IPL), element `raw` mang
-  nội dung `Uint8Array` bị bỏ qua (output vẫn là `''` như trước) kèm cảnh báo — ESC/POS và Star PRNT phát
-  output dạng byte nên không bị giới hạn này.
+- **Cỡ chữ:** `TextOptions.fontSize` (dots) là field cỡ chữ duy nhất của `PrintElement` text.
+  - Mỗi ngôn ngữ quy đổi sang lệnh native qua `language/{lang}/{Lang}FontMetrics.ts`.
+  - Đây là nguồn dữ liệu font duy nhất, dùng chung cho compiler, parser (dựng lại `fontSize` best-effort) và
+    preview.
+- **Kết quả compile:** `PrintCompiler.compile()` và `compileTo()` trả `{ output, warnings }`.
+  - `warnings` liệt kê field bị bỏ qua/gộp và element ngôn ngữ không có lệnh tương ứng.
+  - `output` không phát lệnh nào cho element không hỗ trợ.
+  - Cảnh báo trùng nội dung chỉ xuất hiện 1 lần.
+  - `cut` với `mode: 'off'` không cảnh báo vì không yêu cầu cắt.
+- **Element `raw` với TSPL:** TSPL phát output dạng chuỗi, nên `raw` mang nội dung `Uint8Array` bị bỏ qua kèm
+  cảnh báo. ESC/POS phát output dạng byte nên không có giới hạn này.
 
 | Ngôn ngữ | Element bị bỏ qua (có cảnh báo) | Field bị bỏ/gộp (có cảnh báo) |
 |---|---|---|
 | TSPL | — | `CutOptions.mode: 'partial'` in như `'full'` |
-| EPL | diagonal, circle, ellipse, reverse, erase, cut | — |
-| CPCL | circle, ellipse, reverse, erase, cut | `BarcodeConfig.readable` |
-| ZPL | ellipse, reverse, erase | `CutOptions.rows`, `QrCodeConfig.rotation` |
-| DPL, SBPL, IPL | diagonal, circle, ellipse, reverse, erase, cut, barcode, qrcode | — |
 | ESC/POS | box, line, diagonal, circle, ellipse, reverse, erase | — |
-| Star PRNT | box, line, diagonal, circle, ellipse, reverse, erase, barcode, qrcode | `CutOptions.rows`, `CutOptions.mode: 'partial'` |
 
 ## Scripts
 
diff --git a/packages/printer-core/src/index.ts b/packages/printer-core/src/index.ts
index 0b09576..3783fcd 100644
--- a/packages/printer-core/src/index.ts
+++ b/packages/printer-core/src/index.ts
@@ -9,7 +9,6 @@ export * from './language';
 export * from './preview';
 export * from './validation';
 export * from './convert';
-export * from './testing';
 export * from './catalog';
 export * from './template';
 export * from './resolution';
~~~

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
(cd packages/printer-preview && npx tsc --noEmit && npx vitest run)
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `314 passed, 314 total`; `printer-preview` tsc sạch, Vitest `12 passed`; eslint `0 errors`.

- [ ] **Step 3: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/README.md \
  packages/printer-core/src/index.ts
git diff --cached -U0 -- '*.ts' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "refactor: stop exporting testing helpers and rewrite printer-core README" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.

---

### Task 4: Comment tiếng Việt, chỉ nói WHY

**Files:**
- Modify: `encoding/CodePage.ts`, `encoding/CodePageEncoder.ts`, `encoding/EncodingResult.ts`, `encoding/encoders/Cp437Encoder.ts`, `encoding/encoders/Cp857Encoder.ts`, `encoding/encoders/Cp858Encoder.ts`, `encoding/encoders/Cp866Encoder.ts`, `encoding/encoders/Utf8Encoder.ts`, `encoding/encoders/Windows1252Encoder.ts`, `encoding/encoders/Windows1258Encoder.ts`, `formatting/validateTableColumns.ts`, `image/ImageCrop.ts`, `image/ImageDither.ts`, `image/ImageResize.ts`, `image/ImageSource.ts`, `image/ImageThreshold.ts`, `image/ImageTransform.ts`, `image/MonochromeBitmap.ts`, `image/RgbaImage.ts`, `image/dithering/AtkinsonDither.ts`, `image/dithering/DitherAlgorithm.ts`, `image/dithering/FloydSteinbergDither.ts`, `image/dithering/OrderedDither.ts`, `image/dithering/ThresholdDither.ts`, `symbology/barcode/BarcodeType.ts`, `symbology/barcode/BarcodeValidator.ts`, `symbology/qrcode/QrCodeErrorCorrection.ts`, `symbology/qrcode/QrCodeModel.ts`, `symbology/qrcode/QrCodeValidator.ts`, `types/Direction.ts`, `validation/ValidationIssue.ts`, `validation/ValidationResult.ts`, `validation/languages/escpos/EscPosValidator.ts`, `validation/languages/tspl/TsplValidator.ts`

(Đường dẫn tính từ `packages/printer-core/src/` nếu không ghi khác.)

**Interfaces:**
- Consumes: Task 1-3.
- Produces: không đổi code; chỉ comment/JSDoc trong `encoding/`, `validation/`, `formatting/`, `image/`, `symbology/`, `types/Direction.ts`.
  - Thêm JSDoc tiếng Việt cho field của `ValidationIssue`, `ValidationResult`, `ImageSource`, `QrCodeModel`, `BarcodeValidationIssue`, `CodePage`, `EncodingResult`.
  - Chuỗi lỗi/cảnh báo lúc chạy (test đang kiểm tra) giữ nguyên.

- [ ] **Step 1: Áp patch**

Patch chỉ đổi comment/JSDoc: tiếng Anh → tiếng Việt, bỏ câu kể lịch sử (portakal, Phase 1, "ported from"), bỏ câu mô tả lại code, thêm JSDoc cho field còn thiếu. Không đổi dòng code nào.

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/plans/2026-09-26-printer-core-cleanup.md','utf8').replace(/\r\n/g,'\n');const k='<!-- patch:'+process.argv[1]+' -->\n~~~diff\n';const i=s.indexOf(k);if(i<0)throw new Error('không thấy patch '+process.argv[1]);const b=s.slice(i+k.length);process.stdout.write(b.slice(0,b.indexOf('\n~~~\n')+1))" t4 | git apply --ignore-whitespace -
```

<!-- patch:t4 -->
~~~diff
diff --git a/packages/printer-core/src/encoding/CodePage.ts b/packages/printer-core/src/encoding/CodePage.ts
index a5af944..241587a 100644
--- a/packages/printer-core/src/encoding/CodePage.ts
+++ b/packages/printer-core/src/encoding/CodePage.ts
@@ -1,9 +1,11 @@
-/** Single-byte printer code page: maps a high byte (0x80-0xFF) to the Unicode character it represents. */
+/** Code page 1 byte của máy in: ánh xạ byte cao (0x80-0xFF) sang ký tự Unicode. */
 export interface CodePage {
-  /** Numeric code page identifier (e.g. 437 for CP437, 1252 for Windows-1252). */
+  /** Số hiệu code page (VD 437 cho CP437, 1252 cho Windows-1252). */
   id: number;
-  /** Human-readable name. */
+
+  /** Tên hiển thị. */
   name: string;
-  /** Byte value (0x80-0xFF) -> Unicode character. 0x00-0x7F is always plain ASCII and is never listed here. */
+
+  /** Byte (0x80-0xFF) → ký tự Unicode; 0x00-0x7F luôn là ASCII nên không liệt kê. */
   chars: Record<number, string>;
 }
diff --git a/packages/printer-core/src/encoding/CodePageEncoder.ts b/packages/printer-core/src/encoding/CodePageEncoder.ts
index 1dbd7f6..22375c2 100644
--- a/packages/printer-core/src/encoding/CodePageEncoder.ts
+++ b/packages/printer-core/src/encoding/CodePageEncoder.ts
@@ -7,17 +7,18 @@ import { CP866 } from './encoders/Cp866Encoder';
 import { CP857 } from './encoders/Cp857Encoder';
 import { encodeUtf8Passthrough } from './encoders/Utf8Encoder';
 
-const REPLACEMENT_BYTE = 0x3f; // '?'
+/** Byte thay cho ký tự không có trong code page nào: dấu '?'. */
+const REPLACEMENT_BYTE = 0x3f;
 
-/** Available code pages in lookup priority order. */
+/** Code page theo thứ tự ưu tiên khi tự dò. */
 const CODE_PAGE_LIST: CodePage[] = [CP437, CP858, Windows1252, CP866, CP857];
 
-/** All registered code pages, keyed by id. */
+/** Mọi code page đã đăng ký, theo số hiệu. */
 export const CODE_PAGES: Record<number, CodePage> = Object.fromEntries(
   CODE_PAGE_LIST.map((codePage) => [codePage.id, codePage])
 );
 
-/** char -> byte reverse index per code page, built once so encodeText doesn't rescan `chars` per character. */
+/** Bảng tra ký tự → byte của từng code page, dựng 1 lần để không phải quét `chars` cho mỗi ký tự. */
 const REVERSE_INDEX: ReadonlyMap<CodePage, ReadonlyMap<string, number>> = new Map(
   CODE_PAGE_LIST.map((codePage) => [
     codePage,
@@ -25,7 +26,7 @@ const REVERSE_INDEX: ReadonlyMap<CodePage, ReadonlyMap<string, number>> = new Ma
   ])
 );
 
-/** Find a registered code page by id. */
+/** Tìm code page đã đăng ký theo số hiệu. */
 export function findCodePage(id: number): CodePage | undefined {
   return CODE_PAGES[id];
 }
@@ -39,16 +40,11 @@ function findByte(char: string, codePages: readonly CodePage[]): { codePage: Cod
 }
 
 /**
- * Encode text into printer bytes using code-page lookup for non-ASCII characters.
+ * Mã hoá chữ thành byte máy in; ký tự ngoài ASCII tra theo code page.
  *
- * When `preferredCodePage` is given and registered, the returned `codePage` is always that code
- * page (even for ASCII-only text) — callers use this to force a printer to switch to a specific
- * code page. Otherwise the code page is auto-detected from the first non-ASCII character that
- * needs one, or stays null when the text is plain ASCII.
- *
- * Note: unlike portakal's `encodeText` (which returns per-segment code-page switches as an
- * array), this returns a single `EncodingResult` with one `codePage` — text needing multiple
- * incompatible code pages at once is not supported by this simplified shape.
+ * Có `preferredCodePage` (đã đăng ký) thì luôn trả đúng code page đó, kể cả khi chữ toàn ASCII, để nơi gọi ép máy in
+ * chuyển sang code page này. Không có thì dò theo ký tự ngoài ASCII đầu tiên; chữ toàn ASCII thì `codePage` là null.
+ * Chỉ trả 1 code page cho cả chuỗi: chữ cần nhiều code page khác nhau cùng lúc thì ký tự thiếu thành '?'.
  */
 export function encodeText(text: string, preferredCodePage?: number): EncodingResult {
   const forcedCodePage = preferredCodePage !== undefined ? findCodePage(preferredCodePage) : undefined;
@@ -80,12 +76,8 @@ export function encodeText(text: string, preferredCodePage?: number): EncodingRe
 }
 
 /**
- * Encode text for a specific printer's text-encoding capabilities.
- *
- * Fix vs. portakal: portakal's `encodeTextForPrinter` accepts a `nativeUtf8`-shaped flag but never
- * branches on it, always doing code-page lookup. Here, when `encoding.nativeUtf8` is true,
- * text is sent as raw UTF-8 (no code-page switch); otherwise it falls back to `encodeText` using
- * the printer's first declared code page.
+ * Mã hoá chữ theo năng lực của máy in: máy nhận UTF-8 thì gửi thẳng UTF-8, không chuyển code page; ngược lại dùng
+ * code page đầu tiên máy khai báo.
  */
 export function encodeTextForPrinter(text: string, encoding: { nativeUtf8: boolean; codePages: number[] }): EncodingResult {
   if (encoding.nativeUtf8) {
diff --git a/packages/printer-core/src/encoding/EncodingResult.ts b/packages/printer-core/src/encoding/EncodingResult.ts
index 7c0986e..0c4b79d 100644
--- a/packages/printer-core/src/encoding/EncodingResult.ts
+++ b/packages/printer-core/src/encoding/EncodingResult.ts
@@ -1,11 +1,13 @@
 import type { CodePage } from './CodePage';
 
-/** Result of encoding text for a printer: the raw bytes plus which code page (if any) they assume. */
+/** Kết quả mã hoá chữ cho máy in: byte và code page mà byte đó giả định. */
 export interface EncodingResult {
-  /** Encoded bytes, ready to send to the printer. */
+  /** Byte đã mã hoá, gửi thẳng tới máy in. */
   bytes: Uint8Array;
-  /** Code page the bytes were encoded against, or null when no code page was needed/used (ASCII-only or UTF-8 passthrough). */
+
+  /** Code page của byte; null khi không cần code page (toàn ASCII hoặc gửi thẳng UTF-8). */
   codePage: CodePage | null;
-  /** Characters that could not be mapped to any code page and were replaced with '?'. */
+
+  /** Ký tự không có trong code page nào, đã thay bằng '?'. */
   unmappedChars: string[];
 }
diff --git a/packages/printer-core/src/encoding/encoders/Cp437Encoder.ts b/packages/printer-core/src/encoding/encoders/Cp437Encoder.ts
index b25b6d5..20beb56 100644
--- a/packages/printer-core/src/encoding/encoders/Cp437Encoder.ts
+++ b/packages/printer-core/src/encoding/encoders/Cp437Encoder.ts
@@ -1,6 +1,6 @@
 import type { CodePage } from '../CodePage';
 
-/** CP437 — US/Standard Europe, default code page on most ESC/POS printers. Ported from portakal/src/encoding.ts CP437_CHARS. */
+/** CP437 — Mỹ/Tây Âu, code page mặc định trên phần lớn máy in ESC/POS. */
 export const CP437: CodePage = {
   id: 437,
   name: 'CP437',
diff --git a/packages/printer-core/src/encoding/encoders/Cp857Encoder.ts b/packages/printer-core/src/encoding/encoders/Cp857Encoder.ts
index e392cdf..3fbc2e3 100644
--- a/packages/printer-core/src/encoding/encoders/Cp857Encoder.ts
+++ b/packages/printer-core/src/encoding/encoders/Cp857Encoder.ts
@@ -12,7 +12,7 @@ function withoutSharpS(chars: Record<number, string>): Record<number, string> {
   return result;
 }
 
-/** CP857 — Turkish (CP437 minus ß, plus Turkish letters). Ported from portakal/src/encoding.ts CP857_CHARS. */
+/** CP857 — tiếng Thổ Nhĩ Kỳ (CP437 bỏ ß, thêm chữ Thổ Nhĩ Kỳ). */
 export const CP857: CodePage = {
   id: 857,
   name: 'CP857',
diff --git a/packages/printer-core/src/encoding/encoders/Cp858Encoder.ts b/packages/printer-core/src/encoding/encoders/Cp858Encoder.ts
index 36f21e9..17e8a3e 100644
--- a/packages/printer-core/src/encoding/encoders/Cp858Encoder.ts
+++ b/packages/printer-core/src/encoding/encoders/Cp858Encoder.ts
@@ -1,7 +1,7 @@
 import type { CodePage } from '../CodePage';
 import { CP437 } from './Cp437Encoder';
 
-/** CP858 — CP437 plus the Euro sign at 0xD5. Ported from portakal/src/encoding.ts CP858_CHARS. */
+/** CP858 — CP437 thêm ký hiệu Euro ở byte 0xD5. */
 export const CP858: CodePage = {
   id: 858,
   name: 'CP858',
diff --git a/packages/printer-core/src/encoding/encoders/Cp866Encoder.ts b/packages/printer-core/src/encoding/encoders/Cp866Encoder.ts
index c47ba40..62bbf33 100644
--- a/packages/printer-core/src/encoding/encoders/Cp866Encoder.ts
+++ b/packages/printer-core/src/encoding/encoders/Cp866Encoder.ts
@@ -8,7 +8,7 @@ function buildRange(byteStart: number, count: number, unicodeStart: number): Rec
   return chars;
 }
 
-/** CP866 — Cyrillic (Russian, Ukrainian, Belarusian). Ported from portakal/src/encoding.ts CP866_CHARS. */
+/** CP866 — chữ Kirin (Nga, Ukraina, Belarus). */
 export const CP866: CodePage = {
   id: 866,
   name: 'CP866',
diff --git a/packages/printer-core/src/encoding/encoders/Utf8Encoder.ts b/packages/printer-core/src/encoding/encoders/Utf8Encoder.ts
index bb06c55..d04bd45 100644
--- a/packages/printer-core/src/encoding/encoders/Utf8Encoder.ts
+++ b/packages/printer-core/src/encoding/encoders/Utf8Encoder.ts
@@ -1,7 +1,4 @@
-/**
- * UTF-8 passthrough — used by printers whose firmware natively renders UTF-8 (e.g. Epson TM-m30II
- * with `features.nativeUtf8: true`), bypassing code-page byte mapping entirely.
- */
+/** Gửi thẳng UTF-8, không qua code page — cho máy in có firmware tự hiển thị UTF-8 (`features.nativeUtf8`). */
 export function encodeUtf8Passthrough(text: string): Uint8Array {
   return new TextEncoder().encode(text);
 }
diff --git a/packages/printer-core/src/encoding/encoders/Windows1252Encoder.ts b/packages/printer-core/src/encoding/encoders/Windows1252Encoder.ts
index 54c9b32..27efd6f 100644
--- a/packages/printer-core/src/encoding/encoders/Windows1252Encoder.ts
+++ b/packages/printer-core/src/encoding/encoders/Windows1252Encoder.ts
@@ -1,6 +1,6 @@
 import type { CodePage } from '../CodePage';
 
-/** Latin supplement 0xA0-0xFF is 1:1 with Unicode U+00A0-U+00FF, as in Windows-1252. */
+/** Vùng 0xA0-0xFF của Windows-1252 trùng 1:1 với Unicode U+00A0-U+00FF. */
 function buildLatinSupplement(): Record<number, string> {
   const chars: Record<number, string> = {};
   for (let i = 0; i < 96; i++) {
@@ -9,7 +9,7 @@ function buildLatinSupplement(): Record<number, string> {
   return chars;
 }
 
-/** Windows-1252 — Western European (Latin 1). Ported from portakal/src/encoding.ts CP1252_CHARS. */
+/** Windows-1252 — Tây Âu (Latin 1). */
 export const Windows1252: CodePage = {
   id: 1252,
   name: 'Windows1252',
diff --git a/packages/printer-core/src/encoding/encoders/Windows1258Encoder.ts b/packages/printer-core/src/encoding/encoders/Windows1258Encoder.ts
index 59f986d..9f5f76b 100644
--- a/packages/printer-core/src/encoding/encoders/Windows1258Encoder.ts
+++ b/packages/printer-core/src/encoding/encoders/Windows1258Encoder.ts
@@ -1,16 +1,12 @@
 import type { CodePage } from '../CodePage';
 
 /**
- * Windows-1258 (CP1258, "Windows Vietnamese") — standard Microsoft code page. Bytes 0x81, 0x8A,
- * 0x8D, 0x8E, 0x8F, 0x90, 0x9A, 0x9D, 0x9E are undefined in the standard and intentionally omitted.
+ * Windows-1258 (CP1258, tiếng Việt). Các byte 0x81, 0x8A, 0x8D, 0x8E, 0x8F, 0x90, 0x9A, 0x9D, 0x9E không được chuẩn
+ * định nghĩa nên không liệt kê.
  *
- * Five bytes (0xCC, 0xD2, 0xDE, 0xEC, 0xF2) hold Vietnamese combining tone marks (grave/hook
- * above/tilde/acute/dot below) rather than standalone letters — CP1258 composes a base Latin
- * letter followed by one of these bytes to render a toned vowel, since not every Vietnamese
- * vowel+tone combination has its own single-byte slot.
- *
- * Values cross-checked against the WHATWG "windows-1258" mapping shipped in this repo's own
- * iconv-lite dependency (node_modules/iconv-lite/encodings/sbcs-data-generated.js).
+ * 5 byte 0xCC, 0xD2, 0xDE, 0xEC, 0xF2 là dấu thanh tổ hợp (huyền, hỏi, ngã, sắc, nặng), không phải chữ đứng riêng:
+ * CP1258 ghép chữ Latin gốc với 1 byte dấu thanh, vì không phải tổ hợp nguyên âm + dấu nào cũng có ô 1 byte riêng.
+ * Giá trị đối chiếu với bảng "windows-1258" của WHATWG.
  */
 export const Windows1258: CodePage = {
   id: 1258,
diff --git a/packages/printer-core/src/formatting/validateTableColumns.ts b/packages/printer-core/src/formatting/validateTableColumns.ts
index 3fcb9a5..0f836cb 100644
--- a/packages/printer-core/src/formatting/validateTableColumns.ts
+++ b/packages/printer-core/src/formatting/validateTableColumns.ts
@@ -1,19 +1,9 @@
 import type { TableColumn } from './TableColumn';
 
 /**
- * Validates that every column has a positive width before it reaches
- * `formatTable()`/`formatRow()`.
- *
- * `formatRow()`'s auto-width logic treats any column with `width <= 0` as
- * "auto-size this column", computing `autoWidth = (totalWidth -
- * assignedWidth) / autoCount`. All 3 callers of `formatTable()` in this
- * package (`EscPosCompiler`, `TsplCompiler`, `TsplPreviewRenderer`) derive
- * `totalWidth` as the sum of the columns' own `width` values, which makes
- * `totalWidth - assignedWidth` exactly equal to the auto columns' own
- * (non-positive) width — i.e. always zero for a `width: 0` column. That
- * column then renders as an empty string, silently dropping real cell
- * content instead of erroring. Auto-sizing isn't supported yet, so this
- * rejects it explicitly instead of letting it fail silently.
+ * Bắt buộc mọi cột có độ rộng dương trước khi vào `formatTable()`/`formatRow()`. `formatRow()` coi `width <= 0` là
+ * cột tự co giãn, nhưng mọi nơi gọi đều tính tổng độ rộng từ chính các cột nên cột đó luôn rộng 0 và mất nội dung
+ * âm thầm — báo lỗi rõ thay vì in thiếu.
  */
 export function validateTableColumns(columns: TableColumn[]): void {
   for (const column of columns) {
diff --git a/packages/printer-core/src/image/ImageCrop.ts b/packages/printer-core/src/image/ImageCrop.ts
index f934396..9181d86 100644
--- a/packages/printer-core/src/image/ImageCrop.ts
+++ b/packages/printer-core/src/image/ImageCrop.ts
@@ -1,6 +1,6 @@
 import type { Rect } from '../types/Rect';
 
-/** Crop an RGBA image to `region` via a straightforward per-row copy. */
+/** Cắt ảnh RGBA theo vùng `region`. */
 export function cropRgba(
   rgba: Uint8Array | Uint8ClampedArray,
   width: number,
diff --git a/packages/printer-core/src/image/ImageDither.ts b/packages/printer-core/src/image/ImageDither.ts
index 4ee4b2e..a0f8242 100644
--- a/packages/printer-core/src/image/ImageDither.ts
+++ b/packages/printer-core/src/image/ImageDither.ts
@@ -4,7 +4,7 @@ import { ditherFloydSteinberg } from './dithering/FloydSteinbergDither';
 import { ditherAtkinson } from './dithering/AtkinsonDither';
 import { ditherOrdered } from './dithering/OrderedDither';
 
-/** Dispatch to the dithering algorithm named by `algorithm`, producing 8-bit output (0 or 255 per pixel). */
+/** Dither ảnh xám theo thuật toán `algorithm`; mỗi điểm ra 0 hoặc 255. */
 export function applyDither(
   gray: Uint8Array,
   width: number,
diff --git a/packages/printer-core/src/image/ImageResize.ts b/packages/printer-core/src/image/ImageResize.ts
index 1fe61d6..c0089a6 100644
--- a/packages/printer-core/src/image/ImageResize.ts
+++ b/packages/printer-core/src/image/ImageResize.ts
@@ -1,4 +1,4 @@
-/** Resize an RGBA image using nearest-neighbor sampling. */
+/** Đổi kích thước ảnh RGBA bằng lấy mẫu điểm gần nhất. */
 export function resizeNearestNeighbor(
   rgba: Uint8Array | Uint8ClampedArray,
   width: number,
diff --git a/packages/printer-core/src/image/ImageSource.ts b/packages/printer-core/src/image/ImageSource.ts
index 5c8be4b..09ce2a2 100644
--- a/packages/printer-core/src/image/ImageSource.ts
+++ b/packages/printer-core/src/image/ImageSource.ts
@@ -1,9 +1,11 @@
-/**
- * Parameter-object form of an RGBA image (data + dimensions), for callers that prefer
- * passing a single object instead of separate positional arguments.
- */
+/** Ảnh RGBA gói trong 1 object (dữ liệu + kích thước). */
 export interface ImageSource {
+  /** Dữ liệu RGBA, 4 byte mỗi điểm, theo hàng. */
   data: Uint8Array | Uint8ClampedArray;
+
+  /** Chiều rộng, tính bằng điểm ảnh. */
   width: number;
+
+  /** Chiều cao, tính bằng điểm ảnh. */
   height: number;
 }
diff --git a/packages/printer-core/src/image/ImageThreshold.ts b/packages/printer-core/src/image/ImageThreshold.ts
index 78c1bbe..c497ed6 100644
--- a/packages/printer-core/src/image/ImageThreshold.ts
+++ b/packages/printer-core/src/image/ImageThreshold.ts
@@ -1,3 +1,2 @@
-// Canonical implementation lives in `dithering/ThresholdDither.ts`; re-exported here for callers
-// that want direct-threshold conversion without going through the dither dispatch.
+// Cho phép đổi ảnh theo ngưỡng trực tiếp, không qua bước chọn thuật toán dither.
 export { ditherThreshold } from './dithering/ThresholdDither';
diff --git a/packages/printer-core/src/image/ImageTransform.ts b/packages/printer-core/src/image/ImageTransform.ts
index d86e882..c94f48b 100644
--- a/packages/printer-core/src/image/ImageTransform.ts
+++ b/packages/printer-core/src/image/ImageTransform.ts
@@ -4,7 +4,7 @@ import { packBitmap } from './MonochromeBitmap';
 import { rgbaToGrayscale } from './RgbaImage';
 import { applyDither } from './ImageDither';
 
-/** Convert an RGBA image to a {@link MonochromeBitmap} using the specified dithering algorithm. */
+/** Đổi ảnh RGBA thành {@link MonochromeBitmap} bằng thuật toán dither đã chọn. */
 export function imageToMonochrome(
   rgba: Uint8Array | Uint8ClampedArray,
   width: number,
diff --git a/packages/printer-core/src/image/MonochromeBitmap.ts b/packages/printer-core/src/image/MonochromeBitmap.ts
index 0d0b08c..196c86e 100644
--- a/packages/printer-core/src/image/MonochromeBitmap.ts
+++ b/packages/printer-core/src/image/MonochromeBitmap.ts
@@ -1,7 +1,7 @@
 export type { Bitmap as MonochromeBitmap } from '../types/Bitmap';
 import type { Bitmap } from '../types/Bitmap';
 
-/** Pack 8-bit dithered pixels (0 or 255) into a 1-bit MonochromeBitmap, row-major, MSB-first. */
+/** Nén điểm đã dither (0 hoặc 255) thành bitmap 1 bit mỗi điểm, theo hàng, bit cao trước. */
 export function packBitmap(dithered: Uint8Array, width: number, height: number): Bitmap {
   const bytesPerRow = Math.ceil(width / 8);
   const data = new Uint8Array(bytesPerRow * height);
@@ -12,7 +12,7 @@ export function packBitmap(dithered: Uint8Array, width: number, height: number):
       if (isBlack) {
         const byteIdx = y * bytesPerRow + Math.floor(x / 8);
         const bitIdx = 7 - (x % 8);
-        // eslint-disable-next-line no-bitwise -- intentional bit packing, MSB-first per pixel row
+        // eslint-disable-next-line no-bitwise -- nén bit, bit cao trước
         data[byteIdx]! |= 1 << bitIdx;
       }
     }
diff --git a/packages/printer-core/src/image/RgbaImage.ts b/packages/printer-core/src/image/RgbaImage.ts
index ea88a0c..b470e51 100644
--- a/packages/printer-core/src/image/RgbaImage.ts
+++ b/packages/printer-core/src/image/RgbaImage.ts
@@ -1,8 +1,6 @@
 /**
- * Reduces RGBA pixel data to a single-channel grayscale buffer. Since thermal
- * paper has no notion of transparency, translucent pixels are first flattened
- * onto an opaque white backdrop before the RGB channels are folded down to a
- * brightness value using the BT.601 luma weights.
+ * Đổi RGBA thành ảnh xám 1 kênh. Giấy in nhiệt không có trong suốt, nên điểm trong suốt được phủ lên nền trắng trước
+ * khi tính độ sáng theo trọng số BT.601.
  */
 export function rgbaToGrayscale(
   rgba: Uint8Array | Uint8ClampedArray,
@@ -15,17 +13,17 @@ export function rgbaToGrayscale(
     const g = rgba[i * 4 + 1]!;
     const b = rgba[i * 4 + 2]!;
     const a = rgba[i * 4 + 3]!;
-    // Blend each channel toward white (255) in proportion to how transparent the pixel is
+    // Càng trong suốt càng gần màu trắng của giấy.
     const rr = (r * a + 255 * (255 - a)) / 255;
     const gg = (g * a + 255 * (255 - a)) / 255;
     const bb = (b * a + 255 * (255 - a)) / 255;
-    // BT.601 luma weights — green contributes the most to perceived brightness, blue the least
+    // Mắt người nhạy với xanh lá nhất, xanh dương kém nhất.
     gray[i] = Math.round(0.299 * rr + 0.587 * gg + 0.114 * bb);
   }
   return gray;
 }
 
-/** Named alias for {@link rgbaToGrayscale}, matching this module's `RgbaImage` public API. */
+/** Tên khác của {@link rgbaToGrayscale}. */
 export function toGrayscale(
   rgba: Uint8Array | Uint8ClampedArray,
   width: number,
diff --git a/packages/printer-core/src/image/dithering/AtkinsonDither.ts b/packages/printer-core/src/image/dithering/AtkinsonDither.ts
index aee489b..f3a79be 100644
--- a/packages/printer-core/src/image/dithering/AtkinsonDither.ts
+++ b/packages/printer-core/src/image/dithering/AtkinsonDither.ts
@@ -1,4 +1,4 @@
-/** Atkinson dithering — propagates only 75% of the quantization error to 6 neighbors (1/8 each). */
+/** Dither Atkinson: chỉ lan 75% sai số sang 6 điểm lân cận (mỗi điểm 1/8), ảnh sáng và rõ nét hơn. */
 export function ditherAtkinson(gray: Uint8Array, width: number, height: number): Uint8Array {
   const err = new Float32Array(gray.length);
   for (let i = 0; i < gray.length; i++) err[i] = gray[i]!;
diff --git a/packages/printer-core/src/image/dithering/DitherAlgorithm.ts b/packages/printer-core/src/image/dithering/DitherAlgorithm.ts
index 079b276..3c9e6ba 100644
--- a/packages/printer-core/src/image/dithering/DitherAlgorithm.ts
+++ b/packages/printer-core/src/image/dithering/DitherAlgorithm.ts
@@ -1,2 +1,2 @@
-/** Supported monochrome dithering algorithms. */
+/** Thuật toán dither ảnh đơn sắc được hỗ trợ. */
 export type DitherAlgorithm = 'threshold' | 'floyd-steinberg' | 'atkinson' | 'ordered';
diff --git a/packages/printer-core/src/image/dithering/FloydSteinbergDither.ts b/packages/printer-core/src/image/dithering/FloydSteinbergDither.ts
index 9b36343..c262513 100644
--- a/packages/printer-core/src/image/dithering/FloydSteinbergDither.ts
+++ b/packages/printer-core/src/image/dithering/FloydSteinbergDither.ts
@@ -1,10 +1,10 @@
-/** Floyd-Steinberg error diffusion dithering (serpentine scan). */
+/** Dither Floyd-Steinberg, quét zigzag để tránh vệt sai số lệch về 1 phía. */
 export function ditherFloydSteinberg(gray: Uint8Array, width: number, height: number): Uint8Array {
   const err = new Float32Array(gray.length);
   for (let i = 0; i < gray.length; i++) err[i] = gray[i]!;
 
   for (let y = 0; y < height; y++) {
-    // eslint-disable-next-line no-bitwise -- parity check for serpentine scan direction
+    // eslint-disable-next-line no-bitwise -- hàng chẵn/lẻ quyết định chiều quét
     const ltr = (y & 1) === 0;
     const xStart = ltr ? 0 : width - 1;
     const xEnd = ltr ? width : -1;
diff --git a/packages/printer-core/src/image/dithering/OrderedDither.ts b/packages/printer-core/src/image/dithering/OrderedDither.ts
index 338e9fb..5bdf82e 100644
--- a/packages/printer-core/src/image/dithering/OrderedDither.ts
+++ b/packages/printer-core/src/image/dithering/OrderedDither.ts
@@ -1,4 +1,4 @@
-/** 4x4 Bayer ordered dithering matrix. */
+/** Ma trận Bayer 4x4. */
 const BAYER4 = [
   [0, 8, 2, 10],
   [12, 4, 14, 6],
@@ -6,7 +6,7 @@ const BAYER4 = [
   [15, 7, 13, 5],
 ];
 
-/** Ordered dithering using a 4x4 Bayer matrix. */
+/** Dither theo ma trận Bayer 4x4, cho hoa văn đều, không lan sai số. */
 export function ditherOrdered(gray: Uint8Array, width: number, height: number): Uint8Array {
   const out = new Uint8Array(gray.length);
   for (let y = 0; y < height; y++) {
diff --git a/packages/printer-core/src/image/dithering/ThresholdDither.ts b/packages/printer-core/src/image/dithering/ThresholdDither.ts
index 3329205..2899293 100644
--- a/packages/printer-core/src/image/dithering/ThresholdDither.ts
+++ b/packages/printer-core/src/image/dithering/ThresholdDither.ts
@@ -1,4 +1,4 @@
-/** Simple threshold dithering: pixels below `threshold` become black (0), others white (255). */
+/** Đổi theo ngưỡng: điểm dưới `threshold` thành đen (0), còn lại trắng (255). */
 export function ditherThreshold(
   gray: Uint8Array,
   width: number,
diff --git a/packages/printer-core/src/symbology/barcode/BarcodeType.ts b/packages/printer-core/src/symbology/barcode/BarcodeType.ts
index 08d2037..06c0d5c 100644
--- a/packages/printer-core/src/symbology/barcode/BarcodeType.ts
+++ b/packages/printer-core/src/symbology/barcode/BarcodeType.ts
@@ -1,11 +1,5 @@
 /**
- * Barcode symbologies describable by this layer.
- *
- * This is the intersection of symbologies natively supported by TSPL's
- * `BARCODE "type",...` command and ESC/POS's `GS k` command (types 0-6
- * in format A, plus CODE93/CODE128 added in format B) — i.e. the set of
- * 1D barcodes every printer-native barcode command in the portakal spec
- * can emit without any bar-drawing logic of our own.
+ * Loại mã vạch 1D mà cả lệnh `BARCODE` của TSPL lẫn `GS k` của ESC/POS đều in được, để không phải tự vẽ vạch.
  */
 export type BarcodeSymbology =
   | 'code39'
diff --git a/packages/printer-core/src/symbology/barcode/BarcodeValidator.ts b/packages/printer-core/src/symbology/barcode/BarcodeValidator.ts
index d9c6435..5e4ba17 100644
--- a/packages/printer-core/src/symbology/barcode/BarcodeValidator.ts
+++ b/packages/printer-core/src/symbology/barcode/BarcodeValidator.ts
@@ -1,24 +1,18 @@
 import type { BarcodeConfig } from './BarcodeConfig';
 
-/**
- * A validation finding for a barcode (or QR code) config.
- *
- * Deliberately a minimal local shape: this predates the shared `validation/`
- * folder and its language-specific `ValidationIssue` type, and stays
- * independent of it.
- */
+/** 1 vấn đề tìm thấy khi kiểm tra cấu hình barcode hoặc QR code. */
 export interface BarcodeValidationIssue {
+  /** Mức độ: lỗi hoặc cảnh báo. */
   level: 'error' | 'warning';
+
+  /** Mô tả vấn đề. */
   message: string;
 }
 
 const EAN13_LENGTHS = [12, 13];
 const EAN8_LENGTHS = [7, 8];
 
-/**
- * Validates a `BarcodeConfig` against printer-native constraints, without
- * computing or rendering any actual bars.
- */
+/** Kiểm tra `BarcodeConfig` theo giới hạn của lệnh barcode máy in (không tự vẽ vạch). */
 export function validateBarcodeConfig(config: BarcodeConfig): BarcodeValidationIssue[] {
   const issues: BarcodeValidationIssue[] = [];
 
diff --git a/packages/printer-core/src/symbology/qrcode/QrCodeErrorCorrection.ts b/packages/printer-core/src/symbology/qrcode/QrCodeErrorCorrection.ts
index 7100068..d4aad18 100644
--- a/packages/printer-core/src/symbology/qrcode/QrCodeErrorCorrection.ts
+++ b/packages/printer-core/src/symbology/qrcode/QrCodeErrorCorrection.ts
@@ -1,5 +1,2 @@
-/**
- * QR error correction level, as accepted by TSPL's `QRCODE` command's
- * `ecc` field ("L" | "M" | "Q" | "H", per the QR spec's own ECC letters).
- */
+/** Mức sửa lỗi QR theo chuẩn QR, cũng là giá trị field `ecc` của lệnh `QRCODE` TSPL. */
 export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
diff --git a/packages/printer-core/src/symbology/qrcode/QrCodeModel.ts b/packages/printer-core/src/symbology/qrcode/QrCodeModel.ts
index 2463844..cf59862 100644
--- a/packages/printer-core/src/symbology/qrcode/QrCodeModel.ts
+++ b/packages/printer-core/src/symbology/qrcode/QrCodeModel.ts
@@ -1,11 +1,5 @@
-/**
- * Passthrough marker type for a QR code's payload.
- *
- * Kept minimal for Phase 1: portakal never computes an actual QR
- * bit-matrix itself (the printer firmware does), and no consumer here
- * needs a computed module grid yet — so this is just a content carrier,
- * not a Code128/QR bit-matrix generator.
- */
+/** Nội dung QR code; firmware máy in tự tính ma trận module nên chỉ cần mang nội dung. */
 export interface QrCodeModel {
+  /** Dữ liệu mã hoá trong QR code. */
   content: string;
 }
diff --git a/packages/printer-core/src/symbology/qrcode/QrCodeValidator.ts b/packages/printer-core/src/symbology/qrcode/QrCodeValidator.ts
index 0dd1a00..f17a8f2 100644
--- a/packages/printer-core/src/symbology/qrcode/QrCodeValidator.ts
+++ b/packages/printer-core/src/symbology/qrcode/QrCodeValidator.ts
@@ -1,13 +1,10 @@
 import type { BarcodeValidationIssue } from '../barcode/BarcodeValidator';
 import type { QrCodeConfig } from './QrCodeConfig';
 
-/** Practical ceiling for QR alphanumeric-mode payloads. */
+/** Độ dài tối đa dùng được trong thực tế của nội dung QR dạng chữ số + chữ. */
 const MAX_QR_CONTENT_LENGTH = 7089;
 
-/**
- * Validates a `QrCodeConfig` against printer-native constraints, without
- * computing or rendering any actual QR modules.
- */
+/** Kiểm tra `QrCodeConfig` theo giới hạn của lệnh QR máy in (không tự tính module). */
 export function validateQrCodeConfig(config: QrCodeConfig): BarcodeValidationIssue[] {
   const issues: BarcodeValidationIssue[] = [];
 
diff --git a/packages/printer-core/src/types/Direction.ts b/packages/printer-core/src/types/Direction.ts
index f6a2b8f..dfe73d5 100644
--- a/packages/printer-core/src/types/Direction.ts
+++ b/packages/printer-core/src/types/Direction.ts
@@ -1,2 +1,2 @@
-/** Label print direction (TSPL2 `DIRECTION` command: 'forward' → 0, 'reverse' → 1). */
+/** Chiều đẩy tem khi in (lệnh `DIRECTION` TSPL2: 'forward' → 0, 'reverse' → 1). */
 export type Direction = 'forward' | 'reverse';
diff --git a/packages/printer-core/src/validation/ValidationIssue.ts b/packages/printer-core/src/validation/ValidationIssue.ts
index fbc234f..1f14282 100644
--- a/packages/printer-core/src/validation/ValidationIssue.ts
+++ b/packages/printer-core/src/validation/ValidationIssue.ts
@@ -1,7 +1,14 @@
-/** A single finding from validating printer source (bytes or command text). */
+/** 1 vấn đề tìm thấy khi kiểm tra lệnh máy in (byte hoặc chuỗi lệnh). */
 export interface ValidationIssue {
+  /** Mức độ: lỗi, cảnh báo, thông tin. */
   level: 'error' | 'warning' | 'info';
+
+  /** Dòng lệnh chứa vấn đề (từ 1); bỏ trống với nguồn dạng byte. */
   line?: number;
+
+  /** Tên lệnh liên quan. */
   command?: string;
+
+  /** Mô tả vấn đề. */
   message: string;
 }
diff --git a/packages/printer-core/src/validation/ValidationResult.ts b/packages/printer-core/src/validation/ValidationResult.ts
index be9484c..a104522 100644
--- a/packages/printer-core/src/validation/ValidationResult.ts
+++ b/packages/printer-core/src/validation/ValidationResult.ts
@@ -1,10 +1,19 @@
 import type { ValidationIssue } from './ValidationIssue';
 
-/** Outcome of validating printer source: whether it's error-free, plus every issue found and severity counts. */
+/** Kết quả kiểm tra lệnh máy in. */
 export interface ValidationResult {
+  /** Không có lỗi mức `error`. */
   valid: boolean;
+
+  /** Mọi vấn đề tìm thấy. */
   issues: ValidationIssue[];
+
+  /** Số vấn đề mức `error`. */
   errors: number;
+
+  /** Số vấn đề mức `warning`. */
   warnings: number;
+
+  /** Số vấn đề mức `info`. */
   infos: number;
 }
diff --git a/packages/printer-core/src/validation/languages/escpos/EscPosValidator.ts b/packages/printer-core/src/validation/languages/escpos/EscPosValidator.ts
index 7661acd..9d79999 100644
--- a/packages/printer-core/src/validation/languages/escpos/EscPosValidator.ts
+++ b/packages/printer-core/src/validation/languages/escpos/EscPosValidator.ts
@@ -3,7 +3,7 @@ import type { PrintValidation } from '../../../core';
 import type { ValidationIssue } from '../../ValidationIssue';
 import type { ValidationResult } from '../../ValidationResult';
 
-/** ESC-prefixed command byte -> its fixed parameter-byte count (commands not listed here are assumed to take none). */
+/** Byte lệnh sau ESC → số byte tham số cố định; lệnh không có trong bảng coi như không có tham số. */
 const ESC_PARAM_LENGTH: Record<number, number> = {
   0x40: 0,
   0x61: 1,
@@ -21,7 +21,7 @@ const ESC_PARAM_LENGTH: Record<number, number> = {
   0x70: 3,
 };
 
-/** GS-prefixed command byte -> its fixed parameter-byte count. 0x6b/0x56/0x76/0x28 are variable-length and handled separately. */
+/** Byte lệnh sau GS → số byte tham số cố định; 0x6b/0x56/0x76/0x28 dài thay đổi nên xử lý riêng. */
 const GS_PARAM_LENGTH: Record<number, number> = {
   0x21: 1,
   0x42: 1,
@@ -33,12 +33,12 @@ const GS_PARAM_LENGTH: Record<number, number> = {
   0x72: 1,
 };
 
-/** "GS k" symbology byte values >= this select the length-prefixed format B; below it, the NUL-terminated format A. */
+/** Mã symbology của "GS k" từ giá trị này trở lên là dạng B (có byte độ dài); thấp hơn là dạng A (kết thúc NUL). */
 const BARCODE_FORMAT_B_MIN_TYPE = 65;
 
 function bytesFromSource(source: string): Uint8Array {
   const bytes = new Uint8Array(source.length);
-  // eslint-disable-next-line no-bitwise -- clamping each char code to a single byte
+  // eslint-disable-next-line no-bitwise -- giữ đúng 1 byte cho mỗi ký tự
   for (let i = 0; i < source.length; i++) bytes[i] = source.charCodeAt(i) & 0xff;
   return bytes;
 }
@@ -47,7 +47,7 @@ function isPrintableOrExtended(byte: number): boolean {
   return (byte >= 0x20 && byte <= 0x7e) || byte >= 0x80;
 }
 
-/** Skips a "GS k" barcode command (either NUL-terminated format A or length-prefixed format B) and returns the next index. */
+/** Bỏ qua lệnh barcode "GS k" (dạng A kết thúc NUL hoặc dạng B có độ dài), trả vị trí tiếp theo. */
 function skipBarcode(bytes: Uint8Array, i: number): number {
   if (i + 2 >= bytes.length) return i + 2;
   const m = bytes[i + 2]!;
@@ -59,7 +59,7 @@ function skipBarcode(bytes: Uint8Array, i: number): number {
   return end + 1;
 }
 
-/** Skips a "GS ( k" 2D-symbol command (QR, PDF417, ...) and returns the next index. */
+/** Bỏ qua lệnh mã 2D "GS ( k" (QR, PDF417...), trả vị trí tiếp theo. */
 function skipTwoDCode(bytes: Uint8Array, i: number): number {
   if (bytes[i + 2] !== ESC_POS.TWO_D_CODE[1] || i + 4 >= bytes.length) return i + 3;
   const len = bytes[i + 3]! + bytes[i + 4]! * 256;
@@ -67,9 +67,8 @@ function skipTwoDCode(bytes: Uint8Array, i: number): number {
 }
 
 /**
- * Checks a "GS v 0" raster-image header against the bytes actually available in the
- * buffer. Returns the next index to resume scanning from, or -1 when the image's
- * declared data length overflows the buffer (a genuinely malformed stream).
+ * Đối chiếu header ảnh raster "GS v 0" với số byte thật còn lại. Trả vị trí quét tiếp, hoặc -1 khi độ dài dữ liệu ảnh
+ * khai báo vượt quá dữ liệu (luồng byte hỏng thật).
  */
 function skipRasterImage(bytes: Uint8Array, i: number): number {
   if (i + 7 >= bytes.length) return i + 2;
@@ -81,13 +80,9 @@ function skipRasterImage(bytes: Uint8Array, i: number): number {
 }
 
 /**
- * Minimal, heuristic ESC/POS validator — net new, since portakal's `validate()`
- * never accepted "escpos" as a source language. Walks the byte stream (encoded
- * one byte per character, per `PrintValidation`'s string-source contract),
- * skipping every command it recognizes, and flags two conditions: a raster
- * image whose declared byte count overflows the buffer, and stray bytes that
- * fall outside both the printable/extended ranges and any recognized command
- * (a rough "this might not be valid ESC/POS" signal, not a full re-parse).
+ * Kiểm tra ESC/POS theo kiểu dò nhanh, không parse đầy đủ. Nguồn là chuỗi 1 ký tự = 1 byte (theo contract chuỗi của
+ * `PrintValidation`). Bỏ qua mọi lệnh nhận ra được và báo 2 trường hợp: ảnh raster khai báo dài hơn dữ liệu, và byte
+ * lạc không thuộc vùng in được lẫn lệnh nào — chỉ là dấu hiệu "có thể không phải ESC/POS hợp lệ".
  */
 export class EscPosValidator implements PrintValidation {
   validate(source: string): ValidationResult {
diff --git a/packages/printer-core/src/validation/languages/tspl/TsplValidator.ts b/packages/printer-core/src/validation/languages/tspl/TsplValidator.ts
index a8b72df..21bef2d 100644
--- a/packages/printer-core/src/validation/languages/tspl/TsplValidator.ts
+++ b/packages/printer-core/src/validation/languages/tspl/TsplValidator.ts
@@ -8,11 +8,11 @@ const MAX_DENSITY = 15;
 const MIN_SPEED = 1;
 const MAX_SPEED = 18;
 
-/** How much of an `UNKNOWN` command's raw text to surface, for the `command` field vs. the full `message`. */
+/** Số ký tự của lệnh `UNKNOWN` hiển thị ở field `command` (ngắn) so với `message` (đầy đủ hơn). */
 const UNKNOWN_COMMAND_PREVIEW_LENGTH = 20;
 const UNKNOWN_MESSAGE_PREVIEW_LENGTH = 40;
 
-/** Commands that draw something on the label — used to check `CLS` comes before the first one. */
+/** Lệnh vẽ lên tem — `CLS` phải đứng trước lệnh đầu tiên trong nhóm này. */
 const LABEL_ELEMENT_COMMANDS = new Set([
   'TEXT',
   'BLOCK',
@@ -31,11 +31,8 @@ const LABEL_ELEMENT_COMMANDS = new Set([
 ]);
 
 /**
- * Validates TSPL/TSPL2 source: command order (`SIZE` first, `CLS` before any
- * label element, `PRINT` present), `DENSITY`/`SPEED` ranges, and unrecognized
- * commands — ported from portakal's `validateTSC()` (`src/validate.ts` lines
- * 64-142), which itself re-parses the source via `parseTSPL()` to inspect
- * the same structured commands `TsplParser` produces.
+ * Kiểm tra lệnh TSPL/TSPL2: thứ tự lệnh (`SIZE` đầu tiên, `CLS` trước mọi element, có `PRINT`), khoảng giá trị
+ * `DENSITY`/`SPEED` và lệnh không nhận ra. Parse lại bằng `parseTSPL()` để kiểm tra trên cùng cấu trúc lệnh với parser.
  */
 export class TsplValidator implements PrintValidation {
   validate(source: string): ValidationResult {
~~~

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit -p packages/printer-core
npx jest packages/printer-core
npx eslint packages/printer-core/src packages/printer-preview/src
```

Expected: tsc không in gì; jest `314 passed, 314 total`; eslint `0 errors`.

- [ ] **Step 3: Stage, line-length, commit**

```bash
git add \
  packages/printer-core/src/encoding/CodePage.ts \
  packages/printer-core/src/encoding/CodePageEncoder.ts \
  packages/printer-core/src/encoding/EncodingResult.ts \
  packages/printer-core/src/encoding/encoders/Cp437Encoder.ts \
  packages/printer-core/src/encoding/encoders/Cp857Encoder.ts \
  packages/printer-core/src/encoding/encoders/Cp858Encoder.ts \
  packages/printer-core/src/encoding/encoders/Cp866Encoder.ts \
  packages/printer-core/src/encoding/encoders/Utf8Encoder.ts \
  packages/printer-core/src/encoding/encoders/Windows1252Encoder.ts \
  packages/printer-core/src/encoding/encoders/Windows1258Encoder.ts \
  packages/printer-core/src/formatting/validateTableColumns.ts \
  packages/printer-core/src/image/ImageCrop.ts \
  packages/printer-core/src/image/ImageDither.ts \
  packages/printer-core/src/image/ImageResize.ts \
  packages/printer-core/src/image/ImageSource.ts \
  packages/printer-core/src/image/ImageThreshold.ts \
  packages/printer-core/src/image/ImageTransform.ts \
  packages/printer-core/src/image/MonochromeBitmap.ts \
  packages/printer-core/src/image/RgbaImage.ts \
  packages/printer-core/src/image/dithering/AtkinsonDither.ts \
  packages/printer-core/src/image/dithering/DitherAlgorithm.ts \
  packages/printer-core/src/image/dithering/FloydSteinbergDither.ts \
  packages/printer-core/src/image/dithering/OrderedDither.ts \
  packages/printer-core/src/image/dithering/ThresholdDither.ts \
  packages/printer-core/src/symbology/barcode/BarcodeType.ts \
  packages/printer-core/src/symbology/barcode/BarcodeValidator.ts \
  packages/printer-core/src/symbology/qrcode/QrCodeErrorCorrection.ts \
  packages/printer-core/src/symbology/qrcode/QrCodeModel.ts \
  packages/printer-core/src/symbology/qrcode/QrCodeValidator.ts \
  packages/printer-core/src/types/Direction.ts \
  packages/printer-core/src/validation/ValidationIssue.ts \
  packages/printer-core/src/validation/ValidationResult.ts \
  packages/printer-core/src/validation/languages/escpos/EscPosValidator.ts \
  packages/printer-core/src/validation/languages/tspl/TsplValidator.ts
git diff --cached -U0 -- '*.ts' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let f,bad=0;for(const l of s.split(/\r?\n/)){if(l.startsWith('+++ '))f=l.slice(6);else if(l.startsWith('+')&&l.length-1>120){bad++;console.log(f+' '+(l.length-1))}}process.exit(bad?1:0)})"
git commit -m "docs: rewrite printer-core comments in Vietnamese" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log -1 --format=%B
git status --short
```

Expected: line-length không in gì; commit thành công đúng 2 dòng message; `git status` chỉ còn `?? .claude/worktrees/`.


---

### Kiểm tra cuối (sau Task 4)

- [ ] **Không còn tham chiếu tới phần đã xoá**

```bash
git grep -n -E "\b(zpl|epl|cpcl|dpl|sbpl|starprnt|ipl|Zpl|Epl|Cpcl|Dpl|Sbpl|StarPrnt|Ipl)\b" -- packages/printer-core/src packages/printer-preview/src ':!*CompileWarnings.test.ts'
git grep -n -E "\b(PrintDocument|ReceiptLayout|PrintDataAssertion|HexDump|parseTsplSummary|encodeTcvn3)\b|portakal" -- packages/printer-core packages/printer-preview/src ':!*__tests__*'
```

Expected: cả 2 lệnh không in gì. `CompileWarnings.test.ts` chỉ dùng tên ngôn ngữ làm chuỗi hiển thị; tên test và comment trong test giữ nguyên nên lệnh thứ 2 bỏ qua `__tests__`.
