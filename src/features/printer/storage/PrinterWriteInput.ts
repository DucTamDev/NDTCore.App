import type { Printer } from '../models/printer/Printer';

/** Input để tạo/sửa 1 printer — giống Printer nhưng deviceId là GIÁ TRỊ ĐỀ XUẤT, PrinterRepository tự tính lại (không tin caller). */
export type PrinterWriteInput = Omit<Printer, 'deviceId'> & { deviceId?: string };
