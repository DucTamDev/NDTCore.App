import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Portal, Snackbar } from 'react-native-paper';
import {
  PrinterErrorCode,
  PrinterKind,
  PrintEventType,
  PrintOutcome,
  printService,
  type PrintService,
  type SubJobResult,
} from '@ndtcore/printer';
import { printerErrorMessageOf } from '../errors/PrinterErrorMessages';

/** Lỗi đến trong khoảng này kể từ lỗi đầu của đợt được gộp thành một thông báo, vd bỏ cả hàng tem của một máy. */
export const FAILURE_BATCH_WINDOW_MS = 1000;

const SNACKBAR_DURATION_MS = 6000;

const REPRINT_HINT = 'In lại trong Lịch sử đơn.';

const UNKNOWN_REASON = 'lỗi không rõ';

const KIND_NAMES: Record<PrinterKind, string> = {
  [PrinterKind.Receipt]: 'Hoá đơn',
  [PrinterKind.Label]: 'Tem',
};

const reasonOf = (result: SubJobResult): string =>
  (result.errorCode ? printerErrorMessageOf(result.errorCode) : UNKNOWN_REASON).replace(/\.$/, '');

const printerLineOf = (failures: SubJobResult[]): string => {
  const [first] = failures;
  const { printerName } = first;

  if (failures.length > 1) {
    return `Máy ${printerName}: ${failures.length} lần in không thành công (${reasonOf(first)}).`;
  }

  // UNCERTAIN: máy có thể đã in một phần, báo khác để thu ngân kiểm tra giấy trước khi in lại.
  const verb = first.outcome === PrintOutcome.Uncertain ? 'có thể chưa in xong' : 'in không thành công';
  return `${KIND_NAMES[first.kind]} ${verb} trên ${printerName}: ${reasonOf(first)}.`;
};

/** Job con cần báo: không in được, trừ phần không có máy in (đã cảnh báo lúc bấm in). */
const needsNotice = (result: SubJobResult): boolean =>
  result.outcome !== PrintOutcome.Printed && result.errorCode !== PrinterErrorCode.PrinterNotAssigned;

/** Mỗi máy một dòng, dòng cuối nhắc cách in lại. */
export const printFailureNoticeOf = (results: SubJobResult[]): string => {
  const byPrinter = new Map<string, SubJobResult[]>();

  results.forEach((result) => {
    const key = result.printerId ?? result.subJobId;
    const failures = byPrinter.get(key) ?? [];
    failures.push(result);
    byPrinter.set(key, failures);
  });

  return [...[...byPrinter.values()].map(printerLineOf), REPRINT_HINT].join('\n');
};

/** Thuộc tính của snackbar lỗi in. */
interface PrintFailureSnackbarProps {
  /** Nguồn sự kiện in; mặc định printService của package. */
  service?: PrintService;
}

/**
 * Báo lệnh in lỗi cho thu ngân. Đặt ở gốc app vì lệnh in xong sau khi màn hình gọi in có thể đã đóng. Lỗi đến khi đang
 * hiện được giữ lại, hiện ở thông báo kế tiếp.
 */
export const PrintFailureSnackbar: React.FC<PrintFailureSnackbarProps> = ({ service = printService }) => {
  const [notice, setNotice] = useState<string | null>(null);
  const pendingRef = useRef<SubJobResult[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isShowingRef = useRef(false);

  const showPending = useCallback(() => {
    timerRef.current = null;

    if (isShowingRef.current || pendingRef.current.length === 0) {
      return;
    }

    isShowingRef.current = true;
    setNotice(printFailureNoticeOf(pendingRef.current));
    pendingRef.current = [];
  }, []);

  const scheduleShow = useCallback(() => {
    if (!timerRef.current) {
      timerRef.current = setTimeout(showPending, FAILURE_BATCH_WINDOW_MS);
    }
  }, [showPending]);

  useEffect(() => {
    const unsubscribe = service.subscribe((event) => {
      if (event.type !== PrintEventType.SubJobFinished || !needsNotice(event.result)) return;
      pendingRef.current.push(event.result);
      if (!isShowingRef.current) scheduleShow();
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [service, scheduleShow]);

  const dismiss = useCallback(() => {
    isShowingRef.current = false;
    setNotice(null);
    if (pendingRef.current.length > 0) scheduleShow();
  }, [scheduleShow]);

  return (
    <Portal>
      <Snackbar visible={notice !== null} onDismiss={dismiss} duration={SNACKBAR_DURATION_MS}>
        {notice}
      </Snackbar>
    </Portal>
  );
};
