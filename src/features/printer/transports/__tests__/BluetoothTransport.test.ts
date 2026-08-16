// src/features/printer/transports/BluetoothTransport.test.ts
import { BluetoothTransport } from '../BluetoothTransport';
import { Buffer } from 'buffer';

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
