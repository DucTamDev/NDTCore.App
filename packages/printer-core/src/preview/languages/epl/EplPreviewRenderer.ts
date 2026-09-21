import type { ResolvedPrintDocument } from '../../../document';
import type { PrintElement } from '../../../document/elements/PrintElement';
import type { PrintPreview } from '../../../core';
import { formatTable, validateTableColumns } from '../../../formatting';

/** Kích thước pixel font bitmap có sẵn của EPL2, theo EPL2 Programmer's Guide. */
const EPL_FONTS: Record<string, { width: number; height: number }> = {
  '1': { width: 8, height: 12 },
  '2': { width: 10, height: 16 },
  '3': { width: 12, height: 20 },
  '4': { width: 14, height: 24 },
  '5': { width: 32, height: 48 },
};

const DEFAULT_FONT_CODE = '2';
const FALLBACK_FONT_HEIGHT_DOTS = 16;
const FALLBACK_CHAR_WIDTH_DOTS = 10;
const TEXT_BASELINE_RATIO = 0.85;
const DEFAULT_LINE_THICKNESS_DOTS = 1;
const REVERSE_BACKGROUND_MARGIN_DOTS = 1;

const CANVAS_PADDING_DOTS = 10;
const DEFAULT_CANVAS_HEIGHT_DOTS = 400;
const CANVAS_BACKGROUND_COLOR = '#f5f5f4';
const CANVAS_BORDER_COLOR = '#e5e5e5';
const CAPTION_COLOR = '#a1a1aa';
const INK_COLOR = '#000';
const PAPER_COLOR = '#fff';
const MONOSPACE_FONT_FAMILY = 'monospace';

function resolveFontSizeDots(font: string | undefined, size: number | undefined): number {
  const knownFont = EPL_FONTS[font ?? DEFAULT_FONT_CODE];
  return knownFont ? knownFont.height * (size ?? 1) : (size ?? 1) * FALLBACK_FONT_HEIGHT_DOTS;
}

function resolveCharWidthDots(font: string | undefined, size: number | undefined): number {
  const knownFont = EPL_FONTS[font ?? DEFAULT_FONT_CODE];
  return knownFont ? knownFont.width * (size ?? 1) : (size ?? 1) * FALLBACK_CHAR_WIDTH_DOTS;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const fontSizeDots = resolveFontSizeDots(options.font, options.size);
  const baselineY = y + fontSizeDots * TEXT_BASELINE_RATIO;
  const rotation = options.rotation ? ` transform="rotate(${options.rotation} ${x} ${y})"` : '';

  if (!options.reverse) {
    return (
      `<text x="${x}" y="${baselineY}" fill="${INK_COLOR}" font-size="${fontSizeDots}" ` +
      `font-family="${MONOSPACE_FONT_FAMILY}"${rotation}>${escapeXml(element.content)}</text>`
    );
  }

  const charWidthDots = resolveCharWidthDots(options.font, options.size);
  const textWidthDots = element.content.length * charWidthDots;
  const backgroundX = x - REVERSE_BACKGROUND_MARGIN_DOTS;
  const backgroundY = y - REVERSE_BACKGROUND_MARGIN_DOTS;
  const backgroundWidth = textWidthDots + REVERSE_BACKGROUND_MARGIN_DOTS * 2;
  const backgroundHeight = fontSizeDots + REVERSE_BACKGROUND_MARGIN_DOTS * 2;
  return (
    `<rect x="${backgroundX}" y="${backgroundY}" width="${backgroundWidth}" ` +
    `height="${backgroundHeight}" fill="${INK_COLOR}"/>` +
    `<text x="${x}" y="${baselineY}" fill="${PAPER_COLOR}" font-size="${fontSizeDots}" ` +
    `font-family="${MONOSPACE_FONT_FAMILY}"${rotation}>${escapeXml(element.content)}</text>`
  );
}

function renderBoxElement(element: Extract<PrintElement, { type: 'box' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS_DOTS;
  if (thickness >= Math.min(options.width, options.height)) {
    return (
      `<rect x="${options.x}" y="${options.y}" width="${options.width}" ` +
      `height="${options.height}" fill="${INK_COLOR}"/>`
    );
  }
  return (
    `<rect x="${options.x + thickness / 2}" y="${options.y + thickness / 2}" ` +
    `width="${options.width - thickness}" height="${options.height - thickness}" ` +
    `fill="none" stroke="${INK_COLOR}" stroke-width="${thickness}"/>`
  );
}

/**
 * EPL2 không có lệnh vẽ đường chéo thật — trục ngang/dọc vẽ bằng rect đặc,
 * còn lại vẽ `<line>` (không đúng với máy in thật, nhưng giữ nguyên hành vi
 * hiện có, không tự sửa).
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

function renderTableElement(element: Extract<PrintElement, { type: 'table' }>): string {
  const { options } = element;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const rowHeight = resolveFontSizeDots(undefined, 1);
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
    case 'box':
      return renderBoxElement(element);
    case 'line':
      return renderLineElement(element);
    case 'diagonal':
      return renderDiagonalElement(element);
    // Preview EPL chỉ hỗ trợ text/box/line/diagonal/table — các loại còn lại
    // không có rendering riêng, giữ case rõ ràng để switch luôn exhaustive.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
    case 'image':
    case 'raw':
      return '';
    case 'table':
      return renderTableElement(element);
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

/** Render preview EPL2 thành SVG, dùng đúng bảng font của EPL2. */
export class EplPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    const documentWidth = document.widthDots;
    const documentHeight = document.heightDots > 0 ? document.heightDots : DEFAULT_CANVAS_HEIGHT_DOTS;
    const svgWidth = documentWidth + CANVAS_PADDING_DOTS * 2;
    const svgHeight = documentHeight + CANVAS_PADDING_DOTS * 2;

    let renderedElements = '';
    for (const element of document.elements) renderedElements += renderElement(element);

    const caption = `${documentWidth}×${documentHeight} dots — EPL`;

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
