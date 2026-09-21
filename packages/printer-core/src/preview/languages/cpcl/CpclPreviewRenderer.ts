import type { ResolvedPrintDocument } from '../../../document';
import type { PrintElement } from '../../../document/elements/PrintElement';
import type { PrintPreview } from '../../../core';

/** Kích thước pixel font bitmap có sẵn của CPCL, theo Zebra CPCL Font Manual (ZQ210/ZQ220). */
const CPCL_FONTS: Record<string, { width: number; height: number }> = {
  '0': { width: 8, height: 9 },
  '1': { width: 16, height: 48 },
  '2': { width: 20, height: 12 },
  '4': { width: 25, height: 47 },
  '5': { width: 16, height: 24 },
  '6': { width: 28, height: 27 },
  '7': { width: 12, height: 24 },
};

const DEFAULT_FONT = '2';
const FALLBACK_FONT_HEIGHT = 12;
const TEXT_BASELINE_RATIO = 0.85;
const DEFAULT_LINE_THICKNESS = 1;

const CANVAS_PADDING = 10;
const DEFAULT_CANVAS_HEIGHT = 400;
const CANVAS_BACKGROUND = '#f5f5f4';
const CANVAS_BORDER = '#e5e5e5';
const CAPTION_COLOR = '#a1a1aa';
const INK_COLOR = '#000';
const PAPER_COLOR = '#fff';
const FONT_FAMILY = 'monospace';

function getCpclFont(font: string | undefined) {
  return CPCL_FONTS[font ?? DEFAULT_FONT];
}

function resolveFontSize(font: string | undefined, size: number | undefined): number {
  const cpclFont = getCpclFont(font);
  if (cpclFont) return cpclFont.height * Math.max(1, size ?? 1);
  return (size ?? 1) * FALLBACK_FONT_HEIGHT;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTextElement(element: Extract<PrintElement, { type: 'text' }>): string {
  const options = element.options ?? {};
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const fontSize = resolveFontSize(options.font, options.size);
  const baselineY = y + fontSize * TEXT_BASELINE_RATIO;

  return (
    `<text x="${x}" y="${baselineY}" fill="${INK_COLOR}" font-size="${fontSize}" ` +
    `font-family="${FONT_FAMILY}">${escapeXml(element.content)}</text>`
  );
}

function renderBoxElement(element: Extract<PrintElement, { type: 'box' }>): string {
  const { options } = element;
  const thickness = options.thickness ?? DEFAULT_LINE_THICKNESS;

  return (
    `<rect x="${options.x + thickness / 2}" ` +
    `y="${options.y + thickness / 2}" ` +
    `width="${options.width - thickness}" ` +
    `height="${options.height - thickness}" ` +
    `fill="none" stroke="${INK_COLOR}" stroke-width="${thickness}"/>`
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

function renderElement(element: PrintElement): string {
  switch (element.type) {
    case 'text':
      return renderTextElement(element);

    case 'box':
      return renderBoxElement(element);

    // Lệnh LINE gốc của CPCL vẽ được đường thẳng giữa 2 điểm bất kỳ, không cần
    // tách trục thẳng/chéo như EPL2/ZPL — khớp cách CpclCompiler ghép chung
    // case 'line'/'diagonal'.
    case 'line':
    case 'diagonal':
      return renderLineElement(element);

    // Preview CPCL chỉ hỗ trợ text/box/line — các loại còn lại không có
    // rendering riêng, giữ case rõ ràng để switch luôn exhaustive.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
    case 'image':
    case 'raw':
    case 'barcode':
    case 'qrcode':
    case 'cut':
    case 'table':
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';
  }
}

/** Render preview CPCL thành SVG, dùng đúng bảng font của CPCL. */
export class CpclPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    const documentWidth = document.widthDots;
    const documentHeight = document.heightDots > 0 ? document.heightDots : DEFAULT_CANVAS_HEIGHT;
    const svgWidth = documentWidth + CANVAS_PADDING * 2;
    const svgHeight = documentHeight + CANVAS_PADDING * 2;

    let renderedElements = '';

    for (const element of document.elements) {
      renderedElements += renderElement(element);
    }

    const caption = `${documentWidth}×${documentHeight} dots — CPCL`;

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
        `font-family="${FONT_FAMILY}">${caption}</text>`,

      '</svg>',
    ].join('\n');
  }
}
