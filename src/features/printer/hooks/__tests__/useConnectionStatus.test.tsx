import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useConnectionStatus } from '../useConnectionStatus';
import { printerConnectionService } from '../../connection/PrinterConnectionService';
import { ConnectionStatus } from '../../models/connections/ConnectionStatus';

jest.mock('../../connection/PrinterConnectionService', () => ({
  printerConnectionService: {
    getStatus: jest.fn(),
    onStatusChange: jest.fn(),
  },
}));

const Harness: React.FC<{ printerId: string; onStatus: (status: ConnectionStatus) => void }> = ({
  printerId,
  onStatus,
}) => {
  onStatus(useConnectionStatus(printerId));
  return null;
};

describe('useConnectionStatus', () => {
  afterEach(() => jest.clearAllMocks());

  it('đọc trạng thái hiện tại của service khi mount', () => {
    (printerConnectionService.getStatus as jest.Mock).mockReturnValue(ConnectionStatus.Connected);
    (printerConnectionService.onStatusChange as jest.Mock).mockReturnValue(() => undefined);
    const statuses: ConnectionStatus[] = [];

    act(() => {
      TestRenderer.create(<Harness printerId="p1" onStatus={(status) => statuses.push(status)} />);
    });

    expect(statuses[statuses.length - 1]).toBe(ConnectionStatus.Connected);
    expect(printerConnectionService.getStatus).toHaveBeenCalledWith('p1');
  });

  it('cập nhật khi service báo trạng thái mới', () => {
    let current: ConnectionStatus = ConnectionStatus.Idle;
    let notify: (() => void) | undefined;
    (printerConnectionService.getStatus as jest.Mock).mockImplementation(() => current);
    (printerConnectionService.onStatusChange as jest.Mock).mockImplementation((_id: string, callback: () => void) => {
      notify = callback;
      return () => undefined;
    });
    const statuses: ConnectionStatus[] = [];

    act(() => {
      TestRenderer.create(<Harness printerId="p1" onStatus={(status) => statuses.push(status)} />);
    });
    act(() => {
      current = ConnectionStatus.Connected;
      notify?.();
    });

    expect(statuses[statuses.length - 1]).toBe(ConnectionStatus.Connected);
  });

  it('huỷ đăng ký khi unmount', () => {
    (printerConnectionService.getStatus as jest.Mock).mockReturnValue(ConnectionStatus.Idle);
    const unsubscribe = jest.fn();
    (printerConnectionService.onStatusChange as jest.Mock).mockReturnValue(unsubscribe);
    let renderer: TestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = TestRenderer.create(<Harness printerId="p1" onStatus={() => undefined} />);
    });
    act(() => {
      renderer?.unmount();
    });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
