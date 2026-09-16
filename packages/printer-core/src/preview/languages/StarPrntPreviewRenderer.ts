import type { ResolvedPrintDocument } from '../../document';
import type { PrintPreview } from '../../core';

const DEFAULT_RECEIPT_WIDTH_DOTS = 576;
const LINE_HEIGHT_PAD = 4;
const TOP_MARGIN = 10;
const CANVAS_PADDING = 5;
const MIN_CANVAS_HEIGHT = 200;

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Renders a Star PRNT document preview as a receipt-style SVG, same
 * vertical-stack layout as `EscPosPreviewRenderer`. Direct port of
 * portakal's `renderReceiptSVG()` for `lang/starprnt.ts` — including a gap
 * already present there: it renders bold and size but not `reverse` or
 * `underline`, even though `StarPrntCompiler`'s text case supports
 * underline. Kept as-is (a faithful port, not a redesign); see this task's
 * report for the reverse/underline preview support left as a possible
 * future enhancement.
 */
export class StarPrntPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    const width = document.widthDots > 0 ? document.widthDots : DEFAULT_RECEIPT_WIDTH_DOTS;
    let y = TOP_MARGIN;
    let body = '';

    for (const element of document.elements) {
      if (element.type !== 'text') continue;
      const o = element.options ?? {};

      const fontSize = (o.size ?? 1) * 12;
      const align = o.align ?? 'left';
      const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      const x = align === 'center' ? width / 2 : align === 'right' ? width - 5 : 5;
      const weight = o.bold ? 'bold' : 'normal';
      const text = escapeXml(element.content);

      body += `<text x="${x}" y="${y + fontSize}" fill="#000" font-size="${fontSize}" font-weight="${weight}" font-family="monospace" text-anchor="${anchor}">${text}</text>`;
      y += fontSize + LINE_HEIGHT_PAD;
    }

    const height = Math.max(y + TOP_MARGIN, MIN_CANVAS_HEIGHT);
    const pad = CANVAS_PADDING;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width + pad * 2} ${height + pad * 2}" width="${width + pad * 2}" height="${height + pad * 2}"><rect x="0" y="0" width="${width + pad * 2}" height="${height + pad * 2}" fill="#f5f5f0" rx="2"/><rect x="${pad}" y="${pad}" width="${width}" height="${height}" fill="#fff" stroke="#e5e5e5" stroke-width="1"/><g transform="translate(${pad},${pad})">${body}</g><text x="${(width + pad * 2) / 2}" y="${height + pad * 2 - 1}" text-anchor="middle" fill="#a1a1aa" font-size="8" font-family="monospace">${width} dots — Star PRNT</text></svg>`;
  }
}
