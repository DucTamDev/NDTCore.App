import type { Printer } from '../../../models/printer/Printer';
import type { RenderMode } from '../../../models/printer/PrinterDriver';
import type { PrintPaperConfig } from '../../../models/paper/PrintPaperConfig';
import type { PrintDocuments } from '../../IPrinterDriver';
import type { PrintType } from '../../../models/printing/PrintType';

/**
 * Input đã resolve đầy đủ cho 1 lần render TSPL. CONFIG-ONLY có chủ đích —
 * KHÔNG chứa connection state / transport / kết quả query máy in.
 */
export interface TsplStrategyContext {
  printer: Printer;
  documents: PrintDocuments;
  printType: PrintType;
  /** = `printer.paper`. Nguồn cho `SIZE`/`GAP`/`SET CUTTER`/layout cột. */
  paper: PrintPaperConfig;
  /** Số hàng die-cut cần in (>= 1). Continuous: số bản sao. */
  rows: number;
}

export interface ITsplPrintStrategy {
  readonly mode: RenderMode;
  /** Ném `PrinterErrorException` (TSPL_*) nếu context không đủ điều kiện. KHÔNG trả bool, KHÔNG fallback. */
  validate(context: TsplStrategyContext): void;
  /** Thuần: context → raw TSPL bytes. */
  encode(context: TsplStrategyContext): Uint8Array;
}
