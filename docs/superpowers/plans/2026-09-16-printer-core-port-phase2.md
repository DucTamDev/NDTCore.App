# printer-core Port — Phase 2 (remaining 7 languages + convert/profile/transport/testing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the `printer-core` port started in Phase 1. Port the remaining 7 printer languages (ZPL, EPL, CPCL, DPL, SBPL, Star PRNT, IPL — each compiler+parser+validator+preview), the cross-compiler (`convert/`), the remaining 6 vendor profile files' real data, `transport/`'s interfaces, and `testing/`'s helpers. After this plan, `printer-core` fully mirrors portakal's functional surface for all 9 printer languages.

**Architecture:** Same package, same conventions as Phase 1 (`packages/printer-core`, framework-agnostic TypeScript, no I/O). This plan's branch builds directly on `feature/printer-core-port-phase1` (already merged the element-model refactor) — no need to wait for that PR to merge into `main` first.

**Tech Stack:** Same as Phase 1 — TypeScript strict, Jest via root config, `tsc --noEmit`, ESLint via root config.

**Spec:** `docs/superpowers/specs/2026-09-15-printer-core-portakal-mapping.md` — the full source-to-destination mapping, covering every language. **Every task below cites that spec's tables plus exact `portakal/src/*.ts` file+line ranges — read both before starting a task, and independently re-verify exact line numbers against the live portakal source rather than trusting any line number quoted here or in the spec at face value (portakal doesn't change, but re-verification catches transcription slips).**

**The single most valuable reference for every task in this plan is Phase 1's own finished work, now merged into this branch:**
- `packages/printer-core/src/compiler/escpos/EscPosCompiler.ts` + `EscPosCommand.ts` — structural template for a compiler.
- `packages/printer-core/src/compiler/tsc/TscCompiler.ts` + `TscCommand.ts` + `TscEncoder.ts` — structural template for a second, differently-shaped compiler (including the barcode/qrcode/cut/table/diagonal/no-op element cases every language's compiler must also handle, per `builder/PrintElement.ts`'s 18-variant union).
- `packages/printer-core/src/parser/escpos/EscPosParser.ts`, `packages/printer-core/src/parser/tsc/TscParser.ts` — structural templates for parsers (note: TSC's is the largest and most grammar-heavy; most of the remaining 7 languages' parsers are smaller).
- `packages/printer-core/src/validation/escpos/EscPosValidator.ts` — structural template for a **net-new** validator (portakal has no real ESC/POS validation logic; this file's real, useful checks — not a stub — are the precedent to follow for the 6 languages below that are similarly net-new in portakal).
- `packages/printer-core/src/preview/languages/EscPosPreviewRenderer.ts`, `packages/printer-core/src/preview/languages/TscPreviewRenderer.ts` — structural templates for preview renderers, including the exhaustive-switch-over-`PrintElement` pattern and its no-op cases for the 7 element types with no visual representation.
- `packages/printer-core/src/core/LanguageDispatch.ts` — the dispatch registry every new language's compiler/parser/validator/preview class must be wired into (see Task 8's note on keeping this current as each language lands, or Task 12's final sweep if a task misses it).

**Read these structural templates FIRST in every task, then read the spec's per-language table for what's actually different about this specific language's grammar/commands.**

## Global Constraints

- Framework-agnostic: no `react-native` import anywhere in `packages/printer-core/src/`.
- TypeScript strict, no `any` anywhere.
- No path aliases — relative imports only.
- Comments only when WHY isn't obvious — do not port portakal's own comments verbatim (this exact issue caused real fix rounds in Phase 1 — grep your own diff against the cited portakal source before reporting done).
- Tests: Jest, `__tests__/` sibling folders, run via root `npm test`.
- Type-check: `npm run type-check -w printer-core` AND root `npm run type-check` must both stay clean after every task (each task in THIS plan is self-contained — one language's compiler/parser/validator/preview, or one of convert/profile/transport/testing — so unlike Phase 1's foundational tasks, every task here CAN and MUST leave the whole suite green; there is no cross-cutting-breakage exception this time).
- Lint: root `npm run lint` must stay clean after every task.
- Do not modify `src/features/printer/` or any file outside `packages/printer-core/`.
- Portakal source at `C:\NDTCORE\NDTCore\portakal\src\` is read-only reference — never edit it.
- **Fix known portakal bugs during port, do not copy them as-is** (flagged per-task below): EPL/DPL/IPL's image compilers emit a bitmap header with no pixel payload (same class of bug Phase 1 fixed for TSC — apply the same fix approach: real payload bytes, not a bare trailing comma/incomplete header).
- **Net-new validators (6 of the 7 languages in this plan) should have real, useful checks, not a bare stub.** Portakal itself only has real validation logic for TSC and ZPL (`validate.ts`'s `validateTSC()`/`validateZPL()`); the other languages get a generic "validation is basic" info message in portakal. Follow Phase 1's `EscPosValidator.ts` precedent instead (also net-new in portakal) — a handful of real, protocol-specific structural checks (malformed/truncated commands, out-of-range parameters), not a stub. Exact checks are each task's own judgment call, informed by that language's actual command grammar (visible in its parser).
- Every language's compiler must handle all 18 `PrintElement` variants (see `builder/PrintElement.ts`) — including the 7 wired up in the post-Phase-1 element-model refactor (`diagonal`, `cut`, `table`, `pageBreak`, `spacer`, `row`, `column`). None of these have portakal precedent for the 7 new languages either (same as ESC/POS and TSC) — follow the same per-language judgment Phase 1's Tasks 3/4 used: real behavior for `cut`/`table` where the language has a sensible native command, documented no-ops for the rest where no auto-layout engine exists. If a language's protocol has no cutter command at all, `cut` is itself a documented no-op — check the language's actual command set before assuming a `cut` command exists to port.
- Every language's `table` element case must validate columns the same way Phase 1's fix did — call `validateTableColumns()` from `packages/printer-core/src/receipt/validateTableColumns.ts` (already built, do not reinvent) before calling `formatTable()`.

---

### Task 1: ZPL — compiler, parser, validator, preview

**Files:**
- Modify (fill in): `packages/printer-core/src/compiler/zpl/ZplCommand.ts`, `ZplCompiler.ts`, `ZplEncoder.ts`
- Modify (fill in): `packages/printer-core/src/parser/zpl/ZplParser.ts`
- Modify (fill in): `packages/printer-core/src/validation/zpl/ZplValidator.ts`
- Modify (fill in): `packages/printer-core/src/preview/languages/ZplPreviewRenderer.ts`
- Modify: `packages/printer-core/src/core/LanguageDispatch.ts` (wire `'zpl'` into all 4 dispatch functions, replacing its current `UnsupportedLanguageError` throw)
- Test: `packages/printer-core/src/compiler/zpl/__tests__/ZplCompiler.test.ts`, `packages/printer-core/src/parser/zpl/__tests__/ZplParser.test.ts`, `packages/printer-core/src/validation/zpl/__tests__/ZplValidator.test.ts`, `packages/printer-core/src/preview/languages/__tests__/ZplPreviewRenderer.test.ts`

**Interfaces:**
- Consumes: `ResolvedPrintDocument`/`PrintElement` (`document`/`builder`), `PrinterProfile` (`profile`), `PrintCompiler`/`PrintParser`/`PrintValidation`/`PrintPreview` (`core`), `BarcodeConfig`/`QrCodeConfig` (`barcode`/`qrcode`), `formatTable`/`validateTableColumns` (`receipt`) — all already built and stable.
- Produces: `class ZplCompiler implements PrintCompiler<string>`; `class ZplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }>`; `class ZplValidator implements PrintValidation`; `class ZplPreviewRenderer implements PrintPreview`.

**Steps:**

- [ ] **Step 1: Read the structural templates** (`TscCompiler.ts`/`TscCommand.ts`, `TscParser.ts`, `EscPosValidator.ts`, `TscPreviewRenderer.ts` — ZPL is a text-based, line-oriented protocol like TSC, so TSC's templates are the closer structural match) and the spec's `compiler/`/`parser/`/`preview/`/`validation/` tables for ZPL, plus the cited portakal sources in full: `portakal/src/languages/zpl.ts`, `portakal/parsers/zpl.ts` (676 lines — the second-largest parser after TSC's), `portakal/src/lang/zpl.ts` (has its own `ZplPreviewRenderer` per the spec — including its notable "scrape `^BY`/`^FO`/`^B*`/`^FD` back out of raw ZPL via regex for the `raw`-tagged barcode placeholder" logic, worth reading carefully), `portakal/src/validate.ts` (`validateZPL()`, real logic — port it directly, this is one of only 2 languages in all of portakal with genuine validation logic).

- [ ] **Step 2: Implement `ZplCommand.ts`** — extract ZPL's command-prefix constants (`^XA`/`^XZ`/`^FO`/`^FD`/`^GB`/etc.) from `languages/zpl.ts`, matching the extraction-not-new-logic pattern `TscCommand.ts` and `EscPosCommand.ts` already established.

- [ ] **Step 3: Implement `ZplCompiler.ts`** — port `compileToZPL()`'s `compileElement()` switch directly for the 11 original element types (text/image/box/line/circle/ellipse/reverse/erase/raw/barcode/qrcode — barcode/qrcode are net-new here too, same approach Phase 1's Tasks 3/4 used: derive the command format from `parsers/zpl.ts`'s `^B*`-family decode logic as ground truth, matching this plan's Global Constraints instruction). Add the 7 newly-wired element types per the Global Constraints note above — ZPL has cutter support in some models via `~JC`/similar; check `languages/zpl.ts` and the parser for any cutter-related command before deciding `cut` is a no-op or real.

- [ ] **Step 4: Write the failing tests** for `ZplCompiler.ts` — at minimum: a text element compiles to `^FO`/`^FD` correctly; a barcode element round-trips through `ZplParser` (once Step 6 exists — order your TDD within this task so the round-trip test comes after the parser is real); the table element renders via `formatTable()`; at least 2 of the no-op element types produce identical output to an empty-elements document.

Run and verify FAIL then PASS.

- [ ] **Step 5: Implement `ZplEncoder.ts`** — port the image case (`languages/zpl.ts`'s hex-encoding into `^GFA,...` — flagged in the spec as "HOẠT ĐỘNG ĐÚNG", a correct, direct port, no bug fix needed here unlike EPL/DPL/IPL in later tasks).

- [ ] **Step 6: Implement `ZplParser.ts`** — port `tokenize()` + `parseZPL()` in full (676 lines) from `parsers/zpl.ts`, keeping the exact grammar.

- [ ] **Step 7: Write the failing test for the parser**, then run and verify FAIL then PASS.

- [ ] **Step 8: Implement `ZplValidator.ts`** — port `validateZPL()` directly from `portakal/src/validate.ts` (real logic: `^XA` first, `^XZ` last, `^FD` without `^FO` warning, `^PW` range check, forward warnings from the parser).

- [ ] **Step 9: Write the failing tests for the validator** (at least the happy path plus 2-3 real negative-path branches, matching Phase 1's `TscValidator.test.ts` coverage depth as the bar to clear), then run and verify FAIL then PASS.

- [ ] **Step 10: Implement `ZplPreviewRenderer.ts`** — port `ZPL_FONTS`/`isProportionalFont()`/`zplFontSize()`/`zplBaselineRatio()`/`zplFontFamily()`/`renderElement()`/`renderPreviewSVG()` from `portakal/src/lang/zpl.ts`. Handle all 18 `PrintElement` variants exhaustively (no `default` case — let the switch's own exhaustiveness checking catch a missed variant, matching `TscPreviewRenderer.ts`'s pattern).

- [ ] **Step 11: Write the failing test for the preview renderer**, then run and verify FAIL then PASS.

- [ ] **Step 12: Wire `'zpl'` into `core/LanguageDispatch.ts`** — replace its current unsupported-language throw for `'zpl'` with real dispatch to `ZplCompiler`/`ZplParser`/`ZplValidator`/`ZplPreviewRenderer`, matching how `'escpos'`/`'tsc'` are already wired. Add or extend `LanguageDispatch.test.ts` to cover the new `'zpl'` route.

- [ ] **Step 13: Run full package verification.**

Run: `npm run type-check -w printer-core && npm run type-check && npm test && npm run lint` (all from repo root). All must be clean.

- [ ] **Step 14: Commit**

```bash
git add packages/printer-core/src/compiler/zpl packages/printer-core/src/parser/zpl packages/printer-core/src/validation/zpl packages/printer-core/src/preview/languages/ZplPreviewRenderer.ts packages/printer-core/src/preview/languages/__tests__/ZplPreviewRenderer.test.ts packages/printer-core/src/core/LanguageDispatch.ts packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
git commit -m "feat: port printer-core ZPL compiler+parser+validator+preview, wire into dispatch"
```

---

### Task 2: EPL — compiler, parser, validator, preview (+ image payload bug fix)

**Files:**
- Modify (fill in): `packages/printer-core/src/compiler/epl/EplCommand.ts`, `EplCompiler.ts`, `EplEncoder.ts`
- Modify (fill in): `packages/printer-core/src/parser/epl/EplParser.ts`
- Modify (fill in): `packages/printer-core/src/validation/epl/EplValidator.ts`
- Modify (fill in): `packages/printer-core/src/preview/languages/EplPreviewRenderer.ts`
- Modify: `packages/printer-core/src/core/LanguageDispatch.ts` (wire `'epl'`)
- Test: mirroring Task 1's test file list, for EPL.

**Interfaces:** Same shape as Task 1, for EPL.

**Steps:**

- [ ] **Step 1: Read the structural templates** (same as Task 1) and the spec's tables for EPL, plus `portakal/src/languages/epl.ts`, `portakal/parsers/epl.ts`, `portakal/src/lang/epl.ts` (has its own preview renderer — note the spec's finding that circle/ellipse/reverse/erase/image/raw all render as EMPTY STRING in portakal's own EPL preview, i.e. genuinely unimplemented upstream, not a bug in the port — port what exists, don't invent rendering for what portakal itself never implemented).

- [ ] **Step 2: Implement `EplCommand.ts`, `EplCompiler.ts`** — port the compile logic directly for the working element cases.

- [ ] **Step 3: Implement `EplEncoder.ts` — WITH THE REQUIRED BUG FIX.** Portakal's EPL image case (`languages/epl.ts`) only emits the `GW x,y,bytesPerRow,height` header with no pixel payload appended — same class of bug Phase 1 fixed for TSC (`TscEncoder.ts`'s `encodeTscBitmapPayload()` is your direct structural reference for how to do this correctly: append `bitmap.data` as the command's binary payload, not leave a dangling incomplete command). Read EPL2's `GW` command format (check this app's read-only reference `src/features/printer/drivers/tspl/TsplEncoder.ts` only if it happens to also document EPL — it may not, since this app only speaks TSPL/ESC-POS; if no reference exists, derive the payload convention from EPL2's documented `GW` command semantics — raw binary bytes immediately following the header, same general shape as TSPL's `BITMAP`). Write a test proving the payload is present (mirroring `TscCompiler.test.ts`'s bitmap-payload test), not just a longer header string.

- [ ] **Step 4: Write the failing tests for the compiler**, run and verify FAIL then PASS.

- [ ] **Step 5: Implement `EplParser.ts`** — port `parseEPL()` directly.

- [ ] **Step 6: Write the failing test for the parser**, run and verify FAIL then PASS.

- [ ] **Step 7: Implement `EplValidator.ts`** — net-new (portakal has no real EPL validation), follow the `EscPosValidator.ts` precedent per Global Constraints.

- [ ] **Step 8: Write the failing tests for the validator**, run and verify FAIL then PASS.

- [ ] **Step 9: Implement `EplPreviewRenderer.ts`** — port `EPL_FONTS`/`eplFontSize()`/`eplCharWidth()`/`renderElement()`/`renderPreviewSVG()` from `portakal/src/lang/epl.ts`, preserving the "several cases return empty string" limitation exactly as portakal has it (don't silently upgrade it — that's out of scope for a port task; note it in your report if you want to flag it as a future enhancement).

- [ ] **Step 10: Write the failing test for the preview renderer**, run and verify FAIL then PASS.

- [ ] **Step 11: Wire `'epl'` into `core/LanguageDispatch.ts`**, extend its test.

- [ ] **Step 12: Run full package verification** (same 4 commands as Task 1, all from repo root).

- [ ] **Step 13: Commit**

```bash
git add packages/printer-core/src/compiler/epl packages/printer-core/src/parser/epl packages/printer-core/src/validation/epl packages/printer-core/src/preview/languages/EplPreviewRenderer.ts packages/printer-core/src/preview/languages/__tests__/EplPreviewRenderer.test.ts packages/printer-core/src/core/LanguageDispatch.ts packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
git commit -m "feat: port printer-core EPL compiler+parser+validator+preview, fix image payload bug, wire into dispatch"
```

---

### Task 3: CPCL — compiler, parser, validator, preview

**Files:** Same shape as Task 1, for CPCL (`compiler/cpcl/`, `parser/cpcl/`, `validation/cpcl/`, `preview/languages/CpclPreviewRenderer.ts`).

**Interfaces:** Same shape as Task 1, for CPCL.

**Steps:**

- [ ] **Step 1: Read the structural templates and the spec's tables for CPCL**, plus `portakal/src/languages/cpcl.ts`, `portakal/parsers/cpcl.ts` (note the spec's finding: CPCL's parser has a comment at its own line ~101 noting "BARCODE, EG, CG, PRINT... recognized but no preview" — a portakal-native limitation, not a port bug), `portakal/src/lang/cpcl.ts` (has its own preview renderer — note per the spec only text/box/line are implemented there, everything else `default: return ""`, same "port what exists" instruction as Task 2's EPL preview).

- [ ] **Step 2: Implement `CpclCommand.ts`, `CpclCompiler.ts`, `CpclEncoder.ts`** — the image case here is flagged "HOẠT ĐỘNG ĐÚNG" (hex-encodes into the `EG` command) — a correct, direct port, no bug fix needed.

- [ ] **Step 3: Write the failing tests for the compiler**, run and verify FAIL then PASS.

- [ ] **Step 4: Implement `CpclParser.ts`** — port `parseCPCL()` directly.

- [ ] **Step 5: Write the failing test for the parser**, run and verify FAIL then PASS.

- [ ] **Step 6: Implement `CpclValidator.ts`** — net-new, follow `EscPosValidator.ts` precedent.

- [ ] **Step 7: Write the failing tests for the validator**, run and verify FAIL then PASS.

- [ ] **Step 8: Implement `CpclPreviewRenderer.ts`** — port `CPCL_FONTS`/`cpclFontSize()`/`renderElement()`/`renderPreviewSVG()` from `portakal/src/lang/cpcl.ts`, preserving the text/box/line-only limitation exactly as portakal has it.

- [ ] **Step 9: Write the failing test for the preview renderer**, run and verify FAIL then PASS.

- [ ] **Step 10: Wire `'cpcl'` into `core/LanguageDispatch.ts`**, extend its test.

- [ ] **Step 11: Run full package verification.**

- [ ] **Step 12: Commit**

```bash
git add packages/printer-core/src/compiler/cpcl packages/printer-core/src/parser/cpcl packages/printer-core/src/validation/cpcl packages/printer-core/src/preview/languages/CpclPreviewRenderer.ts packages/printer-core/src/preview/languages/__tests__/CpclPreviewRenderer.test.ts packages/printer-core/src/core/LanguageDispatch.ts packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
git commit -m "feat: port printer-core CPCL compiler+parser+validator+preview, wire into dispatch"
```

---

### Task 4: DPL — compiler, parser, validator, preview (+ image payload bug fix, + shared PreviewRenderer)

**Files:**
- Modify (fill in): `packages/printer-core/src/compiler/dpl/DplCommand.ts`, `DplCompiler.ts`, `DplEncoder.ts`
- Modify (fill in): `packages/printer-core/src/parser/dpl/DplParser.ts`
- Modify (fill in): `packages/printer-core/src/validation/dpl/DplValidator.ts`
- Modify (fill in): `packages/printer-core/src/preview/PreviewRenderer.ts` (the SHARED default renderer — see below), `packages/printer-core/src/preview/languages/DplPreviewRenderer.ts`
- Modify: `packages/printer-core/src/core/LanguageDispatch.ts` (wire `'dpl'`)
- Test: mirroring Task 1's list, for DPL, plus `packages/printer-core/src/preview/__tests__/PreviewRenderer.test.ts` (new — no test exists for the shared renderer yet since Phase 1 never touched this file).

**Interfaces:**
- Same shape as Task 1, for DPL, PLUS: `packages/printer-core/src/preview/PreviewRenderer.ts` produces `function renderPreview(document: ResolvedPrintDocument): string` (the shared default SVG renderer every one of DPL/SBPL/IPL's own `{Lang}PreviewRenderer.ts` delegates to, per the spec's finding that portakal's `lang/dpl.ts`/`lang/sbpl.ts`/`lang/ipl.ts` never define their own renderer — they call the one shared `renderPreview()` from `src/preview.ts` directly).

**Steps:**

- [ ] **Step 1: Read the structural templates and the spec's tables for DPL**, plus `portakal/src/languages/dpl.ts`, `portakal/parsers/dpl.ts` (the spec flags this parser's label-record parsing as "best-effort" — content recovered via a hardcoded `slice(20)` offset guess, fragile even in portakal itself; port it faithfully, don't try to make it more robust than the source — that's out of scope), and `portakal/src/preview.ts` in full (`renderPreview()` + `renderElement()`, ~180 lines — this is the ONE default renderer 3 of your remaining languages share; you're porting it now because DPL is the first of the 3 to need it).

- [ ] **Step 2: Implement `preview/PreviewRenderer.ts`** — port `renderPreview()` + `renderElement()` directly from `portakal/src/preview.ts`. This is a plain function-based SVG renderer (template-literal string building, same style as `TscPreviewRenderer.ts`/`EscPosPreviewRenderer.ts` — no object-model wrapper needed; `preview/SvgDocument.ts`/`preview/SvgElement.ts`/`preview/PreviewResult.ts` remain placeholders, out of scope for this plan per the original mapping spec's net-new notes — do not populate them). It must handle all 18 `PrintElement` variants (including the 7 newly-wired ones) — since portakal's own `renderElement()` only knows the original 11, extend it here the same way `TscPreviewRenderer.ts` was extended in the post-Phase-1 refactor (no-op for pageBreak/spacer/row/column/cut, table via `formatTable()`, diagonal as its own case).

- [ ] **Step 3: Write the failing test for the shared renderer** (`preview/__tests__/PreviewRenderer.test.ts`) — at minimum a text element and a box element render to non-empty SVG containing recognizable content, and the 5 no-op element types produce output identical to an empty-elements baseline (same assertion style as `TscPreviewRenderer.test.ts`'s no-op tests).

Run and verify FAIL then PASS.

- [ ] **Step 4: Implement `DplCommand.ts`, `DplCompiler.ts` for the working element cases.**

- [ ] **Step 5: Implement `DplEncoder.ts` — WITH THE REQUIRED BUG FIX.** Portakal's DPL image case (`languages/dpl.ts`) emits a fixed header `1{col}{row}{h}{w}0005` with no bitmap payload appended — same bug class as EPL (Task 2) and Phase 1's TSC fix. Apply the same fix approach: append real payload bytes. Write a test proving it.

- [ ] **Step 6: Write the failing tests for the compiler**, run and verify FAIL then PASS.

- [ ] **Step 7: Implement `DplParser.ts`** — port `parseDPL()` directly, preserving the best-effort label-record parsing exactly.

- [ ] **Step 8: Write the failing test for the parser**, run and verify FAIL then PASS.

- [ ] **Step 9: Implement `DplValidator.ts`** — net-new, follow `EscPosValidator.ts` precedent.

- [ ] **Step 10: Write the failing tests for the validator**, run and verify FAIL then PASS.

- [ ] **Step 11: Implement `DplPreviewRenderer.ts`** — thin wrapper delegating to `preview/PreviewRenderer.ts`'s `renderPreview()` (matching how portakal's `lang/dpl.ts` just calls the shared renderer with no DPL-specific customization).

- [ ] **Step 12: Write the failing test for the preview renderer**, run and verify FAIL then PASS.

- [ ] **Step 13: Wire `'dpl'` into `core/LanguageDispatch.ts`**, extend its test.

- [ ] **Step 14: Run full package verification.**

- [ ] **Step 15: Commit**

```bash
git add packages/printer-core/src/compiler/dpl packages/printer-core/src/parser/dpl packages/printer-core/src/validation/dpl packages/printer-core/src/preview/PreviewRenderer.ts packages/printer-core/src/preview/__tests__/PreviewRenderer.test.ts packages/printer-core/src/preview/languages/DplPreviewRenderer.ts packages/printer-core/src/preview/languages/__tests__/DplPreviewRenderer.test.ts packages/printer-core/src/core/LanguageDispatch.ts packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
git commit -m "feat: port printer-core DPL compiler+parser+validator+preview, port shared PreviewRenderer, fix image payload bug"
```

---

### Task 5: SBPL — compiler, parser, validator, preview

**Files:** Same shape as Task 1, for SBPL (`compiler/sbpl/`, `parser/sbpl/`, `validation/sbpl/`, `preview/languages/SbplPreviewRenderer.ts` — this one delegates to the now-real `preview/PreviewRenderer.ts` from Task 4, same pattern as `DplPreviewRenderer.ts`).

**Interfaces:** Same shape as Task 1, for SBPL.

**Steps:**

- [ ] **Step 1: Read the structural templates and the spec's tables for SBPL**, plus `portakal/src/languages/sbpl.ts`, `portakal/parsers/sbpl.ts`.

- [ ] **Step 2: Implement `SbplCommand.ts`, `SbplCompiler.ts`, `SbplEncoder.ts`** — the image case here is flagged "HOẠT ĐỘNG ĐÚNG" (hex-encodes into `ESC GM size,hex`) — correct, direct port, no bug fix needed.

- [ ] **Step 3: Write the failing tests for the compiler**, run and verify FAIL then PASS.

- [ ] **Step 4: Implement `SbplParser.ts`** — port `parseSBPL()` directly.

- [ ] **Step 5: Write the failing test for the parser**, run and verify FAIL then PASS.

- [ ] **Step 6: Implement `SbplValidator.ts`** — net-new, follow `EscPosValidator.ts` precedent.

- [ ] **Step 7: Write the failing tests for the validator**, run and verify FAIL then PASS.

- [ ] **Step 8: Implement `SbplPreviewRenderer.ts`** — thin wrapper delegating to `preview/PreviewRenderer.ts`'s `renderPreview()` (already real, from Task 4 — do not re-implement it).

- [ ] **Step 9: Write the failing test for the preview renderer**, run and verify FAIL then PASS.

- [ ] **Step 10: Wire `'sbpl'` into `core/LanguageDispatch.ts`**, extend its test.

- [ ] **Step 11: Run full package verification.**

- [ ] **Step 12: Commit**

```bash
git add packages/printer-core/src/compiler/sbpl packages/printer-core/src/parser/sbpl packages/printer-core/src/validation/sbpl packages/printer-core/src/preview/languages/SbplPreviewRenderer.ts packages/printer-core/src/preview/languages/__tests__/SbplPreviewRenderer.test.ts packages/printer-core/src/core/LanguageDispatch.ts packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
git commit -m "feat: port printer-core SBPL compiler+parser+validator+preview, wire into dispatch"
```

---

### Task 6: Star PRNT — compiler, parser, validator, preview

**Files:** Same shape as Task 1, for Star PRNT (`compiler/starprnt/`, `parser/starprnt/`, `validation/starprnt/`, `preview/languages/StarPrntPreviewRenderer.ts`).

**Interfaces:** Same shape as Task 1, for Star PRNT.

**Steps:**

- [ ] **Step 1: Read the structural templates and the spec's tables for Star PRNT.** Prefer `EscPosCompiler.ts`/`EscPosValidator.ts`/`EscPosPreviewRenderer.ts` as the closer structural match this time (Star PRNT is a receipt-style, byte-oriented protocol like ESC/POS, not a line-oriented text protocol like TSC/ZPL). Read `portakal/src/languages/starprnt.ts`, `portakal/parsers/starprnt.ts`, `portakal/src/lang/starprnt.ts` (has its own `renderReceiptSVG()` — the spec flags it as "gần giống ESC/POS nhưng THIẾU xử lý reverse/underline dù compiler Star PRNT có hỗ trợ underline" — a real, pre-existing portakal gap between what the compiler supports and what the preview renders; port the preview exactly as portakal has it, matching the "port what exists" instruction from Tasks 2/3 — do not add the missing reverse/underline preview support, that would be scope creep beyond a faithful port; note it in your report as a possible future enhancement).

- [ ] **Step 2: Implement `StarPrntCommand.ts`, `StarPrntCompiler.ts`, `StarPrntEncoder.ts`** — the image case is flagged "HOẠT ĐỘNG ĐÚNG" (writes each raster line via `ByteBuffer`) — correct, direct port. Note portakal's Star PRNT compiler always appends `ESC d 1` (cut) at the end unconditionally (per the spec's Cut-related notes from Phase 1's design spec) — when you add the `cut` element case per this plan's Global Constraints, make sure it doesn't conflict with or duplicate that unconditional trailing cut; read the compiler source carefully to understand the interaction before deciding how `cut` should behave here.

- [ ] **Step 3: Write the failing tests for the compiler**, run and verify FAIL then PASS.

- [ ] **Step 4: Implement `StarPrntParser.ts`** — port `parseStarPRNT()` directly.

- [ ] **Step 5: Write the failing test for the parser**, run and verify FAIL then PASS.

- [ ] **Step 6: Implement `StarPrntValidator.ts`** — net-new, follow `EscPosValidator.ts` precedent (the two protocols are structurally similar, so this validator may end up structurally close to `EscPosValidator.ts` — that's fine, don't force artificial differences).

- [ ] **Step 7: Write the failing tests for the validator**, run and verify FAIL then PASS.

- [ ] **Step 8: Implement `StarPrntPreviewRenderer.ts`** — port `renderReceiptSVG()` from `portakal/src/lang/starprnt.ts` directly, preserving the reverse/underline gap exactly as portakal has it.

- [ ] **Step 9: Write the failing test for the preview renderer**, run and verify FAIL then PASS.

- [ ] **Step 10: Wire `'starprnt'` into `core/LanguageDispatch.ts`**, extend its test.

- [ ] **Step 11: Run full package verification.**

- [ ] **Step 12: Commit**

```bash
git add packages/printer-core/src/compiler/starprnt packages/printer-core/src/parser/starprnt packages/printer-core/src/validation/starprnt packages/printer-core/src/preview/languages/StarPrntPreviewRenderer.ts packages/printer-core/src/preview/languages/__tests__/StarPrntPreviewRenderer.test.ts packages/printer-core/src/core/LanguageDispatch.ts packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
git commit -m "feat: port printer-core Star PRNT compiler+parser+validator+preview, wire into dispatch"
```

---

### Task 7: IPL — compiler, parser, validator, preview (+ image payload bug fix)

**Files:** Same shape as Task 1, for IPL (`compiler/ipl/`, `parser/ipl/`, `validation/ipl/`, `preview/languages/IplPreviewRenderer.ts` — delegates to the shared `preview/PreviewRenderer.ts` from Task 4, same pattern as DPL/SBPL).

**Interfaces:** Same shape as Task 1, for IPL.

**Steps:**

- [ ] **Step 1: Read the structural templates and the spec's tables for IPL**, plus `portakal/src/languages/ipl.ts`, `portakal/parsers/ipl.ts`. IPL is the smallest/simplest of the remaining languages per the spec's own notes.

- [ ] **Step 2: Implement `IplCommand.ts`, `IplCompiler.ts` for the working element cases.**

- [ ] **Step 3: Implement `IplEncoder.ts` — WITH THE REQUIRED BUG FIX.** Portakal's IPL image case is flagged in the spec as "GẦN NHƯ STUB" — it only emits `{STX}G{fieldNum};o{x},{y};f0{ETX}` with no width/height/data at all, the most incomplete of the three broken image encoders in this plan. You'll need to research IPL's actual image/graphics command format more than Tasks 2/4 did (since portakal gives you almost nothing to start from) — check IPL/Intermec documentation conventions if you have general knowledge of them, and be explicit in your report about your confidence level in the exact command syntax you land on, flagging it for hardware verification later if you're not fully certain. Write a test proving real payload bytes are present, matching the pattern from Tasks 2/4.

- [ ] **Step 4: Write the failing tests for the compiler**, run and verify FAIL then PASS.

- [ ] **Step 5: Implement `IplParser.ts`** — port `parseIPL()` directly.

- [ ] **Step 6: Write the failing test for the parser**, run and verify FAIL then PASS.

- [ ] **Step 7: Implement `IplValidator.ts`** — net-new, follow `EscPosValidator.ts` precedent.

- [ ] **Step 8: Write the failing tests for the validator**, run and verify FAIL then PASS.

- [ ] **Step 9: Implement `IplPreviewRenderer.ts`** — thin wrapper delegating to `preview/PreviewRenderer.ts`'s `renderPreview()` (already real, from Task 4).

- [ ] **Step 10: Write the failing test for the preview renderer**, run and verify FAIL then PASS.

- [ ] **Step 11: Wire `'ipl'` into `core/LanguageDispatch.ts`**, extend its test.

- [ ] **Step 12: Run full package verification.**

- [ ] **Step 13: Commit**

```bash
git add packages/printer-core/src/compiler/ipl packages/printer-core/src/parser/ipl packages/printer-core/src/validation/ipl packages/printer-core/src/preview/languages/IplPreviewRenderer.ts packages/printer-core/src/preview/languages/__tests__/IplPreviewRenderer.test.ts packages/printer-core/src/core/LanguageDispatch.ts packages/printer-core/src/core/__tests__/LanguageDispatch.test.ts
git commit -m "feat: port printer-core IPL compiler+parser+validator+preview, fix image payload stub, wire into dispatch"
```

---

### Task 8: Cross-compiler (`convert/`)

**Files:**
- Modify (fill in): `packages/printer-core/src/convert/PrinterConverter.ts`, `ConversionResult.ts`, `ConversionPath.ts`, `ConversionRegistry.ts`
- Test: `packages/printer-core/src/convert/__tests__/PrinterConverter.test.ts`

**Interfaces:**
- Consumes: every one of the 9 languages' `{Lang}Compiler`/`{Lang}Parser` classes — this task can only start once Tasks 1-7 (plus Phase 1's ESC/POS and TSC) are all complete, since it wires all 9 together.
- Produces: `function convert(source: string, from: PrinterLanguage, to: PrinterLanguage): ConversionResult`; `interface ConversionResult { output: string; elements: PrintElement[]; warnings: string[] }`; `interface ConversionPath { from: PrinterLanguage; to: PrinterLanguage }`; a `ConversionRegistry` mapping each `PrinterLanguage` to its parser and compiler (net-new — portakal only has 2 switch statements, not a registry — see below).

**Steps:**

- [ ] **Step 1: Read the spec's `convert/` table and `portakal/src/convert.ts` in full** (`convert()`, `parseSource()`, `compileTarget()`, `SUPPORTED_SOURCES`/`SUPPORTED_TARGETS`). Note the spec's finding: portakal's `SourceLanguage` excludes `escpos` and `starprnt` from cross-compile SOURCES (you can parse their bytes, but portakal's convert function never wires that parse result back in as a conversion source) — **decide and document whether this plan closes that gap or preserves it.** Given both `EscPosParser`/`StarPrntParser` now exist and produce real `elements: PrintElement[]` (usable as a conversion source same as any text-protocol parser), closing the gap is the more complete, more useful behavior and is a reasonable, small scope addition — but if you find a concrete reason portakal excluded them (re-read `convert.ts` for any comment explaining why), respect that reason instead and document it in your report rather than silently closing what might be an intentional limitation.

- [ ] **Step 2: Implement `ConversionRegistry.ts`** — a `Record<PrinterLanguage, { parse: (source: string | Uint8Array) => { elements: PrintElement[] }; compile: (document: ResolvedPrintDocument, profile?: PrinterProfile) => string | Uint8Array }>`-shaped lookup table (exact shape your call, given each language's parser/compiler signatures differ slightly in output type — `string` vs `Uint8Array`) mapping all 9 `PrinterLanguage` values to their real compiler/parser instances — this replaces portakal's 2 hardcoded switch statements (`parseSource()`/`compileTarget()`) with a genuine lookup structure, a deliberate upgrade over the source per the original mapping spec's own suggestion.

- [ ] **Step 3: Implement `ConversionPath.ts`** — the `{from, to}` pair type plus `SUPPORTED_SOURCES`/`SUPPORTED_TARGETS` arrays (derived from `ConversionRegistry`'s keys, not hand-maintained separately — avoid the two-sources-of-truth problem portakal's own flat arrays have).

- [ ] **Step 4: Implement `ConversionResult.ts`** — port the shape from `portakal/src/convert.ts`'s `ConvertResult`, renamed per the spec.

- [ ] **Step 5: Implement `PrinterConverter.ts`** — port `convert()`'s orchestration logic (parse via source language's registry entry, get `elements`, wrap in a minimal `ResolvedPrintDocument` using the parsed `widthDots`/`heightDots` where the parser provides them and sensible defaults otherwise, compile via target language's registry entry).

- [ ] **Step 6: Write the failing tests** — at minimum: TSC→ZPL and ESC/POS→TSC conversions of a simple text-only document round-trip to recognizable output in the target language's syntax; an unsupported `{from,to}` pair throws a clear error.

Run and verify FAIL then PASS.

- [ ] **Step 7: Run full package verification.**

- [ ] **Step 8: Commit**

```bash
git add packages/printer-core/src/convert
git commit -m "feat: port printer-core cross-compiler (convert/), registry-based dispatch over all 9 languages"
```

---

### Task 9: Remaining printer profiles (6 vendor files, real data)

**Files:**
- Modify (fill in, replacing the empty-`Record` stubs from Phase 1's Task 6): `packages/printer-core/src/profile/profiles/StarProfiles.ts`, `BixolonProfiles.ts`, `CitizenProfiles.ts`, `ZebraProfiles.ts`, `SatoProfiles.ts`, `HoneywellProfiles.ts`
- Test: extend `packages/printer-core/src/profile/__tests__/PrinterProfileResolver.test.ts`

**Interfaces:**
- Consumes: `PrinterProfile`, `PrinterVendor` (already built, Phase 1).
- Produces: each file's `{VENDOR}_PROFILES: Record<string, PrinterProfile>` gains real entries (currently `{}`), automatically picked up by `profiles/index.ts`'s existing merge (no change needed there).

**Steps:**

- [ ] **Step 1: Read `portakal/src/profiles.ts` in full**, specifically the entries for each of these 6 vendors (per the original Phase 1 mapping spec's `profile/` table: Star `star-tsp143`/`star-tsp100`; Bixolon `bixolon-srp-350`; Citizen `citizen-ct-s310ii`; Zebra `zebra-zd420`/`zebra-zt410`/`zebra-gk420`; SATO `sato-cl4nx`; Honeywell `honeywell-pc42t`).

- [ ] **Step 2: Port each vendor's entries verbatim** into its file, replacing the `= {}` stub with the real `Record<string, PrinterProfile>` — copy every numeric field (dpi, paperWidth, dotsPerLine, charsPerLine, usbVendorId/usbProductId, features) EXACTLY from the portakal source, no rounding or "improving" values.

- [ ] **Step 3: Write failing tests** extending `PrinterProfileResolver.test.ts` — resolve at least 2 of the newly-real profile keys (e.g. `getProfile('zebra-zd420')`) and assert a couple of their real field values match the portakal source exactly.

Run and verify FAIL then PASS.

- [ ] **Step 4: Run full package verification.**

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/profile/profiles packages/printer-core/src/profile/__tests__/PrinterProfileResolver.test.ts
git commit -m "feat: port remaining printer-core vendor profiles (Star/Bixolon/Citizen/Zebra/SATO/Honeywell)"
```

---

### Task 10: Transport interfaces (`transport/`)

**Files:**
- Modify (fill in): `packages/printer-core/src/transport/PrinterTransport.ts`, `UsbTransport.ts`, `BluetoothTransport.ts`, `NetworkTransport.ts`
- Test: `packages/printer-core/src/transport/__tests__/PrinterTransport.test.ts` (interfaces themselves don't need runtime tests, but the utility functions below do)

**Interfaces:**
- Produces: `interface PrinterTransport { write(data: Uint8Array): Promise<void>; read?(): Promise<Uint8Array>; getState(): ConnectionState; connect(): Promise<void>; disconnect(): Promise<void> }`; `type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'`; `interface ChunkOptions { chunkSize: number }`; `interface ReconnectOptions { maxRetries: number; delayMs: number }`; `function chunkedWrite(transport: PrinterTransport, data: Uint8Array, options: ChunkOptions): Promise<void>`; `function writeWithRetry(transport: PrinterTransport, data: Uint8Array, options: ReconnectOptions): Promise<void>`; `interface TCPConfig { host: string; port: number }` (`NetworkTransport.ts`); `interface USBConfig { vendorId: number; productId: number }` + `USB_VENDOR_IDS: Record<string, number>` (`UsbTransport.ts`); `interface BLEConfig { serviceUuid: string; characteristicUuid: string }` + `BLE_UUIDS: Record<string, string>` (`BluetoothTransport.ts`).

**Steps:**

- [ ] **Step 1: Read the spec's `transport/` table and `portakal/src/transport.ts` in full** — this file is genuinely interface-only + 2 small utility functions in portakal too (`chunkedWrite()`, `writeWithRetry()`), matching this package's README's own statement that `transport/` here is interface-only (real I/O lives in `src/features/printer/`, not this package).

- [ ] **Step 2: Implement `PrinterTransport.ts`** — port `PrinterTransport`, `ConnectionState`, `ChunkOptions`/`ReconnectOptions`, `chunkedWrite()`, `writeWithRetry()` directly.

- [ ] **Step 3: Implement `NetworkTransport.ts`, `UsbTransport.ts`, `BluetoothTransport.ts`** — port `TCPConfig`, `USBConfig`+`USB_VENDOR_IDS`, `BLEConfig`+`BLE_UUIDS` directly.

- [ ] **Step 4: Write the failing tests** for `chunkedWrite()`/`writeWithRetry()` — these are the only 2 functions with real logic in this task; use a minimal mock `PrinterTransport` implementation in the test file itself (do NOT reach for `testing/MockPrinterTransport.ts` — that's Task 11, not yet built) to verify chunking splits data correctly and retry logic retries the configured number of times before giving up.

Run and verify FAIL then PASS.

- [ ] **Step 5: Run full package verification.**

- [ ] **Step 6: Commit**

```bash
git add packages/printer-core/src/transport
git commit -m "feat: port printer-core transport interfaces (PrinterTransport, chunkedWrite, writeWithRetry)"
```

---

### Task 11: Testing helpers (`testing/`)

**Files:**
- Modify (fill in): `packages/printer-core/src/testing/MockPrinterTransport.ts`, `PrintDataAssertion.ts`, `HexDump.ts`
- Test: `packages/printer-core/src/testing/__tests__/MockPrinterTransport.test.ts`, `packages/printer-core/src/testing/__tests__/HexDump.test.ts`

**Interfaces:**
- Consumes: `PrinterTransport` (Task 10).
- Produces (all net-new, no portakal source — per the original Phase 1 mapping spec): `class MockPrinterTransport implements PrinterTransport { writes: Uint8Array[]; ... }` (records every `write()` call for test assertions, configurable connect/disconnect behavior); `function assertPrintDataEqual(actual: Uint8Array, expected: Uint8Array): void` / `function assertPrintDataContains(actual: Uint8Array, needle: Uint8Array): void` (`PrintDataAssertion.ts` — throw a clear, diffable error message on mismatch, don't just return a boolean); `function hexDump(data: Uint8Array, bytesPerLine?: number): string` (`HexDump.ts` — a classic hex-dump formatter: offset, hex bytes, ASCII gutter).

**Steps:**

- [ ] **Step 1: Read the spec's `testing/` table** (confirms these are net-new — no portakal source, design them from scratch per the Interfaces above and ordinary conventions for this kind of testing utility). Look at how Phase 1's own compiler/parser tests hand-rolled similar assertions (e.g. `EscPosCompiler.test.ts`'s byte-array `toEqual` checks) for a sense of what would have been useful to have as a shared helper.

- [ ] **Step 2: Implement `HexDump.ts`** — a standard hex-dump formatter (16 bytes per line by default, offset in hex, byte values in hex, printable-ASCII gutter on the right, non-printable bytes as `.`).

- [ ] **Step 3: Write the failing test for `HexDump.ts`**, run and verify FAIL then PASS.

- [ ] **Step 4: Implement `PrintDataAssertion.ts`** — `assertPrintDataEqual`/`assertPrintDataContains`, using `HexDump.ts`'s formatter in the thrown error message so a mismatch is human-readable, not just "expected X got Y" with raw byte arrays.

- [ ] **Step 5: Implement `MockPrinterTransport.ts`** — implements `PrinterTransport` from Task 10, records writes, lets a test configure simulated connect/disconnect/read behavior.

- [ ] **Step 6: Write the failing test for `MockPrinterTransport.ts`**, run and verify FAIL then PASS.

- [ ] **Step 7: Run full package verification.**

- [ ] **Step 8: Commit**

```bash
git add packages/printer-core/src/testing
git commit -m "feat: add printer-core testing helpers (MockPrinterTransport, PrintDataAssertion, HexDump)"
```

---

### Task 12: Final sweep + full-coverage integration test

**Files:**
- Modify: any file `npm run type-check -w printer-core` / `npm run type-check` / `npm run lint` still flags after Tasks 1-11 (should be none, given every task's own Global-Constraints acceptance gate — this task's job is to confirm that, not expect to find much).
- Modify: `packages/printer-core/src/__tests__/phase1-integration.test.ts` — consider renaming to `phase2-integration.test.ts` or adding a sibling file (your call; if you rename, update any reference to the old filename) — extend to build ONE representative document and compile/parse/validate/preview it through all 9 languages, not just ESC/POS+TSC.
- Modify: `packages/printer-core/README.md` — update the status block (same one Phase 1's final review fix wave corrected) to reflect that all 9 languages, `convert/`, all profiles, `transport/`, and `testing/` are now real — this package should no longer describe itself as "2/9 languages."
- Modify: `packages/printer-core/src/core/index.ts` or wherever `PrinterCoreError`/`UnsupportedLanguageError` (Phase 1's Task 9 addition) is still referenced for the 7 languages this plan just implemented — confirm `LanguageDispatch.ts` no longer throws "unsupported" for any of the 9 languages.

**Steps:**

- [ ] **Step 1: Run all 4 verification gates from repo root** (`npm run type-check -w printer-core`, `npm run type-check`, `npm test`, `npm run lint`). Fix anything that surfaces.

- [ ] **Step 2: Extend the integration test** to build a document with `.text()`, `.barcode()`, `.table()`, `.cut()` (the representative element mix Phase 1's version already used, now proven across more languages) and compile+parse+validate+preview it through all 9 `PrinterLanguage` values via `core/LanguageDispatch.ts`'s dispatch functions — loop over the 9 languages rather than hand-writing 9 near-identical test blocks, asserting each produces non-empty output and parses back without throwing.

- [ ] **Step 3: Update `README.md`'s status block** to accurately describe the now-complete package — all 9 languages real, `convert/` real, all profiles real (still flag the TCVN3 partial-coverage limitation from Phase 1, and the TSC mixed-encoding limitation, both still genuinely true and unrelated to this plan's scope).

- [ ] **Step 4: Run all 4 verification gates one final time** — this is the plan's acceptance gate.

- [ ] **Step 5: Commit**

```bash
git add -u packages/printer-core
git commit -m "test: full-coverage integration test across all 9 languages, update README status"
```

(Use `git add -u` only if `git status` shows no new untracked files beyond what you explicitly created and already staged elsewhere in this task; otherwise add new files by name.)

---

## Notes for the controller running this plan via SDD

- **Task order matters for Task 8** (convert/) — it must run after Tasks 1-7 (and Phase 1's ESC/POS+TSC) are ALL complete, since it wires every language together. Tasks 9-11 (profiles/transport/testing) have no such dependency and could in principle run earlier or in parallel with Tasks 1-7 if you want to reorder for pacing — but per this skill's "never dispatch multiple implementers in parallel" rule, reordering only changes which task comes next in the same sequential queue, not true parallelism. The order as written (languages first, then convert, then profiles/transport/testing, then final sweep) is a reasonable default; deviate only with a recorded ruling if a specific reason arises.
- **This plan's Global Constraints removed Phase 1's "expected downstream breakage" exception** — every task here is genuinely self-contained (one language, or one of convert/profile/transport/testing) and should leave the whole suite green on its own. If a task's implementer finds itself needing that exception anyway (e.g., discovers `LanguageDispatch.ts` needs touching by multiple tasks in ways that conflict), that's a signal to stop and get a controller ruling, not to assume Phase 1's looser rule silently carries over.
- **Watch for the same class of final-review surprises Phase 1 had** — cross-language consistency (do all 9 compilers agree on Table's `totalWidth`? Do all 9 preview renderers handle options-less text/image the same safe way `element.options ?? {}` established?) is exactly the kind of thing no single task's review can catch. Budget for a real final whole-branch review with a fix wave, same as both of Phase 1's plans needed.
