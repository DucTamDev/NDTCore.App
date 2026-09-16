import type { ConnectionState, PrinterTransport } from '../transport/PrinterTransport';

/** Test-configurable behavior for a `MockPrinterTransport` instance. */
export interface MockPrinterTransportOptions {
  /** Connection state the mock starts in (default: `'disconnected'`). */
  initialState?: ConnectionState;
  /** Runs on `connect()`; throw to simulate a failed connection attempt. */
  onConnect?: () => void | Promise<void>;
  /** Runs on `disconnect()`; throw to simulate a failed disconnect. */
  onDisconnect?: () => void | Promise<void>;
  /** Runs on `write()` after the call has already been recorded in `writes`; throw to simulate a write failure. */
  onWrite?: (data: Uint8Array) => void | Promise<void>;
  /** Runs on `read()` to produce the bytes returned; defaults to resolving an empty buffer. */
  onRead?: (timeout?: number) => Uint8Array | Promise<Uint8Array>;
}

/**
 * In-memory `PrinterTransport` fake for tests. Records every `write()` call
 * in `writes` and lets a test configure connect/disconnect/read behavior via
 * `MockPrinterTransportOptions`, instead of doing real I/O.
 */
export class MockPrinterTransport implements PrinterTransport {
  state: ConnectionState;
  readonly writes: Uint8Array[] = [];

  private readonly onConnect?: () => void | Promise<void>;
  private readonly onDisconnect?: () => void | Promise<void>;
  private readonly onWrite?: (data: Uint8Array) => void | Promise<void>;
  private readonly onRead?: (timeout?: number) => Uint8Array | Promise<Uint8Array>;

  constructor(options: MockPrinterTransportOptions = {}) {
    this.state = options.initialState ?? 'disconnected';
    this.onConnect = options.onConnect;
    this.onDisconnect = options.onDisconnect;
    this.onWrite = options.onWrite;
    this.onRead = options.onRead;
  }

  async connect(): Promise<void> {
    this.state = 'connecting';
    try {
      if (this.onConnect) {
        await this.onConnect();
      }
      this.state = 'connected';
    } catch (err) {
      this.state = 'error';
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.onDisconnect) {
      await this.onDisconnect();
    }
    this.state = 'disconnected';
  }

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data);
    if (this.onWrite) {
      await this.onWrite(data);
    }
  }

  async read(timeout?: number): Promise<Uint8Array> {
    if (this.onRead) {
      return this.onRead(timeout);
    }
    return new Uint8Array(0);
  }
}
