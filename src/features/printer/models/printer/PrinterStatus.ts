export const PrinterStatus = {
  idle: 'idle',
  connecting: 'connecting',
  connected: 'connected',
  disconnecting: 'disconnecting',
  disconnected: 'disconnected',
  reconnecting: 'reconnecting',
  error: 'error',
} as const;

export type PrinterStatus = (typeof PrinterStatus)[keyof typeof PrinterStatus];
