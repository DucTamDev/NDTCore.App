import type { PrinterDriver } from './PrinterDriver';
import type { PrinterCapabilities } from './PrinterCapabilities';
import type { PrinterConnection } from './PrinterConnection';

export interface Printer {
  id: string;
  name: string;
  vendor?: string;
  model?: string;
  /** `1..2` phần tử (escpos + tspl) — enforce ở schema. */
  drivers: PrinterDriver[];
  connection: PrinterConnection;
  /** Chỉ phụ thuộc connection, không phụ thuộc driver — xem `discovery/PrinterResolver.ts`. */
  identityKey: string;
  capabilities: PrinterCapabilities;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
