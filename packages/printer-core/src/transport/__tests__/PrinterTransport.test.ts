import { chunkedWrite, writeWithRetry, type ConnectionState, type PrinterTransport } from '../PrinterTransport';

class FakeTransport implements PrinterTransport {
  state: ConnectionState = 'connected';
  writes: Uint8Array[] = [];
  connectCalls = 0;
  private writeImpl: (data: Uint8Array) => Promise<void>;

  constructor(writeImpl?: (data: Uint8Array) => Promise<void>) {
    this.writeImpl =
      writeImpl ??
      (async (data) => {
        this.writes.push(data);
      });
  }

  write(data: Uint8Array): Promise<void> {
    return this.writeImpl(data);
  }

  getState(): ConnectionState {
    return this.state;
  }

  async connect(): Promise<void> {
    this.connectCalls += 1;
    this.state = 'connected';
  }

  async disconnect(): Promise<void> {
    this.state = 'disconnected';
  }
}

describe('chunkedWrite', () => {
  it('splits data into chunkSize-byte pieces and writes each in order', async () => {
    const transport = new FakeTransport();
    const data = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    await chunkedWrite(transport, data, { chunkSize: 3 });

    expect(transport.writes).toHaveLength(4);
    expect(Array.from(transport.writes[0])).toEqual([1, 2, 3]);
    expect(Array.from(transport.writes[1])).toEqual([4, 5, 6]);
    expect(Array.from(transport.writes[2])).toEqual([7, 8, 9]);
    expect(Array.from(transport.writes[3])).toEqual([10]);
  });

  it('writes everything in a single call when data fits in one chunk', async () => {
    const transport = new FakeTransport();
    const data = Uint8Array.from([1, 2]);

    await chunkedWrite(transport, data, { chunkSize: 512 });

    expect(transport.writes).toHaveLength(1);
    expect(Array.from(transport.writes[0])).toEqual([1, 2]);
  });

  it('writes nothing for empty data', async () => {
    const transport = new FakeTransport();

    await chunkedWrite(transport, new Uint8Array(0), { chunkSize: 4 });

    expect(transport.writes).toHaveLength(0);
  });
});

describe('writeWithRetry', () => {
  it('resolves on the first attempt when write succeeds', async () => {
    const transport = new FakeTransport();
    const data = Uint8Array.from([9]);

    await writeWithRetry(transport, data, { maxRetries: 3, delayMs: 0 });

    expect(transport.writes).toHaveLength(1);
    expect(transport.connectCalls).toBe(0);
  });

  it('retries the configured number of times before giving up', async () => {
    let attempts = 0;
    const transport = new FakeTransport(async () => {
      attempts += 1;
      throw new Error('write failed');
    });

    await expect(writeWithRetry(transport, Uint8Array.from([1]), { maxRetries: 2, delayMs: 0 })).rejects.toThrow(
      'write failed',
    );

    expect(attempts).toBe(3);
  });

  it('succeeds once the transport recovers within the retry budget', async () => {
    let attempts = 0;
    const transport = new FakeTransport(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('not yet');
      }
    });

    await writeWithRetry(transport, Uint8Array.from([1]), { maxRetries: 5, delayMs: 0 });

    expect(attempts).toBe(3);
  });

  it('reconnects before writing when the transport is not connected', async () => {
    const transport = new FakeTransport();
    transport.state = 'disconnected';

    await writeWithRetry(transport, Uint8Array.from([1]), { maxRetries: 1, delayMs: 0 });

    expect(transport.connectCalls).toBe(1);
    expect(transport.writes).toHaveLength(1);
  });
});
