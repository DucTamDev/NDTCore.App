import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrinterProfile } from '../../profile';
import type { PrintCompiler } from '../../core';
import type { Rotation } from '../../types';
import type { TextOptions } from '../../builder/content/TextElement';
import { SBPL_COMMAND } from './SbplCommand';
import { encodeSbplBitmapPayload } from './SbplEncoder';
import { formatTable, validateTableColumns } from '../../receipt';

const ESC = SBPL_COMMAND.ESC;

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

/** `<ESC>%0`-`<ESC>%3` — SBPL's character rotation field, per the SBPL Programming Reference's rotation command. */
function sbplRotationCommand(rotation: Rotation): string {
  switch (rotation) {
    case 90:
      return `${ESC}%1`;
    case 180:
      return `${ESC}%2`;
    case 270:
      return `${ESC}%3`;
    default:
      return `${ESC}%0`;
  }
}

/**
 * `<ESC>H`/`<ESC>V`/`<ESC>L`/`<ESC>K9B` — a text field: position, then an
 * optional rotation (only emitted when set, matching portakal's own
 * `sbplRotation()` call site exactly — a `0`/omitted rotation relies on the
 * printer's own default rather than an explicit `<ESC>%0`), then
 * magnification, then the text data itself.
 */
function compileTextElement(content: string, options: TextOptions | undefined): string {
  const o = options ?? {};
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const lines: string[] = [`${ESC}${SBPL_COMMAND.POSITION_X}${pad4(x)}`, `${ESC}${SBPL_COMMAND.POSITION_Y}${pad4(y)}`];
  if (o.rotation) lines.push(sbplRotationCommand(o.rotation));
  const hMag = String(o.size ?? 1).padStart(2, '0');
  lines.push(`${ESC}${SBPL_COMMAND.MAGNIFICATION}${hMag}${hMag}`);
  lines.push(`${ESC}${SBPL_COMMAND.TEXT}${content}`);
  return lines.join('\r\n');
}

/**
 * Per-row line height, in dots, used to stack a `table` element's formatted
 * lines. SBPL's text field has no font-metrics table to derive a real glyph
 * height from (its `L` field is a raw magnification multiplier, not a
 * computed pixel height) — kept as one named constant, same fallback-default
 * role `DplCompiler`'s own `DEFAULT_TABLE_ROW_HEIGHT_DOTS` serves for DPL.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 16;

function compileElement(element: PrintElement): string {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image': {
      const o = element.options ?? {};
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const bmp = element.bitmap;
      const size = String(bmp.data.length).padStart(5, '0');
      const hex = encodeSbplBitmapPayload(bmp);
      return [`${ESC}${SBPL_COMMAND.POSITION_X}${pad4(x)}`, `${ESC}${SBPL_COMMAND.POSITION_Y}${pad4(y)}`, `${ESC}${SBPL_COMMAND.IMAGE}${size},${hex}`].join('\r\n');
    }

    case 'box': {
      const o = element.options;
      const t = o.thickness ?? 1;
      return [
        `${ESC}${SBPL_COMMAND.POSITION_X}${pad4(o.x)}`,
        `${ESC}${SBPL_COMMAND.POSITION_Y}${pad4(o.y)}`,
        `${ESC}${SBPL_COMMAND.DRAW}${String(t).padStart(2, '0')}V${pad4(o.height)}H${pad4(o.width)}`,
      ].join('\r\n');
    }

    // SBPL's `<ESC>FW` draw field only carries a single width-or-height
    // magnitude, so it draws a horizontal bar (`H<width>`) when the two
    // endpoints share a row or a vertical bar (`V<height>`) when they share
    // a column — `'line'` is guaranteed axis-aligned by the builder
    // (`PrintBuilder.line()` routes a genuinely diagonal pair to
    // `'diagonal'` instead, see below), so no third branch is needed here,
    // same assumption portakal's own `languages/sbpl.ts` line case makes.
    case 'line': {
      const o = element.options;
      const t = o.thickness ?? 1;
      const x = Math.min(o.x1, o.x2);
      const y = Math.min(o.y1, o.y2);
      const lines: string[] = [`${ESC}${SBPL_COMMAND.POSITION_X}${pad4(x)}`, `${ESC}${SBPL_COMMAND.POSITION_Y}${pad4(y)}`];
      if (o.y1 === o.y2) {
        lines.push(`${ESC}${SBPL_COMMAND.DRAW}${String(t).padStart(2, '0')}H${pad4(Math.abs(o.x2 - o.x1))}`);
      } else {
        lines.push(`${ESC}${SBPL_COMMAND.DRAW}${String(t).padStart(2, '0')}V${pad4(Math.abs(o.y2 - o.y1))}`);
      }
      return lines.join('\r\n');
    }

    // SBPL's `<ESC>FW` draw field has no true diagonal capability (only the
    // axis-aligned width-or-height magnitude the `'line'` case above uses) —
    // documented no-op, same precedent `DplCompiler`'s `'diagonal'` case
    // documents for DPL's equally axis-only Line/Box Draw command.
    case 'diagonal':
      return '';

    // No native SBPL command for a circle, ellipse outline, standalone
    // reverse-print region, or standalone erase region — matching portakal's
    // own `compileElement()`, which returns no commands for all four rather
    // than inventing new field grammar for them.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    // No documented native SBPL cutter command — portakal's own
    // `languages/sbpl.ts` has zero cut-related logic to port. Documented
    // no-op, same precedent as `DplCompiler`'s/`CpclCompiler`'s `'cut'` case.
    case 'cut':
      return '';

    // Real behavior: format the rows into text lines via the shared
    // `formatTable()` (same helper every language compiler's own `'table'`
    // case uses), then emit each line as its own `K9B` text field, stacked
    // one `DEFAULT_TABLE_ROW_HEIGHT_DOTS` apart starting at the table's own
    // y.
    case 'table': {
      const o = element.options;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      validateTableColumns(o.columns);
      const totalWidth = o.columns.reduce((sum, column) => sum + column.width, 0);
      const rowLines = formatTable(o.columns, o.rows, totalWidth);
      return rowLines.map((line, i) => compileTextElement(line, { x, y: y + i * DEFAULT_TABLE_ROW_HEIGHT_DOTS })).join('\r\n');
    }

    // Neither SBPL nor this package has a native "page break" / "advance
    // the cursor by N dots" / "lay out children in a row-or-column"
    // primitive — documented no-op, same precedent as `DplCompiler`'s/
    // `CpclCompiler`'s equivalent cases, pending a real auto-layout design
    // (not a bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    // Not in portakal (`parsers/sbpl.ts` records `B`/`D`/`2D`-prefixed lines
    // as opaque commands with no structured field decode to use as ground
    // truth) and, unlike CPCL's/EPL2's/ZPL's barcode commands (all
    // corroborated by well-documented, externally verifiable manuals even
    // without a portakal source), SATO's actual 1D/2D bar-code field layouts
    // aren't corroborated anywhere accessible to this task — there's no
    // genuine external anchor to derive a type-selection table or field
    // shape from, only guesswork. Documented no-op instead, consistent with
    // how `DplCompiler` already treats this exact same gap for DPL (downgraded
    // there after review for the same reason) and how this file already
    // treats every other genuinely-undocumented SBPL capability
    // (`circle`/`ellipse`/`reverse`/`erase` above): honest absence of
    // information, not an invented plausible-looking field.
    case 'barcode':
    case 'qrcode':
      return '';
  }
}

/**
 * Compiles a `ResolvedPrintDocument` into a SATO SBPL command string. Unlike
 * CPCL's/DPL's own document wrappers, SBPL's session commands carry no
 * label width/height/speed/density fields at all — portakal's own
 * `compileToSBPL()` opens with just `<ESC>A`/`<ESC>CS` and closes with
 * `<ESC>Z`, leaving those printer-level settings to be configured by other
 * means outside this document's element list. Ported as-is, not an
 * oversight.
 */
export function compileToSBPL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

  lines.push(`${ESC}${SBPL_COMMAND.START}`);
  lines.push(`${ESC}${SBPL_COMMAND.CLEAR}`);

  for (const element of document.elements) {
    // A no-op element (or empty-content `raw`) compiles to `''` — skip it so
    // it doesn't push a spurious blank line into the `\r\n`-joined output.
    const line = compileElement(element);
    if (line) lines.push(line);
  }

  // `<ESC>Q` is omitted entirely for a single copy, matching portakal's own
  // `if (label.copies > 1)` guard exactly — SBPL's own default is one copy
  // with no explicit quantity field needed.
  if (document.copies > 1) {
    lines.push(`${ESC}${SBPL_COMMAND.QUANTITY}${document.copies}`);
  }
  lines.push(`${ESC}${SBPL_COMMAND.END}`);
  return lines.join('\r\n') + '\r\n';
}

/**
 * SBPL has no code-page/byte-encoding step (unlike ESC/POS) — its compiled
 * output is a plain command string, so `profile` is accepted only to satisfy
 * `PrintCompiler`'s shared call shape and isn't otherwise used.
 */
export class SbplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _profile?: PrinterProfile): string {
    return compileToSBPL(document);
  }
}
