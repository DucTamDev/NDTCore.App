import { useEffect } from 'react';
import { printerConfigService } from '../../management/PrinterConfigService';
import { toPaperOptions, type PaperForm } from '../../forms/addPrinter/PaperFormSchema';

export interface UsePrintSettingsInput {
  printerId: string;

  /** Form giấy của luồng Thêm/Sửa máy in. */
  paperForm: PaperForm;
}

/**
 * Máy in đã lưu thì ghi giấy ngay mỗi khi form giấy đổi và hợp lệ; bản nháp chưa lưu thì `PrinterConfigService` bỏ
 * qua, giấy được lưu lúc bấm Lưu.
 */
export const usePrintSettings = ({ printerId, paperForm }: UsePrintSettingsInput): void => {
  useEffect(() => {
    const subscription = paperForm.watch(() => {
      const paper = toPaperOptions(paperForm.getValues());

      if (paper) {
        printerConfigService.setPaper(printerId, paper);
      }
    });

    return () => subscription.unsubscribe();
  }, [paperForm, printerId]);
};
