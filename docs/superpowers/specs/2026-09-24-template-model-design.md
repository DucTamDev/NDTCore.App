# Template Model — Design Spec (Sub-spec A)

Thuộc kiến trúc tổng: `2026-09-24-print-template-pipeline-overview.md`.

## Bối cảnh

Model template hiện tại (`template/`, `resolution/`) chạy tốt cho preview của dev, nhưng chưa đủ để lưu trên BE và dùng chung cho nhiều cửa hàng, nhiều loại máy in:

| Vấn đề | Hiện trạng | Hệ quả |
|---|---|---|
| Template gắn chặt DPI | `config: { widthDots, heightDots, dpi }`, mọi style (padding, gap, fontSize...) tính bằng dots | Template viết cho máy 203 dpi, in ra máy 300 dpi (TSC TE310 có trong profile) sẽ co còn 68% |
| Chứa binary | `ImageNode.bitmap: Bitmap` (`Uint8Array`) | Không serialize được ra JSON để lưu BE |
| Binding trỏ thẳng vào data | `binding: 'order.items.name'` | Đổi cấu trúc data nội bộ thì mọi template đã lưu đều vỡ |
| Tra scope ngầm | `lookup()` trong `DocumentResolver` dò ngược lên scope cha khi không thấy field | Bên trong `repeat`, cùng 1 tên field có thể khớp nhầm scope ngoài (shadowing) |
| Cặp field loại trừ nhau | `text?`/`binding?`, `content?`/`binding?`, `bitmap?`/`binding?` | Type không thể hiện được ràng buộc, chỉ kiểm tra lúc runtime |
| Không có format | Data phải format sẵn (`'45,000đ'`) | Không đổi được cách hiển thị qua template |
| Điều kiện quá ít | Chỉ `exists`/`equals` | Không biểu diễn được "hiện dòng giảm giá khi discount > 0" |
| Không in được "mỗi ly 1 tem" | `repeat` chỉ lặp theo phần tử mảng | Tem kiểu Fabi (3 ly → 3 tem "1/3, 2/3, 3/3") phải xử lý ở code gọi |
| Không validate/migrate | Template chỉ đến từ DSL có kiểu | Không an toàn khi đọc JSON từ BE |

## Mục tiêu

1. Template là JSON thuần, độc lập thiết bị, có `schemaVersion`, đọc được an toàn từ BE.
2. Template không biết cấu trúc data nội bộ — binding qua catalog biến có tên.
3. Đủ khả năng biểu đạt cho hoá đơn, phiếu bếp, tem món thực tế: nội dung ghép chữ + biến, format, điều kiện, lặp/expand/phân trang, ảnh.

## Ngoài phạm vi

- Chế độ in tiếng Việt, raster, đo chữ theo máy đích (sub-spec B).
- `PrintElement` semantic, compiler warnings (sub-spec C).
- Catalog thật của app (hoá đơn, phiếu bếp, tem món) và tích hợp in (sub-spec D). Spec này chỉ làm cơ chế catalog + 1 catalog demo cho printer-preview.
- Bảng món trên hoá đơn (tổng quát hoá row layout) — sub-spec layout riêng.
- Designer UI, API BE lưu template/asset.

## Thiết kế

### 1. `TemplateDocument`

```ts
interface TemplateDocument {
  readonly schemaVersion: 1;
  readonly id: string;                  // do người tạo đặt (DSL) hoặc BE cấp — không tự sinh theo thứ tự
  readonly name: string;
  readonly catalog: string;             // id catalog, VD 'product-label'
  readonly media: 'label' | 'receipt';  // label: chiều cao cố định + phân trang · receipt: giấy cuộn
  readonly locale: 'vi-VN';
  readonly paper: { readonly widthMm: number; readonly heightMm?: number };   // heightMm chỉ có ở label
  readonly root: TemplateNode;
}
```

Thay thế `PrintTemplate` / `LabelTemplate` / `ReceiptTemplate` / `LayoutConfig` hiện tại. Field `version` (nội dung) bị bỏ — quản lý revision nội dung template là việc của BE.

### 2. Đơn vị

- **Khổ giấy:** mm, cố định (`paper.widthMm`/`heightMm`), khớp trực tiếp với `PrinterProfile.paperWidth` (đã là mm).
- **Mọi độ dài khác** (padding, margin, gap, width/height fixed, fontSize, độ dày nét, chiều cao barcode, cỡ module QR):
  ```ts
  type LengthUnit = 'mm' | 'pt' | 'px';
  interface Length { readonly value: number; readonly unit: LengthUnit }
  ```
  `px` = 1/96 inch (CSS reference pixel), `pt` = 1/72 inch, `mm` = 1/25.4 inch.
- **Không có đơn vị `dot`** trong template — dots chỉ xuất hiện từ tầng Layout trở xuống.
- DSL cung cấp helper `mm()`, `pt()`, `px()`. Mặc định dùng trong tài liệu/designer: hình học `mm`, cỡ chữ `px`.
- `lineHeight` là **hệ số** không đơn vị (VD `1.2`), giống CSS.
- Giá trị được lưu đúng như người viết khai báo (`{ value: 2, unit: 'mm' }`), không quy đổi lúc lưu, nên không mất số lẻ.

### 3. Catalog

Cầu nối duy nhất giữa template và data. Mỗi loại nội dung in có 1 catalog, định nghĩa trong code app.

```ts
type VariableType = 'string' | 'number' | 'money' | 'datetime' | 'boolean' | 'asset';

interface VariableSpec<TSource> {
  readonly label: string;                       // tên hiển thị cho người dùng, VD 'Tên bàn'
  readonly type: VariableType;
  readonly get: (source: TSource) => unknown;
  readonly optional?: boolean;                  // rỗng thì in chuỗi rỗng thay vì báo lỗi
  readonly deprecated?: string;                 // lý do + biến thay thế; vẫn chạy, validate thì cảnh báo
}

interface CollectionSpec<TSource, TItem> {
  readonly label: string;
  readonly get: (source: TSource) => readonly TItem[];
  readonly variables: Record<string, VariableSpec<TItem>>;
  readonly collections?: Record<string, CollectionSpec<TItem, unknown>>;
}

function defineCatalog<TData>(spec: {
  id: string;
  version: number;
  sample: TData;                                // data mẫu cho preview/designer
  variables: Record<string, VariableSpec<TData>>;
  collections?: Record<string, CollectionSpec<TData, unknown>>;
}): Catalog<TData>;
```

**Quy tắc:**
- **Tên biến là duy nhất trong toàn catalog** (gồm biến gốc, biến trong mọi collection, tên collection). `defineCatalog` throw ngay nếu trùng, nên resolver luôn biết chính xác biến thuộc scope nào.
- **Scope:** biến gốc dùng được ở mọi chỗ. Biến của 1 collection chỉ dùng được bên trong `repeat` của collection đó và các node con của nó. Collection lồng chỉ được `repeat` bên trong collection cha.
- **Biến tính toán** (VD `itemPrice: get: (i) => i.price * i.quantity`) nằm trong `get`. Template không bao giờ tính toán, không có ngôn ngữ biểu thức.
- **`money`** có format mặc định là `currency`. Các kiểu khác mặc định in bằng `String(value)`, `datetime` mặc định `dd/MM/yyyy HH:mm`.
- **`asset`:** `get` trả về mã asset (string), dùng cho `ImageNode`.
- **Tiến hoá:** thêm biến thì thoải mái. Đổi cấu trúc data thì chỉ sửa `get`. Đổi tên/bỏ biến là breaking — đánh dấu `deprecated`, không xoá.

**`catalog.describe()`** trả về metadata JSON thuần (không có hàm): `{ id, version, variables: [{ name, label, type, optional, deprecated }], collections: [...] }`. Designer và BE dùng metadata này; các hàm `get` chỉ tồn tại trong code app.

### 4. Segment + format

Nội dung động của `TextNode`, `BarcodeNode`, `QrCodeNode`:

```ts
type Segment =
  | { readonly text: string }
  | { readonly var: string; readonly format?: ValueFormat };

type ValueFormat =
  | { readonly type: 'number';   readonly decimals?: number }
  | { readonly type: 'currency'; readonly symbol?: 'đ' | '₫' | 'VND' | ''; readonly decimals?: number }
  | { readonly type: 'datetime'; readonly pattern: string }
  | { readonly type: 'text';     readonly transform?: 'upper' | 'lower'; readonly maxLength?: number };
```

- Ghép chữ và biến trong 1 dòng: `[{ text: 'Bàn ' }, { var: 'tableName' }, { text: ' · ' }, { var: 'orderTime', format: { type: 'datetime', pattern: 'HH:mm' } }]`.
- `format` bỏ trống thì dùng format mặc định theo kiểu biến (mục 3).
- Dấu phân cách hàng nghìn/thập phân theo `TemplateDocument.locale` (`vi-VN`: `45.000`).
- **Formatter tự cài đặt, không dùng `Intl`** — `Intl` trên Hermes (React Native) không đồng nhất với trình duyệt, dễ khiến preview web khác bản in trên máy thật.
- Input của `datetime`: chuỗi ISO 8601 hoặc số epoch ms.
- Pattern `datetime` hỗ trợ: `dd`, `MM`, `yyyy`, `yy`, `HH`, `mm`, `ss`.

### 5. Biến có sẵn

| Biến | Ý nghĩa | Dùng được ở đâu |
|---|---|---|
| `$position` / `$total` | Thứ tự (từ 1) / tổng số phần tử của `repeat` gần nhất, **tính sau khi expand** | Trong `repeat` |
| `$unit` / `$unitCount` | Thứ tự / tổng số bản sao của phần tử hiện tại khi `expand` (VD ly thứ 2 trong 3 ly trà sữa) | Trong `repeat` có `expand` |
| `$page` / `$pageCount` | Trang hiện tại / tổng số trang | Mọi chỗ |

Tiền tố `$` được giữ riêng — `defineCatalog` từ chối tên biến bắt đầu bằng `$`.

### 6. Điều kiện ẩn/hiện

```ts
type Condition =
  | { readonly op: 'exists' | 'notEmpty'; readonly var: string }
  | { readonly op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; readonly var: string; readonly value: string | number | boolean }
  | { readonly op: 'and' | 'or'; readonly conditions: readonly Condition[] }
  | { readonly op: 'not'; readonly condition: Condition };
```

Mọi node có `visibleWhen?: Condition`. Là data thuần, không phải biểu thức dạng chuỗi — không cần parser, không có `eval`, an toàn với template tải từ BE.

- So sánh trên **giá trị raw** trả về từ `get()`, trước khi format (VD `gt` với biến `money` so sánh số, không so sánh chuỗi `'45.000đ'`).
- `exists`: giá trị khác `undefined`/`null`. `notEmpty`: `exists` và không phải chuỗi rỗng/mảng rỗng.

### 7. Node

Mọi node kế thừa `TemplateNodeBase { id; visibleWhen? }` (sửa `RepeatNode` hiện đang không kế thừa).

| Node | Field chính |
|---|---|
| `ContainerNode` | `style: LayoutStyle` — `direction`, `gap: Length`, `justifyContent`, `alignItems`, cộng `BoxStyle` |
| `TextNode` | `content: Segment[]`; `style: BoxStyle & TextStyle` — `fontSize: Length`, `fontWeight`, `lineHeight: number` (hệ số), `textAlign` |
| `BarcodeNode` | `content: Segment[]`; `symbology`; `readable`; `height: Length` |
| `QrCodeNode` | `content: Segment[]`; `errorCorrection`; `moduleSize: Length` |
| `ImageNode` | `source: { asset: string } \| { var: string }` — biến phải có kiểu `asset` |
| `LineNode` | `thickness: Length`; `pattern: 'solid' \| 'dashed'` |
| `RepeatNode` | `collection: string`; `expand?: string` (biến kiểu `number` của collection đó); `maxItemsPerPage?: number`; `template: TemplateNode` |

`BoxStyle`: `width`/`height` là `Dimension` (`fixed` mang `Length`, `fill`, `auto`); `margin`/`padding` là `Insets` với 4 cạnh là `Length`.

**`pattern: 'dashed'`** do `LayoutEngine` tách thành nhiều `LineElement` ngắn — 9 compiler không phải sửa gì.

**Ảnh:** khuyến nghị logo dùng `{ var: 'storeLogo' }` (biến kiểu `asset`), để template dùng chung cho nhiều cửa hàng. `{ asset: '...' }` tĩnh chỉ dành cho thành phần thuộc thiết kế (icon, hoa văn).

### 8. Repeat, expand, phân trang

- `repeat({ collection: 'items' })` lấy mảng qua `catalog.collections.items.get(scope hiện tại)`.
- `expand: 'quantity'` nhân mỗi phần tử thành `quantity` bản sao. Giá trị không phải số nguyên dương thì báo lỗi trang.
- `$position`/`$total` đếm theo danh sách **sau khi expand** (2 món: trà sữa ×3, cà phê ×2 → 5 phần tử, `1/5`...`5/5`). `$unit`/`$unitCount` đếm trong từng món (`1/3, 2/3, 3/3, 1/2, 2/2`).
- `maxItemsPerPage` giữ nguyên hành vi hiện tại, áp dụng trên danh sách sau khi expand. Tem mỗi ly 1 trang: `maxItemsPerPage: 1`.

### 9. Asset

- `collectAssetIds(template, catalog, data)` trả về danh sách mã asset cần tải: gồm asset tĩnh trong template và giá trị của các biến kiểu `asset` đang được dùng.
- App tự tải (cache/BE), decode PNG → `Bitmap` (phụ thuộc nền tảng, không nằm trong core), rồi truyền `AssetProvider`:
  ```ts
  interface AssetProvider { get(assetId: string): Bitmap | undefined }
  ```
- Mã asset nên có version (`brand-logo@v3`) để cache không dùng nhầm ảnh cũ.
- Asset không tìm thấy thì trang đó báo lỗi. Ảnh tuỳ chọn thì bọc bằng `visibleWhen: { op: 'exists', var: 'storeLogo' }` hoặc khai báo biến `optional`.

### 10. Resolve

```ts
class DocumentResolver {
  resolve<TData>(
    template: TemplateDocument,
    data: TData,
    context: { catalog: Catalog<TData>; assets: AssetProvider },
  ): readonly ResolvedPage[];
}
```

1. Kiểm tra `template.catalog === catalog.id`, sai thì throw.
2. Duyệt cây node với 1 **stack scope** tường minh: `[data gốc, phần tử hiện tại của collection cấp 1, cấp 2...]`.
3. Gặp `{ var: 'itemName' }`: catalog cho biết biến thuộc collection nào → lấy phần tử tương ứng trên stack → `get()` → format → chuỗi. **Bỏ hẳn cơ chế dò ngược scope của `lookup()` hiện tại.**
4. Giá trị `undefined`/`null`: biến `optional` thì in chuỗi rỗng; không `optional` thì ném `ResolveError` — **cô lập theo trang** như hiện tại (1 trang lỗi không ảnh hưởng trang khác).

`ResolvedNode` mang giá trị đã thành chuỗi; kích thước vẫn là `Length` — đổi sang dots là việc của Layout.

### 11. Layout — thay đổi giao diện

`LayoutEngine.resolve(root, config, ...)` nhận thêm DPI của máy đích thay cho `LayoutConfig` dạng dots:

```ts
layoutEngine.resolve(page.node, { paper: template.paper, media: template.media, dpi }, typography, fontMetrics);
```

- Đổi `Length → dots` ở đúng 1 chỗ, đầu Layout: `dots = round(value × dpi ÷ đơnVịTrên1Inch)`, nét kẻ tối thiểu 1 dot.
- `widthDots = round(paper.widthMm × dpi ÷ 25.4)`, tương tự `heightDots` cho label.
- Phần đo chữ theo máy đích (`TextMeasurer`) thuộc sub-spec B. Spec này giữ `ApproximateFontMetrics` hiện tại.

### 12. Validate + migrate

**`parseTemplate(json: unknown)`** — dùng khi template đến từ nguồn không có kiểu (BE, file import):
```ts
type ParseResult =
  | { readonly ok: true; readonly template: TemplateDocument }
  | { readonly ok: false; readonly issues: readonly TemplateIssue[] };

interface TemplateIssue { readonly path: string; readonly message: string }   // path JSON, VD 'root.children[2].style.padding.top'
```
1. `schemaVersion` thấp hơn bản hiện tại → chạy lần lượt các migration. **Cao hơn** → lỗi "template được tạo bởi phiên bản app mới hơn, cần cập nhật app".
2. Kiểm tra cấu trúc: loại node hợp lệ, field bắt buộc, đơn vị `mm|pt|px`, segment/format/điều kiện đúng dạng, `id` node không trùng. Node type lạ báo lỗi, không bỏ qua.
3. Validator **viết tay** (mỗi loại node 1 hàm kiểm tra) — không thêm zod, giữ printer-core không có dependency.

**Migration:** `Record<number, (doc: unknown) => unknown>`, mỗi bước là hàm thuần, có test fixture riêng.

**`validateTemplateAgainstCatalog(template, catalog.describe())`** — kiểm tra template khớp catalog:
- Biến tồn tại; biến dùng đúng scope (VD `itemName` ngoài `repeat items` → lỗi "chỉ dùng được trong vòng lặp Danh sách món").
- `collection`/`expand` hợp lệ; `expand` là biến kiểu `number`; `ImageNode` dùng biến kiểu `asset`.
- `format` hợp kiểu biến (VD `currency` cho biến `string` → lỗi).
- Biến `deprecated` → cảnh báo, không phải lỗi.

Nhận metadata (`describe()`) thay vì catalog có hàm, nên BE/designer dùng được cùng logic.

### 13. DSL

```ts
labelTemplate(PRODUCT_LABEL_CATALOG)
  .id('product-label-default')
  .name('Tem món mặc định')
  .paper({ widthMm: 50, heightMm: 30 })
  .root(
    repeat({ collection: 'items', expand: 'quantity' }, (row) =>
      column().padding(insets(mm(2))).gap(mm(1)).children(
        text([row.var('itemName')]).fontSize(px(16)).bold(),
        repeat({ collection: 'toppings' }, (t) => text([{ text: '+ ' }, t.var('toppingName')])),
        text([{ var: 'orderCode' }, { text: ' · ' }, { var: '$unit' }, { text: '/' }, { var: '$unitCount' }]),
      ),
    ).maxItemsPerPage(1),
  )
  .build();   // → TemplateDocument (JSON thuần)
```

- `labelTemplate(catalog)` / `receiptTemplate(catalog)` nhận catalog, nên `var(...)` được TypeScript kiểm tra bằng `keyof` — gõ sai tên biến là lỗi ngay trong editor. Bên trong callback của `repeat`, `row.var(...)` chỉ gợi ý biến của collection đó.
- `build()` trả về JSON thuần, chạy `validateTemplateAgainstCatalog` trước khi trả để bắt lỗi scope mà TypeScript không bắt được — có lỗi thì throw kèm danh sách issue; chỉ có cảnh báo `deprecated` thì không throw.
- `id` và `name` bắt buộc (không còn tự sinh `template-1`).
- Helper mới: `mm()`, `pt()`, `px()`, `insets()`; điều kiện `exists()`, `notEmpty()`, `eq()`, `gt()`..., `and()`, `or()`, `not()`.

## Code bị ảnh hưởng

- `template/`: `PrintTemplate.ts`, `PrintTemplateType.ts` thay bằng `TemplateDocument`; toàn bộ `nodes/`, `style/`, `builder/` sửa theo mục 2-8, 13.
- `resolution/`: `DocumentResolver.ts` viết lại theo mục 10 (tiện thể áp Clean Code — file này hiện có 12 dòng >120 ký tự, switch lớn chưa tách hàm); `ResolvedNode.ts` đổi kích thước sang `Length`; `PrintData.ts` bỏ (data giờ có kiểu qua catalog).
- `layout/`: `LayoutConfig.ts` đổi theo mục 11; `LayoutEngine.ts` thêm bước đổi `Length → dots`, tách nét đứt.
- Module mới: `catalog/` (`defineCatalog`, `Catalog`, `describe`), `template/format/` (formatter), `template/parse/` (`parseTemplate`, migration, `validateTemplateAgainstCatalog`), `template/asset/` (`AssetProvider`, `collectAssetIds`).
- `packages/printer-preview`: `defaultSample.ts` viết lại theo DSL mới + 1 catalog demo; `evaluateTemplate.ts` nhận diện `TemplateDocument` thay cho `{ root, config }`; `pipeline.ts` truyền catalog, asset provider rỗng, DPI.
- Không ảnh hưởng: `document/builder/` (PrintBuilder thấp cấp), `language/`, `preview/`, `validation/`.

## Testing

- Formatter: bảng test cho từng `ValueFormat` (số âm, 0, số lẻ, pattern ngày giờ, input ISO lẫn epoch).
- Catalog: trùng tên biến throw; tên bắt đầu `$` throw; `describe()` không lộ hàm.
- Resolver: scope tường minh (biến collection ngoài repeat lỗi; không khớp nhầm scope ngoài); `expand` + `$position/$total/$unit/$unitCount`; phân trang sau expand; biến optional rỗng; asset thiếu → lỗi đúng trang, trang khác vẫn ok.
- Điều kiện: đủ mọi `op`, lồng `and/or/not`.
- `parseTemplate`: fixture JSON hợp lệ/lỗi, issue có path đúng; `schemaVersion` cao hơn báo lỗi; migration chạy đúng thứ tự.
- `validateTemplateAgainstCatalog`: mỗi loại lỗi ở mục 12 có ít nhất 1 test.
- Layout: đổi `Length → dots` đúng ở 203 và 300 dpi (cùng 1 template, kích thước vật lý giống nhau); nét đứt tách đúng.
- DSL: test kiểu bằng `// @ts-expect-error` cho tên biến sai và biến dùng sai scope; `build()` ra JSON serialize/deserialize không mất dữ liệu (round-trip `JSON.parse(JSON.stringify(...))` rồi `parseTemplate` vẫn ok).
- Toàn bộ test hiện có của `printer-core` và `printer-preview` được cập nhật theo model mới và phải pass.

## Rủi ro & đánh đổi

- **Breaking toàn bộ API template.** `printer-core` chưa có consumer thật ngoài `printer-preview`, nên chi phí hiện tại thấp. Làm càng muộn (sau khi app dùng thật, sau khi BE lưu template) thì chi phí càng cao.
- **Catalog là việc phải làm thêm** cho mỗi loại nội dung, và mỗi field mới template cần dùng phải khai báo vào catalog. Đây là đánh đổi có chủ đích: danh sách biến dùng được trong mẫu in là cố định và có tài liệu, đổi lại template không bao giờ vỡ khi data nội bộ đổi cấu trúc.
- **Kiểu TypeScript của DSL** (biến theo scope `repeat`) cần generic lồng nhau. Dùng `keyof` của catalog nên đơn giản hơn nhiều so với kiểu path, nhưng vẫn cần test kiểu riêng.
- **Formatter tự viết** thay vì `Intl`: phải tự lo các trường hợp biên của số và ngày. Đổi lại kết quả đồng nhất tuyệt đối giữa web và React Native.
- **`$pageCount` với label có phân trang** yêu cầu biết tổng số trang trước khi resolve từng trang — resolver hiện đã đếm trước (`countPaginatingItems`), chỉ cần tính theo danh sách sau khi expand.
