import type { ResolvedPrintDocument } from '../document';
import type { PrintElement } from '../document/elements/PrintElement';
import { formatTable, validateTableColumns } from '../formatting';

/**
 * Default SVG preview renderer, shared by languages with no bespoke preview
 * (DPL, SBPL, IPL). Font sizing is a generic size/yScale heuristic, not a
 * real per-printer font table, matching what those languages delegate to.
 */

const CANVAS_PADDING_DOTS = 10;
const DEFAULT_CANVAS_HEIGHT_DOTS = 400;
const CANVAS_BACKGROUND_COLOR = '#f5f5f4';
const CANVAS_BORDER_COLOR = '#e5e5e5';
const CAPTION_COLOR = '#a1a1aa';
const INK_COLOR = '#000';
const PAPER_COLOR = '#fff';
const DEFAULT_LINE_THICKNESS_DOTS = 1;

const MIN_FONT_SIZE_DOTS = 8;
const BASE_GLYPH_HEIGHT_DOTS = 12;
const YSCALE_TRUST_THRESHOLD_DOTS = 10;
const PROPORTIONAL_FONT_BASELINE_RATIO = 0.78;
const MONOSPACE_FONT_BASELINE_RATIO = 0.82;
const PROPORTIONAL_FONT_CODE = '0';
const PROPORTIONAL_FONT_FAMILY = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONOSPACE_FONT_FAMILY = 'monospace';

/**
 * No font-metrics table to derive row spacing from, so a fixed value is used
 * — intentionally duplicated in DplCompiler.ts, which lives in a different
 * layer with no shared module to import from.
 */
const TABLE_ROW_HEIGHT_DOTS = 16;
const TABLE_ROW_BASELINE_RATIO = 0.85;

const IMAGE_PREVIEW_MAX_SAMPLES = 100;

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * `yScale` above this threshold is a real dot height, used directly;
 * otherwise `size` scales a base glyph height.
 */
function resolveFontSizeDots(size: number, yScale?: number): number {
  if (yScale && yScale > YSCALE_TRUST_THRESHOLD_DOTS) return yScale;
  return Math.max(MIN_FONT_SIZE_DOTS, size * BASE_GLYPH_HEIGHT_DOTS);
}

/**
 * Fraction of the glyph cell's height used to place the baseline below `y`
 * — the proportional font sits a bit higher than monospace/bitmap fonts.
 */
function resolveBaselineRatio(font?: string): number {
  return font === PROPORTIONAL_FONT_CODE ? PROPORTIONAL_FONT_BASELINE_RATIO : MONOSPACE_FONT_BASELINE_RATIO;
}

function resolveFontFamily(font?: string): string {
  return font === PROPORTIONAL_FONT_CODE ? PROPORTIONAL_FONT_FAMILY : MONOSPACE_FONT_FAMILY;
}

function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const fontSizeDots = resolveFontSizeDots(options.size ?? 1, options.yScale);
  const baselineRatio = resolveBaselineRatio(options.font);
  const fontFamily = resolveFontFamily(options.font);
  const fontWeight = options.bold ? 'bold' : 'normal';
  const textDecoration = options.underline ? ' text-decoration="underline"' : '';
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
  const baselineY = Math.round((y + fontSizeDots * baselineRatio) * 100) / 100;
  return (
    `<text x="${textX}" y="${baselineY}" fill="${fill}" font-size="${fontSizeDots}" font-weight="${fontWeight}" ` +
    `font-family="${fontFamily}"${textAnchor}${textDecoration}${rotation}>${escapeXml(element.content)}</text>`
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
      // eslint-disable-next-line no-bitwise -- reading one packed pixel bit, per Bitmap's MSB-first convention
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
      `fill="${INK_COLOR}" rx="${cornerRadius}" ry="${cornerRadius}"/>`
    );
  }
  return (
    `<rect x="${options.x + thickness / 2}" y="${options.y + thickness / 2}" ` +
    `width="${options.width - thickness}" height="${options.height - thickness}" ` +
    `fill="none" stroke="${INK_COLOR}" stroke-width="${thickness}" rx="${cornerRadius}" ry="${cornerRadius}"/>`
  );
}

function renderLineElement(element: Extract<PrintElement, { type: 'line' | 'diagonal' }>): string {
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
  validateTableColumns(options.columns);
  const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);
  const rowBaselineOffset = TABLE_ROW_HEIGHT_DOTS * TABLE_ROW_BASELINE_RATIO;

  return formatTable(options.columns, options.rows, totalWidth)
    .map((line, index) => {
      const rowY = y + index * TABLE_ROW_HEIGHT_DOTS + rowBaselineOffset;
      return (
        `<text x="${x}" y="${rowY}" fill="${INK_COLOR}" font-size="${TABLE_ROW_HEIGHT_DOTS}" ` +
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
    case 'diagonal':
      return renderLineElement(element);
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
    // No visual representation on the label: cut is a post-print printer action;
    // barcode/qrcode/pageBreak/spacer/row/column have no rendering here (documented
    // no-ops elsewhere too) — kept as explicit cases so the switch stays exhaustive.
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

/**
 * Renders a document preview as an SVG, using generic size-based font
 * metrics rather than any one printer language's own font table.
 */
export function renderPreview(document: ResolvedPrintDocument): string {
  const documentWidth = document.widthDots;
  const documentHeight = document.heightDots > 0 ? document.heightDots : DEFAULT_CANVAS_HEIGHT_DOTS;
  const svgWidth = documentWidth + CANVAS_PADDING_DOTS * 2;
  const svgHeight = documentHeight + CANVAS_PADDING_DOTS * 2;

  let renderedElements = '';
  for (const element of document.elements) {
    renderedElements += renderElement(element);
  }

  const svgOpenTag =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" ` +
    `width="${svgWidth}" height="${svgHeight}">`;
  const backgroundRect =
    `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="${CANVAS_BACKGROUND_COLOR}" rx="4"/>`;
  const paperRect =
    `<rect x="${CANVAS_PADDING_DOTS}" y="${CANVAS_PADDING_DOTS}" width="${documentWidth}" height="${documentHeight}" ` +
    `fill="${PAPER_COLOR}" stroke="${CANVAS_BORDER_COLOR}" stroke-width="1" rx="2"/>`;
  const captionText = `${documentWidth}×${documentHeight} dots (${document.dpi} DPI)`;
  const caption =
    `<text x="${svgWidth / 2}" y="${svgHeight - 1}" text-anchor="middle" fill="${CAPTION_COLOR}" ` +
    `font-size="8" font-family="${MONOSPACE_FONT_FAMILY}">${captionText}</text>`;

  return [
    svgOpenTag,
    backgroundRect,
    paperRect,
    `<g transform="translate(${CANVAS_PADDING_DOTS},${CANVAS_PADDING_DOTS})">`,
    renderedElements,
    '</g>',
    caption,
    '</svg>',
  ].join('\n');
}
