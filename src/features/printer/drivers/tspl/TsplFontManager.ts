// src/features/printer/drivers/tspl/TsplFontManager.ts
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { AppErrorException } from '../../types/AppError';
import type { TsplFontConfig } from '../../types/printer.types';
import type { TsplTransport } from './TsplDriver';

/** Font mặc định bundle sẵn trong app — chỉ 1 font ở phase này, xem spec §4/§10. */
export const DEFAULT_TSPL_FONT: TsplFontConfig = {
  name: 'VIETFONT',
  fileName: 'NotoSans-Regular.ttf',
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
  async ensureFontInstalled(transport: TsplTransport, font: TsplFontConfig): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new AppErrorException({ code: 'UNSUPPORTED_CONNECTION', message: 'Cài font TrueType chỉ hỗ trợ trên Android' });
    }

    let base64: string;
    try {
      base64 = await RNFS.readFileAssets(`fonts/${font.fileName}`, 'base64');
    } catch {
      throw new AppErrorException({ code: 'VALIDATION_ERROR', message: `Không đọc được file font "${font.fileName}" từ assets` });
    }

    const fontBytes = Buffer.from(base64, 'base64');
    const header = Buffer.from(`DOWNLOAD "${font.name}",${fontBytes.length}\r\n`, 'utf8');
    const footer = Buffer.from('\r\n', 'utf8');
    const payload = new Uint8Array(Buffer.concat([header, fontBytes, footer]));

    try {
      await transport.write(payload);
    } catch (error) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }
}
