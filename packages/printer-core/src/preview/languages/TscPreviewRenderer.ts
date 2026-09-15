import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrintPreview } from '../../core';
import type { TextOptions } from '../../builder/content/TextElement';
import type { ImageOptions } from '../../builder/content/ImageElement';
import type { BoxOptions } from '../../builder/drawing/BoxElement';
import type { CircleOptions } from '../../builder/drawing/CircleElement';
import type { EllipseOptions } from '../../builder/drawing/EllipseElement';
import type { ReverseOptions } from '../../builder/drawing/ReverseElement';
import type { EraseOptions } from '../../builder/drawing/EraseElement';
import { formatTable } from '../../receipt';

/** TSC built-in bitmap-font pixel dimensions, per the TSPL/TSPL2 Programming Manual's font table. */
const TSC_FONTS: Record<string, { w: number; h: number }> = {
  '1': { w: 8, h: 12 },
  '2': { w: 12, h: 20 },
  '3': { w: 16, h: 24 },
  '4': { w: 24, h: 32 },
  '5': { w: 32, h: 48 },
  '6': { w: 14, h: 19 },
  '7': { w: 21, h: 27 },
  '8': { w: 14, h: 25 },
};

const DEFAULT_FONT = '2';
const DEFAULT_TTF_POINT_SIZE = 12;
/** 1pt ~ 2.82 dots at 203 DPI — approximation for font "0"/TrueType fonts, which aren't in `TSC_FONTS`. */
const DOTS_PER_POINT_AT_203_DPI = 2.82;
const APPROX_TTF_CHAR_WIDTH_RATIO = 1.7;

const CANVAS_PADDING = 10;
const DEFAULT_CANVAS_HEIGHT = 400;
const IMAGE_PREVIEW_MAX_SAMPLES = 100;

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tscFontSize(font: string | undefined, size: number | undefined, yScale?: number): number {
  if (yScale && yScale > 1) {
    const base = TSC_FONTS[font ?? DEFAULT_FONT];
    if (base) return base.h * yScale;
  }
  const f = TSC_FONTS[font ?? DEFAULT_FONT];
  if (f) return f.h * (size ?? 1);
  return (size ?? DEFAULT_TTF_POINT_SIZE) * DOTS_PER_POINT_AT_203_DPI;
}

function tscCharWidth(font: string | undefined, size: number | undefined, xScale?: number): number {
  const f = TSC_FONTS[font ?? DEFAULT_FONT];
  if (f) return f.w * (xScale ?? size ?? 1);
  return (size ?? DEFAULT_TTF_POINT_SIZE) * APPROX_TTF_CHAR_WIDTH_RATIO;
}

function renderElement(element: PrintElement): string {
  switch (element.type) {
    case 'text': {
      const o = element.options as TextOptions;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const fs = tscFontSize(o.font, o.size, o.yScale);
      const cw = tscCharWidth(o.font, o.size, o.xScale);
      const weight = o.bold ? 'bold' : 'normal';
      const transform = o.rotation ? ` transform="rotate(${o.rotation} ${x} ${y})"` : '';

      if (o.reverse) {
        const tw = element.content.length * cw;
        return (
          `<rect x="${x - 1}" y="${y - 1}" width="${tw + 2}" height="${fs + 2}" fill="#000"/>` +
          `<text x="${x}" y="${y + fs * 0.85}" fill="#fff" font-size="${fs}" font-weight="${weight}" font-family="monospace"${transform}>${escapeXml(element.content)}</text>`
        );
      }

      return `<text x="${x}" y="${y + fs * 0.85}" fill="#000" font-size="${fs}" font-weight="${weight}" font-family="monospace"${transform}>${escapeXml(element.content)}</text>`;
    }

    case 'image': {
      const o = element.options as ImageOptions;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const bmp = element.bitmap;
      const w = o.width ?? bmp.width;
      const h = o.height ?? bmp.height;
      const step = Math.max(1, Math.floor(Math.max(bmp.width, bmp.height) / IMAGE_PREVIEW_MAX_SAMPLES));
      const sx = w / bmp.width;
      const sy = h / bmp.height;
      let svg = '';
      for (let py = 0; py < bmp.height; py += step) {
        for (let px = 0; px < bmp.width; px += step) {
          const byteIdx = py * bmp.bytesPerRow + Math.floor(px / 8);
          const bitIdx = 7 - (px % 8);
          // eslint-disable-next-line no-bitwise -- reading one packed pixel bit, per Bitmap's MSB-first convention
          if ((bmp.data[byteIdx] >> bitIdx) & 1) {
            svg += `<rect x="${x + px * sx}" y="${y + py * sy}" width="${step * sx}" height="${step * sy}" fill="#000"/>`;
          }
        }
      }
      return svg;
    }

    case 'box': {
      const o = element.options as unknown as BoxOptions;
      const t = o.thickness ?? 1;
      const rx = o.radius ?? 0;
      if (t >= Math.min(o.width, o.height)) {
        return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#000" rx="${rx}"/>`;
      }
      return `<rect x="${o.x + t / 2}" y="${o.y + t / 2}" width="${o.width - t}" height="${o.height - t}" fill="none" stroke="#000" stroke-width="${t}" rx="${rx}"/>`;
    }

    // Axis-aligned only — a genuinely diagonal line is a separate `diagonal`
    // element/case below. The vertical branch's `return` stays unconditional
    // (not nested in an `x1===x2` `if`) so every path returns a string even
    // if a hand-built document bypasses `PrintBuilder.line()`'s axis-aligned
    // guarantee — that would otherwise fall through into the next switch
    // case. Same precedent as `TscCompiler.ts`'s `'line'`/`'diagonal'` split.
    case 'line': {
      const o = element.options;
      const t = o.thickness ?? 1;
      if (o.y1 === o.y2) {
        return `<rect x="${Math.min(o.x1, o.x2)}" y="${o.y1}" width="${Math.abs(o.x2 - o.x1)}" height="${t}" fill="#000"/>`;
      }
      return `<rect x="${o.x1}" y="${Math.min(o.y1, o.y2)}" width="${t}" height="${Math.abs(o.y2 - o.y1)}" fill="#000"/>`;
    }

    // The non-axis-aligned case `'line'` used to fall back to — moved here as-is.
    case 'diagonal': {
      const o = element.options;
      const t = o.thickness ?? 1;
      return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#000" stroke-width="${t}"/>`;
    }

    case 'circle': {
      const o = element.options as unknown as CircleOptions;
      const t = o.thickness ?? 1;
      const r = o.diameter / 2;
      if (t >= r) return `<circle cx="${o.x + r}" cy="${o.y + r}" r="${r}" fill="#000"/>`;
      return `<circle cx="${o.x + r}" cy="${o.y + r}" r="${r - t / 2}" fill="none" stroke="#000" stroke-width="${t}"/>`;
    }

    case 'ellipse': {
      const o = element.options as unknown as EllipseOptions;
      const t = o.thickness ?? 1;
      return `<ellipse cx="${o.x + o.width / 2}" cy="${o.y + o.height / 2}" rx="${o.width / 2}" ry="${o.height / 2}" fill="none" stroke="#000" stroke-width="${t}"/>`;
    }

    case 'reverse': {
      const o = element.options as unknown as ReverseOptions;
      return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#000"/>`;
    }

    case 'erase': {
      const o = element.options as unknown as EraseOptions;
      return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#fff"/>`;
    }

    // Real behavior: format the rows into text lines via the shared
    // `formatTable()` (same helper `TscCompiler`'s `'table'` case uses), then
    // render each line as its own `<text>`, stacked one default-font row
    // height (`tscFontSize(undefined, 1)`) apart starting at the table's y —
    // a table element carries no font option of its own.
    case 'table': {
      const o = element.options;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const rowHeight = tscFontSize(undefined, 1);
      const totalWidth = o.columns.reduce((sum, column) => sum + column.width, 0);
      const lines = formatTable(o.columns, o.rows, totalWidth);
      return lines
        .map((line, i) => `<text x="${x}" y="${y + i * rowHeight + rowHeight * 0.85}" fill="#000" font-size="${rowHeight}" font-family="monospace">${escapeXml(line)}</text>`)
        .join('');
    }

    // Not in portakal's `renderElement()` (its `LabelElement` union has no
    // barcode/qrcode variant) — kept here only so the switch stays
    // exhaustive over this package's wider `PrintElement` union; TSC's
    // preview renders text/vector/image content only, same as upstream.
    // `cut`/`pageBreak`/`spacer`/`row`/`column` have no visual representation
    // on the label itself — cut is a post-print printer action, the other 4
    // are documented no-ops in the compilers too (no auto-layout primitive),
    // per the design spec.
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

/** Renders a TSC document preview as an SVG, using TSC's own font metrics and BITMAP bit-per-pixel model. */
export class TscPreviewRenderer implements PrintPreview {
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
      `<text x="${svgW / 2}" y="${svgH - 1}" text-anchor="middle" fill="#a1a1aa" font-size="8" font-family="monospace">${w}×${h} dots (${document.dpi} DPI) — TSC</text>`,
      '</svg>',
    ].join('\n');
  }
}
