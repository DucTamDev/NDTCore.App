# Print Template Pipeline — Kiến trúc tổng quan

## Mục tiêu

Đưa luồng **build template → in** của `packages/printer-core` lên chuẩn production của POS thương mại (Fabi, KiotViet): template dùng chung giữa nhiều cửa hàng và nhiều loại máy in, lưu được trên BE, in tiếng Việt đúng, cỡ chữ nhất quán, preview khớp bản in.

Doc này chốt khung kiến trúc và cách chia việc. Chi tiết từng phần nằm ở các sub-spec.

## Nguyên tắc

1. **Template là common và độc lập thiết bị.** Template không biết ngôn ngữ máy in, không biết DPI, không biết font firmware.
2. **Template chỉ lưu cấu trúc + placeholder.** Không chứa data, không chứa ảnh, không chứa function. Serialize được thành JSON.
3. **Template không biết cấu trúc data nội bộ.** Template tham chiếu **tên biến** trong 1 catalog. Catalog do app định nghĩa, là cầu nối duy nhất tới data.
4. **Element là semantic.** `PrintElement` chỉ mang ý định (cỡ chữ bao nhiêu dots, căn lề...), không mang giá trị native của máy in.
5. **Chỉ Compiler biết capability của máy in.** Việc máy in không làm được thì Compiler báo qua kênh `warnings`, không âm thầm bỏ qua.
6. **Preview chạy đúng pipeline in thật**, cùng `PrintTarget`, chỉ khác bước xuất cuối (SVG thay vì byte).

## Pipeline

```
[0] TemplateDocument (JSON, schemaVersion)       dev viết qua DSL ở FE; về sau lưu BE — cùng 1 format
        │ parseTemplate: validate cấu trúc + migrate version
        │ validateTemplateAgainstCatalog: biến dùng đúng catalog + đúng scope
[1] Catalog (app định nghĩa theo loại nội dung)    tên biến → hàm get() lấy từ data nội bộ
        │
[2] Resolve: gọi catalog, format, ẩn/hiện, lặp/expand/phân trang, tra asset
        │ ResolvedNode — giá trị đã thành chuỗi, kích thước vẫn là Length (mm|pt|px)
[3] Layout theo PrintTarget: đổi Length → dots theo DPI, đo chữ bằng TextMeasurer khớp chế độ render
        │ PrintElement[] — semantic, đơn vị dots
[4] Compile theo PrintTarget: text theo textMode, FontMetrics riêng từng ngôn ngữ
        │ { output, warnings }
[5] In (app): queue, retry, báo lỗi cho thu ngân
```

## Các quyết định chính

| Chủ đề | Quyết định | Sub-spec |
|---|---|---|
| Format template | `TemplateDocument` JSON có `schemaVersion`, `parseTemplate` + chuỗi migrate. DSL chỉ là công cụ sinh JSON | A |
| Đơn vị | Khổ giấy: mm cố định. Mọi độ dài khác: `Length { value, unit: 'mm' \| 'pt' \| 'px' }`, không có đơn vị `dot` | A |
| Binding | Catalog biến có tên theo loại nội dung. Template tham chiếu `{ var: 'tableName' }`, không dùng path trỏ vào data | A |
| Nội dung động | Mảng segment `{ text }` / `{ var, format }`, dùng chung cho text, barcode, QR | A |
| Ảnh | Template/data chỉ lưu mã asset; app tải + decode, core tra `AssetProvider` đồng bộ | A |
| Chế độ tiếng Việt | Cấu hình theo **máy in**: `ascii` (không dấu, native) / `native` (có dấu, font máy in) / `raster` (có dấu, vẽ bitmap). Mặc định máy mới: `raster` | B |
| Raster | `TextRasterizer` là interface trong core, app inject implementation (Skia trên RN, canvas trên web). Barcode/QR/line/box luôn native | B |
| Đo chữ khi layout | `TextMeasurer` khớp chế độ render của máy đích (font TTF thật khi raster, bảng font native khi ascii/native) | B |
| Element semantic | `TextOptions` chỉ còn `fontSize` (dots), bỏ `font`/`size`/`xScale`/`yScale`. Mỗi ngôn ngữ có `{Lang}FontMetrics.ts` riêng | C |
| Cảnh báo | `PrintCompiler.compile()` trả `{ output, warnings }` | C |

## Sub-spec và thứ tự triển khai

| Sub-spec | Nội dung | File | Phụ thuộc |
|---|---|---|---|
| **A** | Template model: đơn vị, segment, format, điều kiện, catalog, node, asset, validate/migrate | `2026-09-24-template-model-design.md` | — |
| **C** | Semantic element + compiler warnings | `2026-09-23-printer-core-semantic-element-design.md` | — |
| **B** | `PrintTarget`, chế độ tiếng Việt, `TextRasterizer`, `TextMeasurer` | chưa viết | C (raster cần `fontSize` dạng dots) |
| **D** | Tích hợp app: catalog thật (hoá đơn, phiếu bếp, tem món), queue/retry/báo lỗi | chưa viết | A, B, C |

Thứ tự đề xuất: **A → C → B → D**. A và C độc lập nhau, có thể làm song song nếu cần.

## Các điểm còn mở (ngoài phạm vi A-D hiện tại)

- **Bảng món trên hoá đơn** (tên | SL | đơn giá | thành tiền, tên món tự xuống dòng). Hướng đề xuất: tổng quát hoá row layout của `LayoutEngine` (cột fixed/fill, wrap trong cột), không thêm node `table`. Cần 1 sub-spec layout riêng.
- **Designer UI** cho admin sửa template.
- **API BE** lưu template + asset, đồng bộ về app.
