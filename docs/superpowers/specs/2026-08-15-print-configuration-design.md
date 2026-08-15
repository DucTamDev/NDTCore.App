# Print Configuration — Receipt/Label Print Setup

## Context

This spec **replaces** `docs/superpowers/specs/2026-08-14-printer-printing-system-design.md` (the `PrintDestination`/`PrintRule`/`OrderPrintPlanner` category-routing design). That design was fully implemented across 16 tasks on branch `feat/printer-printing-system` and pushed as a PR — **not merged**, and per this session's decision it will not be. The routing/category-based approach was more than the actual requirement calls for: this business only needs two fixed content types (Hoá đơn/Receipt, Tem/Label) sent to whichever printers are marked default for that type — no per-item category dispatch, no user-created named "destinations", no rule engine.

This branch, `feat/print-configuration`, forks from the tip of `feat/printer-printing-system` rather than `main`, specifically to keep the layer that has nothing to do with routing and is already built, tested, and reviewed there: `IPrinterDriver.print()` (both `TsplDriver` and `EscPosDriver`), `PrinterService.print()` (already auto-connects, fixed in that branch's final review), `PrintScheduler` (per-printer serialized queue), `Printer.enabled`, and the `PrintDocument`/`PrintElement`/`PrintJob`/`PrintResult` types. Everything specific to `PrintDestination`/`PrintRule`/`OrderPrintPlanner` is removed (§1).

**Note on `PrinterConfig.isDefault`:** this field and `PrinterService.setDefault()`/`getDefaultPrinterId()` already exist and predate all of this work — a single global "default printer" concept, unrelated axis from this spec's per-`PrintType` multi-default concept. Left untouched; `PrintConfiguration.isDefault` is a separate, independently-scoped flag.

## Goals

- `PrintType = 'Receipt' | 'Label'` — fixed for now, the type itself must not block adding more later (e.g. `KitchenTicket`).
- `PrintConfiguration` — flat list of `{printType, printerId, isDefault, isEnabled}`, replacing `PrintDestination`+`PrintRule` entirely.
- `PrintService.print(printType, document)` — always broadcasts to every enabled-and-default printer for that type; no failover, no per-destination fanout mode (per the user's own spec §19-20: multiple defaults *is* how broadcast is expressed, no separate setting).
- Checkout sends **one** receipt document for the whole order to all default Receipt printers — no more grouping items by resolved destination.
- One Settings screen ("Thiết lập in") with two fixed sections (Hoá đơn / Tem), each a printer checklist with a default toggle.
- "In tem" (Label print) stays configuration-only this round — no trigger button, no content-fetch API wiring. Explicitly deferred, not attempted partially.

## 1. Remove

Delete outright (all from the `feat/printer-printing-system` tip this branch forked from):

- `src/features/printer/types/destination.types.ts`
- `src/features/printer/services/DestinationService.ts` (+ `.test.ts`)
- `src/features/printer/store/destinationSlice.ts` (+ `.test.ts`)
- `src/features/printer/types/printRule.types.ts`
- `src/features/printer/services/PrintRuleService.ts` (+ `.test.ts`)
- `src/features/printer/store/printRuleSlice.ts` (+ `.test.ts`)
- `src/features/printer/services/evaluatePrintRules.ts` (+ `.test.ts`)
- `src/features/printer/services/OrderPrintPlanner.ts` (+ `.test.ts`)
- `src/features/printer/types/order.types.ts`
- `src/features/printer/components/PrintDestinationPanel.tsx`
- `src/features/printer/components/PrintRoutingPanel.tsx`
- `src/features/printer/services/PrintService.ts` (+ `.test.ts`) — rewritten from scratch in §4, not edited in place, since its whole resolution model changes
- `src/features/printer/types/printJob.types.ts`'s `PrintPlan` interface (the file itself stays — `PrintJob`/`PrintResult` are kept, see §2)

Revert in `src/store/index.ts`: remove the `destination`/`printRule` reducer entries and imports (added by the old branch's Task 6/7), keep everything else.

Revert in `src/features/settings/store/settingsSlice.ts`/`config/settingsConfig.ts`/`components/SettingsContent.tsx`: remove the `'printDestination'`/`'printRouting'` `SettingsMenuKey` members, their `settingsMenuItems` entries, and their `SettingsContent` render branches (added by the old branch's Task 14/16) — §6 adds one new entry (`'printConfiguration'`) in their place.

`src/features/cart/types/cart.types.ts`'s `'Delivery'` `ServiceType` addition (old Task 15) is **kept** — it's a real business value unrelated to print routing, harmless to leave.

## 2. Kept types, one rename

`src/features/printer/types/printDocument.types.ts` — unchanged (`PrintDocument`, `PrintElement` union).

`src/features/printer/types/printJob.types.ts` — drop `PrintPlan` (no longer exists); rename `PrintJob.planId` to `PrintJob.requestId: string` — it no longer refers to a `PrintPlan.id` (that type is gone), but the grouping concept survives: one `PrintService.print()` call generates one `requestId` (via `generateId()`) shared by every `PrintJob` it fans out to that call, still useful for retry/reprint bookkeeping.

```ts
export type PrintJobStatus = 'pending' | 'printing' | 'success' | 'failed' | 'cancelled';

export interface PrintJob {
  id: string;
  requestId: string;
  printerId: string;
  document: PrintDocument;
  status: PrintJobStatus;
  retryCount: number;
  error?: AppError;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type PrintResultStatus = 'success' | 'partial-failure' | 'failed' | 'no-available-printer';

export interface PrintResult {
  status: PrintResultStatus;
  jobs: PrintJob[];
  error?: AppError;
}
```

`AppErrorCode` (`src/types/AppError.ts`) is unchanged — `NO_AVAILABLE_PRINTER`/`ENCODING_FAILED`/etc. from the old branch all still apply to this simpler model as-is.

## 3. `PrintConfiguration` type + service + slice

New `src/features/printer/types/printConfiguration.types.ts`:

```ts
export type PrintType = 'Receipt' | 'Label';

export interface PrintConfiguration {
  id: string;
  printType: PrintType;
  printerId: string;
  isDefault: boolean;
  isEnabled: boolean;
}
```

New `src/features/printer/services/PrintConfigurationService.ts`, mirroring `PrinterService`'s plain storage-CRUD shape (`getAll`/`add`/`update`/`remove`, read-full-list/mutate/write-back), storage key `'printConfiguration.list'`:

```ts
getAll(): PrintConfiguration[]
upsert(config: PrintConfiguration): void
remove(id: string): void
getDefaultPrinterIdsForType(printType: PrintType): string[]
```

`getDefaultPrinterIdsForType` is the one method `PrintService` actually needs: filters to `printType` match + `isDefault && isEnabled`, returns `printerId[]`. It does **not** cross-reference `Printer.enabled` — that's `PrintService`'s job (§4), same separation-of-concerns the old branch already established (`PrintConfigurationService` doesn't know about `PrinterService`).

**No Redux slice.** The old branch's final review flagged `destinationSlice`/`printRuleSlice` as dead code — nothing ever dispatched into them, because `PrinterManagementPanel.tsx` (the established pattern this feature's panel follows, §6) keeps its own list in local `useState` and re-reads from the service after every mutation, not from Redux. Adding `printConfigurationSlice` here would repeat that exact, already-identified mistake. `PrintConfigurationService.getAll()` is the only read path; the panel and `PrintService` both call it directly.

## 4. `PrintService` (rewritten)

New `src/features/printer/services/PrintService.ts`:

```ts
print(printType: PrintType, document: PrintDocument): Promise<PrintResult>
```

```ts
export const createPrintService = (deps: PrintServiceDeps) => {
  const effectivePrinterIds = (printType: PrintType): string[] => {
    const configuredIds = new Set(deps.getDefaultPrinterIdsForType(printType));
    return deps.getPrinters()
      .filter((p) => p.enabled && configuredIds.has(p.id))
      .map((p) => p.id);
  };

  const print = async (printType: PrintType, document: PrintDocument): Promise<PrintResult> => {
    const printerIds = effectivePrinterIds(printType);
    if (printerIds.length === 0) {
      return {
        status: 'no-available-printer',
        jobs: [],
        error: { code: 'NO_AVAILABLE_PRINTER', message: `Chưa thiết lập máy in cho ${printType === 'Receipt' ? 'Hoá đơn' : 'Tem'}` },
      };
    }
    const requestId = generateId();
    const jobs = await Promise.all(
      printerIds.map((printerId) =>
        deps.scheduler.enqueue({
          id: generateId(), requestId, printerId, document,
          status: 'pending', retryCount: 0, createdAt: new Date().toISOString(),
        }),
      ),
    );
    const successCount = jobs.filter((j) => j.status === 'success').length;
    const status = successCount === jobs.length ? 'success' : successCount === 0 ? 'failed' : 'partial-failure';
    return { status, jobs };
  };

  return { print };
};

export const PrintService = createPrintService({
  getDefaultPrinterIdsForType: PrintConfigurationService.getDefaultPrinterIdsForType,
  getPrinters: PrinterService.getPrinters,
  scheduler: PrintScheduler,
});
```

There is only one fanout shape now (always "broadcast" to every effective printer for that type — §20 of the user's spec: multiple defaults *is* the broadcast mechanism, no separate mode field). `no-available-printer` vs `failed` keeps the exact same distinction the old branch's review process found and fixed twice: empty effective list (no job ever attempted) is the only path that sets `result.error`; every printer failing after being tried is `'failed'` with per-job errors, no top-level `error`.

## 5. Checkout integration (simplified)

`src/features/cart/services/OrderPrintTrigger.ts` — `buildOrderFromCart`'s per-item `categoryId` lookup is gone (nothing consumes it anymore). Replace with a single document-builder:

```ts
export const buildReceiptDocument = (
  orderResponse: CreateOrderResponse,
  items: CartItem[],
  serviceType: ServiceType,
): PrintDocument => ({
  elements: [
    { type: 'text', content: `Đơn ${orderResponse.OrderNumber} · ${serviceType}`, x: 0, y: 0 },
    { type: 'line', x: 0, y: 20 },
    { type: 'table', rows: items.map((item) => [item.productName, String(item.quantity), item.note]), x: 0, y: 30 },
  ],
});

export const printReceipt = async (document: PrintDocument): Promise<{ unrouted: boolean }> => {
  try {
    const result = await PrintService.print('Receipt', document);
    return { unrouted: result.status === 'no-available-printer' };
  } catch (err) {
    LoggerService.warning(`In hoá đơn thất bại: ${String(err)}`);
    return { unrouted: false };
  }
};
```

`src/features/cart/hooks/useCheckout.ts`'s `submit()` keeps its exact non-blocking shape from the old branch (`printReceipt(document).then(...)` never `await`ed inside the `try` that returns `response.Data`) — only the call site changes from `triggerPrinting(order)` (which built an `Order` and fanned out per resolved destination) to `printReceipt(buildReceiptDocument(...))` (one document, one `PrintService.print('Receipt', ...)` call).

The old branch's `unroutedCount: number`/Snackbar wiring in `CartPanel.tsx` doesn't carry over as-is — it counted unrouted *items*, a concept that no longer exists (there's one receipt for the whole order, not N item-level plans). Replace it with a boolean: `useCheckout` returns `noReceiptPrinterConfigured: boolean` (set from `printReceipt(...)`'s `{unrouted}` result) and `dismissReceiptPrinterWarning: () => void`, and `CartPanel.tsx`'s Snackbar text changes from the old `` `${unroutedCount} món chưa có cấu hình in` `` to a fixed string: `'Chưa thiết lập máy in cho Hoá đơn'`.

`src/features/printer/types/order.types.ts` (`Order`/`OrderItem`) is deleted — nothing needs a structured `Order` anymore, `buildReceiptDocument` takes the cart's own types directly.

## 6. UI: "Thiết lập in"

New `src/features/printer/components/PrintConfigurationPanel.tsx`, following `PrinterManagementPanel.tsx`'s established pattern (local `useState` + `refresh`, no premature Redux subscription):

- Two fixed sections, "Hoá đơn" and "Tem" (not user-created/named — `PrintType` is a closed union, so the UI iterates over exactly `['Receipt', 'Label']` with fixed Vietnamese labels, never a dynamic list).
- Each section lists every printer from `PrinterService.getPrinters()` as a single checkbox row — matching the user's own spec mockup (§8-9) exactly: **one** checkbox per printer, no separate "included" vs "default" toggle. Checking it upserts `{printType, printerId, isDefault: true, isEnabled: true}`; unchecking removes that `PrintConfiguration` row entirely — there's no UI state in this panel for "configured but off," so don't invent storage for a distinction the UI never exposes. `isEnabled` stays on the type for `PrintService`/a future screen to use, but this panel always writes `true` alongside `isDefault: true`.
- Saving calls `PrintConfigurationService.upsert(...)`/`remove(...)` immediately per checkbox toggle; no batch/"Lưu" button — matches the checklist UI in the user's own spec (§8-9), which shows immediate checkbox state, not a staged form.
- No printer-count validation UI (e.g. "must pick at least one") — per user's spec §8, that's a soft recommendation, not enforced; `PrintService.print()` already handles zero-configured gracefully via `NO_AVAILABLE_PRINTER`.

Wire into Settings: `SettingsMenuKey` gains `'printConfiguration'` (replacing the removed `'printDestination'`/`'printRouting'`), one `settingsMenuItems` entry (`label: 'Thiết lập in'`), one `SettingsContent` branch.

## Testing

- `.test.ts` for: `PrintConfigurationService`, `PrintService` (empty-list/no-available-printer, all-succeed, partial-failure, all-fail — same shape of cases the old branch's `PrintService.test.ts` already had, minus the failover-specific cases which no longer apply), `buildReceiptDocument`, `printReceipt` (fire-and-forget contract, mirroring the old branch's `OrderPrintTrigger.test.ts` coverage).
- No `.test.ts` for `PrintConfigurationPanel.tsx` (pure presentational + form panel, per this repo's convention) or `useCheckout.ts` itself (same hook-testing-infrastructure gap noted in the prior spec — unchanged, still out of this repo's reach without a new dependency).

## Out of scope

- "In tem" trigger button, wherever it ends up living, and the API call that fetches label content — explicitly deferred per this session's decision; `PrintType = 'Label'` and its `PrintConfiguration` rows exist and are configurable today, nothing consumes them yet.
- Any additional `PrintType` beyond Receipt/Label (`KitchenTicket`, `PackingSlip`, ...) — the union is written to make adding one a small change, not to add one now.
- Category/product/service-type-based routing in any form — this is the thing this spec exists to remove, not to rebuild in a smaller shape.
- Automatic failover between printers — per the user's own spec §19, retry is manual and per-job; no policy for silently trying a different printer on failure.
- Editing/deleting individual `PrintConfiguration` rows beyond checkbox toggling in the one panel — there's no separate list/detail view, since rows are 1:1 with a `(printType, printerId)` pair the checklist already fully represents.
