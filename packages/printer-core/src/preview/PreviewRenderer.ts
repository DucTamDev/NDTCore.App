import type { ResolvedPrintDocument } from '../document';
import type { PrintElement } from '../document/elements/PrintElement';
import { formatTable, validateTableColumns } from '../formatting';

/**
 * Renderer SVG mặc định, dùng chung cho các ngôn ngữ không có preview riêng
 * (DPL, SBPL, IPL). Cỡ chữ tính theo công thức chung size/yScale, không phải
 * bảng font thật của từng máy in — khớp với cách các ngôn ngữ này uỷ quyền.
 */

const CANVAS_PADDING = 10;
const DEFAULT_CANVAS_HEIGHT = 400;
const CANVAS_BACKGROUND = '#f5f5f4';
const CANVAS_BORDER = '#e5e5e5';
const CAPTION_COLOR = '#a1a1aa';
const INK_COLOR = '#000';
const PAPER_COLOR = '#fff';
const DEFAULT_LINE_THICKNESS = 1;

const MIN_FONT_SIZE = 8;
const BASE_GLYPH_HEIGHT = 12;
const YSCALE_TRUST_THRESHOLD = 10;
const PROPORTIONAL_FONT_BASELINE_RATIO = 0.78;
const MONOSPACE_FONT_BASELINE_RATIO = 0.82;
const PROPORTIONAL_FONT_CODE = '0';
const PROPORTIONAL_FONT_FAMILY = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONOSPACE_FONT_FAMILY = 'monospace';

/**
 * Không có bảng font-metrics để tính khoảng cách dòng, nên dùng giá trị cố
 * định — cố ý trùng lặp với DplCompiler.ts, vì 2 file ở 2 layer khác nhau,
 * không có module chung nào để import.
 */
const TABLE_ROW_HEIGHT = 16;
const TABLE_ROW_BASELINE_RATIO = 0.85;

const IMAGE_MAX_SAMPLES = 100;

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * `yScale` vượt ngưỡng này được coi là chiều cao dots thật, dùng trực tiếp;
 * ngược lại `size` sẽ nhân với chiều cao glyph cơ sở.
 */
function resolveFontSize(size: number, yScale: number | undefined): number {
  if (yScale && yScale > YSCALE_TRUST_THRESHOLD) return yScale;
  return Math.max(MIN_FONT_SIZE, size * BASE_GLYPH_HEIGHT);
}

/**
 * Tỉ lệ chiều cao ô glyph dùng để đặt baseline bên dưới `y` — font tỉ lệ
 * (proportional) nằm cao hơn 1 chút so với font monospace/bitmap.
 */
function resolveBaselineRatio(font: string | undefined): number {
  return font === PROPORTIONAL_FONT_CODE ? PROPORTIONAL_FONT_BASELINE_RATIO : MONOSPACE_FONT_BASELINE_RATIO;
}

function resolveFontFamily(font: string | undefined): string {
  return font === PROPORTIONAL_FONT_CODE ? PROPORTIONAL_FONT_FAMILY : MONOSPACE_FONT_FAMILY;
}

function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const fontSize = resolveFontSize(options.size ?? 1, options.yScale);
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
  const baselineY = Math.round((y + fontSize * baselineRatio) * 100) / 100;

  return (
    `<text x="${textX}" y="${baselineY}" fill="${fill}" ` +
    `font-size="${fontSize}" font-weight="${fontWeight}" ` +
    `font-family="${fontFamily}"${textAnchor}${textDecoration}${rotation}>` +
    `${escapeXml(element.content)}</text>`
  );
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
  const cornerRadius = options.radius ?? 0;

  if (thickness >= Math.min(options.width, options.height)) {
    return (
      `<rect x="${options.x}" y="${options.y}" ` +
      `width="${options.width}" height="${options.height}" ` +
      `fill="${INK_COLOR}" rx="${cornerRadius}" ry="${cornerRadius}"/>`
    );
  }

  return (
    `<rect x="${options.x + thickness / 2}" ` +
    `y="${options.y + thickness / 2}" ` +
    `width="${options.width - thickness}" ` +
    `height="${options.height - thickness}" ` +
    `fill="none" stroke="${INK_COLOR}" ` +
    `stroke-width="${thickness}" rx="${cornerRadius}" ry="${cornerRadius}"/>`
  );
}

function renderLineElement(element: Extract<PrintElement, { type: 'line' | 'diagonal' }>): string {
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
    `fill="none" stroke="${INK_COLOR}" stroke-width="${thickness}"/>`
  );
}

function renderTableElement(element: Extract<PrintElement, { type: 'table' }>): string {
  const { options } = element;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const rowBaselineOffset = TABLE_ROW_HEIGHT * TABLE_ROW_BASELINE_RATIO;

  validateTableColumns(options.columns);

  const totalWidth = options.columns.reduce((sum, column) => sum + column.width, 0);

  return formatTable(options.columns, options.rows, totalWidth)
    .map((line, index) => {
      const rowY = y + index * TABLE_ROW_HEIGHT + rowBaselineOffset;

      return (
        `<text x="${x}" y="${rowY}" fill="${INK_COLOR}" font-size="${TABLE_ROW_HEIGHT}" ` +
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

    // Không có biểu diễn hình ảnh trên tem: cut là hành động sau khi in;
    // barcode/qrcode/pageBreak/spacer/row/column không render ở đây (cũng
    // là no-op ở các nơi khác) — giữ case rõ ràng để switch luôn exhaustive.
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
 * Render preview của document thành SVG, dùng công thức font chung theo
 * size thay vì bảng font thật của một ngôn ngữ máy in cụ thể nào.
 */
export function renderPreview(document: ResolvedPrintDocument): string {
  const documentWidth = document.widthDots;
  const documentHeight = document.heightDots > 0 ? document.heightDots : DEFAULT_CANVAS_HEIGHT;
  const svgWidth = documentWidth + CANVAS_PADDING * 2;
  const svgHeight = documentHeight + CANVAS_PADDING * 2;

  let renderedElements = '';

  for (const element of document.elements) {
    renderedElements += renderElement(element);
  }

  const captionText = `${documentWidth}×${documentHeight} dots (${document.dpi} DPI)`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `viewBox="0 0 ${svgWidth} ${svgHeight}" ` +
      `width="${svgWidth}" height="${svgHeight}">`,

    `<rect x="0" y="0" width="${svgWidth}" ` + `height="${svgHeight}" fill="${CANVAS_BACKGROUND}" rx="4"/>`,

    `<rect x="${CANVAS_PADDING}" y="${CANVAS_PADDING}" ` +
      `width="${documentWidth}" height="${documentHeight}" ` +
      `fill="${PAPER_COLOR}" stroke="${CANVAS_BORDER}" ` +
      `stroke-width="1" rx="2"/>`,

    `<g transform="translate(${CANVAS_PADDING},${CANVAS_PADDING})">`,
    renderedElements,
    '</g>',

    `<text x="${svgWidth / 2}" y="${svgHeight - 1}" ` +
      `text-anchor="middle" fill="${CAPTION_COLOR}" ` +
      `font-size="8" font-family="${MONOSPACE_FONT_FAMILY}">` +
      `${captionText}</text>`,

    '</svg>',
  ].join('\n');
}
