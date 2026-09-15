# printer-core Element Model Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `PrintElement`'s `Record<string, unknown>`-options design with one named interface per element type (removing every `toRecord()`/`as *Options` cast in the builder and both compilers), move it from `document/` to `builder/`, and wire the 7 currently-orphaned element types (Row/Column/Spacer/Table/PageBreak/Cut/Diagonal) into real `PrintElement` variants + `PrintBuilder` methods + compiler handling.

**Architecture:** This is a redesign of already-shipped, already-reviewed `printer-core` code (Phase 1, branch `feature/printer-core-port-phase1`, PR pending against `main`). This plan's branch (`refactor/printer-core-element-model`) is based on that branch, not `main` — it builds directly on Phase 1's work rather than waiting for that PR to merge first.

**Tech Stack:** Same as Phase 1 — TypeScript strict, Jest via root config, `tsc --noEmit`, ESLint via root config.

**Spec:** `docs/superpowers/specs/2026-09-15-printer-core-element-model-design.md` — read this in full before starting any task. It has the exact new interface shapes, the exact compiler behavior for each of the 7 new element types (which are real, which are documented no-ops), the Diagonal dispatch logic, and the full list of files that need updating. This plan's tasks point back to specific sections of that spec rather than re-deriving everything here.

## Global Constraints

- Framework-agnostic: no `react-native` import anywhere in `packages/printer-core/src/`.
- TypeScript strict, no `any` anywhere.
- No path aliases — relative imports only.
- Comments only when WHY isn't obvious.
- Tests: Jest, `__tests__/` sibling folders, run via root `npm test`.
- Type-check: `npm run type-check -w printer-core` AND root `npm run type-check` must both stay clean after every task.
- Lint: root `npm run lint` must stay clean after every task.
- Do not modify `src/features/printer/` or anything outside `packages/printer-core/`.
- `PrintDocument`'s own shape is explicitly OUT of scope for this plan — do not change it (see spec's Scope section for why).
- No auto-layout engine — Row/Column/Spacer/PageBreak are documented no-ops in both compilers (see spec) — do not attempt real layout computation.
- Every task must leave the whole repo's test suite green — this plan touches already-shipped, already-tested code, so regressions are the primary risk, not missing functionality.

---

### Task 1: Redesign and move `PrintElement`

**Files:**
- Create: `packages/printer-core/src/builder/PrintElement.ts` (new home, full redesigned union — 18 variants)
- Delete: `packages/printer-core/src/document/PrintElement.ts`
- Modify: `packages/printer-core/src/document/PrintElementType.ts` (re-derive from the moved type instead of its own literal list)
- Modify: `packages/printer-core/src/document/ResolvedPrintDocument.ts` (import `PrintElement` from `../builder` instead of `./PrintElement`, as `import type` only — see spec's cycle-avoidance note)
- Modify: `packages/printer-core/src/document/index.ts` (barrel — `PrintElement` no longer lives here; decide whether to keep re-exporting it via `export * from '../builder'` for backward-compat import paths, or drop it and require `../builder` imports going forward — your call, document the reasoning in your report)
- Modify: `packages/printer-core/src/builder/index.ts` (barrel — add `export * from './PrintElement'`)
- Test: `packages/printer-core/src/builder/__tests__/PrintElement.test.ts` (new — see Step 3)

**Interfaces:**
- Consumes: `Bitmap` (`../types`), `BarcodeConfig` (`../barcode`), `QrCodeConfig` (`../qrcode`), and every `*Options` interface already defined in `builder/content/*.ts`, `builder/drawing/*.ts`, `builder/layout/*.ts`, `builder/printer/CutElement.ts` (read each file directly for its exact current shape — do not guess).
- Produces: the full 18-variant `PrintElement` union at `builder/PrintElement.ts`, exact shapes per spec's "New `PrintElement` shape" section. Every later task in this plan imports `PrintElement` from `../builder` (or `./PrintElement` within `builder/`), not `../document`.

**Steps:**

- [ ] **Step 1: Read the spec's "New `PrintElement` shape" and "Consumers requiring updates" sections in full**, plus the current `document/PrintElement.ts`, `document/PrintElementType.ts`, `document/ResolvedPrintDocument.ts`, `document/index.ts`, and every `*Options` file listed above (their current exact field shapes are what you're wrapping into named element interfaces — read them, don't guess).

- [ ] **Step 2: Write `builder/PrintElement.ts`** with all 18 variants exactly as specified in the spec. Import each `*Options` type from its existing file (`../barcode`, `../qrcode`, `./content/TextElement`, `./drawing/BoxElement`, `./layout/RowElement`, `./printer/CutElement`, etc. — one import per options type, matching where Task 7 already put each one).

- [ ] **Step 3: Write the failing test** (`builder/__tests__/PrintElement.test.ts`) — a type-level + minimal runtime smoke test proving every variant constructs and narrows correctly:

```typescript
import type { PrintElement } from '../PrintElement';

describe('PrintElement', () => {
  it('narrows to the right shape per discriminant across all 18 variants', () => {
    const elements: PrintElement[] = [
      { type: 'text', content: 'hi' },
      { type: 'image', bitmap: { data: new Uint8Array(), width: 1, height: 1, bytesPerRow: 1 } },
      { type: 'barcode', options: { symbology: 'code128', content: 'A' } },
      { type: 'qrcode', options: { content: 'A' } },
      { type: 'box', options: { x: 0, y: 0, width: 10, height: 10 } },
      { type: 'line', options: { x1: 0, y1: 0, x2: 10, y2: 0 } },
      { type: 'diagonal', options: { x1: 0, y1: 0, x2: 10, y2: 10 } },
      { type: 'circle', options: { x: 0, y: 0, diameter: 10 } },
      { type: 'ellipse', options: { x: 0, y: 0, width: 10, height: 5 } },
      { type: 'reverse', options: { x: 0, y: 0, width: 10, height: 10 } },
      { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
      { type: 'raw', content: 'RAW' },
      { type: 'cut' },
      { type: 'table', options: { columns: [{ width: 10 }], rows: [['a']] } },
      { type: 'pageBreak' },
      { type: 'spacer', options: { size: 10 } },
      { type: 'row', options: {} },
      { type: 'column', options: {} },
    ];
    expect(elements).toHaveLength(18);
    const text = elements.find((e): e is Extract<PrintElement, { type: 'text' }> => e.type === 'text');
    expect(text?.content).toBe('hi');
  });
});
```

Run: `npm test -- builder/__tests__/PrintElement.test.ts` (from `packages/printer-core`). Expected: FAIL (file still `export {};`), then PASS after Step 2.

- [ ] **Step 4: Update `document/PrintElementType.ts`** to `export type PrintElementType = PrintElement['type'];`, importing `PrintElement` from `../builder`.

- [ ] **Step 5: Update `document/ResolvedPrintDocument.ts`'s import** of `PrintElement` from `./PrintElement` to `import type { PrintElement } from '../builder';` — keep it `import type` only (never a value import) to avoid a real runtime cycle, per the spec's note. Delete `document/PrintElement.ts`.

- [ ] **Step 6: Update `document/index.ts` and `builder/index.ts` barrels** per Step 1's file list — add `export * from './PrintElement'` to `builder/index.ts`; decide and document whether `document/index.ts` keeps re-exporting `PrintElement` for backward compatibility.

- [ ] **Step 7: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root). This will surface every downstream file that broke — do NOT fix them in this task (that's Tasks 2-6's job) unless the break is trivially inside a file already listed above. If you find type errors in files outside this task's Files list, STOP and report DONE_WITH_CONCERNS listing exactly which files broke and how — the controller will confirm those are covered by a later task before you commit.

- [ ] **Step 8: Commit**

```bash
git add packages/printer-core/src/builder/PrintElement.ts packages/printer-core/src/builder/index.ts packages/printer-core/src/builder/__tests__/PrintElement.test.ts packages/printer-core/src/document/PrintElementType.ts packages/printer-core/src/document/ResolvedPrintDocument.ts packages/printer-core/src/document/index.ts
git rm packages/printer-core/src/document/PrintElement.ts
git commit -m "refactor: redesign PrintElement as named-interface union, move to builder/"
```

---

### Task 2: `PrintBuilder` — remove cast bridge, add 7 new methods, Diagonal dispatch

**Files:**
- Modify: `packages/printer-core/src/builder/PrintBuilder.ts`
- Modify: `packages/printer-core/src/builder/LabelBuilder.ts`, `packages/printer-core/src/builder/ReceiptBuilder.ts` (import path fix only, if needed — `PrintElement` now resolves via `../builder` internally, check if either file's own imports need adjusting)
- Test: `packages/printer-core/src/builder/__tests__/LabelBuilder.test.ts` (extend existing file — add cases for the 7 new methods)

**Interfaces:**
- Consumes: `PrintElement` (Task 1, all 18 variants), `isDiagonal()` (`./drawing/DiagonalElement.ts`, already exists per Phase 1).
- Produces: `PrintBuilder` gains `.cut(options?: CutOptions): this`, `.table(options: TableOptions): this`, `.pageBreak(): this`, `.spacer(options: SpacerOptions): this`, `.row(options?: RowOptions): this`, `.column(options?: ColumnOptions): this` — exact signatures per spec. `.line()`'s existing signature is unchanged but its internal dispatch changes (see below).

**Steps:**

- [ ] **Step 1: Read spec's "New `PrintElement` shape" section (the Diagonal/Cut/Table/PageBreak/Spacer/Row/Column bullets) and the current `PrintBuilder.ts`, `LabelBuilder.ts`, `ReceiptBuilder.ts`, `drawing/DiagonalElement.ts` in full.**

- [ ] **Step 2: Remove `toRecord()` and update every existing chain method** (`.text()`, `.image()`, `.box()`, `.line()`, `.circle()`, `.ellipse()`, `.reverse()`, `.erase()`, `.raw()`, `.barcode()`, `.qrcode()`) to construct the new precisely-typed `PrintElement` variant directly (no cast — TypeScript now checks the literal against the named interface).

- [ ] **Step 3: Change `.line()`'s dispatch** to select `LineElement` vs `DiagonalElement` via `isDiagonal(options)`, per spec's exact code block.

- [ ] **Step 4: Write the failing test for Diagonal dispatch and the 7 new methods** (extend `builder/__tests__/LabelBuilder.test.ts`):

```typescript
it('pushes a diagonal element when line coordinates are not axis-aligned', () => {
  const doc = new LabelBuilder({ width: 40, height: 30 })
    .line({ x1: 0, y1: 0, x2: 10, y2: 20 })
    .resolve();
  expect(doc.elements[0]?.type).toBe('diagonal');
});

it('pushes a plain line element when coordinates are axis-aligned', () => {
  const doc = new LabelBuilder({ width: 40, height: 30 })
    .line({ x1: 0, y1: 0, x2: 10, y2: 0 })
    .resolve();
  expect(doc.elements[0]?.type).toBe('line');
});

it('chains all 7 newly-wired element methods', () => {
  const doc = new LabelBuilder({ width: 40, height: 30 })
    .cut({ mode: 'full' })
    .table({ columns: [{ width: 10 }], rows: [['a']] })
    .pageBreak()
    .spacer({ size: 5 })
    .row()
    .column()
    .resolve();
  expect(doc.elements.map((e) => e.type)).toEqual(['cut', 'table', 'pageBreak', 'spacer', 'row', 'column']);
});
```

Run and verify FAIL then PASS.

- [ ] **Step 5: Add the 7 new methods to `PrintBuilder.ts`**, exact signatures per spec (`.cut()`/`.spacer()`/`.row()`/`.column()` take a default `{}` where the spec says the parameter is optional; `.table()`'s `options` is required).

- [ ] **Step 6: Fix `LabelBuilder.ts`/`ReceiptBuilder.ts` import paths** if Task 1 moved anything they reference.

- [ ] **Step 7: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root).

- [ ] **Step 8: Commit**

```bash
git add packages/printer-core/src/builder/PrintBuilder.ts packages/printer-core/src/builder/LabelBuilder.ts packages/printer-core/src/builder/ReceiptBuilder.ts packages/printer-core/src/builder/__tests__/LabelBuilder.test.ts
git commit -m "refactor: remove PrintBuilder cast bridge, add cut/table/pageBreak/spacer/row/column methods"
```

---

### Task 3: ESC/POS compiler — remove casts, add 7 new element cases

**Files:**
- Modify: `packages/printer-core/src/compiler/escpos/EscPosCompiler.ts`
- Modify: `packages/printer-core/src/compiler/escpos/EscPosCommand.ts` (add cut byte constant(s))
- Test: `packages/printer-core/src/compiler/escpos/__tests__/EscPosCompiler.test.ts` (extend existing file)

**Interfaces:**
- Consumes: `PrintElement` (Task 1), `PrintBuilder.cut()`/etc. (Task 2, for building test fixtures via `LabelBuilder`).
- Produces: no new exports — `EscPosCompiler.compile()`'s existing signature is unchanged, only its internal `compileElement()` switch gains cases and loses casts.

**Steps:**

- [ ] **Step 1: Read spec's Cut/Diagonal/no-op compiler-behavior bullets for ESC/POS, and the current `EscPosCompiler.ts`, `EscPosCommand.ts` in full.**

- [ ] **Step 2: Remove the `as TextOptions` cast in `compileTextElement`** — `options` is now typed `TextOptions | undefined` directly from the `TextElement` variant (default to `{}` if undefined, matching the current default-parameter behavior).

- [ ] **Step 3: Add `ESC_POS.CUT` (or equivalent name) to `EscPosCommand.ts`** — the `GS V` byte pair, per the ESC/POS spec's cut command (`0x1d, 0x56`).

- [ ] **Step 4: Implement `case 'cut'` in `compileElement`** per spec: `mode: 'full'` → `m=0`; `'partial'` → `m=1`; `'off'` → emit nothing; `rows` present → use the `GS V m n` form (feed-then-cut). Default `mode` if unspecified — pick `'full'` as the sensible default (matches this repo's existing `TsplEncoder.cut()` default behavior for its own default-mode case, per the spec's cross-reference — verify against that file directly, don't guess).

- [ ] **Step 5: Add `case 'diagonal': return [];` and `case 'pageBreak': case 'spacer': case 'row': case 'column': return [];`** alongside the existing no-op cases (box/line/circle/ellipse/reverse/erase), each keeping the existing one-line comment style explaining why (no native command, same precedent).

- [ ] **Step 6: Add `case 'table'`** — real behavior per spec: call `formatTable()` from `../../receipt` with `element.options.columns`/`element.options.rows` and a total-width derived by summing `columns[].width`, then for each returned line, emit it as a text print (reuse `compileTextElement`'s text-encoding path or call it directly with default options) followed by a linefeed.

- [ ] **Step 7: Write the failing tests** (extend `EscPosCompiler.test.ts`):

```typescript
it('emits a full-cut GS V command for a cut element', () => {
  const bytes = new EscPosCompiler().compile({
    widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 0, copies: 1,
    elements: [{ type: 'cut', options: { mode: 'full' } }],
  });
  expect(Array.from(bytes)).toEqual(expect.arrayContaining([0x1d, 0x56, 0x00]));
});

it('emits nothing for cut mode off', () => {
  const withCut = new EscPosCompiler().compile({
    widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 0, copies: 1,
    elements: [{ type: 'cut', options: { mode: 'off' } }],
  });
  const withoutCut = new EscPosCompiler().compile({
    widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 0, copies: 1,
    elements: [],
  });
  expect(withCut).toEqual(withoutCut);
});

it('emits table rows as text lines', () => {
  const bytes = new EscPosCompiler().compile({
    widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 0, copies: 1,
    elements: [{ type: 'table', options: { columns: [{ width: 10 }], rows: [['hello']] } }],
  });
  const text = new TextDecoder().decode(bytes);
  expect(text).toContain('hello');
});

it('no-ops for pageBreak/spacer/row/column/diagonal', () => {
  for (const el of [{ type: 'pageBreak' as const }, { type: 'spacer' as const, options: { size: 5 } }, { type: 'row' as const, options: {} }, { type: 'column' as const, options: {} }, { type: 'diagonal' as const, options: { x1: 0, y1: 0, x2: 5, y2: 5 } }]) {
    const withEl = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 0, copies: 1,
      elements: [el],
    });
    const without = new EscPosCompiler().compile({
      widthDots: 384, heightDots: 0, dpi: 203, gapDots: 0, speed: 4, density: 8, direction: 0, copies: 1,
      elements: [],
    });
    expect(withEl).toEqual(without);
  }
});
```

Run and verify FAIL then PASS.

- [ ] **Step 8: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root).

- [ ] **Step 9: Commit**

```bash
git add packages/printer-core/src/compiler/escpos
git commit -m "refactor: remove EscPosCompiler option casts, add cut/table/diagonal/no-op element handling"
```

---

### Task 4: TSC compiler — remove casts, add 7 new element cases

**Files:**
- Modify: `packages/printer-core/src/compiler/tsc/TscCompiler.ts`
- Modify: `packages/printer-core/src/compiler/tsc/TscCommand.ts` (add `SET CUTTER` command constant(s))
- Test: `packages/printer-core/src/compiler/tsc/__tests__/TscCompiler.test.ts` (extend existing file)

**Interfaces:**
- Consumes: `PrintElement` (Task 1).
- Produces: no new exports — `TscCompiler.compile()`'s signature unchanged, only `compileElement()` gains cases and loses casts.

**Steps:**

- [ ] **Step 1: Read spec's Cut/Diagonal/Table/no-op compiler-behavior bullets for TSC, the current `TscCompiler.ts`/`TscCommand.ts` in full, and `src/features/printer/drivers/tspl/TsplEncoder.ts`'s `cut()` method** (this repo's own existing, working TSPL driver — read-only reference for the exact `SET CUTTER` command grammar and its "persistent setting" behavior; do not copy unrelated logic from that file).

- [ ] **Step 2: Remove every `as unknown as *Options` cast** in `compileElement` — each case's `element.options` is now already the precise type from the `PrintElement` variant.

- [ ] **Step 3: Restructure the `'line'` case** — split its existing 3-way branch (`y1===y2` / `x1===x2` / neither) into a `'line'` case that only handles the first two (axis-aligned), and a new `'diagonal'` case that emits exactly what the old "neither" branch emitted (`TSC_COMMAND.DIAGONAL ...`).

- [ ] **Step 4: Add the `SET CUTTER` constant(s) to `TscCommand.ts`**, then implement `case 'cut'` per spec: `'off'` → `SET CUTTER OFF`; `'full'`/`'partial'` → `SET CUTTER BATCH,<rows ?? 1>` (verify this exact command form against `TsplEncoder.ts`'s reference implementation from Step 1 — use its exact syntax, don't guess).

- [ ] **Step 5: Add `case 'pageBreak': case 'spacer': case 'row': case 'column': return '';`** (TSC's `compileElement` returns a string per line, so the no-op is an empty string filtered out or simply omitted — check how the existing `'raw'` case with empty content behaves and match that pattern so an empty line isn't spuriously inserted into the output).

- [ ] **Step 6: Add `case 'table'`** — real behavior per spec: call `formatTable()` from `../../receipt`, then emit each returned line as a `TSC_COMMAND.TEXT` command at `y + i * <line height>` (derive line height from a reasonable default font size in dots, consistent with how `compileTextElement`'s default font/size already work).

- [ ] **Step 7: Write the failing tests** (extend `TscCompiler.test.ts`, mirroring Task 3's ESC/POS test shapes but asserting on the TSC string output — e.g. `output.includes('SET CUTTER')`, `output.includes('hello')` for the table case, and that no-op elements produce identical output to an empty-elements document).

Run and verify FAIL then PASS.

- [ ] **Step 8: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root).

- [ ] **Step 9: Commit**

```bash
git add packages/printer-core/src/compiler/tsc
git commit -m "refactor: remove TscCompiler option casts, add cut/table/diagonal/no-op element handling"
```

---

### Task 5: Parsers — verify element construction against new precise types

**Files:**
- Modify (if needed — may require zero logic changes, only satisfy the type-checker): `packages/printer-core/src/parser/tsc/TscParser.ts`, `packages/printer-core/src/parser/escpos/EscPosParser.ts`
- Test: no new test files required unless a real bug surfaces (see Step 3)

**Interfaces:**
- Consumes: `PrintElement` (Task 1).
- Produces: unchanged — both parsers' `PrintElement[]` output shape is the same data, just now checked against precise types instead of the old loose union.

**Steps:**

- [ ] **Step 1: Read spec's "Consumers requiring updates" section's parser bullets.** `TscParser.ts` has 6 `elements.push({...})` call sites (2×`text`, `line`, `box`, `circle`, and the diagonal-producing one at the `DIAGONAL` command case — check whether that one should now push `{type:'diagonal', ...}` instead of `{type:'line', ...}`, since it's parsing an already-diagonal TSPL command, not a coordinate-derived one). `EscPosParser.ts` has 1 call site (`text`).

- [ ] **Step 2: Run `npm run type-check -w printer-core`** with Tasks 1-4 already merged into this branch — this surfaces every field mismatch directly as a compiler error at each `elements.push(...)` call site. Fix each one to match the new precise interface (add/rename/remove fields as the type error demands) — this should be almost entirely mechanical since the parsed data already corresponds to real TSPL/ESC-POS command parameters that match each `*Options` interface's fields.

- [ ] **Step 3: Specifically check the TSC `DIAGONAL` command's parser case** (the one currently pushing `{type: 'line', options: {x1,y1,x2,y2,thickness}}` for a `DIAGONAL` command per the earlier grep results) — since the source command is unambiguously a TSPL `DIAGONAL`, not a coordinate-inferred one, push `{type: 'diagonal', options: {...}}` instead, for consistency with how the compiler now distinguishes the two. This is a real (small) behavior improvement, not just a type fix — note it in your report.

- [ ] **Step 4: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root). If a genuine test failure surfaces (not just a type error) from Step 3's `DIAGONAL` fix, add/update the relevant `TscParser.test.ts` assertion to match the corrected behavior.

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/parser/tsc/TscParser.ts packages/printer-core/src/parser/escpos/EscPosParser.ts
# include packages/printer-core/src/parser/tsc/__tests__/TscParser.test.ts if Step 3 required a test update
git commit -m "fix: align parser element construction with redesigned PrintElement types"
```

---

### Task 6: TSC preview renderer — exhaustive switch over the new element types

**Files:**
- Modify: `packages/printer-core/src/preview/languages/TscPreviewRenderer.ts`
- Test: `packages/printer-core/src/preview/languages/__tests__/TscPreviewRenderer.test.ts` (new — this file has no existing test today; create one)

**Interfaces:**
- Consumes: `PrintElement` (Task 1, all 18 variants).
- Produces: no new exports — `TscPreviewRenderer.preview()`'s signature is unchanged, only its internal `renderElement()` switch gains cases.

**Note:** `preview/languages/EscPosPreviewRenderer.ts` needs NO changes — it already generically skips every non-`'text'` element (`if (element.type !== 'text') continue;`) rather than switching exhaustively, so the 7 new variants fall through the same skip with zero code changes. Confirmed by reading the file directly — do not add anything there.

**Steps:**

- [ ] **Step 1: Read the current `TscPreviewRenderer.ts` in full**, especially its `'line'` case (which currently has 3 branches: horizontal, vertical, and a diagonal `<line>` SVG fallback for neither) and the `'raw'`/`'barcode'`/`'qrcode'` group (already returns `''`, same pattern the 4 no-op cases below will follow).

- [ ] **Step 2: Split the `'line'` case's diagonal branch into a new `'diagonal'` case.** The existing code:
  ```typescript
  case 'line': {
    const o = element.options as unknown as LineOptions;
    const t = o.thickness ?? 1;
    if (o.y1 === o.y2) { /* horizontal rect */ }
    if (o.x1 === o.x2) { /* vertical rect */ }
    return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#000" stroke-width="${t}"/>`;
  }
  ```
  becomes a `'line'` case with only the horizontal/vertical branches (the third `return` line moves out), plus a new:
  ```typescript
  case 'diagonal': {
    const o = element.options;
    const t = o.thickness ?? 1;
    return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#000" stroke-width="${t}"/>`;
  }
  ```
  Remove the now-redundant `as unknown as LineOptions` cast in the remaining `'line'` case too (`element.options` is already precisely typed after Task 1).

- [ ] **Step 3: Add `case 'cut': case 'pageBreak': case 'spacer': case 'row': case 'column': return '';`** — none of these have a visual representation on the label itself (cut is a post-print printer action, the other 4 are documented no-ops in the compilers too, per the design spec) — group them with the existing `'raw'`/`'barcode'`/`'qrcode'` empty-string group, with a comment noting why (no visual representation, consistent with the compiler-level no-op decision).

- [ ] **Step 4: Add `case 'table'`** — render each of the table's rows as text, reusing the file's existing `tscFontSize()`/`tscCharWidth()` helpers the same way the `'text'` case does, at `y + i * <row height>` for row index `i` (row height = `tscFontSize(undefined, 1)`, i.e. the default font's height, since a table has no font option of its own). Call `formatTable()` from `../../receipt` to get the row strings (same function Task 4 uses in the real compiler), then emit one `<text>` element per line, left-aligned at `options.x`.

- [ ] **Step 5: Write the failing test** (`preview/languages/__tests__/TscPreviewRenderer.test.ts`, new file):

```typescript
import { TscPreviewRenderer } from '../TscPreviewRenderer';

describe('TscPreviewRenderer', () => {
  it('renders a <line> element for a diagonal, not a <rect>', () => {
    const svg = new TscPreviewRenderer().preview({
      widthDots: 400, heightDots: 300, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 0, copies: 1,
      elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 10, y2: 10 } }],
    });
    expect(svg).toContain('<line');
  });

  it('renders table row content as text', () => {
    const svg = new TscPreviewRenderer().preview({
      widthDots: 400, heightDots: 300, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 0, copies: 1,
      elements: [{ type: 'table', options: { x: 0, y: 0, columns: [{ width: 10 }], rows: [['hello']] } }],
    });
    expect(svg).toContain('hello');
  });

  it('renders nothing for cut/pageBreak/spacer/row/column', () => {
    const base = new TscPreviewRenderer().preview({
      widthDots: 400, heightDots: 300, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 0, copies: 1, elements: [],
    });
    for (const el of [{ type: 'cut' as const }, { type: 'pageBreak' as const }, { type: 'spacer' as const, options: { size: 5 } }, { type: 'row' as const, options: {} }, { type: 'column' as const, options: {} }]) {
      const svg = new TscPreviewRenderer().preview({
        widthDots: 400, heightDots: 300, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 0, copies: 1,
        elements: [el],
      });
      expect(svg).toBe(base);
    }
  });
});
```

Run and verify FAIL then PASS.

- [ ] **Step 6: Run full package verification.**

Run: `npm run type-check -w printer-core && npm test` (from repo root). Expect the 2 previously-reported `TscPreviewRenderer.ts` errors to be gone; other downstream errors (Task 5/7's territory) may still remain — that's expected per this plan's test-suite-green ruling (see the SDD ledger).

- [ ] **Step 7: Commit**

```bash
git add packages/printer-core/src/preview/languages/TscPreviewRenderer.ts packages/printer-core/src/preview/languages/__tests__/TscPreviewRenderer.test.ts
git commit -m "refactor: make TscPreviewRenderer exhaustive over the redesigned PrintElement union"
```

---

### Task 7: Whole-package sweep — fix remaining call sites, extend integration test

**Files:**
- Modify: any file `npm run type-check -w printer-core` still flags after Tasks 1-5 (expected candidates: test files across `builder/`, `compiler/`, `parser/`, `validation/`, `preview/`, `core/` that construct `PrintElement`/`ResolvedPrintDocument` literals by hand — grep for `type: '` object literals matching the 11 original variant names across `__tests__/` directories to find them before running type-check, so you're not surprised)
- Modify: `packages/printer-core/src/__tests__/phase1-integration.test.ts` (extend to exercise at least one of the 7 newly-wired element types end-to-end)
- Test: covered above

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: nothing new — this task's job is making the whole package compile and pass cleanly, and proving the new element types work end-to-end.

**Steps:**

- [ ] **Step 1: Run `npm run type-check -w printer-core` and `npm run type-check` (whole repo) from repo root.** List every error. Each one is a file constructing a `PrintElement`/`ResolvedPrintDocument` literal that no longer matches the new precise types (most likely in test files under `preview/`, `validation/`, `core/__tests__/LanguageDispatch.test.ts`, and any remaining `document/__tests__/` files).

- [ ] **Step 2: Fix each flagged file** — almost always this means adding the now-required `options` field where it was previously omitted (loose `Record<string, unknown>` allowed omitting it in some spots even where the real `*Options` shape would want it), or correcting a field name/type mismatch. Do not change test *intent* — only the literal's shape to satisfy the new type, unless a genuine bug in test data surfaces (note it if so).

- [ ] **Step 3: Extend `phase1-integration.test.ts`** to build a document exercising at least a `.cut()` and a `.table()` call (the 2 newly-real behaviors) alongside the existing `.text()`/`.barcode()`, compile it through both `EscPosCompiler` and `TscCompiler`, and assert both outputs contain evidence of the cut command and the table's row content (e.g. `bytes` contains the `GS V` sequence; the TSC string contains `SET CUTTER` and the table's cell text).

- [ ] **Step 4: Run the full verification suite one final time.**

Run (all from repo root): `npm run type-check -w printer-core`, `npm run type-check`, `npm test`, `npm run lint`. All must be clean — this is the acceptance gate for the whole plan.

- [ ] **Step 5: Commit**

```bash
git add -u packages/printer-core
git commit -m "test: fix element-literal type mismatches across the package, extend integration test for cut/table"
```

(Use `git add -u` here only since this task's edits are scattered and test-only across many files already tracked by git — no new untracked files should exist at this point; verify `git status` shows only modifications before committing, not new files, and if any new file appears, add it explicitly by name instead.)
