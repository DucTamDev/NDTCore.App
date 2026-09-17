import type { PrintDocument } from '../document';
import type { PrintElement } from '../builder';

/**
 * A persisted, user-editable label document: identity (`id`/`name`) plus a
 * complete paper/dpi config and its elements, all plain data — no `build()`
 * function, so the whole record round-trips through JSON storage as-is.
 * `config` is a full `PrintDocument`, not `Partial` — a template that can't
 * fully specify its own paper config isn't usable.
 *
 * `type` is a discriminant defined locally here — deliberately not any
 * app-specific content-type enum, which this framework-agnostic package
 * must never depend on.
 */
export interface LabelTemplate {
  id: string;
  name: string;
  type: 'label';
  config: PrintDocument;
  elements: PrintElement[];
}
