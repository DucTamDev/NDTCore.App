interface PrintElementBase {
  x: number;
  y: number;
}

export interface PrintTextElement extends PrintElementBase {
  type: 'text';
  content: string;
}

export interface PrintImageElement extends PrintElementBase {
  type: 'image';
  data: string;
}

export interface PrintBarcodeElement extends PrintElementBase {
  type: 'barcode';
  content: string;
}

export interface PrintQrCodeElement extends PrintElementBase {
  type: 'qrCode';
  content: string;
}

export interface PrintLineElement extends PrintElementBase {
  type: 'line';
}

export interface PrintTableElement extends PrintElementBase {
  type: 'table';
  rows: string[][];
}

export type PrintElement =
  | PrintTextElement
  | PrintImageElement
  | PrintBarcodeElement
  | PrintQrCodeElement
  | PrintLineElement
  | PrintTableElement;

export interface PrintDocument {
  elements: PrintElement[];
}
