import { useEffect, useState } from 'react';
import type { OptionGroupViewModel, OptionViewModel } from '../../catalog/types/catalog.types';
import type { CartItemOption } from '../types/cart.types';

export type OptionSelectionState = Record<number, number[]>;

export interface UseOptionSelectionResult {
  selection: OptionSelectionState;
  selectedOptions: CartItemOption[];
  canConfirm: boolean;
  toggleSingle: (groupId: number, optionId: number) => void;
  toggleMulti: (group: OptionGroupViewModel, optionId: number) => void;
}

/**
 * Logic chọn option dùng chung giữa CartItemEditModal (sửa 1 dòng đã có
 * trong giỏ) và OptionSelectionModal (thêm sản phẩm mới vào giỏ) — 2 màn
 * hình giống hệt nhau về cách chọn/bỏ chọn option, chỉ khác cách khởi tạo
 * selection ban đầu (từ CartItem đã chọn sẵn, hay từ option mặc định của
 * sản phẩm), nên phần khởi tạo giao cho `seed`.
 */
export const useOptionSelection = <TSource extends { optionGroups: OptionGroupViewModel[] }>(
  source: TSource | null,
  seed: (source: TSource) => OptionSelectionState,
): UseOptionSelectionResult => {
  const [selection, setSelection] = useState<OptionSelectionState>({});

  useEffect(() => {
    if (!source) return;
    setSelection(seed(source));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ re-seed khi `source` đổi identity, `seed` là closure mới mỗi render nhưng không phải tín hiệu để chạy lại
  }, [source]);

  const selectedOptions: CartItemOption[] = source
    ? source.optionGroups.flatMap((group) =>
        (selection[group.groupId] ?? [])
          .map((optionId) => group.options.find((option) => option.id === optionId))
          .filter((option): option is OptionViewModel => option !== undefined)
          .map((option) => ({
            optionId: option.id,
            groupName: group.groupName,
            optionName: option.name,
            price: option.price,
          })),
      )
    : [];

  const canConfirm = source
    ? source.optionGroups.every(
        (group) => !group.isRequired || (selection[group.groupId]?.length ?? 0) >= group.minSelect,
      )
    : false;

  const toggleSingle = (groupId: number, optionId: number): void => {
    setSelection((prev) => ({ ...prev, [groupId]: [optionId] }));
  };

  const toggleMulti = (group: OptionGroupViewModel, optionId: number): void => {
    setSelection((prev) => {
      const current = prev[group.groupId] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [group.groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.maxSelect) return prev;
      return { ...prev, [group.groupId]: [...current, optionId] };
    });
  };

  return { selection, selectedOptions, canConfirm, toggleSingle, toggleMulti };
};
