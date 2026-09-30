export const PrinterStatus = {
  Idle: 'Idle',
  Connecting: 'Connecting',
  Connected: 'Connected',
  Disconnecting: 'Disconnecting',
  Disconnected: 'Disconnected',
  Reconnecting: 'Reconnecting',
  Error: 'Error',
} as const;

export type PrinterStatus = (typeof PrinterStatus)[keyof typeof PrinterStatus];
