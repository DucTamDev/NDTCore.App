import { formatCurrency } from '../../../utils/formatCurrency';
import type { PrintDocument, PrintElement } from '../types/printDocument.types';

/**
 * `document` cho "In bill thử"/"In tem thử" (`AddPrinterModal`, `PrinterInfoCard`) — trước đây
 * cả 2 nút chỉ in 1 chuỗi cố định xác nhận máy in hoạt động, không phản ánh layout/nội dung
 * bill/tem thật. Xây theo đúng cấu trúc `PrintElement` mà `buildBillElements`
 * (`features/cart/services/OrderPrintTrigger.ts`) dùng cho bill thật, với dữ liệu ví dụ cố định
 * — không đọc `OrderPrintTrigger` trực tiếp (đơn hàng/cart là data-owning feature ở tầng trên,
 * `printer` không phụ thuộc ngược lại nó) nên layout ở đây độc lập, chỉ cố tình khớp hình dạng.
 * Chỉ dùng `text`/`line`/`row` — 2 loại phần tử duy nhất cả `ThermalReceiptDriver` lẫn
 * `TsplDriver` đều mã hoá được, vì `PrintType` (Bill/Label) độc lập với `Protocol`
 * (ESC/POS/TSPL): 1 máy in ESC/POS vẫn có thể được gán in Label và ngược lại.
 */

/**
 * `Omit<PrintElement, 'x' | 'y'>` không dùng được trực tiếp — `PrintElement`
 * là union, `Omit` chỉ giữ lại field CHUNG giữa mọi nhánh (chỉ `type`), làm
 * mất hết `content`/`left`/`right`/... riêng của từng loại. Distribute qua
 * từng nhánh (`T extends unknown ? ... : never`) để giữ đúng field riêng
 * (cùng kỹ thuật với `PositionlessElement` ở `OrderPrintTrigger.ts`).
 */
type PositionlessElement<T> = T extends unknown ? Omit<T, 'x' | 'y'> : never;

const buildElements = (rows: PositionlessElement<PrintElement>[]): PrintElement[] =>
  rows.map((element, i) => ({ ...element, x: 0, y: i * 20 }) as PrintElement);

const formatSampleDateTime = (): string =>
  new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const buildSampleReceiptDocument = (): PrintDocument => ({
  elements: buildElements([
    { type: 'text', content: 'NDTCore Coffee - Chi nhánh Quận 1' },
    { type: 'text', content: '123 Nguyễn Huệ, Quận 1, TP.HCM' },
    { type: 'line' },
    { type: 'row', left: 'Mã đơn', right: '#DEMO001 (In thử)' },
    { type: 'row', left: 'Thời gian', right: formatSampleDateTime() },
    { type: 'row', left: 'Hình thức', right: 'Tại quán' },
    { type: 'line' },
    { type: 'text', content: 'SẢN PHẨM' },
    { type: 'row', left: '2x Cà phê sữa đá', right: formatCurrency(2 * 29000) },
    { type: 'text', content: '  Ghi chú: Ít đá' },
    { type: 'row', left: '1x Bánh mì thịt', right: formatCurrency(35000) },
    { type: 'row', left: '1x Trà đào cam sả', right: formatCurrency(45000) },
    { type: 'line' },
    { type: 'row', left: 'Tổng số lượng', right: '4' },
    { type: 'row', left: 'Tạm tính', right: formatCurrency(138000) },
    { type: 'row', left: 'Giảm giá', right: `-${formatCurrency(8000)}` },
    { type: 'line' },
    { type: 'row', left: 'TỔNG THANH TOÁN', right: formatCurrency(130000) },
    { type: 'row', left: 'Phương thức', right: 'Tiền mặt' },
    { type: 'row', left: 'Số tiền nhận', right: formatCurrency(150000) },
    { type: 'row', left: 'Tiền thừa', right: formatCurrency(20000) },
    { type: 'line' },
    { type: 'text', content: 'Cảm ơn quý khách! Hẹn gặp lại lần sau' },
  ]),
});

/**
 * Tem (nhãn sản phẩm) khổ giấy rời thường chỉ cao ~30mm — khác hẳn bill/hoá
 * đơn (giấy cuộn dài). Layout đầy đủ kiểu bill (nhiều `row`/`line`) render
 * thành ảnh sẽ cao hơn khổ giấy thật, tràn qua ranh giới tem kế tiếp và in
 * hỏng (lệch/đen ở cuối tem) — xem `PAPER_IMAGE_WIDTH_PX`/`TsplEncoder.initialize()`
 * (khai báo `SIZE ..., 30 mm`). Tem mẫu vì vậy chỉ in tên sản phẩm — đúng
 * mục đích thật của 1 tem dán (dán lên món để nhận diện), không phải bản
 * rút gọn của bill.
 */
export const buildSampleLabelDocument = (): PrintDocument => ({
  elements: buildElements([{ type: 'text', content: 'Trà sữa trân châu' }]),
});
