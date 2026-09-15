import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrintPreview } from '../../core';
import { formatTable, validateTableColumns } from '../../receipt';

/** ZPL built-in bitmap-font pixel dimensions at 203 DPI, per the Zebra ZPL II Programming Guide's font table. Font "0" (CG Triumvirate) is scalable — its entry is only a base/fallback, the real size comes from `^A`/`^CF`'s own height/width params. */
const ZPL_FONTS: Record<string, { w: number; h: number }> = {
  A: { w: 5, h: 9 },
  B: { w: 7, h: 11 },
  C: { w: 10, h: 18 },
  D: { w: 10, h: 18 },
  E: { w: 15, h: 28 },
  F: { w: 13, h: 26 },
  G: { w: 40, h: 60 },
  H: { w: 13, h: 21 },
  P: { w: 18, h: 20 },
  Q: { w: 24, h: 28 },
  R: { w: 31, h: 35 },
  S: { w: 35, h: 40 },
  T: { w: 42, h: 48 },
  U: { w: 53, h: 59 },
  V: { w: 71, h: 80 },
  '0': { w: 15, h: 18 },
};

const DEFAULT_FONT = '0';
/** Above this raw dot height, `o.yScale` (from `^A`/`^CF`'s own height field) is trusted directly rather than `ZPL_FONTS`' fixed table — matches portakal's own threshold. */
const YSCALE_TRUST_THRESHOLD = 10;
const DEFAULT_FALLBACK_FONT_SIZE = 18;
const FALLBACK_SIZE_MULTIPLIER = 12;

function isProportionalFont(font: string | undefined): boolean {
  return (font ?? DEFAULT_FONT) === DEFAULT_FONT;
}

function zplFontSize(font: string | undefined, size: number | undefined, yScale?: number): number {
  if (yScale && yScale > YSCALE_TRUST_THRESHOLD) return yScale;
  const f = ZPL_FONTS[(font ?? DEFAULT_FONT).toUpperCase()];
  if (f && size) return f.h * size;
  if (f) return f.h;
  return size ? size * FALLBACK_SIZE_MULTIPLIER : DEFAULT_FALLBACK_FONT_SIZE;
}

/** Baseline offset from the top of the character cell, as a fraction of font size — font "0" (proportional) sits slightly higher than the bitmap fonts A-H, per their differing ascent metrics. */
function zplBaselineRatio(font: string | undefined): number {
  return isProportionalFont(font) ? 0.78 : 0.82;
}

function zplFontFamily(font: string | undefined): string {
  return isProportionalFont(font) ? "'Helvetica Neue', Helvetica, Arial, sans-serif" : 'monospace';
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const IMAGE_PREVIEW_MAX_SAMPLES = 100;

/** Placeholder barcode width estimate — Code 128-shaped module count `(dataChars + 2) * 11 + 13`, applied uniformly regardless of the actual symbology, matching portakal's own single-formula raw-ZPL barcode placeholder. */
const BARCODE_QUIET_CHARS = 2;
const BARCODE_MODULES_PER_CHAR = 11;
const BARCODE_FRAME_MODULES = 13;
const BARCODE_TEXT_OFFSET = 15;
const BARCODE_TEXT_FONT_SIZE = 14;

/** QR placeholder module grid — a Version-1 QR is 21x21 modules, each finder pattern occupies a 7x7 corner block. */
const QR_PLACEHOLDER_MODULES = 21;
const QR_FINDER_MODULES = 7;
const QR_TEXT_OFFSET = 15;
const QR_TEXT_FONT_SIZE = 14;

function renderElement(element: PrintElement): string {
  switch (element.type) {
    case 'text': {
      const o = element.options ?? {};
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const fs = zplFontSize(o.font, o.size, o.yScale);
      const baseline = zplBaselineRatio(o.font);
      const fontFamily = zplFontFamily(o.font);
      const weight = o.bold ? 'bold' : 'normal';
      const transform = o.rotation ? ` transform="rotate(${o.rotation} ${x} ${y})"` : '';

      let anchor = '';
      let textX = x;
      if (o.maxWidth && o.align === 'center') {
        anchor = ' text-anchor="middle"';
        textX = x + o.maxWidth / 2;
      } else if (o.maxWidth && o.align === 'right') {
        anchor = ' text-anchor="end"';
        textX = x + o.maxWidth;
      }

      const fill = o.reverse ? '#fff' : '#000';
      const svgY = Math.round((y + fs * baseline) * 100) / 100;
      return `<text x="${textX}" y="${svgY}" fill="${fill}" font-size="${fs}" font-weight="${weight}" font-family="${fontFamily}"${anchor}${transform}>${escapeXml(element.content)}</text>`;
    }

    case 'image': {
      const o = element.options ?? {};
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
      const o = element.options;
      const t = o.thickness ?? 1;
      const rx = o.radius ?? 0;
      // ZPL's ^GB fills solid once thickness reaches the shorter side, and always draws its border inward from the box's own edge.
      if (t >= Math.min(o.width, o.height)) {
        return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#000" rx="${rx}"/>`;
      }
      return `<rect x="${o.x + t / 2}" y="${o.y + t / 2}" width="${o.width - t}" height="${o.height - t}" fill="none" stroke="#000" stroke-width="${t}" rx="${rx}"/>`;
    }

    // Axis-aligned only — a genuinely diagonal line is the separate
    // `'diagonal'` case below, same split `ZplCompiler.ts`'s `'line'`/
    // `'diagonal'` cases use.
    case 'line': {
      const o = element.options;
      const t = o.thickness ?? 1;
      if (o.y1 === o.y2) {
        return `<rect x="${Math.min(o.x1, o.x2)}" y="${o.y1}" width="${Math.abs(o.x2 - o.x1)}" height="${t}" fill="#000"/>`;
      }
      if (o.x1 === o.x2) {
        return `<rect x="${o.x1}" y="${Math.min(o.y1, o.y2)}" width="${t}" height="${Math.abs(o.y2 - o.y1)}" fill="#000"/>`;
      }
      return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#000" stroke-width="${t}"/>`;
    }

    case 'diagonal': {
      const o = element.options;
      const t = o.thickness ?? 1;
      return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#000" stroke-width="${t}"/>`;
    }

    case 'circle': {
      const o = element.options;
      const t = o.thickness ?? 1;
      const r = o.diameter / 2;
      if (t >= r) return `<circle cx="${o.x + r}" cy="${o.y + r}" r="${r}" fill="#000"/>`;
      return `<circle cx="${o.x + r}" cy="${o.y + r}" r="${r - t / 2}" fill="none" stroke="#000" stroke-width="${t}"/>`;
    }

    // No native ZPL command for an ellipse outline or a standalone
    // reverse-print region — documented no-op, matching portakal's own
    // `renderElement()` (which returns `""` for both).
    case 'ellipse':
    case 'reverse':
      return '';

    case 'erase': {
      const o = element.options;
      return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#fff"/>`;
    }

    // `raw` carries opaque ZPL text (e.g. a barcode field `ZplParser` scraped
    // back from the compiled stream, since barcode/qrcode have no dedicated
    // parse-side element shape) — no structured fields to render from.
    case 'raw':
      return '';

    // Real, structured rendering — unlike `TscPreviewRenderer`'s barcode/
    // qrcode cases (TSC's own portakal preview never renders barcodes at
    // all), portakal's ZPL preview *does* render a barcode placeholder, by
    // regex-scraping a raw ZPL string. `ZplCompiler` gives barcode/qrcode
    // their own structured `PrintElement` shape instead of stuffing them
    // into `raw`, so the same striped/finder-pattern placeholder visuals are
    // rendered directly from that structured config here — no scraping
    // needed.
    case 'barcode': {
      const c = element.options;
      const x = c.x ?? 0;
      const y = c.y ?? 0;
      const height = c.height ?? 50;
      const moduleWidth = c.narrowBarWidth ?? 2;
      const width = (c.content.length + BARCODE_QUIET_CHARS) * BARCODE_MODULES_PER_CHAR * moduleWidth + BARCODE_FRAME_MODULES * moduleWidth;
      const patternId = `zpl-barcode-${x}-${y}`;
      const textY = y + height + BARCODE_TEXT_OFFSET;
      const label =
        c.readable === false
          ? ''
          : `<text x="${x + width / 2}" y="${textY}" text-anchor="middle" fill="#000" font-size="${BARCODE_TEXT_FONT_SIZE}" font-family="monospace">${escapeXml(c.content)}</text>`;
      return [
        `<defs><pattern id="${patternId}" width="${moduleWidth * 2}" height="${height}" patternUnits="userSpaceOnUse">`,
        `<rect width="${moduleWidth}" height="${height}" fill="#000"/>`,
        '</pattern></defs>',
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#${patternId})"/>`,
        label,
      ].join('');
    }

    case 'qrcode': {
      const c = element.options;
      const x = c.x ?? 0;
      const y = c.y ?? 0;
      const cell = c.cellWidth ?? 4;
      const size = QR_PLACEHOLDER_MODULES * cell;
      const finder = QR_FINDER_MODULES * cell;
      const textY = y + size + QR_TEXT_OFFSET;
      return [
        `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#fff" stroke="#000" stroke-width="${cell}"/>`,
        `<rect x="${x}" y="${y}" width="${finder}" height="${finder}" fill="#000"/>`,
        `<rect x="${x + size - finder}" y="${y}" width="${finder}" height="${finder}" fill="#000"/>`,
        `<rect x="${x}" y="${y + size - finder}" width="${finder}" height="${finder}" fill="#000"/>`,
        `<text x="${x + size / 2}" y="${textY}" text-anchor="middle" fill="#000" font-size="${QR_TEXT_FONT_SIZE}" font-family="monospace">${escapeXml(c.content)}</text>`,
      ].join('');
    }

    // No visual representation on the label itself — `cut` is a post-print
    // printer action, and the other 4 are documented no-ops in
    // `ZplCompiler` too (no auto-layout primitive), per the design spec.
    case 'cut':
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    // Real behavior: format the rows into text lines via the shared
    // `formatTable()` (same helper `ZplCompiler`'s `'table'` case uses),
    // then render each line as its own `<text>`, stacked one default-font
    // row height apart starting at the table's y.
    case 'table': {
      const o = element.options;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const rowHeight = zplFontSize(undefined, 1);
      validateTableColumns(o.columns);
      const totalWidth = o.columns.reduce((sum, column) => sum + column.width, 0);
      const lines = formatTable(o.columns, o.rows, totalWidth);
      return lines
        .map((line, i) => `<text x="${x}" y="${y + i * rowHeight + rowHeight * 0.85}" fill="#000" font-size="${rowHeight}" font-family="monospace">${escapeXml(line)}</text>`)
        .join('');
    }
  }
}

const CANVAS_PADDING = 10;
const DEFAULT_CANVAS_HEIGHT = 1218; // 6in @ 203dpi — matches portakal's own preview fallback.

/** Renders a ZPL document preview as an SVG, using ZPL's own font metrics and `^GFA` bit-per-pixel model. */
export class ZplPreviewRenderer implements PrintPreview {
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
      `<text x="${svgW / 2}" y="${svgH - 1}" text-anchor="middle" fill="#a1a1aa" font-size="8" font-family="monospace">${w}×${h} dots (${document.dpi} DPI) — ZPL</text>`,
      '</svg>',
    ].join('\n');
  }
}
