import type { PrintDocument } from '../document';
import type { PrintElement } from '../builder';

/**
 * A print-ready starting point for a `LabelBuilder` document: a complete
 * paper/dpi config plus a function that turns real data (`TVars`) into the
 * label's content elements. `config` is a full `PrintDocument`, not
 * `Partial` — a preset that can't fully specify its own paper config isn't
 * a usable starting point.
 */
export interface LabelPreset<TVars> {
  config: PrintDocument;
  build(vars: TVars): PrintElement[];
}
