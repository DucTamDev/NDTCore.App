import type { PrinterLanguage, PrinterLanguageDefinition } from '../core';
import { EscPosCompiler, EscPosParser, TsplCompiler, TsplParser } from '../language';
import { EscPosPreviewRenderer, TsplPreviewRenderer } from '../preview';
import { EscPosValidator, TsplValidator } from '../validation';

/** Buộc field `language` của mỗi mục trùng với key, để 2 chỗ viết tên ngôn ngữ không thể lệch nhau. */
type LanguageRegistry = {
  readonly [Language in PrinterLanguage]: PrinterLanguageDefinition & { readonly language: Language };
};

/** Bộ xử lý của từng ngôn ngữ; thiếu ngôn ngữ nào là lỗi type-check. */
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
};
