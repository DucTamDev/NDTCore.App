import React from 'react';
import { Text } from 'react-native';
import { PaperProvider, Snackbar } from 'react-native-paper';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { FAILURE_BATCH_WINDOW_MS, PrintFailureSnackbar, printFailureNoticeOf } from '../PrintFailureSnackbar';
import type { PrintQueue } from '../../printing/PrintQueue';
import { ConnectionType } from '../../models/connections/ConnectionType';
import { PrintKind } from '../../models/printer/PrintKind';
import type { PrintTaskResult } from '../../models/printing/PrintTaskResult';
import { PrintTaskStatus } from '../../models/printing/PrintTaskStatus';
import { DeviceErrorCode } from '../../errors';
import { DeviceErrorException } from '../../exceptions';
import { mockOf } from '../../testing/printerServiceTestKit';

const REPRINT_HINT = 'In lại trong Lịch sử đơn.';

const failure = (
  title: string,
  printerId = 'p1',
  printerName = 'Tem quầy',
  message = 'Không kết nối được',
): PrintTaskResult => ({
  task: {
    id: title,
    printerId,
    printerName,
    deviceId: `lan:${printerId}`,
    connectionType: ConnectionType.Lan,
    kind: PrintKind.Label,
    data: 'png',
    title,
    createdAt: '2026-10-19T00:00:00.000Z',
  },
  status: PrintTaskStatus.Failed,
  error: new DeviceErrorException({ code: DeviceErrorCode.CONNECTION_FAILED, message }),
  startedAt: '2026-10-19T00:00:00.000Z',
  completedAt: '2026-10-19T00:00:01.000Z',
});

describe('printFailureNoticeOf', () => {
  it('một lệnh lỗi: ghi tên lệnh, tên máy và lý do', () => {
    expect(printFailureNoticeOf([failure('Hoá đơn #A1', 'p1', 'Máy quầy')])).toBe(
      `Hoá đơn #A1 in không thành công trên Máy quầy: Không kết nối được.\n${REPRINT_HINT}`,
    );
  });

  it('nhiều lệnh cùng máy gộp một dòng theo máy', () => {
    const results = [failure('Tem #A1 · ly 1/3'), failure('Tem #A1 · ly 2/3'), failure('Tem #A1 · ly 3/3')];
    expect(printFailureNoticeOf(results)).toBe(
      `Máy Tem quầy: 3 lệnh in không thành công (Không kết nối được).\n${REPRINT_HINT}`,
    );
  });

  it('hai máy thì mỗi máy một dòng, dòng cuối luôn nhắc in lại', () => {
    const notice = printFailureNoticeOf([failure('Hoá đơn #A1', 'p1', 'Máy quầy'), failure('Tem #A1', 'p2')]);
    expect(notice.split('\n')).toEqual([
      'Hoá đơn #A1 in không thành công trên Máy quầy: Không kết nối được.',
      'Tem #A1 in không thành công trên Tem quầy: Không kết nối được.',
      REPRINT_HINT,
    ]);
  });

  it('lý do đã có dấu chấm thì không thêm dấu chấm nữa', () => {
    expect(printFailureNoticeOf([failure('Hoá đơn #A1', 'p1', 'Máy quầy', 'Hết giấy.')])).toBe(
      `Hoá đơn #A1 in không thành công trên Máy quầy: Hết giấy.\n${REPRINT_HINT}`,
    );
  });
});

describe('PrintFailureSnackbar', () => {
  let listener: ((result: PrintTaskResult) => void) | undefined;
  const unsubscribe = jest.fn();
  const queue = mockOf<PrintQueue>({
    onTaskFinished: jest.fn((next: (result: PrintTaskResult) => void) => {
      listener = next;
      return unsubscribe;
    }),
  });

  const render = (): ReactTestRenderer => {
    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(
        <PaperProvider>
          <PrintFailureSnackbar queue={queue} />
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

  const emit = (result: PrintTaskResult): void => {
    act(() => listener?.(result));
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

  it('Success không hiện gì', () => {
    const renderer = render();
    emit({ ...failure('Hoá đơn #A1'), status: PrintTaskStatus.Success, error: undefined });
    advance(FAILURE_BATCH_WINDOW_MS);

    expect(shownText(renderer)).not.toContain('in không thành công');
  });

  it('hai lỗi trong 1 giây gộp thành một thông báo', () => {
    const renderer = render();
    emit(failure('Tem #A1 · ly 1/2'));
    advance(500);
    emit(failure('Tem #A1 · ly 2/2'));

    expect(shownText(renderer)).not.toContain('lệnh in không thành công');
    advance(FAILURE_BATCH_WINDOW_MS);

    expect(shownText(renderer)).toContain('Máy Tem quầy: 2 lệnh in không thành công');
  });

  it('lỗi đến khi đang hiện thì chờ thông báo sau', () => {
    const renderer = render();
    emit(failure('Hoá đơn #A1', 'p1', 'Máy quầy'));
    advance(FAILURE_BATCH_WINDOW_MS);
    expect(shownText(renderer)).toContain('Hoá đơn #A1 in không thành công');

    emit(failure('Hoá đơn #A2', 'p1', 'Máy quầy'));
    advance(FAILURE_BATCH_WINDOW_MS);
    expect(shownText(renderer)).not.toContain('Hoá đơn #A2');

    act(() => renderer.root.findByType(Snackbar).props.onDismiss());
    advance(FAILURE_BATCH_WINDOW_MS);

    expect(shownText(renderer)).toContain('Hoá đơn #A2 in không thành công');
  });

  it('unmount thì huỷ đăng ký', () => {
    const renderer = render();
    act(() => renderer.unmount());

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
