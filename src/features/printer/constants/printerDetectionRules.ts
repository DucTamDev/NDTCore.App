// src/features/printer/constants/printerDetectionRules.ts
import type { Protocol } from '../types/printer.types';

/**
 * Luật nhận diện thiết bị: cho ra danh sách candidate driver theo thứ tự ưu
 * tiên để `discoverProtocol()` thử — KHÔNG phải kết luận protocol cuối cùng.
 * Xác nhận thật luôn phải qua `IPrinterDriver.identify()` của driver tương ứng.
 */
export interface PrinterDetectionRule {
  vendorMatch: RegExp;
  modelMatch?: RegExp;
  candidates: Protocol[];
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

export const PRINTER_DETECTION_RULES: PrinterDetectionRule[] = [
  // ===== ESC/POS — Receipt Printer (độ ưu tiên rất cao, ~90% cửa hàng) =====
  {
    vendorMatch: /epson/i,
    modelMatch: /TM-?(T82III|T82|T20|M30)/i,
    candidates: ['escpos'],
    confidence: 'high',
    note: 'Epson TM series — chuẩn ESC/POS gốc',
  },
  {
    vendorMatch: /xprinter/i,
    modelMatch: /XP-?(58|80|Q200|Q260)/i,
    candidates: ['escpos'],
    confidence: 'high',
    note: 'Dòng receipt Xprinter — KHÁC dòng label bên dưới, bắt buộc match model để phân biệt',
  },
  {
    vendorMatch: /goojprt/i,
    modelMatch: /GP-?(58|80)/i,
    candidates: ['escpos'],
    confidence: 'high',
  },
  {
    vendorMatch: /zjiang/i,
    modelMatch: /ZJ-?(58|80|5890)/i,
    candidates: ['escpos'],
    confidence: 'high',
  },
  {
    vendorMatch: /rongta/i,
    modelMatch: /RP(80|58)/i,
    candidates: ['escpos'],
    confidence: 'high',
  },
  {
    vendorMatch: /itp/i,
    modelMatch: /iTP-?(76|80|85|86|9)\b/i,
    candidates: ['escpos'],
    confidence: 'medium',
    note: 'Dòng máy in hóa đơn nhiệt iTP (iTP76/iTP80/iTP85/iTP86/iTP9) — chưa verify deviceInfo thật, tạm confidence=medium',
  },

  // ===== TSPL — Label Printer (độ ưu tiên cao) =====
  {
    vendorMatch: /xprinter/i,
    modelMatch: /XP-?(360B|370B|420B|450B)/i,
    candidates: ['tspl'],
    confidence: 'high',
    note: 'Dòng label Xprinter — KHÔNG gồm 365B (xem rule dual bên dưới)',
  },
  {
    vendorMatch: /gprinter/i,
    modelMatch: /GP-?(1424D|2120TU|3120TU)/i,
    candidates: ['tspl'],
    confidence: 'high',
  },
  {
    vendorMatch: /hprt/i,
    modelMatch: /(HT300|HT330|N31|N41)/i,
    candidates: ['tspl'],
    confidence: 'medium',
    note: 'Chưa verify riêng từng model HPRT với deviceInfo thật, tạm confidence=medium',
  },
  {
    vendorMatch: /tsc/i,
    modelMatch: /(TE200|TE210|TTP-?244|DA210)/i,
    candidates: ['tspl'],
    confidence: 'high',
    note: 'TSC TTP-244 xác nhận dùng TSPL-EZ (đã verify). TE/DA series theo thông lệ hãng cũng TSPL',
  },
  {
    vendorMatch: /itp/i,
    modelMatch: /iTP-?(3300|3350)\b/i,
    candidates: ['tspl'],
    confidence: 'medium',
    note: 'Dòng máy in tem iTP (iTP3300/iTP3350), tương thích TSPL/TSC — chưa verify deviceInfo thật, tạm confidence=medium',
  },

  // ===== DUAL-MODE — match được vendor/model nhưng KHÔNG được suy đoán 1 protocol =====
  {
    vendorMatch: /xprinter/i,
    modelMatch: /365B/i,
    candidates: ['tspl', 'escpos'],
    confidence: 'low',
    note:
      'XP-365B hỗ trợ CẢ TSPL và ESC/POS emulation, có cả print mode Label lẫn Receipt trên cùng máy. ' +
      'confidence=low bắt buộc để discoverProtocol() KHÔNG tự chọn — phải rơi vào unknown_protocol ' +
      'và hỏi người dùng xác nhận Printer Language dù đã match được vendor/model.',
  },

  // ===== KHÔNG đưa Sunmi/iMin vào bảng regex vendor/model này =====
  // Đây là POS tích hợp sẵn máy in (built-in), truy cập qua SDK/AIDL riêng của
  // hãng (SunmiPrinterService, iMin SDK...), KHÔNG kết nối qua USB/Bluetooth/LAN
  // nên không bao giờ đi qua discoverProtocol() dựa trên bảng regex này.
  // Ngoài phạm vi implementation này — xem spec mục 2 và mục 8.

  // TODO: bổ sung thêm rule khi có deviceInfo thật từ thiết bị test (đặc biệt cần
  // xác nhận format vendor/model string mà identify() thực sự trả về).

  // Luật fallback bắt-tất-cả — LUÔN đặt cuối danh sách.
  { vendorMatch: /.*/, candidates: ['escpos', 'tspl'], confidence: 'low' },
];
