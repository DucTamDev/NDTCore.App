import type { ResolvedPrintDocument } from '../../../document';
import type { PrintElement } from '../../../document/elements/PrintElement';
import type { PrintPreview } from '../../../core';
import { formatTable, validateTableColumns } from '../../../formatting';

/** Kích thước pixel font bitmap có sẵn của TSC, theo TSPL/TSPL2 Programming Manual. */
const TSC_FONTS: Record<string, { width: number; height: number }> = {
  '1': { width: 8, height: 12 },
  '2': { width: 12, height: 20 },
  '3': { width: 16, height: 24 },
  '4': { width: 24, height: 32 },
  '5': { width: 32, height: 48 },
  '6': { width: 14, height: 19 },
  '7': { width: 21, height: 27 },
  '8': { width: 14, height: 25 },
};

const DEFAULT_FONT = '2';
const DEFAULT_TTF_POINT_SIZE = 12;
/** Xấp xỉ 1pt ~ 2.82 dots ở 203 DPI — dùng cho font "0"/TrueType không có trong `TSC_FONTS`. */
const DOTS_PER_POINT_AT_203_DPI = 2.82;
const TTF_CHAR_WIDTH_RATIO = 1.7;

const TEXT_BASELINE_RATIO = 0.85;
const DEFAULT_LINE_THICKNESS = 1;
const REVERSE_MARGIN = 1;

const CANVAS_PADDING = 10;
const DEFAULT_CANVAS_HEIGHT = 400;
const IMAGE_MAX_SAMPLES = 100;

const CANVAS_BACKGROUND = '#f5f5f4';
const CANVAS_BORDER = '#e5e5e5';
const CAPTION_COLOR = '#a1a1aa';
const INK_COLOR = '#000';
const PAPER_COLOR = '#fff';
const FONT_FAMILY = 'monospace';

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getTscFont(font: string | undefined) {
  return TSC_FONTS[font ?? DEFAULT_FONT];
}

function getFontHeight(font: string | undefined, size: number | undefined, yScale: number | undefined): number {
  const tscFont = getTscFont(font);

  if (tscFont) {
    const scale = yScale && yScale > 1 ? yScale : size ?? 1;
    return tscFont.height * scale;
  }

  return (size ?? DEFAULT_TTF_POINT_SIZE) * DOTS_PER_POINT_AT_203_DPI;
}

function getCharWidth(font: string | undefined, size: number | undefined, xScale: number | undefined): number {
  const tscFont = getTscFont(font);

  if (tscFont) {
    return tscFont.width * (xScale ?? size ?? 1);
  }

  return (size ?? DEFAULT_TTF_POINT_SIZE) * TTF_CHAR_WIDTH_RATIO;
}

function renderText(
  content: string,
  x: number,
  baselineY: number,
  fontSize: number,
  bold: boolean,
  rotation: string,
  color: string,
): string {
  const fontWeight = bold ? 'bold' : 'normal';

  return (
    `<text x="${x}" y="${baselineY}" fill="${color}" ` +
    `font-size="${fontSize}" font-weight="${fontWeight}" ` +
    `font-family="${FONT_FAMILY}"${rotation}>` +
    `${escapeXml(content)}</text>`
  );
}

function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const fontSize = getFontHeight(options.font, options.size, options.yScale);
  const baselineY = y + fontSize * TEXT_BASELINE_RATIO;
  const rotation = options.rotation ? ` transform="rotate(${options.rotation} ${x} ${y})"` : '';

  if (!options.reverse) {
    return renderText(element.content, x, baselineY, fontSize, options.bold ?? false, rotation, INK_COLOR);
  }

  const charWidth = getCharWidth(options.font, options.size, options.xScale);
  const backgroundWidth = element.content.length * charWidth + REVERSE_MARGIN * 2;
  const backgroundHeight = fontSize + REVERSE_MARGIN * 2;

  const background =
    `<rect x="${x - REVERSE_MARGIN}" y="${y - REVERSE_MARGIN}" ` +
    `width="${backgroundWidth}" height="${backgroundHeight}" ` +
    `fill="${INK_COLOR}"/>`;

  const text = renderText(element.content, x, baselineY, fontSize, options.bold ?? false, rotation, PAPER_COLOR);

  return background + text;
}

function renderImageElement(element: Extract<PrintElement, { type: 'image' }>): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const bitmap = element.bitmap;

  const width = options.width ?? bitmap.width;
  const height = options.height ?? bitmap.height;
  const scaleX = width / bitmap.width;
  const scaleY = height / bitmap.height;

  const sampleStep = Math.max(1, Math.floor(Math.max(bitmap.width, bitmap.height) / IMAGE_MAX_SAMPLES));

  let svg = '';

  for (let pixelY = 0; pixelY < bitmap.height; pixelY += sampleStep) {
    for (let pixelX = 0; pixelX < bitmap.width; pixelX += sampleStep) {
      const byteIndex = pixelY * bitmap.bytesPerRow + Math.floor(pixelX / 8);
      const bitPosition = 7 - (pixelX % 8);

      // eslint-disable-next-line no-bitwise -- đọc 1 bit pixel đã đóng gói, theo quy ước MSB-first của Bitmap
      const isBlackPixel = (bitmap.data[byteIndex] >> bitPosition) & 1;

      if (!isBlackPixel) {
        continue;
      }

      svg +=
        `<rect x="${x + pixelX * scaleX}" ` +
        `y="${y + pixelY * scaleY}" ` +
        `width="${sampleStep * scaleX}" ` +
        `height="${sampleStep * scaleY}" ` +
        `fill="${INK_COLOR}"/>`;
    }
  }

  return svg;
}

function renderBoxElement(element: Extract<PrintElement, { type: 'box' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS;
  const radius = options.radius ?? 0;

  if (thickness >= Math.min(options.width, options.height)) {
    return (
      `<rect x="${options.x}" y="${options.y}" ` +
      `width="${options.width}" height="${options.height}" ` +
      `fill="${INK_COLOR}" rx="${radius}"/>`
    );
  }

  return (
    `<rect x="${options.x + thickness / 2}" ` +
    `y="${options.y + thickness / 2}" ` +
    `width="${options.width - thickness}" ` +
    `height="${options.height - thickness}" ` +
    `fill="none" stroke="${INK_COLOR}" ` +
    `stroke-width="${thickness}" rx="${radius}"/>`
  );
}

/**
 * Đường chéo thật dùng case `diagonal` riêng — case này chỉ xử lý trục
 * ngang/dọc (vẽ rect đặc), phòng trường hợp có `PrintElement` dựng tay lệch
 * trục lọt vào (`PrintBuilder.line()` luôn định tuyến đúng qua `isDiagonal()`).
 */
function renderLineElement(element: Extract<PrintElement, { type: 'line' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS;

  if (options.y1 === options.y2) {
    const x = Math.min(options.x1, options.x2);
    const width = Math.abs(options.x2 - options.x1);

    return `<rect x="${x}" y="${options.y1}" width="${width}" height="${thickness}" fill="${INK_COLOR}"/>`;
  }

  if (options.x1 === options.x2) {
    const y = Math.min(options.y1, options.y2);
    const height = Math.abs(options.y2 - options.y1);

    return `<rect x="${options.x1}" y="${y}" width="${thickness}" height="${height}" fill="${INK_COLOR}"/>`;
  }

  return (
    `<line x1="${options.x1}" y1="${options.y1}" ` +
    `x2="${options.x2}" y2="${options.y2}" ` +
    `stroke="${INK_COLOR}" stroke-width="${thickness}"/>`
  );
}

function renderDiagonalElement(element: Extract<PrintElement, { type: 'diagonal' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS;

  return (
    `<line x1="${options.x1}" y1="${options.y1}" ` +
    `x2="${options.x2}" y2="${options.y2}" ` +
    `stroke="${INK_COLOR}" stroke-width="${thickness}"/>`
  );
}

function renderCircleElement(element: Extract<PrintElement, { type: 'circle' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS;
  const radius = options.diameter / 2;
  const centerX = options.x + radius;
  const centerY = options.y + radius;

  if (thickness >= radius) {
    return `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${INK_COLOR}"/>`;
  }

  return (
    `<circle cx="${centerX}" cy="${centerY}" ` +
    `r="${radius - thickness / 2}" fill="none" ` +
    `stroke="${INK_COLOR}" stroke-width="${thickness}"/>`
  );
}

function renderEllipseElement(element: Extract<PrintElement, { type: 'ellipse' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS;
  const centerX = options.x + options.width / 2;
  const centerY = options.y + options.height / 2;

  return (
    `<ellipse cx="${centerX}" cy="${centerY}" ` +
    `rx="${options.width / 2}" ry="${options.height / 2}" ` +
    `fill="none" stroke="${INK_COLOR}" ` +
    `stroke-width="${thickness}"/>`
  );
}

function renderTableElement(element: Extract<PrintElement, { type: 'table' }>): string {
  const { options } = element;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const rowHeight = getFontHeight(undefined, 1, undefined);
  const rowBaselineOffset = rowHeight * TEXT_BASELINE_RATIO;

  validateTableColumns(options.columns);

  const totalWidth = options.columns.reduce((width, column) => width + column.width, 0);

  return formatTable(options.columns, options.rows, totalWidth)
    .map((line, index) => {
      const rowY = y + index * rowHeight + rowBaselineOffset;

      return (
        `<text x="${x}" y="${rowY}" fill="${INK_COLOR}" ` +
        `font-size="${rowHeight}" font-family="${FONT_FAMILY}">` +
        `${escapeXml(line)}</text>`
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

    case 'ellipse':
      return renderEllipseElement(element);

    case 'reverse':
      return (
        `<rect x="${element.options.x}" y="${element.options.y}" ` +
        `width="${element.options.width}" ` +
        `height="${element.options.height}" ` +
        `fill="${INK_COLOR}"/>`
      );

    case 'erase':
      return (
        `<rect x="${element.options.x}" y="${element.options.y}" ` +
        `width="${element.options.width}" ` +
        `height="${element.options.height}" ` +
        `fill="${PAPER_COLOR}"/>`
      );

    case 'table':
      return renderTableElement(element);

    // Preview TSC chỉ render text/vector/image — các loại còn lại không có
    // rendering riêng, giữ case rõ ràng để switch luôn exhaustive.
    case 'raw':
    case 'barcode':
    case 'qrcode':
    case 'cut':
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';
  }
}

/** Render preview TSC thành SVG, dùng đúng bảng font bitmap của TSC. */
export class TscPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    const width = document.widthDots;
    const height = document.heightDots > 0 ? document.heightDots : DEFAULT_CANVAS_HEIGHT;

    const svgWidth = width + CANVAS_PADDING * 2;
    const svgHeight = height + CANVAS_PADDING * 2;

    let elements = '';

    for (const element of document.elements) {
      elements += renderElement(element);
    }

    const caption = `${width}×${height} dots (${document.dpi} DPI) — TSC`;

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `viewBox="0 0 ${svgWidth} ${svgHeight}" ` +
        `width="${svgWidth}" height="${svgHeight}">`,

      `<rect x="0" y="0" width="${svgWidth}" ` + `height="${svgHeight}" fill="${CANVAS_BACKGROUND}" rx="4"/>`,

      `<rect x="${CANVAS_PADDING}" y="${CANVAS_PADDING}" ` +
        `width="${width}" height="${height}" ` +
        `fill="${PAPER_COLOR}" stroke="${CANVAS_BORDER}" ` +
        `stroke-width="1" rx="2"/>`,

      `<g transform="translate(${CANVAS_PADDING},${CANVAS_PADDING})">`,
      elements,
      '</g>',

      `<text x="${svgWidth / 2}" y="${svgHeight - 1}" ` +
        `text-anchor="middle" fill="${CAPTION_COLOR}" ` +
        `font-size="8" font-family="${FONT_FAMILY}">` +
        `${caption}</text>`,

      '</svg>',
    ].join('\n');
  }
}
