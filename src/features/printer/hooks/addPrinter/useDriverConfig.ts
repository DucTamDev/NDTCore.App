import { RenderMode, RasterSource } from '../../models/printer/PrinterLanguage';
import type { PrinterLanguage } from '../../models/printer/PrinterLanguage';
import { PaperType } from '../../models/paper/PaperOptions';
import type { PaperOptions } from '../../models/paper/PaperOptions';
import { PrinterConfigService } from '../../management/PrinterConfigService';

export interface UseDriverConfigInput {
  printerId: string;
  language?: PrinterLanguage;
  setLanguage: (language: PrinterLanguage) => void;
  paper: PaperOptions;
  setPaper: (paper: PaperOptions) => void;
}

/**
 * Chỉnh cấu hình in sau khi đã xác định ngôn ngữ: cách render, nguồn ảnh (chỉ khi in ảnh), khổ và loại giấy.
 * Máy in đã lưu thì ghi ngay qua `PrinterConfigService`; bản nháp chưa lưu thì để lúc bấm Lưu.
 */
export const useDriverConfig = ({ printerId, language, setLanguage, paper, setPaper }: UseDriverConfigInput) => {
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

  const onChangePaper = (patch: Partial<PaperOptions>): void => {
    let next = { ...paper, ...patch } as PaperOptions;

    if (next.type === PaperType.DieCut) {
      next = { itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3, ...next };
    }

    setPaper(next);
    PrinterConfigService.setPaper(printerId, next);
  };

  return { onSelectRenderMode, onSelectRasterSource, onChangePaper };
};
