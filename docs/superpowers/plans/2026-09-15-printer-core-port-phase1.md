# printer-core Port — Phase 1 (foundation + ESC/POS + TSC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the `packages/printer-core` placeholder scaffold with real logic ported from the open-source `portakal` package (checked out read-only at `C:\NDTCORE\NDTCore\portakal\src\`), covering the foundation (types/document/core dispatch) plus a complete, working ESC/POS and TSC (TSPL) compile→parse→validate→preview pipeline. The remaining 7 printer languages, `convert/`, most of `profile/`, `transport/`, and `testing/` are explicitly out of scope — a separate Phase 2 plan.

**Architecture:** `printer-core` is a framework-agnostic TypeScript package (no React Native import anywhere) inside an npm workspace (`packages/printer-core`, already wired into the app's root `package.json` `workspaces` field). It does not touch `src/features/printer` — this plan only makes `printer-core` itself real and independently tested; wiring the app to consume it is future work.

**Tech Stack:** TypeScript (strict, no `any`), Jest (via the repo's existing root Jest config — no separate config needed), `tsc --noEmit` for type-check, ESLint via the repo's root config.

**Spec:** `docs/superpowers/specs/2026-09-15-printer-core-portakal-mapping.md` — the file-by-file source-to-destination mapping this plan argues from. **Every task below cites exact rows/sections of that spec plus exact `portakal/src/*.ts` file+line ranges — read both before starting a task.** Portakal source is read-only reference; never edit anything under `C:\NDTCORE\NDTCore\portakal\`.

## Global Constraints

- **Framework-agnostic:** no `react-native` import, no RN global, anywhere in `packages/printer-core/src/`.
- **TypeScript strict, no `any`** — even where the portakal source being ported uses `any` (flagged explicitly per-task where it occurs), replace with a real type.
- **No path aliases** — relative imports only (`./X`, `../Y`), matching repo convention.
- **Comments only when WHY isn't obvious** — do not port portakal's own comments verbatim as narration; keep only comments that explain a non-obvious constraint or workaround.
- **Tests:** Jest, in `__tests__/` sibling folders next to the file under test (e.g. `src/encoding/__tests__/CodePageEncoder.test.ts`), matching repo convention. Run via `npm test` from the repo root (`NDTCore.App/`) — `packages/printer-core` has no separate Jest config; the root config's `roots` already covers the whole repo.
- **Type-check:** `npm run type-check -w printer-core` (package-scoped) AND `npm run type-check` (whole-repo, from repo root) must both stay clean after every task.
- **Lint:** `npm run lint` (from repo root) must stay clean after every task.
- **Do not modify `src/features/printer/` or any file outside `packages/printer-core/`** (except the specific whole-repo `index.ts` barrel files inside `packages/printer-core/src/` that already exist as `export * from './X'` — those never need editing since they re-export whatever their target file ends up exporting).
- **Barrels already exist** for every folder in scope (`export * from './File'` per sibling file, `export * from './subdir'` per subdirectory) — do not delete or rewrite them unless a task explicitly says to add a new named export line (e.g., a merged constant that isn't a 1:1 file re-export).
- **Fix two known portakal bugs during port, do not copy them as-is** (both are called out again in their task below): (1) `compileToESCPOS()` never actually applies code-page/text encoding — it always writes raw UTF-8 bytes; (2) `compileToTSC()`'s image case emits a `BITMAP` header with no pixel payload appended.
- **Placeholder convention:** every currently-untouched file in the skeleton contains exactly `// Placeholder — populated when migrating logic from src/features/printer (see docs/superpowers).\nexport {};\n`. A task only edits files listed in its own **Files** section — leave every other placeholder untouched.

---

### Task 1: Foundational types, document model, and core dispatch contracts

**Files:**
- Modify (fill in): `packages/printer-core/src/types/Unit.ts`, `Rotation.ts`, `Alignment.ts`, `Direction.ts`, `Bitmap.ts`, `Point.ts`, `Size.ts`, `Rect.ts`, `FontWeight.ts`, `FontStyle.ts`
- Modify (fill in): `packages/printer-core/src/document/PrintDocument.ts`, `PrintDocumentOptions.ts`, `PrintElement.ts`, `PrintElementType.ts`, `ResolvedPrintDocument.ts`
- Modify (fill in): `packages/printer-core/src/core/PrinterLanguage.ts`, `PrintCompiler.ts`, `PrintParser.ts`, `PrintPreview.ts`, `PrintValidation.ts`
- Test: `packages/printer-core/src/types/__tests__/Bitmap.test.ts`, `packages/printer-core/src/document/__tests__/PrintDocument.test.ts`

**Interfaces:**
- Consumes: nothing (this is the foundation task).
- Produces (exact names every later task in this plan imports):
  - `types`: `type Unit = "mm" | "inch" | "dot"`; `type Rotation = 0 | 90 | 180 | 270`; `type Alignment = "left" | "center" | "right"`; `type Direction = 0 | 1`; `interface Bitmap { data: Uint8Array; width: number; height: number; bytesPerRow: number }`; `interface Point { x?: number; y?: number }`; `interface Size { width?: number; height?: number }`; `interface Rect extends Point, Size {}`; `type FontWeight = "normal" | "bold"`; `type FontStyle = "normal" | "italic"`.
  - `document`: `interface PrintDocumentOptions { unit?: Unit; dpi?: number; gap?: number; speed?: number; density?: number; direction?: Direction; copies?: number; printer?: string }`; `interface PrintDocument extends PrintDocumentOptions { width: number; height?: number }`; `type PrintElementType = "text" | "image" | "box" | "line" | "circle" | "ellipse" | "reverse" | "erase" | "raw" | "barcode" | "qrcode"`; `type PrintElement` — discriminated union, one variant per `PrintElementType`, matching portakal's `LabelElement` variants **plus** two new variants `{ type: "barcode"; options: unknown }` and `{ type: "qrcode"; options: unknown }` (typed `unknown` for now — Task 4 replaces `unknown` with the real `BarcodeConfig`/`QrCodeConfig` types by editing this same file); `interface ResolvedPrintDocument { widthDots: number; heightDots: number; dpi: number; gapDots: number; speed: number; density: number; direction: Direction; copies: number; elements: PrintElement[] }`.
  - `core`: `type PrinterLanguage = "tsc" | "zpl" | "epl" | "cpcl" | "dpl" | "sbpl" | "escpos" | "starprnt" | "ipl"`; `interface PrintCompiler<TOutput = string | Uint8Array> { compile(document: ResolvedPrintDocument): TOutput }`; `interface PrintParser<TResult> { parse(source: string | Uint8Array): TResult }`; `interface PrintPreview { preview(document: ResolvedPrintDocument): string }`; `interface PrintValidation { validate(source: string): { valid: boolean; errors: number; warnings: number; issues: Array<{ level: "error" | "warning" | "info"; message: string }> } }`.

**Steps:**

- [ ] **Step 1: Read the spec's `types/`, `document/`, and `core/` tables** (`docs/superpowers/specs/2026-09-15-printer-core-portakal-mapping.md`) and the cited portakal source: `portakal/src/types.ts` lines 1-35 (Unit/Rotation/Alignment/LabelConfig), 126-135 (MonochromeBitmap), 163-194 (LabelElement/ResolvedLabel); `portakal/src/profiles.ts` lines 6-15 (PrinterLanguage).

- [ ] **Step 2: Implement `types/*.ts`.** `Point.ts`/`Size.ts`/`Rect.ts`/`FontWeight.ts`/`FontStyle.ts` are net-new (no portakal source) — use the shapes given in Interfaces above. `Unit.ts`/`Rotation.ts`/`Alignment.ts` are direct ports of the corresponding portakal type aliases. `Direction.ts` is `export type Direction = 0 | 1;` (adapted from `LabelConfig.direction`, not a general compass enum — see spec note). `Bitmap.ts` ports `MonochromeBitmap` under the new name `Bitmap`.

- [ ] **Step 3: Write the failing test for `Bitmap`** (`src/types/__tests__/Bitmap.test.ts`):

```typescript
import type { Bitmap } from '../Bitmap';

describe('Bitmap', () => {
  it('describes a 1-bit packed row-major bitmap', () => {
    const bitmap: Bitmap = { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 };
    expect(bitmap.bytesPerRow).toBe(Math.ceil(bitmap.width / 8));
  });
});
```

Run: `npm test -- src/types/__tests__/Bitmap.test.ts` (from `packages/printer-core`, or `npm test -- packages/printer-core/src/types/__tests__/Bitmap.test.ts` from repo root). Expected: FAIL (`Bitmap.ts` still empty) until Step 2 is done, then PASS.

- [ ] **Step 4: Implement `document/*.ts`** per the Produces shapes above, porting field defaults/shape from `portakal/src/types.ts` lines 14-35 (`LabelConfig` → split into `PrintDocument`/`PrintDocumentOptions`) and 163-194 (`LabelElement`/`ResolvedLabel` → `PrintElement`/`ResolvedPrintDocument`, adding the `barcode`/`qrcode` variants now so the union never needs re-touching later).

- [ ] **Step 5: Write the failing test for `PrintDocument`** (`src/document/__tests__/PrintDocument.test.ts`):

```typescript
import type { PrintDocument, PrintElement, ResolvedPrintDocument } from '../index';

describe('PrintDocument element union', () => {
  it('accepts a barcode element alongside portakal-native element types', () => {
    const elements: PrintElement[] = [
      { type: 'text', content: 'hi', options: {} },
      { type: 'barcode', options: {} as never },
    ];
    expect(elements).toHaveLength(2);
  });

  it('describes a resolved document with dot-based measurements', () => {
    const resolved: ResolvedPrintDocument = {
      widthDots: 320, heightDots: 0, dpi: 203, gapDots: 24,
      speed: 4, density: 8, direction: 0, copies: 1, elements: [],
    };
    expect(resolved.widthDots).toBeGreaterThan(0);
  });
});
```

Run and verify FAIL then PASS the same way as Step 3.

- [ ] **Step 6: Implement `core/*.ts`** — these are interface-only files (no runtime logic), formalizing the duck-typed contract every `portakal/src/lang/*.ts` module implements implicitly (see spec's `core/` table for exact line pointers per file). No test needed for pure type-only files with no runtime behavior — skip Jest here, rely on `tsc --noEmit` to catch shape errors in later tasks that implement these interfaces.

- [ ] **Step 7: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root).
Expected: PASS, 0 errors.

- [ ] **Step 8: Commit**

```bash
git add packages/printer-core/src/types packages/printer-core/src/document packages/printer-core/src/core
git commit -m "feat: port printer-core foundational types, document model, and core dispatch contracts"
```

---

### Task 2: Encoding (code pages + Vietnamese encoders)

**Files:**
- Modify (fill in): `packages/printer-core/src/encoding/CodePage.ts`, `CodePageEncoder.ts`, `EncodingResult.ts`
- Modify (fill in): `packages/printer-core/src/encoding/encoders/Cp437Encoder.ts`, `Cp858Encoder.ts`, `Windows1252Encoder.ts`, `Cp866Encoder.ts`, `Cp857Encoder.ts`, `Utf8Encoder.ts`, `Windows1258Encoder.ts`, `Tcvn3Encoder.ts`
- Test: `packages/printer-core/src/encoding/__tests__/CodePageEncoder.test.ts`, `packages/printer-core/src/encoding/encoders/__tests__/Tcvn3Encoder.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (this subsystem is self-contained, matching portakal's `encoding.ts` which has no dependency on `types.ts`).
- Produces: `interface CodePage { id: number; name: string; chars: Record<number, string> }` (byte value → Unicode char for bytes ≥ 0x80); `interface EncodingResult { bytes: Uint8Array; codePage: CodePage | null; unmappedChars: string[] }` (renamed from portakal's `EncodedSegment`); `function encodeText(text: string, preferredCodePage?: number): EncodingResult`; `function encodeTextForPrinter(text: string, profile: { features: { nativeUtf8: boolean; codePages: number[] } }): EncodingResult`; `function isASCII(text: string): boolean`; `function findCodePage(id: number): CodePage | undefined`; `const CODE_PAGES: Record<number, CodePage>`.

**Steps:**

- [ ] **Step 1: Read spec's `encoding/` table and `portakal/src/encoding.ts` in full** (243 lines — `CodePage`/`EncodedSegment` interfaces lines 10-25, `CP437_CHARS` 39-74, `CP858_CHARS` 77-80, `CP1252_CHARS` 83-113, `CP866_CHARS` 116-131, `CP857_CHARS` 134-142, `CODE_PAGES` registry ~146, `findCodePage()` 154-162, `encodeText()` 170-216, `encodeTextForPrinter()` 222-243, `isASCII()` 246-254).

- [ ] **Step 2: Port the 5 real code-page tables**, one file each, following this exact pattern (worked example for CP437 — the other 4 use the same shape, populated from the portakal line ranges above):

```typescript
// encoding/encoders/Cp437Encoder.ts
import type { CodePage } from '../CodePage';

export const CP437: CodePage = {
  id: 437,
  name: 'CP437',
  chars: {
    // copy the byte→char map verbatim from portakal/src/encoding.ts lines 39-74
  },
};
```

Repeat for `Cp858Encoder.ts` (id 858, `CP858_CHARS` — note portakal builds this by spreading CP437 plus a Euro-sign override, per spec line "CP437 + Euro" — port that same derivation, don't hand-copy a duplicate table), `Windows1252Encoder.ts` (id 1252, named `Windows1252` not `CP1252`), `Cp866Encoder.ts` (id 866), `Cp857Encoder.ts` (id 857).

- [ ] **Step 3: Implement `Utf8Encoder.ts` and `Windows1258Encoder.ts` (net-new).** `Utf8Encoder.ts`: `export function encodeUtf8Passthrough(text: string): Uint8Array { return new TextEncoder().encode(text); }` — this is the ASCII/UTF-8-native passthrough path portakal inlines directly in `encodeText()` (lines 186-195) without ever naming it as a reusable encoder; extracting it here is what lets `encodeTextForPrinter` branch on `profile.features.nativeUtf8` correctly (see Step 5 — this is the actual bug-fix, since portakal's `encodeTextForPrinter` never branches on that flag today). `Windows1258Encoder.ts` needs a real CP1258 (Windows Vietnamese) byte-value→char table for bytes 0x80-0xFF — this is a standard, publicly documented code page; populate the map for at least the printable range (0x80-0xFF) using the official CP1258 mapping (do not invent values).

- [ ] **Step 4: Implement `Tcvn3Encoder.ts` (net-new, no portakal source).** TCVN3 is a legacy Vietnamese 8-bit encoding that remaps Latin base letters plus combining tone marks into the 0xB0-0xFF range with a distinct layout per uppercase/lowercase base letter (used by many older Vietnamese thermal printer firmwares as an alternative to Unicode). Implement as `interface Tcvn3Mapping { [unicodeChar: string]: number }` plus `function encodeTcvn3(text: string): Uint8Array` that maps each precomposed Vietnamese Unicode character (e.g. `'ố'`, `'ự'`, `'đ'`, `'Đ'`) to its single TCVN3 byte, falling back to plain ASCII passthrough for characters with no TCVN3 mapping. Use a well-known reference TCVN3↔Unicode table (the mapping is a fixed, publicly documented standard — do not guess byte values; if uncertain about a specific byte, mark it with a comment citing which reference table entry is unclear rather than inventing a value).

- [ ] **Step 5: Implement `CodePage.ts`, `EncodingResult.ts`, `CodePageEncoder.ts`.** `CodePageEncoder.ts` ports `findCodePage()`/`isASCII()` directly, and `encodeText()`/`encodeTextForPrinter()` with **one behavior fix**: `encodeTextForPrinter` must actually check `profile.features.nativeUtf8` and call `Utf8Encoder`'s passthrough when true, falling back to the code-page table lookup (via `encodeText`) only when false or unset — portakal's version (lines 222-243) accepts a `nativeUtf8` flag in its signature shape but never branches on it, which is exactly the code-page bug this plan's Global Constraints call out to fix at the ESC/POS compiler layer in Task 8; fixing it here at the shared encoder layer is the correct place, so ESC/POS's Task 8 fix becomes "call this correctly," not "reimplement the branch."

- [ ] **Step 6: Write the failing test for the Vietnamese encoder** (`src/encoding/encoders/__tests__/Tcvn3Encoder.test.ts`):

```typescript
import { encodeTcvn3 } from '../Tcvn3Encoder';

describe('encodeTcvn3', () => {
  it('maps a precomposed Vietnamese character to a single TCVN3 byte', () => {
    const bytes = encodeTcvn3('đ');
    expect(bytes).toHaveLength(1);
    expect(bytes[0]).toBeGreaterThanOrEqual(0xb0);
  });

  it('passes plain ASCII through unchanged', () => {
    const bytes = encodeTcvn3('AB');
    expect(Array.from(bytes)).toEqual([0x41, 0x42]);
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 7: Write the failing test for `encodeTextForPrinter`'s nativeUtf8 branch** (`src/encoding/__tests__/CodePageEncoder.test.ts`):

```typescript
import { encodeTextForPrinter } from '../CodePageEncoder';

describe('encodeTextForPrinter', () => {
  it('passes UTF-8 straight through for a native-UTF8 printer profile', () => {
    const result = encodeTextForPrinter('café', { features: { nativeUtf8: true, codePages: [] } });
    expect(Array.from(result.bytes)).toEqual(Array.from(new TextEncoder().encode('café')));
  });

  it('falls back to code-page lookup for a non-native-UTF8 profile', () => {
    const result = encodeTextForPrinter('cafe', { features: { nativeUtf8: false, codePages: [437] } });
    expect(result.codePage?.id).toBe(437);
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 8: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root).

- [ ] **Step 9: Commit**

```bash
git add packages/printer-core/src/encoding
git commit -m "feat: port printer-core code-page encoding + add Vietnamese TCVN3/CP1258 encoders"
```

---

### Task 3: Image processing (dithering + monochrome bitmap)

**Files:**
- Modify (fill in): `packages/printer-core/src/image/MonochromeBitmap.ts`, `RgbaImage.ts`, `ImageThreshold.ts`, `ImageDither.ts`, `ImageTransform.ts`, `ImageCrop.ts`, `ImageResize.ts`, `ImageSource.ts`
- Modify (fill in): `packages/printer-core/src/image/dithering/DitherAlgorithm.ts`, `ThresholdDither.ts`, `FloydSteinbergDither.ts`, `AtkinsonDither.ts`, `OrderedDither.ts`
- Test: `packages/printer-core/src/image/__tests__/ImageTransform.test.ts`, `packages/printer-core/src/image/dithering/__tests__/FloydSteinbergDither.test.ts`

**Interfaces:**
- Consumes: `Bitmap` from `types/Bitmap.ts` (Task 1) — `image/MonochromeBitmap.ts` re-exports it under the image-domain name used by the rest of this subsystem: `export type { Bitmap as MonochromeBitmap } from '../types/Bitmap';` plus the packing function.
- Produces: `type DitherAlgorithm = "threshold" | "floyd-steinberg" | "atkinson" | "ordered"`; `function rgbaToGrayscale(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array`; `function ditherThreshold(gray: Uint8Array, width: number, height: number, threshold?: number): Uint8Array`; `function ditherFloydSteinberg(gray: Uint8Array, width: number, height: number): Uint8Array`; `function ditherAtkinson(gray: Uint8Array, width: number, height: number): Uint8Array`; `function ditherOrdered(gray: Uint8Array, width: number, height: number): Uint8Array`; `function packBitmap(monoPixels: Uint8Array, width: number, height: number): MonochromeBitmap`; `function imageToMonochrome(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, options?: { dither?: DitherAlgorithm; threshold?: number }): MonochromeBitmap`.

**Steps:**

- [ ] **Step 1: Read spec's `image/` table and `portakal/src/image.ts` in full** (170 lines — `rgbaToGrayscale()` 4-23, `ditherThreshold()` 26-37, `ditherFloydSteinberg()` 39-70, `ditherAtkinson()` 72-102, `BAYER4` 104-110, `ditherOrdered()` 112-122, `packBitmap()` 125-141, `imageToMonochrome()` 144-170) and `portakal/src/types.ts` lines 11, 126-135 (`DitherAlgorithm`, `MonochromeBitmap`).

- [ ] **Step 2: Implement `image/dithering/*.ts`** — port each of the 4 algorithm functions and the `DitherAlgorithm` type directly from the line ranges above, one function per file (this is a pure file split — the algorithms themselves must be byte-for-byte equivalent to portakal's, not reinterpreted).

- [ ] **Step 3: Write the failing test for Floyd-Steinberg** (`src/image/dithering/__tests__/FloydSteinbergDither.test.ts`):

```typescript
import { ditherFloydSteinberg } from '../FloydSteinbergDither';

describe('ditherFloydSteinberg', () => {
  it('produces only 0 or 255 per pixel', () => {
    const gray = new Uint8Array([10, 200, 128, 60]);
    const result = ditherFloydSteinberg(gray, 2, 2);
    result.forEach((v) => expect([0, 255]).toContain(v));
  });

  it('preserves pixel count', () => {
    const gray = new Uint8Array(16).fill(128);
    expect(ditherFloydSteinberg(gray, 4, 4)).toHaveLength(16);
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 4: Implement `image/MonochromeBitmap.ts`** (re-export + `packBitmap()`, ported directly), `RgbaImage.ts` (wraps `rgbaToGrayscale()` — net-new as a named module, not a new algorithm: `export function toGrayscale(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array` calling the ported logic), `ImageThreshold.ts` (re-exports `ditherThreshold` under this file for direct-threshold callers, per spec's canonical-location note — pick `dithering/ThresholdDither.ts` as canonical implementation, `ImageThreshold.ts` re-exports it), `ImageDither.ts` (the dispatch switch from `imageToMonochrome()` lines 150-167, extracted as `function applyDither(gray: Uint8Array, width: number, height: number, algorithm: DitherAlgorithm, threshold?: number): Uint8Array`).

- [ ] **Step 5: Implement `ImageTransform.ts`** — port the `imageToMonochrome()` orchestration pipeline (grayscale → dither dispatch → pack) as the main public entry point of this subsystem.

- [ ] **Step 6: Implement `ImageCrop.ts` and `ImageResize.ts` (net-new, no portakal source — portakal never crops or resamples).** Keep these minimal and only as large as needed for a Phase-1 consumer to exist later; for this task, implement:
  - `ImageCrop.ts`: `function cropRgba(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, region: Rect): Uint8Array` — a straightforward row-copy crop using `Rect` from Task 1's `types/Rect.ts`.
  - `ImageResize.ts`: `function resizeNearestNeighbor(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, targetWidth: number, targetHeight: number): Uint8Array` — nearest-neighbor resampling (simplest correct algorithm; do not implement bilinear/bicubic — YAGNI for Phase 1's needs).
  - `ImageSource.ts`: `interface ImageSource { data: Uint8Array | Uint8ClampedArray; width: number; height: number }` — a named parameter-object type so `ImageTransform`/`ImageCrop`/`ImageResize` callers can optionally pass one object instead of 3 positional args (keep the 3-positional-arg functions as the primary API to match portakal's calling convention exactly; `ImageSource` is an additive convenience type only, not a breaking signature change).

- [ ] **Step 7: Write the failing test for the full pipeline** (`src/image/__tests__/ImageTransform.test.ts`):

```typescript
import { imageToMonochrome } from '../ImageTransform';

describe('imageToMonochrome', () => {
  it('packs a 8x1 white image into 1 all-1-bits byte per row', () => {
    const rgba = new Uint8Array(8 * 4).fill(255); // 8 white pixels, RGBA
    const bitmap = imageToMonochrome(rgba, 8, 1, { dither: 'threshold', threshold: 128 });
    expect(bitmap.width).toBe(8);
    expect(bitmap.bytesPerRow).toBe(1);
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 8: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root).

- [ ] **Step 9: Commit**

```bash
git add packages/printer-core/src/image
git commit -m "feat: port printer-core image dithering pipeline, add crop/resize"
```

---

### Task 4: Barcode + QR code (net-new descriptive/validation layer)

**Files:**
- Modify (fill in): `packages/printer-core/src/barcode/BarcodeType.ts`, `BarcodeConfig.ts`, `BarcodeValidator.ts`
- Modify (fill in): `packages/printer-core/src/qrcode/QrCodeModel.ts`, `QrCodeErrorCorrection.ts`, `QrCodeConfig.ts`, `QrCodeValidator.ts`
- Modify: `packages/printer-core/src/document/PrintElement.ts` (replace the `unknown` options type on the `barcode`/`qrcode` variants added in Task 1 with the real config types from this task)
- Modify: `packages/printer-core/src/document/__tests__/PrintDocument.test.ts` (Task 1's test — update its barcode-element example to a real `BarcodeConfig`)
- Test: `packages/printer-core/src/barcode/__tests__/BarcodeValidator.test.ts`, `packages/printer-core/src/qrcode/__tests__/QrCodeValidator.test.ts`

**Interfaces:**
- Consumes: `Rect`/`Point` shapes are NOT reused here — barcode/QR position is x/y only, matching every printer-native barcode command's own convention (no width/height at the placement level, since printer firmware computes the rendered box).
- Produces: `type BarcodeSymbology = "code39" | "code93" | "code128" | "ean8" | "ean13" | "upca" | "upce" | "itf" | "codabar"` (the symbologies both TSC `BARCODE` and ESC/POS `GS k` commands from the spec's parser notes actually reference — see Step 2); `interface BarcodeConfig { x?: number; y?: number; symbology: BarcodeSymbology; content: string; height?: number; readable?: boolean; rotation?: Rotation; narrowBarWidth?: number; wideBarWidth?: number }`; `function validateBarcodeConfig(config: BarcodeConfig): ValidationIssue[]` (returns `{level, message}[]`, empty array = valid; do not import `ValidationIssue` from `validation/` yet since that folder isn't built until Task 8/9's language-specific validators — define a minimal local `interface BarcodeValidationIssue { level: "error" | "warning"; message: string }` in `BarcodeValidator.ts` for now); `type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H"`; `interface QrCodeConfig { x?: number; y?: number; content: string; cellWidth?: number; errorCorrection?: QrErrorCorrectionLevel; rotation?: Rotation }`; `function validateQrCodeConfig(config: QrCodeConfig): BarcodeValidationIssue[]` (reuse the same issue shape, imported from `barcode/BarcodeValidator.ts`).

**Steps:**

- [ ] **Step 1: Read spec's `barcode/` and `qrcode/` tables and their "Ghi chú chung" notes**, plus the cited parser sections that document the printer-native command shapes this config layer must be able to describe: `portakal/parsers/tsc.ts` `BARCODE`/`QRCODE` command fields (search for `"BARCODE"` and `"QRCODE"` literal string matches in that file), `portakal/parsers/escpos.ts` lines 312-344 (`GS k` decode) and 390-415 (`GS ( k` decode). **Important:** portakal never computes bars or QR modules itself — it only ever emits/parses the printer's own native barcode/QR commands with a content string and layout parameters. This task builds the same kind of descriptive/validation layer, matching that pass-through model — it does **not** implement a Code128/QR bit-matrix generator.

- [ ] **Step 2: Implement `barcode/BarcodeType.ts`** — enumerate `BarcodeSymbology` using the union given in Interfaces above (derived from cross-referencing which symbology strings TSC's `BARCODE` command and ESC/POS's `GS k` command both accept — read the exact accepted values from the two parser sections cited in Step 1 rather than guessing).

- [ ] **Step 3: Implement `barcode/BarcodeConfig.ts`** per the shape above, importing `Rotation` from `types/Rotation.ts` (Task 1).

- [ ] **Step 4: Implement `barcode/BarcodeValidator.ts`** — `validateBarcodeConfig()` checks: `content` non-empty (error if empty), `height` positive when provided (error if ≤ 0), `narrowBarWidth`/`wideBarWidth` positive when provided, and a symbology-specific length check for at least `ean13` (must be 12 or 13 digits) and `ean8` (7 or 8 digits) since those are the two symbologies with a fixed, easily-verified data length — return `[]` when config is valid.

- [ ] **Step 5: Write the failing test** (`src/barcode/__tests__/BarcodeValidator.test.ts`):

```typescript
import { validateBarcodeConfig } from '../BarcodeValidator';

describe('validateBarcodeConfig', () => {
  it('flags empty content as an error', () => {
    const issues = validateBarcodeConfig({ symbology: 'code128', content: '' });
    expect(issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('flags a wrong-length EAN-13 payload', () => {
    const issues = validateBarcodeConfig({ symbology: 'ean13', content: '123' });
    expect(issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('accepts a valid code128 config', () => {
    expect(validateBarcodeConfig({ symbology: 'code128', content: 'ABC123' })).toEqual([]);
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 6: Implement `qrcode/*.ts`** the same way: `QrCodeErrorCorrection.ts` (the `QrErrorCorrectionLevel` type), `QrCodeConfig.ts` (shape above), `QrCodeModel.ts` (kept minimal for Phase 1 — a passthrough marker type `interface QrCodeModel { content: string }` since no consumer needs an actual computed QR bit-matrix yet; document this limitation with a one-line comment since it's a non-obvious scope boundary), `QrCodeValidator.ts` (`validateQrCodeConfig()` — checks `content` non-empty, and errors if `content.length` exceeds 7089 characters, the practical QR alphanumeric-mode ceiling, reusing `BarcodeValidationIssue` from `barcode/BarcodeValidator.ts`).

- [ ] **Step 7: Write the failing test** (`src/qrcode/__tests__/QrCodeValidator.test.ts`):

```typescript
import { validateQrCodeConfig } from '../QrCodeValidator';

describe('validateQrCodeConfig', () => {
  it('flags empty content as an error', () => {
    expect(validateQrCodeConfig({ content: '' }).some((i) => i.level === 'error')).toBe(true);
  });

  it('accepts a normal URL payload', () => {
    expect(validateQrCodeConfig({ content: 'https://example.com' })).toEqual([]);
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 8: Update `document/PrintElement.ts`** (from Task 1) — replace the two `options: unknown` placeholders on the `barcode`/`qrcode` variants with `options: BarcodeConfig` and `options: QrCodeConfig` respectively, importing from `../barcode` and `../qrcode`. Re-run Task 1's `document/__tests__/PrintDocument.test.ts` to confirm it still passes (the `as never` cast in that test's barcode-element example should now be removable — update the test to construct a real `BarcodeConfig` instead of `{} as never`).

- [ ] **Step 9: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root).

- [ ] **Step 10: Commit**

```bash
git add packages/printer-core/src/barcode packages/printer-core/src/qrcode packages/printer-core/src/document/PrintElement.ts packages/printer-core/src/document/__tests__/PrintDocument.test.ts
git commit -m "feat: add printer-core barcode/qrcode descriptive config + validation layer"
```

---

### Task 5: Receipt layout formatting (independent of builder/document)

**Files:**
- Modify (fill in): `packages/printer-core/src/receipt/ReceiptColumn.ts`, `ReceiptFormatter.ts`, `PairFormatter.ts`, `TableFormatter.ts`, `SeparatorFormatter.ts`, `WordWrapper.ts`
- Modify (fill in): `packages/printer-core/src/receipt/ReceiptCell.ts`, `ReceiptLayout.ts` (net-new)
- Test: `packages/printer-core/src/receipt/__tests__/PairFormatter.test.ts`, `packages/printer-core/src/receipt/__tests__/TableFormatter.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure string-formatting utilities, no dependency on the document/builder model — matches portakal's `receipt.ts`, which is entirely standalone).
- Produces: `interface ReceiptColumn { width: number; align?: "left" | "center" | "right" }`; `function formatPair(left: string, right: string, totalWidth: number): string`; `function wordWrap(text: string, width: number): string[]`; `function formatTable(columns: ReceiptColumn[], rows: string[][], totalWidth: number): string[]`; `function separator(char: string, width: number): string`; `interface ReceiptCell { value: string; column: ReceiptColumn }` (net-new); `interface ReceiptLayout { columns: ReceiptColumn[]; totalWidth: number }` (net-new, stateful grouping of the above).

**Steps:**

- [ ] **Step 1: Read spec's `receipt/` table and `portakal/src/receipt.ts` in full** (~95 lines — `Column` interface 2-7, `formatRow()` 10-34, `formatPair()` 37-42, `formatTable()` 45-47, `separator()` 50-52, `wordWrap()` 55-78, `alignText()` helper 80-95).

- [ ] **Step 2: Implement `ReceiptColumn.ts`** (port `Column` interface, renamed) and `SeparatorFormatter.ts` (port `separator()` directly).

- [ ] **Step 3: Implement `WordWrapper.ts`** (port `wordWrap()` directly, including its `alignText()`-adjacent helpers if `wordWrap()` calls them internally — check the exact call graph in the source rather than assuming).

- [ ] **Step 4: Implement `PairFormatter.ts`** (port `formatPair()` directly).

- [ ] **Step 5: Write the failing test** (`src/receipt/__tests__/PairFormatter.test.ts`):

```typescript
import { formatPair } from '../PairFormatter';

describe('formatPair', () => {
  it('right-aligns the second value with padding between', () => {
    const line = formatPair('Hamburger x2', '$25.98', 48);
    expect(line).toHaveLength(48);
    expect(line.endsWith('$25.98')).toBe(true);
    expect(line.startsWith('Hamburger x2')).toBe(true);
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 6: Implement `ReceiptFormatter.ts`** (port `formatRow()` as the shared row-rendering orchestration, plus `alignText()` if it's used by both `formatRow` and `formatTable` — put shared helpers here, imported by `TableFormatter.ts` and `PairFormatter.ts` as needed rather than duplicated).

- [ ] **Step 7: Implement `TableFormatter.ts`** (port `formatTable()` directly).

- [ ] **Step 8: Write the failing test** (`src/receipt/__tests__/TableFormatter.test.ts`):

```typescript
import { formatTable } from '../TableFormatter';

describe('formatTable', () => {
  it('renders a header + 1 data row at the given total width', () => {
    const lines = formatTable(
      [{ width: 30, align: 'left' }, { width: 5, align: 'center' }, { width: 13, align: 'right' }],
      [['Item', 'Qty', 'Price'], ['Hamburger', '2', '$25.98']],
      48,
    );
    expect(lines).toHaveLength(2);
    lines.forEach((line) => expect(line).toHaveLength(48));
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 9: Implement `ReceiptCell.ts` and `ReceiptLayout.ts` (net-new, no portakal source)** — thin, stateful wrapper types only (no new formatting logic): `ReceiptCell` pairs one string value with the `ReceiptColumn` it renders under; `ReceiptLayout` groups a `ReceiptColumn[]` with a `totalWidth` so callers building up a receipt across multiple calls don't have to keep re-passing both. Add a small helper `function layoutToRow(layout: ReceiptLayout, values: string[]): string` that calls into `formatTable`'s single-row logic (or `TableFormatter`'s row-level helper if you factored one out in Step 7) — keep this thin, do not duplicate formatting logic here.

- [ ] **Step 10: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root).

- [ ] **Step 11: Commit**

```bash
git add packages/printer-core/src/receipt
git commit -m "feat: port printer-core receipt layout formatting"
```

---

### Task 6: Printer profiles (resolver + Generic/Epson/TSC profiles; other vendors stubbed for Phase 2)

**Files:**
- Modify (fill in): `packages/printer-core/src/profile/PrinterProfile.ts`, `PrinterProfileResolver.ts`, `PrinterVendor.ts`
- Modify (fill in): `packages/printer-core/src/profile/profiles/GenericProfile.ts`, `EpsonProfiles.ts`, `TscProfiles.ts` (real data)
- Modify (fill in): `packages/printer-core/src/profile/profiles/StarProfiles.ts`, `BixolonProfiles.ts`, `CitizenProfiles.ts`, `ZebraProfiles.ts`, `SatoProfiles.ts`, `HoneywellProfiles.ts` (empty-record stubs only — real data is Phase 2)
- Modify: `packages/printer-core/src/profile/profiles/index.ts` (merge all 9 vendor records into `PRINTER_PROFILES`)
- Test: `packages/printer-core/src/profile/__tests__/PrinterProfileResolver.test.ts`

**Interfaces:**
- Consumes: `PrinterLanguage` from `core/PrinterLanguage.ts` (Task 1).
- Produces: `type PrinterVendor = "Epson" | "Star Micronics" | "Bixolon" | "Citizen" | "Generic" | "TSC" | "Zebra" | "SATO" | "Honeywell"` (net-new — portakal uses a free string here); `type CutterType = "none" | "partial" | "full"`; `type ImageMode = "raster" | "column" | "nvGraphics"`; `interface PrinterProfile { name: string; vendor: PrinterVendor; language: PrinterLanguage; paperWidth: number; dotsPerLine: number; dpi: number; charsPerLine: number; usbVendorId?: number; usbProductId?: number; features: { cutter: CutterType; cashDrawer: boolean; imageMode: ImageMode[]; cjk: boolean; nativeUtf8: boolean; codePages: number[] } }`; `function getProfile(key: string): PrinterProfile | undefined`; `function listProfiles(): PrinterProfile[]`; `function findByVendorId(vendorId: number): PrinterProfile[]`; `function findByLanguage(language: PrinterLanguage): PrinterProfile[]`; each vendor file exports `Record<string, PrinterProfile>` (e.g. `export const EPSON_PROFILES: Record<string, PrinterProfile> = {...}`); `profiles/index.ts` exports the merged `PRINTER_PROFILES: Record<string, PrinterProfile>`.

**Steps:**

- [ ] **Step 1: Read spec's `profile/` table and `portakal/src/profiles.ts` in full** (~392 lines — `PrinterProfile`/`CutterType`/`ImageMode` 17-49, `PRINTER_PROFILES` entries by vendor 52-372 per the spec's line breakdown, `getProfile()`/`listProfiles()`/`findByVendorId()`/`findByLanguage()` 375-392).

- [ ] **Step 2: Implement `PrinterProfile.ts`** (port `PrinterProfile`/`CutterType`/`ImageMode` directly, changing `vendor: string` to `vendor: PrinterVendor`) and `PrinterVendor.ts` (net-new — the 9-value union above, derived from the distinct `vendor` string values actually used across `PRINTER_PROFILES`).

- [ ] **Step 3: Implement `profiles/GenericProfile.ts`** — port the `generic-58mm`/`generic-80mm` entries verbatim (portakal lines 206-239), as `export const GENERIC_PROFILES: Record<string, PrinterProfile> = {...}`.

- [ ] **Step 4: Implement `profiles/EpsonProfiles.ts`** — port `epson-tm-t88vi`, `epson-tm-t88v`, `epson-tm-t20iii`, `epson-tm-m30ii` (portakal lines 54-125) as `EPSON_PROFILES`.

- [ ] **Step 5: Implement `profiles/TscProfiles.ts`** — port `tsc-te200`, `tsc-te310` (portakal lines 242-277) as `TSC_PROFILES`.

- [ ] **Step 6: Stub the 6 not-yet-ported vendor files** — `StarProfiles.ts`, `BixolonProfiles.ts`, `CitizenProfiles.ts`, `ZebraProfiles.ts`, `SatoProfiles.ts`, `HoneywellProfiles.ts` each become `export const {VENDOR}_PROFILES: Record<string, PrinterProfile> = {};` (an empty but correctly-typed record — **not** the usual `export {}` placeholder — so `profiles/index.ts`'s merge in Step 7 compiles today and Phase 2 only has to add real entries to these same consts, never touching the merge again).

- [ ] **Step 7: Implement `profiles/index.ts`** — replace the existing `export * from './X'` barrel with a merge that both re-exports each vendor const AND produces the combined registry:

```typescript
export * from './GenericProfile';
export * from './EpsonProfiles';
export * from './StarProfiles';
export * from './BixolonProfiles';
export * from './CitizenProfiles';
export * from './TscProfiles';
export * from './ZebraProfiles';
export * from './SatoProfiles';
export * from './HoneywellProfiles';

import { GENERIC_PROFILES } from './GenericProfile';
import { EPSON_PROFILES } from './EpsonProfiles';
import { STAR_PROFILES } from './StarProfiles';
import { BIXOLON_PROFILES } from './BixolonProfiles';
import { CITIZEN_PROFILES } from './CitizenProfiles';
import { TSC_PROFILES } from './TscProfiles';
import { ZEBRA_PROFILES } from './ZebraProfiles';
import { SATO_PROFILES } from './SatoProfiles';
import { HONEYWELL_PROFILES } from './HoneywellProfiles';
import type { PrinterProfile } from '../PrinterProfile';

export const PRINTER_PROFILES: Record<string, PrinterProfile> = {
  ...GENERIC_PROFILES, ...EPSON_PROFILES, ...STAR_PROFILES, ...BIXOLON_PROFILES,
  ...CITIZEN_PROFILES, ...TSC_PROFILES, ...ZEBRA_PROFILES, ...SATO_PROFILES, ...HONEYWELL_PROFILES,
};
```

- [ ] **Step 8: Implement `PrinterProfileResolver.ts`** — port `getProfile()`/`listProfiles()`/`findByVendorId()`/`findByLanguage()` directly (portakal lines 375-392), importing `PRINTER_PROFILES` from `./profiles`.

- [ ] **Step 9: Write the failing test** (`src/profile/__tests__/PrinterProfileResolver.test.ts`):

```typescript
import { getProfile, findByLanguage } from '../PrinterProfileResolver';

describe('PrinterProfileResolver', () => {
  it('resolves a known TSC printer key', () => {
    const profile = getProfile('tsc-te310');
    expect(profile?.language).toBe('tsc');
    expect(profile?.dpi).toBe(300);
  });

  it('returns undefined for an unknown key', () => {
    expect(getProfile('nonexistent-printer')).toBeUndefined();
  });

  it('finds all escpos-language profiles', () => {
    const profiles = findByLanguage('escpos');
    expect(profiles.length).toBeGreaterThan(0);
    profiles.forEach((p) => expect(p.language).toBe('escpos'));
  });
});
```

Run and verify FAIL then PASS — cross-check the `tsc-te310` DPI value (300) against the exact portakal source line before asserting it, don't guess.

- [ ] **Step 10: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root).

- [ ] **Step 11: Commit**

```bash
git add packages/printer-core/src/profile
git commit -m "feat: port printer-core profile resolver + Generic/Epson/TSC profiles"
```

---

### Task 7: Builder (fluent label API) + markup DSL

**Files:**
- Modify (fill in): `packages/printer-core/src/builder/PrintBuilder.ts`, `LabelBuilder.ts`, `ReceiptBuilder.ts`
- Modify (fill in): `packages/printer-core/src/builder/content/TextElement.ts`, `ImageElement.ts`, `RawElement.ts`, `BarcodeElement.ts`, `QrCodeElement.ts`
- Modify (fill in): `packages/printer-core/src/builder/drawing/BoxElement.ts`, `LineElement.ts`, `CircleElement.ts`, `EllipseElement.ts`, `ReverseElement.ts`, `EraseElement.ts`, `DiagonalElement.ts`
- Modify (fill in): `packages/printer-core/src/builder/layout/RowElement.ts`, `ColumnElement.ts`, `SpacerElement.ts`, `TableElement.ts`, `PageBreakElement.ts`
- Modify (fill in): `packages/printer-core/src/builder/printer/CutElement.ts`
- Modify (fill in): `packages/printer-core/src/markup/MarkupParser.ts`, `MarkupBuilder.ts`
- Test: `packages/printer-core/src/builder/__tests__/LabelBuilder.test.ts`, `packages/printer-core/src/markup/__tests__/MarkupBuilder.test.ts`

**Interfaces:**
- Consumes: `PrintDocumentOptions`/`PrintElement`/`ResolvedPrintDocument`/`Direction` (Task 1), `BarcodeConfig`/`QrCodeConfig` (Task 4), `getProfile` (Task 6).
- Produces: `abstract class PrintBuilder { protected readonly elements: PrintElement[]; text(content: string, options?: TextOptions): this; image(bitmap: Bitmap, options?: ImageOptions): this; box(options: BoxOptions): this; line(options: LineOptions): this; circle(options: CircleOptions): this; ellipse(options: EllipseOptions): this; reverse(options: ReverseOptions): this; erase(options: EraseOptions): this; raw(content: string | Uint8Array): this; barcode(config: BarcodeConfig): this; qrcode(config: QrCodeConfig): this }` (chain-returns-`this`, matching every portakal `LabelBuilder` method); `class LabelBuilder extends PrintBuilder { constructor(config: PrintDocument); resolve(): ResolvedPrintDocument }`; `class ReceiptBuilder extends PrintBuilder { constructor(config: Omit<PrintDocument, "height">); resolve(): ResolvedPrintDocument }` (receipt documents never have a fixed `height` — continuous paper); `function label(config: PrintDocument): LabelBuilder`; `function receipt(config: Omit<PrintDocument, "height">): ReceiptBuilder`; `function markup(source: string): LabelBuilder`.

**Steps:**

- [ ] **Step 1: Read spec's `builder/` and `markup/` tables and `portakal/src/builder.ts` + `portakal/src/markup.ts` in full** (both already read in full earlier this session — 107 and 210 lines respectively; re-read now if starting this task fresh). Also read the per-element `*Options` interfaces in `portakal/src/types.ts` lines 38-160 (TextOptions 38-65, ImageOptions 67-81, BoxOptions 84-97, LineOptions 100-111, CircleOptions 114-123, EllipseOptions 138-144 — note the gap 124-137 is unrelated content, check exact boundaries when reading — ReverseOptions 147-152, EraseOptions 155-160).

- [ ] **Step 2: Implement the 5 `*Options` content/drawing types** inline in their own element files per the spec's split (`content/TextElement.ts` exports `TextOptions`, `content/ImageElement.ts` exports `ImageOptions`, etc. — port each `*Options` interface directly under the same name portakal uses).

- [ ] **Step 3: Implement `builder/PrintBuilder.ts`** — the abstract base class per the Produces shape above. This is a genuine **restructuring**, not a direct port: portakal has one concrete `LabelBuilder` with all 9 chain methods (`.text/.image/.box/.line/.circle/.ellipse/.reverse/.erase/.raw`) plus the profile-defaulting logic in its constructor; this task extracts just the chain-method behavior (push an element, return `this`) into the abstract base, and adds `.barcode()`/`.qrcode()` as 2 new chain methods pushing the Task-4 `PrintElement` variants — these 2 methods have no portakal equivalent, so write them following the exact same one-line pattern as the other 7 (`this.elements.push({ type: 'barcode', options }); return this;`).

- [ ] **Step 4: Implement `builder/content/*.ts`, `drawing/*.ts` (except `DiagonalElement.ts`), `layout/TableElement.ts`, `printer/CutElement.ts`** — each of these files' job in this task is just to hold that element's `*Options` interface (Step 2) next to a short doc comment describing the element, since the actual element-pushing method lives on `PrintBuilder`/`LabelBuilder`, not per-element files (matching how portakal keeps this compact in one class — don't invent a per-element class hierarchy that doesn't exist in the source). `TableElement.ts`'s options type is adapted loosely from `receipt.ts`'s `Column`/`formatTable()` shape per the spec note — do not port `formatTable()` itself here (it already lives in `receipt/TableFormatter.ts` from Task 5); this file only defines what a table *element* (as opposed to a receipt-formatting call) looks like for a document that wants to place a table as a positioned element: `interface TableOptions extends Point { columns: ReceiptColumn[]; rows: string[][] }`, importing `ReceiptColumn` from `../../receipt`. `CutElement.ts` defines `interface CutOptions { rows?: number; mode?: "off" | "partial" | "full" }` — informed by the two byte-sequence references in the spec (`starprnt.ts` `ESC d 1`, `escpos.ts`'s `GS V m [n]` decode) but only as a description of the concept; no byte-emission logic lives here (that's Task 8's `EscPosCommand.ts`/`EscPosCompiler.ts` job).

- [ ] **Step 5: Implement `builder/drawing/DiagonalElement.ts` (adapted, not net-new)** — per the spec, a diagonal line has no dedicated portakal element; it's just a `LineElement` where `x1 !== x2 && y1 !== y2`. Implement `function isDiagonal(line: LineOptions & { x1: number; y1: number; x2: number; y2: number }): boolean { return line.x1 !== line.x2 && line.y1 !== line.y2; }` as a small predicate other tasks (Task 8/9's ZPL/TSC-family compilers, if ever built) can use to decide whether a line needs the diagonal-specific command variant — no new element type or builder method, since `.line()` already covers this case per portakal's own model.

- [ ] **Step 6: Implement `builder/layout/RowElement.ts`, `ColumnElement.ts`, `SpacerElement.ts`, `PageBreakElement.ts` (net-new, no portakal source).** Keep minimal, matching the pattern of every other element file (an `*Options` interface only, no rendering logic — rendering/layout resolution is a compiler-time concern, out of scope for the builder): `RowOptions`/`ColumnOptions extends Point { gap?: number }`, `SpacerOptions { size: number; unit?: Unit }`, `PageBreakOptions {}` (empty marker options — a page break carries no configuration, just a position in the element list).

- [ ] **Step 7: Implement `builder/LabelBuilder.ts`** — port the full class from `portakal/src/builder.ts` lines 19-106, extending the new `PrintBuilder` base instead of standing alone: constructor takes `PrintDocument` (Task 1's renamed `LabelConfig`), applies the exact same profile-defaulting logic (lines 24-34: if `config.printer` is set, look up via `getProfile` from Task 6 and fall back `width`/`dpi`/`unit`), throws `InvalidConfigError` when width is missing/non-positive (define this error class here — see Step 9), and `resolve()` ports lines 86-101 exactly (unit/dpi/gap/speed/density/direction/copies defaults, converting via a `toDots()` helper — port that helper too, from `portakal/src/utils.ts`, into a private function in this file since it's a one-liner unit converter with no other callers in Phase 1 scope).

- [ ] **Step 8: Write the failing test** (`src/builder/__tests__/LabelBuilder.test.ts`):

```typescript
import { LabelBuilder } from '../LabelBuilder';

describe('LabelBuilder', () => {
  it('chains element calls and resolves dot measurements', () => {
    const doc = new LabelBuilder({ width: 40, height: 30, unit: 'mm', dpi: 203 })
      .text('Hello', { x: 10, y: 10 })
      .box({ x: 0, y: 0, width: 100, height: 50 })
      .resolve();
    expect(doc.elements).toHaveLength(2);
    expect(doc.widthDots).toBeGreaterThan(0);
  });

  it('defaults width/dpi from a known printer profile', () => {
    const doc = new LabelBuilder({ printer: 'tsc-te310' } as never).resolve();
    expect(doc.dpi).toBe(300);
  });

  it('throws when width is missing and no profile is given', () => {
    expect(() => new LabelBuilder({} as never)).toThrow();
  });
});
```

Run and verify FAIL then PASS. (The `as never` casts sidestep `PrintDocument.width` being required by the type while portakal's runtime behavior legitimately allows omitting it when `printer` supplies a profile default — if this feels wrong once you're implementing, it's fine to instead make `width` optional on `PrintDocument` and enforce the runtime check only in the constructor, matching portakal's actual `LabelConfig.width: number` — **exact:** check whether portakal's `LabelConfig.width` is required or optional at `types.ts` line ~15 before deciding, don't guess.)

- [ ] **Step 9: Implement the `InvalidConfigError` this task needs.** Check whether an `errors/` destination folder exists in the skeleton — it does not (the skeleton has no `errors/` top-level folder, unlike portakal's `src/errors.ts`). For Phase 1, define `InvalidConfigError` as a small exported class directly in `builder/LabelBuilder.ts` (`export class InvalidConfigError extends Error {}`) rather than inventing a new top-level folder not in the approved skeleton — flag this in your task report as a Phase 2 candidate (a proper `errors/` folder mirroring portakal's `errors.ts`, which likely has more than just this one error class) rather than deciding it unilaterally now.

- [ ] **Step 10: Implement `builder/ReceiptBuilder.ts` (net-new class, adapted from receipt-mode usage patterns).** Same `PrintBuilder` base, but its config omits `height` (continuous paper) and its `resolve()` skips the `heightDots` calculation (always `0`) — otherwise identical to `LabelBuilder.resolve()`. Do not duplicate the whole method; either have `ReceiptBuilder` compose a `LabelBuilder` internally and delegate, or factor the shared resolve logic into a protected method on `PrintBuilder` that both subclasses call — your choice, but no copy-pasted resolve logic between the two files.

- [ ] **Step 11: Implement `builder/index.ts` additions.** The barrel already does `export * from './PrintBuilder'` etc. — but also add named `label()`/`receipt()` factory functions (matching portakal's top-level `label()` function) directly in `LabelBuilder.ts`/`ReceiptBuilder.ts` respectively (`export function label(config: PrintDocument) { return new LabelBuilder(config); }`), which the existing barrel `export *` already picks up — no barrel edit needed.

- [ ] **Step 12: Implement `markup/MarkupParser.ts`** — port `ParsedTag`/`parseUnitValue()`/`parseTag()`/`parseAttrs()`/`getUnit()` directly from `portakal/src/markup.ts` lines 19-71.

- [ ] **Step 13: Implement `markup/MarkupBuilder.ts`** — port the `markup()` function (lines 76-210), calling `label()` from `../builder` and `MarkupParser`'s helpers. **Fix the 2 `any` usages** (source lines 88 and 124, per Global Constraints — no `any` anywhere in this package): line 88's `config: any` should be typed `Partial<PrintDocument>` (built up field-by-field exactly as the source does, just with a real type annotation); line 124's `rotation: attrs.rotation ? (Number(attrs.rotation) as any) : undefined` should cast through `Rotation` instead (`as Rotation`) — a real, narrower type-assertion is acceptable here since the runtime value is genuinely validated to be one of the 4 allowed numbers by the calling convention of the markup format, but note this with a one-line comment since the assertion isn't statically checked.

- [ ] **Step 14: Write the failing test** (`src/markup/__tests__/MarkupBuilder.test.ts`):

```typescript
import { markup } from '../MarkupBuilder';

describe('markup', () => {
  it('parses a <label> root with a <text> child into a resolved document', () => {
    const doc = markup(`
      <label width="40mm" height="30mm">
        <text x="10" y="10" size="2" bold>Hello World</text>
      </label>
    `).resolve();
    expect(doc.elements).toHaveLength(1);
    expect(doc.elements[0]).toMatchObject({ type: 'text', content: 'Hello World' });
  });

  it('throws when there is no <label> root element', () => {
    expect(() => markup('<text>oops</text>')).toThrow();
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 15: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root).

- [ ] **Step 16: Commit**

```bash
git add packages/printer-core/src/builder packages/printer-core/src/markup
git commit -m "feat: port printer-core fluent label builder + markup DSL"
```

---

### Task 8: ESC/POS — compiler, parser, validator, preview

**Files:**
- Modify (fill in): `packages/printer-core/src/compiler/escpos/EscPosCommand.ts`, `EscPosCompiler.ts`, `EscPosCodePage.ts`, `EscPosImageEncoder.ts`, `EscPosBarcodeEncoder.ts`, `EscPosQrCodeEncoder.ts`
- Modify (fill in): `packages/printer-core/src/parser/escpos/EscPosParser.ts`
- Modify (fill in): `packages/printer-core/src/validation/escpos/EscPosValidator.ts`
- Modify (fill in): `packages/printer-core/src/preview/languages/EscPosPreviewRenderer.ts`
- Test: `packages/printer-core/src/compiler/escpos/__tests__/EscPosCompiler.test.ts`, `packages/printer-core/src/parser/escpos/__tests__/EscPosParser.test.ts`

**Interfaces:**
- Consumes: `ResolvedPrintDocument`/`PrintElement` (Task 1), `CodePageEncoder`/`encodeTextForPrinter` (Task 2), `MonochromeBitmap`/`Bitmap` (Task 3), `BarcodeConfig`/`QrCodeConfig` (Task 4), `PrinterProfile` (Task 6), `PrintCompiler`/`PrintParser`/`PrintValidation`/`PrintPreview` (Task 1's `core/`).
- Produces: `class EscPosCompiler implements PrintCompiler<Uint8Array> { compile(document: ResolvedPrintDocument, profile?: PrinterProfile): Uint8Array }`; `class EscPosParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> { parse(bytes: Uint8Array): { commands: unknown[]; warnings: string[] } }`; `class EscPosValidator implements PrintValidation { validate(source: string): ValidationResult }` (net-new — no portakal source, see Step 5); `class EscPosPreviewRenderer implements PrintPreview { preview(document: ResolvedPrintDocument): string }`.

**Steps:**

- [ ] **Step 1: Read spec's `compiler/` (escpos section), `parser/`, `validation/`, `preview/` tables and the cited portakal sources in full:** `portakal/src/languages/escpos.ts` (whole file), `portakal/parsers/escpos.ts` (whole file, 532 lines, binary state machine), `portakal/src/lang/escpos.ts` (whole file — `renderReceiptSVG()` lines 17-45).

- [ ] **Step 2: Implement `EscPosCommand.ts`** — extract the `ESC`/`GS`/`LF` byte constants (source lines 3-5) plus every other inline command byte used in `compileElement()` (align `ESC,0x61`; bold `ESC,0x45`; size `GS,0x21`; reverse `GS,0x42`; raster image `GS,0x76,0x30`; text `GS v 0` — read the exact byte values from the source, do not guess) as named exported constants, e.g. `export const ESC_POS = { ESC: 0x1b, GS: 0x1d, LF: 0x0a, ALIGN: 0x61, BOLD: 0x45, SIZE: 0x21, REVERSE: 0x42, RASTER_IMAGE: [0x76, 0x30] } as const;`.

- [ ] **Step 3: Implement `EscPosCodePage.ts`** — thin re-export/adapter around Task 2's `encoding/CodePageEncoder.ts` scoped to what ESC/POS needs: `function encodeEscPosText(text: string, profile?: PrinterProfile): Uint8Array` calling `encodeTextForPrinter(text, profile ?? DEFAULT_PROFILE)`. **Exact shape (matches Task 2's `encodeTextForPrinter(text, profile: { features: { nativeUtf8: boolean; codePages: number[] } })` signature — the fields are nested under `features`, not flat):**

```typescript
const DEFAULT_PROFILE = { features: { nativeUtf8: false, codePages: [437] } };
```

A real `PrinterProfile` (Task 6) satisfies this structurally since it also nests `nativeUtf8`/`codePages` under `features` — only the fallback constant needs to match this nested shape explicitly.

- [ ] **Step 4: Implement `EscPosCompiler.ts` — with the code-page bug fix.** Port `compileToESCPOS()` (source lines 113-124) and its text/raw case handling (46-79, 103-109) directly, **except**: everywhere the source calls `ByteBuffer.writeText()` (source line 29, `new TextEncoder().encode(text)` — raw UTF-8, no code-page awareness), call `encodeEscPosText()` from Step 3 instead. This is the Global Constraints bug-fix requirement — verify with a test (Step 8) that non-ASCII text run through a non-`nativeUtf8` profile produces different bytes than naive UTF-8 encoding would. Case box/line/circle/ellipse/reverse/erase remain no-ops exactly as portakal has them (source lines 95-101) — ESC/POS has no native vector-drawing command, and upgrading this to render-to-image is explicitly out of scope for Phase 1 (note it as a Phase 2/3 candidate in your task report, do not implement it now). Case "barcode"/"qrcode" call into `EscPosBarcodeEncoder.ts`/`EscPosQrCodeEncoder.ts` (Steps 6-7) instead of being unhandled.

- [ ] **Step 5: Implement `EscPosImageEncoder.ts`** — port the "image" case (source lines 81-93) directly; this path works correctly in portakal already (`GS v 0` raster format) — verify it's a straight, unmodified port.

- [ ] **Step 6: Implement `EscPosBarcodeEncoder.ts` (net-new — no direct source, only the decode-side reference in `parsers/escpos.ts` lines 312-344).** Read that decode logic to learn the exact `GS k` byte format it expects to parse back (command byte, symbology-selector byte, length-or-null-terminator convention, data bytes), then implement the **encode** direction: `function encodeEscPosBarcode(config: BarcodeConfig): Uint8Array` emitting a spec-conformant `GS k` sequence that the same parser section could decode back correctly — use the parser's own byte-format understanding as your ground truth for what "correct" means here, and write a round-trip test in Task's Step 9 proving `EscPosParser.parse(encodeEscPosBarcode(config))` recovers the same symbology/content.

- [ ] **Step 7: Implement `EscPosQrCodeEncoder.ts` (net-new, same approach as Step 6)** — reference `parsers/escpos.ts` lines 390-415 (`GS ( k` decode) for the byte format, implement `function encodeEscPosQrCode(config: QrCodeConfig): Uint8Array` the same round-trip-provable way.

- [ ] **Step 8: Write the failing test for the code-page bug fix and barcode round-trip** (`src/compiler/escpos/__tests__/EscPosCompiler.test.ts`):

```typescript
import { EscPosCompiler } from '../EscPosCompiler';
import { EscPosParser } from '../../../parser/escpos/EscPosParser';

describe('EscPosCompiler', () => {
  it('encodes non-ASCII text via the profile code page, not raw UTF-8', () => {
    const compiler = new EscPosCompiler();
    const bytes = compiler.compile(
      { widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 0, copies: 1,
        elements: [{ type: 'text', content: 'café', options: {} }] },
      undefined, // falls back to DEFAULT_PROFILE (nativeUtf8: false)
    );
    const naiveUtf8 = new TextEncoder().encode('café');
    // The café substring should NOT appear as raw UTF-8 bytes when a non-native-UTF8 profile is used.
    expect(Buffer.from(bytes).includes(Buffer.from(naiveUtf8))).toBe(false);
  });

  it('round-trips a barcode element through parse', () => {
    const compiler = new EscPosCompiler();
    const bytes = compiler.compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 0, copies: 1,
      elements: [{ type: 'barcode', options: { symbology: 'code128', content: 'ABC123' } }],
    });
    const parsed = new EscPosParser().parse(bytes);
    expect(parsed.commands.length).toBeGreaterThan(0);
  });
});
```

Run and verify FAIL then PASS. (If `Buffer` isn't available in this package's test environment, use manual byte-array comparison instead — check what the repo's existing Jest setup provides before assuming Node's `Buffer` global is present.)

- [ ] **Step 9: Implement `EscPosParser.ts`** — port `parseESCPOS()` (whole 532-line file) directly, keeping the exact state-machine structure; adapt only the exported result shape to satisfy `PrintParser<{ commands: unknown[]; warnings: string[] }>` from `core/PrintParser.ts` (wrap/rename the return value if the source's own result interface has different field names — check `parsers/escpos.ts`'s own result interface name and fields before renaming).

- [ ] **Step 10: Write the failing test for the parser** (`src/parser/escpos/__tests__/EscPosParser.test.ts`):

```typescript
import { EscPosParser } from '../EscPosParser';

describe('EscPosParser', () => {
  it('parses a simple ESC @ (init) + text sequence without warnings', () => {
    const bytes = new Uint8Array([0x1b, 0x40, ...new TextEncoder().encode('Hello'), 0x0a]);
    const result = new EscPosParser().parse(bytes);
    expect(result.warnings).toEqual([]);
    expect(result.commands.length).toBeGreaterThan(0);
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 11: Implement `EscPosValidator.ts` (net-new — portakal's `validate.ts` never accepts `"escpos"` as a source language at all, per spec).** Since there's no portakal behavior to match, implement a minimal, genuinely useful validator rather than a stub: check that the byte stream doesn't contain an unterminated raster-image command (a `GS v 0` header whose declared width×height byte count exceeds the remaining buffer length — a real, catchable malformed-command condition) and emit a warning-level issue when text bytes outside 0x20-0x7E and 0x80-0xFF appear outside of a recognized multi-byte command (a rough "this looks like it might not be valid ESC/POS" signal). Return the shared `ValidationResult`/`ValidationIssue` shape from `validation/ValidationResult.ts`/`ValidationIssue.ts` — **check whether these 2 files already have real content from a sibling task; if not** (they weren't assigned to any Phase 1 task's Files list), implement them now as part of this task since `EscPosValidator` is Phase 1's first real consumer: port them directly from `portakal/src/validate.ts` lines 9-18, 20-29 as described in the spec's `validation/` table.

- [ ] **Step 12: Implement `EscPosPreviewRenderer.ts`** — port `renderReceiptSVG()` from `portakal/src/lang/escpos.ts` lines 17-45 directly (receipt-style layout: no absolute coordinates, elements stack vertically by line height).

- [ ] **Step 13: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root).

- [ ] **Step 14: Commit**

```bash
git add packages/printer-core/src/compiler/escpos packages/printer-core/src/parser/escpos packages/printer-core/src/validation/escpos packages/printer-core/src/validation/ValidationResult.ts packages/printer-core/src/validation/ValidationIssue.ts packages/printer-core/src/preview/languages/EscPosPreviewRenderer.ts
git commit -m "feat: port printer-core ESC/POS compiler+parser+validator+preview, fix code-page encoding bug"
```

---

### Task 9: TSC/TSPL — compiler, parser, validator, preview (+ full package barrel wiring)

**Files:**
- Modify (fill in): `packages/printer-core/src/compiler/tsc/TscCommand.ts`, `TscCompiler.ts`, `TscEncoder.ts`
- Modify (fill in): `packages/printer-core/src/parser/tsc/TscParser.ts`
- Modify (fill in): `packages/printer-core/src/validation/tsc/TscValidator.ts`
- Modify (fill in): `packages/printer-core/src/preview/languages/TscPreviewRenderer.ts`
- Test: `packages/printer-core/src/compiler/tsc/__tests__/TscCompiler.test.ts`, `packages/printer-core/src/parser/tsc/__tests__/TscParser.test.ts`, `packages/printer-core/src/__tests__/phase1-integration.test.ts` (new — end-to-end smoke test)

**Interfaces:**
- Consumes: everything Task 8 consumed, same shapes.
- Produces: `class TscCompiler implements PrintCompiler<string> { compile(document: ResolvedPrintDocument, profile?: PrinterProfile): string }`; `class TscParser implements PrintParser<{ commands: unknown[]; warnings: string[] }>`; `class TscValidator implements PrintValidation`; `class TscPreviewRenderer implements PrintPreview`.

**Steps:**

- [ ] **Step 1: Read spec's `compiler/` (tsc section), `parser/`, `validation/`, `preview/` tables and the cited portakal sources in full:** `portakal/src/languages/tsc.ts` (whole file, including the **known-broken** image case at lines 22-28 — see Step 3), `portakal/parsers/tsc.ts` (whole file, 1320 lines — the largest in portakal, includes TSPL BASIC-program parsing; budget real time for this one), `portakal/src/lang/tsc.ts` (whole file — `TSC_FONTS` 23-32, `tscFontSize()`/`tscCharWidth()` 42-57, `renderElement()` 59-155, `renderPreviewSVG()` 157-177), `portakal/src/validate.ts` lines 64-142 (`validateTSC()`).

- [ ] **Step 2: Implement `TscCommand.ts`** — extract the command-name string literals used throughout `compileElement()` in `languages/tsc.ts` (`"SIZE"`, `"GAP"`, `"CLS"`, `"TEXT"`, `"BOX"`, `"BAR"` or whatever the exact draw-primitive command names are — read them from the source, this repo's own `TsplEncoder.ts` at `src/features/printer/drivers/tspl/TsplEncoder.ts` documents several of these same TSPL2 command names too if useful cross-reference, but portakal's exact strings are the ground truth to port) as named string constants.

- [ ] **Step 3: Implement `TscEncoder.ts` — with the missing-image-payload bug fix.** Port the image case's header emission (`languages/tsc.ts` lines 22-28: `BITMAP x,y,bytesPerRow,height,0,`) but then **append the actual bitmap payload** the source never does — encode `bitmap.data` (a `Bitmap`/`MonochromeBitmap` from Task 3) as the comma-terminated command expects (check the TSPL2 `BITMAP` command's documented data encoding — this repo's existing `src/features/printer/drivers/tspl/TsplEncoder.ts` implements a working `BITMAP` command today and is a legitimate reference for "what does a correct payload look like," even though its command construction elsewhere is out of scope to port from — reading it to understand the payload format is fine, copying its ESC/POS-Vietnamese-specific workarounds is not). Write this as a small pure function: `function encodeTscBitmapPayload(bitmap: Bitmap): string | Uint8Array` (decide string-vs-bytes based on what TSPL2's `BITMAP` command actually expects — ASCII-encoded hex, or raw binary appended after the text header — verify from the reference rather than assuming).

- [ ] **Step 4: Implement `TscCompiler.ts`** — port `compileToTSC()` and its `compileElement()` switch directly, wiring in `TscEncoder`'s fixed image case (Step 3) and Task 4's barcode/qrcode configs for the `"BARCODE"`/`"QRCODE"` element cases (TSC's compiler doesn't need a separate `TscBarcodeEncoder.ts`/`TscQrCodeEncoder.ts` file per the spec — this logic lives directly in `TscCompiler.ts`'s switch, unlike ESC/POS's split).

- [ ] **Step 5: Write the failing test for the image payload fix** (`src/compiler/tsc/__tests__/TscCompiler.test.ts`):

```typescript
import { TscCompiler } from '../TscCompiler';

describe('TscCompiler', () => {
  it('emits a BITMAP command with an actual payload, not a bare trailing comma', () => {
    const compiler = new TscCompiler();
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 0, copies: 1,
      elements: [{ type: 'image', bitmap: { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 }, options: {} }],
    });
    expect(output).toContain('BITMAP');
    expect(output.trim().endsWith('BITMAP 0,0,2,1,0,')).toBe(false); // must not end with a bare trailing comma
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 6: Implement `TscParser.ts`** — port `parseTSPL()`/`parseTSC()` directly (the full 1320-line file). This is the largest single porting job in Phase 1 — keep the exact same grammar/state handling, do not attempt to simplify or "clean up" the TSPL BASIC-program parsing while porting; a byte-for-byte-equivalent parse behavior matters more than tidiness here, since any behavior drift is very hard to notice later without a real printer.

- [ ] **Step 7: Write the failing test for the parser** (`src/parser/tsc/__tests__/TscParser.test.ts`):

```typescript
import { TscParser } from '../TscParser';

describe('TscParser', () => {
  it('parses a SIZE + CLS + TEXT + PRINT sequence', () => {
    const source = 'SIZE 40 mm,30 mm\nGAP 3 mm,0\nCLS\nTEXT 10,10,"3",0,1,1,"Hello"\nPRINT 1\n';
    const result = new TscParser().parse(source);
    expect(result.warnings).toEqual([]);
    expect(result.commands.length).toBeGreaterThan(0);
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 8: Implement `TscValidator.ts`** — port `validateTSC()` directly (`portakal/src/validate.ts` lines 64-142: SIZE-must-come-first, CLS-before-elements, PRINT-required, DENSITY 0-15 range, SPEED 1-18 range, UNKNOWN-command warnings).

- [ ] **Step 9: Implement `TscPreviewRenderer.ts`** — port `TSC_FONTS`/`tscFontSize()`/`tscCharWidth()`/`renderElement()`/`renderPreviewSVG()` directly from `portakal/src/lang/tsc.ts` lines 23-177.

- [ ] **Step 10: Wire the full package barrel.** Update `packages/printer-core/src/core/PrintCompiler.ts` (or a new small dispatch object, whichever `core/` was designed to hold per Task 1 — check Task 1's actual implementation) to add a lookup so `compileTo(language: PrinterLanguage, document, profile?)` can dispatch to `EscPosCompiler`/`TscCompiler` for `"escpos"`/`"tsc"` (throwing/returning a clear "language not yet implemented" error for the other 7 — this repo's own `PrinterError` pattern in `src/features/printer/errors/PrinterError.ts` is a reasonable style reference for the error shape, though do not import from `src/features/printer` — define a local error class here). Same for parse/validate/preview dispatch.

- [ ] **Step 11: Write the end-to-end Phase 1 integration test** (`src/__tests__/phase1-integration.test.ts`):

```typescript
import { LabelBuilder } from '../builder/LabelBuilder';
import { TscCompiler } from '../compiler/tsc/TscCompiler';
import { TscParser } from '../parser/tsc/TscParser';
import { TscValidator } from '../validation/tsc/TscValidator';
import { EscPosCompiler } from '../compiler/escpos/EscPosCompiler';
import { EscPosParser } from '../parser/escpos/EscPosParser';

describe('Phase 1 end-to-end', () => {
  const doc = new LabelBuilder({ width: 40, height: 30, unit: 'mm', dpi: 203 })
    .text('Hello World', { x: 10, y: 10, size: 2 })
    .barcode({ symbology: 'code128', content: '123456789' })
    .resolve();

  it('compiles, parses, and validates a document as TSC', () => {
    const tsc = new TscCompiler().compile(doc);
    expect(new TscValidator().validate(tsc).valid).toBe(true);
    expect(new TscParser().parse(tsc).commands.length).toBeGreaterThan(0);
  });

  it('compiles and parses the same document as ESC/POS', () => {
    const bytes = new EscPosCompiler().compile(doc);
    expect(new EscPosParser().parse(bytes).commands.length).toBeGreaterThan(0);
  });
});
```

Run and verify FAIL then PASS — this test is the real acceptance gate for Phase 1: if it passes, `printer-core` can genuinely compile a real label to both protocols the app uses today.

- [ ] **Step 12: Run full package verification, whole-repo type-check, and lint.**

Run: `npm run type-check -w printer-core && npm test && cd ../.. && npm run type-check && npm run lint` (adjust relative `cd` to match actual shell state — run each command from the repo root `NDTCore.App/` to be safe: `npm run type-check`, `npm run lint`, `npm test`).

- [ ] **Step 13: Commit**

```bash
git add packages/printer-core/src/compiler/tsc packages/printer-core/src/parser/tsc packages/printer-core/src/validation/tsc packages/printer-core/src/preview/languages/TscPreviewRenderer.ts packages/printer-core/src/core packages/printer-core/src/__tests__
git commit -m "feat: port printer-core TSC/TSPL compiler+parser+validator+preview, fix image payload bug, wire language dispatch"
```

---

## Out of scope (Phase 2 — separate plan)

ZPL, EPL, CPCL, DPL, SBPL, Star PRNT, IPL (compiler + parser + validator + preview each); `convert/` (cross-compiler, depends on all 9 languages); remaining 6 vendor profile files' real data (Star/Bixolon/Citizen/Zebra/SATO/Honeywell — currently empty-record stubs from Task 6); `transport/` (interface-only port, independent, can be done anytime); `testing/` (`MockPrinterTransport`/`PrintDataAssertion`/`HexDump`). Wiring `src/features/printer` to actually consume `printer-core` instead of its own duplicate encoder logic is also separate, later work — not part of any porting plan.
