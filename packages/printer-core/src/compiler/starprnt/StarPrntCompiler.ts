import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrintCompiler } from '../../core';
import type { PrinterProfile } from '../../profile';
import type { TextOptions } from '../../builder/content/TextElement';
import { STAR_PRNT, concatStarPrntBytes } from './StarPrntCommand';
import { encodeStarPrntImage } from './StarPrntEncoder';
import { formatTable, validateTableColumns } from '../../receipt';

function alignByte(align: TextOptions['align']): number {
  switch (align) {
    case 'center':
      return 1;
    case 'right':
      return 2;
    default:
      return 0;
  }
}

function compileTextElement(content: string, options: TextOptions | undefined): Uint8Array[] {
  const o = options ?? {};
  const chunks: Uint8Array[] = [];

  chunks.push(new Uint8Array([STAR_PRNT.ESC, ...STAR_PRNT.ALIGN, alignByte(o.align)]));

  if (o.bold) chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.BOLD_ON]));
  if (o.underline) chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.UNDERLINE, 1]));

  if (o.size !== undefined && o.size > 1) {
    // eslint-disable-next-line no-bitwise -- clamping the magnification factor to a single byte, per ESC i h w's wire format
    const mag = o.size & 0xff;
    chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.SIZE, mag, mag]));
  }

  // Known limitation: text always goes out as UTF-8. Star PRNT output here is
  // not profile- or code-page-aware the way ESC/POS output is, because this
  // package has no verified Star Line Mode code-page-select command to emit
  // (`STAR_PRNT` carries no such constant, and the ported reference has none
  // either). Non-ASCII content therefore depends on the printer already being
  // configured for UTF-8.
  chunks.push(new TextEncoder().encode(content));
  chunks.push(new Uint8Array([STAR_PRNT.LF]));

  if (o.bold) chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.BOLD_OFF]));
  if (o.underline) chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.UNDERLINE, 0]));
  if (o.size !== undefined && o.size > 1) chunks.push(new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.SIZE, 1, 1]));
  chunks.push(new Uint8Array([STAR_PRNT.ESC, ...STAR_PRNT.ALIGN, 0]));

  return chunks;
}

function compileElement(element: PrintElement): Uint8Array[] {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image':
      return [encodeStarPrntImage(element.bitmap)];

    case 'raw':
      return [typeof element.content === 'string' ? new TextEncoder().encode(element.content) : element.content];

    // Star Line Mode has no native vector-drawing command — box/line/diagonal/
    // circle/ellipse/reverse/erase stay no-ops, same gap portakal's Star PRNT
    // and ESC/POS compilers both have.
    case 'box':
    case 'line':
    case 'diagonal':
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return [];

    // No native "page break" / "advance N dots" / "row-or-column auto-layout"
    // primitive, and this package has no auto-layout engine yet — same
    // documented no-op every other language compiler in this package uses.
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return [];

    // portakal's Star PRNT source has no barcode/QR representation at all —
    // its internal element union doesn't even include those variants for any
    // language. Star's real Line Mode command set does define a barcode
    // ("ESC b ...") and a 2D-symbol ("ESC GS y ...") command family, but
    // without a grounded, verifiable byte layout to port here (unlike ESC/POS's
    // "GS k"/"GS ( k", which this package's decode side already exercises),
    // emitting one would risk inventing an unverified fixed-field record.
    // Documented no-op, not a bug.
    case 'barcode':
    case 'qrcode':
      return [];

    case 'cut': {
      const mode = element.options?.mode ?? 'full';
      if (mode === 'off') return [];

      // portakal's Star PRNT compiler only ever emits one cut byte sequence
      // (ESC d 1, unconditionally, at the end of every document) — no
      // distinct full-cut byte value is grounded in that source, so both
      // 'partial' and 'full' map to the same command here rather than
      // inventing an unverified one. `rows` has no grounded encoding either
      // (ESC d takes a single fixed parameter) and is ignored.
      return [new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.CUT, 1])];
    }

    case 'table': {
      validateTableColumns(element.options.columns);
      const totalWidth = element.options.columns.reduce((sum, column) => sum + column.width, 0);
      const lines = formatTable(element.options.columns, element.options.rows, totalWidth);
      const chunks: Uint8Array[] = [];
      for (const line of lines) chunks.push(...compileTextElement(line, undefined));
      return chunks;
    }
  }
}

/**
 * Compiles a `ResolvedPrintDocument` into Star Line Mode bytes.
 *
 * Unlike portakal's `compileToStarPRNT()`, which always appends `ESC d 1`
 * once at the very end of every document regardless of content, cutting
 * here is driven entirely by `CutElement`s in the document — the same
 * element-driven model every other language compiler in this package uses.
 * Keeping the unconditional trailing cut would make `CutOptions.mode: 'off'`
 * unsatisfiable and would double-cut a document that already places its own
 * `cut` element, so it is not ported; see the `'cut'` case above for what
 * replaces it.
 *
 * `_profile` is accepted for call-shape parity with the other language
 * compilers but is not read: see `compileTextElement` for why Star PRNT text
 * output cannot be profile-driven yet.
 */
export class StarPrntCompiler implements PrintCompiler<Uint8Array> {
  compile(document: ResolvedPrintDocument, _profile?: PrinterProfile): Uint8Array {
    const chunks: Uint8Array[] = [new Uint8Array([STAR_PRNT.ESC, STAR_PRNT.INIT])];

    for (const element of document.elements) {
      chunks.push(...compileElement(element));
    }

    return concatStarPrntBytes(chunks);
  }
}
