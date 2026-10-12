import type { PrintItem, PrintTopping } from './PrintItem';
import type { LabelTemplateOptions } from './LabelTemplateOptions';

/** Dữ liệu tem của một đơn; mỗi phần món một ly. */
export interface LabelContent {
  storeName: string | null;

  orderNumber: string;

  /** Tên hình thức phục vụ đã dịch sẵn (vd "Mang đi"). */
  serviceType: string | null;

  /** Giờ in ở dòng dưới, đã định dạng (vd "10:42"). */
  time: string;

  items: PrintItem[];
}

/** Một con tem: một ly, hoặc một phần topping của ly khi ly có nhiều topping hơn mức tối đa. */
export interface LabelPage {
  item: PrintItem;

  /** Thứ tự ly trong cả đơn, từ 1. */
  cupNumber: number;

  cupCount: number;

  /** Thứ tự tem trong ly, từ 1. */
  partNumber: number;

  partCount: number;

  /** Topping in trên tem này. */
  toppings: PrintTopping[];
}

/** Món số lượng 2 là hai ly, mỗi ly in tem riêng. */
const cupsOf = (items: PrintItem[]): PrintItem[] =>
  items.flatMap((item) => Array.from({ length: item.quantity }, () => item));

/** Mọi con tem của đơn theo thứ tự in: hết các tem của ly này mới sang ly kế. */
export const labelPagesOf = (content: LabelContent, options: LabelTemplateOptions): LabelPage[] => {
  const cups = cupsOf(content.items);
  const maxToppings = Math.max(1, options.maxToppingsPerLabel);

  return cups.flatMap((item, cupIndex) => {
    const toppings = options.showToppings ? item.toppings : [];
    const partCount = Math.max(1, Math.ceil(toppings.length / maxToppings));

    return Array.from({ length: partCount }, (_, partIndex) => ({
      item,
      cupNumber: cupIndex + 1,
      cupCount: cups.length,
      partNumber: partIndex + 1,
      partCount,
      toppings: toppings.slice(partIndex * maxToppings, (partIndex + 1) * maxToppings),
    }));
  });
};
