import React from 'react';
import { Text } from 'react-native';
import { PaperProvider, Snackbar } from 'react-native-paper';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import {
  PrinterErrorCode,
  PrinterKind,
  PrintEventType,
  PrintOutcome,
  type PrintEventListener,
  type PrintService,
  type SubJobResult,
} from '@ndtcore/printer';
import { FAILURE_BATCH_WINDOW_MS, PrintFailureSnackbar, printFailureNoticeOf } from '../PrintFailureSnackbar';
import { printerErrorMessageOf } from '../../errors/PrinterErrorMessages';

const REPRINT_HINT = 'In lại trong Lịch sử đơn.';

/** Job con kết thúc không in được trên một máy. */
const failure = (
  printerName = 'Tem quầy',
  printerId = 'p1',
  kind: PrinterKind = PrinterKind.Label,
  outcome: PrintOutcome = PrintOutcome.Failed,
  errorCode: SubJobResult['errorCode'] = PrinterErrorCode.ConnectionFailed,
): SubJobResult => ({
  subJobId: `${printerId}-${Math.random()}`,
  kind,
  printerId,
  printerName,
  outcome,
  errorCode,
  printedTasks: 0,
  totalTasks: 1,
  tasks: [],
});

const connectionFailed = printerErrorMessageOf(PrinterErrorCode.ConnectionFailed);

describe('printFailureNoticeOf', () => {
  it('Job con FAILED hiện loại nội dung, tên máy và câu lỗi', () => {
    const notice = printFailureNoticeOf([
      failure('Quầy', 'p1', PrinterKind.Receipt, PrintOutcome.Failed, PrinterErrorCode.ConnectionTimeout),
    ]);
    expect(notice).toBe(
      `Hoá đơn in không thành công trên Quầy: ${printerErrorMessageOf(PrinterErrorCode.ConnectionTimeout)}.\n` +
        REPRINT_HINT,
    );
  });

  it('UNCERTAIN báo có thể chưa in', () => {
    const notice = printFailureNoticeOf([failure('Quầy', 'p1', PrinterKind.Receipt, PrintOutcome.Uncertain)]);
    expect(notice).toBe(`Hoá đơn có thể chưa in xong trên Quầy: ${connectionFailed}.\n${REPRINT_HINT}`);
  });

  it('nhiều Job con cùng máy gộp một dòng theo máy', () => {
    expect(printFailureNoticeOf([failure(), failure(), failure()])).toBe(
      `Máy Tem quầy: 3 lần in không thành công (${connectionFailed}).\n${REPRINT_HINT}`,
    );
  });

  it('hai máy thì mỗi máy một dòng, dòng cuối luôn nhắc in lại', () => {
    const notice = printFailureNoticeOf([failure('Máy quầy', 'p1', PrinterKind.Receipt), failure('Tem quầy', 'p2')]);
    expect(notice.split('\n')).toEqual([
      `Hoá đơn in không thành công trên Máy quầy: ${connectionFailed}.`,
      `Tem in không thành công trên Tem quầy: ${connectionFailed}.`,
      REPRINT_HINT,
    ]);
  });
});

describe('PrintFailureSnackbar', () => {
  let listener: PrintEventListener | undefined;
  const unsubscribe = jest.fn();
  const service = {
    subscribe: jest.fn((next: PrintEventListener) => {
      listener = next;
      return unsubscribe;
    }),
  } as unknown as PrintService;

  const render = (): ReactTestRenderer => {
    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(
        <PaperProvider>
          <PrintFailureSnackbar service={service} />
        </PaperProvider>,
      );
    });
    return renderer as ReactTestRenderer;
  };

  const shownText = (renderer: ReactTestRenderer): string =>
    renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat()
      .filter((child: unknown) => typeof child === 'string')
      .join('|');

  const emit = (result: SubJobResult): void => {
    act(() => listener?.({ type: PrintEventType.SubJobFinished, jobId: 'j1', result }));
  };

  const advance = (ms: number): void => {
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    listener = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('PRINTED không hiện gì', () => {
    const renderer = render();
    emit({ ...failure(), outcome: PrintOutcome.Printed, errorCode: undefined });
    advance(FAILURE_BATCH_WINDOW_MS);

    expect(shownText(renderer)).not.toContain('không thành công');
  });

  it('PRINTER_NOT_ASSIGNED không hiện snackbar', () => {
    const renderer = render();
    const unassigned = { ...failure(), printerId: undefined, printerName: undefined };
    emit({ ...unassigned, errorCode: PrinterErrorCode.PrinterNotAssigned });
    advance(FAILURE_BATCH_WINDOW_MS);

    expect(shownText(renderer)).toBe('');
  });

  it('hai lỗi trong 1 giây gộp thành một thông báo', () => {
    const renderer = render();
    emit(failure());
    advance(500);
    emit(failure());

    expect(shownText(renderer)).not.toContain('lần in không thành công');
    advance(FAILURE_BATCH_WINDOW_MS);

    expect(shownText(renderer)).toContain('Máy Tem quầy: 2 lần in không thành công');
  });

  it('lỗi đến khi đang hiện thì chờ thông báo sau', () => {
    const renderer = render();
    emit(failure('Máy quầy', 'p1', PrinterKind.Receipt));
    advance(FAILURE_BATCH_WINDOW_MS);
    expect(shownText(renderer)).toContain('Hoá đơn in không thành công trên Máy quầy');

    emit(failure('Tem quầy', 'p2'));
    advance(FAILURE_BATCH_WINDOW_MS);
    expect(shownText(renderer)).not.toContain('Tem quầy');

    act(() => renderer.root.findByType(Snackbar).props.onDismiss());
    advance(FAILURE_BATCH_WINDOW_MS);

    expect(shownText(renderer)).toContain('Tem in không thành công trên Tem quầy');
  });

  it('unmount thì huỷ đăng ký', () => {
    const renderer = render();
    act(() => renderer.unmount());

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
