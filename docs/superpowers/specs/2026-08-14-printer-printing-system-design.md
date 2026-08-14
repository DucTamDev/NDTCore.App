# Printer Printing System — Destination, Routing, Print Execution

## Context

The printer module today (`src/features/printer/`) only covers Printer
Management: `PrinterConfig` storage, `PrinterService` (hardware
connect/disconnect/status), `DriverRegistry`, and per-driver `testPrint()`
with fixed content (`ThermalReceiptDriver`, `TsplDriver`). There is no way to
route arbitrary content to one or more printers, no queueing, no
retry/failover, and no concept of a printer being administratively disabled.

`docs/design/features/printer-management.md` is a full walkthrough design
doc covering both halves of the printer system (Printer Management +
Printing). It has already been reviewed this session against this repo's
actual code and against real vendor/protocol documentation, and corrected:
Vendor SDK / built-in printer support (Sunmi, iMin) was removed as
out-of-scope, ESC/POS-vs-ZPL/TSPL facts were fixed, and terminology was
aligned to this repo's `Driver`/`IPrinterDriver` naming (not `Adapter`). This
spec formalizes the **Printing** half of that doc (`PrintDestination`,
`PrintRule`, `PrintPlan`, `PrintJob`, `PrintScheduler`) into an actionable
spec for this repo, using the entity shapes already agreed there, and adds
one dependency identified during review: `Printer.enabled`, required by the
Destination "effective printer" rule.

`sales` has no cart/order data yet — it is a static shell (see
`docs/superpowers/specs/2026-08-06-sales-shell-navigation-design.md`). This
spec cannot design real order → print-plan grouping logic against a model
that does not exist. `OrderPrintPlanner` is included only as a stub
interface, so the rest of the pipeline (Destination → Job → Scheduler →
Driver) has a complete, testable path via manual "Print Test" against a
`PrintDestination`, without needing an order flow to exist first. Real
order-driven printing is deferred to a follow-up spec once `sales` has a
cart/order model.

## Goals

- `Printer.enabled` — administrative on/off, independent of runtime
  `connected` status, wired into the existing Printer Management list.
- `PrintDestination`/`PrintRule` config: new CRUD storage + UI, independent
  of `PrinterConfig`'s own storage.
- `PrintService` — new facade, `print(plan: PrintPlan): Promise<PrintResult>`,
  kept separate from `PrinterService` (see "Approach" below).
- `PrintScheduler` — per-printer serialized job queue.
- `IPrinterDriver.print(printerId, document)` — extends the existing driver
  contract so drivers can print arbitrary `PrintDocument` content, not just
  the fixed `testPrint()` string.
- `OrderPrintPlanner` — stub interface only, not implemented.

## Approach: `PrintService` stays separate from `PrinterService`

`PrinterService` keeps its current responsibility (hardware config,
connection, status) untouched. A new `PrintService` owns Destination
resolution, fanout, job creation, and delegates execution to
`PrintScheduler`. `PrintScheduler` never touches `DriverRegistry` directly —
it calls a new `PrinterService.print(printerId, document)` method, the same
way `PrintService`'s siblings (`connect`/`disconnect`/`testPrint`) already
work. This keeps "every driver access goes through one facade" true for the
new code path too, and matches the design doc's own principle #1: Printer
Management and Printing must not be mixed into one object. Rejected
alternative: adding `print()` straight onto `PrinterService` — simpler file
count, but turns it into a god-object (CRUD + connection + queue + fanout +
retry) and breaks that principle for no real benefit.

## 1. `Printer.enabled`

- `types/printer.types.ts`: `PrinterConfig` gains `enabled: boolean`. This
  repo has no migration infrastructure, so old records simply lack the
  field; `PrinterService.getPrinters()` normalizes it with
  `p.enabled ?? true` at read time (never persisted back until the user
  actually toggles it) — a printer that was usable before this change stays
  usable without a write-time migration step.
- `store/printerSlice.ts`: new reducer `printerEnabledChanged(state, {printerId, enabled})`,
  mirroring the existing `printerStatusChanged` shape — not reusing
  `printerUpserted`, to keep single-field toggles as dedicated actions like
  `defaultPrinterSet` already does for `isDefault`.
- `services/PrinterService.ts`: new `setEnabled(printerId, enabled): void`,
  following `setDefault`'s read-map-save pattern.
- UI: printer list item gets a switch; a disabled printer stays visible and
  its actions become `disabled` (per this repo's "Disable, không Hide" rule)
  — it is not removed from the list, just excluded from Destination
  resolution (see §5).

## 2. New domain types

New files under `src/features/printer/types/`, following the existing
one-file-per-concern split (`printer.types.ts`, `driver.types.ts`):

- `destination.types.ts` — `PrintDestination { id, name, printerIds: string[], fanoutMode: 'failover' | 'broadcast', enabled: boolean }`.
  Priority for failover is expressed as `printerIds` array order (index = priority), not a separate `{printerId, priority}` object — simpler, and this repo has no other precedent for a parallel priority field.
- `printRule.types.ts` — `PrintRule { id, conditions: PrintCondition[], destinationId, priority: number, enabled: boolean }`, `PrintCondition { field: string, value: string }` (AND-combined, per design doc §47-48), `PrintRoutingConfiguration { rules: PrintRule[], defaultDestinationId?: string }`.
- `printDocument.types.ts` — `PrintDocument { elements: PrintElement[] }`, `PrintElement` discriminated union: `{type:'text', content, x, y}` / `{type:'image', data, x, y}` / `{type:'barcode', content, x, y}` / `{type:'qrCode', content, x, y}` / `{type:'line', x, y}` / `{type:'table', rows: string[][], x, y}`. No `width`/`height`/`template` fields on `PrintDocument` (the design doc's sketch had them) — nothing in this repo derives paper geometry from the document; `PrinterConfig.paperSize` already owns that.
- `printJob.types.ts` — `PrintPlan { id, destinationId, document: PrintDocument, copies: number }`, `PrintJob { id, planId, printerId, document: PrintDocument, status: 'pending'|'printing'|'success'|'failed'|'cancelled', retryCount, error?: AppError, createdAt, startedAt?, completedAt? }`, `PrintResult`.

## 3. `IPrinterDriver.print()` and per-driver encoding

`types/driver.types.ts` gains one method:

```ts
print(printerId: string, document: PrintDocument): Promise<void>;
```

The two drivers encode `PrintDocument` differently, because their
underlying libraries are shaped differently — this is not a design choice,
it is a constraint already visible in the existing code:

- **`TsplDriver`**: already writes raw bytes over a `Transport`
  (`protocols/TsplEncoder.ts` → `Uint8Array` → `UsbTransport`/
  `BluetoothTransport`/`LanTransport`). `TsplEncoder` gains an `image(x, y, data)`
  method (TSPL `BITMAP` command); `table` and `line` elements map to
  repeated `text()` calls — no new TSPL primitive needed.
- **`ThermalReceiptDriver`**: has no raw-byte access. Its library
  (`@poriyaalar/react-native-thermal-receipt-printer`) exposes only
  `printText(taggedString)` per namespace (`<C>`, `<B>`, `<D>`/`<M>` tags) —
  confirmed while writing this spec by re-reading
  `ThermalReceiptDriver.ts`. A new `protocols/EscPosTextComposer.ts` converts
  `PrintElement[]` into that tagged string (`text` → tag-wrapped content,
  `line` → a dashed-rule string, `table` → column-padded plain text rows).
  `image`/`barcode`/`qrCode` elements are **not supported** by this driver in
  this iteration — the library exposes no image/barcode API — and `print()`
  throws `AppErrorException({code: 'PRINT_ERROR', ...})` synchronously for
  those element types rather than silently skipping them.

This confirms the design doc's own reasoning for keeping Generic/vendor
encoding separate (design doc §16) applies even within "Generic" drivers
here: there is no shared `PrinterProtocol` abstraction reused by both
drivers in this codebase, because `IPrinterDriver` was never designed with
one (`scan`/`connect`/`testPrint` are already driver-owned, not
protocol/transport-composed). This spec does not introduce one now — each
driver's `print()` is self-contained, consistent with how `testPrint()`
already works today.

## 4. `PrintService` and `PrintScheduler`

New `services/PrintService.ts`, factory-created like `PrinterService`
(`createPrintService(printerService, ...)`, exported singleton
`PrintService`):

```ts
print(plan: PrintPlan): Promise<PrintResult>
```

Flow: resolve `plan.destinationId` → filter `printerIds` to "effective
printers" (`Destination.enabled && Printer.enabled`, per §5) → fanout:

- `failover`: try effective printers in array order; stop at first success;
  if all fail, result is `NO_AVAILABLE_PRINTER`. No available effective
  printer at all (empty list) also resolves directly to
  `NO_AVAILABLE_PRINTER` — never silently returns success with nothing sent
  (design doc §44).
- `broadcast`: send to every effective printer; aggregate result is
  `success`, `partial-failure`, or `failed` (design doc §63).

Each attempt creates one `PrintJob`, pushed to `PrintScheduler.enqueue(job)`.

New `services/PrintScheduler.ts`: one in-memory FIFO queue per `printerId`
(`Map<string, PrintJob[]>`), processed sequentially — never two jobs
in-flight for the same printer at once. This is the only concurrency scope
this spec commits to; the design doc's Transport/Global lock options (§65)
are not implemented, since nothing in this codebase's driver behavior today
requires them. Each job calls `PrinterService.print(job.printerId,
job.document)` (new method on `PrinterService`, mirroring `testPrint`'s
`getDriver(config.protocol).print(printerId, document)` shape). On failure,
`job.status = 'failed'`, `job.retryCount` unchanged (retry is a caller
action, not automatic — matches design doc §60, retry re-enqueues the same
job id rather than creating a new one). `ENCODING_FAILED` results (thrown
before any transport write) are marked `failed` without a retry
recommendation in the UI — retrying a document that failed to encode will
fail identically.

Reprint (design doc §61) creates a new `PrintJob` with a new `id` from the
same `PrintPlan`; it does not touch the original job.

## 5. Destination & Rule storage and evaluation

`services/DestinationService.ts`, `services/PrintRuleService.ts` — plain
storage CRUD over `StorageService`, same shape as `PrinterService`'s
`getPrinters`/`addPrinter`/`updatePrinter`/`removePrinter`/`setDefault`
(read full list, mutate, write full list back; no partial-update API).
`store/destinationSlice.ts`, `store/printRuleSlice.ts` — Redux cache slices
mirroring `printerSlice`'s `printersLoaded`/`*Upserted`/`*Removed` action
shapes.

Effective-printer resolution (`Destination.enabled && Printer.enabled`) is a
plain selector/helper, not a new service method — it composes
`selectDestinations`/`selectPrinters` from the two slices directly.

Rule evaluation (`services/evaluatePrintRules.ts`): given ordered
`PrintRule[]` and a subject to test conditions against, conditions within
one rule are AND-combined; rules are evaluated in `priority` order; two
enabled rules with equal priority whose conditions both match the same
subject is rejected as invalid configuration at save time (validated in the
Rule form, not at evaluation time) — evaluation itself assumes the saved
configuration is already unambiguous, per design doc §49. No match falls
through to `PrintRoutingConfiguration.defaultDestinationId`; no default
configured is a routing error surfaced to the caller.

## 6. `OrderPrintPlanner` (stub)

`services/OrderPrintPlanner.ts`:

```ts
export interface OrderPrintPlanner {
  createPlans(order: Order): Promise<PrintPlan[]>;
}
```

`types/order.types.ts` (placeholder, minimal): `Order { items: OrderItem[] }`,
`OrderItem { name: string; category: string; qty: number }` — just enough
shape for the interface to compile and for a later spec to extend once
`sales` has a real cart model. No implementation of `createPlans` — it is
not called from any UI in this iteration. This interface, and the
`order.types.ts` placeholder, are expected to be replaced (not just filled
in) once a real Order/cart type exists; nothing else in this spec depends on
their internals.

## 7. Error codes

Current `AppErrorCode` (`src/types/AppError.ts`) is
`'VALIDATION_ERROR' | 'CONNECTION_ERROR' | 'UNSUPPORTED_CONNECTION' | 'PRINT_ERROR' | 'UNKNOWN_ERROR'`.
This spec adds exactly two, each justified by a behavioral difference the
existing codes cannot express — not the design doc's full 10-code list,
which this repo's existing error taxonomy already mostly covers:

- `NO_AVAILABLE_PRINTER` — terminal `PrintService.print()` outcome when a
  destination has no usable printer; distinct from `PRINT_ERROR` because the
  UI messaging is different ("chưa cấu hình máy in nào cho điểm in này" vs.
  "in thất bại") and no job was ever attempted.
- `ENCODING_FAILED` — thrown by a driver's `print()` before any transport
  write is attempted; distinct from `PRINT_ERROR` because
  `PrintScheduler` uses it to decide a job is not worth suggesting retry for.

`PRINTER_DISABLED` from the design doc is not added: disabled printers are
filtered out of "effective printers" before a job is ever created (§5), so
no code path produces this as a job-level error. `CONNECTION_FAILED`/
`CONNECTION_TIMEOUT`/`UNSUPPORTED_PROTOCOL`/`INVALID_CONFIGURATION`/
`PRINT_FAILED` all fold into the existing `CONNECTION_ERROR`/
`UNSUPPORTED_CONNECTION`/`VALIDATION_ERROR`/`PRINT_ERROR` — this repo's
codes are already outcome-level, not failure-mode-level, and nothing in
this spec needs finer granularity than that.

## 8. UI

- Printer Management list (existing screen): add the Enable/Disable switch
  from §1.
- New `PrinterDestinationScreen` — list + add/edit `PrintDestination`
  (printer picklist ordered = priority, fanout mode radio). "Test Print"
  here sends a fixed sample `PrintDocument` through the real
  `PrintService.print()` path (design doc §35 — test print must go through
  production pipeline, not a separate code path), so it is verifiable
  end-to-end without `sales` having any cart data.
- New `PrintRoutingScreen` — rule list (condition builder, priority,
  destination, default destination picker).
- Neither screen gets a `.test.ts` file (pure presentational + form
  screens), per this repo's existing convention — only the services/slices/
  encoders above do.

## Testing

- `.test.ts` for: `PrintService`, `PrintScheduler`, `evaluatePrintRules`,
  `destinationSlice`, `printRuleSlice`, `EscPosTextComposer`, `TsplEncoder`'s
  new `image()` method, `PrinterService.print`/`setEnabled` additions,
  `printerSlice`'s new reducer.
- No test files for the two new UI screens or for `OrderPrintPlanner`'s
  empty stub.

## Out of scope

- Vendor SDK / built-in printer drivers (Sunmi, iMin) — confirmed out of
  scope this session; already removed from
  `docs/design/features/printer-management.md`.
- Real Order/cart integration and `OrderPrintPlanner`'s actual grouping
  logic — `sales` has no cart model yet; this is explicitly deferred to a
  follow-up spec, not attempted here even partially.
- ZPL protocol/encoder — no ZPL device exists to validate against; adding it
  speculatively was already rejected when the design doc was corrected.
- `image`/`barcode`/`qrCode` printing on `ThermalReceiptDriver` — the
  underlying library exposes no API for them; adding that would mean
  switching libraries, which is unrelated to this spec.
- Transport-scope or global-scope print locking — no evidence yet that
  per-printer serialization is insufficient; `PrintScheduler`'s public
  interface (`enqueue(job)`) does not preclude adding this later.
- `PrinterDefinition`/detection-registry-driven `supportedConnections`
  validation (design doc §25-29) — unrelated to the Printing half of the
  system; not touched by this spec.
