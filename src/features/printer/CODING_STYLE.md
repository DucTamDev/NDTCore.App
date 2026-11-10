# Printer Feature — Coding Style

Bổ sung cho [`docs/CODING_STANDARDS_TS.md`](../../../docs/CODING_STANDARDS_TS.md). Chỉ áp dụng cho
`src/features/printer/` và chỗ khác của App gọi package máy in.

---

## 1. Chỉ đi qua package

- Import từ `@ndtcore/printer`, không import file con (`@ndtcore/printer/src/...`) và không gọi `NativeModules`.
- Không dựng lại khái niệm package đã có (`Printer`, `PrinterConfig`, `PaperConfig`, mã lỗi, enum). Dùng thẳng kiểu và
  enum của package: `PrinterKind.Receipt`, không so chuỗi `'Receipt'`.
- Không chép trạng thái máy in vào Redux hay state riêng lâu dài; đọc `getPrinters()`/`status` và `subscribe`.

---

## 2. Hook nhận dịch vụ qua tham số

Hook dùng package nhận dịch vụ làm tham số có mặc định là instance dùng chung, để test truyền bản khác mà không mock
module:

```ts
export const usePrinterList = (manager: PrinterManager = printerManager) => { /* ... */ };
export const useTestPrint = (service: PrintService = printService) => { /* ... */ };
```

---

## 3. Form và lỗi theo trường

- Kiểm tra giá trị là việc của package. Form không lặp lại luật (khoảng, số thập phân); chỉ đổi kiểu rồi gửi.
- Đường dẫn lỗi của package (`paper.widthMm`) đổi sang ô form qua bảng trong `PrinterConfigForm.ts`; lỗi không có ô
  hiện chung.
- Câu lỗi người dùng đọc lấy từ `printerErrorMessageOf(code)` hoặc `fieldMessageOf(reason)`, không hiện `message`
  tiếng Anh của package.

---

## 4. Mẫu in

- Kích thước trong mẫu đi qua `toDp`, không viết số dp cứng.
- Mẫu chỉ trình bày nội dung đơn hàng; không biết máy in, khổ giấy hay ngôn ngữ lệnh.

---

## 5. Đặt tên, đơn vị, comment

- Hàm trả `Promise` có hậu tố `Async` (`printOrderAsync`, `saveAsync`).
- Field vật lý ghi đơn vị trong tên: `widthMm`, `columnGapMm`, `timeoutMs`.
- Field của interface có JSDoc tiếng Việt, dòng trống giữa các field.
- Comment chỉ giải thích WHY (ràng buộc, hành vi không thấy được), 1–3 dòng, không kể lịch sử thay đổi.
- Domain constant của App dùng const-object (`as const`) + type cùng tên, không dùng `enum` của TypeScript.
