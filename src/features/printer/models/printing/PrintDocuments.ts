import type { PrintDocument } from './PrintDocument';

/** Nội dung một lệnh in; ngôn ngữ in tự chọn dùng bản văn bản hay bản ảnh. */
export interface PrintDocuments {
  text: PrintDocument;

  /** Ảnh PNG base64 (không tiền tố `data:`) đã render sẵn, dùng khi in `Raster`. */
  image?: string;
}
