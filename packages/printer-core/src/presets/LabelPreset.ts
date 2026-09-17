import type { PrintDocument } from '../document';
import type { PrintElement } from '../builder';

/**
 * A print-ready starting point for a `LabelBuilder` document: a complete
 * paper/dpi config plus its starting elements, both plain data (no builder
 * function) so a preset can be cloned directly into a persisted, user-edited
 * template without calling anything. `config` is a full `PrintDocument`, not
 * `Partial` — a preset that can't fully specify its own paper config isn't
 * a usable starting point.
 *
 * `kind` is a discriminant defined locally here — deliberately not the
 * app's own `PrintType` (`src/features/printer`), which this
 * framework-agnostic package must never depend on. A consumer mapping this
 * preset onto its own persisted template shape maps `kind` to its own type
 * field itself.
 */
export interface LabelPreset {
  kind: 'label';
  config: PrintDocument;
  elements: PrintElement[];
}
