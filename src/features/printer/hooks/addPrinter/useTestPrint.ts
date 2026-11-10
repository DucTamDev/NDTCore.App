import { createElement, useState } from 'react';
import {
  PrinterError,
  PrinterErrorCode,
  PrinterKind,
  printService,
  type Printer,
  type PrintRenderer,
  type PrintService,
} from '@ndtcore/printer';
import { SampleLabel, SampleReceipt } from '../../components/SamplePrint';
import { printerErrorMessageOf } from '../../errors/PrinterErrorMessages';

/** In thử của form thêm, sửa máy in. */
export interface UseTestPrint {
  /** Đang gửi bản in thử. */
  pending: boolean;

  /** Câu lỗi của lần in thử gần nhất. */
  errorMessage: string | null;

  /** Số hàng tem in thử, giữ dạng chữ để nhập dở. */
  rowsText: string;

  /** Đổi số hàng tem. */
  setRowsText: (text: string) => void;

  /** In thử bản (nháp, đã lưu hoặc withConfig) theo cấu hình của chính nó; không lưu gì. */
  testPrintAsync: (printer: Printer) => Promise<void>;

  /** Ẩn câu lỗi. */
  clearError: () => void;
}

/** Số hàng tem hợp lệ; nhập sai thì in một hàng. */
const rowsOf = (text: string): number => {
  const rows = Number(text);
  return Number.isInteger(rows) && rows >= 1 ? rows : 1;
};

/** Mẫu in thử: một hoá đơn, hoặc đủ tem cho số hàng (mỗi hàng `columns` tem). */
const renderersOf = (printer: Printer, rows: number): PrintRenderer[] => {
  if (printer.config.kind === PrinterKind.Receipt) {
    return [() => createElement(SampleReceipt)];
  }

  const labels = rows * (printer.config.paper.columns ?? 1);
  return Array.from({ length: labels }, () => () => createElement(SampleLabel));
};

/** In thử bằng mẫu thật của App qua package. */
export const useTestPrint = (
  service: PrintService = printService,
): UseTestPrint => {
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rowsText, setRowsText] = useState('1');

  const testPrintAsync = async (printer: Printer): Promise<void> => {
    setPending(true);
    setErrorMessage(null);
    try {
      await service.testPrintAsync(
        printer,
        renderersOf(printer, rowsOf(rowsText)),
      );
    } catch (error) {
      const code =
        error instanceof PrinterError
          ? error.code
          : PrinterErrorCode.InternalError;
      setErrorMessage(`In thử thất bại: ${printerErrorMessageOf(code)}`);
    } finally {
      setPending(false);
    }
  };

  return {
    pending,
    errorMessage,
    rowsText,
    setRowsText,
    testPrintAsync,
    clearError: () => setErrorMessage(null),
  };
};
