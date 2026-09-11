import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { PrinterPrintService } from '../../printing/PrinterPrintService';
import { buildSampleReceiptDocument, buildSampleLabelDocument } from '../../utils/sampleDocuments';
import { usesBitmapRenderMode } from '../../drivers/driverConfig';
import { PrinterErrorException } from '../../errors/PrinterError';
import type { PrintDocuments } from '../../drivers/IPrinterDriver';
import type { PrintDocument } from '../../models/printing/PrintDocument';
import { PrintType } from '../../models/printing/PrintType';
import type { Printer } from '../../models/printer/Printer';
import type { PrinterDriver } from '../../models/printer/PrinterDriver';
import type { PrinterDisplayValues } from '../../forms/addPrinter/PrinterDisplaySchema';
import type { UseBillImageCapture } from '../useBillImageCapture';

/**
 * Input cho {@link useTestPrint}. `buildDraftPrinter`/`captureBillImage` do
 * coordinator sở hữu và truyền xuống.
 */
export interface UseTestPrintInput {
  driver?: PrinterDriver;
  displayForm: UseFormReturn<PrinterDisplayValues>;
  buildDraftPrinter: () => Printer;
  captureBillImage: UseBillImageCapture['captureBillImage'];
}

/**
 * In thử trong luồng Thêm/Sửa máy in: dựng document mẫu theo `printer.type`
 * cố định, ở chế độ Bitmap thì chụp ảnh bill trước khi gửi, rồi gọi
 * `PrinterPrintService.testPrint`.
 */
export const useTestPrint = ({ driver, displayForm, buildDraftPrinter, captureBillImage }: UseTestPrintInput) => {
  const [testPrintPending, setTestPrintPending] = useState(false);
  const [testPrintErrorMessage, setTestPrintErrorMessage] = useState<string | null>(null);
  const [testPrintRowsText, setTestPrintRowsText] = useState('1');

  const resolveTestPrintDocuments = async (printer: Printer, document: PrintDocument): Promise<PrintDocuments> => {
    if (!driver || !usesBitmapRenderMode(driver)) {
      return { text: document };
    }

    const base64 = await captureBillImage(document, printer.paper);

    if (!base64) {
      return { text: document };
    }

    return { text: document, image: base64 };
  };

  const onTestPrint = async (): Promise<void> => {
    if (!driver) {
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
      const sampleDocument = printer.type === PrintType.Label ? buildSampleLabelDocument() : buildSampleReceiptDocument();
      const documents = await resolveTestPrintDocuments(printer, sampleDocument);
      const options = printer.type === PrintType.Label ? { rows: Number(testPrintRowsText) } : undefined;
      await PrinterPrintService.testPrint(printer, documents, options);
    } catch (error) {
      setTestPrintErrorMessage(error instanceof PrinterErrorException ? error.message : 'In thử thất bại');
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
