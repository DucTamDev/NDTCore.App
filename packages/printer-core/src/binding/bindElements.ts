import type { PrintElement } from '../builder';

/** Values a template's `{{key}}` placeholders can be bound to at print time. */
export type BindingData = Record<string, string | number>;

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/**
 * Replaces every `{{key}}` in `text` with `data[key]`, left untouched when
 * `key` isn't in `data` — an unbound placeholder is more useful to a caller
 * debugging a template than a silently blanked-out string.
 */
function substitute(text: string, data: BindingData): string {
  return text.replace(PLACEHOLDER, (match, key: string) => (key in data ? String(data[key]) : match));
}

/**
 * Resolves `{{key}}` placeholders across a `PrintElement[]`'s string content
 * fields (`text.content`, `barcode`/`qrcode`'s `options.content`, a string
 * `raw.content`) against real data, returning a new array — the input is
 * never mutated, so the same saved template can be bound against many
 * different print jobs. Elements with no bindable string content (box,
 * line, table, etc.) pass through unchanged.
 *
 * Does not bind `table.rows` — a template can't pre-declare one
 * placeholder per row when the real row count (e.g. an order's item list)
 * varies per print job. That needs its own mechanism, not string
 * substitution; out of scope here.
 */
export function bindElements(elements: PrintElement[], data: BindingData): PrintElement[] {
  return elements.map((element) => {
    switch (element.type) {
      case 'text':
        return { ...element, content: substitute(element.content, data) };
      case 'barcode':
        return { ...element, options: { ...element.options, content: substitute(element.options.content, data) } };
      case 'qrcode':
        return { ...element, options: { ...element.options, content: substitute(element.options.content, data) } };
      case 'raw':
        return typeof element.content === 'string' ? { ...element, content: substitute(element.content, data) } : element;
      default:
        return element;
    }
  });
}
