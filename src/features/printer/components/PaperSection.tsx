import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Controller, useWatch } from 'react-hook-form';
import { AppSelect } from '../../../components/AppSelect';
import { AppInput } from '../../../components/AppInput';
import { PrintLanguage } from '../models/printer/PrinterLanguage';
import { PaperSize } from '../models/paper/PaperSize';
import { PaperType } from '../models/paper/PaperType';
import type { PaperForm, PaperFormValues } from '../forms/addPrinter/PaperFormSchema';

const PAPER_SIZE_OPTIONS = [PaperSize.Mm58, PaperSize.Mm80, PaperSize.Mm100, PaperSize.Mm104].map((n) => ({ label: `${n}mm`, value: String(n) }));
const MEDIA_TYPE_OPTIONS = [
  { label: 'Giấy cuộn liên tục', value: PaperType.Continuous },
  { label: 'Die-cut (tem rời, nhiều cột)', value: PaperType.DieCut },
];

/** Ô kích thước tem theo thứ tự hiển thị. */
const DIE_CUT_INPUTS: { name: keyof PaperFormValues; label: string }[] = [
  { name: 'itemWidthMm', label: 'Rộng tem (mm)' },
  { name: 'itemHeightMm', label: 'Cao tem (mm)' },
  { name: 'columns', label: 'Số cột' },
  { name: 'horizontalGapMm', label: 'Khoảng cách ngang (mm)' },
  { name: 'verticalGapMm', label: 'Khoảng cách dọc (mm)' },
];

export interface PaperSectionProps {
  /** `undefined` trước khi xác nhận ngôn ngữ; ô loại giấy và kích thước tem chỉ hiện khi là TSPL. */
  languageType?: PrintLanguage;

  /** Form giấy do luồng Thêm/Sửa máy in sở hữu. */
  form: PaperForm;

  disabled: boolean;
}

/** Chọn khổ giấy, và với TSPL thì thêm loại giấy và kích thước tem. */
export const PaperSection: React.FC<PaperSectionProps> = ({ languageType, form, disabled }) => {
  const { control, formState } = form;
  const paperType = useWatch({ control, name: 'type' });
  const isTspl = languageType === PrintLanguage.Tspl;

  return (
    <View style={styles.block}>
      <Controller
        control={control}
        name="paperSize"
        render={({ field }) => (
          <AppSelect
            label="Khổ giấy"
            value={String(field.value)}
            onSelect={(value) => field.onChange(Number(value) as PaperSize)}
            options={PAPER_SIZE_OPTIONS}
            disabled={disabled}
          />
        )}
      />
      {isTspl ? (
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <AppSelect
              label="Loại giấy"
              value={field.value}
              onSelect={(value) => field.onChange(value as PaperType)}
              options={MEDIA_TYPE_OPTIONS}
              disabled={disabled}
            />
          )}
        />
      ) : null}
      {isTspl && paperType === PaperType.DieCut
        ? DIE_CUT_INPUTS.map(({ name, label }) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field }) => (
                <AppInput
                  label={label}
                  keyboardType="numeric"
                  value={String(field.value)}
                  onChangeText={field.onChange}
                  errorMessage={formState.errors[name]?.message}
                  disabled={disabled}
                />
              )}
            />
          ))
        : null}
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: 8 },
});
