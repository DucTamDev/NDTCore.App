import { createElement, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { printerService } from '../../printing/PrinterService';
import { SampleLabel, SampleReceipt } from '../../components/SamplePrint';
import { PrinterFeatureException } from '../../exceptions';
import { PrintKind } from '../../models/printer/PrintKind';
import type { PrinterLanguage } from '../../models/printer/PrinterLanguage';
import type { PrinterDisplayValues } from '../../forms/addPrinter/PrinterDisplaySchema';
import type { Printer } from '../../models/printer/Printer';
import type { CaptureImage } from '../usePrintImageCapture';

/** Input cho {@link useTestPrint}; `buildDraftPrinter`/`captureImage` do coordinator sở hữu và truyền xuống. */
export interface UseTestPrintInput {
  language?: PrinterLanguage;

  /** Lỗi cấu hình giấy đang nhập; có lỗi thì không in thử. */
  paperError: string | null;

  displayForm: UseFormReturn<PrinterDisplayValues>;
  buildDraftPrinter: () => Printer;
  captureImage: CaptureImage;
}

/** In thử trong luồng Thêm/Sửa máy in: chụp bản in mẫu theo `kind` rồi gọi `PrinterService.testPrint`. */
export const useTestPrint = (input: UseTestPrintInput) => {
  const { language, paperError, displayForm, buildDraftPrinter, captureImage } = input;
  const [testPrintPending, setTestPrintPending] = useState(false);
  const [testPrintErrorMessage, setTestPrintErrorMessage] = useState<string | null>(null);
  const [testPrintRowsText, setTestPrintRowsText] = useState('1');

  const onTestPrint = async (): Promise<void> => {
    if (!language) {
      return;
    }

    if (paperError) {
      setTestPrintErrorMessage(paperError);
      return;
    }

    const printer = buildDraftPrinter();
    const valid = await displayForm.trigger();

    if (!valid) {
      return;
    }

    setTestPrintPending(true);
    setTestPrintErrorMessage(null);
    try {
      const isLabel = printer.kind === PrintKind.Label;
      const sample = isLabel ? createElement(SampleLabel, { paper: printer.paper }) : createElement(SampleReceipt);
      const image = await captureImage(sample, printer.paper);

      if (!image) {
        setTestPrintErrorMessage('Không chụp được bản in thử');
        return;
      }

      const options = isLabel ? { copies: Number(testPrintRowsText) } : undefined;
      await printerService.testPrint(printer, image, options);
    } catch (error) {
      setTestPrintErrorMessage(error instanceof PrinterFeatureException ? error.message : 'In thử thất bại');
    } finally {
      setTestPrintPending(false);
    }
  };

  const clearTestPrintError = (): void => setTestPrintErrorMessage(null);

  return {
    testPrintPending,
    testPrintErrorMessage,
    setTestPrintErrorMessage,
    testPrintRowsText,
    setTestPrintRowsText,
    onTestPrint,
    clearTestPrintError,
  };
};
