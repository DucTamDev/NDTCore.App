# printer-core element model redesign — design spec

## Motivation

`printer-core`'s Phase 1 port (see `2026-09-15-printer-core-portakal-mapping.md` and `2026-09-15-printer-core-port-phase1.md`) shipped `PrintElement` as a discriminated union where most variants carry `options: Record<string, unknown>` — a deliberately loose shape, bridged from the precise `*Options` interfaces (`TextOptions`, `BoxOptions`, ...) via a `toRecord()` cast in `PrintBuilder.ts`. Both compilers (`EscPosCompiler`, `TscCompiler`) then narrow it back with local `as XOptions` / `as unknown as XOptions` casts per switch case, and both parsers (`EscPosParser`, `TscParser`) construct `PrintElement` object literals by hand that structurally satisfy `Record<string, unknown>` without the compiler ever checking they match the field set a given element type actually expects.

User-proposed fix (approved 2026-09-15, mid-session): give every element variant its own named interface (`TextElement`, `BoxElement`, ...), union them into `PrintElement`, and move the whole file from `document/` to `builder/` (element construction is a builder concern). This removes every cast in the chain — `PrintBuilder`'s methods construct precisely-typed literals, compilers switch on `element.type` and get the exact options shape for free, parsers' hand-built literals get checked against the real interface instead of the wide `Record<string, unknown>`.

Separately, 7 element types were scaffolded in Phase 1 (`builder/layout/{Row,Column,Spacer,Table,PageBreak}Element.ts`, `builder/printer/CutElement.ts`, `builder/drawing/DiagonalElement.ts`) as `*Options`-only files with **no `PrintElement` variant and no `PrintBuilder` method** — verified against `2026-09-15-printer-core-portakal-mapping.md`: none of these have a portakal precedent (Row/Column/Spacer/Table/PageBreak are flagged NET-NEW — portakal has no layout-container concept at all; Cut is NET-NEW — no `.cut()` method or element variant in portakal, only known byte sequences; Diagonal is "ADAPT một phần" — a coordinate-based variant of Line, never a separate builder method). User decided (2026-09-15) to wire all 7 up now, in the same pass as the interface redesign, using the minimal design below.

## Scope

**In scope:**
1. Move `PrintElement` (redesigned) from `document/` to `builder/`.
2. One named interface per element type — 11 existing + 7 newly-wired = 18 variants total.
3. Remove `toRecord()` from `PrintBuilder.ts` and every `as *Options` / `as unknown as *Options` cast from `EscPosCompiler.ts` and `TscCompiler.ts`.
4. Update both parsers' hand-built element literals to satisfy the new precise types (should mostly just type-check already, given portakal's parse data already matches these field sets — verify per parser).
5. Wire the 7 orphaned types into `PrintElement` + `PrintBuilder` + both compilers, per the minimal design below.
6. `document/PrintElementType.ts` — currently dead code (zero references anywhere; `PrintElement.ts` hardcodes its own 11 literals independently, per the Phase 1 final review's Minor #10 finding). Re-derive as `export type PrintElementType = PrintElement['type'];` after the move, rather than deleting outright, since it's a cheap one-liner and something outside this package might reference it via the barrel.

**Explicitly out of scope:**
- `PrintDocument`'s own shape (flat `extends PrintDocumentOptions { width; height? }`) stays as-is. The user's original sketch proposed nesting it under `options` + adding an `elements` field, but `PrintDocument` is the builder's *constructor input* — elements don't exist yet at that point, they accumulate via chain calls afterward — so an `elements` field there doesn't fit its actual role. Not changed in this plan; revisit separately if still wanted, with a concrete shape.
- Real auto-layout computation for Row/Column (see below — explicitly deferred, not this task).
- Any change to `src/features/printer/` (untouched, as with all `printer-core` work so far).

## New `PrintElement` shape (`builder/PrintElement.ts`)

One interface per variant, each `{ type: "<tag>"; ...fields }`, unioned into `PrintElement`. Field shapes below mirror each type's existing `*Options` interface (content/drawing element files already define these — read them directly rather than re-deriving) with one exception: `options` becomes non-optional wherever the existing builder method today requires the options object as a mandatory parameter (e.g. `.box(options: BoxOptions)` has no default), and stays optional (`options?: XOptions`) wherever the current method already defaults it (e.g. `.text(content, options: TextOptions = {})`).

**11 existing (restructured, no behavior change):**
- `TextElement { type: 'text'; content: string; options?: TextOptions }`
- `ImageElement { type: 'image'; bitmap: Bitmap; options?: ImageOptions }`
- `BarcodeElement { type: 'barcode'; options: BarcodeConfig }`
- `QrCodeElement { type: 'qrcode'; options: QrCodeConfig }`
- `BoxElement { type: 'box'; options: BoxOptions }`
- `LineElement { type: 'line'; options: LineOptions }`
- `CircleElement { type: 'circle'; options: CircleOptions }`
- `EllipseElement { type: 'ellipse'; options: EllipseOptions }`
- `ReverseElement { type: 'reverse'; options: ReverseOptions }`
- `EraseElement { type: 'erase'; options: EraseOptions }`
- `RawElement { type: 'raw'; content: string | Uint8Array }`

**7 newly-wired (net-new behavior — no portakal precedent, see Motivation):**
- `DiagonalElement { type: 'diagonal'; options: LineOptions }` — reuses `LineOptions` verbatim (a diagonal is a line with `x1≠x2 && y1≠y2`, not a different parameter shape). **No new `.diagonal()` builder method.** `PrintBuilder.line(options: LineOptions)` itself decides which variant to push, using the existing `isDiagonal()` predicate from `builder/drawing/DiagonalElement.ts`:
  ```ts
  line(options: LineOptions): this {
    this.elements.push(isDiagonal(options) ? { type: 'diagonal', options } : { type: 'line', options });
    return this;
  }
  ```
  Compilers: `TscCompiler`'s `compileElement`'s existing `'line'` case already branches internally on `o.y1 === o.y2` / `o.x1 === o.x2` / neither (the "neither" branch already emits `TSC_COMMAND.DIAGONAL`) — this logic moves to being selected by `element.type` instead (a `'line'` case that only ever sees axis-aligned lines, plus a new `'diagonal'` case reusing the same diagonal-emission line). `EscPosCompiler` gets a new `case 'diagonal': return [];` alongside its existing no-op cases (no native diagonal-drawing command, same as box/line/circle/ellipse today).
- `CutElement { type: 'cut'; options?: CutOptions }` — real behavior. `CutOptions` already exists (`builder/printer/CutElement.ts`): `{ rows?: number; mode?: 'off' | 'partial' | 'full' }`. New `PrintBuilder.cut(options: CutOptions = {}): this` method.
  - `EscPosCompiler`: emit `GS V m [n]` (`ESC_POS.CUT` — add this constant to `EscPosCommand.ts`) — `mode: 'full'` → `m=0` (full cut, no feed), `'partial'` → `m=1` (partial cut), `'off'` → no bytes emitted at all (explicit no-op, distinct from omitting the element); when `rows` is given, use the `GS V m n` form (feed `n` lines before cutting) per the ESC/POS spec.
  - `TscCompiler`: emit `SET CUTTER` per mode — `'off'` → `SET CUTTER OFF`, `'full'`/`'partial'` → `SET CUTTER BATCH,<rows ?? 1>` (TSPL2's cutter-after-N-labels form; use this repo's own `src/features/printer/drivers/tspl/TsplEncoder.ts`'s `cut()` method as a reference for the exact command grammar and the "persistent setting, must be explicitly turned off" behavior it already documents — read-only reference, don't copy its unrelated logic). Add the `SET CUTTER`-family constant(s) to `TscCommand.ts`.
- `TableElement { type: 'table'; options: TableOptions }` — real behavior. `TableOptions` already exists (`builder/layout/TableElement.ts`): `TableOptions extends Point { columns: ReceiptColumn[]; rows: string[][] }`. New `PrintBuilder.table(options: TableOptions): this` method.
  - Both compilers: call `formatTable(options.columns, options.rows, <total width>)` from `receipt/TableFormatter.ts` (already built, Task 5) to get an array of formatted line strings, then emit each line the same way a `TextElement` at that line's y-position would be emitted (incrementing y by one line-height per row — use a fixed row height in dots derived from font size, consistent with how `TextElement`'s font/size fields already work) — `<total width>` derives from `options.columns` summed widths (already how `ReceiptColumn.width` works, no new field needed).
- `PageBreakElement { type: 'pageBreak' }` (no options — empty marker). New `PrintBuilder.pageBreak(): this`.
- `SpacerElement { type: 'spacer'; options: SpacerOptions }`. `SpacerOptions` already exists (`builder/layout/SpacerElement.ts`): `{ size: number; unit?: Unit }`. New `PrintBuilder.spacer(options: SpacerOptions): this`.
- `RowElement { type: 'row'; options: RowOptions }` / `ColumnElement { type: 'column'; options: ColumnOptions }`. Options already exist (`builder/layout/{Row,Column}Element.ts`): `{ gap?: number } & Point`. New `PrintBuilder.row(options: RowOptions = {}): this` / `.column(options: ColumnOptions = {}): this`.

**PageBreak/Spacer/Row/Column compiler behavior — documented no-op, same precedent as ESC/POS's box/line/circle/ellipse today:** neither protocol has a native "insert a page break," "advance the cursor by N dots," or "lay out children in a row/column" primitive, and this package has no auto-layout engine (every other element already uses explicit absolute x/y — Row/Column implying computed child positions would require building one, a substantially bigger feature than wiring a type). Both compilers get a `case 'pageBreak': case 'spacer': case 'row': case 'column': return [];` (ESC/POS) / `return '';` (TSC), each with a one-line comment stating this is a placeholder pending a real auto-layout design — not a bug, a documented scope boundary matching how box/line/etc. are already handled on ESC/POS.

## Consumers requiring updates (mapped from the current tree, 2026-09-15)

- `builder/PrintBuilder.ts` — remove `toRecord()`, add 7 new methods, change `.line()`'s dispatch per Diagonal above.
- `builder/LabelBuilder.ts`, `builder/ReceiptBuilder.ts` — import `PrintElement`/`ResolvedPrintDocument` from `../document` still for `ResolvedPrintDocument` (unmoved) but `PrintElement` now from `./PrintElement` (same directory, no longer `../document`).
- `document/PrintElement.ts` — deleted (moved).
- `document/PrintElementType.ts` — re-derived from the moved type (see Scope above); `document/index.ts` barrel keeps re-exporting it (now via `../builder` re-export or a thin re-export file — implementer's call on the cleanest wiring, document in the task report).
- `document/ResolvedPrintDocument.ts` — stays in `document/` (it's a resolved *document*, not an element construction concern), but its `elements: PrintElement[]` field now imports `PrintElement` from `../builder` instead of `./PrintElement` — check this doesn't create an import cycle (`builder/` already imports several `document/` types like `PrintDocumentOptions`/`ResolvedPrintDocument`/`Direction`; `document/ResolvedPrintDocument.ts` importing back from `builder/` would be a real cycle — resolve by keeping `ResolvedPrintDocument`'s `PrintElement` import as `import type` only, which TypeScript erases, same pattern already verified safe for `core/`'s back-edges into `compiler/`/`parser/`/`validation/`/`preview/` per the Phase 1 final review).
- `compiler/escpos/EscPosCompiler.ts` — remove all `as *Options` casts, add `case 'diagonal'` (no-op) and the 6 other new no-op/real cases, add `CutElement` handling.
- `compiler/tsc/TscCompiler.ts` — remove all `as unknown as *Options` casts, restructure the `'line'` case's diagonal branch into a separate `'diagonal'` case, add `CutElement`/`TableElement` real handling and the 4 no-op cases.
- `compiler/escpos/EscPosCommand.ts` — add the `GS V` (cut) byte constant(s).
- `compiler/tsc/TscCommand.ts` — add the `SET CUTTER` command string constant(s).
- `parser/tsc/TscParser.ts` — its hand-built `elements.push({...})` literals (7 call sites found: text ×2, line, box, circle, ellipse/diagonal) must satisfy the new precise interfaces — check each against the new shapes; TSC's parser never produces `barcode`/`qrcode`/`cut`/`table`/etc. elements today (it doesn't parse those commands into elements, only into raw `commands[]`), so no new cases needed there, just verify the existing 6 still type-check.
- `parser/escpos/EscPosParser.ts` — same check, 1 call site found (`text`).
- Every test file constructing `PrintElement`/`ResolvedPrintDocument` literals by hand (Task 1/4/7/8/9's test suites — grep for `type: '<variant>'` object literals) — these will mostly just keep working since they already match the field sets structurally, but must be re-verified against the new precise types, not assumed.

## Self-review

- Placeholder scan: none — every decision above is either a concrete implementation instruction or an explicitly-scoped-out item with a stated reason.
- Internal consistency: `.line()`'s dispatch logic is specified once (here) and referenced, not duplicated with conflicting details, across the compiler sections.
- Ambiguity check: the one genuine ambiguity found (`PrintDocument`'s shape) is resolved by scoping it out rather than guessing.
