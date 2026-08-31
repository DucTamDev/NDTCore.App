import type { Printer, PrinterDriver, PrintMedia, TsplRenderMode } from '../../../types/printer.types';
import type { PrintDocuments } from '../../../types/driver.types';
import type { PrintType } from '../../../models/printing/PrintType';

/**
 * Input đã resolve đầy đủ cho 1 lần render TSPL. CONFIG-ONLY có chủ đích —
 * KHÔNG chứa connection state / transport / kết quả query máy in. Strategy
 * chỉ kiểm tra configuration invariant (§28, §118, §137, spec §12).
 */
export interface TsplStrategyContext {
  printer: Printer;
  /** `config.type === 'tspl'` — `TsplDriver` narrow trước khi tạo context. */
  driver: PrinterDriver;
  documents: PrintDocuments;
  printType: PrintType;
  /** = `mediaOf(driver)`. Nguồn cho `SIZE`/`GAP`/`SET CUTTER`/layout cột. */
  media: PrintMedia;
  /** Số hàng die-cut cần in (>= 1). Continuous: số bản sao. */
  rows: number;
}

export interface ITsplPrintStrategy {
  readonly mode: TsplRenderMode;
  /** Ném `PrinterErrorException` (TSPL_*) nếu context không đủ điều kiện. KHÔNG trả bool, KHÔNG fallback. */
  validate(context: TsplStrategyContext): void;
  /** Thuần: context → raw TSPL bytes. */
  encode(context: TsplStrategyContext): Uint8Array;
}
