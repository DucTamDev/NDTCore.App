import type { PrinterLanguage } from '../core/PrinterLanguage';
import { ConversionRegistry } from './ConversionRegistry';

/** A single source-to-target conversion pair. */
export interface ConversionPath {
  from: PrinterLanguage;
  to: PrinterLanguage;
}

/**
 * Derived from `ConversionRegistry`'s own keys rather than hand-maintained,
 * so this list can never drift out of sync with what the registry actually
 * supports — unlike portakal's `SUPPORTED_SOURCES`/`SUPPORTED_TARGETS`,
 * which are two separately hand-written arrays that could silently diverge
 * from `parseSource()`/`compileTarget()`'s own switch statements.
 */
const REGISTERED_LANGUAGES = Object.keys(ConversionRegistry) as PrinterLanguage[];

/** Every `PrinterLanguage` usable as a conversion source. */
export const SUPPORTED_SOURCES: PrinterLanguage[] = [...REGISTERED_LANGUAGES];

/** Every `PrinterLanguage` usable as a conversion target. */
export const SUPPORTED_TARGETS: PrinterLanguage[] = [...REGISTERED_LANGUAGES];
