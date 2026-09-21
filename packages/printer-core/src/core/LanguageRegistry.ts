import type { PrinterLanguage } from './PrinterLanguage';
import type { PrinterLanguageDefinition } from './PrinterLanguageDefinition';
import { TscCompiler } from '../language/tsc/TscCompiler';
import { TscParser } from '../language/tsc/TscParser';
import { TscValidator } from '../validation/languages/tsc/TscValidator';
import { TscPreviewRenderer } from '../preview/languages/tsc/TscPreviewRenderer';
import { EscPosCompiler } from '../language/escpos/EscPosCompiler';
import { EscPosParser } from '../language/escpos/EscPosParser';
import { EscPosValidator } from '../validation/languages/escpos/EscPosValidator';
import { EscPosPreviewRenderer } from '../preview/languages/escpos/EscPosPreviewRenderer';
import { ZplCompiler } from '../language/zpl/ZplCompiler';
import { ZplParser } from '../language/zpl/ZplParser';
import { ZplValidator } from '../validation/languages/zpl/ZplValidator';
import { ZplPreviewRenderer } from '../preview/languages/zpl/ZplPreviewRenderer';
import { EplCompiler } from '../language/epl/EplCompiler';
import { EplParser } from '../language/epl/EplParser';
import { EplValidator } from '../validation/languages/epl/EplValidator';
import { EplPreviewRenderer } from '../preview/languages/epl/EplPreviewRenderer';
import { CpclCompiler } from '../language/cpcl/CpclCompiler';
import { CpclParser } from '../language/cpcl/CpclParser';
import { CpclValidator } from '../validation/languages/cpcl/CpclValidator';
import { CpclPreviewRenderer } from '../preview/languages/cpcl/CpclPreviewRenderer';
import { DplCompiler } from '../language/dpl/DplCompiler';
import { DplParser } from '../language/dpl/DplParser';
import { DplValidator } from '../validation/languages/dpl/DplValidator';
import { DplPreviewRenderer } from '../preview/languages/dpl/DplPreviewRenderer';
import { SbplCompiler } from '../language/sbpl/SbplCompiler';
import { SbplParser } from '../language/sbpl/SbplParser';
import { SbplValidator } from '../validation/languages/sbpl/SbplValidator';
import { SbplPreviewRenderer } from '../preview/languages/sbpl/SbplPreviewRenderer';
import { StarPrntCompiler } from '../language/starprnt/StarPrntCompiler';
import { StarPrntParser } from '../language/starprnt/StarPrntParser';
import { StarPrntValidator } from '../validation/languages/starprnt/StarPrntValidator';
import { StarPrntPreviewRenderer } from '../preview/languages/starprnt/StarPrntPreviewRenderer';
import { IplCompiler } from '../language/ipl/IplCompiler';
import { IplParser } from '../language/ipl/IplParser';
import { IplValidator } from '../validation/languages/ipl/IplValidator';
import { IplPreviewRenderer } from '../preview/languages/ipl/IplPreviewRenderer';

/**
 * Every `PrinterLanguage`'s capabilities except `language` itself — kept
 * separate so `LANGUAGE_REGISTRY` below can derive each entry's `language`
 * field from its own object key instead of repeating the same string
 * literal twice per language (once as the key, once as a hand-typed field —
 * a mismatch between the two wouldn't be a type error, since both sides are
 * independently valid `PrinterLanguage` values).
 */
const LANGUAGE_CAPABILITIES: Record<PrinterLanguage, Omit<PrinterLanguageDefinition, 'language'>> = {
  tsc: {
    compiler: new TscCompiler(),
    parser: new TscParser(),
    validator: new TscValidator(),
    previewRenderer: new TscPreviewRenderer(),
  },
  escpos: {
    compiler: new EscPosCompiler(),
    parser: new EscPosParser(),
    validator: new EscPosValidator(),
    previewRenderer: new EscPosPreviewRenderer(),
  },
  zpl: {
    compiler: new ZplCompiler(),
    parser: new ZplParser(),
    validator: new ZplValidator(),
    previewRenderer: new ZplPreviewRenderer(),
  },
  epl: {
    compiler: new EplCompiler(),
    parser: new EplParser(),
    validator: new EplValidator(),
    previewRenderer: new EplPreviewRenderer(),
  },
  cpcl: {
    compiler: new CpclCompiler(),
    parser: new CpclParser(),
    validator: new CpclValidator(),
    previewRenderer: new CpclPreviewRenderer(),
  },
  dpl: {
    compiler: new DplCompiler(),
    parser: new DplParser(),
    validator: new DplValidator(),
    previewRenderer: new DplPreviewRenderer(),
  },
  sbpl: {
    compiler: new SbplCompiler(),
    parser: new SbplParser(),
    validator: new SbplValidator(),
    previewRenderer: new SbplPreviewRenderer(),
  },
  starprnt: {
    compiler: new StarPrntCompiler(),
    parser: new StarPrntParser(),
    validator: new StarPrntValidator(),
    previewRenderer: new StarPrntPreviewRenderer(),
  },
  ipl: {
    compiler: new IplCompiler(),
    parser: new IplParser(),
    validator: new IplValidator(),
    previewRenderer: new IplPreviewRenderer(),
  },
};

/**
 * Every `PrinterLanguage`'s full capability set. `Record<PrinterLanguage, ...>`
 * makes an incomplete language a compile-time error — TypeScript rejects this
 * object literal if any of the 9 keys is missing. Each entry's `language`
 * field is derived from `LANGUAGE_CAPABILITIES`'s own key, the single place
 * that string is written.
 */
export const LANGUAGE_REGISTRY: Record<PrinterLanguage, PrinterLanguageDefinition> = Object.fromEntries(
  (Object.keys(LANGUAGE_CAPABILITIES) as PrinterLanguage[]).map((language) => [
    language,
    { language, ...LANGUAGE_CAPABILITIES[language] },
  ]),
) as Record<PrinterLanguage, PrinterLanguageDefinition>;
