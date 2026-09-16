import type { ResolvedPrintDocument } from '../document';
import type { PrintElement } from '../builder';
import { formatTable, validateTableColumns } from '../receipt';

/**
 * Default SVG preview renderer, shared by every language whose own compiled
 * output has no bespoke preview needs (DPL, SBPL, IPL — see each language's
 * thin `{Lang}PreviewRenderer.ts` wrapper). Font sizing is a generic
 * size/yScale heuristic rather than a real per-printer font table, since
 * that's what those languages' own preview delegates to upstream.
 */

const IMAGE_PREVIEW_MAX_SAMPLES = 100;
const CANVAS_PADDING = 10;
const DEFAULT_CANVAS_HEIGHT = 400;
/** Row spacing for a stacked `table` element — this renderer has no font-metrics table to derive it from, so a fixed dot value is used, same fallback role `EplCompiler`'s/`TscPreviewRenderer`'s own table-row constants serve for their languages. Intentionally duplicated (same value, same name) in `DplCompiler.ts` — the two live in different layers (preview vs. compile) with no shared module either already imports, so a cross-import here would be a bigger dependency than the constant is worth. */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 16;

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Font pixel height from a size multiplier and an optional raw dot height.
 * `yScale`, when it looks like a genuine dot height rather than a small
 * multiplier (>10), is used directly; otherwise `size` scales a ~12-dot
 * base glyph height.
 */
function calcFontSize(size: number, yScale?: number): number {
  if (yScale && yScale > 10) return yScale;
  return Math.max(8, size * 12);
}

/** Fraction of the glyph cell's height used to place the text baseline below its `y` coordinate — proportional font "0" sits a bit higher than the bitmap/monospace fonts. */
function baselineRatio(font?: string): number {
  return font === '0' ? 0.78 : 0.82;
}

function fontFamily(font?: string): string {
  if (font === '0') return "'Helvetica Neue', Helvetica, Arial, sans-serif";
  return 'monospace';
}

function renderElement(element: PrintElement): string {
  switch (element.type) {
    case 'text': {
      const o = element.options ?? {};
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const fs = calcFontSize(o.size ?? 1, o.yScale);
      const bl = baselineRatio(o.font);
      const ff = fontFamily(o.font);
      const weight = o.bold ? 'bold' : 'normal';
      const decoration = o.underline ? ' text-decoration="underline"' : '';
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
      const svgY = Math.round((y + fs * bl) * 100) / 100;
      return `<text x="${textX}" y="${svgY}" fill="${fill}" font-size="${fs}" font-weight="${weight}" font-family="${ff}"${anchor}${decoration}${transform}>${escapeXml(element.content)}</text>`;
    }

    case 'image': {
      const o = element.options ?? {};
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const bmp = element.bitmap;
      const w = o.width ?? bmp.width;
      const h = o.height ?? bmp.height;

      const step = Math.max(1, Math.floor(Math.max(bmp.width, bmp.height) / IMAGE_PREVIEW_MAX_SAMPLES));
      const scaleX = w / bmp.width;
      const scaleY = h / bmp.height;
      let svg = '';

      for (let py = 0; py < bmp.height; py += step) {
        for (let px = 0; px < bmp.width; px += step) {
          const byteIdx = py * bmp.bytesPerRow + Math.floor(px / 8);
          const bitIdx = 7 - (px % 8);
          // eslint-disable-next-line no-bitwise -- reading one packed pixel bit, per Bitmap's MSB-first convention
          const isBlack = (bmp.data[byteIdx] >> bitIdx) & 1;
          if (isBlack) {
            svg += `<rect x="${x + px * scaleX}" y="${y + py * scaleY}" width="${step * scaleX}" height="${step * scaleY}" fill="#000"/>`;
          }
        }
      }

      return svg;
    }

    case 'box': {
      const o = element.options;
      const t = o.thickness ?? 1;
      const rx = o.radius ?? 0;

      if (t >= Math.min(o.width, o.height)) {
        return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#000" rx="${rx}" ry="${rx}"/>`;
      }

      return `<rect x="${o.x + t / 2}" y="${o.y + t / 2}" width="${o.width - t}" height="${o.height - t}" fill="none" stroke="#000" stroke-width="${t}" rx="${rx}" ry="${rx}"/>`;
    }

    // portakal's own `renderElement()` never splits axis-aligned vs.
    // diagonal — a single `<line>` draws either shape identically, so both
    // `'line'` and the (net-new) `'diagonal'` case share this one branch,
    // kept as a separate `case` label only so the switch stays exhaustive
    // over this package's wider `PrintElement` union.
    case 'line':
    case 'diagonal': {
      const o = element.options;
      const t = o.thickness ?? 1;
      return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#000" stroke-width="${t}"/>`;
    }

    case 'circle': {
      const o = element.options;
      const t = o.thickness ?? 1;
      const r = o.diameter / 2;
      if (t >= r) {
        return `<circle cx="${o.x + r}" cy="${o.y + r}" r="${r}" fill="#000"/>`;
      }
      return `<circle cx="${o.x + r}" cy="${o.y + r}" r="${r - t / 2}" fill="none" stroke="#000" stroke-width="${t}"/>`;
    }

    case 'ellipse': {
      const o = element.options;
      const t = o.thickness ?? 1;
      return `<ellipse cx="${o.x + o.width / 2}" cy="${o.y + o.height / 2}" rx="${o.width / 2}" ry="${o.height / 2}" fill="none" stroke="#000" stroke-width="${t}"/>`;
    }

    case 'reverse': {
      const o = element.options;
      return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#000"/>`;
    }

    case 'erase': {
      const o = element.options;
      return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#fff"/>`;
    }

    case 'raw':
      return '';

    // Net new — real behavior: format the rows into text lines via the
    // shared `formatTable()` (same helper every language compiler's own
    // `'table'` case uses), then render each line as its own `<text>`,
    // stacked `DEFAULT_TABLE_ROW_HEIGHT_DOTS` apart starting at the table's
    // own y.
    case 'table': {
      const o = element.options;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      validateTableColumns(o.columns);
      const totalWidth = o.columns.reduce((sum, column) => sum + column.width, 0);
      const lines = formatTable(o.columns, o.rows, totalWidth);
      return lines
        .map((line, i) => `<text x="${x}" y="${y + i * DEFAULT_TABLE_ROW_HEIGHT_DOTS + DEFAULT_TABLE_ROW_HEIGHT_DOTS * 0.85}" fill="#000" font-size="${DEFAULT_TABLE_ROW_HEIGHT_DOTS}" font-family="monospace">${escapeXml(line)}</text>`)
        .join('');
    }

    // portakal's `LabelElement` union (the source this shared renderer is
    // ported from) has no barcode/QR variant at all, so there's no upstream
    // rendering to port — kept in this no-op bucket only so the switch stays
    // exhaustive over this package's wider `PrintElement` union, same
    // precedent `TscPreviewRenderer`'s own `'barcode'`/`'qrcode'` cases
    // document. `cut`/`pageBreak`/`spacer`/`row`/`column` have no visual
    // representation on the label itself either — `cut` is a post-print
    // printer action, the other 4 are documented no-ops in every compiler
    // too (no auto-layout primitive), per the design spec.
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

/** Renders a document preview as an SVG, using generic size-based font metrics rather than any one printer language's own font table. */
export function renderPreview(document: ResolvedPrintDocument): string {
  const w = document.widthDots;
  const h = document.heightDots > 0 ? document.heightDots : DEFAULT_CANVAS_HEIGHT;
  const padding = CANVAS_PADDING;
  const svgW = w + padding * 2;
  const svgH = h + padding * 2;

  let elements = '';
  for (const el of document.elements) {
    elements += renderElement(el);
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">`,
    `<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#f5f5f4" rx="4"/>`,
    `<rect x="${padding}" y="${padding}" width="${w}" height="${h}" fill="#fff" stroke="#e5e5e5" stroke-width="1" rx="2"/>`,
    `<g transform="translate(${padding},${padding})">`,
    elements,
    '</g>',
    `<text x="${svgW / 2}" y="${svgH - 1}" text-anchor="middle" fill="#a1a1aa" font-size="8" font-family="monospace">${w}×${h} dots (${document.dpi} DPI)</text>`,
    '</svg>',
  ].join('\n');
}
