import { z } from 'zod';
import type { UseFormReturn } from 'react-hook-form';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperSize } from '../../models/paper/PaperSize';
import { PaperType } from '../../models/paper/PaperType';
import type { PaperOptions } from '../../models/paper/PaperOptions';
import { dieCutRowOverflow } from '../../utils/paperUtils';

/** Giá trị form giấy; kích thước tem giữ dạng chữ để ô được trống khi đang gõ. */
export interface PaperFormValues {
  /** Giấy cuộn hay giấy tem. */
  type: PaperType;

  /** Khổ giấy (mm). */
  paperSize: PaperSize;

  /** Cách cắt của giấy cuộn; giấy tem bỏ qua. */
  cutterMode: CutterMode;

  /** Chiều rộng một con tem (mm). */
  itemWidthMm: string;

  /** Chiều cao một con tem (mm). */
  itemHeightMm: string;

  /** Số con tem trên một hàng. */
  columns: string;

  /** Khe giữa hai con tem cạnh nhau (mm). */
  horizontalGapMm: string;

  /** Khe giữa hai hàng tem (mm). */
  verticalGapMm: string;
}

/** Form giấy: nhập `PaperFormValues`, hợp lệ thì ra `PaperOptions`. */
export type PaperForm = UseFormReturn<PaperFormValues, unknown, PaperOptions>;

/** Kích thước điền sẵn khi chuyển sang giấy tem, để form không trống. */
const DIE_CUT_DEFAULTS = {
  itemWidthMm: 30,
  itemHeightMm: 20,
  columns: 2,
  horizontalGapMm: 2,
  verticalGapMm: 3,
} as const;

/** Một ô kích thước tem cùng điều kiện hợp lệ và thông báo khi sai. */
interface DieCutFieldRule {
  /** Ô cần kiểm tra. */
  field: keyof typeof DIE_CUT_DEFAULTS;

  /** Điều kiện với giá trị đã đổi sang số. */
  isValid: (value: number) => boolean;

  /** Thông báo hiện dưới ô khi sai. */
  message: string;
}

/** Theo thứ tự hiển thị trên form, để lỗi đầu tiên là ô trên cùng. */
const DIE_CUT_FIELD_RULES: DieCutFieldRule[] = [
  { field: 'itemWidthMm', isValid: (value) => value > 0, message: 'Rộng tem phải là số lớn hơn 0' },
  { field: 'itemHeightMm', isValid: (value) => value > 0, message: 'Cao tem phải là số lớn hơn 0' },
  {
    field: 'columns',
    isValid: (value) => Number.isInteger(value) && value >= 1,
    message: 'Số cột phải là số nguyên từ 1',
  },
  { field: 'horizontalGapMm', isValid: (value) => value >= 0, message: 'Khoảng cách ngang phải là số từ 0' },
  { field: 'verticalGapMm', isValid: (value) => value >= 0, message: 'Khoảng cách dọc phải là số từ 0' },
];

/** Ô trống là `NaN` chứ không phải 0, để không lọt qua điều kiện `>= 0`. */
const numberOf = (text: string): number => (text.trim() === '' ? Number.NaN : Number(text));

const toPaper = (values: PaperFormValues): PaperOptions => {
  if (values.type === PaperType.Continuous) {
    return { type: PaperType.Continuous, paperSize: values.paperSize, cutterMode: values.cutterMode };
  }

  return {
    type: PaperType.DieCut,
    paperSize: values.paperSize,
    itemWidthMm: numberOf(values.itemWidthMm),
    itemHeightMm: numberOf(values.itemHeightMm),
    columns: numberOf(values.columns),
    horizontalGapMm: numberOf(values.horizontalGapMm),
    verticalGapMm: numberOf(values.verticalGapMm),
  };
};

/** Giấy cuộn bỏ qua các ô kích thước tem. Tràn khổ chỉ kiểm khi mọi ô đã hợp lệ, báo ở ô "Số cột". */
export const paperFormSchema = z
  .object({
    type: z.nativeEnum(PaperType),
    paperSize: z.nativeEnum(PaperSize),
    cutterMode: z.nativeEnum(CutterMode),
    itemWidthMm: z.string(),
    itemHeightMm: z.string(),
    columns: z.string(),
    horizontalGapMm: z.string(),
    verticalGapMm: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.type !== PaperType.DieCut) {
      return;
    }

    const invalidRules = DIE_CUT_FIELD_RULES.filter((rule) => !rule.isValid(numberOf(values[rule.field])));
    invalidRules.forEach((rule) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [rule.field], message: rule.message });
    });

    const overflow = invalidRules.length === 0 ? dieCutRowOverflow(toPaper(values)) : null;

    if (overflow) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['columns'], message: overflow });
    }
  })
  .transform(toPaper);

/** Giá trị ban đầu của form; giấy cuộn vẫn có sẵn kích thước tem mặc định cho lúc chuyển sang giấy tem. */
export const toPaperFormValues = (paper: PaperOptions): PaperFormValues => {
  const dieCut = paper.type === PaperType.DieCut ? paper : DIE_CUT_DEFAULTS;

  return {
    type: paper.type,
    paperSize: paper.paperSize,
    cutterMode: paper.type === PaperType.Continuous ? paper.cutterMode : CutterMode.PerJob,
    itemWidthMm: String(dieCut.itemWidthMm),
    itemHeightMm: String(dieCut.itemHeightMm),
    columns: String(dieCut.columns),
    horizontalGapMm: String(dieCut.horizontalGapMm),
    verticalGapMm: String(dieCut.verticalGapMm),
  };
};

/** Cấu hình giấy từ form, hoặc `null` khi còn ô sai. */
export const toPaperOptions = (values: PaperFormValues): PaperOptions | null => {
  const result = paperFormSchema.safeParse(values);
  return result.success ? result.data : null;
};

/** Lỗi đầu tiên của form giấy để báo cho người dùng; `null` khi hợp lệ. */
export const paperFormErrorOf = (values: PaperFormValues): string | null => {
  const result = paperFormSchema.safeParse(values);
  return result.success ? null : (result.error.issues[0]?.message ?? null);
};
