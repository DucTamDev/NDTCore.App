import { PrinterErrorCode } from '@ndtcore/printer';

/** Câu cho người dùng theo mã lỗi của package máy in; package chỉ trả mã. */
const MESSAGES: Record<PrinterErrorCode, string> = {
  [PrinterErrorCode.InputInvalid]: 'Thông tin máy in chưa hợp lệ',
  [PrinterErrorCode.PrinterNotFound]: 'Không tìm thấy máy in, có thể đã bị xoá',
  [PrinterErrorCode.DeviceNotFound]: 'Không thấy máy in, kiểm tra dây cắm hoặc nguồn',
  [PrinterErrorCode.DeviceNotPaired]: 'Máy in Bluetooth chưa được ghép đôi',
  [PrinterErrorCode.PrinterAlreadyExists]: 'Máy in này đã được thêm',
  [PrinterErrorCode.DeviceAlreadyAssigned]: 'Máy này đang dùng cho máy in khác',
  [PrinterErrorCode.DeviceAmbiguous]: 'Có nhiều máy USB giống nhau, hãy chọn lại máy',
  [PrinterErrorCode.DeviceInUse]: 'Máy in đang bận in đơn khác',
  [PrinterErrorCode.PermissionRequired]: 'Cần cấp quyền dùng máy in, bấm Kết nối lại',
  [PrinterErrorCode.PermissionDenied]: 'Chưa được cấp quyền dùng máy in',
  [PrinterErrorCode.BluetoothDisabled]: 'Bluetooth đang tắt',
  [PrinterErrorCode.NetworkUnavailable]: 'Máy bán hàng chưa kết nối mạng',
  [PrinterErrorCode.PrinterNotAssigned]: 'Chưa thiết lập máy in cho loại phiếu này',
  [PrinterErrorCode.ActionUnavailable]: 'Thao tác này không dùng được lúc này',
  [PrinterErrorCode.CaptureHostMissing]: 'Ứng dụng chưa sẵn sàng để in',
  [PrinterErrorCode.PlatformUnsupported]: 'Thiết bị này không hỗ trợ in',
  [PrinterErrorCode.ConnectionFailed]: 'Không kết nối được máy in',
  [PrinterErrorCode.ConnectionTimeout]: 'Máy in không phản hồi',
  [PrinterErrorCode.ConnectionLost]: 'Mất kết nối máy in',
  [PrinterErrorCode.WriteTimeout]: 'Gửi lệnh in quá lâu, máy in không nhận',
  [PrinterErrorCode.RenderFailed]: 'Không dựng được bản in',
  [PrinterErrorCode.TaskSkipped]: 'Bỏ qua vì phần in trước bị lỗi',
  [PrinterErrorCode.PrinterRemoved]: 'Máy in đã bị xoá trước khi in xong',
  [PrinterErrorCode.SetupCancelled]: 'Đã huỷ thêm máy in',
  [PrinterErrorCode.StorageFailed]: 'Không lưu được thông tin máy in',
  [PrinterErrorCode.InternalError]: 'Lỗi không mong muốn khi in',
};

/** Câu tiếng Việt cho người dùng của một mã lỗi máy in. */
export function printerErrorMessageOf(code: PrinterErrorCode): string {
  return MESSAGES[code];
}
