# Printer-Core Document Presets — Design Spec

## Goal

`packages/printer-core` has no concept of a reusable document template today —
every `LabelBuilder`/`ReceiptBuilder` is built from scratch by chained method
calls. This adds a `presets/` module: typed, data-only starting points for
common label/receipt shapes (product label, topping label, standard receipt,
compact receipt, plus a bare default for each), so a caller can go from
"I have this order's data" to a ready `LabelBuilder`/`ReceiptBuilder` in one
call instead of hand-writing the layout every time.

## Scope boundary

This lives entirely in `packages/printer-core` and stays framework-agnostic,
data-only — no persistence, no "clone into a saved config the user can edit,"
no UI. That workflow (cloning a preset into a user-editable, storable
template) belongs to the app layer (`src/features/printer`) in a later,
separate piece of work, built on top of what this spec defines. This spec
does not design that layer.

## Types

Two new interfaces, one per document kind — mirroring `LabelBuilder`'s
`PrintDocument` config and `ReceiptBuilder`'s `Omit<PrintDocument, 'height'>`
config exactly, so a preset's `config` is always a complete, print-ready
document configuration (not `Partial` — a preset that can't fully specify its
own paper config isn't a usable starting point).

```ts
// presets/LabelPreset.ts
export interface LabelPreset<TVars> {
  config: PrintDocument;
  build(vars: TVars): PrintElement[];
}

// presets/ReceiptPreset.ts
export interface ReceiptPreset<TVars> {
  config: Omit<PrintDocument, 'height'>;
  build(vars: TVars): PrintElement[];
}
```

`TVars` is the preset's own input shape — the real, dynamic data a caller
supplies (product name, order items, etc.). Splitting `config` from
`build(vars)` lets a caller read a preset's paper/dpi requirements (e.g. to
show "this preset needs 40×30mm label stock" in a picker UI) before it has
real data to build with.

## `PrintBuilder.append()` — new method

`build(vars)` returns a plain `PrintElement[]`; there is currently no way to
push a whole array onto a `PrintBuilder` at once (every existing method adds
exactly one element). Adds one more chain method, same shape as its 15
siblings:

```ts
// builder/PrintBuilder.ts
append(elements: PrintElement[]): this {
  this.elements.push(...elements);
  return this;
}
```

## Applying a preset

Two helper functions, `presets/applyPreset.ts`:

```ts
export function applyLabelPreset<TVars>(
  preset: LabelPreset<TVars>,
  vars: TVars,
  overrides?: Partial<PrintDocument>,
): LabelBuilder {
  return new LabelBuilder({ ...preset.config, ...overrides }).append(preset.build(vars));
}

export function applyReceiptPreset<TVars>(
  preset: ReceiptPreset<TVars>,
  vars: TVars,
  overrides?: Partial<Omit<PrintDocument, 'height'>>,
): ReceiptBuilder {
  return new ReceiptBuilder({ ...preset.config, ...overrides }).append(preset.build(vars));
}
```

`overrides` lets a caller tweak paper config (e.g. a different `dpi` for a
specific physical printer) without forking the preset. The returned builder
is a normal `LabelBuilder`/`ReceiptBuilder` — callers can chain further
`.text()`/`.cut()`/etc. calls on it, or call `.resolve()` directly.

## Folder structure

```
presets/
├── LabelPreset.ts
├── ReceiptPreset.ts
├── applyPreset.ts
├── index.ts
├── label/
│   ├── DefaultLabelPreset.ts
│   ├── ProductLabelPreset.ts
│   └── ToppingLabelPreset.ts
└── receipt/
    ├── DefaultReceiptPreset.ts
    ├── StandardReceiptPreset.ts
    └── CompactReceiptPreset.ts
```

`index.ts` re-exports everything (`export *`), matching every other
subsystem's barrel convention in this package.

## The 6 presets

All label presets use one shared paper size, 40×30mm at 203dpi (≈320×240
dots) — `ProductLabelPreset` and `ToppingLabelPreset` are the same physical
label stock with different layouts, not different sizes. All receipt presets
use 58mm continuous paper at 203dpi.

### `DefaultLabelPreset`

`LabelPreset<Record<string, never>>` — no variables (same
`Record<string, never>` convention `PageBreakOptions` already uses in this
package for "no fields"). `config: { width: 40, height: 30, unit: 'mm', dpi: 203 }`.
`build: () => []` — a blank label at the standard size, nothing prefilled.

### `DefaultReceiptPreset`

`ReceiptPreset<Record<string, never>>`. `config: { width: 58, unit: 'mm', dpi: 203 }`.
`build: () => []` — blank continuous receipt, nothing prefilled.

### `ProductLabelPreset`

```ts
interface ProductLabelVars {
  productName: string;
  size?: string;
  price: number;
  sku: string;
  note?: string;
}
```

`config`: 40×30mm, 203dpi (as above). `build(vars)`:

1. `text(vars.productName, { x: 8, y: 8, bold: true, size: 2 })`
2. `text(vars.size, { x: 8, y: 40 })` — only when `vars.size` is set
3. `text(formatCurrency(vars.price), { x: 8, y: 65, bold: true, size: 2 })`
4. `barcode({ x: 8, y: 100, symbology: 'code128', content: vars.sku, height: 60, readable: true })`
5. `text(vars.note, { x: 8, y: 170 })` — only when `vars.note` is set

`formatCurrency` is a small local helper in this preset file (e.g.
`${value.toLocaleString('vi-VN')}đ`) — not a shared utility, since no other
preset needs currency formatting yet.

### `ToppingLabelPreset`

```ts
interface ToppingLabelVars {
  toppingName: string;
  drinkName?: string;
  sweetness?: string;
  ice?: string;
  note?: string;
}
```

`config`: same 40×30mm, 203dpi as `ProductLabelPreset`. `build(vars)`:

1. `text(vars.toppingName, { x: 8, y: 8, bold: true, size: 2 })`
2. `text(vars.drinkName, { x: 8, y: 40 })` — only when set
3. `text(sweetnessIceLine(vars), { x: 8, y: 70 })` — only when at least one
   of `sweetness`/`ice` is set; joins whichever are present, e.g.
   `"Ngọt: 50% | Đá: ít"` or just `"Đá: ít"` if only `ice` is given
4. `text(vars.note, { x: 8, y: 100 })` — only when set

### `StandardReceiptPreset`

```ts
interface StandardReceiptVars {
  storeName: string;
  orderNumber: string;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number;
  cashier?: string;
  timestamp: string;
}
```

`config`: 58mm, 203dpi (as `DefaultReceiptPreset`). `build(vars)` — every
`text()` below omits `x`/`y` (continuous-paper text flows top-to-bottom in
call order; only `align` is set where centering matters):

1. `text(vars.storeName, { align: 'center', bold: true, size: 2 })`
2. `text('-'.repeat(32))` — plain-text divider (thermal-receipt convention;
   no `line` element, since that needs absolute coordinates this preset
   doesn't track)
3. `text('Mã đơn: ' + vars.orderNumber)`
4. `text('Thời gian: ' + vars.timestamp)`
5. `text('-'.repeat(32))`
6. `table({ columns: [{ width: 16 }, { width: 6, align: 'center' }, { width: 10, align: 'right' }], rows: vars.items.map(i => [i.name, String(i.qty), formatCurrency(i.price)]) })`
   — `ReceiptColumn.width` is in characters (per `alignText()`), matching
   the 32-char divider lines above/below (16+6+10=32): name / qty / price.
7. `text('-'.repeat(32))`
8. `text('Tổng cộng: ' + formatCurrency(vars.total), { bold: true, align: 'right' })`
9. `text('Thu ngân: ' + vars.cashier)` — only when `vars.cashier` is set
10. `text('Cảm ơn quý khách!', { align: 'center' })`
11. `cut()`

### `CompactReceiptPreset`

Same `StandardReceiptVars` shape (no separate interface — reuses
`StandardReceiptVars`, importing it from `StandardReceiptPreset.ts`), minus
the store header, cashier line, and thank-you line, to minimize paper length:

1. `text('Mã đơn: ' + vars.orderNumber)`
2. `table({ columns: [{ width: 16 }, { width: 6, align: 'center' }, { width: 10, align: 'right' }], rows: vars.items.map(i => [i.name, String(i.qty), formatCurrency(i.price)]) })`
3. `text('Tổng cộng: ' + formatCurrency(vars.total), { bold: true, align: 'right' })`
4. `cut()`

## Testing

One test file per preset (`presets/label/__tests__/ProductLabelPreset.test.ts`
etc.), following this package's established real-assertion convention (no
vacuous "doesn't throw" checks):

- Call `build(vars)` with representative sample data; assert the returned
  array's length and, for each element, its `type` plus the specific field
  values that matter (e.g. `barcode` element's `options.content === sku`,
  table `rows` match the formatted item data).
- Call `build(vars)` with optional fields omitted; assert the
  optional-field elements are genuinely absent (not present-with-empty-string).
- One test per preset for `applyLabelPreset`/`applyReceiptPreset`: assert the
  returned builder's `.resolve()` produces a `ResolvedPrintDocument` with the
  preset's expected `widthDots`/`heightDots` and the right element count.
- `PrintBuilder.append()` gets its own small test in
  `builder/__tests__/PrintBuilder.test.ts` (or a new test file if that
  doesn't exist yet): pushes a multi-element array, asserts all elements
  land in order.

## Open items for the implementation plan (not decided here)

- Exact dot positions above are a reasonable starting layout, not
  pixel-verified against real hardware — same "documented, not
  hardware-verified" honesty this package already uses elsewhere (e.g. IPL's
  image format). Flag as such in the code comments; refine after visual
  testing.
- `formatCurrency`'s exact formatting (`vi-VN` locale, `đ` suffix) is a
  reasonable default given this is a Vietnamese POS system — confirm with
  the user during plan review if a different convention is wanted.
