import type { ResolvedPrintDocument } from '../../../document';
import type { PrintElement } from '../../../document/elements/PrintElement';
import type { PrintPreview } from '../../../core';

const DEFAULT_RECEIPT_WIDTH = 576;
const BASE_FONT_HEIGHT = 12;
const LINE_HEIGHT_PAD = 4;
const TOP_MARGIN = 10;
const CANVAS_PADDING = 5;
const TEXT_EDGE_MARGIN = 5;
const MIN_CANVAS_HEIGHT = 200;
const INK_COLOR = '#000';
const PAPER_COLOR = '#fff';
const CANVAS_BACKGROUND = '#f5f5f0';
const CANVAS_BORDER = '#e5e5e5';
const CAPTION_COLOR = '#a1a1aa';
const FONT_FAMILY = 'monospace';

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resolveTextAnchor(align: string): string {
  if (align === 'center') return 'middle';
  if (align === 'right') return 'end';
  return 'start';
}

function resolveTextX(align: string, receiptWidth: number): number {
  if (align === 'center') return receiptWidth / 2;
  if (align === 'right') return receiptWidth - TEXT_EDGE_MARGIN;
  return TEXT_EDGE_MARGIN;
}

/** Chiều cao dòng theo hệ số phóng đại `size` của ESC/POS (base 12 dots/bước). */
function resolveFontSize(size: number): number {
  return size * BASE_FONT_HEIGHT;
}

function renderTextLine(
  element: Extract<PrintElement, { type: 'text' }>,
  receiptWidth: number,
  y: number,
): string {
  const options = element.options ?? {};
  const fontSize = resolveFontSize(options.size ?? 1);
  const align = options.align ?? 'left';
  const textAnchor = resolveTextAnchor(align);
  const x = resolveTextX(align, receiptWidth);
  const fontWeight = options.bold ? 'bold' : 'normal';
  const textDecoration = options.underline ? ' text-decoration="underline"' : '';
  const text = escapeXml(element.content);
  const fill = options.reverse ? PAPER_COLOR : INK_COLOR;

  const reverseBackgroundHeight = fontSize + LINE_HEIGHT_PAD;
  const reverseBackground = options.reverse
    ? `<rect x="0" y="${y}" width="${receiptWidth}" height="${reverseBackgroundHeight}" fill="${INK_COLOR}"/>`
    : '';

  const textLine =
    `<text x="${x}" y="${y + fontSize}" fill="${fill}" ` +
    `font-size="${fontSize}" font-weight="${fontWeight}" ` +
    `font-family="${FONT_FAMILY}" text-anchor="${textAnchor}"${textDecoration}>${text}</text>`;

  return reverseBackground + textLine;
}

/**
 * Render preview ESC/POS dạng receipt: các phần tử xếp chồng theo chiều dọc
 * theo chiều cao dòng, không có toạ độ x/y tuyệt đối — khớp với mô hình in
 * từng dòng, không định vị của ESC/POS.
 */
export class EscPosPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    const receiptWidth = document.widthDots > 0 ? document.widthDots : DEFAULT_RECEIPT_WIDTH;
    let y = TOP_MARGIN;
    let body = '';

    for (const element of document.elements) {
      if (element.type !== 'text') continue;
      body += renderTextLine(element, receiptWidth, y);
      y += resolveFontSize(element.options?.size ?? 1) + LINE_HEIGHT_PAD;
    }

    const contentHeight = Math.max(y + TOP_MARGIN, MIN_CANVAS_HEIGHT);
    const svgWidth = receiptWidth + CANVAS_PADDING * 2;
    const svgHeight = contentHeight + CANVAS_PADDING * 2;
    const caption = `${receiptWidth} dots — ESC/POS`;

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" ` +
      `width="${svgWidth}" height="${svgHeight}">` +
      `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="${CANVAS_BACKGROUND}" rx="2"/>` +
      `<rect x="${CANVAS_PADDING}" y="${CANVAS_PADDING}" width="${receiptWidth}" height="${contentHeight}" ` +
      `fill="${PAPER_COLOR}" stroke="${CANVAS_BORDER}" stroke-width="1"/>` +
      `<g transform="translate(${CANVAS_PADDING},${CANVAS_PADDING})">${body}</g>` +
      `<text x="${svgWidth / 2}" y="${svgHeight - 1}" text-anchor="middle" fill="${CAPTION_COLOR}" font-size="8" ` +
      `font-family="${FONT_FAMILY}">${caption}</text></svg>`
    );
  }
}
