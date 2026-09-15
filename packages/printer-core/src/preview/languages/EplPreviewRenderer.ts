import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrintPreview } from '../../core';
import { formatTable, validateTableColumns } from '../../receipt';

/** EPL2 built-in bitmap-font pixel dimensions, per the EPL2 Programmer's Guide's font table. */
const EPL_FONTS: Record<string, { w: number; h: number }> = {
  '1': { w: 8, h: 12 },
  '2': { w: 10, h: 16 },
  '3': { w: 12, h: 20 },
  '4': { w: 14, h: 24 },
  '5': { w: 32, h: 48 },
};

const DEFAULT_FONT = '2';
const FALLBACK_FONT_HEIGHT_UNIT = 16;
const FALLBACK_CHAR_WIDTH_UNIT = 10;

function eplFontSize(font: string | undefined, size: number | undefined): number {
  const f = EPL_FONTS[font ?? DEFAULT_FONT];
  return f ? f.h * (size ?? 1) : (size ?? 1) * FALLBACK_FONT_HEIGHT_UNIT;
}

function eplCharWidth(font: string | undefined, size: number | undefined): number {
  const f = EPL_FONTS[font ?? DEFAULT_FONT];
  return f ? f.w * (size ?? 1) : (size ?? 1) * FALLBACK_CHAR_WIDTH_UNIT;
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
      const fs = eplFontSize(o.font, o.size);
      const cw = eplCharWidth(o.font, o.size);
      const rotation = o.rotation ? ` transform="rotate(${o.rotation} ${x} ${y})"` : '';
      if (o.reverse) {
        const tw = element.content.length * cw;
        return `<rect x="${x - 1}" y="${y - 1}" width="${tw + 2}" height="${fs + 2}" fill="#000"/><text x="${x}" y="${y + fs * 0.85}" fill="#fff" font-size="${fs}" font-family="monospace"${rotation}>${escapeXml(element.content)}</text>`;
      }
      return `<text x="${x}" y="${y + fs * 0.85}" fill="#000" font-size="${fs}" font-family="monospace"${rotation}>${escapeXml(element.content)}</text>`;
    }

    case 'box': {
      const o = element.options;
      const t = o.thickness ?? 1;
      if (t >= Math.min(o.width, o.height)) return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#000"/>`;
      return `<rect x="${o.x + t / 2}" y="${o.y + t / 2}" width="${o.width - t}" height="${o.height - t}" fill="none" stroke="#000" stroke-width="${t}"/>`;
    }

    // Axis-aligned or genuinely diagonal — unlike `EplCompiler`'s `'line'`
    // case (whose non-axis-aligned fallback is a broken x-span-only
    // approximation ported as-is from portakal's compiler), portakal's own
    // EPL *preview* (`lang/epl.ts`) renders this fallback as a real `<line>`
    // — a genuine, portakal-native disconnect between preview and actual
    // compiled output (EPL2 has no diagonal print command), ported here
    // faithfully rather than "fixed" to match the compiler's limitation.
    case 'line': {
      const o = element.options;
      const t = o.thickness ?? 1;
      if (o.y1 === o.y2) return `<rect x="${Math.min(o.x1, o.x2)}" y="${o.y1}" width="${Math.abs(o.x2 - o.x1)}" height="${t}" fill="#000"/>`;
      if (o.x1 === o.x2) return `<rect x="${o.x1}" y="${Math.min(o.y1, o.y2)}" width="${t}" height="${Math.abs(o.y2 - o.y1)}" fill="#000"/>`;
      return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#000" stroke-width="${t}"/>`;
    }

    // The non-axis-aligned case `'line'` used to fall back to — moved here
    // as-is, same precedent `TscPreviewRenderer`'s/`ZplPreviewRenderer`'s own
    // `'line'`/`'diagonal'` split documents.
    case 'diagonal': {
      const o = element.options;
      const t = o.thickness ?? 1;
      return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#000" stroke-width="${t}"/>`;
    }

    // portakal's own EPL preview (`lang/epl.ts`) returns `""` for all of
    // these — a genuine, portakal-native limitation (not a bug to fix here):
    // circle/ellipse/reverse/erase/image/raw are recognized element types in
    // its `LabelElement` union, but none of them have real rendering logic
    // in its `renderElement()`. Ported as-is.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
    case 'image':
    case 'raw':
      return '';

    // Real behavior: format the rows into text lines via the shared
    // `formatTable()` (same helper `EplCompiler`'s `'table'` case uses),
    // then render each line as its own `<text>`, stacked one default-font
    // row height apart starting at the table's own y.
    case 'table': {
      const o = element.options;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const rowHeight = eplFontSize(undefined, 1);
      validateTableColumns(o.columns);
      const totalWidth = o.columns.reduce((sum, column) => sum + column.width, 0);
      const lines = formatTable(o.columns, o.rows, totalWidth);
      return lines
        .map((line, i) => `<text x="${x}" y="${y + i * rowHeight + rowHeight * 0.85}" fill="#000" font-size="${rowHeight}" font-family="monospace">${escapeXml(line)}</text>`)
        .join('');
    }

    // Not in portakal's `renderElement()` (its `LabelElement` union has no
    // barcode/qrcode variant, same gap `TscPreviewRenderer` documents for
    // its own barcode/qrcode cases) — kept here only so the switch stays
    // exhaustive over this package's wider `PrintElement` union.
    // `cut`/`pageBreak`/`spacer`/`row`/`column` have no visual
    // representation on the label itself — `cut` is a post-print printer
    // action, the other 4 are documented no-ops in `EplCompiler` too (no
    // auto-layout primitive), per the design spec.
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

const CANVAS_PADDING = 10;
const DEFAULT_CANVAS_HEIGHT = 400; // matches portakal's own EPL preview fallback

/** Renders an EPL2 document preview as an SVG, using EPL2's own font metrics. */
export class EplPreviewRenderer implements PrintPreview {
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
      `<text x="${svgW / 2}" y="${svgH - 1}" text-anchor="middle" fill="#a1a1aa" font-size="8" font-family="monospace">${w}×${h} dots — EPL</text>`,
      '</svg>',
    ].join('\n');
  }
}
