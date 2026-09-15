import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrintPreview } from '../../core';

/** CPCL built-in bitmap-font pixel dimensions, per the Zebra CPCL Font Manual (ZQ210/ZQ220). */
const CPCL_FONTS: Record<string, { w: number; h: number }> = {
  '0': { w: 8, h: 9 },
  '1': { w: 16, h: 48 },
  '2': { w: 20, h: 12 },
  '4': { w: 25, h: 47 },
  '5': { w: 16, h: 24 },
  '6': { w: 28, h: 27 },
  '7': { w: 12, h: 24 },
};

const DEFAULT_FONT = '2';
const FALLBACK_FONT_HEIGHT_UNIT = 12;

function cpclFontSize(font: string | undefined, size: number | undefined): number {
  const f = CPCL_FONTS[font ?? DEFAULT_FONT];
  return f ? f.h * Math.max(1, size ?? 1) : (size ?? 1) * FALLBACK_FONT_HEIGHT_UNIT;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderElement(element: PrintElement): string {
  switch (element.type) {
    case 'text': {
      const o = element.options ?? {};
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const fs = cpclFontSize(o.font, o.size);
      return `<text x="${x}" y="${y + fs * 0.85}" fill="#000" font-size="${fs}" font-family="monospace">${escapeXml(element.content)}</text>`;
    }

    case 'box': {
      const o = element.options;
      const t = o.thickness ?? 1;
      return `<rect x="${o.x + t / 2}" y="${o.y + t / 2}" width="${o.width - t}" height="${o.height - t}" fill="none" stroke="#000" stroke-width="${t}"/>`;
    }

    // CPCL's native LINE command draws a straight line between any two
    // points — no axis-aligned/diagonal split needed, unlike EPL2's/ZPL's
    // preview renderers, matching `CpclCompiler`'s own `'line'`/`'diagonal'`
    // pairing.
    case 'line':
    case 'diagonal': {
      const o = element.options;
      return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#000" stroke-width="${o.thickness ?? 1}"/>`;
    }

    // portakal's own CPCL preview (`lang/cpcl.ts`) only implements text/box/
    // line — every other case (including its own recognized `LabelElement`
    // variants circle/ellipse/reverse/erase/image/raw) falls through its
    // `default: return ""`, a genuine portakal-native limitation, not a bug
    // to fix here. `barcode`/`qrcode`/`cut`/`table`/`pageBreak`/`spacer`/
    // `row`/`column` have no portakal precedent at all — kept in this same
    // no-op bucket only so the switch stays exhaustive over this package's
    // wider `PrintElement` union.
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

const CANVAS_PADDING = 10;
const DEFAULT_CANVAS_HEIGHT = 400; // matches portakal's own CPCL preview fallback

/** Renders a CPCL document preview as an SVG, using CPCL's own font metrics. */
export class CpclPreviewRenderer implements PrintPreview {
  preview(document: ResolvedPrintDocument): string {
    const w = document.widthDots;
    const h = document.heightDots > 0 ? document.heightDots : DEFAULT_CANVAS_HEIGHT;
    const pad = CANVAS_PADDING;
    const svgW = w + pad * 2;
    const svgH = h + pad * 2;

    let els = '';
    for (const element of document.elements) els += renderElement(element);

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">`,
      `<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#f5f5f4" rx="4"/>`,
      `<rect x="${pad}" y="${pad}" width="${w}" height="${h}" fill="#fff" stroke="#e5e5e5" stroke-width="1" rx="2"/>`,
      `<g transform="translate(${pad},${pad})">`,
      els,
      '</g>',
      `<text x="${svgW / 2}" y="${svgH - 1}" text-anchor="middle" fill="#a1a1aa" font-size="8" font-family="monospace">${w}×${h} dots — CPCL</text>`,
      '</svg>',
    ].join('\n');
  }
}
