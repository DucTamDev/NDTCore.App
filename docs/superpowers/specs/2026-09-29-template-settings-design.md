# printer-core: settings của template (styles + options) — Design Spec

## Mục tiêu

Tách **cấu trúc** của template (in gì, ở đâu) khỏi **phần người dùng được chỉnh** (cỡ chữ, đậm, căn lề của từng loại
nội dung; bật/tắt mục; chữ tuỳ chỉnh). Template tự khai báo bộ `settings` của mình; UI sau này đọc `settings` để dựng
form, BE lưu template (theo cửa hàng) với giá trị đã chỉnh. `printer-core` in bằng giá trị có sẵn trong template.

Đồng thời gom thông tin chung của template vào `metadata` và đổi `root` → `content`, `media` → `kind`.

## Nguyên tắc đã chốt

- **Template không chứa data**, chỉ cấu trúc + placeholder (biến, style có tên, option).
- **`settings` nằm trong template**: mỗi style/option có `value` (dùng khi in) và `default` (chỉ để UI hiển thị/khôi
  phục; **không bao giờ đọc khi in**).
- **Không có bản ghi giá trị riêng** trong đợt này: khi cửa hàng tuỳ chỉnh, BE lưu template với `value` mới và trả
  template theo cửa hàng; `printer-core` không gộp/ghi đè từng giá trị.
- `schemaVersion` giữ 1 (chưa có template nào lưu ở BE).

## Ngoài phạm vi

- Form UI chỉnh settings (app, web admin, `printer-preview`), API/lưu trữ ở BE.
- `metadata.version` (phiên bản thiết kế template).
- Style có tên cho khối (padding, gap, margin) và cho node khác text.
- Kiểu option ngoài `boolean`, `text`, `choice`.
- Thông số máy in (DPI, gap giữa tem, tốc độ, độ đậm, số bản) — thuộc sub-spec B.

## Thiết kế

### 1. Cấu trúc `TemplateDocument`

```ts
interface TemplateDocument {
  readonly schemaVersion: 1;
  readonly metadata: TemplateMetadata;
  readonly settings: TemplateSettings;
  readonly content: TemplateNode;          // đổi tên từ `root`
}

interface TemplateMetadata {
  readonly id: string;
  readonly name: string;
  readonly dataId: string;
  readonly kind: TemplateKind;              // đổi tên từ `media`; 'label' | 'receipt'
  readonly locale: TemplateLocale;
  readonly paper: PaperSize;
}

interface TemplateSettings {
  readonly styles: Readonly<Record<string, StyleSetting>>;
  readonly options: Readonly<Record<string, OptionSetting>>;
}

interface StyleSetting {
  readonly label: string;                   // tên hiển thị trên form, VD 'Tên món'
  readonly value: TextStyle;                // dùng khi in
  readonly default: TextStyle;              // chỉ cho UI
}

type OptionSetting = BooleanOptionSetting | TextOptionSetting | ChoiceOptionSetting;
// boolean: { label, type: 'boolean', value: boolean, default: boolean }
// text:    { label, type: 'text',    value: string,  default: string }
// choice:  { label, type: 'choice',  choices: readonly { value: string; label: string }[], value: string, default: string }
```

- `TemplateMedia` → `TemplateKind`; `LayoutConfig.media` → `LayoutConfig.kind`.
- Mọi chỗ đọc `template.id/name/dataId/media/locale/paper/root` đổi sang `template.metadata.*` / `template.content`.
- `settings.styles` và `settings.options` bắt buộc có (có thể rỗng `{}`).

### 2. Tham chiếu từ node

- **Style có tên** — `TextNode.styleName?: string`:
  - Tên phải có trong `settings.styles`.
  - Node có `styleName` thì `style` không được có thuộc tính chữ (`fontSize`, `fontWeight`, `lineHeight`,
    `textAlign`); thuộc tính khối (`width`, `height`, `margin`, `padding`) vẫn được đặt.
- **Option trong điều kiện** — thêm vào `Condition`:
  ```ts
  interface OptionCondition { readonly op: 'option'; readonly option: string; readonly equals?: string | boolean }
  ```
  - Không có `equals`: đúng khi option `boolean` có `value === true` (chỉ hợp lệ với option `boolean`).
  - Có `equals`: đúng khi `value === equals`; option `boolean` thì `equals` là boolean, `choice` thì `equals` phải là 1
    `choices[].value`; option `text` không dùng được trong điều kiện.
  - Lồng được trong `and`/`or`/`not`.
- **Option trong nội dung** — thêm vào `Segment`:
  ```ts
  interface OptionSegment { readonly option: string }
  ```
  - Chỉ dùng với option `text`; in ra `value` nguyên văn. Dùng được ở mọi nội dung segment (text, barcode, QR).

### 3. DSL builder

```ts
receiptTemplate(templateData)
  .id('bill-default').name('Hoá đơn').paper({ widthMm: 80 })
  .settings({
    styles: { itemName: { label: 'Tên món', value: { fontSize: px(16), fontWeight: 'bold' } } },
    options: {
      showPrice: { label: 'In giá món', type: 'boolean', value: true },
      footerText: { label: 'Dòng cuối', type: 'text', value: 'Cảm ơn quý khách' },
    },
  })
  .content((scope) => ...
    text([item.var('productName')]).style(scope.style('itemName'))
    text([item.var('price')]).visibleWhen(scope.optionIs('showPrice'))
    text([scope.option('footerText')]))
  .build();
```

- `.settings(...)` là tuỳ chọn (bỏ trống = `{ styles: {}, options: {} }`) và phải gọi trước `.content(...)` để scope
  biết tên style/option (kiểu TypeScript).
- `default` bỏ trống trong DSL thì lấy bằng `value`.
- `scope.style(name)` → tham chiếu style (dùng cho `TextBuilder.style(...)`); `scope.option(name)` → `OptionSegment`
  (chỉ nhận tên option `text`); `scope.optionIs(name, equals?)` → `OptionCondition`. Gõ sai tên hoặc sai loại option là
  lỗi TypeScript.
- `.root(...)` đổi tên thành `.content(...)`.

### 4. Parse và validate

- `validateTemplateStructure`:
  - kiểm `metadata` (các field như trước, `kind` thay `media`), `settings` (label không rỗng, `value`/`default` đúng
    kiểu; `choice` có ít nhất 1 lựa chọn, `value`/`default` thuộc `choices`; style `value`/`default` hợp lệ như style chữ
    viết thẳng), `content` là node hợp lệ;
  - node: `styleName` là chuỗi không rỗng; không đi kèm thuộc tính chữ viết thẳng; segment/condition option đúng dạng.
- `validateTemplateAgainstData` (giữ tên) thêm kiểm tham chiếu:
  - lỗi: `styleName` không có trong `settings.styles`; option không tồn tại; dùng sai loại option (segment với option
    không phải `text`; điều kiện với option `text`; `equals` sai kiểu hoặc không thuộc `choices`);
  - cảnh báo: style/option khai báo mà không node nào dùng.
- Builder `.build()` báo lỗi như hiện nay (`TemplateBuildError`) khi validate có lỗi.

### 5. Resolver

- Text node có `styleName`: style chữ của node đã resolve = `settings.styles[styleName].value` (kèm thuộc tính khối
  viết thẳng của node). Layout nhận style như node viết thẳng — layout/compiler không đổi.
- `OptionCondition` đánh giá bằng `settings.options[option].value`.
- `OptionSegment` in `settings.options[option].value`.
- `default` không được đọc ở bất kỳ đâu trong resolve/layout/compile.
- Tham chiếu không tồn tại lúc resolve (template chưa qua validate) → `ResolveError` như biến không tồn tại.

### 6. `printer-preview`

Mẫu mặc định (`defaultSample.ts`) và code đọc template (`pipeline.ts`, `evaluateTemplate.ts`) theo cấu trúc mới; mẫu có
ví dụ dùng `settings` (1 style có tên + 1 option boolean). Không thêm form chỉnh settings.

## Test

- Test hiện có: sửa theo cấu trúc JSON mới (`metadata`, `content`, `kind`) và DSL `.content(...)`; nội dung kiểm tra giữ
  nguyên.
- Test mới:
  - parse/validate: `settings` hợp lệ/không hợp lệ (sai kiểu, `choice` ngoài danh sách), `styleName` kèm thuộc tính chữ
    viết thẳng bị từ chối, tham chiếu style/option không tồn tại, sai loại option, cảnh báo khai báo không dùng;
  - resolve: text node dùng style có tên lấy đúng `value` (không phải `default`); `OptionCondition` ẩn/hiện theo
    `value` (boolean, choice + `equals`, lồng trong `and`/`not`); `OptionSegment` in đúng `value`;
  - DSL: `.settings` + `scope.style/option/optionIs` sinh đúng JSON, `default` mặc định bằng `value`; `@ts-expect-error`
    cho tên sai và sai loại option.
- Kết quả in của template không dùng settings không đổi (test pipeline hiện có).

## Tiêu chí hoàn thành

- tsc 0 lỗi, jest xanh, eslint 0 lỗi, `printer-preview` type-check + Vitest xanh, dòng ≤ 120 ký tự.
- Không còn `template.root`, `media`/`TemplateMedia` trong `printer-core` và `printer-preview`.
