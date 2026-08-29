import { BluetoothTransport } from '../BluetoothTransport';
import { Buffer } from 'buffer';
import { PrinterErrorCode } from '../../types/PrinterError';

type ReceivedListener = (event: { data: string }) => void;

jest.mock('react-native-bluetooth-classic', () => {
  let dataListener: ReceivedListener | null = null;
  const mockDevice = {
    write: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    onDataReceived: jest.fn((listener: ReceivedListener) => {
      dataListener = listener;
      return { remove: jest.fn(() => { dataListener = null; }) };
    }),
  };
  return {
    __esModule: true,
    default: {
      connectToDevice: jest.fn().mockResolvedValue(mockDevice),
    },
    __emitData: (base64: string) => dataListener?.({ data: base64 }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bluetoothMock = jest.requireMock('react-native-bluetooth-classic') as {
  __emitData: (base64: string) => void;
  default: { connectToDevice: jest.Mock };
};

describe('BluetoothTransport.readOnce', () => {
  it('resolves with the decoded bytes when data arrives before the timeout', async () => {
    const transport = new BluetoothTransport();
    await transport.connect('AA:BB:CC:DD:EE:FF');
    const resultPromise = transport.readOnce(1000);
    bluetoothMock.__emitData(Buffer.from([0x41, 0x42]).toString('base64'));
    const result = await resultPromise;
    expect(result).toEqual(new Uint8Array([0x41, 0x42]));
  });

  it('resolves with null when the timeout elapses with no data', async () => {
    jest.useFakeTimers();
    const transport = new BluetoothTransport();
    await transport.connect('AA:BB:CC:DD:EE:FF');
    const resultPromise = transport.readOnce(500);
    jest.advanceTimersByTime(500);
    const result = await resultPromise;
    expect(result).toBeNull();
    jest.useRealTimers();
  });

  it('resolves with null immediately when not connected', async () => {
    const transport = new BluetoothTransport();
    const result = await transport.readOnce(500);
    expect(result).toBeNull();
  });
});

describe('BluetoothTransport.connect', () => {
  afterEach(() => {
    bluetoothMock.default.connectToDevice.mockResolvedValue({
      write: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true),
      onDataReceived: jest.fn(() => ({ remove: jest.fn() })),
    });
    jest.useRealTimers();
  });

  it('rejects when the device never responds within timeoutMs (a hung connect no longer hangs the wizard forever)', async () => {
    let resolveConnect: (device: unknown) => void = () => undefined;
    bluetoothMock.default.connectToDevice.mockImplementation(
      () => new Promise((resolve) => { resolveConnect = resolve; }),
    );
    jest.useFakeTimers();

    const transport = new BluetoothTransport();
    const connectPromise = transport.connect('AA:BB:CC:DD:EE:FF', 5000);
    connectPromise.catch(() => undefined);
    jest.advanceTimersByTime(5000);

    await expect(connectPromise).rejects.toThrow();
    await expect(connectPromise).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_TIMEOUT });

    // Dọn promise connectToDevice() gốc để không treo tay cầm bất đồng bộ
    // sau khi test kết thúc.
    jest.useRealTimers();
    resolveConnect({ disconnect: jest.fn().mockResolvedValue(true), write: jest.fn(), onDataReceived: jest.fn() });
    await Promise.resolve();
    await Promise.resolve();
  });

  it('disconnects a late-resolving connection that arrives after the timeout already rejected', async () => {
    const disconnect = jest.fn().mockResolvedValue(true);
    let resolveConnect: (device: unknown) => void = () => undefined;
    bluetoothMock.default.connectToDevice.mockImplementation(
      () => new Promise((resolve) => { resolveConnect = resolve; }),
    );
    jest.useFakeTimers();

    const transport = new BluetoothTransport();
    const connectPromise = transport.connect('AA:BB:CC:DD:EE:FF', 5000);
    connectPromise.catch(() => undefined);
    jest.advanceTimersByTime(5000);
    await expect(connectPromise).rejects.toThrow();

    jest.useRealTimers();
    resolveConnect({ disconnect, write: jest.fn(), onDataReceived: jest.fn() });
    await Promise.resolve();
    await Promise.resolve();

    expect(disconnect).toHaveBeenCalled();
  });
});

describe('BluetoothTransport.close', () => {
  afterEach(() => {
    bluetoothMock.default.connectToDevice.mockResolvedValue({
      write: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true),
      onDataReceived: jest.fn(() => ({ remove: jest.fn() })),
    });
  });

  it('disconnects the device', async () => {
    const disconnect = jest.fn().mockResolvedValue(true);
    bluetoothMock.default.connectToDevice.mockResolvedValueOnce({
      disconnect,
      write: jest.fn(),
      onDataReceived: jest.fn(() => ({ remove: jest.fn() })),
    });
    const transport = new BluetoothTransport();
    await transport.connect('AA:BB:CC:DD:EE:FF');
    await transport.close();
    expect(disconnect).toHaveBeenCalled();
  });

  it('clears the device reference and throws PRINTER_CONNECTION_FAILED even when native disconnect() rejects — a subsequent write() must not think it is still connected', async () => {
    bluetoothMock.default.connectToDevice.mockResolvedValueOnce({
      disconnect: jest.fn().mockRejectedValue(new Error('already out of range')),
      write: jest.fn(),
      onDataReceived: jest.fn(() => ({ remove: jest.fn() })),
    });
    const transport = new BluetoothTransport();
    await transport.connect('AA:BB:CC:DD:EE:FF');

    await expect(transport.close()).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED });
    await expect(transport.write(new Uint8Array([0x41]))).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_WRITE_FAILED });
  });
});
