/**
 * Barcode symbologies describable by this layer.
 *
 * This is the intersection of symbologies natively supported by TSC's
 * `BARCODE "type",...` command and ESC/POS's `GS k` command (types 0-6
 * in format A, plus CODE93/CODE128 added in format B) — i.e. the set of
 * 1D barcodes every printer-native barcode command in the portakal spec
 * can emit without any bar-drawing logic of our own.
 */
export type BarcodeSymbology =
  | 'code39'
  | 'code93'
  | 'code128'
  | 'ean8'
  | 'ean13'
  | 'upca'
  | 'upce'
  | 'itf'
  | 'codabar';
