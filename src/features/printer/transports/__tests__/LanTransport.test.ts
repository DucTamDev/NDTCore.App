import { Buffer } from 'buffer';
import { LanTransport } from '../LanTransport';
import { PrinterErrorCode } from '../../types/PrinterError';

type DataListener = (data: Buffer | string) => void;

jest.mock('react-native-tcp-socket', () => {
  const listeners: Record<string, DataListener[]> = { data: [], error: [] };
  const mockSocket = {
    on: jest.fn((event: string, listener: DataListener) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(listener);
    }),
    removeListener: jest.fn((event: string, listener: DataListener) => {
      listeners[event] = (listeners[event] ?? []).filter((l) => l !== listener);
    }),
    write: jest.fn(),
    destroy: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      createConnection: jest.fn((_opts: unknown, onConnect: () => void) => {
        onConnect();
        return mockSocket;
      }),
    },
    __mockSocket: mockSocket,
    __emit: (event: string, ...args: unknown[]) => {
      (listeners[event] ?? []).forEach((listener) => (listener as (...a: unknown[]) => void)(...args));
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tcpSocketMock = jest.requireMock('react-native-tcp-socket') as {
  __emit: (event: string, ...args: unknown[]) => void;
  __mockSocket: { destroy: jest.Mock };
  default: { createConnection: jest.Mock };
};

describe('LanTransport.readOnce', () => {
  it('resolves with the received bytes when data arrives before the timeout', async () => {
    const transport = new LanTransport();
    await transport.connect('192.168.1.60', 9100);
    const resultPromise = transport.readOnce(1000);
    tcpSocketMock.__emit('data', Buffer.from([0x01, 0x02, 0x03]));
    const result = await resultPromise;
    expect(result).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
  });

  it('resolves with null when the timeout elapses with no data', async () => {
    jest.useFakeTimers();
    const transport = new LanTransport();
    await transport.connect('192.168.1.60', 9100);
    const resultPromise = transport.readOnce(500);
    jest.advanceTimersByTime(500);
    const result = await resultPromise;
    expect(result).toBeNull();
    jest.useRealTimers();
  });

  it('resolves with null immediately when not connected', async () => {
    const transport = new LanTransport();
    const result = await transport.readOnce(500);
    expect(result).toBeNull();
  });
});

describe('LanTransport.write', () => {
  it('throws PRINTER_WRITE_FAILED when writing while not connected', () => {
    const transport = new LanTransport();
    let caught: unknown;
    try {
      transport.write(new Uint8Array([0x41]));
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: PrinterErrorCode.PRINTER_WRITE_FAILED });
  });
});

describe('LanTransport.connect', () => {
  afterEach(() => {
    tcpSocketMock.default.createConnection.mockImplementation((_opts: unknown, onConnect: () => void) => {
      onConnect();
      return tcpSocketMock.__mockSocket;
    });
    jest.useRealTimers();
  });

  it('rejects with PRINTER_CONNECTION_TIMEOUT and destroys the socket when the server never accepts the connection within timeoutMs', async () => {
    tcpSocketMock.default.createConnection.mockImplementation(() => tcpSocketMock.__mockSocket);
    jest.useFakeTimers();

    const transport = new LanTransport();
    const connectPromise = transport.connect('192.168.1.60', 9100, 5000);
    connectPromise.catch(() => undefined);
    jest.advanceTimersByTime(5000);

    await expect(connectPromise).rejects.toThrow();
    await expect(connectPromise).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_TIMEOUT });
    expect(tcpSocketMock.__mockSocket.destroy).toHaveBeenCalled();
  });

  it('rejects with PRINTER_CONNECTION_FAILED when the socket emits an error before connecting (connection refused / host unreachable)', async () => {
    tcpSocketMock.default.createConnection.mockImplementation(() => tcpSocketMock.__mockSocket);

    const transport = new LanTransport();
    const connectPromise = transport.connect('192.168.1.60', 9100, 5000);
    connectPromise.catch(() => undefined);
    tcpSocketMock.__emit('error', new Error('ECONNREFUSED 192.168.1.60:9100'));

    await expect(connectPromise).rejects.toThrow();
    await expect(connectPromise).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
  });
});
