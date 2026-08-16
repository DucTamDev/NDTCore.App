import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { usePrinterConnection } from '../usePrinterConnection';
import printerReducer from '../../store/printerSlice';
import { PrinterService } from '../../services/PrinterService';
import type { PrinterStatus } from '../../types/printer.types';

jest.mock('../../services/PrinterService', () => ({
  PrinterService: {
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

  it('dispatches PrinterService.getStatus() into the store on mount', () => {
    (PrinterService.getStatus as jest.Mock).mockReturnValue('connected');
    (PrinterService.onStatusChange as jest.Mock).mockReturnValue(() => undefined);
    const store = makeStore();
    const statuses: PrinterStatus[] = [];

    act(() => {
      TestRenderer.create(
        <Provider store={store}>
          <Harness printerId="p1" onStatus={(s) => statuses.push(s)} />
        </Provider>,
      );
    });

    expect(statuses[statuses.length - 1]).toBe('connected');
    expect(PrinterService.getStatus).toHaveBeenCalledWith('p1');
  });

  it('updates when PrinterService.onStatusChange pushes a new status', () => {
    (PrinterService.getStatus as jest.Mock).mockReturnValue('idle');
    let pushStatus: ((status: PrinterStatus) => void) | undefined;
    (PrinterService.onStatusChange as jest.Mock).mockImplementation(
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
      pushStatus?.('connected');
    });

    expect(statuses[statuses.length - 1]).toBe('connected');
  });

  it('unsubscribes from PrinterService.onStatusChange on unmount', () => {
    (PrinterService.getStatus as jest.Mock).mockReturnValue('idle');
    const unsubscribe = jest.fn();
    (PrinterService.onStatusChange as jest.Mock).mockReturnValue(unsubscribe);
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
