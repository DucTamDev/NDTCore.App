import type { Rotation } from '../types/Rotation';
import type { BarcodeSymbology } from './BarcodeType';

/**
 * Descriptive config for a 1D barcode element.
 *
 * Matches the pass-through model of printer-native barcode commands
 * (TSC `BARCODE`, ESC/POS `GS k`): only a content string and layout
 * parameters are described here — the printer firmware renders the
 * actual bars. Position is x/y only (no width/height) because every
 * printer-native barcode command computes its own rendered box from
 * `height`/bar widths, not from a caller-supplied box.
 */
export interface BarcodeConfig {
  /** X position in dots. */
  x?: number;
  /** Y position in dots. */
  y?: number;
  /** Barcode symbology to render. */
  symbology: BarcodeSymbology;
  /** Data encoded in the barcode. */
  content: string;
  /** Bar height in dots. */
  height?: number;
  /** Whether to print human-readable text under the bars. */
  readable?: boolean;
  /** Rotation of the barcode element. */
  rotation?: Rotation;
  /** Width of the narrow bar module, in dots. */
  narrowBarWidth?: number;
  /** Width of the wide bar module, in dots. */
  wideBarWidth?: number;
}
