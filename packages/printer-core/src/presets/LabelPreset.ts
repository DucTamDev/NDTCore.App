import type { PrintDocument } from '../document';
import type { PrintElement } from '../builder';

/**
 * A print-ready starting point for a `LabelBuilder` document: a complete
 * paper/dpi config plus its starting elements, both plain data (no builder
 * function) so a preset can be cloned directly into a persisted, user-edited
 * template without calling anything. `config` is a full `PrintDocument`, not
 * `Partial` — a preset that can't fully specify its own paper config isn't
 * a usable starting point.
 */
export interface LabelPreset {
  config: PrintDocument;
  elements: PrintElement[];
}
