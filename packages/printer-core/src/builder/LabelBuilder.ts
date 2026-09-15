import type { PrintDocument, ResolvedPrintDocument } from '../document';
import type { Unit } from '../types';
import { getProfile } from '../profile';
import { PrintBuilder } from './PrintBuilder';

/**
 * Thrown when a document configuration can't be resolved — currently just
 * a missing/non-positive width with no printer profile to fall back to.
 * Defined here rather than in a dedicated `errors/` folder: the skeleton
 * has none yet (unlike portakal's `src/errors.ts`). Worth revisiting as a
 * proper `errors/` module in a later phase if more error types show up.
 */
export class InvalidConfigError extends Error {}

/** Resolve a mm/inch/dot measurement into a dot count at the given DPI. */
function toDots(value: number, unit: Unit, dpi: number): number {
  switch (unit) {
    case 'dot':
      return Math.round(value);
    case 'mm':
      return Math.round(value * (dpi / 25.4));
    case 'inch':
      return Math.round(value * dpi);
  }
}

export class LabelBuilder extends PrintBuilder {
  private readonly config: PrintDocument;

  constructor(config: PrintDocument) {
    super();
    if (config.printer) {
      const profile = getProfile(config.printer);
      if (profile) {
        config = {
          ...config,
          width: config.width || profile.paperWidth,
          dpi: config.dpi ?? profile.dpi,
          unit: config.unit ?? 'mm',
        };
      }
    }
    if (!config.width || config.width <= 0) {
      throw new InvalidConfigError('Label width must be a positive number');
    }
    this.config = config;
  }

  resolve(): ResolvedPrintDocument {
    const unit = this.config.unit ?? 'mm';
    const dpi = this.config.dpi ?? 203;

    return {
      widthDots: toDots(this.config.width, unit, dpi),
      heightDots: this.config.height ? toDots(this.config.height, unit, dpi) : 0,
      dpi,
      gapDots: this.config.gap != null ? toDots(this.config.gap, unit, dpi) : toDots(3, 'mm', dpi),
      speed: this.config.speed ?? 4,
      density: this.config.density ?? 8,
      direction: this.config.direction ?? 0,
      copies: this.config.copies ?? 1,
      elements: this.elements,
    };
  }
}

export function label(config: PrintDocument): LabelBuilder {
  return new LabelBuilder(config);
}
