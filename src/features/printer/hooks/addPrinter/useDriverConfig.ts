import { RenderMode, BitmapSource } from '../../models/printer/PrinterDriver';
import type { PrinterDriver } from '../../models/printer/PrinterDriver';
import { PrintPaperType } from '../../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../../models/paper/PrintPaperConfig';
import { PrinterConfigService } from '../../management/PrinterConfigService';

export interface UseDriverConfigInput {
  printerId: string;
  driver?: PrinterDriver;
  setDriver: (driver: PrinterDriver) => void;
  paper: PrintPaperConfig;
  setPaper: (paper: PrintPaperConfig) => void;
}

/**
 * Chỉnh cấu hình sau khi đã có driver: render mode (cả ESC/POS và TSPL đều
 * chọn được), nguồn ảnh bitmap (chỉ có ý nghĩa khi renderMode === Bitmap),
 * khổ giấy/loại giấy. Mọi thay đổi persist đối xứng qua `PrinterConfigService`
 * — no-op nếu là draft chưa lưu, `Save` lo phần đó.
 */
export const useDriverConfig = ({ printerId, driver, setDriver, paper, setPaper }: UseDriverConfigInput) => {
  const onSelectRenderMode = (mode: RenderMode): void => {
    if (!driver) {
      return;
    }

    setDriver({ ...driver, config: { ...driver.config, renderMode: mode } });
    PrinterConfigService.setRenderMode(printerId, mode);
  };

  const onSelectBitmapSource = (bitmapSource: BitmapSource): void => {
    if (!driver) {
      return;
    }

    setDriver({ ...driver, config: { ...driver.config, bitmapSource } });
    PrinterConfigService.setBitmapSource(printerId, bitmapSource);
  };

  const onChangePaper = (patch: Partial<PrintPaperConfig>): void => {
    let next = { ...paper, ...patch } as PrintPaperConfig;

    if (next.type === PrintPaperType.DieCut) {
      next = { itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3, ...next };
    }

    setPaper(next);
    PrinterConfigService.setPaper(printerId, next);
  };

  return { onSelectRenderMode, onSelectBitmapSource, onChangePaper };
};
