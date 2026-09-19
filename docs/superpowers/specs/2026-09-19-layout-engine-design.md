# Layout Engine — Spec thiết kế

## Mục tiêu

Thay thế hoàn toàn 2 module `templates/` và `binding/` trong
`packages/printer-core` bằng 1 mô hình template dạng cây, hỗ trợ auto-layout
thật: container có padding/margin/gap/alignment, text tự wrap dòng, và
section lặp cho danh sách độ dài thay đổi (topping, dòng hoá đơn), có thể
tự phân trang sang nhiều tem khi danh sách dài hơn 1 tem chứa được.
`LabelTemplate`/`ReceiptTemplate` dạng phẳng cũ (`{ config, elements:
PrintElement[] }`) và `bindElements()` (thay `{{placeholder}}`) bị **xoá
hẳn — không migrate, không giữ lại gì**. Chưa có nơi nào ngoài package này
dùng tới (đã verify: không có reference nào trong `NDTCore.App/src`), nên
không có gì bị vỡ khi xoá.

## Ngoài phạm vi

- Lưu trữ template, clone thành bản ghi user tự sửa, hay bất kỳ UI nào —
  đúng ranh giới module `templates/` cũ đã có. Spec này chỉ xây pipeline
  cây → layout → element trong bộ nhớ.
- Đổi `PrintElement`, `PrintCompiler`, `ResolvedPrintDocument`, hay bất kỳ
  compiler nào trong 9 ngôn ngữ. Xem mục **Tính tương thích** — đây là thiết
  kế đắp thêm (additive).
- Đo lường font thật theo từng máy in. `FontMetrics` chỉ là 1 contract;
  implementation có sẵn là ước lượng xấp xỉ, ghi rõ trong tài liệu (xem mục
  **FontMetrics**).
- **`RepeatNode` lồng trong `RepeatNode` khác, cả 2 đều cần phân trang
  riêng.** Thuật toán phân trang đồng bộ (xem mục **Phân trang**) giả định
  các `RepeatNode` cần phân trang nằm phẳng trong 1 cây — mỗi item cha của
  1 `RepeatNode` lồng có thể cần số trang khác nhau, phá vỡ tính "đồng bộ".
  Không có template thực tế nào ở F&B (label/hoá đơn) cần lồng sâu vậy.
- **Phân trang theo overflow đo lường thật.** Đã cân nhắc và loại bỏ:
  phân trang **chỉ** dựa vào `RepeatNode.maxItemsPerPage` (cấu hình cố
  định, tính trước), **không** dựa vào việc `LayoutEngine` đo lường rồi
  phát hiện tràn mới quyết định tách trang. Xem mục **Phân trang** để biết
  lý do.
- **Type-state builder** (dùng generic để TypeScript chặn `.build()` lúc
  compile nếu thiếu `.size()`/`.root()`). Cân nhắc nhưng không áp dụng ở
  v1 — runtime validate (throw rõ ràng lúc `build()`) đơn giản, đủ dùng, và
  tránh over-engineering ở tầng builder.

## Kiến trúc

```
PrintTemplate (cây TemplateNode — tĩnh, chưa có data, chưa có toạ độ)
        │
        ▼  DocumentResolver.resolve(template, data)
readonly ResolvedPage[] (mỗi phần tử = 1 tem/trang, đã bind giá trị, đã
                          cắt lát repeat theo trang, đã lọc node ẩn —
                          từng trang có thể ok hoặc lỗi độc lập)
        │
        ▼  với mỗi trang 'ok': LayoutEngine.resolve(page.node, config, typography, fontMetrics)
PrintElement[]  ◄── type đã có sẵn, không đổi (18 loại) — 1 mảng cho MỖI trang
        │
        ▼  (không đổi — LabelBuilder/ReceiptBuilder, ResolvedPrintDocument, compile())
```

3 khái niệm, 3 tên riêng, 1 chiều duy nhất — không node nào bị dùng lại cho
2 giai đoạn khác nhau:

| Giai đoạn | Họ type | Có data? | Có toạ độ? | Phạm vi |
| --- | --- | --- | --- | --- |
| Template | `TemplateNode` | không | không | 1 template |
| Resolved | `ResolvedPage[]` (bọc `ResolvedNode`) | có | không | N trang |
| Kết quả layout | `PrintElement[]` (đã có sẵn) | có | có | 1 mảng / trang |

## Tính tương thích (vì sao đây là additive, không phải viết lại)

`LayoutEngine` là 1 bước mới chèn **trước** mọi thứ đã có sẵn. Không có gì
ở tầng dưới bị đổi:

- **`PrintElement`** (18 loại: `text`/`image`/`barcode`/`qrcode`/`raw`/
  `box`/`line`/`diagonal`/`circle`/`ellipse`/`reverse`/`erase`/`pageBreak`/
  `spacer`/`row`/`column`/`cut`/`table`) — giữ nguyên. `LayoutEngine` chỉ
  *sinh ra* `PrintElement[]`; không tạo ra hình dạng element mới nào bắt
  compiler phải học thêm. `ContainerNode`/`RepeatNode` chỉ là khái niệm của
  tầng template — bị "tiêu thụ" trong lúc resolve/layout, không bao giờ
  xuất hiện trong mảng output.
- **`PrintCompiler<TOutput>.compile(document, encoding?: TextEncodingOptions)`**
  — không đổi. Pipeline của spec này dừng lại ở `PrintElement[]` (1 mảng
  cho mỗi trang), sau đó mỗi mảng chảy vào `ResolvedPrintDocument` y hệt
  hiện tại — 1 lệnh `compile()` cho mỗi trang, độc lập với nhau.
- **Không trùng tên.** `document/PrintDocument.ts`
  (`{ width, height?, ...PrintDocumentOptions }`) và
  `document/ResolvedPrintDocument.ts` giữ nguyên ý nghĩa hiện tại. Các type
  mới của spec này dùng tên khác hẳn (`PrintTemplate`, `ResolvedNode`,
  `ResolvedPage`, `LayoutConfig`) không đè lên bất kỳ export nào đã có của
  `packages/printer-core`.

## Cấu trúc thư mục

```
src/
├── template/
│   ├── PrintTemplate.ts
│   ├── PrintTemplateType.ts
│   │
│   ├── nodes/
│   │   ├── TemplateNode.ts
│   │   ├── ContainerNode.ts
│   │   ├── TextNode.ts
│   │   ├── LineNode.ts
│   │   ├── BarcodeNode.ts
│   │   ├── QrCodeNode.ts
│   │   ├── ImageNode.ts
│   │   └── RepeatNode.ts
│   │
│   ├── style/
│   │   ├── Dimension.ts
│   │   ├── Insets.ts
│   │   ├── BoxStyle.ts
│   │   ├── LayoutStyle.ts
│   │   ├── TextStyle.ts
│   │   └── VisibilityCondition.ts
│   │
│   ├── builders/
│   │   ├── NodeBuilder.ts          (internal, không export)
│   │   ├── BuildContext.ts         (internal, không export)
│   │   ├── LabelTemplateBuilder.ts
│   │   ├── ReceiptTemplateBuilder.ts
│   │   ├── ContainerBuilder.ts
│   │   ├── TextBuilder.ts
│   │   ├── LineBuilder.ts
│   │   ├── BarcodeBuilder.ts
│   │   ├── QrCodeBuilder.ts
│   │   ├── ImageBuilder.ts
│   │   ├── RepeatBuilder.ts
│   │   ├── dimensions.ts
│   │   ├── conditions.ts
│   │   └── index.ts
│   │
│   └── index.ts
│
├── resolution/
│   ├── PrintData.ts
│   ├── ResolvedNode.ts
│   ├── ResolvedPage.ts
│   ├── DocumentResolver.ts
│   └── index.ts
│
└── layout/
    ├── LayoutEngine.ts
    ├── LayoutConfig.ts
    ├── TypographyProfile.ts
    ├── FontMetrics.ts
    ├── ApproximateFontMetrics.ts
    ├── TextMeasurement.ts
    └── index.ts
```

Không tạo `builders/core`, `builders/base`, `builders/factory`,... trừ khi
lúc viết code thật phát sinh trùng lặp rõ ràng cần tách thêm. Thay thế
`template/` và `binding/` (đã xoá) làm thư mục con ngang hàng trong
`packages/printer-core/src/`, export từ `index.ts` gốc của package giống
mọi module khác.

## Style/geometry dùng chung

Tách 3 tầng rõ ràng, vì không phải property nào cũng hợp lệ cho mọi loại
node:

```ts
export type Dimension = { type: 'fixed'; value: number } | { type: 'fill' } | { type: 'auto' };

export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Property hình học áp dụng được cho MỌI node — kể cả node lá (không có children). */
export interface BoxStyle {
  readonly width?: Dimension;
  readonly height?: Dimension;
  readonly margin?: Insets;
  readonly padding?: Insets;
}

/**
 * Property chỉ có nghĩa cho node CÓ children — `direction`/`gap`/
 * `justifyContent`/`alignItems` đều mô tả cách sắp xếp CON bên trong 1
 * container. Gắn các field này vào node lá (`TextNode`, `LineNode`,...)
 * sẽ compile được nhưng vô nghĩa lúc dùng — do đó `LayoutStyle` chỉ xuất
 * hiện trên `ContainerNode`, không phải base style dùng chung.
 */
export interface LayoutStyle extends BoxStyle {
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

Mọi node lá (`TextNode`, `LineNode`, `BarcodeNode`, `QrCodeNode`,
`ImageNode`) dùng `BoxStyle` (`TextNode` thêm `TextStyle`) — không bao giờ
dùng `LayoutStyle` đầy đủ. Chỉ `ContainerNode` dùng `LayoutStyle`.

`VisibilityCondition` là union đóng, có kiểu rõ ràng — cố tình không dùng
biểu thức string tự do (`visibleIf: string`), vì như vậy sẽ biến template
thành 1 ngôn ngữ scripting con. `AndCondition`/`OrCondition`/
`NotEqualsCondition` là hướng mở rộng tự nhiên sau này; spec này chỉ cần
`exists`/`equals` (không có template nào lúc thiết kế cần nhiều hơn).

Mọi giá trị dimension/inset/gap tính bằng **dots**, khớp với mọi giá trị
hình học khác trong package (`widthDots`, `x`/`y` trong `TextOptions`,...).
Nơi gọi làm việc theo mm/inch tự convert trước khi dựng `PrintTemplate`,
giống hệt cách gọi `LabelBuilder` hiện tại.

## Tầng Template — model

### `PrintTemplate` — phân biệt rõ Label và Receipt

Theo đúng quy ước const-object + derived type đã dùng xuyên suốt codebase
(`PrintType`, `PrinterDriverType`, `CutterMode`,...), và đúng pattern
discriminated union thật (`PrintTemplate` là union thật, không phải type
`extends` từ 1 base cùng tên):

```ts
export const PrintTemplateType = {
  Label: 'label',
  Receipt: 'receipt',
} as const;
export type PrintTemplateType = (typeof PrintTemplateType)[keyof typeof PrintTemplateType];

export interface BasePrintTemplate {
  readonly id: string;
  readonly version: number;
  readonly type: PrintTemplateType;
  readonly root: TemplateNode;
}

/** Label khổ cố định — `heightDots` bắt buộc. */
export interface LabelTemplate extends BasePrintTemplate {
  readonly type: typeof PrintTemplateType.Label;
  readonly config: LayoutConfig;
}

/** Hoá đơn giấy cuộn liên tục — không có `heightDots` (không có khổ cố định). */
export interface ReceiptTemplate extends BasePrintTemplate {
  readonly type: typeof PrintTemplateType.Receipt;
  readonly config: Omit<LayoutConfig, 'heightDots'>;
}

export type PrintTemplate = LabelTemplate | ReceiptTemplate;
```

`config` trên `LabelTemplate` dùng `LayoutConfig` với `heightDots` bắt
buộc (khổ label cố định, biết trước); `ReceiptTemplate` bỏ hẳn field này
(giấy cuộn không có khổ cao cố định) — cùng nguyên tắc `ReceiptBuilder`
hiện tại đã áp dụng (`Omit<PrintDocument, 'height'>`). Nhờ tách theo `type`,
`LayoutEngine` biết chắc lúc nào cần chạy thuật toán scale-để-vừa-khổ
(Label) và lúc nào không cần scale gì cả (Receipt) — không phải suy đoán
từ việc `heightDots` có giá trị hay `undefined` nữa.

### Node — base dùng chung

```ts
export interface TemplateNodeBase {
  readonly id: string;
  readonly visibleWhen?: VisibilityCondition;
}
```

Không đưa `style` vào base — mỗi node cần đúng 1 loại style riêng
(`ContainerNode` → `LayoutStyle`, `TextNode` → `BoxStyle & TextStyle`, các
node lá khác → `BoxStyle`), khai chung ở base chỉ tạo ra 1 union mơ hồ mà
không interface con nào thật sự dùng nguyên union đó. Cũng không đưa
`binding` vào base — không phải node nào cũng có data (ví dụ
`ContainerNode` không bao giờ có `binding`).

### `TemplateNode`

```ts
export type TemplateNode =
  | ContainerNode
  | TextNode
  | LineNode
  | BarcodeNode
  | QrCodeNode
  | ImageNode
  | RepeatNode;

export interface ContainerNode extends TemplateNodeBase {
  readonly type: 'container';
  readonly style?: LayoutStyle;
  readonly children: readonly TemplateNode[];
}

/** Bắt buộc có ít nhất 1 trong `text`/`binding` — kiểm tra ở `DocumentResolver` (cho object literal viết tay) và enforce sẵn ở `TextBuilder` (xem mục Builder) — không ép bằng type system (union 2 nhánh "bắt buộc 1 trong 2" đọc rối hơn chi phí validate). */
export interface TextNode extends TemplateNodeBase {
  readonly type: 'text';
  readonly text?: string; // literal, nội dung cố định
  readonly binding?: string; // dotted-path key vào PrintData
  readonly style?: BoxStyle & TextStyle;
}

export interface LineNode extends TemplateNodeBase {
  readonly type: 'line';
  readonly thickness?: number;
  readonly style?: BoxStyle;
}

/** Cùng cấu trúc literal-hoặc-binding như `TextNode`; `content` là nội dung mã vạch. */
export interface BarcodeNode extends TemplateNodeBase {
  readonly type: 'barcode';
  readonly content?: string;
  readonly binding?: string;
  readonly symbology: BarcodeSymbology;
  readonly readable?: boolean;
  readonly style?: BoxStyle;
}

export interface QrCodeNode extends TemplateNodeBase {
  readonly type: 'qrcode';
  readonly content?: string;
  readonly binding?: string;
  readonly errorCorrection?: QrErrorCorrectionLevel;
  readonly style?: BoxStyle;
}

/** Pipeline này không có bước decode ảnh — `bitmap` phải là `Bitmap` đã decode sẵn, cùng điều kiện `ImageElement` đang yêu cầu. `binding` tra 1 giá trị `Bitmap` trong `PrintData` (ví dụ logo tải động theo từng lần in); `bitmap` dùng khi ảnh đã nhúng cứng vào template. */
export interface ImageNode extends TemplateNodeBase {
  readonly type: 'image';
  readonly bitmap?: Bitmap;
  readonly binding?: string;
  readonly style?: BoxStyle;
}

/**
 * Repeat là node cấu trúc thuần tuý — không có style (xem giải thích bên
 * dưới), không phải field `repeat?: RepeatConfig` gắn trên mọi node.
 * Repeat đổi *số lượng* (1 template node → N resolved node) — khác bản
 * chất với style/visibility (không bao giờ đổi số lượng node tồn tại).
 * Tách riêng giữ `TemplateNode` là discriminated union sạch: không node
 * nào "thỉnh thoảng nhân bản".
 *
 * `maxItemsPerPage` — số item tối đa hiển thị trên 1 trang, áp dụng
 * **giống nhau cho mọi trang** (trang đầu và trang tiếp theo dùng chung 1
 * con số, không tách riêng như một số phần mềm thương mại). `undefined` =
 * không phân trang, toàn bộ item luôn nằm trên 1 trang duy nhất (dùng
 * chiến lược co font toàn cục nếu tràn — xem mục **Thuật toán sizing**).
 */
export interface RepeatNode {
  readonly type: 'repeat';
  readonly id: string;
  readonly binding: string; // key trỏ tới 1 mảng trong PrintData
  readonly template: TemplateNode;
  readonly maxItemsPerPage?: number;
  readonly visibleWhen?: VisibilityCondition;
}
```

**Vì sao `RepeatNode` không có `style`**: nếu cho phép `repeat("toppings").gap(2)`, ngữ nghĩa của `gap` mơ hồ — là khoảng cách giữa các item lặp, hay style của khối `Repeat` (mà `Repeat` không phải 1 physical box)? Thay vì cố định nghĩa mơ hồ này, style thuộc về `template` bên trong `RepeatNode`:

```
RepeatNode (không style)
└── template: ContainerNode { style: { direction: 'column', gap: 2 } }
    └── (nội dung 1 item)
```

Ngữ nghĩa rõ ràng: `gap` là của `ContainerNode` bọc mỗi item, không phải của bản thân việc lặp.

## Tầng Template — Builder (DSL)

Model ở trên là **contract** — Builder chỉ là 1 cách thuận tiện để tạo ra
đúng model đó, không phải 1 framework riêng. Class Builder cụ thể
(`NodeBuilder`, `ContainerBuilder`,...) là **implementation detail, không
export ra public API** — chỉ các factory function (`column()`, `text.binding()`,...) và type công khai (`TemplateNode`,...) mới export.

### `BuildContext` và sinh ID

Không bắt người viết template tự đặt ID tay (dễ trùng). 1 counter dùng
chung cho toàn cây, tạo tại `LabelTemplateBuilder`/`ReceiptTemplateBuilder`
(root), truyền xuống mọi builder con qua `BuildContext` — không để mỗi
Builder tự giữ counter riêng (dễ sinh `text-1`, `text-1`, `text-1` trùng
nhau giữa các nhánh khác nhau của cây):

```ts
// internal — không export
class TemplateNodeIdGenerator {
  private sequence = 0;
  next(type: string): string {
    this.sequence += 1;
    return `${type}-${this.sequence}`;
  }
}

// internal — không export
interface BuildContext {
  readonly idGenerator: TemplateNodeIdGenerator;
}
```

### `NodeBuilder<TNode>` — base nội bộ

```ts
// internal — không export
abstract class NodeBuilder<TNode extends TemplateNode> {
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

### `ContainerBuilder`

```ts
// internal — không export
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
      style: { ...this.boxStyle, direction: this.direction, gap: this.gapValue, justifyContent: this.justify, alignItems: this.align },
      children: this.childBuilders.map((child) => child.build(context)),
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

export function column(): ContainerBuilder { return new ContainerBuilder('column'); }
export function row(): ContainerBuilder { return new ContainerBuilder('row'); }
```

### `TextBuilder`

Factory tách riêng `literal`/`binding` ngay từ constructor, thay vì 2
method rời (`.text(...)`/`.binding(...)`) dễ gọi cả 2 tạo state không hợp
lệ:

```ts
// internal — không export
class TextBuilder extends NodeBuilder<TextNode> {
  private readonly content: { kind: 'literal'; value: string } | { kind: 'binding'; path: string };
  private textStyle: TextStyle = {};

  constructor(content: { kind: 'literal'; value: string } | { kind: 'binding'; path: string }) {
    super();
    this.content = content;
  }

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
```

`LineBuilder`/`BarcodeBuilder`/`QrCodeBuilder`/`ImageBuilder` theo đúng
khuôn này — factory `literal()`/`binding()` (riêng `image` dùng
`bitmap()`/`binding()`, vì "literal" của ảnh là 1 `Bitmap`, không phải
chuỗi), method riêng cho property đặc thù (`barcode.symbology()`/
`.readable()`, `qrcode.errorCorrection()`), method chung (`.width()`/
`.margin()`/...) kế thừa từ `NodeBuilder`.

### `RepeatBuilder`

```ts
// internal — không export
class RepeatBuilder extends NodeBuilder<RepeatNode> {
  private readonly bindingPath: string;
  private templateBuilder?: NodeBuilder<TemplateNode>;
  private perPage?: number;

  constructor(binding: string) { super(); this.bindingPath = binding; }

  template(node: NodeBuilder<TemplateNode>): this { this.templateBuilder = node; return this; }
  maxItemsPerPage(value: number): this { this.perPage = value; return this; }

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
```

`RepeatBuilder` cố tình **không** kế thừa method style của `NodeBuilder`
(`.width()`/`.margin()`/...) — đúng lý do "không có style" đã giải thích ở
mục model.

### Dimension / Visibility — hàm dựng giá trị

```ts
export function fixed(value: number): Dimension { return { type: 'fixed', value }; }
export function fill(): Dimension { return { type: 'fill' }; }
export function auto(): Dimension { return { type: 'auto' }; }

export function exists(binding: string): VisibilityCondition { return { type: 'exists', binding }; }
export function equals(binding: string, value: unknown): VisibilityCondition { return { type: 'equals', binding, value }; }
```

### Root builder — `labelTemplate()` / `receiptTemplate()`

```ts
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

// ReceiptTemplateBuilder / receiptTemplate() cùng khuôn, .size(): Omit<LayoutConfig, 'heightDots'>, type: PrintTemplateType.Receipt
```

### Ranh giới validate

```
LabelTemplateBuilder/ContainerBuilder/...  → validate CẤU TRÚC (size tồn tại, root tồn tại, repeat có template, dimension >= 0,...)
        │
        ▼
PrintTemplate
        │
        ▼
DocumentResolver                            → validate DỮ LIỆU (binding tồn tại trong PrintData không, mảng hay không,...)
        │
        ▼
LayoutEngine                                → không validate, không throw — luôn best-effort (xem mục Thuật toán sizing)
        │
        ▼
Compiler + PrintValidation.validate()       → validate CÚ PHÁP giao thức đích (đã có sẵn, không đổi)
```

Builder **không** validate dữ liệu — `text.binding('product.name')` không
kiểm tra `product.name` có tồn tại trong `PrintData` hay không, đó là việc
của `DocumentResolver` lúc có data thật.

### API surface

```ts
// root
labelTemplate()
receiptTemplate()

// container
column()
row()

// content
text.literal() / text.binding()
line()
barcode.literal() / barcode.binding()
qrcode.literal() / qrcode.binding()
image.bitmap() / image.binding()
repeat(binding)

// dimension
fixed(value) / fill() / auto()

// visibility
exists(binding) / equals(binding, value)
```

Method chung trên mọi node builder: `.id()` `.width()` `.height()`
`.margin()` `.padding()` `.visibleWhen()`. Method riêng theo loại node:
`.gap()` `.justifyContent()` `.alignItems()` `.children()` (container) —
`.fontSize()` `.bold()` `.align()` `.lineHeight()` (text) —
`.symbology()` `.readable()` (barcode) — `.errorCorrection()` (qrcode) —
`.template()` `.maxItemsPerPage()` (repeat) — `.size()` `.root()` `.build()`
(root).

### Ví dụ đầy đủ — Label

```ts
const productLabel = labelTemplate()
  .size({ widthDots: 400, heightDots: 240, dpi: 203 })
  .root(
    column()
      .padding({ top: 8, right: 8, bottom: 8, left: 8 })
      .gap(4)
      .children(
        text.binding('product.name').fontSize(24).bold(),
        row()
          .justifyContent('space-between')
          .children(
            text.binding('product.size'),
            text.binding('product.price').align('right'),
          ),
        line(),
        repeat('toppings')
          .maxItemsPerPage(6)
          .template(
            row().gap(4).children(text.literal('•'), text.binding('name')),
          ),
        barcode.binding('order.code').symbology('code128').readable(true),
      ),
  )
  .build();
```

### Ví dụ đầy đủ — Receipt

```ts
const receipt = receiptTemplate()
  .size({ widthDots: 576, dpi: 203 })
  .root(
    column()
      .padding({ top: 16, right: 16, bottom: 16, left: 16 })
      .gap(8)
      .children(
        text.literal('MY SHOP').fontSize(32).bold().align('center'),
        line(),
        repeat('items').template(
          column()
            .gap(2)
            .children(
              row()
                .justifyContent('space-between')
                .children(text.binding('name'), text.binding('price')),
            ),
        ),
        line(),
        row()
          .justifyContent('space-between')
          .children(text.literal('TOTAL'), text.binding('total').bold()),
      ),
  )
  .build();
```

## Tầng Resolved

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

/** 1 trang thành công, hoặc 1 trang lỗi — lỗi ở 1 trang không ảnh hưởng các trang khác trong cùng lô (xem mục Phân trang). */
export type ResolvedPage =
  | { readonly status: 'ok'; readonly pageIndex: number; readonly node: ResolvedNode }
  | { readonly status: 'error'; readonly pageIndex: number; readonly nodeId: string; readonly message: string };

export interface DocumentResolver {
  resolve(template: PrintTemplate, data: PrintData): readonly ResolvedPage[];
}
```

`RepeatNode` không xuất hiện trong `ResolvedNode` — resolve xong nó bị thay
bằng các bản sao đã resolve của `template` (số lượng theo lát cắt của
trang hiện tại — xem mục **Phân trang**), bọc trong 1 `ResolvedContainer`
kế thừa `style` của `ContainerNode` bên trong `template` (không phải style
của `RepeatNode` — nó không có style, xem mục Builder).

### Hành vi resolver

- **Tra binding**: `binding: "product.name"` là dotted-path tra trong
  `data`. Bên trong 1 lần expand `RepeatNode`, item hiện tại được đẩy vào
  context stack làm scope trong cùng — key không tìm thấy sẽ tra trong item
  trước, không thấy mới rơi ra scope ngoài. Đây đúng quy tắc "scope trong
  cùng ưu tiên, không thấy thì rơi ra ngoài" mà Mustache section dùng, nhờ
  đó 1 dòng lặp vừa đọc được field của chính item (`name`, `price`) vừa đọc
  được field global bên ngoài (`storeName`) mà không cần 2 cơ chế khác
  nhau.
- **Visibility**: node có `visibleWhen` đánh giá false bị loại hẳn khỏi cây
  đã resolve (không phải resolve-xong-rồi-ẩn — nó không bao giờ tới
  `LayoutEngine`, không chiếm không gian layout nào).
- **Không format.** `DocumentResolver` chỉ tra key và convert
  `String(value)` — không format tiền tệ, ngày tháng, số. Format
  (`45000` → `"45,000 ₫"`) là trách nhiệm của nơi gọi, làm trước khi dựng
  `PrintData`. Nhờ vậy resolver giữ được là 1 bước tra cứu thuần tuý, không
  phụ thuộc gì thêm.
- **Thiếu binding key là lỗi — nhưng chỉ lỗi đúng 1 trang.** Nếu 1
  `binding` path resolve ra `undefined` khi resolve trang thứ `p`,
  `DocumentResolver` **không throw làm chết cả lô** — nó bắt lỗi ngay tại
  trang đó, trả về `{ status: 'error', pageIndex: p, nodeId, message }` cho
  đúng phần tử thứ `p` trong mảng kết quả, rồi tiếp tục resolve các trang
  còn lại bình thường. Lý do đổi từ "throw thẳng" (bản thiết kế trước) sang
  cách ly theo trang: 1 item lỗi trong danh sách topping (ví dụ item thứ 7
  thiếu `name`) chỉ nên làm hỏng đúng tem chứa item đó, không được kéo theo
  các tem khác trong cùng lô in — vẫn giữ nguyên tắc "phát hiện lỗi rõ
  ràng, không âm thầm bỏ qua" (đây là hệ thống POS), chỉ thu hẹp phạm vi ảnh
  hưởng của lỗi xuống đúng 1 trang.

### Phân trang

Khi 1 hoặc nhiều `RepeatNode` khai `maxItemsPerPage`, `DocumentResolver`
tính số trang cần thiết và cắt lát dữ liệu **đồng bộ** giữa mọi `RepeatNode`
đang phân trang. Đây là cơ chế **cấu hình cố định, tính trước — không đo
lường, không phụ thuộc overflow thật**: số trang chỉ phụ thuộc số lượng
item thật và `maxItemsPerPage` khai trong template, hoàn toàn độc lập với
`LayoutEngine`/`FontMetrics` (đã cân nhắc và loại phương án ngược lại —
đo lường rồi mới quyết định tách trang — xem mục **Ngoài phạm vi**).

1. Với mỗi `RepeatNode` có `maxItemsPerPage`, đếm số item thật
   (`data[binding].length`), tính `ceil(count / maxItemsPerPage)`.
2. `pageCount = max(1, giá trị lớn nhất trong các kết quả ở bước 1)`. Không
   có `RepeatNode` nào cần phân trang → `pageCount = 1` (hành vi cũ, không
   đổi).
3. Với mỗi trang `p` từ `0` đến `pageCount - 1`, resolve **toàn bộ cây 1
   lần cho trang đó**:
   - `RepeatNode` có `maxItemsPerPage` → chỉ lấy
     `items.slice(p * maxItemsPerPage, (p + 1) * maxItemsPerPage)`. Trang
     nào vượt quá số item thật (danh sách đã hết) → lát cắt rỗng, phần đó
     không hiện gì trên trang đó, không lỗi.
   - `RepeatNode` không có `maxItemsPerPage` → luôn lấy **toàn bộ** mảng,
     hiện giống hệt nhau trên mọi trang (coi như 1 phần cố định, cùng vai
     trò với header/footer).
   - Mọi node khác (`TextNode`, `ContainerNode`,...) resolve giống hệt
     nhau trên mọi trang.

Ví dụ: label có `RepeatNode` topping (`maxItemsPerPage: 5`, thực tế 12
item → `ceil(12/5) = 3` trang) và `RepeatNode` ghi chú dị ứng (không có
`maxItemsPerPage`, 3 item). Kết quả: 3 `ResolvedPage`, mỗi trang đều có đủ
3 dòng ghi chú dị ứng + header/footer giống hệt nhau; topping thì trang 1
hiện item 1-5, trang 2 hiện item 6-10, trang 3 hiện item 11-12.

## Tầng Layout

```ts
export interface LayoutConfig {
  readonly widthDots: number;
  readonly heightDots?: number; // undefined = liên tục (hoá đơn)
  readonly dpi: number;
}

export interface FontScaleLevel {
  readonly id: string;
  readonly fontScale: number; // nhân với mọi TextStyle.fontSize trong cây
  readonly lineHeightScale: number;
}

export interface TypographyProfile {
  readonly fontScaleLevels: readonly FontScaleLevel[]; // sắp lớn → nhỏ
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

/** Nhận đúng 1 trang (1 `ResolvedNode`) — không biết gì về phân trang, đó là việc của `DocumentResolver`. Chữ ký giữ nguyên dù thêm phân trang, vì phân trang xảy ra trước khi tới bước này. */
export interface LayoutEngine {
  resolve(root: ResolvedNode, config: LayoutConfig, typography: TypographyProfile, fontMetrics: FontMetrics): PrintElement[];
}
```

### FontMetrics

Độ rộng ký tự thật phụ thuộc vào font bitmap/vector nạp sẵn trong từng
model máy in cụ thể — `TextOptions.size` là hệ số phóng đại áp lên font có
sẵn của máy in, không phải point-size tuyệt đối, và cùng `size: 2` render
ra độ rộng pixel khác nhau giữa Epson và TSC. `packages/printer-core`
không có cách nào biết trước điều này cho 1 máy in chưa xác định, và vẫn
giữ tính chất 0 I/O, 0 dependency — không thể tự đo 1 font thật lúc layout.

Vì vậy `FontMetrics` là 1 contract, có sẵn đúng 1 implementation ghi rõ là
ước lượng:

```ts
export class ApproximateFontMetrics implements FontMetrics { /* ... */ }
```

tài liệu hoá rõ là ước lượng tốt nhất có thể (số dots-trên-ký-tự cố định,
nhân theo `fontSize`), đủ dùng để layout mà không cần dữ liệu calibrate
riêng từng máy in. Nơi gọi cần độ chính xác thật cho 1 model cụ thể tự cung
cấp `FontMetrics` riêng (ví dụ dựa trên bảng ký tự thật của máy, hay API đo
lường native) — `LayoutEngine` chỉ phụ thuộc vào interface.

### Wrap dòng

`FontMetrics.wrap()` cắt cứng giữa từ khi 1 từ đơn lẻ dài hơn cả
`maxWidthDots` (thay vì để dòng đó tràn ra ngoài container) — đúng hành vi
mặc định trình duyệt dùng cho `overflow-wrap: break-word`. Điểm này chưa
được xác nhận trực tiếp lúc thiết kế; xem lại nếu có template thực tế gặp
trường hợp này và cần hành vi khác (ví dụ thu nhỏ riêng dòng đó thay vì cắt
giữa từ).

### Thuật toán sizing — không bao giờ chặn in

`LayoutEngine.resolve()` không bao giờ throw vì lý do "nội dung không vừa".
1 lệnh in phải luôn ra được kết quả — từ chối in vì 1 trường hợp layout rìa
là hậu quả tệ hơn nhiều so với 1 label hơi cao quá khổ 1 chút. Đây là chiến
lược **bổ sung** cho phân trang (mục trên) — phân trang xử lý danh sách
dài bằng cách chia sang nhiều tem (theo cấu hình cố định, không đo lường);
sizing xử lý phần còn lại (nội dung trong 1 trang vẫn hơi dư một chút) bằng
cách co chữ, đo lường thật:

1. **Hoá đơn** (`config.heightDots` là `undefined`): luôn dùng
   `typography.fontScaleLevels[0]` (scale lớn nhất). Giấy cuộn liên tục
   không có trần để phải vừa, nên không có gì cần thu nhỏ.
2. **Label** (`config.heightDots` có giá trị): thử lần lượt từng
   `FontScaleLevel` trong `typography.fontScaleLevels`, từ lớn tới nhỏ. Với
   mỗi level, nhân mọi `TextStyle.fontSize`/`lineHeight` trong toàn cây đã
   resolve theo `fontScale`/`lineHeightScale` của level đó, layout **toàn
   bộ cây** (header, footer, section lặp — tất cả cùng lúc, đồng nhất,
   không riêng phần nào bị dài ra), rồi đo tổng chiều cao. Dùng level
   **đầu tiên** có tổng chiều cao vừa `config.heightDots`.
3. Nếu thử hết **mọi** level vẫn không vừa, **vẫn dùng level nhỏ nhất** và
   trả về `PrintElement[]` đã layout theo level đó — nội dung có thể tràn
   ra ngoài mép danh nghĩa của label, đây là vấn đề chất lượng in của người
   thiết kế template/`fontScaleLevels`/`maxItemsPerPage`, không phải thứ
   `LayoutEngine` từ chối thực hiện.

Scale là **toàn cục, không riêng từng section** — label có nhiều dòng
topping sẽ co cả header/footer theo cùng lúc với danh sách topping, giữ
toàn bộ label nhất quán về mặt hình ảnh ở bất kỳ scale nào nó dừng lại,
thay vì chỉ co riêng phần bị dài ra.

### Ánh xạ ResolvedNode → PrintElement

`ResolvedContainer` không bao giờ tự sinh ra 1 element — nó chỉ tồn tại để
tính `x`/`y` cho các con (theo `style.direction`/`gap`/`padding`/
`justifyContent`/`alignItems`) rồi bị bỏ đi. Mọi `ResolvedNode` khác sinh
ra đúng 1 `PrintElement`:

| `ResolvedNode` | → `PrintElement` |
| --- | --- |
| `ResolvedText` | `TextElement { content: value, options: { x, y, size, align, ... } }` |
| `ResolvedLine` | `LineElement { options: { x1, y1, x2, y2, thickness } }` |
| `ResolvedBarcode` | `BarcodeElement { options: { x, y, symbology, content: value, readable } }` |
| `ResolvedQrCode` | `QrCodeElement { options: { x, y, content: value, errorCorrection } }` |
| `ResolvedImage` | `ImageElement { bitmap, options: { x, y } }` |

`x`/`y` trên mọi element sinh ra đều do `LayoutEngine` tính, không bao giờ
do người viết template khai tay — đây chính là điểm khác biệt cốt lõi so
với `elements: PrintElement[]` phẳng đã xoá, nơi mọi `x`/`y` phải đặt tay
từng cái một.

## Cách dùng — build rồi in theo lô

Nơi gọi (app layer) tách 2 pha rõ ràng: build/compile **toàn bộ** các trang
trước, chỉ in khi đã có kết quả build của mọi trang — không xen kẽ
build-rồi-in-ngay-từng-trang. Trang nào build lỗi (theo cách ly ở mục
**Phân trang**) thì bị loại khỏi danh sách in, không chặn các trang khác:

```ts
const pages = documentResolver.resolve(labelTemplate, data);

// Pha 1: build + compile mọi trang OK, gom vào mảng — CHƯA in gì cả.
// Trang lỗi bị lọc ra riêng để báo/log, không lẫn vào danh sách in.
const outputs: (string | Uint8Array)[] = [];
const errors: Extract<(typeof pages)[number], { status: 'error' }>[] = [];

for (const page of pages) {
  if (page.status === 'error') {
    errors.push(page);
    continue;
  }
  const elements = layoutEngine.resolve(page.node, config, typography, fontMetrics);
  outputs.push(compileTo(language, { ...config, elements }, profile));
}

// Pha 2: in liên tiếp mọi trang đã build thành công.
for (const output of outputs) {
  await printerTransport.write(output);
}
```

Lợi ích: 1 trang lỗi không làm dừng việc build các trang còn lại (đã cách
ly ở tầng resolver), và việc build xong hết rồi mới in giúp biết trước
chính xác sẽ in bao nhiêu tem trước khi tem đầu tiên thực sự ra giấy (ví dụ
để hiện "Đang in tem 1/3" trên UI).

## Tóm tắt xử lý lỗi

| Trường hợp | Hành vi |
| --- | --- |
| `TextNode`/`BarcodeNode`/... thiếu cả `text`/`binding` lẫn `content`/`binding` | `DocumentResolver` trả `{ status: 'error' }` cho đúng trang đó (hoặc chặn sớm hơn ở `TextBuilder`/... nếu dựng qua Builder) — phát hiện lỗi khai template ngay, không âm thầm coi là rỗng. |
| `binding` path resolve ra `undefined` trong `PrintData` | `DocumentResolver` trả `{ status: 'error', pageIndex, nodeId, message }` cho đúng trang đó; **các trang khác không bị ảnh hưởng.** |
| `RepeatNode.binding` resolve ra giá trị không phải mảng | `DocumentResolver` trả `{ status: 'error' }` cho đúng trang đó. |
| Nội dung cao hơn `heightDots` kể cả ở `FontScaleLevel` nhỏ nhất | **Không lỗi.** `LayoutEngine` trả về layout best-effort ở scale nhỏ nhất (xem mục Thuật toán sizing). |

## Phạm vi xoá

Xoá hẳn, không migrate:

- `packages/printer-core/src/templates/` (`PrintTemplateType`,
  `PrintTemplate` bản phẳng cũ, `applyTemplate`, `DefaultLabelTemplate`,
  `DefaultReceiptTemplate`, và test đi kèm)
- `packages/printer-core/src/binding/` (`bindElements`, `BindingData`, và
  test đi kèm)
- 2 dòng `export * from './templates'` / `export * from './binding'` trong
  `packages/printer-core/src/index.ts`
