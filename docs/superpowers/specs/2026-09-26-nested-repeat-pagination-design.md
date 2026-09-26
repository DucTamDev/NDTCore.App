# Nested Repeat Pagination — Design Spec

Mở rộng template model của sub-spec A (`2026-09-24-template-model-design.md`). Áp dụng nguyên "Quy ước code" 11 điểm của `2026-09-24-print-template-pipeline-overview.md`.

## Bối cảnh

Tem món in theo mẫu: 1 `repeat` ngoài cùng lặp món (`expand: 'quantity'`, `maxItemsPerPage: 1` → mỗi ly 1 tem), bên trong có 1 `repeat` lồng lặp topping.

Hiện trạng:

- **Resolver chỉ phân trang `repeat` ngoài cùng.** `countPages` và `entryRangeForPage` bỏ qua `repeat` lồng — `maxItemsPerPage` ở `repeat` lồng khai báo được, qua được validate, nhưng không có tác dụng.
- **Topping dồn hết vào 1 tem.** Layout thử co chữ 100% → 75% → 50%; không vừa thì dùng mức nhỏ nhất và để tràn, không cảnh báo.

Đo thực tế với mẫu tem món 50×30 mm (240 dots, 203 dpi):

| Số topping | Kết quả |
|---|---|
| 2 | Vừa ở cỡ 100% |
| 4 | Vừa ở cỡ 75% |
| 6–8 | Vừa ở cỡ 50% |
| 12 | Tràn: đáy nội dung khoảng 268 dots, dòng cuối (mã đơn + số ly) nằm ngoài tem |

Vì layout đo bằng font ước lượng, trên máy in thật tem có thể đã tràn từ khoảng 8 topping.

## Mục tiêu

Cho topping (nói chung: `repeat` lồng 1 tầng) tràn sang tem tiếp theo theo số lượng cố định khai báo trong template. Tem tiếp in lại toàn bộ nội dung của món, chỉ đổi nhóm topping. Template tự đánh dấu tem tiếp bằng biến có sẵn mới `$part`/`$partCount`.

## Ngoài phạm vi

- Tách tem theo chiều cao thật (layout đo rồi chia) — cần vòng lặp resolve ↔ layout, để sau nếu cần.
- Cảnh báo khi 1 tem vẫn tràn chiều cao.
- Phân trang `repeat` lồng từ tầng 2 trở xuống (topping của topping).
- Tăng `schemaVersion` / migrate: trước đây `maxItemsPerPage` ở `repeat` lồng không có tác dụng và chưa có template nào lưu ở BE, nên không có template cũ đổi nghĩa ngoài ý muốn.

## Thiết kế

### 1. Khai báo trong template

Không thêm field. Dùng lại `RepeatNode.maxItemsPerPage` trên `repeat` lồng:

```ts
scope.repeat({ collection: 'products', expand: 'quantity' }, (product) =>
  column().children(
    text([product.var('productName')]),
    product
      .repeat({ collection: 'toppings' }, (topping) => text([{ text: '+ ' }, topping.var('toppingName')]))
      .maxItemsPerPage(4),
  ),
).maxItemsPerPage(1);
```

Thuật ngữ trong spec này:

- **Repeat trang:** `repeat` cấp ngoài cùng (không nằm trong `repeat` khác) có `maxItemsPerPage`.
- **Repeat phần:** `repeat` nằm trong `template` của 1 repeat trang, không nằm trong `repeat` nào khác, có `maxItemsPerPage`.

### 2. Ràng buộc (validate cấu trúc)

`validateNode` (bước `parseTemplate`) báo lỗi, không lặng lẽ bỏ qua, khi:

1. **Repeat phần mà repeat trang bao nó có `maxItemsPerPage` khác 1.** Nhiều món mỗi tem cộng với tách topping cho ra tổ hợp khó đoán.
2. **`repeat` lồng có `maxItemsPerPage` nhưng `repeat` bao nó không phải repeat trang.** Gồm 2 trường hợp:
   - `repeat` ngoài không có `maxItemsPerPage`;
   - `repeat` nằm từ tầng lồng thứ 2 trở xuống.
3. **Nhiều hơn 1 repeat trang cùng chứa repeat phần.** `$part`/`$partCount` chỉ có 1 nguồn.

Câu lỗi tiếng Việt, nêu đúng node vi phạm, theo giọng các lỗi validate hiện có.

### 3. Đếm tem

- **Số phần của 1 phần tử** (sau expand) của repeat trang = max, trên các repeat phần của nó, của `ceil(số phần tử repeat phần / maxItemsPerPage)`; tối thiểu 1. Phần tử không có repeat phần, hoặc danh sách rỗng → 1 phần.
- **Số trang của repeat trang có repeat phần** = tổng số phần của mọi phần tử của nó.
- **Số trang của repeat trang không có repeat phần** = `ceil(n / maxItemsPerPage)`, như hiện nay.
- **Số trang của document** = max của các repeat trang (như hiện nay), tối thiểu 1.
- **Đếm để chia trang không chặn lỗi,** giống `countPages` hiện nay: lỗi đọc dữ liệu hay điều kiện ẩn/hiện khi đếm được coi như 1 phần; lỗi sẽ hiện ra ở đúng trang khi resolve.
- **Repeat phần nằm trong node đang bị ẩn** (`visible` sai) vẫn được đếm, cùng cách với `isVisibleWhileCounting` hiện có.

Ví dụ: 1 món số lượng 2, 9 topping, `maxItemsPerPage: 4` → mỗi ly 3 phần (4 + 4 + 1) → 6 tem.

### 4. Chia nội dung theo trang

Trước khi resolve, resolver lập **kế hoạch trang**: trang thứ k (từ 1) ứng với cặp (phần tử thứ i của repeat trang, phần thứ j của phần tử đó), theo thứ tự phần tử rồi tới phần.

Khi resolve trang k:

- **Repeat trang có repeat phần:** chỉ lấy đúng phần tử i (thay cho `(k − 1) × maxItemsPerPage`).
- **Repeat phần:** lấy các phần tử từ `(j − 1) × maxItemsPerPage` tới `j × maxItemsPerPage` (không vượt quá tổng). Phần j vượt quá số phần của repeat phần đó (repeat phần ngắn hơn trong cùng phần tử) → danh sách rỗng.
- **Repeat trang khác** (anh em, không có repeat phần): vẫn chia theo `(k − 1) × maxItemsPerPage` như hiện nay. Hết phần tử thì trang đó rỗng ở vị trí của nó.
- **Node không thuộc `repeat` nào:** in lại trên mọi trang, như hiện nay.

### 5. Biến có sẵn

Thêm 2 biến kiểu `number`, scope `document` (dùng được ở mọi chỗ, như `$page`):

| Biến | Giá trị |
|---|---|
| `$part` | Thứ tự phần (từ 1) của phần tử đang in trên trang này |
| `$partCount` | Tổng số phần của phần tử đó |

- Không có repeat phần, hoặc trang không ứng với phần tử nào của repeat trang có repeat phần → `$part = 1`, `$partCount = 1`.
- `$page`/`$pageCount` vẫn đánh số liên tục trên toàn lệnh in.
- `$position`/`$total` trong repeat phần là thứ tự tuyệt đối trong cả danh sách (topping thứ 5 trên 9), không phải trong phần.
- `$unit`/`$unitCount` không đổi (vẫn là số ly).

Ví dụ template dùng biến mới:

- **Chỉ hiện giá ở tem đầu:** `visible: { op: 'eq', var: '$part', value: 1 }`.
- **Hiện "(tiếp x/y)" khi có tách tem:** `visible: { op: 'gt', var: '$partCount', value: 1 }`.

### 6. Thành phần bị ảnh hưởng

| Chỗ | Thay đổi |
|---|---|
| `catalog/BuiltInVariable.ts` | Thêm `$part`, `$partCount` (scope `document`) |
| `resolution/ResolveContext.ts` | `PageInfo` mang thêm thứ tự phần/tổng phần và phần tử repeat trang của trang |
| `resolution/countPages.ts` | Đếm theo mục 3; lập kế hoạch trang (mục 4) |
| `resolution/resolveNode.ts` | Chọn phần tử/nhóm phần tử theo kế hoạch trang (mục 4) |
| `resolution/readVariable.ts` | Đọc `$part`/`$partCount` từ `PageInfo` |
| `resolution/DocumentResolver.ts` | Dùng kế hoạch trang khi tạo `PageInfo` cho từng trang |
| `template/parse/validateNode.ts` | 3 ràng buộc ở mục 2 |
| `template/nodes/RepeatNode.ts` | JSDoc của `maxItemsPerPage` nêu nghĩa mới ở `repeat` lồng |
| `template/builder/` | Không đổi API (DSL đã cho gọi `.maxItemsPerPage()` trên `repeat` lồng); kiểu tên biến có sẵn tự nhận thêm 2 biến |
| `packages/printer-preview/src/defaultSample.ts` | Mẫu tem món dùng `maxItemsPerPage(4)` cho topping, giá chỉ ở tem đầu, dòng "(tiếp x/y)" |
| `packages/printer-core/README.md` | Mô tả phân trang `repeat` lồng và 2 biến mới |

`validateTemplateAgainstCatalog` nhận 2 biến mới qua `BUILT_IN_VARIABLE_SCOPES`; scope `document` không cần kiểm tra thêm.

## Testing

- **Resolver:**
  - Món 9 topping, `maxItemsPerPage: 4` → 3 tem với nhóm 4/4/1; `$part`/`$partCount` = 1/3, 2/3, 3/3; phần tử không thuộc `repeat` in trên cả 3.
  - Món số lượng 2 → lặp đủ 3 phần cho từng ly (6 tem); `$unit`/`$unitCount` đúng; `$page`/`$pageCount` = 1..6/6.
  - Món không topping → 1 tem, `$part` = 1/1.
  - 2 món với số phần khác nhau → kế hoạch trang theo thứ tự món rồi phần.
  - 2 repeat phần trong cùng món, dài khác nhau → số phần = max; repeat ngắn hơn rỗng ở phần dư.
  - `$position`/`$total` tuyệt đối trong repeat phần.
  - Template không có repeat phần → kết quả giống hệt trước (không hồi quy).
- **Validate:** 3 lỗi ở mục 2, mỗi lỗi 1 test; template hợp lệ có repeat phần qua được.
- **DSL:** `.maxItemsPerPage()` trên `repeat` lồng ra đúng JSON; `$part`/`$partCount` dùng được trong `var(...)`.
- **Tích hợp:** mẫu tem món với 9 topping ra đúng số tem và nội dung mong đợi qua resolve + layout.
- **Toàn bộ test hiện có** của `printer-core` và `printer-preview` tiếp tục pass.

## Rủi ro & đánh đổi

- **Nhóm topping cố định N không tự co theo độ dài tên.** Tên dài vẫn có thể tràn trong 1 tem — người làm template chọn N phù hợp khổ tem.
- **Số tem tăng.** Đơn nhiều topping tốn thêm tem; đây là hành vi mong muốn (thay cho tem tràn mất thông tin).
- **Ràng buộc repeat trang `maxItemsPerPage = 1`** loại trừ kiểu "nhiều món 1 tem + tách topping". Chưa có nhu cầu thật; nếu cần sẽ là spec riêng.
