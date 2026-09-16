/**
 * Contract for a printer transport. This package defines the shape only —
 * actual I/O (USB/Bluetooth/network) is implemented by the consuming
 * application, not here.
 */
export interface PrinterTransport {
  readonly state: ConnectionState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  read(timeout?: number): Promise<Uint8Array>;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ChunkOptions {
  /** Bytes per write call (default: 512). */
  chunkSize?: number;
  /** Pause between chunks in ms, so slow/BLE links aren't overrun (default: 10). */
  chunkDelay?: number;
}

export interface ReconnectOptions {
  /** Max retry attempts after the first try (default: 3). */
  maxRetries?: number;
  /** Delay before the first retry in ms; doubles each attempt (default: 1000). */
  initialDelay?: number;
  /** Upper bound for the doubling delay in ms (default: 10000). */
  maxDelay?: number;
}

/**
 * Splits `data` into chunks and writes each one in order, pausing between
 * chunks. Guards against overflowing a transport's internal write buffer.
 */
export async function chunkedWrite(
  transport: PrinterTransport,
  data: Uint8Array,
  options: ChunkOptions = {},
): Promise<void> {
  const chunkSize = options.chunkSize ?? 512;
  const chunkDelay = options.chunkDelay ?? 10;

  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const chunk = data.slice(offset, offset + chunkSize);
    await transport.write(chunk);
    if (chunkDelay > 0 && offset + chunkSize < data.length) {
      await delay(chunkDelay);
    }
  }
}

/**
 * Writes `data`, reconnecting and retrying on failure with an exponentially
 * increasing delay (capped at `maxDelay`) between attempts.
 */
export async function writeWithRetry(
  transport: PrinterTransport,
  data: Uint8Array,
  options: ReconnectOptions = {},
): Promise<void> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelay = options.initialDelay ?? 1000;
  const maxDelay = options.maxDelay ?? 10000;

  let lastError: unknown;
  let currentDelay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (transport.state !== 'connected') {
        await transport.connect();
      }
      await transport.write(data);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await delay(currentDelay);
        currentDelay = Math.min(currentDelay * 2, maxDelay);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Write failed after retries');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
