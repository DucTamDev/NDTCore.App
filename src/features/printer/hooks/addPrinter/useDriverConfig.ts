import { useState, type Dispatch, type SetStateAction } from 'react';
import { PrinterConfigService } from '../../services/PrinterConfigService';
import { DEFAULT_TSPL_FONT } from '../../drivers/tspl/TsplFontManager';
import { DEFAULT_TSPL_INTERNAL_FONT } from '../../drivers/driverConfig';
import { PrinterErrorException } from '../../errors/PrinterError';
import { PrinterDriverType, PrintMediaType, TsplRenderMode } from '../../types/printer.types';
import type { PrintMedia, PrinterDriver, TsplDriverConfig, TsplInternalFontConfig } from '../../types/printer.types';
import type { PrintType } from '../../models/printing/PrintType';

/**
 * Input cho {@link useDriverConfig}. `drivers`/`setDrivers` do coordinator sở
 * hữu; `setTestPrintErrorMessage` từ {@link useTestPrint} — nhánh cài font
 * TrueType thất bại hiển thị lỗi qua đúng chỗ đó (giữ nguyên hành vi cũ).
 */
export interface UseDriverConfigInput {
  printerId: string;
  drivers: PrinterDriver[];
  setDrivers: Dispatch<SetStateAction<PrinterDriver[]>>;
  setTestPrintErrorMessage: (message: string | null) => void;
}

/**
 * Chỉnh cấu hình driver sau khi đã thêm vào danh sách: bật/tắt content type,
 * chế độ render TSPL (bitmap / truetype / internalfont), khổ giấy / media,
 * font nội bộ TSPL. Mọi thay đổi persist đối xứng qua `PrinterConfigService`.
 */
export const useDriverConfig = ({ printerId, drivers, setDrivers, setTestPrintErrorMessage }: UseDriverConfigInput) => {
  const [tsplFontPending, setTsplFontPending] = useState(false);

  const onToggleContentType = (type: PrinterDriverType, contentType: PrintType, value: boolean): void => {
    setDrivers((prev) =>
      prev.map((d) => {
        if (d.type !== type) return d;
        const contentTypes = value ? [...d.contentTypes, contentType] : d.contentTypes.filter((ct) => ct !== contentType);
        return { ...d, contentTypes };
      }),
    );
  };

  const updateTsplConfig = (fn: (config: TsplDriverConfig) => TsplDriverConfig): void => {
    setDrivers((prev) =>
      prev.map((d) =>
        d.type === PrinterDriverType.tspl && d.config.type === PrinterDriverType.tspl ? { ...d, config: fn(d.config) } : d,
      ),
    );
  };

  /**
   * Chọn chế độ render TSPL (`bitmap` / `truetype` / `internalfont`). `truetype`
   * kéo theo bước cài font (`installTsplFont`) — thất bại thì KHÔNG đổi
   * renderMode (spec §6/§7). `bitmap`/`internalfont` chỉ set config. Mọi nhánh
   * persist đối xứng qua `PrinterConfigService` — no-op nếu là draft chưa lưu, `Save`
   * lo phần đó.
   */
  const onSelectTsplRenderMode = async (mode: TsplRenderMode): Promise<void> => {
    const tsplDriverEntry = drivers.find((d) => d.type === PrinterDriverType.tspl);
    if (!tsplDriverEntry || tsplDriverEntry.config.type !== PrinterDriverType.tspl) return;

    if (mode === TsplRenderMode.truetype) {
      const font = tsplDriverEntry.config.font ?? DEFAULT_TSPL_FONT;
      setTsplFontPending(true);
      try {
        await PrinterConfigService.installTsplFont(printerId, font);
        updateTsplConfig((config) => ({ ...config, renderMode: TsplRenderMode.truetype, font: { ...font, fontInstalled: true } }));
      } catch (error) {
        setTestPrintErrorMessage(error instanceof PrinterErrorException ? error.message : 'Cài font TrueType thất bại — vẫn dùng chế độ Bitmap');
      } finally {
        setTsplFontPending(false);
      }
      return;
    }

    if (mode === TsplRenderMode.internalfont) {
      const internalFont = tsplDriverEntry.config.internalFont ?? DEFAULT_TSPL_INTERNAL_FONT;
      updateTsplConfig((config) => ({ ...config, renderMode: TsplRenderMode.internalfont, internalFont }));
      PrinterConfigService.setTsplInternalFont(printerId, internalFont);
      return;
    }

    updateTsplConfig((config) => ({ ...config, renderMode: TsplRenderMode.bitmap }));
    PrinterConfigService.setTsplRenderMode(printerId, TsplRenderMode.bitmap);
  };

  const onChangeDriverMedia = (driverType: PrinterDriverType, patch: Partial<PrintMedia>): void => {
    const entry = drivers.find((d) => d.type === driverType);
    if (!entry) return;
    let media = { ...entry.config.media, ...patch } as PrintMedia;
    if (media.type === PrintMediaType.dieCut) {
      media = { itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3, ...media };
    }
    setDrivers((prev) => prev.map((d) => (d.type === driverType ? { ...d, config: { ...d.config, media } } : d)));
    // Persist media ĐÃ MERGE (kể cả die_cut auto-fill), không phải raw patch:
    // với printer đang SỬA, `setDriverMedia` ghi thật ngay → raw `{ type: 'die_cut' }`
    // sẽ lưu media không hợp lệ nếu user thoát không Save (final-review Important 2).
    PrinterConfigService.setDriverMedia(printerId, driverType, media);
  };

  const onChangeTsplInternalFont = (patch: Partial<TsplInternalFontConfig>): void => {
    const tsplDriverEntry = drivers.find((d) => d.type === PrinterDriverType.tspl);
    if (!tsplDriverEntry || tsplDriverEntry.config.type !== PrinterDriverType.tspl) return;
    const next = { ...(tsplDriverEntry.config.internalFont ?? DEFAULT_TSPL_INTERNAL_FONT), ...patch };
    updateTsplConfig((config) => ({ ...config, internalFont: next }));
    PrinterConfigService.setTsplInternalFont(printerId, next);
  };

  return {
    tsplFontPending,
    onToggleContentType,
    onSelectTsplRenderMode,
    onChangeDriverMedia,
    onChangeTsplInternalFont,
  };
};
