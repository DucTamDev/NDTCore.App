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

const DEFAULT_FONT_CODE = '2';
const DEFAULT_TTF_POINT_SIZE = 12;
/** Xấp xỉ 1pt ~ 2.82 dots ở 203 DPI — dùng cho font "0"/TrueType không có trong `TSC_FONTS`. */
const DOTS_PER_POINT_AT_203_DPI = 2.82;
const APPROX_TTF_CHAR_WIDTH_RATIO = 1.7;

const TEXT_BASELINE_RATIO = 0.85;
const DEFAULT_LINE_THICKNESS_DOTS = 1;
const REVERSE_BACKGROUND_MARGIN_DOTS = 1;

const CANVAS_PADDING_DOTS = 10;
const DEFAULT_CANVAS_HEIGHT_DOTS = 400;
const IMAGE_PREVIEW_MAX_SAMPLES = 100;
const CANVAS_BACKGROUND_COLOR = '#f5f5f4';
const CANVAS_BORDER_COLOR = '#e5e5e5';
const CAPTION_COLOR = '#a1a1aa';
const INK_COLOR = '#000';
const PAPER_COLOR = '#fff';
const MONOSPACE_FONT_FAMILY = 'monospace';

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resolveFontSizeDots(font: string | undefined, size: number | undefined, yScale?: number): number {
  if (yScale && yScale > 1) {
    const knownFontForYScale = TSC_FONTS[font ?? DEFAULT_FONT_CODE];
    if (knownFontForYScale) return knownFontForYScale.height * yScale;
  }
  const knownFont = TSC_FONTS[font ?? DEFAULT_FONT_CODE];
  if (knownFont) return knownFont.height * (size ?? 1);
  return (size ?? DEFAULT_TTF_POINT_SIZE) * DOTS_PER_POINT_AT_203_DPI;
}

function resolveCharWidthDots(font: string | undefined, size: number | undefined, xScale?: number): number {
  const knownFont = TSC_FONTS[font ?? DEFAULT_FONT_CODE];
  if (knownFont) return knownFont.width * (xScale ?? size ?? 1);
  return (size ?? DEFAULT_TTF_POINT_SIZE) * APPROX_TTF_CHAR_WIDTH_RATIO;
}

function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const fontSizeDots = resolveFontSizeDots(options.font, options.size, options.yScale);
  const fontWeight = options.bold ? 'bold' : 'normal';
  const rotation = options.rotation ? ` transform="rotate(${options.rotation} ${x} ${y})"` : '';
  const baselineY = y + fontSizeDots * TEXT_BASELINE_RATIO;

  if (!options.reverse) {
    return (
      `<text x="${x}" y="${baselineY}" fill="${INK_COLOR}" font-size="${fontSizeDots}" font-weight="${fontWeight}" ` +
      `font-family="${MONOSPACE_FONT_FAMILY}"${rotation}>${escapeXml(element.content)}</text>`
    );
  }

  const charWidthDots = resolveCharWidthDots(options.font, options.size, options.xScale);
  const textWidthDots = element.content.length * charWidthDots;
  const backgroundWidth = textWidthDots + REVERSE_BACKGROUND_MARGIN_DOTS * 2;
  const backgroundHeight = fontSizeDots + REVERSE_BACKGROUND_MARGIN_DOTS * 2;
  return (
    `<rect x="${x - REVERSE_BACKGROUND_MARGIN_DOTS}" y="${y - REVERSE_BACKGROUND_MARGIN_DOTS}" ` +
    `width="${backgroundWidth}" height="${backgroundHeight}" fill="${INK_COLOR}"/>` +
    `<text x="${x}" y="${baselineY}" fill="${PAPER_COLOR}" font-size="${fontSizeDots}" font-weight="${fontWeight}" ` +
    `font-family="${MONOSPACE_FONT_FAMILY}"${rotation}>${escapeXml(element.content)}</text>`
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
  const step = Math.max(1, Math.floor(Math.max(bitmap.width, bitmap.height) / IMAGE_PREVIEW_MAX_SAMPLES));

  let svg = '';
  for (let pixelY = 0; pixelY < bitmap.height; pixelY += step) {
    for (let pixelX = 0; pixelX < bitmap.width; pixelX += step) {
      const byteIndex = pixelY * bitmap.bytesPerRow + Math.floor(pixelX / 8);
      const bitIndex = 7 - (pixelX % 8);
      // eslint-disable-next-line no-bitwise -- đọc 1 bit pixel đã đóng gói, theo quy ước MSB-first của Bitmap
      const isBlack = (bitmap.data[byteIndex] >> bitIndex) & 1;
      if (isBlack) {
        svg +=
          `<rect x="${x + pixelX * scaleX}" y="${y + pixelY * scaleY}" ` +
          `width="${step * scaleX}" height="${step * scaleY}" fill="${INK_COLOR}"/>`;
      }
    }
  }
  return svg;
}

function renderBoxElement(element: Extract<PrintElement, { type: 'box' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS_DOTS;
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

/**
 * Đường chéo thật dùng case `diagonal` riêng — case này chỉ xử lý trục
 * ngang/dọc (vẽ rect đặc), phòng trường hợp có `PrintElement` dựng tay lệch
 * trục lọt vào (`PrintBuilder.line()` luôn định tuyến đúng qua `isDiagonal()`).
 */
function renderLineElement(element: Extract<PrintElement, { type: 'line' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS_DOTS;
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
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS_DOTS;
  return (
    `<line x1="${options.x1}" y1="${options.y1}" x2="${options.x2}" y2="${options.y2}" ` +
    `stroke="${INK_COLOR}" stroke-width="${thickness}"/>`
  );
}

function renderCircleElement(element: Extract<PrintElement, { type: 'circle' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS_DOTS;
  const radius = options.diameter / 2;
  const centerX = options.x + radius;
  const centerY = options.y + radius;
  if (thickness >= radius) return `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${INK_COLOR}"/>`;
  return (
    `<circle cx="${centerX}" cy="${centerY}" r="${radius - thickness / 2}" ` +
    `fill="none" stroke="${INK_COLOR}" stroke-width="${thickness}"/>`
  );
}

function renderEllipseElement(element: Extract<PrintElement, { type: 'ellipse' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS_DOTS;
  const centerX = options.x + options.width / 2;
  const centerY = options.y + options.height / 2;
  return (
    `<ellipse cx="${centerX}" cy="${centerY}" rx="${options.width / 2}" ry="${options.height / 2}" ` +
    `fill="none" stroke="${INK_COLOR}" stroke-width="${thickness}"/>`
  );
}

function renderTableElement(element: Extract<PrintElement, { type: 'table' }>): string {
  const { options } = element;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const rowHeight = resolveFontSizeDots(undefined, 1, undefined);
  validateTableColumns(options.columns);
  const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);
  const rowBaselineOffset = rowHeight * TEXT_BASELINE_RATIO;

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
    case 'ellipse':
      return renderEllipseElement(element);
    case 'reverse': {
      const { options } = element;
      return (
        `<rect x="${options.x}" y="${options.y}" width="${options.width}" ` +
        `height="${options.height}" fill="${INK_COLOR}"/>`
      );
    }
    case 'erase': {
      const { options } = element;
      return (
        `<rect x="${options.x}" y="${options.y}" width="${options.width}" ` +
        `height="${options.height}" fill="${PAPER_COLOR}"/>`
      );
    }
    case 'table':
      return renderTableElement(element);
    // Preview TSC chỉ render text/vector/image — barcode/qrcode/cut/pageBreak/
    // spacer/row/column không có rendering riêng, giữ case rõ ràng để switch
    // luôn exhaustive.
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
    const documentWidth = document.widthDots;
    const documentHeight = document.heightDots > 0 ? document.heightDots : DEFAULT_CANVAS_HEIGHT_DOTS;
    const svgWidth = documentWidth + CANVAS_PADDING_DOTS * 2;
    const svgHeight = documentHeight + CANVAS_PADDING_DOTS * 2;

    let renderedElements = '';
    for (const element of document.elements) renderedElements += renderElement(element);

    const caption = `${documentWidth}×${documentHeight} dots (${document.dpi} DPI) — TSC`;

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" ` +
        `width="${svgWidth}" height="${svgHeight}">`,
      `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="${CANVAS_BACKGROUND_COLOR}" rx="4"/>`,
      `<rect x="${CANVAS_PADDING_DOTS}" y="${CANVAS_PADDING_DOTS}" ` +
        `width="${documentWidth}" height="${documentHeight}" ` +
        `fill="${PAPER_COLOR}" stroke="${CANVAS_BORDER_COLOR}" stroke-width="1" rx="2"/>`,
      `<g transform="translate(${CANVAS_PADDING_DOTS},${CANVAS_PADDING_DOTS})">`,
      renderedElements,
      '</g>',
      `<text x="${svgWidth / 2}" y="${svgHeight - 1}" text-anchor="middle" fill="${CAPTION_COLOR}" font-size="8" ` +
        `font-family="${MONOSPACE_FONT_FAMILY}">${caption}</text>`,
      '</svg>',
    ].join('\n');
  }
}
