# Printer-Core Document Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `presets/` module to `packages/printer-core` — typed, data-only starting points (paper config + `build(vars)`) for common label/receipt documents, so a caller goes from real data to a ready `LabelBuilder`/`ReceiptBuilder` in one call.

**Architecture:** Two new interfaces (`LabelPreset<TVars>`, `ReceiptPreset<TVars>`) each pairing a complete `PrintDocument` config with a `build(vars): PrintElement[]` function. A new `PrintBuilder.append()` method plus `applyLabelPreset`/`applyReceiptPreset` helpers turn a preset + real data into a ready builder. Six concrete presets (2 blank defaults, 2 label, 2 receipt) ship as plain exported constants — no persistence, no UI, no runtime templating engine.

**Tech Stack:** TypeScript (strict), Jest.

**Spec:** `docs/superpowers/specs/2026-09-16-printer-core-presets-design.md`

## Global Constraints

- Framework-agnostic: no `react-native` import anywhere in `packages/printer-core/src/`.
- TypeScript strict, no `any` anywhere.
- No path aliases — relative imports only.
- Comments only when WHY isn't obvious — do not port verbose explanations for self-evident code.
- Tests: Jest, `__tests__/` sibling folders, run via root `npm test`.
- Type-check: `npm run type-check -w printer-core` AND root `npm run type-check` must both stay clean after EVERY task.
- Lint: root `npm run lint` must stay clean after every task.
- Do not modify `src/features/printer/` or any file outside `packages/printer-core/`.
- Never cite `src/features/printer` by path inside any comment shipped in `packages/printer-core/src/` (binding architectural-boundary rule for this whole package — research there if needed, never cite the path in a shipped comment).
- `presets/` is data-only: no persistence, no storage, no UI, no runtime string-templating/placeholder engine. A preset's `build(vars)` takes a real, typed TypeScript object — never a string with `{{placeholder}}` tokens.
- Dot positions in the label presets are a reasonable starting layout, not hardware-verified — say so in the code comments, don't overclaim precision.

---

### Task 1: `PrintBuilder.append()` + preset types + apply helpers

**Files:**
- Modify: `packages/printer-core/src/builder/PrintBuilder.ts`
- Test: `packages/printer-core/src/builder/__tests__/PrintBuilder.test.ts` (new)
- Create: `packages/printer-core/src/presets/LabelPreset.ts`
- Create: `packages/printer-core/src/presets/ReceiptPreset.ts`
- Create: `packages/printer-core/src/presets/applyPreset.ts`
- Test: `packages/printer-core/src/presets/__tests__/applyPreset.test.ts` (new)

**Interfaces:**
- Consumes: `PrintElement` (`../builder`), `PrintDocument` (`../document`), `LabelBuilder`/`ReceiptBuilder` (`../builder`) — all already exist.
- Produces: `PrintBuilder.append(elements: PrintElement[]): this`; `interface LabelPreset<TVars> { config: PrintDocument; build(vars: TVars): PrintElement[] }`; `interface ReceiptPreset<TVars> { config: Omit<PrintDocument, 'height'>; build(vars: TVars): PrintElement[] }`; `function applyLabelPreset<TVars>(preset: LabelPreset<TVars>, vars: TVars, overrides?: Partial<PrintDocument>): LabelBuilder`; `function applyReceiptPreset<TVars>(preset: ReceiptPreset<TVars>, vars: TVars, overrides?: Partial<Omit<PrintDocument, 'height'>>): ReceiptBuilder`.

- [ ] **Step 1: Write the failing test for `PrintBuilder.append()`**

```typescript
// packages/printer-core/src/builder/__tests__/PrintBuilder.test.ts
import { LabelBuilder } from '../LabelBuilder';

describe('PrintBuilder.append', () => {
  it('pushes every element from the array, in order', () => {
    const doc = new LabelBuilder({ width: 40, height: 30 })
      .append([
        { type: 'text', content: 'a', options: {} },
        { type: 'text', content: 'b', options: {} },
      ])
      .resolve();
    expect(doc.elements.map((e) => (e.type === 'text' ? e.content : undefined))).toEqual(['a', 'b']);
  });

  it('is chainable with other builder methods', () => {
    const doc = new LabelBuilder({ width: 40, height: 30 })
      .text('first', {})
      .append([{ type: 'text', content: 'second', options: {} }])
      .resolve();
    expect(doc.elements).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/printer-core/src/builder/__tests__/PrintBuilder.test.ts`
Expected: FAIL with `append is not a function` (or a TypeScript compile error if `tsc` runs first — either way, `append` doesn't exist yet).

- [ ] **Step 3: Implement `append()` in `PrintBuilder.ts`**

Add this method to the `PrintBuilder` class, after the existing `column()` method (keeps the file's declaration order matching `PrintElement`'s union order, with `append` last since it's not tied to one variant):

```typescript
  append(elements: PrintElement[]): this {
    this.elements.push(...elements);
    return this;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest packages/printer-core/src/builder/__tests__/PrintBuilder.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Write `LabelPreset.ts` and `ReceiptPreset.ts`**

```typescript
// packages/printer-core/src/presets/LabelPreset.ts
import type { PrintDocument } from '../document';
import type { PrintElement } from '../builder';

/**
 * A print-ready starting point for a `LabelBuilder` document: a complete
 * paper/dpi config plus a function that turns real data (`TVars`) into the
 * label's content elements. `config` is a full `PrintDocument`, not
 * `Partial` — a preset that can't fully specify its own paper config isn't
 * a usable starting point.
 */
export interface LabelPreset<TVars> {
  config: PrintDocument;
  build(vars: TVars): PrintElement[];
}
```

```typescript
// packages/printer-core/src/presets/ReceiptPreset.ts
import type { PrintDocument } from '../document';
import type { PrintElement } from '../builder';

/**
 * A print-ready starting point for a `ReceiptBuilder` document — same shape
 * as `LabelPreset`, but `config` omits `height` since continuous receipt
 * paper has no fixed length, matching `ReceiptBuilder`'s own constructor.
 */
export interface ReceiptPreset<TVars> {
  config: Omit<PrintDocument, 'height'>;
  build(vars: TVars): PrintElement[];
}
```

These two files have no runtime behavior (type-only) — no test needed for them individually; they're exercised through `applyPreset.test.ts` below and every concrete preset's own test.

- [ ] **Step 6: Write the failing test for `applyLabelPreset`/`applyReceiptPreset`**

```typescript
// packages/printer-core/src/presets/__tests__/applyPreset.test.ts
import { applyLabelPreset, applyReceiptPreset } from '../applyPreset';
import type { LabelPreset } from '../LabelPreset';
import type { ReceiptPreset } from '../ReceiptPreset';

describe('applyLabelPreset', () => {
  const preset: LabelPreset<{ name: string }> = {
    config: { width: 40, height: 30, unit: 'mm', dpi: 203 },
    build: (vars) => [{ type: 'text', content: vars.name, options: {} }],
  };

  it('builds a LabelBuilder with the preset config and built elements', () => {
    const doc = applyLabelPreset(preset, { name: 'Hello' }).resolve();
    expect(doc.elements).toEqual([{ type: 'text', content: 'Hello', options: {} }]);
    expect(doc.dpi).toBe(203);
  });

  it('applies overrides on top of the preset config', () => {
    const doc = applyLabelPreset(preset, { name: 'Hello' }, { dpi: 300 }).resolve();
    expect(doc.dpi).toBe(300);
  });

  it('returns a builder that can be extended with further chain calls', () => {
    const doc = applyLabelPreset(preset, { name: 'Hello' })
      .text('extra', {})
      .resolve();
    expect(doc.elements).toHaveLength(2);
  });
});

describe('applyReceiptPreset', () => {
  const preset: ReceiptPreset<{ line: string }> = {
    config: { width: 58, unit: 'mm', dpi: 203 },
    build: (vars) => [{ type: 'text', content: vars.line, options: {} }],
  };

  it('builds a ReceiptBuilder with the preset config and built elements', () => {
    const doc = applyReceiptPreset(preset, { line: 'Hi' }).resolve();
    expect(doc.elements).toEqual([{ type: 'text', content: 'Hi', options: {} }]);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx jest packages/printer-core/src/presets/__tests__/applyPreset.test.ts`
Expected: FAIL — `Cannot find module '../applyPreset'`.

- [ ] **Step 8: Implement `applyPreset.ts`**

```typescript
// packages/printer-core/src/presets/applyPreset.ts
import type { PrintDocument } from '../document';
import { LabelBuilder, ReceiptBuilder } from '../builder';
import type { LabelPreset } from './LabelPreset';
import type { ReceiptPreset } from './ReceiptPreset';

/** Builds a `LabelBuilder` from a preset's config + built elements, with optional config overrides applied on top. */
export function applyLabelPreset<TVars>(
  preset: LabelPreset<TVars>,
  vars: TVars,
  overrides?: Partial<PrintDocument>,
): LabelBuilder {
  return new LabelBuilder({ ...preset.config, ...overrides }).append(preset.build(vars));
}

/** Builds a `ReceiptBuilder` from a preset's config + built elements, with optional config overrides applied on top. */
export function applyReceiptPreset<TVars>(
  preset: ReceiptPreset<TVars>,
  vars: TVars,
  overrides?: Partial<Omit<PrintDocument, 'height'>>,
): ReceiptBuilder {
  return new ReceiptBuilder({ ...preset.config, ...overrides }).append(preset.build(vars));
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx jest packages/printer-core/src/presets`
Expected: PASS (4/4).

- [ ] **Step 10: Run full package verification**

```bash
npm run type-check -w printer-core
npm run type-check
npm run lint
npm test
```

All four must be clean.

- [ ] **Step 11: Commit**

```bash
git add packages/printer-core/src/builder/PrintBuilder.ts packages/printer-core/src/builder/__tests__/PrintBuilder.test.ts packages/printer-core/src/presets/LabelPreset.ts packages/printer-core/src/presets/ReceiptPreset.ts packages/printer-core/src/presets/applyPreset.ts packages/printer-core/src/presets/__tests__/applyPreset.test.ts
git commit -m "feat: add PrintBuilder.append() and preset apply helpers"
```

---

### Task 2: `DefaultLabelPreset` + `DefaultReceiptPreset`

**Files:**
- Create: `packages/printer-core/src/presets/label/DefaultLabelPreset.ts`
- Create: `packages/printer-core/src/presets/receipt/DefaultReceiptPreset.ts`
- Test: `packages/printer-core/src/presets/label/__tests__/DefaultLabelPreset.test.ts` (new)
- Test: `packages/printer-core/src/presets/receipt/__tests__/DefaultReceiptPreset.test.ts` (new)

**Interfaces:**
- Consumes: `LabelPreset<TVars>`, `ReceiptPreset<TVars>`, `applyLabelPreset`, `applyReceiptPreset` (Task 1).
- Produces: `DefaultLabelPreset: LabelPreset<Record<string, never>>`; `DefaultReceiptPreset: ReceiptPreset<Record<string, never>>`.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/printer-core/src/presets/label/__tests__/DefaultLabelPreset.test.ts
import { DefaultLabelPreset } from '../DefaultLabelPreset';
import { applyLabelPreset } from '../../applyPreset';

describe('DefaultLabelPreset', () => {
  it('has a 40x30mm 203dpi config and no prefilled elements', () => {
    expect(DefaultLabelPreset.config).toEqual({ width: 40, height: 30, unit: 'mm', dpi: 203 });
    expect(DefaultLabelPreset.build({})).toEqual([]);
  });

  it('applies to a resolvable blank label', () => {
    const doc = applyLabelPreset(DefaultLabelPreset, {}).resolve();
    expect(doc.elements).toEqual([]);
    expect(doc.widthDots).toBeGreaterThan(0);
  });
});
```

```typescript
// packages/printer-core/src/presets/receipt/__tests__/DefaultReceiptPreset.test.ts
import { DefaultReceiptPreset } from '../DefaultReceiptPreset';
import { applyReceiptPreset } from '../../applyPreset';

describe('DefaultReceiptPreset', () => {
  it('has a 58mm 203dpi config and no prefilled elements', () => {
    expect(DefaultReceiptPreset.config).toEqual({ width: 58, unit: 'mm', dpi: 203 });
    expect(DefaultReceiptPreset.build({})).toEqual([]);
  });

  it('applies to a resolvable blank receipt', () => {
    const doc = applyReceiptPreset(DefaultReceiptPreset, {}).resolve();
    expect(doc.elements).toEqual([]);
    expect(doc.widthDots).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest packages/printer-core/src/presets`
Expected: 2 new suites FAIL — `Cannot find module '../DefaultLabelPreset'` / `'../DefaultReceiptPreset'`.

- [ ] **Step 3: Implement both presets**

```typescript
// packages/printer-core/src/presets/label/DefaultLabelPreset.ts
import type { LabelPreset } from '../LabelPreset';

/** Blank 40x30mm label at 203dpi — the bare starting point for a new label, nothing prefilled. */
export const DefaultLabelPreset: LabelPreset<Record<string, never>> = {
  config: { width: 40, height: 30, unit: 'mm', dpi: 203 },
  build: () => [],
};
```

```typescript
// packages/printer-core/src/presets/receipt/DefaultReceiptPreset.ts
import type { ReceiptPreset } from '../ReceiptPreset';

/** Blank 58mm continuous receipt at 203dpi — the bare starting point for a new receipt, nothing prefilled. */
export const DefaultReceiptPreset: ReceiptPreset<Record<string, never>> = {
  config: { width: 58, unit: 'mm', dpi: 203 },
  build: () => [],
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest packages/printer-core/src/presets`
Expected: PASS (8/8 total across the `presets/` tree so far).

- [ ] **Step 5: Run full package verification**

```bash
npm run type-check -w printer-core
npm run type-check
npm run lint
npm test
```

- [ ] **Step 6: Commit**

```bash
git add packages/printer-core/src/presets/label/DefaultLabelPreset.ts packages/printer-core/src/presets/receipt/DefaultReceiptPreset.ts packages/printer-core/src/presets/label/__tests__/DefaultLabelPreset.test.ts packages/printer-core/src/presets/receipt/__tests__/DefaultReceiptPreset.test.ts
git commit -m "feat: add DefaultLabelPreset and DefaultReceiptPreset"
```

---

### Task 3: `ProductLabelPreset` + `ToppingLabelPreset`

**Files:**
- Create: `packages/printer-core/src/presets/label/ProductLabelPreset.ts`
- Create: `packages/printer-core/src/presets/label/ToppingLabelPreset.ts`
- Test: `packages/printer-core/src/presets/label/__tests__/ProductLabelPreset.test.ts` (new)
- Test: `packages/printer-core/src/presets/label/__tests__/ToppingLabelPreset.test.ts` (new)

**Interfaces:**
- Consumes: `LabelPreset<TVars>` (Task 1), `PrintElement` (`../../builder`), `BarcodeSymbology` — the `'code128'` literal is part of `BarcodeConfig.symbology`, no separate import needed since it's used as a string literal inside a `PrintElement`-typed array.
- Produces: `interface ProductLabelVars { productName: string; size?: string; price: number; sku: string; note?: string }`; `ProductLabelPreset: LabelPreset<ProductLabelVars>`; `interface ToppingLabelVars { toppingName: string; drinkName?: string; sweetness?: string; ice?: string; note?: string }`; `ToppingLabelPreset: LabelPreset<ToppingLabelVars>`.

Both presets share one paper size — 40×30mm at 203dpi (≈320×240 dots), same as `DefaultLabelPreset` — different layouts, not different sizes. Dot positions below are a reasonable starting layout, not hardware-verified; say so in each file's doc comment.

- [ ] **Step 1: Write the failing test for `ProductLabelPreset`**

```typescript
// packages/printer-core/src/presets/label/__tests__/ProductLabelPreset.test.ts
import { ProductLabelPreset } from '../ProductLabelPreset';

describe('ProductLabelPreset', () => {
  it('has the shared 40x30mm 203dpi label config', () => {
    expect(ProductLabelPreset.config).toEqual({ width: 40, height: 30, unit: 'mm', dpi: 203 });
  });

  it('builds name, size, price, barcode, and note elements from full vars', () => {
    const elements = ProductLabelPreset.build({
      productName: 'Trà sữa trân châu',
      size: 'L',
      price: 25000,
      sku: '8931234567890',
      note: 'Không đường',
    });

    expect(elements).toEqual([
      { type: 'text', content: 'Trà sữa trân châu', options: { x: 8, y: 8, bold: true, size: 2 } },
      { type: 'text', content: 'L', options: { x: 8, y: 40 } },
      { type: 'text', content: '25.000đ', options: { x: 8, y: 65, bold: true, size: 2 } },
      {
        type: 'barcode',
        options: { x: 8, y: 100, symbology: 'code128', content: '8931234567890', height: 60, readable: true },
      },
      { type: 'text', content: 'Không đường', options: { x: 8, y: 170 } },
    ]);
  });

  it('omits the size and note elements when not provided', () => {
    const elements = ProductLabelPreset.build({ productName: 'Trà sữa', price: 20000, sku: '111' });
    expect(elements.map((e) => e.type)).toEqual(['text', 'text', 'barcode']);
  });

  it('formats price with thousands separators', () => {
    const elements = ProductLabelPreset.build({ productName: 'X', price: 1234567, sku: '1' });
    const priceElement = elements.find((e) => e.type === 'text' && e.content.endsWith('đ'));
    expect(priceElement).toMatchObject({ content: '1.234.567đ' });
  });
});
```

- [ ] **Step 2: Write the failing test for `ToppingLabelPreset`**

```typescript
// packages/printer-core/src/presets/label/__tests__/ToppingLabelPreset.test.ts
import { ToppingLabelPreset } from '../ToppingLabelPreset';

describe('ToppingLabelPreset', () => {
  it('has the same shared 40x30mm 203dpi label config as ProductLabelPreset', () => {
    expect(ToppingLabelPreset.config).toEqual({ width: 40, height: 30, unit: 'mm', dpi: 203 });
  });

  it('builds topping name, drink name, sweetness/ice line, and note elements from full vars', () => {
    const elements = ToppingLabelPreset.build({
      toppingName: 'Trân châu đen',
      drinkName: 'Trà sữa truyền thống',
      sweetness: '50%',
      ice: 'ít',
      note: 'Thêm topping',
    });

    expect(elements).toEqual([
      { type: 'text', content: 'Trân châu đen', options: { x: 8, y: 8, bold: true, size: 2 } },
      { type: 'text', content: 'Trà sữa truyền thống', options: { x: 8, y: 40 } },
      { type: 'text', content: 'Ngọt: 50% | Đá: ít', options: { x: 8, y: 70 } },
      { type: 'text', content: 'Thêm topping', options: { x: 8, y: 100 } },
    ]);
  });

  it('joins only the sweetness/ice fields that are present', () => {
    const elements = ToppingLabelPreset.build({ toppingName: 'X', ice: 'nhiều' });
    const line = elements.find((e) => e.type === 'text' && e.content.startsWith('Đá:'));
    expect(line).toMatchObject({ content: 'Đá: nhiều' });
  });

  it('omits the sweetness/ice line entirely when neither is given', () => {
    const elements = ToppingLabelPreset.build({ toppingName: 'X' });
    expect(elements.map((e) => e.type)).toEqual(['text']);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest packages/printer-core/src/presets/label`
Expected: both new suites FAIL — modules don't exist yet.

- [ ] **Step 4: Implement `ProductLabelPreset.ts`**

```typescript
// packages/printer-core/src/presets/label/ProductLabelPreset.ts
import type { PrintElement } from '../../builder';
import type { LabelPreset } from '../LabelPreset';

export interface ProductLabelVars {
  productName: string;
  size?: string;
  price: number;
  sku: string;
  note?: string;
}

/** `12345` -> `"12.345đ"` — deterministic thousands grouping, no locale/ICU dependency. */
function formatCurrency(value: number): string {
  const grouped = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped}đ`;
}

/**
 * 40x30mm product label: name, optional size, price, SKU barcode, optional
 * note. Dot positions are a reasonable starting layout, not yet verified
 * against real hardware — refine after visual testing.
 */
export const ProductLabelPreset: LabelPreset<ProductLabelVars> = {
  config: { width: 40, height: 30, unit: 'mm', dpi: 203 },
  build: (vars) => {
    const elements: PrintElement[] = [
      { type: 'text', content: vars.productName, options: { x: 8, y: 8, bold: true, size: 2 } },
    ];
    if (vars.size) elements.push({ type: 'text', content: vars.size, options: { x: 8, y: 40 } });
    elements.push({ type: 'text', content: formatCurrency(vars.price), options: { x: 8, y: 65, bold: true, size: 2 } });
    elements.push({
      type: 'barcode',
      options: { x: 8, y: 100, symbology: 'code128', content: vars.sku, height: 60, readable: true },
    });
    if (vars.note) elements.push({ type: 'text', content: vars.note, options: { x: 8, y: 170 } });
    return elements;
  },
};
```

- [ ] **Step 5: Implement `ToppingLabelPreset.ts`**

```typescript
// packages/printer-core/src/presets/label/ToppingLabelPreset.ts
import type { PrintElement } from '../../builder';
import type { LabelPreset } from '../LabelPreset';

export interface ToppingLabelVars {
  toppingName: string;
  drinkName?: string;
  sweetness?: string;
  ice?: string;
  note?: string;
}

function sweetnessIceLine(vars: Pick<ToppingLabelVars, 'sweetness' | 'ice'>): string | undefined {
  const parts: string[] = [];
  if (vars.sweetness) parts.push(`Ngọt: ${vars.sweetness}`);
  if (vars.ice) parts.push(`Đá: ${vars.ice}`);
  return parts.length > 0 ? parts.join(' | ') : undefined;
}

/**
 * 40x30mm topping label — same paper as `ProductLabelPreset`, different
 * layout: topping name, optional drink name, optional sweetness/ice line,
 * optional note. Dot positions are a reasonable starting layout, not yet
 * verified against real hardware.
 */
export const ToppingLabelPreset: LabelPreset<ToppingLabelVars> = {
  config: { width: 40, height: 30, unit: 'mm', dpi: 203 },
  build: (vars) => {
    const elements: PrintElement[] = [
      { type: 'text', content: vars.toppingName, options: { x: 8, y: 8, bold: true, size: 2 } },
    ];
    if (vars.drinkName) elements.push({ type: 'text', content: vars.drinkName, options: { x: 8, y: 40 } });
    const line = sweetnessIceLine(vars);
    if (line) elements.push({ type: 'text', content: line, options: { x: 8, y: 70 } });
    if (vars.note) elements.push({ type: 'text', content: vars.note, options: { x: 8, y: 100 } });
    return elements;
  },
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest packages/printer-core/src/presets/label`
Expected: PASS (all suites in `presets/label`).

- [ ] **Step 7: Run full package verification**

```bash
npm run type-check -w printer-core
npm run type-check
npm run lint
npm test
```

- [ ] **Step 8: Commit**

```bash
git add packages/printer-core/src/presets/label/ProductLabelPreset.ts packages/printer-core/src/presets/label/ToppingLabelPreset.ts packages/printer-core/src/presets/label/__tests__/ProductLabelPreset.test.ts packages/printer-core/src/presets/label/__tests__/ToppingLabelPreset.test.ts
git commit -m "feat: add ProductLabelPreset and ToppingLabelPreset"
```

---

### Task 4: `StandardReceiptPreset` + `CompactReceiptPreset`

**Files:**
- Create: `packages/printer-core/src/presets/receipt/StandardReceiptPreset.ts`
- Create: `packages/printer-core/src/presets/receipt/CompactReceiptPreset.ts`
- Test: `packages/printer-core/src/presets/receipt/__tests__/StandardReceiptPreset.test.ts` (new)
- Test: `packages/printer-core/src/presets/receipt/__tests__/CompactReceiptPreset.test.ts` (new)

**Interfaces:**
- Consumes: `ReceiptPreset<TVars>` (Task 1), `PrintElement` (`../../builder`), `ReceiptColumn` (`../../receipt`).
- Produces: `interface StandardReceiptItem { name: string; qty: number; price: number }`; `interface StandardReceiptVars { storeName: string; orderNumber: string; items: StandardReceiptItem[]; total: number; cashier?: string; timestamp: string }`; `StandardReceiptPreset: ReceiptPreset<StandardReceiptVars>`; `formatCurrency(value: number): string` (exported from `StandardReceiptPreset.ts`, reused by `CompactReceiptPreset.ts`); `CompactReceiptPreset: ReceiptPreset<StandardReceiptVars>` (reuses `StandardReceiptVars`, no separate interface).

`CompactReceiptPreset` depends on `StandardReceiptPreset.ts`'s exports — this task's two files must be written together, `StandardReceiptPreset.ts` first.

Every `text()` element below omits `x`/`y`: continuous-paper text flows top-to-bottom in call order on every language this package compiles to (verified against `EscPosCompiler.ts`'s `compileTextElement`, which never reads `x`/`y` and always emits a trailing line-feed) — only `align` is set where centering/right-alignment matters. `ReceiptColumn.width` is in characters (per `ReceiptFormatter.ts`'s `alignText()`), matching the 32-character divider lines: 16+6+10=32 for name/qty/price.

- [ ] **Step 1: Write the failing test for `StandardReceiptPreset`**

```typescript
// packages/printer-core/src/presets/receipt/__tests__/StandardReceiptPreset.test.ts
import { StandardReceiptPreset, formatCurrency } from '../StandardReceiptPreset';

describe('formatCurrency', () => {
  it('groups thousands with a period and appends đ', () => {
    expect(formatCurrency(25000)).toBe('25.000đ');
    expect(formatCurrency(1234567)).toBe('1.234.567đ');
    expect(formatCurrency(500)).toBe('500đ');
  });
});

describe('StandardReceiptPreset', () => {
  it('has a 58mm 203dpi continuous-receipt config', () => {
    expect(StandardReceiptPreset.config).toEqual({ width: 58, unit: 'mm', dpi: 203 });
  });

  it('builds header, order info, itemized table, total, cashier, and cut', () => {
    const elements = StandardReceiptPreset.build({
      storeName: 'Trà Sữa ABC',
      orderNumber: 'DH001',
      items: [
        { name: 'Trà sữa L', qty: 2, price: 25000 },
        { name: 'Trân châu', qty: 1, price: 5000 },
      ],
      total: 55000,
      cashier: 'Lan',
      timestamp: '16/09/2026 19:00',
    });

    expect(elements[0]).toEqual({ type: 'text', content: 'Trà Sữa ABC', options: { align: 'center', bold: true, size: 2 } });
    expect(elements.find((e) => e.type === 'text' && e.content.startsWith('Mã đơn'))).toEqual({
      type: 'text',
      content: 'Mã đơn: DH001',
      options: {},
    });
    const table = elements.find((e) => e.type === 'table');
    expect(table).toMatchObject({
      type: 'table',
      options: {
        rows: [
          ['Trà sữa L', '2', '25.000đ'],
          ['Trân châu', '1', '5.000đ'],
        ],
      },
    });
    expect(elements.find((e) => e.type === 'text' && e.content.startsWith('Tổng cộng'))).toEqual({
      type: 'text',
      content: 'Tổng cộng: 55.000đ',
      options: { bold: true, align: 'right' },
    });
    expect(elements.find((e) => e.type === 'text' && e.content.startsWith('Thu ngân'))).toEqual({
      type: 'text',
      content: 'Thu ngân: Lan',
      options: {},
    });
    expect(elements[elements.length - 1]).toEqual({ type: 'cut', options: {} });
  });

  it('omits the cashier line when not provided', () => {
    const elements = StandardReceiptPreset.build({
      storeName: 'X',
      orderNumber: '1',
      items: [],
      total: 0,
      timestamp: 't',
    });
    expect(elements.some((e) => e.type === 'text' && e.content.startsWith('Thu ngân'))).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing test for `CompactReceiptPreset`**

```typescript
// packages/printer-core/src/presets/receipt/__tests__/CompactReceiptPreset.test.ts
import { CompactReceiptPreset } from '../CompactReceiptPreset';

describe('CompactReceiptPreset', () => {
  it('has the same 58mm 203dpi continuous-receipt config as StandardReceiptPreset', () => {
    expect(CompactReceiptPreset.config).toEqual({ width: 58, unit: 'mm', dpi: 203 });
  });

  it('builds order number, itemized table, total, and cut — no header, cashier, or thank-you line', () => {
    const elements = CompactReceiptPreset.build({
      storeName: 'Trà Sữa ABC',
      orderNumber: 'DH002',
      items: [{ name: 'Trà đào', qty: 1, price: 20000 }],
      total: 20000,
      cashier: 'Lan',
      timestamp: '16/09/2026 19:05',
    });

    expect(elements).toEqual([
      { type: 'text', content: 'Mã đơn: DH002', options: {} },
      { type: 'table', options: { columns: [{ width: 16 }, { width: 6, align: 'center' }, { width: 10, align: 'right' }], rows: [['Trà đào', '1', '20.000đ']] } },
      { type: 'text', content: 'Tổng cộng: 20.000đ', options: { bold: true, align: 'right' } },
      { type: 'cut', options: {} },
    ]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest packages/printer-core/src/presets/receipt`
Expected: both new suites FAIL — modules don't exist yet.

- [ ] **Step 4: Implement `StandardReceiptPreset.ts`**

```typescript
// packages/printer-core/src/presets/receipt/StandardReceiptPreset.ts
import type { PrintElement } from '../../builder';
import type { ReceiptColumn } from '../../receipt';
import type { ReceiptPreset } from '../ReceiptPreset';

export interface StandardReceiptItem {
  name: string;
  qty: number;
  price: number;
}

export interface StandardReceiptVars {
  storeName: string;
  orderNumber: string;
  items: StandardReceiptItem[];
  total: number;
  cashier?: string;
  timestamp: string;
}

const DIVIDER = '-'.repeat(32);
const COLUMNS: ReceiptColumn[] = [{ width: 16 }, { width: 6, align: 'center' }, { width: 10, align: 'right' }];

/** `12345` -> `"12.345đ"` — deterministic thousands grouping, no locale/ICU dependency. Exported for `CompactReceiptPreset`. */
export function formatCurrency(value: number): string {
  const grouped = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped}đ`;
}

function itemRows(items: StandardReceiptItem[]): string[][] {
  return items.map((i) => [i.name, String(i.qty), formatCurrency(i.price)]);
}

/**
 * 58mm continuous receipt with full order detail: store name header, order
 * number/timestamp, itemized table, total, optional cashier, thank-you
 * line, then cut.
 */
export const StandardReceiptPreset: ReceiptPreset<StandardReceiptVars> = {
  config: { width: 58, unit: 'mm', dpi: 203 },
  build: (vars) => {
    const elements: PrintElement[] = [
      { type: 'text', content: vars.storeName, options: { align: 'center', bold: true, size: 2 } },
      { type: 'text', content: DIVIDER, options: {} },
      { type: 'text', content: `Mã đơn: ${vars.orderNumber}`, options: {} },
      { type: 'text', content: `Thời gian: ${vars.timestamp}`, options: {} },
      { type: 'text', content: DIVIDER, options: {} },
      { type: 'table', options: { columns: COLUMNS, rows: itemRows(vars.items) } },
      { type: 'text', content: DIVIDER, options: {} },
      { type: 'text', content: `Tổng cộng: ${formatCurrency(vars.total)}`, options: { bold: true, align: 'right' } },
    ];
    if (vars.cashier) elements.push({ type: 'text', content: `Thu ngân: ${vars.cashier}`, options: {} });
    elements.push({ type: 'text', content: 'Cảm ơn quý khách!', options: { align: 'center' } });
    elements.push({ type: 'cut', options: {} });
    return elements;
  },
};
```

- [ ] **Step 5: Implement `CompactReceiptPreset.ts`**

`COLUMNS`/`itemRows` are duplicated here rather than imported from `StandardReceiptPreset.ts` — 4 lines, a second consumer, not worth a shared module yet (extract if a third receipt preset needs the same table shape later).

```typescript
// packages/printer-core/src/presets/receipt/CompactReceiptPreset.ts
import type { PrintElement } from '../../builder';
import type { ReceiptColumn } from '../../receipt';
import type { ReceiptPreset } from '../ReceiptPreset';
import { formatCurrency, type StandardReceiptItem, type StandardReceiptVars } from './StandardReceiptPreset';

const COLUMNS: ReceiptColumn[] = [{ width: 16 }, { width: 6, align: 'center' }, { width: 10, align: 'right' }];

function itemRows(items: StandardReceiptItem[]): string[][] {
  return items.map((i) => [i.name, String(i.qty), formatCurrency(i.price)]);
}

/**
 * 58mm continuous receipt, minimal — order number, itemized table, total,
 * cut. Reuses `StandardReceiptVars` (same data shape as `StandardReceiptPreset`)
 * but omits the store header, cashier line, and thank-you line to minimize
 * paper length.
 */
export const CompactReceiptPreset: ReceiptPreset<StandardReceiptVars> = {
  config: { width: 58, unit: 'mm', dpi: 203 },
  build: (vars) => [
    { type: 'text', content: `Mã đơn: ${vars.orderNumber}`, options: {} },
    { type: 'table', options: { columns: COLUMNS, rows: itemRows(vars.items) } },
    { type: 'text', content: `Tổng cộng: ${formatCurrency(vars.total)}`, options: { bold: true, align: 'right' } },
    { type: 'cut', options: {} },
  ],
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest packages/printer-core/src/presets/receipt`
Expected: PASS (all suites in `presets/receipt`).

- [ ] **Step 7: Run full package verification**

```bash
npm run type-check -w printer-core
npm run type-check
npm run lint
npm test
```

- [ ] **Step 8: Commit**

```bash
git add packages/printer-core/src/presets/receipt/StandardReceiptPreset.ts packages/printer-core/src/presets/receipt/CompactReceiptPreset.ts packages/printer-core/src/presets/receipt/__tests__/StandardReceiptPreset.test.ts packages/printer-core/src/presets/receipt/__tests__/CompactReceiptPreset.test.ts
git commit -m "feat: add StandardReceiptPreset and CompactReceiptPreset"
```

---

### Task 5: `presets/` barrel + root package wiring + final verification

**Files:**
- Create: `packages/printer-core/src/presets/index.ts`
- Modify: `packages/printer-core/src/index.ts`

**Interfaces:**
- Consumes: every export from Tasks 1-4.
- Produces: nothing new — pure re-export wiring.

- [ ] **Step 1: Write `presets/index.ts`**

```typescript
// packages/printer-core/src/presets/index.ts
export * from './LabelPreset';
export * from './ReceiptPreset';
export * from './applyPreset';
export * from './label/DefaultLabelPreset';
export * from './label/ProductLabelPreset';
export * from './label/ToppingLabelPreset';
export * from './receipt/DefaultReceiptPreset';
export * from './receipt/StandardReceiptPreset';
export * from './receipt/CompactReceiptPreset';
```

- [ ] **Step 2: Wire `presets/` into the package root barrel**

In `packages/printer-core/src/index.ts`, add one line — alphabetical position doesn't matter here since the existing list isn't alphabetized (it's roughly dependency-ordered), so append after `./testing`:

```typescript
export * from './testing';
export * from './presets';
```

- [ ] **Step 3: Verify every preset is reachable through the root barrel**

Add one integration-style test:

```typescript
// packages/printer-core/src/presets/__tests__/index.test.ts
import {
  DefaultLabelPreset,
  ProductLabelPreset,
  ToppingLabelPreset,
  DefaultReceiptPreset,
  StandardReceiptPreset,
  CompactReceiptPreset,
  applyLabelPreset,
  applyReceiptPreset,
} from '../../index';

describe('presets barrel', () => {
  it('re-exports all 6 presets and both apply helpers through the package root', () => {
    expect(DefaultLabelPreset).toBeDefined();
    expect(ProductLabelPreset).toBeDefined();
    expect(ToppingLabelPreset).toBeDefined();
    expect(DefaultReceiptPreset).toBeDefined();
    expect(StandardReceiptPreset).toBeDefined();
    expect(CompactReceiptPreset).toBeDefined();
    expect(typeof applyLabelPreset).toBe('function');
    expect(typeof applyReceiptPreset).toBe('function');
  });
});
```

Run: `npx jest packages/printer-core/src/presets/__tests__/index.test.ts` — expect PASS immediately (this step verifies wiring, not new behavior — no RED phase expected here since everything it imports already exists from Tasks 1-4).

- [ ] **Step 4: Run full package verification (this plan's acceptance gate)**

```bash
npm run type-check -w printer-core
npm run type-check
npm run lint
npm test
```

All four must be clean, with no `src/features/printer` path citations anywhere in the new `presets/` files (`grep -rn "src/features/printer" packages/printer-core/src/presets` must return nothing).

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/presets/index.ts packages/printer-core/src/index.ts packages/printer-core/src/presets/__tests__/index.test.ts
git commit -m "feat: wire presets/ into the package root barrel"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-16-printer-core-presets.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
