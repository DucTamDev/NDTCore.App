/**
 * Contract for a printer transport. This package defines the shape only —
 * actual I/O (USB/Bluetooth/network) is implemented by the consuming
 * application, not here.
 */
export interface PrinterTransport {
  write(data: Uint8Array): Promise<void>;
  read?(): Promise<Uint8Array>;
  getState(): ConnectionState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ChunkOptions {
  chunkSize: number;
}

export interface ReconnectOptions {
  maxRetries: number;
  delayMs: number;
}

/**
 * Splits `data` into `chunkSize`-byte pieces and writes each one in order.
 * Guards against overflowing a transport's internal write buffer (e.g. BLE).
 */
export async function chunkedWrite(
  transport: PrinterTransport,
  data: Uint8Array,
  options: ChunkOptions,
): Promise<void> {
  const { chunkSize } = options;

  for (let offset = 0; offset < data.length; offset += chunkSize) {
    await transport.write(data.slice(offset, offset + chunkSize));
  }
}

/**
 * Writes `data`, reconnecting and retrying on failure up to `maxRetries`
 * times with a fixed delay between attempts.
 */
export async function writeWithRetry(
  transport: PrinterTransport,
  data: Uint8Array,
  options: ReconnectOptions,
): Promise<void> {
  const { maxRetries, delayMs } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (transport.getState() !== 'connected') {
        await transport.connect();
      }
      await transport.write(data);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await delay(delayMs);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Write failed after retries');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
