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

/** Layout 2 cột canh trái/phải trên cùng 1 dòng (vd "Mã đơn" .... "#001") — khác `table` (nhiều cột đều nhau, dùng cho danh sách món). */
export interface PrintRowElement extends PrintElementBase {
  type: 'row';
  left: string;
  right: string;
}

export type PrintElement =
  | PrintTextElement
  | PrintImageElement
  | PrintBarcodeElement
  | PrintQrCodeElement
  | PrintLineElement
  | PrintTableElement
  | PrintRowElement;

export interface PrintDocument {
  elements: PrintElement[];
}
