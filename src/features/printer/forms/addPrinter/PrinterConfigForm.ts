import type { UseFormSetError } from 'react-hook-form';
import {
  CutMode,
  DEFAULT_LABEL_PAPER,
  DEFAULT_RECEIPT_PAPER,
  FieldErrorReason,
  PrinterDefaults,
  PrinterDpi,
  PrinterKind,
  type FieldError,
  type PrinterConfig,
  type PrinterConfigUpdate,
  type PrinterLang,
} from '@ndtcore/printer';

/** Giá trị form cấu hình máy in; số giữ dạng chữ để ô được trống khi đang gõ. */
export interface PrinterConfigFormValues {
  /** Tên hiển thị. */
  name: string;

  /** Ngôn ngữ lệnh in; rỗng khi package không dò được và người dùng chưa chọn. */
  lang: PrinterLang | '';

  /** Máy có dao cắt. */
  hasCutter: boolean;

  /** Độ phân giải. */
  dpi: PrinterDpi;

  /** Khổ giấy (hoá đơn) hoặc rộng một tem, mm. */
  widthMm: string;

  /** Cao một tem, mm. */
  heightMm: string;

  /** Cắt giấy sau khi in (hoá đơn). */
  cutMode: CutMode;

  /** Số dòng đẩy giấy (hoá đơn). */
  feedLines: string;

  /** Số tem mỗi hàng. */
  columns: string;

  /** Khe giữa hai tem cạnh nhau, mm. */
  columnGapMm: string;

  /** Khe giữa hai hàng tem, mm. */
  rowGapMm: string;
}

/** Ô của form. */
export type PrinterConfigFormField = keyof PrinterConfigFormValues;

/** Giá trị form từ cấu hình của package; field giấy thiếu lấy mặc định để ô không trống. */
export const formValuesOf = (
  config: PrinterConfig,
): PrinterConfigFormValues => {
  const { paper, capabilities } = config;

  return {
    name: config.name,
    lang: config.lang,
    hasCutter: capabilities.hasCutter,
    dpi: capabilities.dpi,
    widthMm: String(paper.widthMm),
    heightMm: String(paper.heightMm ?? DEFAULT_LABEL_PAPER.heightMm),
    cutMode: paper.cutMode ?? DEFAULT_RECEIPT_PAPER.cutMode,
    feedLines: String(paper.feedLines ?? DEFAULT_RECEIPT_PAPER.feedLines),
    columns: String(paper.columns ?? DEFAULT_LABEL_PAPER.columns),
    columnGapMm: String(paper.columnGapMm ?? DEFAULT_LABEL_PAPER.columnGapMm),
    rowGapMm: String(paper.rowGapMm ?? DEFAULT_LABEL_PAPER.rowGapMm),
  };
};

/** Giá trị form mặc định của kind, trước khi kết nối được máy. */
export const defaultFormValuesOf = (
  kind: PrinterKind,
): PrinterConfigFormValues =>
  formValuesOf({
    kind,
    name: '',
    lang: '' as PrinterLang,
    langSource: 'Manual',
    capabilities: PrinterDefaults.capabilitiesFor(kind),
    paper: PrinterDefaults.paperFor(kind),
  });

/**
 * Bản cập nhật gửi package: chỉ field giấy của kind; số sai dạng thành NaN để validator của package báo đúng ô. Lang
 * rỗng thì không gửi, package báo lang REQUIRED.
 */
export const configUpdateOf = (
  values: PrinterConfigFormValues,
  kind: PrinterKind,
): PrinterConfigUpdate => {
  const paper =
    kind === PrinterKind.Receipt
      ? {
          widthMm: Number(values.widthMm),
          cutMode: values.cutMode,
          feedLines: Number(values.feedLines),
        }
      : {
          widthMm: Number(values.widthMm),
          heightMm: Number(values.heightMm),
          columns: Number(values.columns),
          columnGapMm: Number(values.columnGapMm),
          rowGapMm: Number(values.rowGapMm),
        };

  return {
    name: values.name,
    ...(values.lang ? { lang: values.lang } : {}),
    capabilities: { hasCutter: values.hasCutter, dpi: values.dpi },
    paper,
  };
};

/** Đường dẫn trường lỗi của package ứng với ô của form; undefined khi không có ô (vd 'printer'). */
const FIELD_BY_PATH: Record<string, PrinterConfigFormField> = {
  name: 'name',
  lang: 'lang',
  'capabilities.hasCutter': 'hasCutter',
  'capabilities.dpi': 'dpi',
  'paper.widthMm': 'widthMm',
  'paper.heightMm': 'heightMm',
  'paper.cutMode': 'cutMode',
  'paper.feedLines': 'feedLines',
  'paper.columns': 'columns',
  'paper.columnGapMm': 'columnGapMm',
  'paper.rowGapMm': 'rowGapMm',
};

/** Ô của form ứng với đường dẫn lỗi của package. */
export const formFieldOf = (path: string): PrinterConfigFormField | undefined =>
  FIELD_BY_PATH[path];

const MESSAGE_BY_REASON: Record<FieldErrorReason, string> = {
  [FieldErrorReason.Required]: 'Bắt buộc nhập',
  [FieldErrorReason.TooLong]: 'Tối đa 50 ký tự',
  [FieldErrorReason.NotInteger]: 'Phải là số nguyên',
  [FieldErrorReason.OutOfRange]: 'Giá trị ngoài khoảng cho phép',
  [FieldErrorReason.TooManyDecimals]: 'Tối đa một chữ số thập phân',
  [FieldErrorReason.InvalidFormat]: 'Sai định dạng',
  [FieldErrorReason.CutterRequired]: 'Máy không có dao cắt',
  [FieldErrorReason.NotEditable]: 'Không sửa được',
};

/** Câu lỗi dưới ô theo lý do của package. */
export const fieldMessageOf = (reason: FieldErrorReason): string =>
  MESSAGE_BY_REASON[reason];

/** Gắn lỗi theo trường của package vào ô tương ứng; trả lỗi không có ô để nơi gọi báo chung. */
export const applyFieldErrors = (
  fieldErrors: FieldError[],
  setError: UseFormSetError<PrinterConfigFormValues>,
): FieldError[] =>
  fieldErrors.filter(error => {
    const field = formFieldOf(error.field);

    if (field) {
      setError(field, {
        type: error.reason,
        message: fieldMessageOf(error.reason),
      });
    }

    return !field;
  });
