import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { usePrinterConnection } from '../usePrinterConnection';
import printerReducer from '../../store/printerSlice';
import { PrinterConnectionService } from '../../connection/PrinterConnectionService';
import { PrinterStatus } from '../../models/printer/PrinterStatus';

jest.mock('../../connection/PrinterConnectionService', () => ({
  PrinterConnectionService: {
    getStatus: jest.fn(),
    onStatusChange: jest.fn(),
  },
}));

const makeStore = () => configureStore({ reducer: { printer: printerReducer } });

const Harness: React.FC<{ printerId: string; onStatus: (status: PrinterStatus) => void }> = ({
  printerId,
  onStatus,
}) => {
  const status = usePrinterConnection(printerId);
  onStatus(status);
  return null;
};

describe('usePrinterConnection', () => {
  afterEach(() => jest.clearAllMocks());

  it('dispatches PrinterConnectionService.getStatus() into the store on mount', () => {
    (PrinterConnectionService.getStatus as jest.Mock).mockReturnValue(PrinterStatus.connected);
    (PrinterConnectionService.onStatusChange as jest.Mock).mockReturnValue(() => undefined);
    const store = makeStore();
    const statuses: PrinterStatus[] = [];

    act(() => {
      TestRenderer.create(
        <Provider store={store}>
          <Harness printerId="p1" onStatus={(s) => statuses.push(s)} />
        </Provider>,
      );
    });

    expect(statuses[statuses.length - 1]).toBe(PrinterStatus.connected);
    expect(PrinterConnectionService.getStatus).toHaveBeenCalledWith('p1');
  });

  it('updates when PrinterConnectionService.onStatusChange pushes a new status', () => {
    (PrinterConnectionService.getStatus as jest.Mock).mockReturnValue(PrinterStatus.idle);
    let pushStatus: ((status: PrinterStatus) => void) | undefined;
    (PrinterConnectionService.onStatusChange as jest.Mock).mockImplementation(
      (_id: string, callback: (status: PrinterStatus) => void) => {
        pushStatus = callback;
        return () => undefined;
      },
    );
    const store = makeStore();
    const statuses: PrinterStatus[] = [];

    act(() => {
      TestRenderer.create(
        <Provider store={store}>
          <Harness printerId="p1" onStatus={(s) => statuses.push(s)} />
        </Provider>,
      );
    });
    act(() => {
      pushStatus?.(PrinterStatus.connected);
    });

    expect(statuses[statuses.length - 1]).toBe(PrinterStatus.connected);
  });

  it('unsubscribes from PrinterConnectionService.onStatusChange on unmount', () => {
    (PrinterConnectionService.getStatus as jest.Mock).mockReturnValue(PrinterStatus.idle);
    const unsubscribe = jest.fn();
    (PrinterConnectionService.onStatusChange as jest.Mock).mockReturnValue(unsubscribe);
    const store = makeStore();

    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(
        <Provider store={store}>
          <Harness printerId="p1" onStatus={() => undefined} />
        </Provider>,
      );
    });
    act(() => {
      renderer?.unmount();
    });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
