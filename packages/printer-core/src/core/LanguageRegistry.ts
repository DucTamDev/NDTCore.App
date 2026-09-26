import type { PrinterLanguage } from './PrinterLanguage';
import type { PrinterLanguageDefinition } from './PrinterLanguageDefinition';
import {
  CpclCompiler,
  CpclParser,
  DplCompiler,
  DplParser,
  EplCompiler,
  EplParser,
  EscPosCompiler,
  EscPosParser,
  IplCompiler,
  IplParser,
  SbplCompiler,
  SbplParser,
  StarPrntCompiler,
  StarPrntParser,
  TsplCompiler,
  TsplParser,
  ZplCompiler,
  ZplParser,
} from '../language';
import {
  CpclValidator,
  DplValidator,
  EplValidator,
  EscPosValidator,
  IplValidator,
  SbplValidator,
  StarPrntValidator,
  TsplValidator,
  ZplValidator,
} from '../validation';
import {
  CpclPreviewRenderer,
  DplPreviewRenderer,
  EplPreviewRenderer,
  EscPosPreviewRenderer,
  IplPreviewRenderer,
  SbplPreviewRenderer,
  StarPrntPreviewRenderer,
  TsplPreviewRenderer,
  ZplPreviewRenderer,
} from '../preview';

/** Buộc field `language` của mỗi mục trùng với key, để 2 chỗ viết tên ngôn ngữ không thể lệch nhau. */
type LanguageRegistry = {
  readonly [Language in PrinterLanguage]: PrinterLanguageDefinition & { readonly language: Language };
};

/** Bộ xử lý của cả 9 ngôn ngữ; thiếu ngôn ngữ nào là lỗi type-check. */
export const LANGUAGE_REGISTRY: LanguageRegistry = {
  tspl: {
    language: 'tspl',
    compiler: new TsplCompiler(),
    parser: new TsplParser(),
    validator: new TsplValidator(),
    previewRenderer: new TsplPreviewRenderer(),
  },
  escpos: {
    language: 'escpos',
    compiler: new EscPosCompiler(),
    parser: new EscPosParser(),
    validator: new EscPosValidator(),
    previewRenderer: new EscPosPreviewRenderer(),
  },
  zpl: {
    language: 'zpl',
    compiler: new ZplCompiler(),
    parser: new ZplParser(),
    validator: new ZplValidator(),
    previewRenderer: new ZplPreviewRenderer(),
  },
  epl: {
    language: 'epl',
    compiler: new EplCompiler(),
    parser: new EplParser(),
    validator: new EplValidator(),
    previewRenderer: new EplPreviewRenderer(),
  },
  cpcl: {
    language: 'cpcl',
    compiler: new CpclCompiler(),
    parser: new CpclParser(),
    validator: new CpclValidator(),
    previewRenderer: new CpclPreviewRenderer(),
  },
  dpl: {
    language: 'dpl',
    compiler: new DplCompiler(),
    parser: new DplParser(),
    validator: new DplValidator(),
    previewRenderer: new DplPreviewRenderer(),
  },
  sbpl: {
    language: 'sbpl',
    compiler: new SbplCompiler(),
    parser: new SbplParser(),
    validator: new SbplValidator(),
    previewRenderer: new SbplPreviewRenderer(),
  },
  starprnt: {
    language: 'starprnt',
    compiler: new StarPrntCompiler(),
    parser: new StarPrntParser(),
    validator: new StarPrntValidator(),
    previewRenderer: new StarPrntPreviewRenderer(),
  },
  ipl: {
    language: 'ipl',
    compiler: new IplCompiler(),
    parser: new IplParser(),
    validator: new IplValidator(),
    previewRenderer: new IplPreviewRenderer(),
  },
};
