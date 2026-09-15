/**
 * Turns a small HTML-like tag language into a `LabelBuilder`, so a label
 * layout can be authored as a string instead of chained method calls. Each
 * child tag under `<label>` (`text`, `line`, `box`, `circle`, `ellipse`,
 * `reverse`, `erase`, `raw`) maps 1:1 to the matching `PrintBuilder` method.
 */

import type { PrintDocument } from '../document';
import type { Alignment, Rotation } from '../types';
import { label, LabelBuilder } from '../builder';
import { parseAttrs, getUnit, parseUnitValue } from './MarkupParser';

/** Build a chained `LabelBuilder` call from a `<label>` markup string. */
export function markup(source: string): LabelBuilder {
  const trimmed = source.trim();

  const labelMatch = trimmed.match(/<label((?:\s+[\w-]+(?:="[^"]*")?)*)\s*>/i);
  if (!labelMatch) {
    throw new Error('Markup must contain a <label> root element');
  }

  const labelAttrs = parseAttrs(labelMatch[1]);
  const unit = getUnit(labelAttrs.width ?? labelAttrs.height ?? '');

  const config: Partial<PrintDocument> = {
    width: parseUnitValue(labelAttrs.width ?? '40mm'),
    height: labelAttrs.height ? parseUnitValue(labelAttrs.height) : undefined,
    unit: unit || 'mm',
    dpi: labelAttrs.dpi ? Number(labelAttrs.dpi) : undefined,
    gap: labelAttrs.gap ? parseUnitValue(labelAttrs.gap) : undefined,
    speed: labelAttrs.speed ? Number(labelAttrs.speed) : undefined,
    density: labelAttrs.density ? Number(labelAttrs.density) : undefined,
    copies: labelAttrs.copies ? Number(labelAttrs.copies) : undefined,
    printer: labelAttrs.printer ?? undefined,
  };

  // `width` is always assigned above (falls back to "40mm"), so this
  // narrowing assertion holds at runtime even though `Partial<PrintDocument>`
  // doesn't prove it statically.
  const b = label(config as PrintDocument);

  const innerMatch = trimmed.match(/<label[^>]*>([\s\S]*)<\/label>/i);
  if (!innerMatch) return b;

  const inner = innerMatch[1];

  const tagRegex = /<(\w+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*(?:\/>|>([\s\S]*?)<\/\1>)/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(inner)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrs = parseAttrs(match[2]);
    const content = match[3]?.trim() ?? '';

    switch (tagName) {
      case 'text':
        b.text(content, {
          x: attrs.x ? Number(attrs.x) : undefined,
          y: attrs.y ? Number(attrs.y) : undefined,
          font: attrs.font,
          size: attrs.size ? Number(attrs.size) : undefined,
          // Markup only ever carries one of the 4 valid rotation values;
          // that's a calling-convention guarantee, not something the
          // string-typed attrs map can prove statically.
          rotation: attrs.rotation ? (Number(attrs.rotation) as Rotation) : undefined,
          bold: attrs.bold === 'true' || attrs.bold === '' ? true : undefined,
          underline: attrs.underline === 'true' || attrs.underline === '' ? true : undefined,
          reverse: attrs.reverse === 'true' || attrs.reverse === '' ? true : undefined,
          // Same guarantee as rotation above: markup only emits one of the
          // 3 valid alignment strings.
          align: attrs.align ? (attrs.align as Alignment) : undefined,
          maxWidth: attrs.maxwidth
            ? Number(attrs.maxwidth)
            : attrs['max-width']
              ? Number(attrs['max-width'])
              : undefined,
        });
        break;

      case 'line':
        b.line({
          x1: Number(attrs.x1 ?? 0),
          y1: Number(attrs.y1 ?? 0),
          x2: Number(attrs.x2 ?? 0),
          y2: Number(attrs.y2 ?? 0),
          thickness: attrs.thickness
            ? Number(attrs.thickness)
            : attrs.border
              ? Number(attrs.border)
              : undefined,
        });
        break;

      case 'box':
        b.box({
          x: Number(attrs.x ?? 0),
          y: Number(attrs.y ?? 0),
          width: Number(attrs.width ?? 100),
          height: Number(attrs.height ?? 100),
          thickness: attrs.thickness
            ? Number(attrs.thickness)
            : attrs.border
              ? Number(attrs.border)
              : undefined,
          radius: attrs.radius ? Number(attrs.radius) : undefined,
        });
        break;

      case 'circle':
        b.circle({
          x: Number(attrs.x ?? 0),
          y: Number(attrs.y ?? 0),
          diameter: Number(attrs.diameter ?? attrs.size ?? 50),
          thickness: attrs.thickness ? Number(attrs.thickness) : undefined,
        });
        break;

      case 'ellipse':
        b.ellipse({
          x: Number(attrs.x ?? 0),
          y: Number(attrs.y ?? 0),
          width: Number(attrs.width ?? 100),
          height: Number(attrs.height ?? 60),
          thickness: attrs.thickness ? Number(attrs.thickness) : undefined,
        });
        break;

      case 'reverse':
        b.reverse({
          x: Number(attrs.x ?? 0),
          y: Number(attrs.y ?? 0),
          width: Number(attrs.width ?? 100),
          height: Number(attrs.height ?? 30),
        });
        break;

      case 'erase':
        b.erase({
          x: Number(attrs.x ?? 0),
          y: Number(attrs.y ?? 0),
          width: Number(attrs.width ?? 100),
          height: Number(attrs.height ?? 30),
        });
        break;

      case 'raw':
        b.raw(content);
        break;
    }
  }

  return b;
}
