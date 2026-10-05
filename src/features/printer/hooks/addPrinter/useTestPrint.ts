import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { printerPrintService } from '../../printing/PrinterPrintService';
import { buildSampleReceiptDocument, buildSampleLabelDocument } from '../../utils/sampleDocuments';
import { PrinterErrorException } from '../../errors/PrinterError';
import type { PrintDocuments } from '../../models/printing/PrintDocuments';
import type { PrintDocument } from '../../models/printing/PrintDocument';
import { PrintKind } from '../../models/printer/PrintKind';
import type { Printer } from '../../models/printer/Printer';
import { RenderMode, type PrinterLanguage } from '../../models/printer/PrinterLanguage';
import type { PrinterDisplayValues } from '../../forms/addPrinter/PrinterDisplaySchema';
import type { UseBillImageCapture } from '../useBillImageCapture';

/**
 * Input cho {@link useTestPrint}. `buildDraftPrinter`/`captureBillImage` do
 * coordinator sở hữu và truyền xuống.
 */
export interface UseTestPrintInput {
  language?: PrinterLanguage;

  /** Lỗi cấu hình giấy đang nhập; có lỗi thì không in thử. */
  paperError: string | null;

  displayForm: UseFormReturn<PrinterDisplayValues>;
  buildDraftPrinter: () => Printer;
  captureBillImage: UseBillImageCapture['captureBillImage'];
}

/**
 * In thử trong luồng Thêm/Sửa máy in: dựng document mẫu theo `kind`
 * cố định, ở chế độ Raster thì chụp ảnh bill trước khi gửi, rồi gọi
 * `PrinterPrintService.testPrint`.
 */
export const useTestPrint = ({ language, paperError, displayForm, buildDraftPrinter, captureBillImage }: UseTestPrintInput) => {
  const [testPrintPending, setTestPrintPending] = useState(false);
  const [testPrintErrorMessage, setTestPrintErrorMessage] = useState<string | null>(null);
  const [testPrintRowsText, setTestPrintRowsText] = useState('1');

  const resolveTestPrintDocuments = async (printer: Printer, document: PrintDocument): Promise<PrintDocuments> => {
    if (!language || language.renderMode !== RenderMode.Raster) {
      return { text: document };
    }

    const base64 = await captureBillImage(document, printer.paper);

    if (!base64) {
      return { text: document };
    }

    return { text: document, image: base64 };
  };

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
      const sampleDocument = printer.kind === PrintKind.Label ? buildSampleLabelDocument() : buildSampleReceiptDocument();
      const documents = await resolveTestPrintDocuments(printer, sampleDocument);
      const options = printer.kind === PrintKind.Label ? { rows: Number(testPrintRowsText) } : undefined;
      await printerPrintService.testPrint(printer, documents, options);
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
