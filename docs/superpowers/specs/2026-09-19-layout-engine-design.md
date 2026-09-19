# Layout Engine — Spec thiết kế

## Mục tiêu

Thay thế hoàn toàn 2 module `templates/` và `binding/` trong
`packages/printer-core` bằng 1 mô hình template dạng cây, hỗ trợ auto-layout
thật: container có padding/margin/gap/alignment, text tự wrap dòng, và
section lặp cho danh sách độ dài thay đổi (topping, dòng hoá đơn).
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

## Kiến trúc

```
PrintTemplate (cây TemplateNode — tĩnh, chưa có data, chưa có toạ độ)
        │
        ▼  DocumentResolver.resolve(template, data)
ResolvedNode (đã bind giá trị, đã expand repeat, đã lọc node ẩn — vẫn chưa toạ độ)
        │
        ▼  LayoutEngine.resolve(root, config, typography, fontMetrics)
PrintElement[]  ◄── type đã có sẵn, không đổi (18 loại)
        │
        ▼  (không đổi — LabelBuilder/ReceiptBuilder, ResolvedPrintDocument, compile())
```

3 khái niệm, 3 tên riêng, 1 chiều duy nhất — không node nào bị dùng lại cho
2 giai đoạn khác nhau:

| Giai đoạn | Họ type | Có data? | Có toạ độ? |
|---|---|---|---|
| Template | `TemplateNode` | không | không |
| Resolved | `ResolvedNode` | có | không |
| Kết quả layout | `PrintElement` (đã có sẵn) | có | có |

## Tính tương thích (vì sao đây là additive, không phải viết lại)

`LayoutEngine` là 1 bước mới chèn **trước** mọi thứ đã có sẵn. Không có gì
ở tầng dưới bị đổi:

- **`PrintElement`** (18 loại: `text`/`image`/`barcode`/`qrcode`/`raw`/
  `box`/`line`/`diagonal`/`circle`/`ellipse`/`reverse`/`erase`/`pageBreak`/
  `spacer`/`row`/`column`/`cut`/`table`) — giữ nguyên. `LayoutEngine` chỉ
  *sinh ra* `PrintElement[]`; không tạo ra hình dạng element mới nào bắt
  compiler phải học thêm. `ContainerNode`/`RepeatNode` chỉ là khái niệm của
  tầng template — bị "tiêu thụ" trong lúc layout, không bao giờ xuất hiện
  trong mảng output.
- **`PrintCompiler<TOutput>.compile(document, encoding?: TextEncodingOptions)`**
  — không đổi. Pipeline của spec này dừng lại ở `PrintElement[]`, sau đó
  chảy vào `ResolvedPrintDocument` y hệt hiện tại.
- **Không trùng tên.** `document/PrintDocument.ts`
  (`{ width, height?, ...PrintDocumentOptions }`) và
  `document/ResolvedPrintDocument.ts` giữ nguyên ý nghĩa hiện tại. Các type
  mới của spec này dùng tên khác hẳn (`PrintTemplate`, `ResolvedNode`,
  `LayoutConfig`) không đè lên bất kỳ export nào đã có của
  `packages/printer-core`.

## Tầng Template

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

```ts
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

/** Bắt buộc có ít nhất 1 trong `text`/`binding` — kiểm tra ở `DocumentResolver`, không ép bằng type system (union 2 nhánh "bắt buộc 1 trong 2" đọc rối hơn chi phí validate lúc resolve). */
export interface TextNode {
  readonly type: 'text';
  readonly id: string;
  readonly text?: string; // literal, nội dung cố định
  readonly binding?: string; // dotted-path key vào PrintData
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

/** Cùng cấu trúc literal-hoặc-binding như `TextNode`; `content` là nội dung mã vạch. */
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

/** Pipeline này không có bước decode ảnh — `bitmap` phải là `Bitmap` đã decode sẵn, cùng điều kiện `ImageElement` đang yêu cầu. `binding` tra 1 giá trị `Bitmap` trong `PrintData` (ví dụ logo tải động theo từng lần in); `bitmap` dùng khi ảnh đã nhúng cứng vào template. */
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
  readonly binding: string; // key trỏ tới 1 mảng trong PrintData
  readonly template: TemplateNode;
  readonly visibleWhen?: VisibilityCondition;
}
```

`RepeatNode` là 1 node type riêng, không phải field `repeat?: RepeatConfig`
gắn trên mọi node. Repeat đổi *số lượng* (1 template node → N resolved
node) — khác bản chất với style/visibility (không bao giờ đổi số lượng node
tồn tại). Tách riêng giữ `TemplateNode` là discriminated union sạch: không
node nào "thỉnh thoảng nhân bản".

## Style/geometry dùng chung

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

`VisibilityCondition` là union đóng, có kiểu rõ ràng — cố tình không dùng
biểu thức string tự do (`visibleIf: string`), vì như vậy sẽ biến template
thành 1 ngôn ngữ scripting con. `AndCondition`/`OrCondition`/
`NotEqualsCondition` là hướng mở rộng tự nhiên sau này; spec này chỉ cần
`exists`/`equals` (không có template nào lúc thiết kế cần nhiều hơn).

Mọi giá trị dimension/inset/gap tính bằng **dots**, khớp với mọi giá trị
hình học khác trong package (`widthDots`, `x`/`y` trong `TextOptions`,...).
Nơi gọi làm việc theo mm/inch tự convert trước khi dựng `PrintTemplate`,
giống hệt cách gọi `LabelBuilder` hiện tại.

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

`RepeatNode` không xuất hiện trong `ResolvedNode` — resolve xong nó bị thay
bằng N bản sao đã resolve của `template`, bọc trong 1 `ResolvedContainer`
(kế thừa `style` của chính `RepeatNode`, nhờ vậy nơi gọi có thể xếp các
dòng lặp thành cột với `gap` y hệt bất kỳ container nào khác).

### Hành vi resolver

- **Tra binding**: `binding: "product.name"` là dotted-path tra trong
  `data`. Bên trong 1 lần expand `RepeatNode`, item hiện tại được đẩy vào
  context stack làm scope trong cùng — key không tìm thấy sẽ tra trong item
  trước, không thấy mới rơi ra scope ngoài. Đây đúng quy tắc "scope trong
  cùng ưu tiên, không thấy thì rơi ra ngoài" mà Mustache section dùng, nhờ
  đó 1 dòng lặp vừa đọc được field của chính item (`name`, `price`) vừa đọc
  được field global bên ngoài (`storeName`) mà không cần 2 cơ chế khác
  nhau.
- **Thiếu binding key là lỗi cứng.** Nếu 1 `binding` path resolve ra
  `undefined` ở bất kỳ đâu trong cây, `resolve()` throw ngay, nêu rõ `id`
  của node và path bị thiếu. Đây là hệ thống POS — template âm thầm in ra
  giá/tên sản phẩm rỗng vì thiếu field data là hậu quả tệ hơn nhiều so với
  1 exception phát hiện lỗi ngay lúc in.
- **Visibility**: node có `visibleWhen` đánh giá false bị loại hẳn khỏi cây
  đã resolve (không phải resolve-xong-rồi-ẩn — nó không bao giờ tới
  `LayoutEngine`, không chiếm không gian layout nào).
- **Không format.** `DocumentResolver` chỉ tra key và convert
  `String(value)` — không format tiền tệ, ngày tháng, số. Format
  (`45000` → `"45,000 ₫"`) là trách nhiệm của nơi gọi, làm trước khi dựng
  `PrintData`. Nhờ vậy resolver giữ được là 1 bước tra cứu thuần tuý, không
  phụ thuộc gì thêm.

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
là hậu quả tệ hơn nhiều so với 1 label hơi cao quá khổ 1 chút. Thuật toán:

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
   thiết kế template/`fontScaleLevels`, không phải thứ `LayoutEngine` từ
   chối thực hiện.

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
|---|---|
| `ResolvedText` | `TextElement { content: value, options: { x, y, size, align, ... } }` |
| `ResolvedLine` | `LineElement { options: { x1, y1, x2, y2, thickness } }` |
| `ResolvedBarcode` | `BarcodeElement { options: { x, y, symbology, content: value, readable } }` |
| `ResolvedQrCode` | `QrCodeElement { options: { x, y, content: value, errorCorrection } }` |
| `ResolvedImage` | `ImageElement { bitmap, options: { x, y } }` |

`x`/`y` trên mọi element sinh ra đều do `LayoutEngine` tính, không bao giờ
do người viết template khai tay — đây chính là điểm khác biệt cốt lõi so
với `elements: PrintElement[]` phẳng đã xoá, nơi mọi `x`/`y` phải đặt tay
từng cái một.

## Tóm tắt xử lý lỗi

| Trường hợp | Hành vi |
|---|---|
| `TextNode`/`BarcodeNode`/... thiếu cả `text`/`binding` lẫn `content`/`binding` | `DocumentResolver` throw — phát hiện lỗi khai template ngay, không âm thầm coi là rỗng. |
| `binding` path resolve ra `undefined` trong `PrintData` | `DocumentResolver` throw, nêu rõ `id` node và path. |
| `RepeatNode.binding` resolve ra giá trị không phải mảng | `DocumentResolver` throw. |
| Nội dung cao hơn `heightDots` kể cả ở `FontScaleLevel` nhỏ nhất | **Không throw.** `LayoutEngine` trả về layout best-effort ở scale nhỏ nhất (xem mục Thuật toán sizing). |

## Phạm vi xoá

Xoá hẳn, không migrate:

- `packages/printer-core/src/templates/` (`PrintTemplateType`,
  `PrintTemplate` bản phẳng cũ, `applyTemplate`, `DefaultLabelTemplate`,
  `DefaultReceiptTemplate`, và test đi kèm)
- `packages/printer-core/src/binding/` (`bindElements`, `BindingData`, và
  test đi kèm)
- 2 dòng `export * from './templates'` / `export * from './binding'` trong
  `packages/printer-core/src/index.ts`

## Cấu trúc thư mục

```
src/
├── template/
│   ├── PrintTemplateType.ts
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

Thay thế `template/` và `binding/` (đã xoá) làm thư mục con ngang hàng
trong `packages/printer-core/src/`, export từ `index.ts` gốc của package
giống mọi module khác.
