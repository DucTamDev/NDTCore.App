import type { PrintDocumentOptions } from './PrintDocumentOptions';

export interface PrintDocument extends PrintDocumentOptions {
  width: number;
  height?: number;
}
