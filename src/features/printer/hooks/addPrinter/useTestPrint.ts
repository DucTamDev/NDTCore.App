import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { PrinterConnectionService } from '../../services/PrinterConnectionService';
import { buildSampleReceiptDocument, buildSampleLabelDocument } from '../../utils/sampleDocuments';
import { mediaOf, tsplRenderModeOf } from '../../drivers/driverConfig';
import { PrinterErrorException } from '../../errors/PrinterError';
import type { PrintDocuments } from '../../drivers/IPrinterDriver';
import type { PrintDocument } from '../../models/printing/PrintDocument';
import { PrintType } from '../../models/printing/PrintType';
import { TsplRenderMode } from '../../types/printer.types';
import type { Printer, PrinterDriver } from '../../types/printer.types';
import type { PrinterDisplayValues } from '../../schemas/printerFormSchema';
import type { UseBillImageCapture } from '../useBillImageCapture';

/**
 * Input cho {@link useTestPrint}. `buildDraftPrinter`/`captureBillImage` do
 * coordinator sở hữu và truyền xuống.
 */
export interface UseTestPrintInput {
  drivers: PrinterDriver[];
  displayForm: UseFormReturn<PrinterDisplayValues>;
  buildDraftPrinter: () => Printer;
  captureBillImage: UseBillImageCapture['captureBillImage'];
}

/**
 * In thử (hoá đơn / tem) trong luồng Thêm/Sửa máy in: dựng document mẫu, ở chế
 * độ TSPL bitmap thì chụp ảnh bill trước khi gửi, rồi gọi
 * `PrinterConnectionService.testPrint` cho driver khớp content type.
 */
export const useTestPrint = ({ drivers, displayForm, buildDraftPrinter, captureBillImage }: UseTestPrintInput) => {
  const [testPrintReceiptPending, setTestPrintReceiptPending] = useState(false);
  const [testPrintLabelPending, setTestPrintLabelPending] = useState(false);
  const [testPrintErrorMessage, setTestPrintErrorMessage] = useState<string | null>(null);
  const [testPrintRowsText, setTestPrintRowsText] = useState('1');

  const resolveTestPrintDocuments = async (driver: PrinterDriver, document: PrintDocument): Promise<PrintDocuments> => {
    if (tsplRenderModeOf(driver) !== TsplRenderMode.bitmap) return { text: document };
    const base64 = await captureBillImage(document, mediaOf(driver));
    if (!base64) return { text: document };
    return { text: document, image: base64 };
  };

  const runTestPrint = async (
    setPending: (pending: boolean) => void,
    printType: PrintType,
    sampleDocument: PrintDocument,
  ): Promise<void> => {
    const driver = drivers.find((d) => d.contentTypes.includes(printType));
    if (!driver) return;
    const printer = buildDraftPrinter();
    const valid = await displayForm.trigger();
    if (!valid) return;
    setPending(true);
    setTestPrintErrorMessage(null);
    try {
      const documents = await resolveTestPrintDocuments(driver, sampleDocument);
      const options = printType === PrintType.Label ? { rows: Number(testPrintRowsText) } : undefined;
      await PrinterConnectionService.testPrint(printer, driver, documents, printType, options);
    } catch (error) {
      setTestPrintErrorMessage(error instanceof PrinterErrorException ? error.message : 'In thử thất bại');
    } finally {
      setPending(false);
    }
  };

  const onTestPrintReceipt = (): Promise<void> => runTestPrint(setTestPrintReceiptPending, PrintType.Receipt, buildSampleReceiptDocument());
  const onTestPrintLabel = (): Promise<void> => runTestPrint(setTestPrintLabelPending, PrintType.Label, buildSampleLabelDocument());

  const clearTestPrintError = (): void => setTestPrintErrorMessage(null);

  return {
    testPrintReceiptPending,
    testPrintLabelPending,
    testPrintErrorMessage,
    setTestPrintErrorMessage,
    testPrintRowsText,
    setTestPrintRowsText,
    onTestPrintReceipt,
    onTestPrintLabel,
    clearTestPrintError,
  };
};
