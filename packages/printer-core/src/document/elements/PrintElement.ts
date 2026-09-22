import type { TextElement } from './content/TextElement';
import type { ImageElement } from './content/ImageElement';
import type { BarcodeElement } from './content/BarcodeElement';
import type { QrCodeElement } from './content/QrCodeElement';
import type { RawElement } from './content/RawElement';
import type { BoxElement } from './drawing/BoxElement';
import type { LineElement } from './drawing/LineElement';
import type { DiagonalElement } from './drawing/DiagonalElement';
import type { CircleElement } from './drawing/CircleElement';
import type { EllipseElement } from './drawing/EllipseElement';
import type { ReverseElement } from './drawing/ReverseElement';
import type { EraseElement } from './drawing/EraseElement';
import type { CutElement } from './control/CutElement';
import type { TableElement } from './layout/TableElement';
import type { PageBreakElement } from './layout/PageBreakElement';
import type { SpacerElement } from './layout/SpacerElement';
import type { RowElement } from './layout/RowElement';
import type { ColumnElement } from './layout/ColumnElement';

/**
 * Union phân biệt (discriminated union) của mọi loại element mà `PrintBuilder`
 * có thể tạo ra. Mỗi variant có shape riêng (không dùng `Record<string, unknown>`
 * chung chung), nên compiler/parser narrow theo `type` là lấy đúng interface
 * options tương ứng. Mỗi variant định nghĩa ở file riêng trong
 * `content/`/`drawing/`/`layout/`/`control/` — file này chỉ gộp lại thành union.
 *
 * Mọi field hình học (x/y/width/height/thickness/radius/...) ở tất cả variant
 * đều tính bằng dots — ngoại lệ duy nhất là `SpacerOptions.unit`, vì spacer vẫn
 * có thể khai báo theo mm/inch.
 */
export type PrintElement =
  | TextElement
  | ImageElement
  | BarcodeElement
  | QrCodeElement
  | BoxElement
  | LineElement
  | DiagonalElement
  | CircleElement
  | EllipseElement
  | ReverseElement
  | EraseElement
  | RawElement
  | CutElement
  | TableElement
  | PageBreakElement
  | SpacerElement
  | RowElement
  | ColumnElement;
