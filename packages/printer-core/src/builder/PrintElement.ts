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
import type { CutElement } from './printer/CutElement';
import type { TableElement } from './layout/TableElement';
import type { PageBreakElement } from './layout/PageBreakElement';
import type { SpacerElement } from './layout/SpacerElement';
import type { RowElement } from './layout/RowElement';
import type { ColumnElement } from './layout/ColumnElement';

/**
 * Discriminated union of every element a `PrintBuilder` can produce.
 * Each variant owns its exact shape (no `Record<string, unknown>` bridge),
 * so compilers and parsers narrow on `type` and get the real options
 * interface for free. Each variant is defined alongside its own `*Options`
 * type in its own `content/`/`drawing/`/`layout/`/`printer/` file — this
 * file only assembles the union.
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
