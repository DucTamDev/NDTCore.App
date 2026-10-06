import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { usePrinterConnection } from '../usePrinterConnection';
import printerReducer from '../../store/printerSlice';
import { printerConnectionService } from '../../connection/PrinterConnectionService';
import { ConnectionStatus } from '../../models/connections/ConnectionStatus';

jest.mock('../../connection/PrinterConnectionService', () => ({
  printerConnectionService: {
    getStatus: jest.fn(),
    onStatusChange: jest.fn(),
  },
}));

const makeStore = () => configureStore({ reducer: { printer: printerReducer } });

const Harness: React.FC<{ printerId: string; onStatus: (status: ConnectionStatus) => void }> = ({
  printerId,
  onStatus,
}) => {
  const status = usePrinterConnection(printerId);
  onStatus(status);
  return null;
};

describe('usePrinterConnection', () => {
  afterEach(() => jest.clearAllMocks());

  it('dispatches printerConnectionService.getStatus() into the store on mount', () => {
    (printerConnectionService.getStatus as jest.Mock).mockReturnValue(ConnectionStatus.Connected);
    (printerConnectionService.onStatusChange as jest.Mock).mockReturnValue(() => undefined);
    const store = makeStore();
    const statuses: ConnectionStatus[] = [];

    act(() => {
      TestRenderer.create(
        <Provider store={store}>
          <Harness printerId="p1" onStatus={(s) => statuses.push(s)} />
        </Provider>,
      );
    });

    expect(statuses[statuses.length - 1]).toBe(ConnectionStatus.Connected);
    expect(printerConnectionService.getStatus).toHaveBeenCalledWith('p1');
  });

  it('updates when printerConnectionService.onStatusChange pushes a new status', () => {
    (printerConnectionService.getStatus as jest.Mock).mockReturnValue(ConnectionStatus.Idle);
    let pushStatus: ((status: ConnectionStatus) => void) | undefined;
    (printerConnectionService.onStatusChange as jest.Mock).mockImplementation(
      (_id: string, callback: (status: ConnectionStatus) => void) => {
        pushStatus = callback;
        return () => undefined;
      },
    );
    const store = makeStore();
    const statuses: ConnectionStatus[] = [];

    act(() => {
      TestRenderer.create(
        <Provider store={store}>
          <Harness printerId="p1" onStatus={(s) => statuses.push(s)} />
        </Provider>,
      );
    });
    act(() => {
      pushStatus?.(ConnectionStatus.Connected);
    });

    expect(statuses[statuses.length - 1]).toBe(ConnectionStatus.Connected);
  });

  it('unsubscribes from printerConnectionService.onStatusChange on unmount', () => {
    (printerConnectionService.getStatus as jest.Mock).mockReturnValue(ConnectionStatus.Idle);
    const unsubscribe = jest.fn();
    (printerConnectionService.onStatusChange as jest.Mock).mockReturnValue(unsubscribe);
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
