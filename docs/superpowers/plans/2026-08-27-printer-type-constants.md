# Printer Feature Enum-Like Constants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every raw string-literal usage of the printer feature's 11 main union types with a type-safe `TypeName.MEMBER` accessor, backed by a `const` object + derived type declared alongside each existing type — no behavior change, no breaking change to the type itself.

**Architecture:** For each union type `T = 'A' | 'B' | ...`, add `export const T = { A: 'A', B: 'B', ... } as const;` immediately followed by `export type T = (typeof T)[keyof typeof T];` in the SAME file where `T` is currently declared. TypeScript allows a `const` and a `type` to share one name (declaration merging) — this is a strict superset of the existing type: every place that already does `x: T` or compares `x === 'A'` keeps compiling unchanged, because the type `T` still resolves to the exact same literal union. This plan then updates every call site that constructs, compares, or passes a literal member of `T` to use `T.MEMBER` instead of the bare string, for readability/discoverability (jump-to-definition, autocomplete) — not for type safety, which the union type already provided.

**Tech Stack:** TypeScript strict, no new dependencies.

**Spec:** None — this is a mechanical consistency refactor requested directly by the project owner, not a new feature. The pattern itself was specified by the user with a worked example (`AppErrorCode`).

## Global Constraints

- **No behavior change.** Every task's only observable effect is that `tsc --noEmit`, `npm test`, and `npm run lint` all still pass exactly as before (test counts unchanged, all previously-passing tests still pass).
- **Do NOT convert object-literal KEYS in `Record<T, string>` label/lookup tables** (e.g. `PRINT_TYPE_LABELS`, `protocolLabel`, `connectionLabel`, `contentTypeLabel` and any similar `Record<T, string>` display-label map) to computed-property syntax (`[T.MEMBER]: '...'`). Leave those keys as plain string literals — they are self-documenting mapping keys, not comparisons/constructions, and TypeScript already forces them to have exactly the right keys via `Record<T, string>`. This is a deliberate, permanent exception, not an oversight to "finish later."
- **Do NOT touch comments, doc-strings, or Vietnamese prose** that happen to contain a matching word (e.g. a comment saying "khi kết nối lan" — leave prose alone; only touch actual TypeScript expressions).
- **Verify semantically, not just textually.** Several of these types share literal member values with OTHER, unrelated types in this codebase — most notably `'error'`, which is a valid member of `PrinterStatus`, `DeviceScanEventType`, AND the unrelated `LogLevel` type in `src/services/LoggerService.ts` (`'debug' | 'info' | 'warning' | 'error'`). A grep match on `'error'` is not proof it's the type this task is converting — read the surrounding code (is it typed as `PrinterStatus`? is it a `LoggerService.write(level, ...)` call?) before replacing. A wrong substitution the type-checker doesn't catch (e.g. into an untyped `string` parameter) would be a silent behavior-preserving no-op at runtime (same string value) but a misleading, incorrect-looking accessor in the diff — reviewers should flag any accessor used somewhere it doesn't semantically belong.
- **Import the const as a value, not `import type`.** Every file that already does `import type { T } from '...'` and now also needs `T.MEMBER` at runtime needs a plain `import { T } from '...'` (TypeScript allows a single import statement to bring in both the value and the type when they share a name — `import { T } from '...'` alone is sufficient for both use-as-type and use-as-value; a separate `import type` is not required and can be removed once the plain import is added, to avoid a duplicate/conflicting import of the same name).
- **This plan touches the SAME FILES across multiple tasks** — e.g. `TsplDriver.ts` is touched by the `PrinterDriverType`, `ConnectionType`, `TsplRenderMode`, and `AppErrorCode` tasks. Tasks in this plan MUST run strictly sequentially (never in parallel), and each task's implementer must read the file's actual current state (not assume an earlier task hasn't already touched it) before editing.
- One external file outside `src/features/printer/` consumes these types: `src/features/cart/services/OrderPrintTrigger.ts` (and its test) — uses `PrintType`. Include it in that task's scope.

---

### Task 1: `AppErrorCode` (types/AppError.ts)

**Files:**
- Modify: `src/features/printer/types/AppError.ts`
- Modify (call-site migration, via grep): every file under `src/features/printer/**` matching the grep in Step 2, plus their `__tests__/` counterparts.

**Interfaces:**
- Produces: `AppErrorCode` as both a `const` object (`AppErrorCode.VALIDATION_ERROR`, `.CONNECTION_ERROR`, `.UNSUPPORTED_CONNECTION`, `.PRINT_ERROR`, `.ENCODING_FAILED`, `.NO_AVAILABLE_PRINTER`, `.UNKNOWN_ERROR`) and the original literal-union type — used by every other task/file that already imports `AppErrorCode`/`AppError`/`AppErrorException`.

- [ ] **Step 1: Add the const object + type**

In `src/features/printer/types/AppError.ts`, replace:

```ts
export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONNECTION_ERROR'
  | 'UNSUPPORTED_CONNECTION'
  | 'PRINT_ERROR'
  | 'ENCODING_FAILED'
  | 'NO_AVAILABLE_PRINTER'
  | 'UNKNOWN_ERROR';
```

with:

```ts
export const AppErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  UNSUPPORTED_CONNECTION: 'UNSUPPORTED_CONNECTION',
  PRINT_ERROR: 'PRINT_ERROR',
  ENCODING_FAILED: 'ENCODING_FAILED',
  NO_AVAILABLE_PRINTER: 'NO_AVAILABLE_PRINTER',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type AppErrorCode = (typeof AppErrorCode)[keyof typeof AppErrorCode];
```

- [ ] **Step 2: Run type-check to confirm the type itself is unchanged**

Run: `npm run type-check`
Expected: 0 errors (the type's shape is identical; this step only proves Step 1 alone doesn't break anything before touching call sites).

- [ ] **Step 3: Find and migrate call sites**

Run: `grep -rln "'VALIDATION_ERROR'\|'CONNECTION_ERROR'\|'UNSUPPORTED_CONNECTION'\|'PRINT_ERROR'\|'ENCODING_FAILED'\|'NO_AVAILABLE_PRINTER'\|'UNKNOWN_ERROR'" src/features/printer` (and repeat over `src/features/cart` — `AppErrorException`/`AppErrorCode` are used in a couple of cart-side print-trigger tests too; grep to confirm).

For every matched file, for every genuine usage (an `AppErrorException({ code: '...' })` construction, an `error.code === '...'` comparison, a test's `toMatchObject({ code: '...' })`/`rejects.toMatchObject(...)` assertion, a mock error object's `code` field) — replace the bare string with `AppErrorCode.MEMBER`. Add `import { AppErrorCode } from '<relative path to>/types/AppError'` (or extend an existing `AppError`-related import) to each file that doesn't already import it.

Do NOT touch: any place where the string is genuinely something else (there is no cross-type collision risk for these 7 specific values — they're distinctive enough — but still read each match's context before editing, per Global Constraints).

- [ ] **Step 4: Run type-check again**

Run: `npm run type-check`
Expected: 0 errors. Any error here means a site was migrated incorrectly (e.g. typo in the member name) — fix before proceeding.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: identical pass/fail counts to the pre-task baseline (run `npm test` once before Step 1 if you need a baseline number to compare against).

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no new errors/warnings in touched files.

- [ ] **Step 7: Commit**

```bash
git add -A -- src/features/printer src/features/cart
git commit -m "refactor(printer): AppErrorCode as const-object accessor, migrate call sites"
```

---

### Task 2: `PrinterDriverType` (types/printer.types.ts)

**Files:**
- Modify: `src/features/printer/types/printer.types.ts`
- Modify (call-site migration, via grep): every file under `src/features/printer/**` matching Step 2's grep.

**Interfaces:**
- Produces: `PrinterDriverType.escpos`, `PrinterDriverType.tspl` + the original literal-union type.

- [ ] **Step 1: Add the const object + type**

Replace:

```ts
export type PrinterDriverType = 'escpos' | 'tspl';
```

with:

```ts
export const PrinterDriverType = {
  escpos: 'escpos',
  tspl: 'tspl',
} as const;

export type PrinterDriverType = (typeof PrinterDriverType)[keyof typeof PrinterDriverType];
```

- [ ] **Step 2: Find and migrate call sites**

Run: `grep -rln "'escpos'\|'tspl'" src/features/printer`

For every match, if the string is a genuine `PrinterDriverType` usage (a driver's `type` field, a `DriverRegistry` key, a `getDriver('...')`/`getDriverDefinition('...')` call argument, a `driver.type === '...'`/`config.type === '...'` comparison, a test fixture's `type: '...'`), replace with `PrinterDriverType.escpos`/`PrinterDriverType.tspl`.

**Careful — two known non-obvious spots:**
- `PrinterDriverConfig`'s discriminant field (`TsplDriverConfig.type: 'tspl'` / `EscPosDriverConfig.type: 'escpos'`) is a **type-level literal**, not a value — do NOT change the interface's own `type: 'tspl';` field declaration (that stays a literal type annotation). Only change VALUE-level usages (object literals being constructed, comparisons).
- `Record<PrinterDriverType, ...>` object literal KEYS (`PRINTER_DRIVER_DEFINITIONS = { escpos: {...}, tspl: {...} }`, `DriverRegistry = { escpos: ..., tspl: ... }`, `protocolLabel = { escpos: 'ESC/POS', tspl: 'TSPL' }`) — per the Global Constraints label-table exception, leave `protocolLabel`'s keys as plain strings (it's a display-label map). `PRINTER_DRIVER_DEFINITIONS` and `DriverRegistry`, however, are NOT display-label maps (they're behavioral lookup tables, not translations) — for these two, also leave the keys as plain string literals too, since `Record<PrinterDriverType, X>`'s keys being computed properties (`{ [PrinterDriverType.escpos]: {...} }`) would be unusual/harder to read for an object literal that's meant to be scanned as a static table by a developer. Apply the same "leave object literal keys alone, convert everything else" rule uniformly to ALL `Record<PrinterDriverType, X>` tables in this codebase, not just label ones.

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: identical counts to baseline.

- [ ] **Step 5: Lint**

Run: `npm run lint`

- [ ] **Step 6: Commit**

```bash
git add -A -- src/features/printer
git commit -m "refactor(printer): PrinterDriverType as const-object accessor, migrate call sites"
```

---

### Task 3: `ConnectionType` (types/printer.types.ts)

**Files:**
- Modify: `src/features/printer/types/printer.types.ts`
- Modify (call-site migration, via grep): every file under `src/features/printer/**` matching Step 2's grep.

**Interfaces:**
- Produces: `ConnectionType.usb`, `.bluetooth`, `.lan` + the original literal-union type.

- [ ] **Step 1: Add the const object + type**

Replace:

```ts
export type ConnectionType = 'usb' | 'bluetooth' | 'lan';
```

with:

```ts
export const ConnectionType = {
  usb: 'usb',
  bluetooth: 'bluetooth',
  lan: 'lan',
} as const;

export type ConnectionType = (typeof ConnectionType)[keyof typeof ConnectionType];
```

- [ ] **Step 2: Find and migrate call sites**

Run: `grep -rln "'usb'\|'bluetooth'\|'lan'" src/features/printer`

This is the type with the highest false-positive risk in this plan — `'lan'` and `'usb'` are short and can appear as substrings inside unrelated words or as part of other literal strings (e.g. a resource-key template string like `` `tspl:lan:${ip}:${port}` `` — that's a STRING TEMPLATE producing a NEW string for `PrinterConnectionLock`'s resource-key map, not a `ConnectionType` comparison; leave those template literals alone since they're building a compound cache key, not assigning/comparing a `ConnectionType` value). Only convert:
- `connectionType === '...'` / `printer.connectionType === '...'` comparisons
- object literals constructing a `Printer`/draft with `connectionType: '...'`
- function arguments typed as `ConnectionType` (e.g. `driver.scan('...', onEvent)`, `connectionResourceKey({ connectionType: '...', ... })`)
- test fixtures typed as `Printer`/`ConnectionType`

Do NOT touch: resource-key template strings (`` `usb` `` returned bare as a lock key is a borderline case — `PrinterConnectionLock.ts`'s `if (input.connectionType === 'usb') return 'usb';` — the COMPARISON (`input.connectionType === 'usb'`) should become `input.connectionType === ConnectionType.usb`, but the bare `return 'usb';` on the same line is returning an opaque cache-key string, not a `ConnectionType` value — leave that particular `return 'usb'` as a plain string).

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: 0 errors — a stray incorrect substitution (e.g. converting a resource-key template) would show up as a type error here since `ConnectionType.usb` used inside a template literal still produces a string, so this specific mistake would NOT be caught by type-check; rely on Step 2's explicit exception list instead, and self-review the diff for any resource-key/template-literal site before moving to Step 4.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: identical counts to baseline.

- [ ] **Step 5: Lint**

Run: `npm run lint`

- [ ] **Step 6: Commit**

```bash
git add -A -- src/features/printer
git commit -m "refactor(printer): ConnectionType as const-object accessor, migrate call sites"
```

---

### Task 4: `PrintType` (types/printConfiguration.types.ts)

**Files:**
- Modify: `src/features/printer/types/printConfiguration.types.ts`
- Modify (call-site migration, via grep): every file under `src/features/printer/**` AND `src/features/cart/**` matching Step 2's grep.

**Interfaces:**
- Produces: `PrintType.Receipt`, `PrintType.Label` + the original literal-union type.

- [ ] **Step 1: Add the const object + type**

Replace:

```ts
export type PrintType = 'Receipt' | 'Label';
```

with:

```ts
export const PrintType = {
  Receipt: 'Receipt',
  Label: 'Label',
} as const;

export type PrintType = (typeof PrintType)[keyof typeof PrintType];
```

- [ ] **Step 2: Find and migrate call sites**

Run: `grep -rln "'Receipt'\|'Label'" src/features/printer src/features/cart`

Convert genuine `PrintType` usages: `printType === '...'`, `contentTypes: ['...']`/`.includes('...')`, function call arguments (`PrintService.print('...', ...)`, `driver.testPrint(..., '...')`), test fixtures.

Per Global Constraints, do NOT convert `PRINT_TYPE_LABELS`'s keys (`{ Receipt: 'Hoá đơn', Label: 'Tem' }` in `printConfiguration.types.ts` itself) or `contentTypeLabel`'s keys (`{ Receipt: 'In Hoá đơn', Label: 'In Tem' }` in `PrinterInfoCard.tsx`) — those stay as plain string keys.

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: identical counts to baseline.

- [ ] **Step 5: Lint**

Run: `npm run lint`

- [ ] **Step 6: Commit**

```bash
git add -A -- src/features/printer src/features/cart
git commit -m "refactor(printer): PrintType as const-object accessor, migrate call sites"
```

---

### Task 5: `PrinterStatus` (types/printer.types.ts)

**Files:**
- Modify: `src/features/printer/types/printer.types.ts`
- Modify (call-site migration, via grep): every file under `src/features/printer/**` matching Step 2's grep.

**Interfaces:**
- Produces: `PrinterStatus.idle`, `.connecting`, `.connected`, `.disconnecting`, `.disconnected`, `.reconnecting`, `.error` + the original literal-union type.

- [ ] **Step 1: Add the const object + type**

Replace:

```ts
export type PrinterStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'reconnecting'
  | 'error';
```

with:

```ts
export const PrinterStatus = {
  idle: 'idle',
  connecting: 'connecting',
  connected: 'connected',
  disconnecting: 'disconnecting',
  disconnected: 'disconnected',
  reconnecting: 'reconnecting',
  error: 'error',
} as const;

export type PrinterStatus = (typeof PrinterStatus)[keyof typeof PrinterStatus];
```

- [ ] **Step 2: Find and migrate call sites**

Run: `grep -rln "'idle'\|'connecting'\|'connected'\|'disconnecting'\|'disconnected'\|'reconnecting'" src/features/printer` for the unambiguous members first (these six words don't collide with any other type in this codebase).

Then separately run: `grep -rln "'error'" src/features/printer/drivers src/features/printer/printing src/features/printer/hooks src/features/printer/store src/features/printer/components` and check EACH match's context per the Global Constraints warning — `'error'` is also a valid `DeviceScanEventType` member (Task 8) and appears in unrelated contexts (Zod error messages, generic catch blocks, the word "error" inside Vietnamese/English prose comments). Only convert a bare `'error'` to `PrinterStatus.error` where the surrounding code is unambiguously setting/comparing/asserting a `PrinterStatus` value (e.g. `setStatus(printerId, 'error')`, `expect(status).toBe('error')` where `status: PrinterStatus`). Leave `DeviceScanEventType`'s own `'error'` usages for Task 8 to handle with the same care.

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: identical counts to baseline.

- [ ] **Step 5: Lint**

Run: `npm run lint`

- [ ] **Step 6: Commit**

```bash
git add -A -- src/features/printer
git commit -m "refactor(printer): PrinterStatus as const-object accessor, migrate call sites"
```

---

### Task 6: `TsplRenderMode` (types/printer.types.ts)

**Files:**
- Modify: `src/features/printer/types/printer.types.ts`
- Modify (call-site migration, via grep): every file under `src/features/printer/**` matching Step 2's grep.

**Interfaces:**
- Produces: `TsplRenderMode.bitmap`, `.truetype` + the original literal-union type.

- [ ] **Step 1: Add the const object + type**

Replace:

```ts
export type TsplRenderMode = 'bitmap' | 'truetype';
```

with:

```ts
export const TsplRenderMode = {
  bitmap: 'bitmap',
  truetype: 'truetype',
} as const;

export type TsplRenderMode = (typeof TsplRenderMode)[keyof typeof TsplRenderMode];
```

- [ ] **Step 2: Find and migrate call sites**

Run: `grep -rln "'bitmap'\|'truetype'" src/features/printer`

Convert genuine usages: `renderMode: '...'` (object construction), `renderMode === '...'` (comparison), test fixtures. Watch for doc-comments that mention "bitmap"/"truetype" in prose (e.g. spec-referencing comments like "TSPL renderMode luôn 'bitmap'") — those are prose, not expressions; leave them untouched (they're inside `/** ... */` blocks, not executable code).

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: identical counts to baseline.

- [ ] **Step 5: Lint**

Run: `npm run lint`

- [ ] **Step 6: Commit**

```bash
git add -A -- src/features/printer
git commit -m "refactor(printer): TsplRenderMode as const-object accessor, migrate call sites"
```

---

### Task 7: `DriverSource` (types/printer.types.ts)

**Files:**
- Modify: `src/features/printer/types/printer.types.ts`
- Modify (call-site migration, via grep): every file under `src/features/printer/**` matching Step 2's grep.

**Interfaces:**
- Produces: `DriverSource.auto`, `.manual` + the original literal-union type.

- [ ] **Step 1: Add the const object + type**

Replace:

```ts
export type DriverSource = 'auto' | 'manual';
```

with:

```ts
export const DriverSource = {
  auto: 'auto',
  manual: 'manual',
} as const;

export type DriverSource = (typeof DriverSource)[keyof typeof DriverSource];
```

- [ ] **Step 2: Find and migrate call sites**

Run: `grep -rln "'auto'\|'manual'" src/features/printer`

`'auto'` and `'manual'` are common English words — expect several false-positive matches (comments, unrelated variable names, other literal strings). Only convert where the value is genuinely assigned to/compared against a `PrinterDriver.source: DriverSource` field (e.g. `addDriverToList(type, 'auto')`, `source: 'manual'` in a driver-entry object literal, test fixtures with a `source:` field).

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: identical counts to baseline.

- [ ] **Step 5: Lint**

Run: `npm run lint`

- [ ] **Step 6: Commit**

```bash
git add -A -- src/features/printer
git commit -m "refactor(printer): DriverSource as const-object accessor, migrate call sites"
```

---

### Task 8: `DeviceScanEventType` (types/printer.types.ts)

**Files:**
- Modify: `src/features/printer/types/printer.types.ts`
- Modify (call-site migration, via grep): every file under `src/features/printer/**` matching Step 2's grep.

**Interfaces:**
- Produces: `DeviceScanEventType.loading`, `.found`, `.empty`, `.error` + the original literal-union type.

- [ ] **Step 1: Add the const object + type**

Replace:

```ts
export type DeviceScanEventType = 'loading' | 'found' | 'empty' | 'error';
```

with:

```ts
export const DeviceScanEventType = {
  loading: 'loading',
  found: 'found',
  empty: 'empty',
  error: 'error',
} as const;

export type DeviceScanEventType = (typeof DeviceScanEventType)[keyof typeof DeviceScanEventType];
```

- [ ] **Step 2: Find and migrate call sites**

Run: `grep -rln "'loading'\|'found'\|'empty'" src/features/printer` for the three unambiguous members.

For `'error'`, same caution as Task 5: only convert where the surrounding code is constructing/comparing a `DeviceScanEvent.type` field (e.g. `onEvent({ type: 'error', error: ... })` inside a `scan()` implementation, a `DeviceScanList`/`DeviceScanEvent` test fixture). If Task 5 already ran first and already converted every `PrinterStatus.error` site, whatever `'error'` sites remain unconverted at this point that are inside scan-event contexts belong to this task.

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: identical counts to baseline.

- [ ] **Step 5: Lint**

Run: `npm run lint`

- [ ] **Step 6: Commit**

```bash
git add -A -- src/features/printer
git commit -m "refactor(printer): DeviceScanEventType as const-object accessor, migrate call sites"
```

---

### Task 9: `DiscoveryStage` (discovery/PrinterDiscoveryService.ts)

**Files:**
- Modify: `src/features/printer/discovery/PrinterDiscoveryService.ts`
- Modify (call-site migration, via grep): every file under `src/features/printer/**` matching Step 2's grep (primarily `discovery/`, `components/AddPrinterModal.tsx`, and their tests).

**Interfaces:**
- Produces: `DiscoveryStage.connecting`, `.identifying`, `.identified`, `.unknown_protocol`, `.error` + the original literal-union type.

- [ ] **Step 1: Add the const object + type**

Replace:

```ts
export type DiscoveryStage = 'connecting' | 'identifying' | 'identified' | 'unknown_protocol' | 'error';
```

with:

```ts
export const DiscoveryStage = {
  connecting: 'connecting',
  identifying: 'identifying',
  identified: 'identified',
  unknown_protocol: 'unknown_protocol',
  error: 'error',
} as const;

export type DiscoveryStage = (typeof DiscoveryStage)[keyof typeof DiscoveryStage];
```

- [ ] **Step 2: Find and migrate call sites**

Run: `grep -rln "'identifying'\|'identified'\|'unknown_protocol'" src/features/printer` for the three unambiguous members (these don't collide with `PrinterStatus`'s `'connecting'`/`'error'`, which are a DIFFERENT type despite the shared words).

For `'connecting'` and `'error'`, both collide with `PrinterStatus` (Task 5) — only convert where the value is assigned to/compared against a `DiscoveryEvent.stage` field (e.g. `onEvent({ stage: 'connecting', protocol: type })` inside `PrinterDiscoveryService.ts`, or a `DiscoveryEvent`-typed test assertion), not a `PrinterStatus`.

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: identical counts to baseline.

- [ ] **Step 5: Lint**

Run: `npm run lint`

- [ ] **Step 6: Commit**

```bash
git add -A -- src/features/printer
git commit -m "refactor(printer): DiscoveryStage as const-object accessor, migrate call sites"
```

---

### Task 10: `PrintJobStatus` (types/printJob.types.ts)

**Files:**
- Modify: `src/features/printer/types/printJob.types.ts`
- Modify (call-site migration, via grep): every file under `src/features/printer/**` matching Step 2's grep (primarily `printing/PrintScheduler.ts`, `printing/PrintService.ts`, and their tests).

**Interfaces:**
- Produces: `PrintJobStatus.pending`, `.printing`, `.success`, `.failed`, `.cancelled` + the original literal-union type.

- [ ] **Step 1: Add the const object + type**

Replace:

```ts
export type PrintJobStatus = 'pending' | 'printing' | 'success' | 'failed' | 'cancelled';
```

with:

```ts
export const PrintJobStatus = {
  pending: 'pending',
  printing: 'printing',
  success: 'success',
  failed: 'failed',
  cancelled: 'cancelled',
} as const;

export type PrintJobStatus = (typeof PrintJobStatus)[keyof typeof PrintJobStatus];
```

- [ ] **Step 2: Find and migrate call sites**

Run: `grep -rln "'pending'\|'printing'\|'cancelled'" src/features/printer` for the three unambiguous members.

`'success'` and `'failed'` also collide with `PrintResultStatus` (Task 11, which additionally has `'partial-failure'` and `'no-available-printer'`) — only convert `'success'`/`'failed'` to `PrintJobStatus.success`/`.failed` where the value is assigned to/compared against a `PrintJob.status` field (e.g. `job.status = 'success'`, a `PrintJob` test fixture's `status:` field) — NOT a `PrintResult.status` field (that belongs to Task 11).

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: identical counts to baseline.

- [ ] **Step 5: Lint**

Run: `npm run lint`

- [ ] **Step 6: Commit**

```bash
git add -A -- src/features/printer
git commit -m "refactor(printer): PrintJobStatus as const-object accessor, migrate call sites"
```

---

### Task 11: `PrintResultStatus` (types/printJob.types.ts)

**Files:**
- Modify: `src/features/printer/types/printJob.types.ts`
- Modify (call-site migration, via grep): every file under `src/features/printer/**` matching Step 2's grep (primarily `printing/PrintService.ts` and its test), plus `src/features/cart/**` if `PrintResult.status` is inspected there.

**Interfaces:**
- Produces: `PrintResultStatus.success`, `.['partial-failure']`, `.failed`, `.['no-available-printer']` + the original literal-union type. (Two members contain a hyphen — property access needs bracket notation for those two only; dot notation works for `success`/`failed`.)

- [ ] **Step 1: Add the const object + type**

Replace:

```ts
export type PrintResultStatus = 'success' | 'partial-failure' | 'failed' | 'no-available-printer';
```

with:

```ts
export const PrintResultStatus = {
  success: 'success',
  partialFailure: 'partial-failure',
  failed: 'failed',
  noAvailablePrinter: 'no-available-printer',
} as const;

export type PrintResultStatus = (typeof PrintResultStatus)[keyof typeof PrintResultStatus];
```

(Property KEYS are camelCase — `partialFailure`, `noAvailablePrinter` — since a hyphen can't be a plain identifier; the VALUES stay exactly `'partial-failure'`/`'no-available-printer'`, unchanged, so nothing downstream that compares against the raw string breaks.)

- [ ] **Step 2: Find and migrate call sites**

Run: `grep -rln "'partial-failure'\|'no-available-printer'" src/features/printer src/features/cart` for these two unambiguous (non-colliding) members — convert to `PrintResultStatus.partialFailure` / `PrintResultStatus.noAvailablePrinter`.

For `'success'`/`'failed'`, same collision caveat as Task 10 — only convert where the value is assigned to/compared against a `PrintResult.status` field (e.g. `const status = successCount === jobs.length ? 'success' : ... ` in `PrintService.ts`'s `print()`, a `PrintResult` test assertion) — NOT a `PrintJob.status` field (Task 10's scope).

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: identical counts to baseline.

- [ ] **Step 5: Lint**

Run: `npm run lint`

- [ ] **Step 6: Commit**

```bash
git add -A -- src/features/printer src/features/cart
git commit -m "refactor(printer): PrintResultStatus as const-object accessor, migrate call sites"
```

---

## Final checklist

- [ ] `npm run type-check` — 0 errors, whole repo.
- [ ] `npm test` — identical pass/fail counts to the pre-Task-1 baseline (no regressions, no accidentally-dropped tests).
- [ ] `npm run lint` — clean on all touched files.
- [ ] Spot-check: none of the 4 `Record<PrinterDriverType/PrintType, ...>` label/lookup tables (`PRINT_TYPE_LABELS`, `protocolLabel`, `connectionLabel`, `contentTypeLabel`, `PRINTER_DRIVER_DEFINITIONS`, `DriverRegistry`) got their keys converted to computed properties.
- [ ] Spot-check: `PrinterConnectionLock.ts`'s bare resource-key `return 'usb'`/similar cache-key strings were NOT converted (only the `connectionType === '...'` comparisons feeding into them).
- [ ] Spot-check: no cross-type collision mistakes — grep for `PrinterStatus.error`, `DeviceScanEventType.error`, `DiscoveryStage.error` and manually confirm each is in the right context (driver status vs. scan event vs. discovery stage), and similarly for `PrintJobStatus.success`/`.failed` vs. `PrintResultStatus.success`/`.failed`.
