# printer-core Restructure — Kiến trúc tổng

Tái cấu trúc `packages/printer-core` cho gọn, rõ trách nhiệm (SOLID), dễ đọc. Chia 5 đợt, mỗi đợt có spec → plan → branch → merge riêng; test phải xanh sau mỗi đợt.

## Bối cảnh

- Khoảng 15.900 dòng code (không tính test), trong đó `language/` chiếm 7.100 dòng.
- **Chỉ 2 ngôn ngữ được dùng thật.** Package hỗ trợ 9 ngôn ngữ máy in (port từ portakal), nhưng app chỉ dùng TSPL (tem) và ESC/POS (hoá đơn).
- **112 file export nhiều khái niệm cùng lúc.** VD `layout/LayoutNode.ts` 13 export, `resolution/ResolveContext.ts` 10.
- **Còn code chết:** `receipt/`, `PrintDocument`, vài helper định dạng và helper test không ai dùng.
- **2 registry cùng nối dây ngôn ngữ:**
  - `core/LanguageRegistry` và `convert/ConversionRegistry`, mỗi cái trả kết quả parse theo một kiểu.
  - `core/` import implementation cụ thể, là gốc của các vòng import phải né.
- **Preview lặp code.** Preview của từng ngôn ngữ lặp phần khung SVG, riêng hàm `escapeXml` có 7 bản.
- **`TsplParser.ts` quá dài:** 1.544 dòng.

## Các đợt

| Đợt | Nội dung | Phụ thuộc |
|---|---|---|
| **R1. Dọn dẹp** | Xoá 7 ngôn ngữ, chỉ giữ TSPL + ESC/POS; xoá code chết; `testing/` không export ra ngoài; README đúng hiện trạng; comment tiếng Anh/kể lịch sử → tiếng Việt chỉ WHY | — |
| **R2. Registry + core** | 1 registry duy nhất cho dispatch + convert; kết quả parse chung (`commands`, `elements`, kích thước, `warnings`); registry/dispatch rời khỏi `core/` để `core/` chỉ còn contract | R1 |
| **R3. Preview** | Phần khung SVG, escape, vẽ hình dùng chung giữa preview TSPL và ESC/POS; mỗi ngôn ngữ chỉ khai báo phần khác biệt | R1 |
| **R4. Tách parser** | `TsplParser` tách theo nhóm lệnh (thiết lập, chữ, hình, barcode) + dựng element; `EscPosParser` tách cùng cách nếu hợp | R1 |
| **R5. Tách file theo khái niệm** | Áp quy tắc "1 file = 1 khái niệm" cho phần còn lại; sắp thư mục con khi cần; bỏ `export` ở hàm chỉ dùng trong file | R2, R3, R4 |

R2, R3, R4 độc lập với nhau, làm theo thứ tự trên. Code mới viết ở R2–R4 theo quy tắc của R5 ngay từ đầu.

## Quy tắc chung (mọi đợt)

- **Quy ước code:** 11 điểm của `2026-09-24-print-template-pipeline-overview.md`.
- **Test giữ nguyên như hiện tại** (vị trí trong `__tests__/` cạnh file nguồn, nội dung):
  - Chỉ sửa đường import khi file nguồn bị tách hoặc chuyển.
  - Chỉ sửa kỳ vọng khi API đổi có chủ đích (R2).
  - Test của code bị xoá thì xoá theo.
- **Không đổi hành vi in** của TSPL và ESC/POS: cùng document → cùng lệnh máy in và cùng cảnh báo như trước.
- **`printer-preview` phải còn chạy được** (type-check + Vitest xanh). App (`src/`) không dùng `printer-core` nên không bị ảnh hưởng.

### Quy tắc "1 file = 1 khái niệm"

- **Mặc định:** mỗi type/interface/class chính có file riêng, tên file = tên export chính.
- **Được giữ chung 1 file** (ghi rõ ngoại lệ):
  1. Union type cùng các thành viên nhỏ chỉ dùng cho nó.
  2. Bộ hàm helper cùng loại, cùng kiểu trả về. VD `eq`/`gt`/`and`… trong `conditions.ts`, `mm`/`pt`/`px` trong `lengths.ts`.
  3. Bảng hằng số lệnh của 1 ngôn ngữ (`TsplCommand.ts`, `EscPosCommand.ts`).
- **Hàm tiện ích khác chủ đề** với khái niệm chính của file thì tách ra file riêng.
