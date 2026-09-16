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

  read(): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array(0));
  }

  async connect(): Promise<void> {
    this.connectCalls += 1;
    this.state = 'connected';
  }

  async disconnect(): Promise<void> {
    this.state = 'disconnected';
  }
}

/** Replaces global setTimeout with a synchronous stub that records the requested delay and invokes the callback immediately. */
function stubSetTimeout(): { delays: number[]; restore: () => void } {
  const delays: number[] = [];
  const spy = jest.spyOn(globalThis, 'setTimeout').mockImplementation(((cb: () => void, ms?: number) => {
    delays.push(ms ?? 0);
    cb();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout);
  return { delays, restore: () => spy.mockRestore() };
}

describe('chunkedWrite', () => {
  it('splits data into chunkSize-byte pieces and writes each in order', async () => {
    const transport = new FakeTransport();
    const data = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    await chunkedWrite(transport, data, { chunkSize: 3, chunkDelay: 0 });

    expect(transport.writes).toHaveLength(4);
    expect(Array.from(transport.writes[0])).toEqual([1, 2, 3]);
    expect(Array.from(transport.writes[1])).toEqual([4, 5, 6]);
    expect(Array.from(transport.writes[2])).toEqual([7, 8, 9]);
    expect(Array.from(transport.writes[3])).toEqual([10]);
  });

  it('writes everything in a single call when data fits in one chunk', async () => {
    const transport = new FakeTransport();
    const data = Uint8Array.from([1, 2]);

    await chunkedWrite(transport, data, { chunkSize: 512, chunkDelay: 0 });

    expect(transport.writes).toHaveLength(1);
    expect(Array.from(transport.writes[0])).toEqual([1, 2]);
  });

  it('writes nothing for empty data', async () => {
    const transport = new FakeTransport();

    await chunkedWrite(transport, new Uint8Array(0), { chunkSize: 4, chunkDelay: 0 });

    expect(transport.writes).toHaveLength(0);
  });

  it('applies chunkDelay between chunks but not after the last one', async () => {
    const { delays, restore } = stubSetTimeout();
    const transport = new FakeTransport();
    const data = Uint8Array.from([1, 2, 3, 4, 5]);

    await chunkedWrite(transport, data, { chunkSize: 2, chunkDelay: 5 });
    restore();

    expect(transport.writes).toHaveLength(3);
    expect(delays).toEqual([5, 5]);
  });

  it('defaults to no pause when chunkDelay is omitted with a single chunk', async () => {
    const { delays, restore } = stubSetTimeout();
    const transport = new FakeTransport();

    await chunkedWrite(transport, Uint8Array.from([1, 2]), { chunkSize: 512 });
    restore();

    expect(delays).toHaveLength(0);
  });
});

describe('writeWithRetry', () => {
  it('resolves on the first attempt when write succeeds', async () => {
    const transport = new FakeTransport();
    const data = Uint8Array.from([9]);

    await writeWithRetry(transport, data, { maxRetries: 3, initialDelay: 0 });

    expect(transport.writes).toHaveLength(1);
    expect(transport.connectCalls).toBe(0);
  });

  it('retries the configured number of times before giving up', async () => {
    let attempts = 0;
    const transport = new FakeTransport(async () => {
      attempts += 1;
      throw new Error('write failed');
    });

    await expect(
      writeWithRetry(transport, Uint8Array.from([1]), { maxRetries: 2, initialDelay: 0 }),
    ).rejects.toThrow('write failed');

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

    await writeWithRetry(transport, Uint8Array.from([1]), { maxRetries: 5, initialDelay: 0 });

    expect(attempts).toBe(3);
  });

  it('reconnects before writing when the transport is not connected', async () => {
    const transport = new FakeTransport();
    transport.state = 'disconnected';

    await writeWithRetry(transport, Uint8Array.from([1]), { maxRetries: 1, initialDelay: 0 });

    expect(transport.connectCalls).toBe(1);
    expect(transport.writes).toHaveLength(1);
  });

  it('backs off exponentially between retries, capped at maxDelay', async () => {
    const { delays, restore } = stubSetTimeout();
    let attempts = 0;
    const transport = new FakeTransport(async () => {
      attempts += 1;
      throw new Error('always fails');
    });

    await expect(
      writeWithRetry(transport, Uint8Array.from([1]), { maxRetries: 4, initialDelay: 100, maxDelay: 300 }),
    ).rejects.toThrow('always fails');
    restore();

    expect(attempts).toBe(5);
    expect(delays).toEqual([100, 200, 300, 300]);
  });
});
