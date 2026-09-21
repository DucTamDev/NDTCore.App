import type { ResolvedPrintDocument } from '../../../document';
import type { PrintElement } from '../../../document/elements/PrintElement';
import type { PrintPreview } from '../../../core';
import { formatTable, validateTableColumns } from '../../../formatting';

/**
 * Kích thước pixel font bitmap có sẵn của ZPL ở 203 DPI, theo Zebra ZPL II
 * Programming Guide. Font "0" (CG Triumvirate) co giãn được — entry của nó
 * chỉ là giá trị nền, kích thước thật lấy từ tham số height/width của `^A`/`^CF`.
 */
const ZPL_FONTS: Record<string, { width: number; height: number }> = {
  A: { width: 5, height: 9 },
  B: { width: 7, height: 11 },
  C: { width: 10, height: 18 },
  D: { width: 10, height: 18 },
  E: { width: 15, height: 28 },
  F: { width: 13, height: 26 },
  G: { width: 40, height: 60 },
  H: { width: 13, height: 21 },
  P: { width: 18, height: 20 },
  Q: { width: 24, height: 28 },
  R: { width: 31, height: 35 },
  S: { width: 35, height: 40 },
  T: { width: 42, height: 48 },
  U: { width: 53, height: 59 },
  V: { width: 71, height: 80 },
  '0': { width: 15, height: 18 },
};

const DEFAULT_FONT_CODE = '0';
/**
 * Trên ngưỡng này, `yScale` (từ tham số height của `^A`/`^CF`) được tin dùng
 * trực tiếp thay vì bảng `ZPL_FONTS` cố định.
 */
const YSCALE_TRUST_THRESHOLD = 10;
const DEFAULT_FALLBACK_FONT_SIZE = 18;
const FALLBACK_SIZE_MULTIPLIER = 12;
const PROPORTIONAL_FONT_BASELINE_RATIO = 0.78;
const MONOSPACE_FONT_BASELINE_RATIO = 0.82;
const PROPORTIONAL_FONT_FAMILY = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONOSPACE_FONT_FAMILY = 'monospace';
const TABLE_ROW_BASELINE_RATIO = 0.85;
const DEFAULT_LINE_THICKNESS = 1;

const IMAGE_MAX_SAMPLES = 100;

const CANVAS_PADDING = 10;
/** 6in @ 203dpi — chiều cao canvas mặc định khi document không khai báo heightDots. */
const DEFAULT_CANVAS_HEIGHT = 1218;
const CANVAS_BACKGROUND = '#f5f5f4';
const CANVAS_BORDER = '#e5e5e5';
const CAPTION_COLOR = '#a1a1aa';
const INK_COLOR = '#000';
const PAPER_COLOR = '#fff';

/**
 * Ước lượng độ rộng barcode kiểu Code 128: số module `(số ký tự + 2) * 11 + 13`,
 * áp dụng chung cho mọi symbology, không phân biệt loại mã vạch thật.
 */
const BARCODE_QUIET_CHARS = 2;
const BARCODE_MODULES_PER_CHAR = 11;
const BARCODE_FRAME_MODULES = 13;
const BARCODE_TEXT_OFFSET = 15;
const BARCODE_TEXT_FONT_SIZE = 14;
const DEFAULT_BARCODE_HEIGHT = 50;
const DEFAULT_BARCODE_MODULE_WIDTH = 2;

/** Lưới module QR giả lập — QR Version-1 có 21x21 module, mỗi ô finder pattern chiếm góc 7x7. */
const QR_PLACEHOLDER_MODULES = 21;
const QR_FINDER_MODULES = 7;
const QR_TEXT_OFFSET = 15;
const QR_TEXT_FONT_SIZE = 14;
const DEFAULT_QR_CELL_WIDTH = 4;

function isProportionalFont(font: string | undefined): boolean {
  return (font ?? DEFAULT_FONT_CODE) === DEFAULT_FONT_CODE;
}

function getZplFont(font: string | undefined) {
  return ZPL_FONTS[(font ?? DEFAULT_FONT_CODE).toUpperCase()];
}

function getFontSize(
  font: string | undefined,
  size: number | undefined,
  yScale: number | undefined,
): number {
  if (yScale && yScale > YSCALE_TRUST_THRESHOLD) return yScale;
  const zplFont = getZplFont(font);
  if (zplFont) return zplFont.height * (size ?? 1);
  return size ? size * FALLBACK_SIZE_MULTIPLIER : DEFAULT_FALLBACK_FONT_SIZE;
}

/** Font "0" (proportional) nằm cao hơn 1 chút so với các font bitmap A-H, do ascent khác nhau. */
function getBaselineRatio(font: string | undefined): number {
  return isProportionalFont(font) ? PROPORTIONAL_FONT_BASELINE_RATIO : MONOSPACE_FONT_BASELINE_RATIO;
}

function getFontFamily(font: string | undefined): string {
  return isProportionalFont(font) ? PROPORTIONAL_FONT_FAMILY : MONOSPACE_FONT_FAMILY;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const fontSize = getFontSize(options.font, options.size, options.yScale);
  const baselineRatio = getBaselineRatio(options.font);
  const fontFamily = getFontFamily(options.font);
  const fontWeight = options.bold ? 'bold' : 'normal';
  const rotation = options.rotation ? ` transform="rotate(${options.rotation} ${x} ${y})"` : '';

  let textAnchor = '';
  let textX = x;
  if (options.maxWidth && options.align === 'center') {
    textAnchor = ' text-anchor="middle"';
    textX = x + options.maxWidth / 2;
  } else if (options.maxWidth && options.align === 'right') {
    textAnchor = ' text-anchor="end"';
    textX = x + options.maxWidth;
  }

  const fill = options.reverse ? PAPER_COLOR : INK_COLOR;
  const baselineY = Math.round((y + fontSize * baselineRatio) * 100) / 100;
  return (
    `<text x="${textX}" y="${baselineY}" fill="${fill}" font-size="${fontSize}" font-weight="${fontWeight}" ` +
    `font-family="${fontFamily}"${textAnchor}${rotation}>${escapeXml(element.content)}</text>`
  );
}

function renderImageElement(element: Extract<PrintElement, { type: 'image' }>): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const { bitmap } = element;
  const targetWidth = options.width ?? bitmap.width;
  const targetHeight = options.height ?? bitmap.height;
  const scaleX = targetWidth / bitmap.width;
  const scaleY = targetHeight / bitmap.height;
  const sampleStep = Math.max(1, Math.floor(Math.max(bitmap.width, bitmap.height) / IMAGE_MAX_SAMPLES));

  let svg = '';
  for (let pixelY = 0; pixelY < bitmap.height; pixelY += sampleStep) {
    for (let pixelX = 0; pixelX < bitmap.width; pixelX += sampleStep) {
      const byteIndex = pixelY * bitmap.bytesPerRow + Math.floor(pixelX / 8);
      const bitPosition = 7 - (pixelX % 8);
      // Đọc 1 bit pixel đã đóng gói theo MSB-first.
      // eslint-disable-next-line no-bitwise
      const isBlackPixel = (bitmap.data[byteIndex] >> bitPosition) & 1;
      if (!isBlackPixel) continue;
      svg +=
        `<rect x="${x + pixelX * scaleX}" y="${y + pixelY * scaleY}" ` +
        `width="${sampleStep * scaleX}" height="${sampleStep * scaleY}" fill="${INK_COLOR}"/>`;
    }
  }
  return svg;
}

/**
 * Lệnh `^GB` của ZPL tô đặc khi thickness chạm cạnh ngắn hơn, và luôn vẽ
 * viền hướng vào trong từ mép box.
 */
function renderBoxElement(element: Extract<PrintElement, { type: 'box' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS;
  const cornerRadius = options.radius ?? 0;

  if (thickness >= Math.min(options.width, options.height)) {
    return (
      `<rect x="${options.x}" y="${options.y}" width="${options.width}" height="${options.height}" ` +
      `fill="${INK_COLOR}" rx="${cornerRadius}"/>`
    );
  }

  return (
    `<rect x="${options.x + thickness / 2}" y="${options.y + thickness / 2}" ` +
    `width="${options.width - thickness}" height="${options.height - thickness}" ` +
    `fill="none" stroke="${INK_COLOR}" stroke-width="${thickness}" rx="${cornerRadius}"/>`
  );
}

function renderLineElement(element: Extract<PrintElement, { type: 'line' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS;

  if (options.y1 === options.y2) {
    const left = Math.min(options.x1, options.x2);
    const width = Math.abs(options.x2 - options.x1);
    return `<rect x="${left}" y="${options.y1}" width="${width}" height="${thickness}" fill="${INK_COLOR}"/>`;
  }

  if (options.x1 === options.x2) {
    const top = Math.min(options.y1, options.y2);
    const height = Math.abs(options.y2 - options.y1);
    return `<rect x="${options.x1}" y="${top}" width="${thickness}" height="${height}" fill="${INK_COLOR}"/>`;
  }

  return (
    `<line x1="${options.x1}" y1="${options.y1}" x2="${options.x2}" y2="${options.y2}" ` +
    `stroke="${INK_COLOR}" stroke-width="${thickness}"/>`
  );
}

function renderDiagonalElement(element: Extract<PrintElement, { type: 'diagonal' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS;

  return (
    `<line x1="${options.x1}" y1="${options.y1}" x2="${options.x2}" y2="${options.y2}" ` +
    `stroke="${INK_COLOR}" stroke-width="${thickness}"/>`
  );
}

function renderCircleElement(element: Extract<PrintElement, { type: 'circle' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS;
  const radius = options.diameter / 2;
  const centerX = options.x + radius;
  const centerY = options.y + radius;

  if (thickness >= radius) return `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${INK_COLOR}"/>`;

  return (
    `<circle cx="${centerX}" cy="${centerY}" r="${radius - thickness / 2}" ` +
    `fill="none" stroke="${INK_COLOR}" stroke-width="${thickness}"/>`
  );
}

function renderBarcodeElement(element: Extract<PrintElement, { type: 'barcode' }>): string {
  const options = element.options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const height = options.height ?? DEFAULT_BARCODE_HEIGHT;
  const moduleWidth = options.narrowBarWidth ?? DEFAULT_BARCODE_MODULE_WIDTH;
  const width =
    (options.content.length + BARCODE_QUIET_CHARS) * BARCODE_MODULES_PER_CHAR * moduleWidth +
    BARCODE_FRAME_MODULES * moduleWidth;
  const patternId = `zpl-barcode-${x}-${y}`;
  const textY = y + height + BARCODE_TEXT_OFFSET;
  const label =
    options.readable === false
      ? ''
      : `<text x="${x + width / 2}" y="${textY}" text-anchor="middle" fill="${INK_COLOR}" ` +
        `font-size="${BARCODE_TEXT_FONT_SIZE}" font-family="${MONOSPACE_FONT_FAMILY}">` +
        `${escapeXml(options.content)}</text>`;

  return [
    `<defs><pattern id="${patternId}" width="${moduleWidth * 2}" height="${height}" patternUnits="userSpaceOnUse">`,
    `<rect width="${moduleWidth}" height="${height}" fill="${INK_COLOR}"/>`,
    '</pattern></defs>',
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#${patternId})"/>`,
    label,
  ].join('');
}

function renderQrCodeElement(element: Extract<PrintElement, { type: 'qrcode' }>): string {
  const options = element.options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const cell = options.cellWidth ?? DEFAULT_QR_CELL_WIDTH;
  const size = QR_PLACEHOLDER_MODULES * cell;
  const finder = QR_FINDER_MODULES * cell;
  const textY = y + size + QR_TEXT_OFFSET;

  return [
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" ` +
      `fill="${PAPER_COLOR}" stroke="${INK_COLOR}" stroke-width="${cell}"/>`,
    `<rect x="${x}" y="${y}" width="${finder}" height="${finder}" fill="${INK_COLOR}"/>`,
    `<rect x="${x + size - finder}" y="${y}" width="${finder}" height="${finder}" fill="${INK_COLOR}"/>`,
    `<rect x="${x}" y="${y + size - finder}" width="${finder}" height="${finder}" fill="${INK_COLOR}"/>`,
    `<text x="${x + size / 2}" y="${textY}" text-anchor="middle" fill="${INK_COLOR}" ` +
      `font-size="${QR_TEXT_FONT_SIZE}" font-family="${MONOSPACE_FONT_FAMILY}">` +
      `${escapeXml(options.content)}</text>`,
  ].join('');
}

function renderTableElement(element: Extract<PrintElement, { type: 'table' }>): string {
  const { options } = element;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const rowHeight = getFontSize(undefined, 1, undefined);
  const rowBaselineOffset = rowHeight * TABLE_ROW_BASELINE_RATIO;

  validateTableColumns(options.columns);

  const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);

  return formatTable(options.columns, options.rows, totalWidth)
    .map((line, index) => {
      const rowY = y + index * rowHeight + rowBaselineOffset;
      return (
        `<text x="${x}" y="${rowY}" fill="${INK_COLOR}" font-size="${rowHeight}" ` +
        `font-family="${MONOSPACE_FONT_FAMILY}">${escapeXml(line)}</text>`
      );
    })
    .join('');
}

function renderElement(element: PrintElement): string {
  switch (element.type) {
    case 'text':
      return renderTextElement(element);

    case 'image':
      return renderImageElement(element);

    case 'box':
      return renderBoxElement(element);

    case 'line':
      return renderLineElement(element);

    case 'diagonal':
      return renderDiagonalElement(element);

    case 'circle':
      return renderCircleElement(element);

    // ZPL không có lệnh vẽ ellipse hay vùng reverse-print độc lập — no-op.
    case 'ellipse':
    case 'reverse':
      return '';

    case 'erase': {
      const { options } = element;
      return (
        `<rect x="${options.x}" y="${options.y}" width="${options.width}" ` +
        `height="${options.height}" fill="${PAPER_COLOR}"/>`
      );
    }

    // `raw` chứa text ZPL thô, không có field cấu trúc để render.
    case 'raw':
      return '';

    case 'barcode':
      return renderBarcodeElement(element);

    case 'qrcode':
      return renderQrCodeElement(element);

    // Không có biểu diễn hình ảnh trên tem: cut là hành động sau khi in;
    // pageBreak/spacer/row/column không render ở đây (cũng là no-op ở
    // ZplCompiler).
    case 'cut':
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    case 'table':
      return renderTableElement(element);
  }
}

/** Render preview ZPL thành SVG, dùng đúng bảng font và mô hình bit-per-pixel `^GFA` của ZPL. */
export class ZplPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    const documentWidth = document.widthDots;
    const documentHeight = document.heightDots > 0 ? document.heightDots : DEFAULT_CANVAS_HEIGHT;
    const svgWidth = documentWidth + CANVAS_PADDING * 2;
    const svgHeight = documentHeight + CANVAS_PADDING * 2;

    let renderedElements = '';
    for (const element of document.elements) renderedElements += renderElement(element);

    const caption = `${documentWidth}×${documentHeight} dots (${document.dpi} DPI) — ZPL`;

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" ` +
        `width="${svgWidth}" height="${svgHeight}">`,
      `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="${CANVAS_BACKGROUND}" rx="4"/>`,
      `<rect x="${CANVAS_PADDING}" y="${CANVAS_PADDING}" ` +
        `width="${documentWidth}" height="${documentHeight}" ` +
        `fill="${PAPER_COLOR}" stroke="${CANVAS_BORDER}" stroke-width="1" rx="2"/>`,
      `<g transform="translate(${CANVAS_PADDING},${CANVAS_PADDING})">`,
      renderedElements,
      '</g>',
      `<text x="${svgWidth / 2}" y="${svgHeight - 1}" text-anchor="middle" fill="${CAPTION_COLOR}" font-size="8" ` +
        `font-family="${MONOSPACE_FONT_FAMILY}">${caption}</text>`,
      '</svg>',
    ].join('\n');
  }
}
