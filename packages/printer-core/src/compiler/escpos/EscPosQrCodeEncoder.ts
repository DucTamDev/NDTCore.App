import type { QrCodeConfig, QrErrorCorrectionLevel } from '../../qrcode';
import { ESC_POS, concatEscPosBytes } from './EscPosCommand';

/**
 * "GS ( k" QR-code sub-function bytes, per the Epson ESC/POS Application
 * Programming Guide's 2D-symbol command family (cn = 0x31 for all QR
 * functions). No portakal source ports this: portakal never compiles QR
 * elements. Derived from the decode side in portakal's parsers/escpos.ts
 * (the generic "GS ( k" wrapper: GS, (, k, pL, pH, <payload>) as the ground
 * truth for the outer byte layout each sub-command must produce.
 */
const QR_CN = 0x31;
const QR_FN_SELECT_MODEL = 0x41;
const QR_FN_SET_MODULE_SIZE = 0x43;
const QR_FN_SELECT_ERROR_CORRECTION = 0x45;
const QR_FN_STORE_DATA = 0x50;
const QR_FN_PRINT = 0x52;

const QR_MODEL_2 = 50; // "model 2" per spec: 48 + model number
const QR_STORE_MODE = 48; // fixed "m" parameter on the store/print sub-commands

const ERROR_CORRECTION_CODE: Record<QrErrorCorrectionLevel, number> = {
  L: 48,
  M: 49,
  Q: 50,
  H: 51,
};

const MIN_MODULE_SIZE = 1;
const MAX_MODULE_SIZE = 16;
const DEFAULT_MODULE_SIZE = 3;

function gsParenK(payload: number[]): Uint8Array {
  const len = payload.length;
  // eslint-disable-next-line no-bitwise -- splitting the payload length into a little-endian byte pair, per GS ( k's wire format
  return new Uint8Array([ESC_POS.GS, ESC_POS.TWO_D_CODE[0], ESC_POS.TWO_D_CODE[1], len & 0xff, (len >> 8) & 0xff, ...payload]);
}

function clampModuleSize(cellWidth: number | undefined): number {
  const size = cellWidth ?? DEFAULT_MODULE_SIZE;
  return Math.min(MAX_MODULE_SIZE, Math.max(MIN_MODULE_SIZE, Math.round(size)));
}

/**
 * Encode a `QrCodeConfig` as the standard ESC/POS "GS ( k" sequence: select
 * model -> set module size -> select error-correction level -> store data ->
 * print. The printer computes and renders the actual QR modules; only the
 * content and layout parameters are sent.
 */
export function encodeEscPosQrCode(config: QrCodeConfig): Uint8Array {
  const moduleSize = clampModuleSize(config.cellWidth);
  const errorCorrection = ERROR_CORRECTION_CODE[config.errorCorrection ?? 'M'];
  const data = Array.from(new TextEncoder().encode(config.content));

  return concatEscPosBytes([
    gsParenK([QR_CN, QR_FN_SELECT_MODEL, QR_MODEL_2, 0]),
    gsParenK([QR_CN, QR_FN_SET_MODULE_SIZE, moduleSize]),
    gsParenK([QR_CN, QR_FN_SELECT_ERROR_CORRECTION, errorCorrection]),
    gsParenK([QR_CN, QR_FN_STORE_DATA, QR_STORE_MODE, ...data]),
    gsParenK([QR_CN, QR_FN_PRINT, QR_STORE_MODE]),
  ]);
}
