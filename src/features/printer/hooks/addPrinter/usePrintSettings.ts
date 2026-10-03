import { RenderMode, RasterSource } from '../../models/printer/PrinterLanguage';
import type { PrinterLanguage } from '../../models/printer/PrinterLanguage';
import { PaperType } from '../../models/paper/PaperOptions';
import { DIE_CUT_DRAFT_DEFAULTS, toPaperOptions, type PaperDraft } from '../../forms/addPrinter/PaperDraft';
import { PrinterConfigService } from '../../management/PrinterConfigService';

export interface UsePrintSettingsInput {
  printerId: string;
  language?: PrinterLanguage;
  setLanguage: (language: PrinterLanguage) => void;
  paper: PaperDraft;
  setPaper: (paper: PaperDraft) => void;
}

/**
 * Chỉnh cấu hình in sau khi đã xác định ngôn ngữ: cách render, nguồn ảnh (chỉ khi in ảnh), khổ và loại giấy.
 * Máy in đã lưu thì ghi ngay qua `PrinterConfigService`; bản nháp chưa lưu thì để lúc bấm Lưu.
 */
export const usePrintSettings = ({ printerId, language, setLanguage, paper, setPaper }: UsePrintSettingsInput) => {
  const onSelectRenderMode = (mode: RenderMode): void => {
    if (!language) {
      return;
    }

    setLanguage({ ...language, renderMode: mode });
    PrinterConfigService.setRenderMode(printerId, mode);
  };

  const onSelectRasterSource = (rasterSource: RasterSource): void => {
    if (!language) {
      return;
    }

    setLanguage({ ...language, rasterSource });
    PrinterConfigService.setRasterSource(printerId, rasterSource);
  };

  /** Giấy tem còn thiếu kích thước thì chỉ cập nhật form, chưa ghi vào máy in đã lưu. */
  const onChangePaper = (patch: Partial<PaperDraft>): void => {
    const merged: PaperDraft = { ...paper, ...patch };
    const next = merged.type === PaperType.DieCut ? { ...DIE_CUT_DRAFT_DEFAULTS, ...merged } : merged;
    const options = toPaperOptions(next);

    setPaper(next);

    if (options) {
      PrinterConfigService.setPaper(printerId, options);
    }
  };

  return { onSelectRenderMode, onSelectRasterSource, onChangePaper };
};
