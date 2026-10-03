import { PrintKind } from '../../models/printer/PrintKind';
import { PrintLanguage } from '../../models/printer/PrinterLanguage';

/** ESC/POS chỉ có lệnh cho giấy cuộn hoá đơn; TSPL in được cả hoá đơn lẫn tem. */
const PRINTABLE_KINDS: Record<PrintLanguage, readonly PrintKind[]> = {
  [PrintLanguage.EscPos]: [PrintKind.Receipt],
  [PrintLanguage.Tspl]: [PrintKind.Receipt, PrintKind.Label],
};

/** Máy in dùng ngôn ngữ này có in được loại nội dung này không. */
export const canPrintKind = (language: PrintLanguage, kind: PrintKind): boolean =>
  PRINTABLE_KINDS[language].includes(kind);
