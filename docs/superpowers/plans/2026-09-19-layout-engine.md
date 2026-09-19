# Layout Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `packages/printer-core`'s flat `templates/`+`binding/` modules with a tree-based `TemplateNode` model, a fluent Builder DSL to construct it, a `DocumentResolver` that binds data/filters visibility/paginates repeats, and a `LayoutEngine` that computes real geometry and emits the existing `PrintElement[]`.

**Architecture:** `PrintTemplate` (static tree) → `DocumentResolver.resolve()` (binds `PrintData`, expands repeats, paginates, isolates per-page errors) → `ResolvedPage[]` → `LayoutEngine.resolve()` per page (measures text, arranges containers, picks a global font scale) → `PrintElement[]` (existing, unchanged) → existing `ResolvedPrintDocument`/`compile()` pipeline, untouched.

**Tech Stack:** TypeScript, Jest — same as the rest of `packages/printer-core`. Zero new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-09-19-layout-engine-design.md`

## Global Constraints

- **Additive only.** Never modify `PrintElement` (18 variants), `PrintCompiler`, `ResolvedPrintDocument`, or any of the 9 language compilers. `LayoutEngine` only ever *produces* `PrintElement[]`.
- **No naming collisions.** `document/PrintDocument.ts` and `document/ResolvedPrintDocument.ts` keep their current meaning. New types live under `template/`, `resolution/`, `layout/` with distinct names (`PrintTemplate`, `ResolvedNode`, `ResolvedPage`, `LayoutConfig`).
- **Zero new dependencies.** `packages/printer-core`'s `package.json` has no `dependencies` field today — this plan does not add one.
- **Enum convention:** const-object + derived type (`export const X = {...} as const; export type X = (typeof X)[keyof typeof X];`), never a native TypeScript `enum`. Matches `PrintType`/`PrinterDriverType`/`CutterMode`.
- **Discriminated unions must be real unions.** A shared base (`BasePrintTemplate`, `TemplateNodeBase`) never doubles as the union type itself — the union (`PrintTemplate`, `TemplateNode`) is a separate, explicitly-declared `|` type.
- **Code comments stay short.** State what a function does in one line if needed; never write paragraph-long rationale or "why we chose this" blocks in `.ts` files — that belongs in the spec doc linked above, not in code.
- **All geometry values are in dots.** No mm/inch conversion inside this package.
- **Builder classes are internal.** Only factory functions (`column()`, `text.binding()`, `labelTemplate()`, ...) and types (`TemplateNode`, `PrintTemplate`, ...) are exported from `template/index.ts`.
- **No migration path.** `templates/` and `binding/` are deleted outright in the final task — no compatibility shim, no re-export.

---

### Task 1: Style and layout-config primitives

**Files:**
- Create: `packages/printer-core/src/template/style/Dimension.ts`
- Create: `packages/printer-core/src/template/style/Insets.ts`
- Create: `packages/printer-core/src/template/style/BoxStyle.ts`
- Create: `packages/printer-core/src/template/style/LayoutStyle.ts`
- Create: `packages/printer-core/src/template/style/TextStyle.ts`
- Create: `packages/printer-core/src/template/style/VisibilityCondition.ts`
- Create: `packages/printer-core/src/layout/LayoutConfig.ts`
- Test: `packages/printer-core/src/template/style/__tests__/style.test.ts`

**Interfaces:**
- Produces: `Dimension`, `Insets`, `BoxStyle`, `LayoutStyle`, `TextStyle`, `VisibilityCondition`, `LayoutConfig` — every later task imports these.

- [ ] **Step 1: Write the failing test**

```ts
// packages/printer-core/src/template/style/__tests__/style.test.ts
import type { Dimension } from '../Dimension';
import type { Insets } from '../Insets';
import type { BoxStyle } from '../BoxStyle';
import type { LayoutStyle } from '../LayoutStyle';
import type { TextStyle } from '../TextStyle';
import type { VisibilityCondition } from '../VisibilityCondition';
import type { LayoutConfig } from '../../../layout/LayoutConfig';

describe('style primitives', () => {
  it('Dimension accepts fixed/fill/auto', () => {
    const values: Dimension[] = [{ type: 'fixed', value: 120 }, { type: 'fill' }, { type: 'auto' }];
    expect(values).toHaveLength(3);
  });

  it('LayoutStyle extends BoxStyle with container-only fields', () => {
    const style: LayoutStyle = {
      width: { type: 'fill' },
      padding: { top: 8, right: 8, bottom: 8, left: 8 },
      direction: 'column',
      gap: 4,
      justifyContent: 'space-between',
      alignItems: 'center',
    };
    const box: BoxStyle = style; // must be assignable
    expect(box.width).toEqual({ type: 'fill' });
  });

  it('TextStyle has font fields only', () => {
    const style: TextStyle = { fontSize: 24, fontWeight: 'bold', lineHeight: 28, textAlign: 'center' };
    expect(style.fontWeight).toBe('bold');
  });

  it('VisibilityCondition is a closed union', () => {
    const a: VisibilityCondition = { type: 'exists', binding: 'discount' };
    const b: VisibilityCondition = { type: 'equals', binding: 'status', value: 'paid' };
    expect(a.type).toBe('exists');
    expect(b.type).toBe('equals');
  });

  it('LayoutConfig requires widthDots/dpi, heightDots optional', () => {
    const label: LayoutConfig = { widthDots: 400, heightDots: 240, dpi: 203 };
    const receipt: Omit<LayoutConfig, 'heightDots'> = { widthDots: 576, dpi: 203 };
    expect(label.heightDots).toBe(240);
    expect(receipt.widthDots).toBe(576);
  });

  it('Insets has all four sides required', () => {
    const insets: Insets = { top: 1, right: 2, bottom: 3, left: 4 };
    expect(insets.left).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/printer-core/src/template/style/__tests__/style.test.ts`
Expected: FAIL — cannot find module `'../Dimension'` (and siblings).

- [ ] **Step 3: Write the implementation**

```ts
// packages/printer-core/src/template/style/Dimension.ts
export type Dimension = { readonly type: 'fixed'; readonly value: number } | { readonly type: 'fill' } | { readonly type: 'auto' };
```

```ts
// packages/printer-core/src/template/style/Insets.ts
export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}
```

```ts
// packages/printer-core/src/template/style/BoxStyle.ts
import type { Dimension } from './Dimension';
import type { Insets } from './Insets';

export interface BoxStyle {
  readonly width?: Dimension;
  readonly height?: Dimension;
  readonly margin?: Insets;
  readonly padding?: Insets;
}
```

```ts
// packages/printer-core/src/template/style/LayoutStyle.ts
import type { BoxStyle } from './BoxStyle';

export interface LayoutStyle extends BoxStyle {
  readonly direction?: 'row' | 'column';
  readonly gap?: number;
  readonly justifyContent?: 'start' | 'center' | 'end' | 'space-between';
  readonly alignItems?: 'start' | 'center' | 'end';
}
```

```ts
// packages/printer-core/src/template/style/TextStyle.ts
export interface TextStyle {
  readonly fontSize?: number;
  readonly fontWeight?: 'normal' | 'bold';
  readonly lineHeight?: number;
  readonly textAlign?: 'left' | 'center' | 'right';
}
```

```ts
// packages/printer-core/src/template/style/VisibilityCondition.ts
export type VisibilityCondition =
  | { readonly type: 'exists'; readonly binding: string }
  | { readonly type: 'equals'; readonly binding: string; readonly value: unknown };
```

```ts
// packages/printer-core/src/layout/LayoutConfig.ts
export interface LayoutConfig {
  readonly widthDots: number;
  readonly heightDots?: number;
  readonly dpi: number;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest packages/printer-core/src/template/style/__tests__/style.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/template/style packages/printer-core/src/layout/LayoutConfig.ts
git commit -m "feat: add layout style and config primitives"
```

---

### Task 2: TemplateNode model

**Files:**
- Create: `packages/printer-core/src/template/nodes/TemplateNodeBase.ts`
- Create: `packages/printer-core/src/template/nodes/ContainerNode.ts`
- Create: `packages/printer-core/src/template/nodes/TextNode.ts`
- Create: `packages/printer-core/src/template/nodes/LineNode.ts`
- Create: `packages/printer-core/src/template/nodes/BarcodeNode.ts`
- Create: `packages/printer-core/src/template/nodes/QrCodeNode.ts`
- Create: `packages/printer-core/src/template/nodes/ImageNode.ts`
- Create: `packages/printer-core/src/template/nodes/RepeatNode.ts`
- Create: `packages/printer-core/src/template/nodes/TemplateNode.ts`
- Test: `packages/printer-core/src/template/nodes/__tests__/TemplateNode.test.ts`

**Interfaces:**
- Consumes: `BoxStyle`, `LayoutStyle`, `TextStyle`, `VisibilityCondition` (Task 1); `BarcodeSymbology` (`packages/printer-core/src/barcode`), `QrErrorCorrectionLevel` (`packages/printer-core/src/qrcode`), `Bitmap` (`packages/printer-core/src/types`) — all already exist.
- Produces: `TemplateNode` union and its 7 members — every later task (Builder, `DocumentResolver`) imports this.

- [ ] **Step 1: Write the failing test**

```ts
// packages/printer-core/src/template/nodes/__tests__/TemplateNode.test.ts
import type { TemplateNode } from '../TemplateNode';
import type { ContainerNode } from '../ContainerNode';
import type { TextNode } from '../TextNode';
import type { RepeatNode } from '../RepeatNode';

describe('TemplateNode', () => {
  it('narrows on `type` across all 7 variants', () => {
    const nodes: TemplateNode[] = [
      { type: 'container', id: 'c1', children: [] },
      { type: 'text', id: 't1', text: 'hello' },
      { type: 'line', id: 'l1' },
      { type: 'barcode', id: 'b1', content: 'ABC', symbology: 'code128' },
      { type: 'qrcode', id: 'q1', content: 'ABC' },
      { type: 'image', id: 'i1' },
      { type: 'repeat', id: 'r1', binding: 'items', template: { type: 'text', id: 't2', binding: 'name' } },
    ];
    for (const node of nodes) {
      if (node.type === 'text') expect(typeof node.id).toBe('string');
    }
    expect(nodes).toHaveLength(7);
  });

  it('TextNode allows text OR binding (both optional at the type level)', () => {
    const literal: TextNode = { type: 'text', id: 't1', text: 'MY SHOP' };
    const bound: TextNode = { type: 'text', id: 't2', binding: 'product.name' };
    expect(literal.text).toBe('MY SHOP');
    expect(bound.binding).toBe('product.name');
  });

  it('ContainerNode nests children recursively', () => {
    const tree: ContainerNode = {
      type: 'container',
      id: 'root',
      style: { direction: 'column', gap: 4 },
      children: [
        { type: 'text', id: 't1', text: 'A' },
        { type: 'container', id: 'row1', style: { direction: 'row' }, children: [{ type: 'text', id: 't2', text: 'B' }] },
      ],
    };
    expect(tree.children).toHaveLength(2);
  });

  it('RepeatNode has no style field', () => {
    const node: RepeatNode = {
      type: 'repeat',
      id: 'r1',
      binding: 'toppings',
      template: { type: 'text', id: 't1', binding: 'name' },
      maxItemsPerPage: 5,
    };
    expect(node.maxItemsPerPage).toBe(5);
    // @ts-expect-error RepeatNode has no `style`
    node.style;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/printer-core/src/template/nodes/__tests__/TemplateNode.test.ts`
Expected: FAIL — cannot find module `'../TemplateNode'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/printer-core/src/template/nodes/TemplateNodeBase.ts
import type { VisibilityCondition } from '../style/VisibilityCondition';

export interface TemplateNodeBase {
  readonly id: string;
  readonly visibleWhen?: VisibilityCondition;
}
```

```ts
// packages/printer-core/src/template/nodes/ContainerNode.ts
import type { TemplateNodeBase } from './TemplateNodeBase';
import type { LayoutStyle } from '../style/LayoutStyle';
import type { TemplateNode } from './TemplateNode';

export interface ContainerNode extends TemplateNodeBase {
  readonly type: 'container';
  readonly style?: LayoutStyle;
  readonly children: readonly TemplateNode[];
}
```

```ts
// packages/printer-core/src/template/nodes/TextNode.ts
import type { TemplateNodeBase } from './TemplateNodeBase';
import type { BoxStyle } from '../style/BoxStyle';
import type { TextStyle } from '../style/TextStyle';

export interface TextNode extends TemplateNodeBase {
  readonly type: 'text';
  readonly text?: string;
  readonly binding?: string;
  readonly style?: BoxStyle & TextStyle;
}
```

```ts
// packages/printer-core/src/template/nodes/LineNode.ts
import type { TemplateNodeBase } from './TemplateNodeBase';
import type { BoxStyle } from '../style/BoxStyle';

export interface LineNode extends TemplateNodeBase {
  readonly type: 'line';
  readonly thickness?: number;
  readonly style?: BoxStyle;
}
```

```ts
// packages/printer-core/src/template/nodes/BarcodeNode.ts
import type { TemplateNodeBase } from './TemplateNodeBase';
import type { BoxStyle } from '../style/BoxStyle';
import type { BarcodeSymbology } from '../../barcode';

export interface BarcodeNode extends TemplateNodeBase {
  readonly type: 'barcode';
  readonly content?: string;
  readonly binding?: string;
  readonly symbology: BarcodeSymbology;
  readonly readable?: boolean;
  readonly style?: BoxStyle;
}
```

```ts
// packages/printer-core/src/template/nodes/QrCodeNode.ts
import type { TemplateNodeBase } from './TemplateNodeBase';
import type { BoxStyle } from '../style/BoxStyle';
import type { QrErrorCorrectionLevel } from '../../qrcode';

export interface QrCodeNode extends TemplateNodeBase {
  readonly type: 'qrcode';
  readonly content?: string;
  readonly binding?: string;
  readonly errorCorrection?: QrErrorCorrectionLevel;
  readonly style?: BoxStyle;
}
```

```ts
// packages/printer-core/src/template/nodes/ImageNode.ts
import type { TemplateNodeBase } from './TemplateNodeBase';
import type { BoxStyle } from '../style/BoxStyle';
import type { Bitmap } from '../../types';

export interface ImageNode extends TemplateNodeBase {
  readonly type: 'image';
  readonly bitmap?: Bitmap;
  readonly binding?: string;
  readonly style?: BoxStyle;
}
```

```ts
// packages/printer-core/src/template/nodes/RepeatNode.ts
import type { VisibilityCondition } from '../style/VisibilityCondition';
import type { TemplateNode } from './TemplateNode';

export interface RepeatNode {
  readonly type: 'repeat';
  readonly id: string;
  readonly binding: string;
  readonly template: TemplateNode;
  readonly maxItemsPerPage?: number;
  readonly visibleWhen?: VisibilityCondition;
}
```

```ts
// packages/printer-core/src/template/nodes/TemplateNode.ts
import type { ContainerNode } from './ContainerNode';
import type { TextNode } from './TextNode';
import type { LineNode } from './LineNode';
import type { BarcodeNode } from './BarcodeNode';
import type { QrCodeNode } from './QrCodeNode';
import type { ImageNode } from './ImageNode';
import type { RepeatNode } from './RepeatNode';

export type TemplateNode = ContainerNode | TextNode | LineNode | BarcodeNode | QrCodeNode | ImageNode | RepeatNode;

export type { ContainerNode, TextNode, LineNode, BarcodeNode, QrCodeNode, ImageNode, RepeatNode };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest packages/printer-core/src/template/nodes/__tests__/TemplateNode.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/template/nodes
git commit -m "feat: add TemplateNode tree model"
```

---

### Task 3: PrintTemplate (Label/Receipt discriminated union)

**Files:**
- Create: `packages/printer-core/src/template/PrintTemplateType.ts`
- Create: `packages/printer-core/src/template/PrintTemplate.ts`
- Test: `packages/printer-core/src/template/__tests__/PrintTemplate.test.ts`

**Interfaces:**
- Consumes: `TemplateNode` (Task 2), `LayoutConfig` (Task 1).
- Produces: `PrintTemplateType`, `LabelTemplate`, `ReceiptTemplate`, `PrintTemplate` — `DocumentResolver` and the root builders consume these.

- [ ] **Step 1: Write the failing test**

```ts
// packages/printer-core/src/template/__tests__/PrintTemplate.test.ts
import { PrintTemplateType } from '../PrintTemplateType';
import type { LabelTemplate, ReceiptTemplate, PrintTemplate } from '../PrintTemplate';

describe('PrintTemplate', () => {
  it('LabelTemplate requires heightDots in config', () => {
    const label: LabelTemplate = {
      id: 't1',
      version: 1,
      type: PrintTemplateType.Label,
      config: { widthDots: 400, heightDots: 240, dpi: 203 },
      root: { type: 'text', id: 'r1', text: 'hi' },
    };
    expect(label.config.heightDots).toBe(240);
  });

  it('ReceiptTemplate omits heightDots from config', () => {
    const receipt: ReceiptTemplate = {
      id: 't2',
      version: 1,
      type: PrintTemplateType.Receipt,
      config: { widthDots: 576, dpi: 203 },
      root: { type: 'text', id: 'r1', text: 'hi' },
    };
    // @ts-expect-error ReceiptTemplate.config omits heightDots
    receipt.config.heightDots;
    expect(receipt.config.widthDots).toBe(576);
  });

  it('PrintTemplate narrows on `type`', () => {
    const templates: PrintTemplate[] = [
      { id: 't1', version: 1, type: PrintTemplateType.Label, config: { widthDots: 1, heightDots: 1, dpi: 1 }, root: { type: 'line', id: 'l1' } },
      { id: 't2', version: 1, type: PrintTemplateType.Receipt, config: { widthDots: 1, dpi: 1 }, root: { type: 'line', id: 'l1' } },
    ];
    for (const t of templates) {
      if (t.type === PrintTemplateType.Label) expect(t.config.heightDots).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/printer-core/src/template/__tests__/PrintTemplate.test.ts`
Expected: FAIL — cannot find module `'../PrintTemplateType'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/printer-core/src/template/PrintTemplateType.ts
export const PrintTemplateType = {
  Label: 'label',
  Receipt: 'receipt',
} as const;
export type PrintTemplateType = (typeof PrintTemplateType)[keyof typeof PrintTemplateType];
```

```ts
// packages/printer-core/src/template/PrintTemplate.ts
import type { LayoutConfig } from '../layout/LayoutConfig';
import type { TemplateNode } from './nodes/TemplateNode';
import { PrintTemplateType } from './PrintTemplateType';

export interface BasePrintTemplate {
  readonly id: string;
  readonly version: number;
  readonly type: PrintTemplateType;
  readonly root: TemplateNode;
}

export interface LabelTemplate extends BasePrintTemplate {
  readonly type: typeof PrintTemplateType.Label;
  readonly config: LayoutConfig;
}

export interface ReceiptTemplate extends BasePrintTemplate {
  readonly type: typeof PrintTemplateType.Receipt;
  readonly config: Omit<LayoutConfig, 'heightDots'>;
}

export type PrintTemplate = LabelTemplate | ReceiptTemplate;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest packages/printer-core/src/template/__tests__/PrintTemplate.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/template/PrintTemplateType.ts packages/printer-core/src/template/PrintTemplate.ts
git commit -m "feat: add PrintTemplate Label/Receipt discriminated union"
```

---

### Task 4: Builder internals + dimension/visibility factories

**Files:**
- Create: `packages/printer-core/src/template/builders/BuildContext.ts` (internal)
- Create: `packages/printer-core/src/template/builders/NodeBuilder.ts` (internal)
- Create: `packages/printer-core/src/template/builders/dimensions.ts`
- Create: `packages/printer-core/src/template/builders/conditions.ts`
- Test: `packages/printer-core/src/template/builders/__tests__/dimensions.test.ts`
- Test: `packages/printer-core/src/template/builders/__tests__/conditions.test.ts`
- Test: `packages/printer-core/src/template/builders/__tests__/NodeBuilder.test.ts`

**Interfaces:**
- Consumes: `TemplateNode`, `Dimension`, `Insets`, `BoxStyle`, `VisibilityCondition` (Tasks 1-2).
- Produces: `BuildContext`, `NodeBuilder<TNode>` (both internal, used by every later builder task), `fixed()`/`fill()`/`auto()`/`exists()`/`equals()` (public).

- [ ] **Step 1: Write the failing tests**

```ts
// packages/printer-core/src/template/builders/__tests__/dimensions.test.ts
import { fixed, fill, auto } from '../dimensions';

describe('dimension factories', () => {
  it('fixed(value) returns a fixed Dimension', () => {
    expect(fixed(120)).toEqual({ type: 'fixed', value: 120 });
  });
  it('fill() returns a fill Dimension', () => {
    expect(fill()).toEqual({ type: 'fill' });
  });
  it('auto() returns an auto Dimension', () => {
    expect(auto()).toEqual({ type: 'auto' });
  });
});
```

```ts
// packages/printer-core/src/template/builders/__tests__/conditions.test.ts
import { exists, equals } from '../conditions';

describe('visibility condition factories', () => {
  it('exists(binding) returns an exists condition', () => {
    expect(exists('discount')).toEqual({ type: 'exists', binding: 'discount' });
  });
  it('equals(binding, value) returns an equals condition', () => {
    expect(equals('status', 'paid')).toEqual({ type: 'equals', binding: 'status', value: 'paid' });
  });
});
```

```ts
// packages/printer-core/src/template/builders/__tests__/NodeBuilder.test.ts
import { NodeBuilder } from '../NodeBuilder';
import type { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';
import type { LineNode } from '../../nodes/LineNode';
import { fixed } from '../dimensions';
import { exists } from '../conditions';

class TestLineBuilder extends NodeBuilder<LineNode> {
  build(context: BuildContext): LineNode {
    return {
      type: 'line',
      id: this.nodeId ?? context.idGenerator.next('line'),
      style: this.boxStyle,
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

describe('NodeBuilder', () => {
  it('chains width/height/margin/padding into boxStyle', () => {
    const builder = new TestLineBuilder().width(fixed(100)).height(fixed(2)).margin({ top: 1, right: 1, bottom: 1, left: 1 });
    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const node = builder.build(context);
    expect(node.style).toEqual({ width: { type: 'fixed', value: 100 }, height: { type: 'fixed', value: 2 }, margin: { top: 1, right: 1, bottom: 1, left: 1 } });
  });

  it('applies visibleWhen only when set', () => {
    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const withCondition = new TestLineBuilder().visibleWhen(exists('discount')).build(context);
    const withoutCondition = new TestLineBuilder().build(context);
    expect(withCondition.visibleWhen).toEqual({ type: 'exists', binding: 'discount' });
    expect(withoutCondition.visibleWhen).toBeUndefined();
  });

  it('uses explicit .id() over the generated one', () => {
    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const node = new TestLineBuilder().id('my-line').build(context);
    expect(node.id).toBe('my-line');
  });

  it('generates sequential ids from a shared context', () => {
    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const first = new TestLineBuilder().build(context);
    const second = new TestLineBuilder().build(context);
    expect(first.id).toBe('line-1');
    expect(second.id).toBe('line-2');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest packages/printer-core/src/template/builders/__tests__`
Expected: FAIL — cannot find modules `'../dimensions'`, `'../conditions'`, `'../NodeBuilder'`, `'../BuildContext'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/printer-core/src/template/builders/dimensions.ts
import type { Dimension } from '../style/Dimension';

export function fixed(value: number): Dimension { return { type: 'fixed', value }; }
export function fill(): Dimension { return { type: 'fill' }; }
export function auto(): Dimension { return { type: 'auto' }; }
```

```ts
// packages/printer-core/src/template/builders/conditions.ts
import type { VisibilityCondition } from '../style/VisibilityCondition';

export function exists(binding: string): VisibilityCondition { return { type: 'exists', binding }; }
export function equals(binding: string, value: unknown): VisibilityCondition { return { type: 'equals', binding, value }; }
```

```ts
// packages/printer-core/src/template/builders/BuildContext.ts
export class TemplateNodeIdGenerator {
  private sequence = 0;
  next(type: string): string {
    this.sequence += 1;
    return `${type}-${this.sequence}`;
  }
}

export interface BuildContext {
  readonly idGenerator: TemplateNodeIdGenerator;
}
```

```ts
// packages/printer-core/src/template/builders/NodeBuilder.ts
import type { TemplateNode } from '../nodes/TemplateNode';
import type { BoxStyle } from '../style/BoxStyle';
import type { Dimension } from '../style/Dimension';
import type { Insets } from '../style/Insets';
import type { VisibilityCondition } from '../style/VisibilityCondition';
import type { BuildContext } from './BuildContext';

export abstract class NodeBuilder<TNode extends TemplateNode> {
  protected nodeId?: string;
  protected boxStyle: BoxStyle = {};
  protected visibility?: VisibilityCondition;

  id(value: string): this { this.nodeId = value; return this; }
  width(value: Dimension): this { this.boxStyle = { ...this.boxStyle, width: value }; return this; }
  height(value: Dimension): this { this.boxStyle = { ...this.boxStyle, height: value }; return this; }
  margin(value: Insets): this { this.boxStyle = { ...this.boxStyle, margin: value }; return this; }
  padding(value: Insets): this { this.boxStyle = { ...this.boxStyle, padding: value }; return this; }
  visibleWhen(condition: VisibilityCondition): this { this.visibility = condition; return this; }

  abstract build(context: BuildContext): TNode;
}
```

Note: `NodeBuilder`/`BuildContext`/`TemplateNodeIdGenerator` are not exported from `template/builders/index.ts` (built in Task 8) — internal to the builders folder, imported by sibling files via relative path only.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest packages/printer-core/src/template/builders/__tests__`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/template/builders/BuildContext.ts packages/printer-core/src/template/builders/NodeBuilder.ts packages/printer-core/src/template/builders/dimensions.ts packages/printer-core/src/template/builders/conditions.ts packages/printer-core/src/template/builders/__tests__
git commit -m "feat: add builder internals and dimension/visibility factories"
```

---

### Task 5: ContainerBuilder, TextBuilder, LineBuilder

**Files:**
- Create: `packages/printer-core/src/template/builders/ContainerBuilder.ts`
- Create: `packages/printer-core/src/template/builders/TextBuilder.ts`
- Create: `packages/printer-core/src/template/builders/LineBuilder.ts`
- Test: `packages/printer-core/src/template/builders/__tests__/ContainerBuilder.test.ts`
- Test: `packages/printer-core/src/template/builders/__tests__/TextBuilder.test.ts`
- Test: `packages/printer-core/src/template/builders/__tests__/LineBuilder.test.ts`

**Interfaces:**
- Consumes: `NodeBuilder`, `BuildContext`, `TemplateNodeIdGenerator` (Task 4); `ContainerNode`, `TextNode`, `LineNode` (Task 2).
- Produces: `column()`, `row()`, `text.literal()`, `text.binding()`, `line()` — consumed by Task 6-8 examples and by app-layer callers.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/printer-core/src/template/builders/__tests__/ContainerBuilder.test.ts
import { column, row } from '../ContainerBuilder';
import { text } from '../TextBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('ContainerBuilder', () => {
  const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };

  it('column() builds a container with direction "column"', () => {
    const node = column().build(context);
    expect(node).toMatchObject({ type: 'container', style: { direction: 'column' }, children: [] });
  });

  it('row() builds a container with direction "row"', () => {
    const node = row().build(context);
    expect(node.style?.direction).toBe('row');
  });

  it('gap/justifyContent/alignItems merge into style', () => {
    const node = column().gap(4).justifyContent('space-between').alignItems('center').build(context);
    expect(node.style).toEqual({ direction: 'column', gap: 4, justifyContent: 'space-between', alignItems: 'center' });
  });

  it('children() builds nested nodes recursively', () => {
    const node = row().children(text.literal('A'), text.literal('B')).build(context);
    expect(node.children).toHaveLength(2);
    expect(node.children[0]).toMatchObject({ type: 'text', text: 'A' });
  });
});
```

```ts
// packages/printer-core/src/template/builders/__tests__/TextBuilder.test.ts
import { text } from '../TextBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('TextBuilder', () => {
  const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };

  it('text.literal(value) sets `text`, not `binding`', () => {
    const node = text.literal('MY SHOP').build(context);
    expect(node.text).toBe('MY SHOP');
    expect(node.binding).toBeUndefined();
  });

  it('text.binding(path) sets `binding`, not `text`', () => {
    const node = text.binding('product.name').build(context);
    expect(node.binding).toBe('product.name');
    expect(node.text).toBeUndefined();
  });

  it('fontSize/bold/align/lineHeight merge into style', () => {
    const node = text.literal('X').fontSize(24).bold().align('center').lineHeight(28).build(context);
    expect(node.style).toEqual({ fontSize: 24, fontWeight: 'bold', textAlign: 'center', lineHeight: 28 });
  });

  it('width()/margin() from NodeBuilder also apply to text', () => {
    const node = text.literal('X').width({ type: 'fixed', value: 100 }).build(context);
    expect(node.style?.width).toEqual({ type: 'fixed', value: 100 });
  });
});
```

```ts
// packages/printer-core/src/template/builders/__tests__/LineBuilder.test.ts
import { line } from '../LineBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('LineBuilder', () => {
  it('line() builds a LineNode with default thickness undefined', () => {
    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const node = line().build(context);
    expect(node.type).toBe('line');
    expect(node.thickness).toBeUndefined();
  });

  it('thickness(value) sets thickness', () => {
    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const node = line().thickness(2).build(context);
    expect(node.thickness).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest packages/printer-core/src/template/builders/__tests__/ContainerBuilder.test.ts packages/printer-core/src/template/builders/__tests__/TextBuilder.test.ts packages/printer-core/src/template/builders/__tests__/LineBuilder.test.ts`
Expected: FAIL — cannot find modules `'../ContainerBuilder'`, `'../TextBuilder'`, `'../LineBuilder'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/printer-core/src/template/builders/ContainerBuilder.ts
import { NodeBuilder } from './NodeBuilder';
import type { BuildContext } from './BuildContext';
import type { ContainerNode } from '../nodes/ContainerNode';
import type { TemplateNode } from '../nodes/TemplateNode';
import type { LayoutStyle } from '../style/LayoutStyle';

class ContainerBuilder extends NodeBuilder<ContainerNode> {
  private readonly direction: 'row' | 'column';
  private readonly childBuilders: NodeBuilder<TemplateNode>[] = [];
  private gapValue?: number;
  private justify?: LayoutStyle['justifyContent'];
  private align?: LayoutStyle['alignItems'];

  constructor(direction: 'row' | 'column') { super(); this.direction = direction; }

  gap(value: number): this { this.gapValue = value; return this; }
  justifyContent(value: LayoutStyle['justifyContent']): this { this.justify = value; return this; }
  alignItems(value: LayoutStyle['alignItems']): this { this.align = value; return this; }
  children(...builders: NodeBuilder<TemplateNode>[]): this { this.childBuilders.push(...builders); return this; }

  build(context: BuildContext): ContainerNode {
    return {
      type: 'container',
      id: this.nodeId ?? context.idGenerator.next('container'),
      style: {
        ...this.boxStyle,
        direction: this.direction,
        ...(this.gapValue !== undefined ? { gap: this.gapValue } : {}),
        ...(this.justify !== undefined ? { justifyContent: this.justify } : {}),
        ...(this.align !== undefined ? { alignItems: this.align } : {}),
      },
      children: this.childBuilders.map((child) => child.build(context)),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export function column(): ContainerBuilder { return new ContainerBuilder('column'); }
export function row(): ContainerBuilder { return new ContainerBuilder('row'); }
export type { ContainerBuilder };
```

```ts
// packages/printer-core/src/template/builders/TextBuilder.ts
import { NodeBuilder } from './NodeBuilder';
import type { BuildContext } from './BuildContext';
import type { TextNode } from '../nodes/TextNode';
import type { TextStyle } from '../style/TextStyle';

type TextContent = { readonly kind: 'literal'; readonly value: string } | { readonly kind: 'binding'; readonly path: string };

class TextBuilder extends NodeBuilder<TextNode> {
  private readonly content: TextContent;
  private textStyle: TextStyle = {};

  constructor(content: TextContent) { super(); this.content = content; }

  fontSize(value: number): this { this.textStyle = { ...this.textStyle, fontSize: value }; return this; }
  bold(): this { this.textStyle = { ...this.textStyle, fontWeight: 'bold' }; return this; }
  align(value: TextStyle['textAlign']): this { this.textStyle = { ...this.textStyle, textAlign: value }; return this; }
  lineHeight(value: number): this { this.textStyle = { ...this.textStyle, lineHeight: value }; return this; }

  build(context: BuildContext): TextNode {
    return {
      type: 'text',
      id: this.nodeId ?? context.idGenerator.next('text'),
      style: { ...this.boxStyle, ...this.textStyle },
      ...(this.content.kind === 'literal' ? { text: this.content.value } : { binding: this.content.path }),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export const text = {
  literal(value: string): TextBuilder { return new TextBuilder({ kind: 'literal', value }); },
  binding(path: string): TextBuilder { return new TextBuilder({ kind: 'binding', path }); },
};
export type { TextBuilder };
```

```ts
// packages/printer-core/src/template/builders/LineBuilder.ts
import { NodeBuilder } from './NodeBuilder';
import type { BuildContext } from './BuildContext';
import type { LineNode } from '../nodes/LineNode';

class LineBuilder extends NodeBuilder<LineNode> {
  private thicknessValue?: number;

  thickness(value: number): this { this.thicknessValue = value; return this; }

  build(context: BuildContext): LineNode {
    return {
      type: 'line',
      id: this.nodeId ?? context.idGenerator.next('line'),
      style: this.boxStyle,
      ...(this.thicknessValue !== undefined ? { thickness: this.thicknessValue } : {}),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export function line(): LineBuilder { return new LineBuilder(); }
export type { LineBuilder };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest packages/printer-core/src/template/builders/__tests__/ContainerBuilder.test.ts packages/printer-core/src/template/builders/__tests__/TextBuilder.test.ts packages/printer-core/src/template/builders/__tests__/LineBuilder.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/template/builders/ContainerBuilder.ts packages/printer-core/src/template/builders/TextBuilder.ts packages/printer-core/src/template/builders/LineBuilder.ts packages/printer-core/src/template/builders/__tests__
git commit -m "feat: add Container/Text/Line builders"
```

---

### Task 6: BarcodeBuilder, QrCodeBuilder, ImageBuilder

**Files:**
- Create: `packages/printer-core/src/template/builders/BarcodeBuilder.ts`
- Create: `packages/printer-core/src/template/builders/QrCodeBuilder.ts`
- Create: `packages/printer-core/src/template/builders/ImageBuilder.ts`
- Test: `packages/printer-core/src/template/builders/__tests__/BarcodeBuilder.test.ts`
- Test: `packages/printer-core/src/template/builders/__tests__/QrCodeBuilder.test.ts`
- Test: `packages/printer-core/src/template/builders/__tests__/ImageBuilder.test.ts`

**Interfaces:**
- Consumes: `NodeBuilder`, `BuildContext` (Task 4); `BarcodeNode`, `QrCodeNode`, `ImageNode` (Task 2); `BarcodeSymbology` (`../../barcode`), `QrErrorCorrectionLevel` (`../../qrcode`), `Bitmap` (`../../types`).
- Produces: `barcode.literal()`/`barcode.binding()`, `qrcode.literal()`/`qrcode.binding()`, `image.bitmap()`/`image.binding()`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/printer-core/src/template/builders/__tests__/BarcodeBuilder.test.ts
import { barcode } from '../BarcodeBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('BarcodeBuilder', () => {
  const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };

  it('barcode.literal(value).symbology(...) builds a BarcodeNode with `content`', () => {
    const node = barcode.literal('ABC123').symbology('code128').build(context);
    expect(node).toMatchObject({ type: 'barcode', content: 'ABC123', symbology: 'code128' });
  });

  it('barcode.binding(path) sets `binding`, not `content`', () => {
    const node = barcode.binding('order.code').symbology('code128').build(context);
    expect(node.binding).toBe('order.code');
    expect(node.content).toBeUndefined();
  });

  it('readable(true) sets readable', () => {
    const node = barcode.literal('X').symbology('code128').readable(true).build(context);
    expect(node.readable).toBe(true);
  });
});
```

```ts
// packages/printer-core/src/template/builders/__tests__/QrCodeBuilder.test.ts
import { qrcode } from '../QrCodeBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('QrCodeBuilder', () => {
  const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };

  it('qrcode.literal(value) builds a QrCodeNode with `content`', () => {
    const node = qrcode.literal('https://example.com').build(context);
    expect(node).toMatchObject({ type: 'qrcode', content: 'https://example.com' });
  });

  it('qrcode.binding(path) sets `binding`', () => {
    const node = qrcode.binding('order.qr').build(context);
    expect(node.binding).toBe('order.qr');
  });

  it('errorCorrection(level) sets errorCorrection', () => {
    const node = qrcode.literal('X').errorCorrection('M').build(context);
    expect(node.errorCorrection).toBe('M');
  });
});
```

```ts
// packages/printer-core/src/template/builders/__tests__/ImageBuilder.test.ts
import { image } from '../ImageBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';
import type { Bitmap } from '../../../types';

describe('ImageBuilder', () => {
  const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
  const bitmap: Bitmap = { width: 1, height: 1, data: new Uint8Array([0]) };

  it('image.bitmap(source) sets `bitmap`', () => {
    const node = image.bitmap(bitmap).build(context);
    expect(node.bitmap).toBe(bitmap);
    expect(node.binding).toBeUndefined();
  });

  it('image.binding(path) sets `binding`', () => {
    const node = image.binding('product.logo').build(context);
    expect(node.binding).toBe('product.logo');
    expect(node.bitmap).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest packages/printer-core/src/template/builders/__tests__/BarcodeBuilder.test.ts packages/printer-core/src/template/builders/__tests__/QrCodeBuilder.test.ts packages/printer-core/src/template/builders/__tests__/ImageBuilder.test.ts`
Expected: FAIL — cannot find modules `'../BarcodeBuilder'`, `'../QrCodeBuilder'`, `'../ImageBuilder'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/printer-core/src/template/builders/BarcodeBuilder.ts
import { NodeBuilder } from './NodeBuilder';
import type { BuildContext } from './BuildContext';
import type { BarcodeNode } from '../nodes/BarcodeNode';
import type { BarcodeSymbology } from '../../barcode';

type BarcodeContent = { readonly kind: 'literal'; readonly value: string } | { readonly kind: 'binding'; readonly path: string };

class BarcodeBuilder extends NodeBuilder<BarcodeNode> {
  private readonly content: BarcodeContent;
  private symbologyValue?: BarcodeSymbology;
  private readableValue?: boolean;

  constructor(content: BarcodeContent) { super(); this.content = content; }

  symbology(value: BarcodeSymbology): this { this.symbologyValue = value; return this; }
  readable(value: boolean): this { this.readableValue = value; return this; }

  build(context: BuildContext): BarcodeNode {
    if (!this.symbologyValue) throw new Error('Barcode node requires .symbology(...)');
    return {
      type: 'barcode',
      id: this.nodeId ?? context.idGenerator.next('barcode'),
      symbology: this.symbologyValue,
      style: this.boxStyle,
      ...(this.content.kind === 'literal' ? { content: this.content.value } : { binding: this.content.path }),
      ...(this.readableValue !== undefined ? { readable: this.readableValue } : {}),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export const barcode = {
  literal(value: string): BarcodeBuilder { return new BarcodeBuilder({ kind: 'literal', value }); },
  binding(path: string): BarcodeBuilder { return new BarcodeBuilder({ kind: 'binding', path }); },
};
export type { BarcodeBuilder };
```

```ts
// packages/printer-core/src/template/builders/QrCodeBuilder.ts
import { NodeBuilder } from './NodeBuilder';
import type { BuildContext } from './BuildContext';
import type { QrCodeNode } from '../nodes/QrCodeNode';
import type { QrErrorCorrectionLevel } from '../../qrcode';

type QrContent = { readonly kind: 'literal'; readonly value: string } | { readonly kind: 'binding'; readonly path: string };

class QrCodeBuilder extends NodeBuilder<QrCodeNode> {
  private readonly content: QrContent;
  private errorCorrectionValue?: QrErrorCorrectionLevel;

  constructor(content: QrContent) { super(); this.content = content; }

  errorCorrection(value: QrErrorCorrectionLevel): this { this.errorCorrectionValue = value; return this; }

  build(context: BuildContext): QrCodeNode {
    return {
      type: 'qrcode',
      id: this.nodeId ?? context.idGenerator.next('qrcode'),
      style: this.boxStyle,
      ...(this.content.kind === 'literal' ? { content: this.content.value } : { binding: this.content.path }),
      ...(this.errorCorrectionValue !== undefined ? { errorCorrection: this.errorCorrectionValue } : {}),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export const qrcode = {
  literal(value: string): QrCodeBuilder { return new QrCodeBuilder({ kind: 'literal', value }); },
  binding(path: string): QrCodeBuilder { return new QrCodeBuilder({ kind: 'binding', path }); },
};
export type { QrCodeBuilder };
```

```ts
// packages/printer-core/src/template/builders/ImageBuilder.ts
import { NodeBuilder } from './NodeBuilder';
import type { BuildContext } from './BuildContext';
import type { ImageNode } from '../nodes/ImageNode';
import type { Bitmap } from '../../types';

type ImageContent = { readonly kind: 'bitmap'; readonly value: Bitmap } | { readonly kind: 'binding'; readonly path: string };

class ImageBuilder extends NodeBuilder<ImageNode> {
  private readonly content: ImageContent;

  constructor(content: ImageContent) { super(); this.content = content; }

  build(context: BuildContext): ImageNode {
    return {
      type: 'image',
      id: this.nodeId ?? context.idGenerator.next('image'),
      style: this.boxStyle,
      ...(this.content.kind === 'bitmap' ? { bitmap: this.content.value } : { binding: this.content.path }),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export const image = {
  bitmap(source: Bitmap): ImageBuilder { return new ImageBuilder({ kind: 'bitmap', value: source }); },
  binding(path: string): ImageBuilder { return new ImageBuilder({ kind: 'binding', path }); },
};
export type { ImageBuilder };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest packages/printer-core/src/template/builders/__tests__/BarcodeBuilder.test.ts packages/printer-core/src/template/builders/__tests__/QrCodeBuilder.test.ts packages/printer-core/src/template/builders/__tests__/ImageBuilder.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/template/builders/BarcodeBuilder.ts packages/printer-core/src/template/builders/QrCodeBuilder.ts packages/printer-core/src/template/builders/ImageBuilder.ts packages/printer-core/src/template/builders/__tests__
git commit -m "feat: add Barcode/QrCode/Image builders"
```

---

### Task 7: RepeatBuilder

**Files:**
- Create: `packages/printer-core/src/template/builders/RepeatBuilder.ts`
- Test: `packages/printer-core/src/template/builders/__tests__/RepeatBuilder.test.ts`

**Interfaces:**
- Consumes: `NodeBuilder`, `BuildContext` (Task 4); `RepeatNode`, `TemplateNode` (Task 2); `text` (Task 5, used only in the test).
- Produces: `repeat(binding)`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/printer-core/src/template/builders/__tests__/RepeatBuilder.test.ts
import { repeat } from '../RepeatBuilder';
import { text } from '../TextBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('RepeatBuilder', () => {
  const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };

  it('builds a RepeatNode with the given binding and template', () => {
    const node = repeat('toppings').template(text.binding('name')).build(context);
    expect(node).toMatchObject({ type: 'repeat', binding: 'toppings', template: { type: 'text', binding: 'name' } });
  });

  it('maxItemsPerPage(value) sets maxItemsPerPage', () => {
    const node = repeat('toppings').template(text.binding('name')).maxItemsPerPage(5).build(context);
    expect(node.maxItemsPerPage).toBe(5);
  });

  it('omits maxItemsPerPage when not set', () => {
    const node = repeat('toppings').template(text.binding('name')).build(context);
    expect(node.maxItemsPerPage).toBeUndefined();
  });

  it('throws when .template(...) was never called', () => {
    expect(() => repeat('toppings').build(context)).toThrow(/requires a \.template/);
  });

  it('has no width()/margin() methods (no style)', () => {
    const builder = repeat('toppings');
    // @ts-expect-error RepeatBuilder does not extend NodeBuilder's style methods
    builder.width;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/printer-core/src/template/builders/__tests__/RepeatBuilder.test.ts`
Expected: FAIL — cannot find module `'../RepeatBuilder'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/printer-core/src/template/builders/RepeatBuilder.ts
import type { BuildContext } from './BuildContext';
import type { RepeatNode } from '../nodes/RepeatNode';
import type { TemplateNode } from '../nodes/TemplateNode';
import type { VisibilityCondition } from '../style/VisibilityCondition';
import type { NodeBuilder } from './NodeBuilder';

class RepeatBuilder {
  private nodeId?: string;
  private readonly bindingPath: string;
  private templateBuilder?: NodeBuilder<TemplateNode>;
  private perPage?: number;
  private visibility?: VisibilityCondition;

  constructor(binding: string) { this.bindingPath = binding; }

  id(value: string): this { this.nodeId = value; return this; }
  template(node: NodeBuilder<TemplateNode>): this { this.templateBuilder = node; return this; }
  maxItemsPerPage(value: number): this { this.perPage = value; return this; }
  visibleWhen(condition: VisibilityCondition): this { this.visibility = condition; return this; }

  build(context: BuildContext): RepeatNode {
    if (!this.templateBuilder) throw new Error(`Repeat "${this.bindingPath}" requires a .template(...)`);
    return {
      type: 'repeat',
      id: this.nodeId ?? context.idGenerator.next('repeat'),
      binding: this.bindingPath,
      template: this.templateBuilder.build(context),
      ...(this.perPage !== undefined ? { maxItemsPerPage: this.perPage } : {}),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export function repeat(binding: string): RepeatBuilder { return new RepeatBuilder(binding); }
export type { RepeatBuilder };
```

`RepeatBuilder` deliberately does not extend `NodeBuilder` — it has no
`.width()`/`.margin()`/... (no `style` on `RepeatNode`, see Task 2).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest packages/printer-core/src/template/builders/__tests__/RepeatBuilder.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/template/builders/RepeatBuilder.ts packages/printer-core/src/template/builders/__tests__/RepeatBuilder.test.ts
git commit -m "feat: add RepeatBuilder"
```

---

### Task 8: Root builders + builders barrel

**Files:**
- Create: `packages/printer-core/src/template/builders/LabelTemplateBuilder.ts`
- Create: `packages/printer-core/src/template/builders/ReceiptTemplateBuilder.ts`
- Create: `packages/printer-core/src/template/builders/index.ts`
- Create: `packages/printer-core/src/template/index.ts`
- Test: `packages/printer-core/src/template/builders/__tests__/LabelTemplateBuilder.test.ts`
- Test: `packages/printer-core/src/template/builders/__tests__/ReceiptTemplateBuilder.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-7.
- Produces: `labelTemplate()`, `receiptTemplate()`, and the full public `template/` barrel export surface.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/printer-core/src/template/builders/__tests__/LabelTemplateBuilder.test.ts
import { labelTemplate } from '../LabelTemplateBuilder';
import { column } from '../ContainerBuilder';
import { text } from '../TextBuilder';
import { PrintTemplateType } from '../../PrintTemplateType';

describe('labelTemplate()', () => {
  it('builds a frozen LabelTemplate with sequential ids', () => {
    const t = labelTemplate()
      .size({ widthDots: 400, heightDots: 240, dpi: 203 })
      .root(column().children(text.literal('Hello')))
      .build();

    expect(t.type).toBe(PrintTemplateType.Label);
    expect(t.config).toEqual({ widthDots: 400, heightDots: 240, dpi: 203 });
    expect(t.root).toMatchObject({ type: 'container', children: [{ type: 'text', text: 'Hello' }] });
    expect(Object.isFrozen(t)).toBe(true);
  });

  it('throws when .size(...) is missing', () => {
    expect(() => labelTemplate().root(text.literal('X')).build()).toThrow(/requires \.size/);
  });

  it('throws when .root(...) is missing', () => {
    expect(() => labelTemplate().size({ widthDots: 1, heightDots: 1, dpi: 1 }).build()).toThrow(/requires \.root/);
  });
});
```

```ts
// packages/printer-core/src/template/builders/__tests__/ReceiptTemplateBuilder.test.ts
import { receiptTemplate } from '../ReceiptTemplateBuilder';
import { column } from '../ContainerBuilder';
import { text } from '../TextBuilder';
import { PrintTemplateType } from '../../PrintTemplateType';

describe('receiptTemplate()', () => {
  it('builds a ReceiptTemplate whose config has no heightDots', () => {
    const t = receiptTemplate()
      .size({ widthDots: 576, dpi: 203 })
      .root(column().children(text.literal('MY SHOP')))
      .build();

    expect(t.type).toBe(PrintTemplateType.Receipt);
    expect(t.config).toEqual({ widthDots: 576, dpi: 203 });
  });

  it('throws when .size(...) is missing', () => {
    expect(() => receiptTemplate().root(text.literal('X')).build()).toThrow(/requires \.size/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest packages/printer-core/src/template/builders/__tests__/LabelTemplateBuilder.test.ts packages/printer-core/src/template/builders/__tests__/ReceiptTemplateBuilder.test.ts`
Expected: FAIL — cannot find modules `'../LabelTemplateBuilder'`, `'../ReceiptTemplateBuilder'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/printer-core/src/template/builders/LabelTemplateBuilder.ts
import { PrintTemplateType } from '../PrintTemplateType';
import type { LabelTemplate } from '../PrintTemplate';
import type { LayoutConfig } from '../../layout/LayoutConfig';
import type { TemplateNode } from '../nodes/TemplateNode';
import type { NodeBuilder } from './NodeBuilder';
import { TemplateNodeIdGenerator } from './BuildContext';
import type { BuildContext } from './BuildContext';

class LabelTemplateBuilder {
  private layoutConfig?: LayoutConfig;
  private rootBuilder?: NodeBuilder<TemplateNode>;

  size(config: LayoutConfig): this { this.layoutConfig = config; return this; }
  root(node: NodeBuilder<TemplateNode>): this { this.rootBuilder = node; return this; }

  build(): LabelTemplate {
    if (!this.layoutConfig) throw new Error('Label template requires .size(...)');
    if (!this.rootBuilder) throw new Error('Print template requires .root(...)');

    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    return Object.freeze({
      id: context.idGenerator.next('template'),
      version: 1,
      type: PrintTemplateType.Label,
      config: this.layoutConfig,
      root: this.rootBuilder.build(context),
    });
  }
}

export function labelTemplate(): LabelTemplateBuilder { return new LabelTemplateBuilder(); }
export type { LabelTemplateBuilder };
```

```ts
// packages/printer-core/src/template/builders/ReceiptTemplateBuilder.ts
import { PrintTemplateType } from '../PrintTemplateType';
import type { ReceiptTemplate } from '../PrintTemplate';
import type { LayoutConfig } from '../../layout/LayoutConfig';
import type { TemplateNode } from '../nodes/TemplateNode';
import type { NodeBuilder } from './NodeBuilder';
import { TemplateNodeIdGenerator } from './BuildContext';
import type { BuildContext } from './BuildContext';

class ReceiptTemplateBuilder {
  private layoutConfig?: Omit<LayoutConfig, 'heightDots'>;
  private rootBuilder?: NodeBuilder<TemplateNode>;

  size(config: Omit<LayoutConfig, 'heightDots'>): this { this.layoutConfig = config; return this; }
  root(node: NodeBuilder<TemplateNode>): this { this.rootBuilder = node; return this; }

  build(): ReceiptTemplate {
    if (!this.layoutConfig) throw new Error('Receipt template requires .size(...)');
    if (!this.rootBuilder) throw new Error('Print template requires .root(...)');

    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    return Object.freeze({
      id: context.idGenerator.next('template'),
      version: 1,
      type: PrintTemplateType.Receipt,
      config: this.layoutConfig,
      root: this.rootBuilder.build(context),
    });
  }
}

export function receiptTemplate(): ReceiptTemplateBuilder { return new ReceiptTemplateBuilder(); }
export type { ReceiptTemplateBuilder };
```

```ts
// packages/printer-core/src/template/builders/index.ts
export { column, row } from './ContainerBuilder';
export { text } from './TextBuilder';
export { line } from './LineBuilder';
export { barcode } from './BarcodeBuilder';
export { qrcode } from './QrCodeBuilder';
export { image } from './ImageBuilder';
export { repeat } from './RepeatBuilder';
export { labelTemplate } from './LabelTemplateBuilder';
export { receiptTemplate } from './ReceiptTemplateBuilder';
export { fixed, fill, auto } from './dimensions';
export { exists, equals } from './conditions';
```

```ts
// packages/printer-core/src/template/index.ts
export * from './PrintTemplateType';
export * from './PrintTemplate';
export * from './nodes/TemplateNode';
export * from './style/Dimension';
export * from './style/Insets';
export * from './style/BoxStyle';
export * from './style/LayoutStyle';
export * from './style/TextStyle';
export * from './style/VisibilityCondition';
export * from './builders';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest packages/printer-core/src/template/builders/__tests__/LabelTemplateBuilder.test.ts packages/printer-core/src/template/builders/__tests__/ReceiptTemplateBuilder.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full template/ suite and type-check**

Run: `npx jest packages/printer-core/src/template && npm run type-check -w printer-core`
Expected: All template/ tests PASS, `tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add packages/printer-core/src/template
git commit -m "feat: add root template builders and template/ barrel export"
```

---

### Task 9: Resolved node model

**Files:**
- Create: `packages/printer-core/src/resolution/PrintData.ts`
- Create: `packages/printer-core/src/resolution/ResolvedNode.ts`
- Create: `packages/printer-core/src/resolution/ResolvedPage.ts`
- Test: `packages/printer-core/src/resolution/__tests__/ResolvedNode.test.ts`

**Interfaces:**
- Consumes: `BoxStyle`, `LayoutStyle`, `TextStyle` (Task 1); `BarcodeSymbology`, `QrErrorCorrectionLevel`, `Bitmap` (existing).
- Produces: `PrintData`, `ResolvedNode` (6 variants), `ResolvedPage` — `DocumentResolver` (Task 10) and `LayoutEngine` (Task 13) both consume these.

- [ ] **Step 1: Write the failing test**

```ts
// packages/printer-core/src/resolution/__tests__/ResolvedNode.test.ts
import type { ResolvedNode, ResolvedContainer, ResolvedText } from '../ResolvedNode';
import type { ResolvedPage } from '../ResolvedPage';
import type { PrintData } from '../PrintData';

describe('ResolvedNode', () => {
  it('ResolvedText carries a resolved `value`, not `text`/`binding`', () => {
    const node: ResolvedText = { type: 'text', id: 't1', value: 'Milk Tea' };
    expect(node.value).toBe('Milk Tea');
  });

  it('ResolvedContainer nests ResolvedNode children', () => {
    const tree: ResolvedContainer = {
      type: 'container',
      id: 'root',
      children: [{ type: 'text', id: 't1', value: 'A' }],
    };
    expect(tree.children).toHaveLength(1);
  });

  it('ResolvedPage discriminates ok/error by `status`', () => {
    const ok: ResolvedPage = { status: 'ok', pageIndex: 0, node: { type: 'text', id: 't1', value: 'A' } };
    const error: ResolvedPage = { status: 'error', pageIndex: 1, nodeId: 't2', message: 'missing binding' };
    expect(ok.status).toBe('ok');
    expect(error.status).toBe('error');
  });

  it('PrintData is a readonly record', () => {
    const data: PrintData = { product: { name: 'Milk Tea' } };
    expect(data.product).toEqual({ name: 'Milk Tea' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/printer-core/src/resolution/__tests__/ResolvedNode.test.ts`
Expected: FAIL — cannot find module `'../ResolvedNode'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/printer-core/src/resolution/PrintData.ts
export type PrintData = Readonly<Record<string, unknown>>;
```

```ts
// packages/printer-core/src/resolution/ResolvedNode.ts
import type { LayoutStyle } from '../template/style/LayoutStyle';
import type { BoxStyle } from '../template/style/BoxStyle';
import type { TextStyle } from '../template/style/TextStyle';
import type { BarcodeSymbology } from '../barcode';
import type { QrErrorCorrectionLevel } from '../qrcode';
import type { Bitmap } from '../types';

export type ResolvedNode = ResolvedContainer | ResolvedText | ResolvedLine | ResolvedBarcode | ResolvedQrCode | ResolvedImage;

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
  readonly style?: BoxStyle & TextStyle;
}

export interface ResolvedLine {
  readonly type: 'line';
  readonly id: string;
  readonly thickness?: number;
  readonly style?: BoxStyle;
}

export interface ResolvedBarcode {
  readonly type: 'barcode';
  readonly id: string;
  readonly value: string;
  readonly symbology: BarcodeSymbology;
  readonly readable?: boolean;
  readonly style?: BoxStyle;
}

export interface ResolvedQrCode {
  readonly type: 'qrcode';
  readonly id: string;
  readonly value: string;
  readonly errorCorrection?: QrErrorCorrectionLevel;
  readonly style?: BoxStyle;
}

export interface ResolvedImage {
  readonly type: 'image';
  readonly id: string;
  readonly bitmap: Bitmap;
  readonly style?: BoxStyle;
}
```

```ts
// packages/printer-core/src/resolution/ResolvedPage.ts
import type { ResolvedNode } from './ResolvedNode';

export type ResolvedPage =
  | { readonly status: 'ok'; readonly pageIndex: number; readonly node: ResolvedNode }
  | { readonly status: 'error'; readonly pageIndex: number; readonly nodeId: string; readonly message: string };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest packages/printer-core/src/resolution/__tests__/ResolvedNode.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/resolution/PrintData.ts packages/printer-core/src/resolution/ResolvedNode.ts packages/printer-core/src/resolution/ResolvedPage.ts packages/printer-core/src/resolution/__tests__
git commit -m "feat: add ResolvedNode/ResolvedPage model"
```

---

### Task 10: DocumentResolver — binding, visibility, per-page error isolation (no pagination yet)

**Files:**
- Create: `packages/printer-core/src/resolution/DocumentResolver.ts`
- Test: `packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts`

**Interfaces:**
- Consumes: `PrintTemplate`, `TemplateNode` (all 7 variants), `PrintTemplateType` (`../template`); `PrintData`, `ResolvedNode`, `ResolvedPage` (Task 9).
- Produces: `DocumentResolver` class, `createDocumentResolver()` factory — Task 11 extends this same file with pagination; Task 15's integration test consumes this.

This task implements resolution for a **single page** (no `maxItemsPerPage` support yet — every `RepeatNode` is treated as "expand the full array, one page total"). Task 11 adds pagination on top without changing this task's binding/visibility logic.

- [ ] **Step 1: Write the failing test**

```ts
// packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
import { createDocumentResolver } from '../DocumentResolver';
import { PrintTemplateType } from '../../template/PrintTemplateType';
import type { LabelTemplate } from '../../template/PrintTemplate';
import type { PrintData } from '../PrintData';

const resolver = createDocumentResolver();

function label(root: LabelTemplate['root']): LabelTemplate {
  return { id: 't1', version: 1, type: PrintTemplateType.Label, config: { widthDots: 400, heightDots: 240, dpi: 203 }, root };
}

describe('DocumentResolver', () => {
  it('resolves a literal TextNode to its literal value', () => {
    const pages = resolver.resolve(label({ type: 'text', id: 't1', text: 'MY SHOP' }), {});
    expect(pages).toEqual([{ status: 'ok', pageIndex: 0, node: { type: 'text', id: 't1', value: 'MY SHOP' } }]);
  });

  it('resolves a bound TextNode via a dotted path', () => {
    const data: PrintData = { product: { name: 'Milk Tea' } };
    const pages = resolver.resolve(label({ type: 'text', id: 't1', binding: 'product.name' }), data);
    expect(pages[0]).toEqual({ status: 'ok', pageIndex: 0, node: { type: 'text', id: 't1', value: 'Milk Tea' } });
  });

  it('drops a node whose visibleWhen "exists" condition is false', () => {
    const tree = label({
      type: 'container', id: 'root', children: [
        { type: 'text', id: 't1', text: 'always' },
        { type: 'text', id: 't2', text: 'conditional', visibleWhen: { type: 'exists', binding: 'discount' } },
      ],
    });
    const pages = resolver.resolve(tree, {});
    const root = pages[0].status === 'ok' ? pages[0].node : null;
    expect(root?.type).toBe('container');
    if (root?.type === 'container') expect(root.children).toHaveLength(1);
  });

  it('keeps a node whose visibleWhen "equals" condition matches', () => {
    const tree = label({
      type: 'text', id: 't1', text: 'paid', visibleWhen: { type: 'equals', binding: 'status', value: 'paid' },
    });
    const pages = resolver.resolve(tree, { status: 'paid' });
    expect(pages[0]).toMatchObject({ status: 'ok' });
  });

  it('expands a RepeatNode into a ResolvedContainer with one child per item', () => {
    const tree = label({
      type: 'repeat', id: 'r1', binding: 'toppings',
      template: { type: 'text', id: 'item', binding: 'name' },
    });
    const data: PrintData = { toppings: [{ name: 'Pearl' }, { name: 'Cheese' }] };
    const pages = resolver.resolve(tree, data);
    const node = pages[0].status === 'ok' ? pages[0].node : null;
    expect(node?.type).toBe('container');
    if (node?.type === 'container') {
      expect(node.children).toEqual([
        { type: 'text', id: 'item', value: 'Pearl' },
        { type: 'text', id: 'item', value: 'Cheese' },
      ]);
    }
  });

  it('resolves an item-scoped binding with fallback to the outer scope', () => {
    const tree = label({
      type: 'repeat', id: 'r1', binding: 'items',
      template: {
        type: 'container', id: 'row', children: [
          { type: 'text', id: 'name', binding: 'name' },
          { type: 'text', id: 'store', binding: 'storeName' },
        ],
      },
    });
    const data: PrintData = { storeName: 'My Shop', items: [{ name: 'Tea' }] };
    const pages = resolver.resolve(tree, data);
    const node = pages[0].status === 'ok' ? pages[0].node : null;
    expect(node?.type).toBe('container');
    if (node?.type === 'container') {
      const row = node.children[0];
      expect(row.type).toBe('container');
      if (row.type === 'container') {
        expect(row.children).toEqual([
          { type: 'text', id: 'name', value: 'Tea' },
          { type: 'text', id: 'store', value: 'My Shop' },
        ]);
      }
    }
  });

  it('returns a page-scoped error when a binding path is missing', () => {
    const pages = resolver.resolve(label({ type: 'text', id: 't1', binding: 'product.name' }), {});
    expect(pages).toEqual([{ status: 'error', pageIndex: 0, nodeId: 't1', message: expect.stringContaining('product.name') }]);
  });

  it('returns a page-scoped error when RepeatNode.binding is not an array', () => {
    const tree = label({ type: 'repeat', id: 'r1', binding: 'toppings', template: { type: 'text', id: 'x', binding: 'name' } });
    const pages = resolver.resolve(tree, { toppings: 'not-an-array' });
    expect(pages[0]).toMatchObject({ status: 'error', nodeId: 'r1' });
  });

  it('errors when a TextNode has neither text nor binding', () => {
    const pages = resolver.resolve(label({ type: 'text', id: 't1' }), {});
    expect(pages[0]).toMatchObject({ status: 'error', nodeId: 't1' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts`
Expected: FAIL — cannot find module `'../DocumentResolver'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/printer-core/src/resolution/DocumentResolver.ts
import type { PrintTemplate } from '../template/PrintTemplate';
import type { TemplateNode } from '../template/nodes/TemplateNode';
import type { PrintData } from './PrintData';
import type { ResolvedNode } from './ResolvedNode';
import type { ResolvedPage } from './ResolvedPage';

type Scope = { readonly data: unknown; readonly parent: Scope | null };

function getPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function lookup(scope: Scope, path: string): unknown {
  let current: Scope | null = scope;
  while (current) {
    const value = getPath(current.data, path);
    if (value !== undefined) return value;
    current = current.parent;
  }
  return undefined;
}

function evaluateVisibility(node: TemplateNode, scope: Scope): boolean {
  if (!('visibleWhen' in node) || !node.visibleWhen) return true;
  const condition = node.visibleWhen;
  if (condition.type === 'exists') return lookup(scope, condition.binding) !== undefined;
  return lookup(scope, condition.binding) === condition.value;
}

class ResolveError extends Error {
  constructor(readonly nodeId: string, message: string) { super(message); }
}

function resolveNode(node: TemplateNode, scope: Scope): ResolvedNode | null {
  if (!evaluateVisibility(node, scope)) return null;

  switch (node.type) {
    case 'container':
      return {
        type: 'container',
        id: node.id,
        style: node.style,
        children: node.children.map((child) => resolveNode(child, scope)).filter((child): child is ResolvedNode => child !== null),
      };

    case 'text': {
      if (node.text !== undefined) return { type: 'text', id: node.id, value: node.text, style: node.style };
      if (node.binding === undefined) throw new ResolveError(node.id, `TextNode "${node.id}" has neither text nor binding`);
      const value = lookup(scope, node.binding);
      if (value === undefined) throw new ResolveError(node.id, `binding "${node.binding}" not found for node "${node.id}"`);
      return { type: 'text', id: node.id, value: String(value), style: node.style };
    }

    case 'line':
      return { type: 'line', id: node.id, thickness: node.thickness, style: node.style };

    case 'barcode': {
      const value = node.content ?? (node.binding !== undefined ? lookup(scope, node.binding) : undefined);
      if (value === undefined) throw new ResolveError(node.id, `barcode "${node.id}" has no content/binding value`);
      return { type: 'barcode', id: node.id, value: String(value), symbology: node.symbology, readable: node.readable, style: node.style };
    }

    case 'qrcode': {
      const value = node.content ?? (node.binding !== undefined ? lookup(scope, node.binding) : undefined);
      if (value === undefined) throw new ResolveError(node.id, `qrcode "${node.id}" has no content/binding value`);
      return { type: 'qrcode', id: node.id, value: String(value), errorCorrection: node.errorCorrection, style: node.style };
    }

    case 'image': {
      const bitmap = node.bitmap ?? (node.binding !== undefined ? lookup(scope, node.binding) : undefined);
      if (bitmap === undefined) throw new ResolveError(node.id, `image "${node.id}" has no bitmap/binding value`);
      return { type: 'image', id: node.id, bitmap: bitmap as never, style: node.style };
    }

    case 'repeat': {
      const items = lookup(scope, node.binding);
      if (!Array.isArray(items)) throw new ResolveError(node.id, `repeat "${node.id}" binding "${node.binding}" is not an array`);
      const children = items
        .map((item) => resolveNode(node.template, { data: item, parent: scope }))
        .filter((child): child is ResolvedNode => child !== null);
      return { type: 'container', id: node.id, children };
    }
  }
}

export class DocumentResolver {
  resolve(template: PrintTemplate, data: PrintData): readonly ResolvedPage[] {
    const scope: Scope = { data, parent: null };
    try {
      const node = resolveNode(template.root, scope);
      return [{ status: 'ok', pageIndex: 0, node: node ?? { type: 'container', id: template.root.id, children: [] } }];
    } catch (error) {
      if (error instanceof ResolveError) return [{ status: 'error', pageIndex: 0, nodeId: error.nodeId, message: error.message }];
      throw error;
    }
  }
}

export function createDocumentResolver(): DocumentResolver { return new DocumentResolver(); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/resolution/DocumentResolver.ts packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts
git commit -m "feat: add DocumentResolver binding/visibility/error-isolation"
```

---

### Task 11: DocumentResolver — pagination

**Files:**
- Modify: `packages/printer-core/src/resolution/DocumentResolver.ts`
- Test: `packages/printer-core/src/resolution/__tests__/DocumentResolver.pagination.test.ts`

**Interfaces:**
- Consumes: everything from Task 10 in the same file.
- Produces: `DocumentResolver.resolve()` now returns multiple pages when any `RepeatNode.maxItemsPerPage` requires it. Signature unchanged from Task 10.

- [ ] **Step 1: Write the failing test**

```ts
// packages/printer-core/src/resolution/__tests__/DocumentResolver.pagination.test.ts
import { createDocumentResolver } from '../DocumentResolver';
import { PrintTemplateType } from '../../template/PrintTemplateType';
import type { LabelTemplate } from '../../template/PrintTemplate';
import type { PrintData } from '../PrintData';

const resolver = createDocumentResolver();

function label(root: LabelTemplate['root']): LabelTemplate {
  return { id: 't1', version: 1, type: PrintTemplateType.Label, config: { widthDots: 400, heightDots: 240, dpi: 203 }, root };
}

describe('DocumentResolver pagination', () => {
  it('produces 1 page when no RepeatNode has maxItemsPerPage', () => {
    const tree = label({ type: 'repeat', id: 'r1', binding: 'toppings', template: { type: 'text', id: 'x', binding: 'name' } });
    const data: PrintData = { toppings: Array.from({ length: 12 }, (_, i) => ({ name: `Topping ${i}` })) };
    const pages = resolver.resolve(tree, data);
    expect(pages).toHaveLength(1);
  });

  it('splits into ceil(count / maxItemsPerPage) pages', () => {
    const tree = label({ type: 'repeat', id: 'r1', binding: 'toppings', maxItemsPerPage: 5, template: { type: 'text', id: 'x', binding: 'name' } });
    const data: PrintData = { toppings: Array.from({ length: 12 }, (_, i) => ({ name: `Topping ${i}` })) };
    const pages = resolver.resolve(tree, data);
    expect(pages).toHaveLength(3);
    for (const [i, page] of pages.entries()) expect(page).toMatchObject({ status: 'ok', pageIndex: i });
  });

  it('slices items correctly per page, with an empty tail slice on the last page', () => {
    const tree = label({ type: 'repeat', id: 'r1', binding: 'toppings', maxItemsPerPage: 5, template: { type: 'text', id: 'x', binding: 'name' } });
    const data: PrintData = { toppings: Array.from({ length: 12 }, (_, i) => ({ name: `T${i}` })) };
    const pages = resolver.resolve(tree, data);
    const values = (page: (typeof pages)[number]) => (page.status === 'ok' && page.node.type === 'container' ? page.node.children.map((c) => (c.type === 'text' ? c.value : '')) : []);
    expect(values(pages[0])).toEqual(['T0', 'T1', 'T2', 'T3', 'T4']);
    expect(values(pages[1])).toEqual(['T5', 'T6', 'T7', 'T8', 'T9']);
    expect(values(pages[2])).toEqual(['T10', 'T11']);
  });

  it('keeps a non-paginating RepeatNode fully on every page (synchronized with a paginating one)', () => {
    const tree = label({
      type: 'container', id: 'root', children: [
        { type: 'repeat', id: 'toppings', binding: 'toppings', maxItemsPerPage: 5, template: { type: 'text', id: 'ti', binding: 'name' } },
        { type: 'repeat', id: 'allergens', binding: 'allergens', template: { type: 'text', id: 'ai', binding: 'name' } },
      ],
    });
    const data: PrintData = {
      toppings: Array.from({ length: 12 }, (_, i) => ({ name: `T${i}` })),
      allergens: [{ name: 'Nuts' }, { name: 'Dairy' }],
    };
    const pages = resolver.resolve(tree, data);
    expect(pages).toHaveLength(3);
    for (const page of pages) {
      if (page.status !== 'ok' || page.node.type !== 'container') throw new Error('expected ok container page');
      const allergensNode = page.node.children[1];
      if (allergensNode.type !== 'container') throw new Error('expected container');
      expect(allergensNode.children).toHaveLength(2);
    }
  });

  it('isolates a resolve error to its own page without affecting other pages', () => {
    const tree = label({ type: 'repeat', id: 'r1', binding: 'toppings', maxItemsPerPage: 1, template: { type: 'text', id: 'x', binding: 'name' } });
    const data: PrintData = { toppings: [{ name: 'Pearl' }, {}, { name: 'Cheese' }] };
    const pages = resolver.resolve(tree, data);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toMatchObject({ status: 'ok' });
    expect(pages[1]).toMatchObject({ status: 'error', pageIndex: 1 });
    expect(pages[2]).toMatchObject({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/printer-core/src/resolution/__tests__/DocumentResolver.pagination.test.ts`
Expected: FAIL — every test gets `pages.length === 1` (no pagination logic yet), or a raw `ResolveError` throw escapes `resolve()` for the isolation test.

- [ ] **Step 3: Write the implementation**

Replace `DocumentResolver.resolve()`'s body (keep `resolveNode`/`lookup`/`evaluateVisibility`/`ResolveError` from Task 10 unchanged) with a page-aware version. Add these two helpers above the class, and change the class body:

```ts
// packages/printer-core/src/resolution/DocumentResolver.ts — add above `export class DocumentResolver`

function countPaginatingItems(node: TemplateNode, scope: Scope, counts: number[]): void {
  if (node.type === 'repeat') {
    const items = lookup(scope, node.binding);
    if (Array.isArray(node.template ? [] : []) && node.maxItemsPerPage !== undefined && Array.isArray(items)) {
      counts.push(Math.ceil(items.length / node.maxItemsPerPage));
    }
    // Do not recurse into a RepeatNode's own template — nested paginating
    // repeats are out of scope (see spec's "Ngoài phạm vi").
    return;
  }
  if (node.type === 'container') {
    for (const child of node.children) countPaginatingItems(child, scope, counts);
  }
}

function resolveNodeForPage(node: TemplateNode, scope: Scope, pageIndex: number): ResolvedNode | null {
  if (!evaluateVisibility(node, scope)) return null;

  if (node.type === 'repeat') {
    const items = lookup(scope, node.binding);
    if (!Array.isArray(items)) throw new ResolveError(node.id, `repeat "${node.id}" binding "${node.binding}" is not an array`);
    const slice = node.maxItemsPerPage !== undefined ? items.slice(pageIndex * node.maxItemsPerPage, (pageIndex + 1) * node.maxItemsPerPage) : items;
    const children = slice
      .map((item) => resolveNode(node.template, { data: item, parent: scope }))
      .filter((child): child is ResolvedNode => child !== null);
    return { type: 'container', id: node.id, children };
  }

  if (node.type === 'container') {
    return {
      type: 'container',
      id: node.id,
      style: node.style,
      children: node.children.map((child) => resolveNodeForPage(child, scope, pageIndex)).filter((child): child is ResolvedNode => child !== null),
    };
  }

  return resolveNode(node, scope);
}
```

```ts
// packages/printer-core/src/resolution/DocumentResolver.ts — replace the class body

export class DocumentResolver {
  resolve(template: PrintTemplate, data: PrintData): readonly ResolvedPage[] {
    const scope: Scope = { data, parent: null };
    const pageCounts: number[] = [];
    countPaginatingItems(template.root, scope, pageCounts);
    const pageCount = Math.max(1, ...pageCounts, 0) || 1;

    const pages: ResolvedPage[] = [];
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      try {
        const node = resolveNodeForPage(template.root, scope, pageIndex);
        pages.push({ status: 'ok', pageIndex, node: node ?? { type: 'container', id: template.root.id, children: [] } });
      } catch (error) {
        if (error instanceof ResolveError) pages.push({ status: 'error', pageIndex, nodeId: error.nodeId, message: error.message });
        else throw error;
      }
    }
    return pages;
  }
}

export function createDocumentResolver(): DocumentResolver { return new DocumentResolver(); }
```

Note: `Math.max(1, ...pageCounts, 0) || 1` guards the empty-array case
(`Math.max()` with no elements is `-Infinity`); the trailing `0` keeps
`Math.max` from receiving zero arguments, and `|| 1` converts a `0` result
(only possible when every count is `0`) back to `1`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest packages/printer-core/src/resolution/__tests__/DocumentResolver.pagination.test.ts packages/printer-core/src/resolution/__tests__/DocumentResolver.test.ts`
Expected: PASS (all tests from Task 10 and Task 11 — Task 10's tests must still pass unchanged)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/resolution/DocumentResolver.ts packages/printer-core/src/resolution/__tests__/DocumentResolver.pagination.test.ts
git commit -m "feat: add synchronized multi-RepeatNode pagination to DocumentResolver"
```

---

### Task 12: FontMetrics, ApproximateFontMetrics, TypographyProfile

**Files:**
- Create: `packages/printer-core/src/layout/TextMeasurement.ts`
- Create: `packages/printer-core/src/layout/FontMetrics.ts`
- Create: `packages/printer-core/src/layout/ApproximateFontMetrics.ts`
- Create: `packages/printer-core/src/layout/TypographyProfile.ts`
- Test: `packages/printer-core/src/layout/__tests__/ApproximateFontMetrics.test.ts`

**Interfaces:**
- Consumes: `TextStyle` (Task 1).
- Produces: `FontMetrics`, `ApproximateFontMetrics`, `TypographyProfile`, `FontScaleLevel`, `TextMeasurement` — `LayoutEngine` (Task 13-14) consumes these.

- [ ] **Step 1: Write the failing test**

```ts
// packages/printer-core/src/layout/__tests__/ApproximateFontMetrics.test.ts
import { ApproximateFontMetrics } from '../ApproximateFontMetrics';

describe('ApproximateFontMetrics', () => {
  const metrics = new ApproximateFontMetrics();

  it('measure() scales width with text length and fontSize', () => {
    const small = metrics.measure('AB', { fontSize: 10 });
    const long = metrics.measure('ABCD', { fontSize: 10 });
    expect(long.widthDots).toBeGreaterThan(small.widthDots);
  });

  it('measure() reports lineCount 1 for single-line text', () => {
    const result = metrics.measure('hello', { fontSize: 12 });
    expect(result.lineCount).toBe(1);
  });

  it('wrap() splits text into lines that each fit maxWidthDots', () => {
    const lines = metrics.wrap('one two three four', 60, { fontSize: 10 });
    for (const line of lines) {
      expect(metrics.measure(line, { fontSize: 10 }).widthDots).toBeLessThanOrEqual(60);
    }
  });

  it('wrap() hard-breaks a single word longer than maxWidthDots', () => {
    const lines = metrics.wrap('supercalifragilisticexpialidocious', 40, { fontSize: 10 });
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(metrics.measure(line, { fontSize: 10 }).widthDots).toBeLessThanOrEqual(40);
    }
  });

  it('wrap() returns the original text as one line when it already fits', () => {
    const lines = metrics.wrap('short', 1000, { fontSize: 10 });
    expect(lines).toEqual(['short']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/printer-core/src/layout/__tests__/ApproximateFontMetrics.test.ts`
Expected: FAIL — cannot find module `'../ApproximateFontMetrics'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/printer-core/src/layout/TextMeasurement.ts
export interface TextMeasurement {
  readonly widthDots: number;
  readonly heightDots: number;
  readonly lineCount: number;
}
```

```ts
// packages/printer-core/src/layout/FontMetrics.ts
import type { TextStyle } from '../template/style/TextStyle';
import type { TextMeasurement } from './TextMeasurement';

export interface FontMetrics {
  measure(text: string, style: TextStyle): TextMeasurement;
  wrap(text: string, maxWidthDots: number, style: TextStyle): readonly string[];
}
```

```ts
// packages/printer-core/src/layout/TypographyProfile.ts
export interface FontScaleLevel {
  readonly id: string;
  readonly fontScale: number;
  readonly lineHeightScale: number;
}

export interface TypographyProfile {
  readonly fontScaleLevels: readonly FontScaleLevel[];
}
```

```ts
// packages/printer-core/src/layout/ApproximateFontMetrics.ts
import type { FontMetrics } from './FontMetrics';
import type { TextMeasurement } from './TextMeasurement';
import type { TextStyle } from '../template/style/TextStyle';

const DOTS_PER_CHAR_AT_SIZE_1 = 6;
const DOTS_PER_LINE_HEIGHT_AT_SIZE_1 = 10;

export class ApproximateFontMetrics implements FontMetrics {
  measure(text: string, style: TextStyle): TextMeasurement {
    const fontSize = style.fontSize ?? 10;
    const lineHeight = style.lineHeight ?? fontSize * 1.2;
    const lines = text.split('\n');
    const widthDots = Math.max(...lines.map((line) => line.length * DOTS_PER_CHAR_AT_SIZE_1 * (fontSize / 10)));
    return { widthDots, heightDots: lines.length * lineHeight * (DOTS_PER_LINE_HEIGHT_AT_SIZE_1 / 10), lineCount: lines.length };
  }

  wrap(text: string, maxWidthDots: number, style: TextStyle): readonly string[] {
    const fontSize = style.fontSize ?? 10;
    const dotsPerChar = DOTS_PER_CHAR_AT_SIZE_1 * (fontSize / 10);
    const maxChars = Math.max(1, Math.floor(maxWidthDots / dotsPerChar));

    const lines: string[] = [];
    let current = '';
    for (const word of text.split(' ')) {
      let remainingWord = word;
      while (remainingWord.length > maxChars) {
        if (current.length > 0) { lines.push(current); current = ''; }
        lines.push(remainingWord.slice(0, maxChars));
        remainingWord = remainingWord.slice(maxChars);
      }
      const candidate = current.length === 0 ? remainingWord : `${current} ${remainingWord}`;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        if (current.length > 0) lines.push(current);
        current = remainingWord;
      }
    }
    if (current.length > 0) lines.push(current);
    return lines.length > 0 ? lines : [''];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest packages/printer-core/src/layout/__tests__/ApproximateFontMetrics.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/layout/TextMeasurement.ts packages/printer-core/src/layout/FontMetrics.ts packages/printer-core/src/layout/TypographyProfile.ts packages/printer-core/src/layout/ApproximateFontMetrics.ts packages/printer-core/src/layout/__tests__
git commit -m "feat: add FontMetrics contract and ApproximateFontMetrics"
```

---

### Task 13: LayoutEngine — arrange and map to PrintElement (single scale)

**Files:**
- Create: `packages/printer-core/src/layout/LayoutEngine.ts`
- Test: `packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts`

**Interfaces:**
- Consumes: `ResolvedNode` (Task 9), `LayoutConfig`, `FontMetrics`, `TypographyProfile` (Task 1, 12); `PrintElement` and its variants (existing, `../builder`).
- Produces: `LayoutEngine` class, `createLayoutEngine()` — arranges a tree at a **fixed scale of 1** (Task 14 adds the multi-scale search on top without changing this task's arrangement logic).

- [ ] **Step 1: Write the failing test**

```ts
// packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts
import { createLayoutEngine } from '../LayoutEngine';
import { ApproximateFontMetrics } from '../ApproximateFontMetrics';
import type { ResolvedNode } from '../../resolution/ResolvedNode';
import type { LayoutConfig } from '../LayoutConfig';
import type { TypographyProfile } from '../TypographyProfile';

const engine = createLayoutEngine();
const fontMetrics = new ApproximateFontMetrics();
const typography: TypographyProfile = { fontScaleLevels: [{ id: 'default', fontScale: 1, lineHeightScale: 1 }] };
const receiptConfig: LayoutConfig = { widthDots: 576, dpi: 203 };

describe('LayoutEngine', () => {
  it('maps a single ResolvedText to a TextElement at x=0,y=0', () => {
    const root: ResolvedNode = { type: 'text', id: 't1', value: 'Hello', style: { fontSize: 20 } };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    expect(elements).toHaveLength(1);
    expect(elements[0]).toMatchObject({ type: 'text', content: 'Hello', options: { x: 0, y: 0, size: 20 } });
  });

  it('stacks column children vertically with gap', () => {
    const root: ResolvedNode = {
      type: 'container', id: 'root', style: { direction: 'column', gap: 10 },
      children: [
        { type: 'text', id: 't1', value: 'A', style: { fontSize: 10 } },
        { type: 'text', id: 't2', value: 'B', style: { fontSize: 10 } },
      ],
    };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    expect(elements).toHaveLength(2);
    const [first, second] = elements;
    if (first.type !== 'text' || second.type !== 'text') throw new Error('expected text elements');
    expect(first.options?.y).toBe(0);
    expect(second.options?.y).toBeGreaterThan(first.options?.y ?? 0);
  });

  it('lays out row children horizontally with gap', () => {
    const root: ResolvedNode = {
      type: 'container', id: 'root', style: { direction: 'row', gap: 20 },
      children: [
        { type: 'text', id: 't1', value: 'A', style: { fontSize: 10 } },
        { type: 'text', id: 't2', value: 'B', style: { fontSize: 10 } },
      ],
    };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    const [first, second] = elements;
    if (first.type !== 'text' || second.type !== 'text') throw new Error('expected text elements');
    expect(first.options?.x).toBe(0);
    expect(second.options?.x).toBeGreaterThan(first.options?.x ?? 0);
  });

  it('applies padding as an offset for the container\'s children', () => {
    const root: ResolvedNode = {
      type: 'container', id: 'root', style: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
      children: [{ type: 'text', id: 't1', value: 'A', style: { fontSize: 10 } }],
    };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    if (elements[0].type !== 'text') throw new Error('expected text element');
    expect(elements[0].options?.x).toBe(8);
    expect(elements[0].options?.y).toBe(8);
  });

  it('maps ResolvedBarcode/ResolvedQrCode/ResolvedImage/ResolvedLine to their PrintElement', () => {
    const root: ResolvedNode = {
      type: 'container', id: 'root', style: { direction: 'column' },
      children: [
        { type: 'barcode', id: 'b1', value: 'ABC', symbology: 'code128', readable: true },
        { type: 'qrcode', id: 'q1', value: 'XYZ' },
        { type: 'image', id: 'i1', bitmap: { width: 1, height: 1, data: new Uint8Array([0]) } },
        { type: 'line', id: 'l1', thickness: 2 },
      ],
    };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    expect(elements.map((e) => e.type)).toEqual(['barcode', 'qrcode', 'image', 'line']);
  });

  it('produces no PrintElement for a ResolvedContainer itself', () => {
    const root: ResolvedNode = { type: 'container', id: 'root', children: [] };
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    expect(elements).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts`
Expected: FAIL — cannot find module `'../LayoutEngine'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/printer-core/src/layout/LayoutEngine.ts
import type { ResolvedNode } from '../resolution/ResolvedNode';
import type { LayoutConfig } from './LayoutConfig';
import type { TypographyProfile } from './TypographyProfile';
import type { FontMetrics } from './FontMetrics';
import type { PrintElement } from '../builder';

interface Position { readonly x: number; readonly y: number; }
interface Size { readonly widthDots: number; readonly heightDots: number; }

function measure(node: ResolvedNode, fontMetrics: FontMetrics): Size {
  if (node.type === 'text') {
    const m = fontMetrics.measure(node.value, node.style ?? {});
    return { widthDots: m.widthDots, heightDots: m.heightDots };
  }
  if (node.type === 'container') {
    const sizes = node.children.map((child) => measure(child, fontMetrics));
    const gap = node.style?.gap ?? 0;
    if (node.style?.direction === 'row') {
      return {
        widthDots: sizes.reduce((sum, s) => sum + s.widthDots, 0) + gap * Math.max(0, sizes.length - 1),
        heightDots: Math.max(0, ...sizes.map((s) => s.heightDots)),
      };
    }
    return {
      widthDots: Math.max(0, ...sizes.map((s) => s.widthDots)),
      heightDots: sizes.reduce((sum, s) => sum + s.heightDots, 0) + gap * Math.max(0, sizes.length - 1),
    };
  }
  return { widthDots: 0, heightDots: 0 };
}

// A LineNode carries no intrinsic length (only `thickness`) — its length comes from
// `style.width`: `fixed(n)` draws exactly n dots, anything else (`fill`/`auto`/unset)
// draws across whatever width is available at that point in the tree.
function resolveLineLengthDots(node: Extract<ResolvedNode, { type: 'line' }>, availableWidthDots: number): number {
  const width = node.style?.width;
  return width?.type === 'fixed' ? width.value : availableWidthDots;
}

function arrange(node: ResolvedNode, origin: Position, availableWidthDots: number, fontMetrics: FontMetrics, out: PrintElement[]): void {
  if (node.type === 'text') {
    out.push({ type: 'text', content: node.value, options: { x: origin.x, y: origin.y, size: node.style?.fontSize, align: node.style?.textAlign, bold: node.style?.fontWeight === 'bold' } });
    return;
  }
  if (node.type === 'line') {
    const length = resolveLineLengthDots(node, availableWidthDots);
    out.push({ type: 'line', options: { x1: origin.x, y1: origin.y, x2: origin.x + length, y2: origin.y, thickness: node.thickness } });
    return;
  }
  if (node.type === 'barcode') {
    out.push({ type: 'barcode', options: { x: origin.x, y: origin.y, symbology: node.symbology, content: node.value, readable: node.readable } });
    return;
  }
  if (node.type === 'qrcode') {
    out.push({ type: 'qrcode', options: { x: origin.x, y: origin.y, content: node.value, errorCorrection: node.errorCorrection } });
    return;
  }
  if (node.type === 'image') {
    out.push({ type: 'image', bitmap: node.bitmap, options: { x: origin.x, y: origin.y } });
    return;
  }

  const padding = node.style?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const gap = node.style?.gap ?? 0;
  const childAvailableWidthDots = availableWidthDots - padding.left - padding.right;
  let cursorX = origin.x + padding.left;
  let cursorY = origin.y + padding.top;

  for (const child of node.children) {
    arrange(child, { x: cursorX, y: cursorY }, childAvailableWidthDots, fontMetrics, out);
    const size = measure(child, fontMetrics);
    if (node.style?.direction === 'row') cursorX += size.widthDots + gap;
    else cursorY += size.heightDots + gap;
  }
}

export class LayoutEngine {
  // `config`/`typography` are unused until Task 14 wires in the multi-scale sizing search.
  resolve(root: ResolvedNode, _config: LayoutConfig, _typography: TypographyProfile, fontMetrics: FontMetrics): PrintElement[] {
    const elements: PrintElement[] = [];
    arrange(root, { x: 0, y: 0 }, _config.widthDots, fontMetrics, elements);
    return elements;
  }
}

export function createLayoutEngine(): LayoutEngine { return new LayoutEngine(); }
```

`measure()` treats every node's width/height as intrinsic (sized to its
own content) — `Dimension.fixed`/`fill` on a `ContainerNode`/leaf's own
`style.width`/`style.height` are accepted by the type system but not yet
honored by `measure()`/`arrange()` beyond the `LineNode` case above. Full
`fixed`/`fill` distribution (e.g. two `fill` columns splitting remaining
row width evenly) is a follow-up, not built by this plan.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/layout/LayoutEngine.ts packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts
git commit -m "feat: add LayoutEngine arrangement and ResolvedNode-to-PrintElement mapping"
```

---

### Task 14: LayoutEngine — global font-scale sizing algorithm

**Files:**
- Modify: `packages/printer-core/src/layout/LayoutEngine.ts`
- Test: `packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts`

**Interfaces:**
- Consumes: everything from Task 13 in the same file.
- Produces: `LayoutEngine.resolve()` now uses `config`/`typography` to pick a font scale for labels; behavior for receipts and Task 13's arrangement tests is unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts
import { createLayoutEngine } from '../LayoutEngine';
import { ApproximateFontMetrics } from '../ApproximateFontMetrics';
import type { ResolvedNode } from '../../resolution/ResolvedNode';
import type { LayoutConfig } from '../LayoutConfig';
import type { TypographyProfile } from '../TypographyProfile';

const engine = createLayoutEngine();
const fontMetrics = new ApproximateFontMetrics();

function tallColumn(lineCount: number, fontSize: number): ResolvedNode {
  return {
    type: 'container', id: 'root', style: { direction: 'column' },
    children: Array.from({ length: lineCount }, (_, i) => ({ type: 'text' as const, id: `t${i}`, value: `Line ${i}`, style: { fontSize } })),
  };
}

describe('LayoutEngine sizing', () => {
  it('receipt (no heightDots) always uses the largest scale level, never shrinks', () => {
    const receiptConfig: LayoutConfig = { widthDots: 576, dpi: 203 };
    const typography: TypographyProfile = { fontScaleLevels: [{ id: 'large', fontScale: 1, lineHeightScale: 1 }, { id: 'small', fontScale: 0.5, lineHeightScale: 0.5 }] };
    const root = tallColumn(50, 40);
    const elements = engine.resolve(root, receiptConfig, typography, fontMetrics);
    const first = elements[0];
    if (first.type !== 'text') throw new Error('expected text element');
    expect(first.options?.size).toBe(40);
  });

  it('label picks the largest scale level that fits within heightDots', () => {
    const labelConfig: LayoutConfig = { widthDots: 400, heightDots: 100, dpi: 203 };
    const typography: TypographyProfile = {
      fontScaleLevels: [
        { id: 'large', fontScale: 1, lineHeightScale: 1 },
        { id: 'medium', fontScale: 0.5, lineHeightScale: 0.5 },
        { id: 'small', fontScale: 0.25, lineHeightScale: 0.25 },
      ],
    };
    const root = tallColumn(10, 20); // 10 lines at fontSize 20 overflows 100 dots at scale 1
    const elements = engine.resolve(root, labelConfig, typography, fontMetrics);
    const first = elements[0];
    if (first.type !== 'text') throw new Error('expected text element');
    expect(first.options?.size).toBeLessThan(20); // shrunk below the original fontSize
  });

  it('label falls back to the smallest scale level (best-effort, no throw) when nothing fits', () => {
    const labelConfig: LayoutConfig = { widthDots: 400, heightDots: 10, dpi: 203 };
    const typography: TypographyProfile = { fontScaleLevels: [{ id: 'large', fontScale: 1, lineHeightScale: 1 }, { id: 'small', fontScale: 0.1, lineHeightScale: 0.1 }] };
    const root = tallColumn(100, 40);
    expect(() => engine.resolve(root, labelConfig, typography, fontMetrics)).not.toThrow();
    const elements = engine.resolve(root, labelConfig, typography, fontMetrics);
    const first = elements[0];
    if (first.type !== 'text') throw new Error('expected text element');
    expect(first.options?.size).toBeCloseTo(4); // 40 * 0.1
  });

  it('scales the whole tree uniformly, not just the section that grew', () => {
    const labelConfig: LayoutConfig = { widthDots: 400, heightDots: 50, dpi: 203 };
    const typography: TypographyProfile = { fontScaleLevels: [{ id: 'large', fontScale: 1, lineHeightScale: 1 }, { id: 'small', fontScale: 0.5, lineHeightScale: 0.5 }] };
    const root: ResolvedNode = {
      type: 'container', id: 'root', style: { direction: 'column' },
      children: [
        { type: 'text', id: 'header', value: 'HEADER', style: { fontSize: 20 } },
        ...Array.from({ length: 10 }, (_, i) => ({ type: 'text' as const, id: `item${i}`, value: `Item ${i}`, style: { fontSize: 20 } })),
      ],
    };
    const elements = engine.resolve(root, labelConfig, typography, fontMetrics);
    const header = elements[0];
    const item = elements[1];
    if (header.type !== 'text' || item.type !== 'text') throw new Error('expected text elements');
    expect(header.options?.size).toBe(item.options?.size); // same scale applied to both
    expect(header.options?.size).toBeLessThan(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts`
Expected: FAIL — every text element's `options.size` equals the original unscaled `fontSize` (no scale search yet).

- [ ] **Step 3: Write the implementation**

Replace `LayoutEngine.resolve()`'s body and add a scale-application helper:

```ts
// packages/printer-core/src/layout/LayoutEngine.ts — add above `export class LayoutEngine`
import type { FontScaleLevel } from './TypographyProfile';
import type { TextStyle } from '../template/style/TextStyle';

function scaleTree(node: ResolvedNode, level: FontScaleLevel): ResolvedNode {
  if (node.type === 'text') {
    const style: TextStyle | undefined = node.style && {
      ...node.style,
      fontSize: node.style.fontSize !== undefined ? node.style.fontSize * level.fontScale : undefined,
      lineHeight: node.style.lineHeight !== undefined ? node.style.lineHeight * level.lineHeightScale : undefined,
    };
    return { ...node, style };
  }
  if (node.type === 'container') return { ...node, children: node.children.map((child) => scaleTree(child, level)) };
  return node;
}

function totalHeight(node: ResolvedNode, fontMetrics: FontMetrics): number {
  return measure(node, fontMetrics).heightDots;
}
```

```ts
// packages/printer-core/src/layout/LayoutEngine.ts — replace the class body
export class LayoutEngine {
  resolve(root: ResolvedNode, config: LayoutConfig, typography: TypographyProfile, fontMetrics: FontMetrics): PrintElement[] {
    const levels = typography.fontScaleLevels;

    if (config.heightDots === undefined) {
      const scaled = scaleTree(root, levels[0]);
      const elements: PrintElement[] = [];
      arrange(scaled, { x: 0, y: 0 }, config.widthDots, fontMetrics, elements);
      return elements;
    }

    let chosen = levels[levels.length - 1];
    for (const level of levels) {
      const scaled = scaleTree(root, level);
      if (totalHeight(scaled, fontMetrics) <= config.heightDots) { chosen = level; break; }
    }

    const scaled = scaleTree(root, chosen);
    const elements: PrintElement[] = [];
    arrange(scaled, { x: 0, y: 0 }, config.widthDots, fontMetrics, elements);
    return elements;
  }
}

export function createLayoutEngine(): LayoutEngine { return new LayoutEngine(); }
```

Note: `config`/`typography` lose the `_` prefix here since they're now
genuinely read — this matches Task 13's inline comment marking them
unused only "until Task 14 wires them in".

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts packages/printer-core/src/layout/__tests__/LayoutEngine.test.ts`
Expected: PASS (all — Task 13's tests use a single-level `fontScaleLevels`, so scale 1 applies and their assertions are unaffected)

- [ ] **Step 5: Commit**

```bash
git add packages/printer-core/src/layout/LayoutEngine.ts packages/printer-core/src/layout/__tests__/LayoutEngine.sizing.test.ts
git commit -m "feat: add global font-scale sizing algorithm to LayoutEngine"
```

---

### Task 15: layout/ barrel, resolution/ barrel

**Files:**
- Create: `packages/printer-core/src/layout/index.ts`
- Create: `packages/printer-core/src/resolution/index.ts`

**Interfaces:**
- Consumes: everything created under `layout/` (Tasks 1, 12-14) and `resolution/` (Tasks 9-11).
- Produces: the two barrels Task 16 wires into the package root `index.ts`.

- [ ] **Step 1: Write the files**

```ts
// packages/printer-core/src/layout/index.ts
export * from './LayoutConfig';
export * from './TextMeasurement';
export * from './FontMetrics';
export * from './ApproximateFontMetrics';
export * from './TypographyProfile';
export * from './LayoutEngine';
```

```ts
// packages/printer-core/src/resolution/index.ts
export * from './PrintData';
export * from './ResolvedNode';
export * from './ResolvedPage';
export * from './DocumentResolver';
```

- [ ] **Step 2: Type-check to verify no export collisions**

Run: `npm run type-check -w printer-core`
Expected: PASS (these two barrels aren't imported by `src/index.ts` yet — Task 16 does that — so this only checks the barrels themselves compile).

- [ ] **Step 3: Commit**

```bash
git add packages/printer-core/src/layout/index.ts packages/printer-core/src/resolution/index.ts
git commit -m "feat: add layout/ and resolution/ barrel exports"
```

---

### Task 16: Cutover — delete templates/+binding/, wire new exports, end-to-end test

**Files:**
- Delete: `packages/printer-core/src/templates/` (entire folder)
- Delete: `packages/printer-core/src/binding/` (entire folder)
- Modify: `packages/printer-core/src/index.ts`
- Test: `packages/printer-core/src/__tests__/layout-engine-integration.test.ts`

**Interfaces:**
- Consumes: `template/`, `resolution/`, `layout/` barrels (Task 8, 15); `compileTo` (`../core`), `PrinterProfile` (`../profile`) — both existing and untouched.
- Produces: the final, fully-wired `packages/printer-core/src/index.ts`.

- [ ] **Step 1: Delete the old modules**

```bash
rm -rf packages/printer-core/src/templates
rm -rf packages/printer-core/src/binding
```

- [ ] **Step 2: Update the package root barrel**

Read `packages/printer-core/src/index.ts`, remove the two lines
`export * from './templates';` and `export * from './binding';`, and add:

```ts
export * from './template';
export * from './resolution';
export * from './layout';
```

- [ ] **Step 3: Write the end-to-end integration test**

```ts
// packages/printer-core/src/__tests__/layout-engine-integration.test.ts
import { labelTemplate, column, row, text, line, barcode, repeat } from '../template';
import { createDocumentResolver } from '../resolution';
import { createLayoutEngine, ApproximateFontMetrics } from '../layout';
import type { TypographyProfile } from '../layout';
import { EscPosCompiler } from '../compiler/escpos/EscPosCompiler';

describe('layout engine end-to-end', () => {
  it('builds a label via the DSL, resolves real data, lays it out, and compiles to ESC/POS bytes', () => {
    const template = labelTemplate()
      .size({ widthDots: 400, heightDots: 240, dpi: 203 })
      .root(
        column()
          .gap(4)
          .children(
            text.binding('product.name').fontSize(24).bold(),
            row().children(text.binding('product.price')),
            line(),
            repeat('toppings').template(row().children(text.literal('- '), text.binding('name'))),
            barcode.binding('order.code').symbology('code128'),
          ),
      )
      .build();

    const data = {
      product: { name: 'Milk Tea', price: '45,000' },
      toppings: [{ name: 'Pearl' }, { name: 'Cheese Foam' }],
      order: { code: 'ORD123' },
    };

    const resolver = createDocumentResolver();
    const pages = resolver.resolve(template, data);
    expect(pages).toHaveLength(1);
    expect(pages[0].status).toBe('ok');
    if (pages[0].status !== 'ok') return;

    const layoutEngine = createLayoutEngine();
    const fontMetrics = new ApproximateFontMetrics();
    const typography: TypographyProfile = { fontScaleLevels: [{ id: 'default', fontScale: 1, lineHeightScale: 1 }] };
    const elements = layoutEngine.resolve(pages[0].node, template.config, typography, fontMetrics);

    expect(elements.some((e) => e.type === 'text' && e.content === 'Milk Tea')).toBe(true);
    expect(elements.some((e) => e.type === 'barcode')).toBe(true);

    const bytes = new EscPosCompiler().compile({ ...template.config, gapDots: 0, speed: 4, density: 8, direction: 'forward', copies: 1, elements });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('templates/ and binding/ no longer exist as importable modules', () => {
    expect(() => require('../templates')).toThrow();
    expect(() => require('../binding')).toThrow();
  });
});
```

- [ ] **Step 4: Run the full printer-core test suite and type-check**

Run: `npx jest packages/printer-core && npm run type-check -w printer-core`
Expected: All test suites PASS (the deleted `templates/`/`binding/` test files are gone along with their folders — no dangling references), `tsc --noEmit` clean.

- [ ] **Step 5: Run lint across the new modules**

Run: `npx eslint packages/printer-core/src/template packages/printer-core/src/resolution packages/printer-core/src/layout packages/printer-core/src/index.ts`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add -A packages/printer-core/src
git commit -m "feat: cut over to the tree-based layout engine, remove templates/ and binding/"
```

---

## Final Verification

After Task 16, run the full package suite one more time to confirm nothing outside this plan's scope regressed:

```bash
npm run type-check -w printer-core
npx jest packages/printer-core
```

Both must be clean before considering this plan done.
