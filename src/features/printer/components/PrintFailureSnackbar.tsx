import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Portal, Snackbar } from 'react-native-paper';
import { printQueue, type PrintQueue } from '../printing/PrintQueue';
import type { PrintTaskResult } from '../models/printing/PrintTaskResult';
import { PrintTaskStatus } from '../models/printing/PrintTaskStatus';

/** Lỗi đến trong khoảng này kể từ lỗi đầu của đợt được gộp thành một thông báo, vd bỏ cả hàng tem của một máy. */
export const FAILURE_BATCH_WINDOW_MS = 1000;

const SNACKBAR_DURATION_MS = 6000;

const REPRINT_HINT = 'In lại trong Lịch sử đơn.';

const UNKNOWN_REASON = 'lỗi không rõ';

const reasonOf = (result: PrintTaskResult): string => (result.error?.message ?? UNKNOWN_REASON).replace(/\.$/, '');

const printerLineOf = (failures: PrintTaskResult[]): string => {
  const [first] = failures;
  const { printerName } = first.task;

  if (failures.length === 1) {
    return `${first.task.title} in không thành công trên ${printerName}: ${reasonOf(first)}.`;
  }

  return `Máy ${printerName}: ${failures.length} lệnh in không thành công (${reasonOf(first)}).`;
};

/** Mỗi máy một dòng, dòng cuối nhắc cách in lại. */
export const printFailureNoticeOf = (results: PrintTaskResult[]): string => {
  const byPrinter = new Map<string, PrintTaskResult[]>();

  results.forEach((result) => {
    const failures = byPrinter.get(result.task.printerId) ?? [];
    failures.push(result);
    byPrinter.set(result.task.printerId, failures);
  });

  return [...[...byPrinter.values()].map(printerLineOf), REPRINT_HINT].join('\n');
};

/** Thuộc tính của snackbar lỗi in. */
interface PrintFailureSnackbarProps {
  /** Hàng đợi in cần nghe; mặc định là hàng đợi dùng chung. */
  queue?: PrintQueue;
}

/**
 * Báo lệnh in lỗi cho thu ngân. Đặt ở gốc app vì lệnh in xong sau khi màn hình gọi in có thể đã đóng. Lỗi đến khi đang
 * hiện được giữ lại, hiện ở thông báo kế tiếp.
 */
export const PrintFailureSnackbar: React.FC<PrintFailureSnackbarProps> = ({ queue = printQueue }) => {
  const [notice, setNotice] = useState<string | null>(null);
  const pendingRef = useRef<PrintTaskResult[]>([]);
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
    const unsubscribe = queue.onTaskFinished((result) => {
      if (result.status !== PrintTaskStatus.Failed) return;
      pendingRef.current.push(result);
      if (!isShowingRef.current) scheduleShow();
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [queue, scheduleShow]);

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
