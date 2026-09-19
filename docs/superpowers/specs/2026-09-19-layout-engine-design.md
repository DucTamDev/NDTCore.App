# Layout Engine — Design Spec

## Goal

Replace `packages/printer-core`'s `templates/` and `binding/` modules
entirely with a tree-based template model that supports real auto-layout:
containers with padding/margin/gap/alignment, text that wraps and reflows,
and repeating sections for variable-length lists (toppings, order lines).
The flat `LabelTemplate`/`ReceiptTemplate` (`{ config, elements: PrintElement[] }`)
and `bindElements()` placeholder substitution built earlier are deleted
outright — **no migration, no backward-compat shim**. Nothing outside this
package consumes them yet (verified: no references under `NDTCore.App/src`),
so there is nothing to break.

## Non-goals / explicitly out of scope

- Persisting templates, cloning them into user-editable records, or any UI —
  same boundary the deleted `templates/` module had. This spec only builds
  the in-memory tree → layout → element pipeline.
- Changing `PrintElement`, `PrintCompiler`, `ResolvedPrintDocument`, or any
  of the 9 language compilers. See **Compatibility** below — this is
  additive.
- Real per-printer font metrics. `FontMetrics` is a contract; the built-in
  implementation is a documented approximation (see **FontMetrics**).

## Architecture

```
PrintTemplate (TemplateNode tree — static, no data, no coordinates)
        │
        ▼  DocumentResolver.resolve(template, data)
ResolvedNode (bound values, repeats expanded, hidden nodes dropped — still no coordinates)
        │
        ▼  LayoutEngine.resolve(root, config, typography, fontMetrics)
PrintElement[]  ◄── existing type, unchanged (18 variants)
        │
        ▼  (unchanged — LabelBuilder/ReceiptBuilder, ResolvedPrintDocument, compile())
```

Three concepts, three names, one direction — a node is never reused for two
pipeline stages:

| Stage | Type family | Has data? | Has coordinates? |
|---|---|---|---|
| Template | `TemplateNode` | no | no |
| Resolved | `ResolvedNode` | yes | no |
| Layout output | `PrintElement` (existing) | yes | yes |

## Compatibility (why this is additive, not a rewrite)

`LayoutEngine` is a new step inserted **before** everything that already
exists. Nothing downstream changes:

- **`PrintElement`** (18 variants: `text`/`image`/`barcode`/`qrcode`/`raw`/
  `box`/`line`/`diagonal`/`circle`/`ellipse`/`reverse`/`erase`/`pageBreak`/
  `spacer`/`row`/`column`/`cut`/`table`) — unchanged. `LayoutEngine` only
  ever *produces* `PrintElement[]`; it never introduces a new element shape
  compilers must learn. `ContainerNode`/`RepeatNode` are template-only
  concepts — they are consumed during layout and never appear in the output
  array.
- **`PrintCompiler<TOutput>.compile(document, encoding?: TextEncodingOptions)`**
  — untouched. This spec's pipeline ends at `PrintElement[]`, which flows
  into `ResolvedPrintDocument` exactly as it does today.
- **No naming collisions.** The existing `document/PrintDocument.ts`
  (`{ width, height?, ...PrintDocumentOptions }`) and
  `document/ResolvedPrintDocument.ts` keep their current meaning. This
  spec's new types use distinct names (`PrintTemplate`, `ResolvedNode`,
  `LayoutConfig`) that don't shadow anything already exported from
  `packages/printer-core`.

## Template layer

```ts
export interface PrintTemplate {
  readonly id: string;
  readonly version: number;
  readonly root: TemplateNode;
}

export type TemplateNode =
  | ContainerNode
  | TextNode
  | LineNode
  | BarcodeNode
  | QrCodeNode
  | ImageNode
  | RepeatNode;

export interface ContainerNode {
  readonly type: 'container';
  readonly id: string;
  readonly style?: LayoutStyle;
  readonly visibleWhen?: VisibilityCondition;
  readonly children: readonly TemplateNode[];
}

/** At least one of `text`/`binding` must be present — enforced by `DocumentResolver`, not the type system (a union of two required-alternative shapes reads worse than the validation cost of enforcing it at resolve time). */
export interface TextNode {
  readonly type: 'text';
  readonly id: string;
  readonly text?: string; // literal, fixed content
  readonly binding?: string; // dotted-path key into PrintData
  readonly style?: TextStyle;
  readonly visibleWhen?: VisibilityCondition;
}

export interface LineNode {
  readonly type: 'line';
  readonly id: string;
  readonly thickness?: number;
  readonly style?: LayoutStyle;
  readonly visibleWhen?: VisibilityCondition;
}

/** Mirrors `TextNode`'s literal-or-binding split; `content` is the barcode payload. */
export interface BarcodeNode {
  readonly type: 'barcode';
  readonly id: string;
  readonly content?: string;
  readonly binding?: string;
  readonly symbology: BarcodeSymbology;
  readonly readable?: boolean;
  readonly style?: LayoutStyle;
  readonly visibleWhen?: VisibilityCondition;
}

export interface QrCodeNode {
  readonly type: 'qrcode';
  readonly id: string;
  readonly content?: string;
  readonly binding?: string;
  readonly errorCorrection?: QrErrorCorrectionLevel;
  readonly style?: LayoutStyle;
  readonly visibleWhen?: VisibilityCondition;
}

/** No decode step in this pipeline — `bitmap` is a pre-decoded `Bitmap`, same precondition `ImageElement` already has. `binding` looks up a `Bitmap` value in `PrintData` for per-print images (e.g. a dynamically fetched logo); `bitmap` is for one baked into the template itself. */
export interface ImageNode {
  readonly type: 'image';
  readonly id: string;
  readonly bitmap?: Bitmap;
  readonly binding?: string;
  readonly style?: LayoutStyle;
  readonly visibleWhen?: VisibilityCondition;
}

export interface RepeatNode {
  readonly type: 'repeat';
  readonly id: string;
  readonly binding: string; // key resolving to an array in PrintData
  readonly template: TemplateNode;
  readonly visibleWhen?: VisibilityCondition;
}
```

`RepeatNode` is a distinct node type, not a `repeat?: RepeatConfig` field on
every node. Repeat changes cardinality (one template node becomes N resolved
nodes) — a different kind of transformation than style or visibility, which
never change how many nodes exist. Keeping it a separate type keeps
`TemplateNode` a clean discriminated union: no node is "sometimes plural."

## Shared style/geometry primitives

```ts
export type Dimension = { type: 'fixed'; value: number } | { type: 'fill' } | { type: 'auto' };

export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface LayoutStyle {
  readonly width?: Dimension;
  readonly height?: Dimension;
  readonly margin?: Insets;
  readonly padding?: Insets;
  readonly direction?: 'row' | 'column';
  readonly gap?: number;
  readonly justifyContent?: 'start' | 'center' | 'end' | 'space-between';
  readonly alignItems?: 'start' | 'center' | 'end';
}

export interface TextStyle {
  readonly fontSize?: number;
  readonly fontWeight?: 'normal' | 'bold';
  readonly lineHeight?: number;
  readonly textAlign?: 'left' | 'center' | 'right';
}

export type VisibilityCondition =
  | { readonly type: 'exists'; readonly binding: string }
  | { readonly type: 'equals'; readonly binding: string; readonly value: unknown };
```

`VisibilityCondition` is a closed, typed union — deliberately not an
arbitrary string expression (`visibleIf: string`), which would turn the
template into a small scripting language. `AndCondition`/`OrCondition`/
`NotEqualsCondition` are natural additions later; this spec only needs
`exists`/`equals` (no template built during design needed more).

All dimensions/insets/gaps are in **dots**, matching every other geometry
value already in this package (`widthDots`, `x`/`y` in `TextOptions`, etc.).
A caller working in mm/inches converts before constructing a `PrintTemplate`,
the same way callers already convert before calling `LabelBuilder`.

## Resolved layer

```ts
export type PrintData = Readonly<Record<string, unknown>>;

export type ResolvedNode =
  | ResolvedContainer
  | ResolvedText
  | ResolvedLine
  | ResolvedBarcode
  | ResolvedQrCode
  | ResolvedImage;

export interface ResolvedContainer {
  readonly type: 'container';
  readonly id: string;
  readonly style?: LayoutStyle;
  readonly children: readonly ResolvedNode[];
}

export interface ResolvedText {
  readonly type: 'text';
  readonly id: string;
  readonly value: string;
  readonly style?: TextStyle;
}

export interface ResolvedLine {
  readonly type: 'line';
  readonly id: string;
  readonly thickness?: number;
  readonly style?: LayoutStyle;
}

export interface ResolvedBarcode {
  readonly type: 'barcode';
  readonly id: string;
  readonly value: string;
  readonly symbology: BarcodeSymbology;
  readonly readable?: boolean;
  readonly style?: LayoutStyle;
}

export interface ResolvedQrCode {
  readonly type: 'qrcode';
  readonly id: string;
  readonly value: string;
  readonly errorCorrection?: QrErrorCorrectionLevel;
  readonly style?: LayoutStyle;
}

export interface ResolvedImage {
  readonly type: 'image';
  readonly id: string;
  readonly bitmap: Bitmap;
  readonly style?: LayoutStyle;
}

export interface DocumentResolver {
  resolve(template: PrintTemplate, data: PrintData): ResolvedNode;
}
```

`RepeatNode` does not appear in `ResolvedNode` — resolving one replaces it
with N resolved copies of its `template`, wrapped in a `ResolvedContainer`
(inheriting the repeat's own `style`, so a caller can lay repeated rows out
as a column with a `gap` the same way any other container would).

### Resolver behavior

- **Binding lookup**: `binding: "product.name"` is a dotted path resolved
  against `data`. Inside a `RepeatNode`'s expansion, the current item is
  pushed onto a context stack as the innermost scope — an unresolved key is
  looked up in the item first, then falls back to the outer scope. This is
  the same "innermost scope wins, falls back outward" rule Mustache section
  resolution uses, letting a repeated row reference both its own item
  fields (`name`, `price`) and outer/global fields (`storeName`) without a
  separate mechanism for each.
- **Missing binding key is a hard error.** If a `binding` path resolves to
  `undefined` anywhere in the tree, `resolve()` throws immediately, naming
  the offending node's `id` and `binding` path. This is a POS system —
  a template silently printing a blank price or product name because a data
  field was never wired up is a worse failure than an exception at print
  time that surfaces the bug immediately.
- **Visibility**: a node whose `visibleWhen` evaluates false is dropped
  entirely from the resolved tree (not resolved-then-hidden — it never
  reaches `LayoutEngine`, and never consumes layout space).
- **No formatting.** `DocumentResolver` does plain key lookup and
  `String(value)` conversion — it does not format currency, dates, or
  numbers. Formatting (`45000` → `"45,000 ₫"`) is the caller's
  responsibility, applied before constructing the `PrintData` object. This
  keeps the resolver a pure, dependency-free lookup step.

## Layout layer

```ts
export interface LayoutConfig {
  readonly widthDots: number;
  readonly heightDots?: number; // undefined = continuous (receipt)
  readonly dpi: number;
}

export interface FontScaleLevel {
  readonly id: string;
  readonly fontScale: number; // multiplies every TextStyle.fontSize in the tree
  readonly lineHeightScale: number;
}

export interface TypographyProfile {
  readonly fontScaleLevels: readonly FontScaleLevel[]; // ordered largest → smallest
}

export interface TextMeasurement {
  readonly widthDots: number;
  readonly heightDots: number;
  readonly lineCount: number;
}

export interface FontMetrics {
  measure(text: string, style: TextStyle): TextMeasurement;
  wrap(text: string, maxWidthDots: number, style: TextStyle): readonly string[];
}

export interface LayoutEngine {
  resolve(root: ResolvedNode, config: LayoutConfig, typography: TypographyProfile, fontMetrics: FontMetrics): PrintElement[];
}
```

### FontMetrics

Real character width depends on the specific bitmap/vector font baked into
a specific printer model — `TextOptions.size` is a magnification factor
applied to a printer's own built-in font, not an absolute point size, and
the same `size: 2` renders a different pixel width on an Epson than on a
TSC. `packages/printer-core` has no way to know this in advance for an
unspecified printer, and stays a zero-I/O, zero-dependency package — it
cannot go measure a real font at layout time.

`FontMetrics` is therefore a contract with one built-in, explicitly
approximate implementation:

```ts
export class ApproximateFontMetrics implements FontMetrics { /* ... */ }
```

documented as a best-effort estimate (fixed dots-per-character scaled by
`fontSize`), good enough to lay a template out without per-printer
calibration data. A caller that needs real accuracy for a specific printer
model supplies its own `FontMetrics` (e.g. backed by real per-printer
character tables, or a native measurement API) — `LayoutEngine` only
depends on the interface.

### Word wrap

`FontMetrics.wrap()` hard-breaks a single word longer than `maxWidthDots`
(splits mid-word) rather than letting that one line overflow the container's
width — the same default browsers use for `overflow-wrap: break-word`. This
was not explicitly confirmed during design; revisit if a template author
hits this in practice and wants different behavior (e.g. shrink-to-fit for
that one line instead of breaking it).

### Sizing algorithm — never blocks printing

`LayoutEngine.resolve()` never throws for "content doesn't fit." A print
job must always produce output — refusing to print because of a layout
edge case is a worse failure mode than a slightly-too-tall label. The
resolved algorithm:

1. **Receipt** (`config.heightDots` is `undefined`): always use
   `typography.fontScaleLevels[0]` (the largest scale). Continuous paper
   has no ceiling to fit under, so there is nothing to shrink for.
2. **Label** (`config.heightDots` is set): try each `FontScaleLevel` in
   `typography.fontScaleLevels`, largest to smallest. For each level,
   multiply every `TextStyle.fontSize`/`lineHeight` in the resolved tree by
   that level's `fontScale`/`lineHeightScale`, lay out the whole tree
   (header, footer, repeated sections — everything, uniformly, not just
   the section that happens to be long), and measure the total height.
   Use the **first** level whose total height fits within
   `config.heightDots`.
3. If **no** level fits (even the smallest), use the smallest level anyway
   and return the laid-out `PrintElement[]` as-is — the content may render
   past the label's nominal edge, which is a print-quality concern for
   whoever authored the template and `fontScaleLevels`, not something
   `LayoutEngine` refuses to attempt.

Scaling is **global, not per-section** — a label with many topping rows
shrinks its header/footer text along with the topping list, keeping the
whole label visually consistent at whatever scale it lands on, rather than
shrinking only the section that grew.

### ResolvedNode → PrintElement mapping

`ResolvedContainer` never produces an element itself — it exists purely to
compute `x`/`y` for its children (per `style.direction`/`gap`/`padding`/
`justifyContent`/`alignItems`) and is otherwise discarded. Every other
`ResolvedNode` variant produces exactly one `PrintElement`:

| `ResolvedNode` | → `PrintElement` |
|---|---|
| `ResolvedText` | `TextElement { content: value, options: { x, y, size, align, ... } }` |
| `ResolvedLine` | `LineElement { options: { x1, y1, x2, y2, thickness } }` |
| `ResolvedBarcode` | `BarcodeElement { options: { x, y, symbology, content: value, readable } }` |
| `ResolvedQrCode` | `QrCodeElement { options: { x, y, content: value, errorCorrection } }` |
| `ResolvedImage` | `ImageElement { bitmap, options: { x, y } }` |

`x`/`y` on every emitted element are computed by `LayoutEngine`, never
supplied by the template author — this is the entire point of the tree
model over the deleted flat `elements: PrintElement[]` shape, where every
`x`/`y` had to be hand-placed.

## Error handling summary

| Failure | Behavior |
|---|---|
| `TextNode`/`BarcodeNode`/etc. missing both `text`/`binding` and `content`/`binding` | Thrown by `DocumentResolver` at template-authoring-error detection, not silently defaulted to empty. |
| `binding` path resolves to `undefined` in `PrintData` | Thrown by `DocumentResolver`, naming the node `id` and path. |
| `RepeatNode.binding` resolves to a non-array | Thrown by `DocumentResolver`. |
| Content taller than `heightDots` even at the smallest `FontScaleLevel` | **Not thrown.** `LayoutEngine` returns the best-effort layout at the smallest scale (see Sizing algorithm above). |

## Deletion scope

Removed outright, no migration:

- `packages/printer-core/src/templates/` (`PrintTemplateType`, `PrintTemplate`
  (old flat shape), `applyTemplate`, `DefaultLabelTemplate`,
  `DefaultReceiptTemplate`, and their tests)
- `packages/printer-core/src/binding/` (`bindElements`, `BindingData`, and
  its test)
- The `export * from './templates'` / `export * from './binding'` lines in
  `packages/printer-core/src/index.ts`

## Folder structure

```
src/
├── template/
│   ├── PrintTemplate.ts
│   ├── TemplateNode.ts
│   ├── ContainerNode.ts
│   ├── TextNode.ts
│   ├── LineNode.ts
│   ├── BarcodeNode.ts
│   ├── QrCodeNode.ts
│   ├── ImageNode.ts
│   ├── RepeatNode.ts
│   ├── LayoutStyle.ts
│   ├── TextStyle.ts
│   ├── Dimension.ts
│   ├── Insets.ts
│   ├── VisibilityCondition.ts
│   └── index.ts
├── resolution/
│   ├── PrintData.ts
│   ├── ResolvedNode.ts
│   ├── DocumentResolver.ts
│   └── index.ts
└── layout/
    ├── LayoutEngine.ts
    ├── LayoutConfig.ts
    ├── TypographyProfile.ts
    ├── FontMetrics.ts
    ├── ApproximateFontMetrics.ts
    ├── TextMeasurement.ts
    └── index.ts
```

This replaces `templates/` and `binding/` (deleted) as sibling top-level
folders under `packages/printer-core/src/`, exported from the package root
`index.ts` the same way every other module is.
