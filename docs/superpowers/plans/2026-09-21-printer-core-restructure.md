# printer-core Folder Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `packages/printer-core/src/` into responsibility-based folders (per the spec) without changing any runtime behavior — pure file moves, import-path updates, and 2 identifier renames.

**Architecture:** Each task is one self-contained group of moves. Every task follows the same mechanical pattern: `git mv` the files, update/create the barrel `index.ts` files the moves touch directly, then run `npm run type-check -w printer-core` and fix every reported error (TypeScript will report "Cannot find module" / "has no exported member" for every stale import — this is the authoritative list of what still needs updating, not something to guess by hand). Repeat type-check until clean, then test, then lint, then commit.

**Tech Stack:** TypeScript, Jest, ESLint (existing toolchain — no new tooling).

**Spec:** `docs/superpowers/specs/2026-09-21-printer-core-restructure-design.md`

## Global Constraints

- Pure restructure — no runtime behavior changes anywhere, except the 2 explicit identifier renames in Task 2 (`ReceiptColumn`→`TableColumn`, `ReceiptFormatter`→`RowFormatter` as a file/module rename with function names `formatRow`/`alignText`/`padRight` kept as-is).
- No import aliases — every import stays a relative path, per repo convention (`../../CLAUDE.md`, `docs/CODING_STANDARDS_TS.md`).
- After every task: `npm run type-check -w printer-core`, `npx jest packages/printer-core`, `npx eslint packages/printer-core/src` must all be clean before committing that task.
- `git mv` (not plain `mv`) for every move, so git tracks renames — makes the diff reviewable and preserves file history.
- Never use `git mv` on a file whose destination directory doesn't exist yet — create the directory first (plain `mkdir`, or let `git mv` create it — git mv does create intermediate directories automatically on most platforms, but this plan calls `mkdir` explicitly first everywhere for clarity and Windows compatibility).
- Do not touch any `.test.ts` file's logic — only its own relative imports, which move/rename alongside the source file the test is for (Jest discovers `__tests__/*.test.ts` wherever it lives, no config change needed).

---

### Task 1: Delete dead placeholder code

**Files:**
- Delete: `src/compiler/PrinterCompiler.ts`, `src/compiler/CompiledPrintData.ts`, `src/compiler/CompilerResult.ts`
- Delete: `src/parser/PrinterParser.ts`, `src/parser/ParsedCommand.ts`, `src/parser/ParsedPrintData.ts`
- Delete: `src/preview/PreviewResult.ts`, `src/preview/SvgDocument.ts`, `src/preview/SvgElement.ts`
- Delete: `src/validation/PrinterValidator.ts`, `src/validation/ValidationLevel.ts`
- Delete: `src/receipt/ReceiptCell.ts`
- Modify: `src/compiler/index.ts`, `src/parser/index.ts`, `src/preview/index.ts`, `src/validation/index.ts`, `src/receipt/index.ts`

**Interfaces:**
- Consumes: nothing (these are all confirmed dead — `export {}` placeholders never imported anywhere, or in `ReceiptCell.ts`'s case, an unused real type).
- Produces: nothing new. Later tasks just won't encounter these files.

- [ ] **Step 1: Delete the 11 placeholder files and the 1 dead-code file**

```bash
cd packages/printer-core/src
rm compiler/PrinterCompiler.ts compiler/CompiledPrintData.ts compiler/CompilerResult.ts
rm parser/PrinterParser.ts parser/ParsedCommand.ts parser/ParsedPrintData.ts
rm preview/PreviewResult.ts preview/SvgDocument.ts preview/SvgElement.ts
rm validation/PrinterValidator.ts validation/ValidationLevel.ts
rm receipt/ReceiptCell.ts
```

- [ ] **Step 2: Update the 5 barrel files to remove exports of deleted files**

`src/compiler/index.ts` — remove these 3 lines, keep the rest unchanged:
```ts
export * from './CompilerResult';
export * from './CompiledPrintData';
export * from './PrinterCompiler';
```

`src/parser/index.ts` — remove these 3 lines, keep the rest unchanged:
```ts
export * from './ParsedPrintData';
export * from './ParsedCommand';
export * from './PrinterParser';
```

`src/preview/index.ts` — remove these 3 lines, keep the rest unchanged:
```ts
export * from './PreviewResult';
export * from './SvgDocument';
export * from './SvgElement';
```

`src/validation/index.ts` — remove these 2 lines, keep the rest unchanged:
```ts
export * from './ValidationLevel';
export * from './PrinterValidator';
```

`src/receipt/index.ts` — remove this 1 line, keep the rest unchanged:
```ts
export * from './ReceiptCell';
```

- [ ] **Step 3: Type-check, fix any reported errors**

Run: `npm run type-check -w printer-core`
Expected: clean (nothing outside these 5 barrels referenced the deleted files — if an error appears, it means something imported a "dead" file that was actually still used; stop and investigate rather than deleting the import blindly).

- [ ] **Step 4: Test and lint**

Run: `npx jest packages/printer-core` — expect all suites still passing.
Run: `npx eslint packages/printer-core/src` — expect 0 errors.

- [ ] **Step 5: Commit**

```bash
git add -A -- packages/printer-core/src
git commit -m "refactor: delete 11 unported placeholder files and dead ReceiptCell type"
```

---

### Task 2: `receipt/` → `formatting/` + rename `ReceiptColumn`→`TableColumn`, `ReceiptFormatter`→`RowFormatter`

**Files:**
- Create dir: `src/formatting/`
- Move: `src/receipt/PairFormatter.ts` → `src/formatting/PairFormatter.ts`
- Move: `src/receipt/TableFormatter.ts` → `src/formatting/TableFormatter.ts`
- Move: `src/receipt/SeparatorFormatter.ts` → `src/formatting/SeparatorFormatter.ts`
- Move: `src/receipt/WordWrapper.ts` → `src/formatting/WordWrapper.ts`
- Move: `src/receipt/validateTableColumns.ts` → `src/formatting/validateTableColumns.ts`
- Move + rename: `src/receipt/ReceiptColumn.ts` → `src/formatting/TableColumn.ts` (interface renamed `ReceiptColumn`→`TableColumn`)
- Move + rename: `src/receipt/ReceiptFormatter.ts` → `src/formatting/RowFormatter.ts` (function names unchanged: `formatRow`, `alignText`, `padRight`)
- Create: `src/formatting/index.ts`
- Modify: `src/receipt/ReceiptLayout.ts`, `src/receipt/index.ts`, `src/index.ts`
- Modify (import path + identifier rename): `src/builder/layout/TableElement.ts`
- Modify (import path only): `src/compiler/cpcl/CpclCompiler.ts`, `src/compiler/dpl/DplCompiler.ts`, `src/compiler/epl/EplCompiler.ts`, `src/compiler/escpos/EscPosCompiler.ts`, `src/compiler/ipl/IplCompiler.ts`, `src/compiler/sbpl/SbplCompiler.ts`, `src/compiler/starprnt/StarPrntCompiler.ts`, `src/compiler/tsc/TscCompiler.ts`, `src/compiler/zpl/ZplCompiler.ts`, `src/preview/languages/EplPreviewRenderer.ts`, `src/preview/languages/TscPreviewRenderer.ts`, `src/preview/languages/ZplPreviewRenderer.ts`, `src/preview/PreviewRenderer.ts`

**Interfaces:**
- Produces: `TableColumn` (renamed from `ReceiptColumn`, same shape `{width, align?}`) exported from `src/formatting/index.ts` — every later task and all 9 languages' `formatTable()` call sites depend on this exact name from here on.
- Produces: `formatRow`, `alignText`, `padRight` exported from `src/formatting/RowFormatter.ts` — same signatures as before, just relocated.

- [ ] **Step 1: Create the directory and move the 5 relocated files**

```bash
cd packages/printer-core/src
mkdir formatting
git mv receipt/PairFormatter.ts formatting/PairFormatter.ts
git mv receipt/TableFormatter.ts formatting/TableFormatter.ts
git mv receipt/SeparatorFormatter.ts formatting/SeparatorFormatter.ts
git mv receipt/WordWrapper.ts formatting/WordWrapper.ts
git mv receipt/validateTableColumns.ts formatting/validateTableColumns.ts
```

`SeparatorFormatter.ts` and `WordWrapper.ts` need no content change (zero internal imports). `PairFormatter.ts` imports `padRight` from the file being renamed in Step 3 below — edit its import line now:
```ts
import { padRight } from './RowFormatter';

export function formatPair(left: string, right: string, totalWidth: number): string {
  // ...unchanged body...
}
```
`TableFormatter.ts` and `validateTableColumns.ts` also need import updates — done in Step 4 below (after `TableColumn.ts`/`RowFormatter.ts` exist under their new names).

- [ ] **Step 2: Move + rename `ReceiptColumn.ts` → `TableColumn.ts`, rename the interface**

```bash
git mv receipt/ReceiptColumn.ts formatting/TableColumn.ts
```

Edit `src/formatting/TableColumn.ts` — rename the interface:
```ts
export interface TableColumn {
  width: number;
  align?: "left" | "center" | "right";
}
```

- [ ] **Step 3: Move + rename `ReceiptFormatter.ts` → `RowFormatter.ts`, update its internal import**

```bash
git mv receipt/ReceiptFormatter.ts formatting/RowFormatter.ts
```

Edit `src/formatting/RowFormatter.ts` — only the import line changes (function bodies unchanged):
```ts
import { TableColumn } from './TableColumn';

export function formatRow(columns: TableColumn[], values: string[], totalWidth: number): string {
  // ...unchanged body...
}

export function alignText(text: string, width: number, align: "left" | "center" | "right"): string {
  // ...unchanged body...
}

export function padRight(text: string, width: number): string {
  // ...unchanged body...
}
```

- [ ] **Step 4: Update the moved files' own imports of `ReceiptColumn`/`ReceiptFormatter`**

Edit `src/formatting/TableFormatter.ts`:
```ts
import { TableColumn } from './TableColumn';
import { formatRow } from './RowFormatter';

export function formatTable(columns: TableColumn[], rows: string[][], totalWidth: number): string[] {
  return rows.map((row) => formatRow(columns, row, totalWidth));
}
```

Edit `src/formatting/validateTableColumns.ts` — change the import line only:
```ts
import type { TableColumn } from './TableColumn';
```
and update the parameter type in `validateTableColumns(columns: TableColumn[])` (was `ReceiptColumn[]`). Leave the JSDoc body text as-is except any literal mentions of `ReceiptColumn` — update those to `TableColumn` too.

- [ ] **Step 5: Create `src/formatting/index.ts`**

```ts
export * from './TableColumn';
export * from './PairFormatter';
export * from './TableFormatter';
export * from './RowFormatter';
export * from './validateTableColumns';
export * from './SeparatorFormatter';
export * from './WordWrapper';
```

- [ ] **Step 6: Update `src/receipt/ReceiptLayout.ts` to import from `formatting/`**

```ts
import { TableColumn } from '../formatting/TableColumn';
import { formatRow } from '../formatting/RowFormatter';

export interface ReceiptLayout {
  columns: TableColumn[];
  totalWidth: number;
}

export function layoutToRow(layout: ReceiptLayout, values: string[]): string {
  return formatRow(layout.columns, values, layout.totalWidth);
}
```

- [ ] **Step 7: Rewrite `src/receipt/index.ts`**

```ts
export * from './ReceiptLayout';
```

- [ ] **Step 8: Update `src/index.ts`** — add the new barrel:

```ts
export * from './formatting';
```
(keep `export * from './receipt';` — it still exists, just smaller now)

- [ ] **Step 9: Update every consumer's import path (and the 1 identifier rename in `TableElement.ts`)**

In each of these files, change the import from `'../../receipt'` (or `'../receipt'` for `preview/PreviewRenderer.ts`) to the equivalent relative path pointing at `formatting/` instead, keeping the same imported names (`formatTable`, `validateTableColumns`):

- `src/compiler/cpcl/CpclCompiler.ts`: `import { formatTable, validateTableColumns } from '../../formatting';`
- `src/compiler/dpl/DplCompiler.ts`: `import { formatTable, validateTableColumns } from '../../formatting';`
- `src/compiler/epl/EplCompiler.ts`: `import { formatTable, validateTableColumns } from '../../formatting';`
- `src/compiler/escpos/EscPosCompiler.ts`: `import { formatTable, validateTableColumns } from '../../formatting';`
- `src/compiler/ipl/IplCompiler.ts`: `import { formatTable, validateTableColumns } from '../../formatting';`
- `src/compiler/sbpl/SbplCompiler.ts`: `import { formatTable, validateTableColumns } from '../../formatting';`
- `src/compiler/starprnt/StarPrntCompiler.ts`: `import { formatTable, validateTableColumns } from '../../formatting';`
- `src/compiler/tsc/TscCompiler.ts`: `import { formatTable, validateTableColumns } from '../../formatting';`
- `src/compiler/zpl/ZplCompiler.ts`: `import { formatTable, validateTableColumns } from '../../formatting';`
- `src/preview/languages/EplPreviewRenderer.ts`: `import { formatTable, validateTableColumns } from '../../formatting';`
- `src/preview/languages/TscPreviewRenderer.ts`: `import { formatTable, validateTableColumns } from '../../formatting';`
- `src/preview/languages/ZplPreviewRenderer.ts`: `import { formatTable, validateTableColumns } from '../../formatting';`
- `src/preview/PreviewRenderer.ts`: `import { formatTable, validateTableColumns } from '../formatting';`

In `src/builder/layout/TableElement.ts`, change BOTH the import path AND the identifier (this file references the type, not the formatter functions):
```ts
import type { TableColumn } from '../../formatting';
```
and rename every use of `ReceiptColumn` in that file's body to `TableColumn`.

- [ ] **Step 10: Type-check, fix any remaining reported errors**

Run: `npm run type-check -w printer-core`
Expected: after the above, this should already be clean. If anything else in the package still references `ReceiptColumn`/`ReceiptFormatter`/`from '../receipt'` pointing at a now-moved file, the compiler will report it here — fix each by applying the same path/name substitution as Step 9.

- [ ] **Step 11: Test and lint**

Run: `npx jest packages/printer-core` — expect all suites still passing (no logic changed, only names/paths).
Run: `npx eslint packages/printer-core/src` — expect 0 errors.

- [ ] **Step 12: Commit**

```bash
git add -A -- packages/printer-core/src
git commit -m "refactor: extract receipt/ formatters into formatting/, rename ReceiptColumn->TableColumn"
```

---

### Task 3: `barcode/` + `qrcode/` → `symbology/`

**Files:**
- Create dir: `src/symbology/barcode/`, `src/symbology/qrcode/`
- Move: `src/barcode/BarcodeType.ts`, `src/barcode/BarcodeConfig.ts`, `src/barcode/BarcodeValidator.ts`, `src/barcode/index.ts` → `src/symbology/barcode/`
- Move: `src/qrcode/QrCodeModel.ts`, `src/qrcode/QrCodeErrorCorrection.ts`, `src/qrcode/QrCodeConfig.ts`, `src/qrcode/QrCodeValidator.ts`, `src/qrcode/index.ts` → `src/symbology/qrcode/`
- Create: `src/symbology/index.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Produces: same exports as before (`BarcodeType`, `BarcodeConfig`, `BarcodeValidator`, `QrCodeModel`, `QrCodeErrorCorrection`, `QrCodeConfig`, `QrCodeValidator`), now reachable via `src/symbology/index.ts` instead of 2 separate root barrels.

- [ ] **Step 1: Create directories and move files (contents unchanged, only relative imports inside them may need one extra `../`)**

```bash
cd packages/printer-core/src
mkdir -p symbology/barcode symbology/qrcode
git mv barcode/BarcodeType.ts symbology/barcode/BarcodeType.ts
git mv barcode/BarcodeConfig.ts symbology/barcode/BarcodeConfig.ts
git mv barcode/BarcodeValidator.ts symbology/barcode/BarcodeValidator.ts
git mv barcode/index.ts symbology/barcode/index.ts
git mv qrcode/QrCodeModel.ts symbology/qrcode/QrCodeModel.ts
git mv qrcode/QrCodeErrorCorrection.ts symbology/qrcode/QrCodeErrorCorrection.ts
git mv qrcode/QrCodeConfig.ts symbology/qrcode/QrCodeConfig.ts
git mv qrcode/QrCodeValidator.ts symbology/qrcode/QrCodeValidator.ts
git mv qrcode/index.ts symbology/qrcode/index.ts
rmdir barcode qrcode
```

- [ ] **Step 2: Create `src/symbology/index.ts`**

```ts
export * from './barcode';
export * from './qrcode';
```

- [ ] **Step 3: Update `src/index.ts`** — replace these 2 lines:
```ts
export * from './barcode';
export * from './qrcode';
```
with:
```ts
export * from './symbology';
```

- [ ] **Step 4: Type-check, fix any reported errors**

Run: `npm run type-check -w printer-core`
Expected: any file that imported directly from `'../barcode'`/`'../../barcode'`/`'../qrcode'`/`'../../qrcode'` (rather than the package's own public root barrel) will now error — for each one reported, add one more `../` to the path (since `symbology/barcode/` is one level deeper than `barcode/` was) and confirm the imported names are unchanged.

- [ ] **Step 5: Test and lint**

Run: `npx jest packages/printer-core` — expect all suites still passing.
Run: `npx eslint packages/printer-core/src` — expect 0 errors.

- [ ] **Step 6: Commit**

```bash
git add -A -- packages/printer-core/src
git commit -m "refactor: merge barcode/ and qrcode/ into symbology/"
```

---

### Task 4: `builder/{content,drawing,layout,printer}/` → `document/elements/*`

**Files:**
- Create dir: `src/document/elements/content/`, `src/document/elements/drawing/`, `src/document/elements/layout/`, `src/document/elements/control/`
- Move: `src/builder/PrintElement.ts` → `src/document/elements/PrintElement.ts`
- Move: `src/builder/content/*.ts` (5 files + index.ts) → `src/document/elements/content/`
- Move: `src/builder/drawing/*.ts` (7 files + index.ts) → `src/document/elements/drawing/`
- Move: `src/builder/layout/*.ts` (5 files + index.ts) → `src/document/elements/layout/`
- Move: `src/builder/printer/CutElement.ts`, `src/builder/printer/index.ts` → `src/document/elements/control/` (folder renamed `printer`→`control`)
- Create: `src/document/elements/index.ts`
- Modify: `src/document/index.ts`, `src/builder/index.ts`

**Interfaces:**
- Produces: `PrintElement` (the union type) and every element type (`TextElement`, `BarcodeElement`, `BoxElement`, `RowElement`, `CutElement`, etc.) now reachable from `src/document/elements/index.ts` in addition to the still-existing `src/builder/index.ts` re-export (Task 5 will remove `builder/` entirely — this task keeps `builder/index.ts` re-exporting from the new location so nothing outside `builder/` breaks yet).

- [ ] **Step 1: Create directories and move the element files**

```bash
cd packages/printer-core/src
mkdir -p document/elements/content document/elements/drawing document/elements/layout document/elements/control
git mv builder/PrintElement.ts document/elements/PrintElement.ts

git mv builder/content/TextElement.ts document/elements/content/TextElement.ts
git mv builder/content/ImageElement.ts document/elements/content/ImageElement.ts
git mv builder/content/BarcodeElement.ts document/elements/content/BarcodeElement.ts
git mv builder/content/QrCodeElement.ts document/elements/content/QrCodeElement.ts
git mv builder/content/RawElement.ts document/elements/content/RawElement.ts
git mv builder/content/index.ts document/elements/content/index.ts

git mv builder/drawing/LineElement.ts document/elements/drawing/LineElement.ts
git mv builder/drawing/BoxElement.ts document/elements/drawing/BoxElement.ts
git mv builder/drawing/CircleElement.ts document/elements/drawing/CircleElement.ts
git mv builder/drawing/EllipseElement.ts document/elements/drawing/EllipseElement.ts
git mv builder/drawing/DiagonalElement.ts document/elements/drawing/DiagonalElement.ts
git mv builder/drawing/ReverseElement.ts document/elements/drawing/ReverseElement.ts
git mv builder/drawing/EraseElement.ts document/elements/drawing/EraseElement.ts
git mv builder/drawing/index.ts document/elements/drawing/index.ts

git mv builder/layout/RowElement.ts document/elements/layout/RowElement.ts
git mv builder/layout/ColumnElement.ts document/elements/layout/ColumnElement.ts
git mv builder/layout/SpacerElement.ts document/elements/layout/SpacerElement.ts
git mv builder/layout/TableElement.ts document/elements/layout/TableElement.ts
git mv builder/layout/PageBreakElement.ts document/elements/layout/PageBreakElement.ts
git mv builder/layout/index.ts document/elements/layout/index.ts

git mv builder/printer/CutElement.ts document/elements/control/CutElement.ts
git mv builder/printer/index.ts document/elements/control/index.ts
rmdir builder/content builder/drawing builder/layout builder/printer
```

- [ ] **Step 2: Create `src/document/elements/index.ts`**

```ts
export * from './PrintElement';
export * from './content';
export * from './drawing';
export * from './layout';
export * from './control';
```

- [ ] **Step 3: Update `src/document/index.ts`** — add:
```ts
export * from './elements';
```

- [ ] **Step 4: Update `src/builder/index.ts`** — replace these lines:
```ts
export * from './PrintElement';
export * from './content';
export * from './drawing';
export * from './layout';
export * from './printer';
```
with:
```ts
export * from '../document/elements';
```
(keep `export * from './PrintBuilder';`, `'./LabelBuilder';`, `'./ReceiptBuilder';` — those move in Task 5, not this one)

- [ ] **Step 5: Type-check, fix any reported errors**

Run: `npm run type-check -w printer-core`
Expected: files that imported element types directly via `'../builder/content/...'`, `'../../builder/drawing/...'`, etc. (bypassing the barrel) will error — for each, point the import at the new `document/elements/...` path instead, adjusting the relative `../` depth to match the new location.

- [ ] **Step 6: Test and lint**

Run: `npx jest packages/printer-core` — expect all suites still passing.
Run: `npx eslint packages/printer-core/src` — expect 0 errors.

- [ ] **Step 7: Commit**

```bash
git add -A -- packages/printer-core/src
git commit -m "refactor: move PrintElement definitions from builder/ into document/elements/"
```

---

### Task 5: `builder/{Print,Label,Receipt}Builder.ts` + `markup/` → `document/builder/*`

**Files:**
- Create dir: `src/document/builder/`, `src/document/builder/markup/`
- Move: `src/builder/PrintBuilder.ts`, `src/builder/LabelBuilder.ts`, `src/builder/ReceiptBuilder.ts` → `src/document/builder/`
- Move: `src/markup/MarkupBuilder.ts`, `src/markup/MarkupParser.ts`, `src/markup/index.ts` → `src/document/builder/markup/`
- Delete dir: `src/builder/` (now empty), `src/markup/` (now empty)
- Create: `src/document/builder/index.ts`
- Modify: `src/document/index.ts`, `src/index.ts`

**Interfaces:**
- Produces: `PrintBuilder`, `LabelBuilder`, `ReceiptBuilder`, `MarkupBuilder`, `MarkupParser` reachable from `src/document/index.ts` (via `src/document/builder/index.ts`). `src/builder/` and `src/markup/` no longer exist.

- [ ] **Step 1: Create directories and move files**

```bash
cd packages/printer-core/src
mkdir -p document/builder/markup
git mv builder/PrintBuilder.ts document/builder/PrintBuilder.ts
git mv builder/LabelBuilder.ts document/builder/LabelBuilder.ts
git mv builder/ReceiptBuilder.ts document/builder/ReceiptBuilder.ts
git mv markup/MarkupBuilder.ts document/builder/markup/MarkupBuilder.ts
git mv markup/MarkupParser.ts document/builder/markup/MarkupParser.ts
git mv markup/index.ts document/builder/markup/index.ts
rmdir markup
rm builder/index.ts
rmdir builder
```

- [ ] **Step 2: Create `src/document/builder/index.ts`**

```ts
export * from './PrintBuilder';
export * from './LabelBuilder';
export * from './ReceiptBuilder';
export * from './markup';
```

- [ ] **Step 3: Update `src/document/index.ts`** — add:
```ts
export * from './builder';
```

- [ ] **Step 4: Update `src/index.ts`** — remove these 2 lines (now covered transitively via `export * from './document';`, which already re-exports `document/elements` from Task 4 and now `document/builder` too):
```ts
export * from './builder';
export * from './markup';
```

- [ ] **Step 5: Type-check, fix any reported errors**

Run: `npm run type-check -w printer-core`
Expected: any file still importing from `'../builder'` / `'../../builder'` / `'../markup'` / `'../../markup'` (module-not-found, since those folders no longer exist) needs its import path changed to point at the equivalent `document/builder/...` or `document/elements/...` location (element-type imports were already fixed in Task 4 — if any remain, it means Task 4 missed one; fix it the same way).

- [ ] **Step 6: Test and lint**

Run: `npx jest packages/printer-core` — expect all suites still passing.
Run: `npx eslint packages/printer-core/src` — expect 0 errors.

- [ ] **Step 7: Commit**

```bash
git add -A -- packages/printer-core/src
git commit -m "refactor: move PrintBuilder/LabelBuilder/ReceiptBuilder and markup/ into document/builder/"
```

---

### Task 6: `template/builders/` → `template/builder/`

**Files:**
- Move: `src/template/builders/*` (13 files + `__tests__/` + `index.ts`) → `src/template/builder/`
- Modify: `src/template/index.ts`

**Interfaces:**
- No name changes — only the directory is renamed singular. Every export from this folder keeps its exact name.

- [ ] **Step 1: Rename the directory**

```bash
cd packages/printer-core/src
git mv template/builders template/builder
```

- [ ] **Step 2: Update `src/template/index.ts`** — change:
```ts
export * from './builders';
```
to:
```ts
export * from './builder';
```

- [ ] **Step 3: Type-check, fix any reported errors**

Run: `npm run type-check -w printer-core`
Expected: clean — this rename doesn't change any file's *relative depth* to its siblings inside the folder (they moved together), so internal imports inside `template/builder/*.ts` need no changes. Only external references to `'./builders'` or `'../template/builders'` (if any exist outside `template/index.ts`) would need fixing here.

- [ ] **Step 4: Test and lint**

Run: `npx jest packages/printer-core` — expect all suites still passing (including `template/builder/__tests__/*.test.ts`, which moved along with their source files).
Run: `npx eslint packages/printer-core/src` — expect 0 errors.

- [ ] **Step 5: Commit**

```bash
git add -A -- packages/printer-core/src
git commit -m "refactor: rename template/builders/ to template/builder/"
```

---

### Task 7: `compiler/{lang}/` + `parser/{lang}/` → `language/{lang}/`

**Files:**
- Create dir: `src/language/tsc/`, `src/language/zpl/`, `src/language/epl/`, `src/language/cpcl/`, `src/language/dpl/`, `src/language/ipl/`, `src/language/sbpl/`, `src/language/escpos/`, `src/language/starprnt/`
- Move every file from `src/compiler/{lang}/` and `src/parser/{lang}/` into the corresponding `src/language/{lang}/`, for all 9 languages
- Delete: `src/compiler/index.ts`, `src/parser/index.ts`, and the now-empty `src/compiler/`, `src/parser/` directories
- Create: `src/language/index.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Produces: every compiler/parser class (`TscCompiler`, `TscParser`, `ZplCompiler`, `ZplParser`, ... for all 9 languages) reachable from `src/language/index.ts`. Nothing under `src/compiler/` or `src/parser/` exists after this task.

- [ ] **Step 1: Create the 9 language directories and move every file**

```bash
cd packages/printer-core/src
mkdir language

git mv compiler/tsc language/tsc
git mv parser/tsc/TscParser.ts language/tsc/TscParser.ts
rm parser/tsc/index.ts
rmdir parser/tsc

git mv compiler/zpl language/zpl
git mv parser/zpl/ZplParser.ts language/zpl/ZplParser.ts
rm parser/zpl/index.ts
rmdir parser/zpl

git mv compiler/epl language/epl
git mv parser/epl/EplParser.ts language/epl/EplParser.ts
rm parser/epl/index.ts
rmdir parser/epl

git mv compiler/cpcl language/cpcl
git mv parser/cpcl/CpclParser.ts language/cpcl/CpclParser.ts
rm parser/cpcl/index.ts
rmdir parser/cpcl

git mv compiler/dpl language/dpl
git mv parser/dpl/DplParser.ts language/dpl/DplParser.ts
rm parser/dpl/index.ts
rmdir parser/dpl

git mv compiler/ipl language/ipl
git mv parser/ipl/IplParser.ts language/ipl/IplParser.ts
rm parser/ipl/index.ts
rmdir parser/ipl

git mv compiler/sbpl language/sbpl
git mv parser/sbpl/SbplParser.ts language/sbpl/SbplParser.ts
rm parser/sbpl/index.ts
rmdir parser/sbpl

git mv compiler/escpos language/escpos
git mv parser/escpos/EscPosParser.ts language/escpos/EscPosParser.ts
rm parser/escpos/index.ts
rmdir parser/escpos

git mv compiler/starprnt language/starprnt
git mv parser/starprnt/StarPrntParser.ts language/starprnt/StarPrntParser.ts
rm parser/starprnt/index.ts
rmdir parser/starprnt

rm compiler/index.ts parser/index.ts
rmdir compiler parser
```

- [ ] **Step 2: Add the moved-in `{Lang}Parser` export to each of the 9 `language/{lang}/index.ts` files**

`src/language/tsc/index.ts` — add one line (keep the 3 already there from `compiler/tsc/index.ts`):
```ts
export * from './TscCompiler';
export * from './TscCommand';
export * from './TscEncoder';
export * from './TscParser';
```

`src/language/zpl/index.ts`:
```ts
export * from './ZplCompiler';
export * from './ZplCommand';
export * from './ZplEncoder';
export * from './ZplParser';
```

`src/language/epl/index.ts`:
```ts
export * from './EplCompiler';
export * from './EplCommand';
export * from './EplEncoder';
export * from './EplParser';
```

`src/language/cpcl/index.ts`:
```ts
export * from './CpclCompiler';
export * from './CpclCommand';
export * from './CpclEncoder';
export * from './CpclParser';
```

`src/language/dpl/index.ts`:
```ts
export * from './DplCompiler';
export * from './DplCommand';
export * from './DplEncoder';
export * from './DplParser';
```

`src/language/ipl/index.ts`:
```ts
export * from './IplCompiler';
export * from './IplCommand';
export * from './IplEncoder';
export * from './IplParser';
```

`src/language/sbpl/index.ts`:
```ts
export * from './SbplCompiler';
export * from './SbplCommand';
export * from './SbplEncoder';
export * from './SbplParser';
```

`src/language/escpos/index.ts`:
```ts
export * from './EscPosCompiler';
export * from './EscPosCommand';
export * from './EscPosCodePage';
export * from './EscPosImageEncoder';
export * from './EscPosBarcodeEncoder';
export * from './EscPosQrCodeEncoder';
export * from './EscPosParser';
```

`src/language/starprnt/index.ts`:
```ts
export * from './StarPrntCompiler';
export * from './StarPrntCommand';
export * from './StarPrntEncoder';
export * from './StarPrntParser';
```

- [ ] **Step 3: Create `src/language/index.ts`**

```ts
export * from './tsc';
export * from './zpl';
export * from './epl';
export * from './cpcl';
export * from './dpl';
export * from './ipl';
export * from './sbpl';
export * from './escpos';
export * from './starprnt';
```

- [ ] **Step 4: Update `src/index.ts`** — replace these 2 lines:
```ts
export * from './compiler';
export * from './parser';
```
with:
```ts
export * from './language';
```

- [ ] **Step 5: Type-check, fix every reported error**

Run: `npm run type-check -w printer-core`
Expected: many errors here — every file elsewhere in the package that imports a `{Lang}Compiler`/`{Lang}Parser`/`{Lang}Command`/`{Lang}Encoder` via a relative path into `compiler/{lang}/...` or `parser/{lang}/...` (e.g. `core/LanguageDispatch.ts`, `convert/ConversionRegistry.ts`, and every `preview/languages/{Lang}PreviewRenderer.ts` that imports its compiler's `{Lang}Command` constants) needs its import path repointed at `language/{lang}/...`, with the `../` depth adjusted to the new location. Fix each one the compiler reports, re-run, repeat until clean. Do not change any imported *name* here — only paths.

- [ ] **Step 6: Test and lint**

Run: `npx jest packages/printer-core` — expect all suites still passing.
Run: `npx eslint packages/printer-core/src` — expect 0 errors.

- [ ] **Step 7: Commit**

```bash
git add -A -- packages/printer-core/src
git commit -m "refactor: merge compiler/{lang}/ and parser/{lang}/ into language/{lang}/"
```

---

### Task 8: `preview/languages/{Lang}PreviewRenderer.ts` → `preview/languages/{lang}/{Lang}PreviewRenderer.ts`

**Files:**
- Create dir: `src/preview/languages/tsc/`, `.../zpl/`, `.../epl/`, `.../cpcl/`, `.../dpl/`, `.../ipl/`, `.../sbpl/`, `.../escpos/`, `.../starprnt/`
- Move each `src/preview/languages/{Lang}PreviewRenderer.ts` into its new per-language subfolder
- Create an `index.ts` in each new subfolder
- Modify: `src/preview/languages/index.ts`

**Interfaces:**
- No name changes to any exported class — only an extra directory level per language, matching `language/{lang}/`'s and `validation/languages/{lang}/`'s (Task 9) shape.

- [ ] **Step 1: Create directories and move each renderer file**

```bash
cd packages/printer-core/src
mkdir -p preview/languages/tsc preview/languages/zpl preview/languages/epl preview/languages/cpcl preview/languages/dpl preview/languages/ipl preview/languages/sbpl preview/languages/escpos preview/languages/starprnt

git mv preview/languages/TscPreviewRenderer.ts preview/languages/tsc/TscPreviewRenderer.ts
git mv preview/languages/ZplPreviewRenderer.ts preview/languages/zpl/ZplPreviewRenderer.ts
git mv preview/languages/EplPreviewRenderer.ts preview/languages/epl/EplPreviewRenderer.ts
git mv preview/languages/CpclPreviewRenderer.ts preview/languages/cpcl/CpclPreviewRenderer.ts
git mv preview/languages/DplPreviewRenderer.ts preview/languages/dpl/DplPreviewRenderer.ts
git mv preview/languages/IplPreviewRenderer.ts preview/languages/ipl/IplPreviewRenderer.ts
git mv preview/languages/SbplPreviewRenderer.ts preview/languages/sbpl/SbplPreviewRenderer.ts
git mv preview/languages/EscPosPreviewRenderer.ts preview/languages/escpos/EscPosPreviewRenderer.ts
git mv preview/languages/StarPrntPreviewRenderer.ts preview/languages/starprnt/StarPrntPreviewRenderer.ts
```

- [ ] **Step 2: Create 1 `index.ts` per new subfolder**

`src/preview/languages/tsc/index.ts`: `export * from './TscPreviewRenderer';`
`src/preview/languages/zpl/index.ts`: `export * from './ZplPreviewRenderer';`
`src/preview/languages/epl/index.ts`: `export * from './EplPreviewRenderer';`
`src/preview/languages/cpcl/index.ts`: `export * from './CpclPreviewRenderer';`
`src/preview/languages/dpl/index.ts`: `export * from './DplPreviewRenderer';`
`src/preview/languages/ipl/index.ts`: `export * from './IplPreviewRenderer';`
`src/preview/languages/sbpl/index.ts`: `export * from './SbplPreviewRenderer';`
`src/preview/languages/escpos/index.ts`: `export * from './EscPosPreviewRenderer';`
`src/preview/languages/starprnt/index.ts`: `export * from './StarPrntPreviewRenderer';`

- [ ] **Step 3: Rewrite `src/preview/languages/index.ts`**

```ts
export * from './tsc';
export * from './zpl';
export * from './epl';
export * from './cpcl';
export * from './dpl';
export * from './ipl';
export * from './sbpl';
export * from './escpos';
export * from './starprnt';
```

- [ ] **Step 4: Type-check, fix any reported errors**

Run: `npm run type-check -w printer-core`
Expected: each moved renderer file's own imports (e.g. `import { formatTable, validateTableColumns } from '../../formatting';` from Task 2, or imports of its language's `{Lang}Command` from `language/{lang}/`) now need one more `../` since the file is one directory level deeper — fix each reported "Cannot find module" by adding `../`.

- [ ] **Step 5: Test and lint**

Run: `npx jest packages/printer-core` — expect all suites still passing.
Run: `npx eslint packages/printer-core/src` — expect 0 errors.

- [ ] **Step 6: Commit**

```bash
git add -A -- packages/printer-core/src
git commit -m "refactor: nest preview/languages/*PreviewRenderer.ts one level deeper, per language"
```

---

### Task 9: `validation/{lang}/` → `validation/languages/{lang}/`

**Files:**
- Create dir: `src/validation/languages/`
- Move: `src/validation/tsc/`, `.../zpl/`, `.../epl/`, `.../cpcl/`, `.../dpl/`, `.../ipl/`, `.../sbpl/`, `.../escpos/`, `.../starprnt/` → `src/validation/languages/{lang}/` (whole directories, contents unchanged)
- Modify: `src/validation/index.ts`

**Interfaces:**
- No name changes — only adds one directory level (`languages/`), matching `preview/languages/{lang}/`'s shape from Task 8.

- [ ] **Step 1: Create the parent directory and move each language's validation folder**

```bash
cd packages/printer-core/src
mkdir validation/languages
git mv validation/tsc validation/languages/tsc
git mv validation/zpl validation/languages/zpl
git mv validation/epl validation/languages/epl
git mv validation/cpcl validation/languages/cpcl
git mv validation/dpl validation/languages/dpl
git mv validation/ipl validation/languages/ipl
git mv validation/sbpl validation/languages/sbpl
git mv validation/escpos validation/languages/escpos
git mv validation/starprnt validation/languages/starprnt
```

- [ ] **Step 2: Update `src/validation/index.ts`** — replace these 9 lines:
```ts
export * from './tsc';
export * from './zpl';
export * from './epl';
export * from './escpos';
export * from './cpcl';
export * from './dpl';
export * from './sbpl';
export * from './starprnt';
export * from './ipl';
```
with:
```ts
export * from './languages/tsc';
export * from './languages/zpl';
export * from './languages/epl';
export * from './languages/escpos';
export * from './languages/cpcl';
export * from './languages/dpl';
export * from './languages/sbpl';
export * from './languages/starprnt';
export * from './languages/ipl';
```

- [ ] **Step 3: Type-check, fix any reported errors**

Run: `npm run type-check -w printer-core`
Expected: each moved `{Lang}Validator.ts` file's own relative imports (e.g. importing its language's parser to re-parse-and-check, or importing `ValidationIssue`/`ValidationResult` from `validation/`) now need one more `../` since the file is one directory level deeper — fix each reported error by adding `../`.

- [ ] **Step 4: Test and lint**

Run: `npx jest packages/printer-core` — expect all suites still passing.
Run: `npx eslint packages/printer-core/src` — expect 0 errors.

- [ ] **Step 5: Commit**

```bash
git add -A -- packages/printer-core/src
git commit -m "refactor: nest validation/{lang}/ one level deeper under validation/languages/"
```

---

### Task 10: Update README, verify printer-preview, final whole-package check

**Files:**
- Modify: `packages/printer-core/README.md`
- Verify only (no source changes expected): `packages/printer-preview/*`

**Interfaces:**
- None — this task only re-documents the now-accurate structure and verifies nothing outside `printer-core` broke.

- [ ] **Step 1: Rewrite the "Cấu trúc" section of `packages/printer-core/README.md`**

Replace the entire ```text ... ``` code block under `## Cấu trúc` with the final structure tree from `docs/superpowers/specs/2026-09-21-printer-core-restructure-design.md`'s "Cấu trúc đầy đủ (sau khi tái cấu trúc)" section — copy it verbatim (it already reflects every task in this plan).

- [ ] **Step 2: Fix the placeholder-file claim in the status blurb**

The line "Cả 9 ngôn ngữ máy in, `convert/`, và toàn bộ profile theo hãng đều đã có logic thật — không còn file placeholder (`export {}`) nào." is now true (Task 1 deleted the 11 that made it false before) — leave this sentence as-is, it no longer needs correction after this plan runs.

- [ ] **Step 3: Full package verification**

Run: `npm run type-check -w printer-core` — expect clean.
Run: `npx jest packages/printer-core` — expect all suites passing, same count as before this plan started (no test deleted or skipped).
Run: `npx eslint packages/printer-core/src` — expect 0 errors.

- [ ] **Step 4: Verify `printer-preview` is unaffected**

`packages/printer-preview` imports only from the package root (`from 'printer-core'`), never a deep path — confirm this holds:

Run: `grep -rn "from 'printer-core" packages/printer-preview/src` and confirm every match imports only from `'printer-core'` itself (the bare package name), never `'printer-core/something'`.

Run: `npm run type-check -w printer-preview` — expect clean.
Run: `npm run test -w printer-preview` — expect the same test count passing as before this plan started.

- [ ] **Step 5: Repo-root verification**

Run: `npm run type-check` (repo root) — expect clean.
Run: `npx jest` (repo root) — expect the same total suite/test count as before this plan started (printer-core's tests moved but didn't change count; printer-preview's Vitest suite is separately excluded per existing `jest.config.js` setup).

- [ ] **Step 6: Commit**

```bash
git add -A -- packages/printer-core/README.md
git commit -m "docs: update printer-core README structure diagram to match restructured tree"
```

---

## Final Verification

After Task 10, confirm the whole tree matches the spec's "Cấu trúc đầy đủ" section exactly:

```bash
find packages/printer-core/src -name '*.ts' ! -path '*__tests__*' ! -name '*.test.ts' | sort
```

Compare this listing against the spec's final structure. Any file not accounted for by the spec (moved, deleted, or explicitly left unchanged) is a plan gap — investigate before considering this plan done.
