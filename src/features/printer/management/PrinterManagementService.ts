import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';
import type { Printer } from '../models/printer/Printer';
import { printerConnectionService, type PrinterConnectionService } from '../connection/PrinterConnectionService';

/** Thao tác trên máy in đã lưu mà màn hình quản lý gọi: lưu, xoá, bật/tắt. */
export class PrinterManagementService {
  constructor(
    /** Nơi lưu máy in. */
    private readonly repository: PrinterRepository = printerRepository,

    /** Ngắt kết nối trước khi xoá. */
    private readonly connectionService: PrinterConnectionService = printerConnectionService,
  ) {}

  /** Chưa có máy in cùng `id` thì thêm, có rồi thì sửa; sai schema hoặc trùng máy thì ném lỗi của repository. */
  save(printer: Printer): void {
    if (this.repository.findById(printer.id)) {
      this.repository.updatePrinter(printer);
      return;
    }

    this.repository.addPrinter(printer);
  }

  /**
   * Luôn ngắt trước, kể cả khi đang kết nối dở: `disconnect` huỷ cả lượt `connect` đang chạy, nên không còn kết nối
   * mở cho máy đã xoá. Lỗi khi ngắt bỏ qua vì máy vẫn phải bị xoá.
   */
  async remove(printerId: string): Promise<void> {
    await this.connectionService.disconnect(printerId).catch(() => undefined);
    this.repository.removePrinter(printerId);
  }

  /** Tắt thì không nhận lệnh in nữa; kết nối giữ nguyên. */
  setEnabled(printerId: string, enabled: boolean): void {
    this.repository.setEnabled(printerId, enabled);
  }
}

export const printerManagementService = new PrinterManagementService();
