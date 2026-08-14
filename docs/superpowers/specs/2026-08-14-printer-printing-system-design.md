# Printer Printing System — Destination, Routing, Print Execution

## Context

The printer module today (`src/features/printer/`) only covers Printer
Management: `PrinterConfig` storage, `PrinterService` (hardware
connect/disconnect/status), `DriverRegistry`, and per-driver `testPrint()`
with fixed content (`EscPosDriver`, `TsplDriver`). There is no way to
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

Correction from this spec's first draft: `sales`/`cart` was assumed to have
no order data yet (based on this repo's `CLAUDE.md`, which turned out to be
stale — it was not updated after cart-checkout was merged to `main`).
`src/features/cart/` actually exists with a real checkout flow:
`useCheckout.ts` builds a `CreateOrderRequest` from `CartItem[]` and calls
`orderApi.createOrderAsync`; on success it dispatches `cartCleared()` and
returns `CreateOrderResponse` (`Id`, `OrderNumber`, ...) to the caller.
Neither `CartItem` nor `CreateOrderItemRequest` carries `categoryId` — only
`ProductViewModel`/`PosProductDto` in `src/features/catalog/` do, keyed by
`productId`. So `OrderPrintPlanner` is implemented for real in this spec
(§6), and category-based routing conditions are resolved by joining checked-
out items against the catalog's `selectProducts` at the point printing is
triggered — not stored redundantly on the cart item itself.

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
- `OrderPrintPlanner` — real implementation: groups a checked-out order's
  items by resolved `PrintRule` destination, wired into `useCheckout.ts` so
  a successful checkout triggers printing non-blockingly.

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
- `printRule.types.ts` — `PrintRule { id, conditions: PrintCondition[], destinationId, priority: number, enabled: boolean }`, `PrintRoutingConfiguration { rules: PrintRule[], defaultDestinationId?: string }`. `PrintCondition` is a discriminated union tied to the two fields actually available on an order item at print-planning time (§6), not a generic `{field: string, value: string}` bag: `{ field: 'categoryId'; value: number } | { field: 'serviceType'; value: ServiceType }` (`ServiceType` reused from `src/features/cart/types/cart.types.ts`). Conditions within one rule are AND-combined (design doc §47-48).
- `printDocument.types.ts` — `PrintDocument { elements: PrintElement[] }`, `PrintElement` discriminated union: `{type:'text', content, x, y}` / `{type:'image', data, x, y}` / `{type:'barcode', content, x, y}` / `{type:'qrCode', content, x, y}` / `{type:'line', x, y}` / `{type:'table', rows: string[][], x, y}`. No `width`/`height`/`template` fields on `PrintDocument` (the design doc's sketch had them) — nothing in this repo derives paper geometry from the document; `PrinterConfig.paperSize` already owns that.
- `printJob.types.ts` — `PrintPlan { id, destinationId, document: PrintDocument, copies: number }`, `PrintJob { id, planId, printerId, document: PrintDocument, status: 'pending'|'printing'|'success'|'failed'|'cancelled', retryCount, error?: AppError, createdAt, startedAt?, completedAt? }`, `PrintResult { status: 'success' | 'partial-failure' | 'failed' | 'no-available-printer'; jobs: PrintJob[] }` — `jobs` is empty only when `status === 'no-available-printer'` (§4), since that is the one outcome with no job ever created.

## 3. `IPrinterDriver.print()` and per-driver encoding

`types/driver.types.ts` gains one method:

```ts
print(printerId: string, document: PrintDocument): Promise<void>;
```

**Correction from this spec's earlier draft:** the ESC/POS driver was
initially described as `ThermalReceiptDriver.ts` using
`@poriyaalar/react-native-thermal-receipt-printer`, with no image/barcode
API. That was wrong for this branch: `ThermalReceiptDriver` only exists on
the separate, not-yet-merged branch `feat/thermal-receipt-printer-driver`
(12 commits ahead of `main` at time of writing). `feat/printer-printing-system`
branched from `main`, where the real ESC/POS driver is still
`src/features/printer/drivers/EscPosDriver.ts`, backed by
`react-native-esc-pos-printer` v4.5.0 (the Epson ePOS2 SDK wrapper this
package.json pins) — confirmed against that library's own docs
(github.com/tr3v3r/react-native-esc-pos-printer), not assumed. **If
`feat/thermal-receipt-printer-driver` merges to `main` before this branch
does, `EscPosDriver.ts` will be deleted and Task implementing this section
must be re-targeted at `ThermalReceiptDriver.ts` instead** — flag this to
the user at execution time if it happens; this spec does not attempt to
predict or avoid that merge-order risk.

The two drivers encode `PrintDocument` differently, because their
underlying libraries are shaped differently — this is not a design choice,
it is a constraint already visible in the existing code:

- **`TsplDriver`**: writes raw bytes over a `Transport`
  (`protocols/TsplEncoder.ts` → `Uint8Array` → `UsbTransport`/
  `BluetoothTransport`/`LanTransport`). `TsplEncoder` gains an `image(x, y, data)`
  method (TSPL `BITMAP` command); `table` and `line` elements map to
  repeated `text()` calls — no new TSPL primitive needed.
- **`EscPosDriver`**: has no raw-byte access either, but unlike the
  thermal-receipt library, `react-native-esc-pos-printer`'s `Printer` class
  is already a full builder covering every `PrintElement` kind this spec
  needs: `addText`, `addImage(params: AddImageParams)`,
  `addBarcode(params: AddBarcodeParams)`, `addSymbol(params: AddSymbolParams)`
  (2D/QR), `addFeedLine`, `addCut`, `sendData` — all `Promise<void>`,
  buffered until `sendData()` flushes. So **all six `PrintElement` kinds are
  supported** on this driver, reversing this spec's earlier "image/barcode/
  qrCode unsupported, skip silently" decision — that decision was made
  against the wrong library and does not hold once grounded in the real one.
  `print()` iterates `document.elements` in order, dispatching each to the
  matching `add*` call (`line` → `addText` with a fixed-width dashed rule;
  `table` → one `addText` per row, columns joined with padding), then
  `addFeedLine()` + `addCut()` + `sendData()` once at the end. No new
  `protocols/*.ts` file for ESC/POS — the SDK's `Printer` class already is
  the composition layer, the same way `testPrint()` already builds directly
  on it today.

Exact `AddImageParams`/`AddBarcodeParams`/`AddSymbolParams` field names are
not fully confirmed here — `react-native-esc-pos-printer` is not installed
in this checkout (`node_modules/react-native-esc-pos-printer` is absent) so
its shipped `.d.ts` could not be read directly; only the library's public
docs site was checked, which documents each method's existence and return
type but not every field. **Task implementing this must read
`node_modules/react-native-esc-pos-printer/lib/typescript/*.d.ts` (after
`npm install`) for the real field names before writing the `addImage`/
`addBarcode`/`addSymbol` call sites** — this is a verification step, not an
open design question; the method choice itself (use the SDK's builder
directly, no custom encoder) is decided.

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

- Empty effective-printer list (before any job is created): result is
  `NO_AVAILABLE_PRINTER` — never silently returns success with nothing sent
  (design doc §44). This is the only case that produces
  `NO_AVAILABLE_PRINTER`, matching §7's definition exactly (no job was ever
  attempted).
- `failover`: try effective printers in array order; stop at first success.
  If every effective printer is tried and fails, result is `failed` (a
  `PrintJob` was created and attempted for each one) — **not**
  `NO_AVAILABLE_PRINTER`, since printers were available and jobs did run;
  the failure is a print failure, not a routing/config failure, and the UI
  message must say so (§7).
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

Rule evaluation (`services/evaluatePrintRules.ts`):

```ts
evaluatePrintRules(
  subject: { categoryId: number | null; serviceType: ServiceType },
  routing: PrintRoutingConfiguration,
): string | null // destinationId, or null if nothing matched and no default
```

Rules are evaluated in `priority` order; two enabled rules with equal
priority whose conditions both match the same subject is rejected as
invalid configuration at save time (validated in the Rule form, not at
evaluation time) — evaluation itself assumes the saved configuration is
already unambiguous, per design doc §49. No match falls through to
`routing.defaultDestinationId`; returning `null` (no default configured
either) is a routing error the caller (`OrderPrintPlanner`, §6) surfaces per
item, not a thrown exception — matching §6's per-item degrade rather than
failing the whole order.

## 6. `OrderPrintPlanner`

`types/order.types.ts` (real, built from the actual checkout data, not a
placeholder):

```ts
interface Order {
  id: number;
  orderNumber: string;
  serviceType: ServiceType;
  items: OrderItem[];
}

interface OrderItem {
  productId: number;
  productName: string;
  categoryId: number | null;
  quantity: number;
  note: string;
}
```

`services/OrderPrintPlanner.ts`:

```ts
createPlans(order: Order): Promise<PrintPlan[]>
```

Algorithm (design doc §51-52): for each `order.items[i]`, call
`evaluatePrintRules({categoryId: item.categoryId, serviceType: order.serviceType}, routing)`
(`routing` loaded via `PrintRuleService`, §5) to get a `destinationId`. Group
items by resolved `destinationId` into one `PrintDocument` per destination —
a header line (`order.orderNumber`, `order.serviceType`) followed by one
`table` element row per item (`productName`, `quantity`, `note` if set).
Each group becomes one `PrintPlan { destinationId, document, copies: 1 }`.

Items that resolve to `null` (no matching rule, no default destination) are
**not** dropped silently and do not fail the whole order's printing either —
consistent with §3's element-level degrade precedent: they are collected
into the return value's companion `unrouted: OrderItem[]` (`createPlans`
returns `{ plans: PrintPlan[]; unrouted: OrderItem[] }`, not a bare array),
logged via `PrinterLogger` at `warn`, and surfaced by the caller (§below) via
a `Snackbar` (`react-native-paper`, same pattern `CartPanel.tsx` already uses
for its `error`/`successMessage` state) — "N món chưa có cấu hình in" — so a
misconfigured category doesn't silently vanish from the kitchen's view. If
every item is unrouted, `plans` is simply empty; the caller's Snackbar is the
only signal, there is no separate
`NO_AVAILABLE_PRINTER`-style hard failure at the planner level (that error
belongs to `PrintService.print()`, §4, once a plan is already routed to a
destination that then turns out to have no effective printer).

**Checkout integration** (`src/features/cart/hooks/useCheckout.ts`): after
`dispatch(cartCleared())`, call `OrderPrintPlanner.createPlans(order)` (built
from the `items`/`serviceType` already in the hook's closure plus
`response.Data`) then `PrintService.print(plan)` for each plan —
**fire-and-forget**, not awaited by `submit()`'s return. `submit()`
still resolves as soon as the order is created; print failures never change
`submit()`'s success/error result. Category resolution
(`item.productId` → `categoryId`) reads `selectProducts` from the catalog
store at the call site in `useCheckout.ts` (a `useSelector`/`store.getState()`
read, whichever this hook already uses for other cross-feature reads) —
`OrderPrintPlanner` itself takes `Order` with `categoryId` already resolved
and never touches the catalog store, keeping it a pure planning function
like `evaluatePrintRules`.

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
  production pipeline, not a separate code path), so Destination/Job/
  Scheduler are verifiable end-to-end independently of a real checkout,
  useful while §6's checkout wiring is still being built or tested.
- New `PrintRoutingScreen` — rule list (condition builder, priority,
  destination, default destination picker). The condition builder is not a
  free-text field/value form: category picks from `selectCategories`
  (catalog store, already loaded for the Sales screen) and stores
  `categoryId`; service type is a `DineIn`/`TakeAway` radio reusing
  `ServiceType` — matching `PrintCondition`'s concrete shape (§2).
- Neither screen gets a `.test.ts` file (pure presentational + form
  screens), per this repo's existing convention — only the services/slices/
  encoders above do.

## Testing

- `.test.ts` for: `PrintService`, `PrintScheduler`, `evaluatePrintRules`,
  `OrderPrintPlanner` (including the unrouted-items case and multi-item
  same-destination grouping), `destinationSlice`, `printRuleSlice`,
  `EscPosDriver.print()`'s per-`PrintElement`-kind dispatch (mock the SDK's
  `Printer` methods, assert each element type calls the right `add*`),
  `TsplEncoder`'s new `image()` method, `PrinterService.print`/`setEnabled`
  additions, `printerSlice`'s new reducer.
- `useCheckout.test.ts` (existing file, if present, otherwise new) gains a
  case: successful checkout calls `PrintService.print()` for each planned
  destination and `submit()` still resolves even if `PrintService.print()`
  rejects — asserting the fire-and-forget/non-blocking contract from §6, not
  just that the call happens.
- No test files for the two new UI screens (pure presentational/form).

## Out of scope

- Vendor SDK / built-in printer drivers (Sunmi, iMin) — confirmed out of
  scope this session; already removed from
  `docs/design/features/printer-management.md`.
- Reprint / print-history UI beyond the Destination screen's "Test Print"
  (§8) and the unrouted-items Snackbar (§6) — a dedicated screen listing past
  `PrintJob`s for manual reprint is a real future need but not designed here;
  §4's reprint semantics (new job id, same plan) are ready for one to be
  built on top of later.
- Editing `note`/quantity retroactively from a print failure Snackbar — the
  Snackbar in §6 is informational only, it does not open the order or cart for
  correction.
- ZPL protocol/encoder — no ZPL device exists to validate against; adding it
  speculatively was already rejected when the design doc was corrected.
- Verifying `AddImageParams`/`AddBarcodeParams`/`AddSymbolParams`' exact
  field shapes ahead of time — deferred to the implementing task reading the
  installed package's `.d.ts` directly (§3), not guessed here.
- Transport-scope or global-scope print locking — no evidence yet that
  per-printer serialization is insufficient; `PrintScheduler`'s public
  interface (`enqueue(job)`) does not preclude adding this later.
- `PrinterDefinition`/detection-registry-driven `supportedConnections`
  validation (design doc §25-29) — unrelated to the Printing half of the
  system; not touched by this spec.
