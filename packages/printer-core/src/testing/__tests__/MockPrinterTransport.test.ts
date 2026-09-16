import { MockPrinterTransport } from '../MockPrinterTransport';

describe('MockPrinterTransport', () => {
  it('starts disconnected by default', () => {
    const transport = new MockPrinterTransport();
    expect(transport.state).toBe('disconnected');
  });

  it('honors initialState', () => {
    const transport = new MockPrinterTransport({ initialState: 'connected' });
    expect(transport.state).toBe('connected');
  });

  it('transitions to connected on connect()', async () => {
    const transport = new MockPrinterTransport();
    await transport.connect();
    expect(transport.state).toBe('connected');
  });

  it('transitions to disconnected on disconnect()', async () => {
    const transport = new MockPrinterTransport({ initialState: 'connected' });
    await transport.disconnect();
    expect(transport.state).toBe('disconnected');
  });

  it('records every write() call, in order, exactly as passed', async () => {
    const transport = new MockPrinterTransport();
    const first = Uint8Array.from([1, 2, 3]);
    const second = Uint8Array.from([4, 5]);

    await transport.write(first);
    await transport.write(second);

    expect(transport.writes).toHaveLength(2);
    expect(transport.writes[0]).toBe(first);
    expect(transport.writes[1]).toBe(second);
  });

  it('resolves read() with an empty buffer by default', async () => {
    const transport = new MockPrinterTransport();
    const result = await transport.read();
    expect(Array.from(result)).toEqual([]);
  });

  it('lets a test configure the bytes returned by read(), forwarding the timeout argument', async () => {
    let receivedTimeout: number | undefined;
    const transport = new MockPrinterTransport({
      onRead: (timeout) => {
        receivedTimeout = timeout;
        return Uint8Array.from([9, 9]);
      },
    });

    const result = await transport.read(500);

    expect(Array.from(result)).toEqual([9, 9]);
    expect(receivedTimeout).toBe(500);
  });

  it('rejects and moves to the error state when onConnect throws', async () => {
    const transport = new MockPrinterTransport({
      onConnect: () => {
        throw new Error('boom');
      },
    });

    await expect(transport.connect()).rejects.toThrow('boom');
    expect(transport.state).toBe('error');
  });

  it('rejects from write() when onWrite throws, after still recording the write', async () => {
    const transport = new MockPrinterTransport({
      onWrite: () => {
        throw new Error('write failed');
      },
    });
    const data = Uint8Array.from([1]);

    await expect(transport.write(data)).rejects.toThrow('write failed');
    expect(transport.writes).toEqual([data]);
  });

  it('leaves state unchanged when onDisconnect throws', async () => {
    const transport = new MockPrinterTransport({
      initialState: 'connected',
      onDisconnect: () => {
        throw new Error('disconnect failed');
      },
    });

    await expect(transport.disconnect()).rejects.toThrow('disconnect failed');
    expect(transport.state).toBe('connected');
  });
});
