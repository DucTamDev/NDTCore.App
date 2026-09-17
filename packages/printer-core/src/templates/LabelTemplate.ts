import type { PrintDocument } from '../document';
import type { PrintElement } from '../builder';

/**
 * A print-ready starting point for a `LabelBuilder` document: a complete
 * paper/dpi config plus its starting elements, both plain data so it can be
 * cloned directly into a persisted, user-edited template elsewhere without
 * calling anything. `config` is a full `PrintDocument`, not `Partial` — a
 * template that can't fully specify its own paper config isn't a usable
 * starting point.
 *
 * `kind` is a discriminant defined locally here — deliberately not any
 * app-specific content-type enum, which this framework-agnostic package
 * must never depend on. A consumer mapping this onto its own persisted
 * template shape maps `kind` to its own type field itself.
 */
export interface LabelTemplate {
  kind: 'label';
  config: PrintDocument;
  elements: PrintElement[];
}
