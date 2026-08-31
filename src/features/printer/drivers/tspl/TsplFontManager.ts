import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { PrinterErrorException, PrinterErrorCode } from '../../errors/PrinterError';
import { LoggerService } from '../../../../services/LoggerService';
import type { TsplFontConfig } from '../../types/printer.types';
import type { IPrinterAdapter } from '../../adapters/IPrinterAdapter';

/** Font mặc định bundle sẵn trong app — chỉ 1 font ở phase này, xem spec §4/§10. */
export const DEFAULT_TSPL_FONT: TsplFontConfig = {
  name: 'VIETFONT',
  fileName: 'Roboto-Regular.ttf',
  fontInstalled: false,
};

/**
 * Cài font TrueType lên máy in TSPL qua lệnh `DOWNLOAD` — cú pháp theo tài
 * liệu TSPL2 phổ biến (`DOWNLOAD "<name>",<byteCount>` + byte nhị phân thô
 * theo sau), CHƯA xác nhận trên phần cứng thật (xem spec 2026-08-27 §2).
 *
 * CHỈ chịu trách nhiệm THỰC HIỆN hành động gửi (resolve/throw) — KHÔNG tự
 * quyết định `renderMode`/`fontInstalled` sau khi xong, đó là việc của
 * caller (xem spec §6). Đọc file font qua `react-native-fs` — chỉ hoạt
 * động trên Android (asset ở `android/app/src/main/assets/fonts/`), giống
 * giới hạn USB-chỉ-Android đã có trong module này.
 */
export class TsplFontManager {
  async downloadFont(adapter: IPrinterAdapter, font: TsplFontConfig): Promise<void> {
    LoggerService.debug('downloadFont: bắt đầu', { name: font.name, fileName: font.fileName, adapter: adapter.source });
    if (Platform.OS !== 'android') {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'Cài font TrueType chỉ hỗ trợ trên Android' });
    }

    let base64: string;
    try {
      base64 = await RNFS.readFileAssets(`fonts/${font.fileName}`, 'base64');
    } catch {
      throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_FONT_INVALID, message: `Không đọc được file font "${font.fileName}" từ assets` });
    }

    let payload: Uint8Array;
    try {
      const fontBytes = Buffer.from(base64, 'base64');
      if (fontBytes.length === 0) {
        throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_FONT_INVALID, message: `File font "${font.fileName}" rỗng` });
      }
      const header = Buffer.from(`DOWNLOAD "${font.name}",${fontBytes.length}\r\n`, 'utf8');
      const footer = Buffer.from('\r\n', 'utf8');
      payload = new Uint8Array(Buffer.concat([header, fontBytes, footer]));
      LoggerService.debug('downloadFont: payload đã dựng', {
        headerText: `DOWNLOAD "${font.name}",${fontBytes.length}`,
        fontBytes: fontBytes.length,
        payloadTotal: payload.length,
      });
    } catch (error) {
      if (error instanceof PrinterErrorException) throw error;
      throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_FONT_INVALID, message: `Không đọc được file font "${font.fileName}" từ assets` });
    }

    try {
      await adapter.write(payload);
      LoggerService.debug('downloadFont: adapter.write xong', { payloadTotal: payload.length });
    } catch (error) {
      LoggerService.warning('downloadFont: adapter.write FAIL', { payloadTotal: payload.length, error: error instanceof Error ? error.message : String(error) });
      throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_FONT_INSTALL_FAILED, message: error instanceof Error ? error.message : String(error) });
    }
  }
}
