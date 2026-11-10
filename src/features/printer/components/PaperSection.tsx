import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Switch, Text } from 'react-native-paper';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import {
  CutMode,
  LABEL_SIZE_PRESETS_MM,
  PrinterDpi,
  PrinterKind,
  RECEIPT_PAPER_WIDTHS_MM,
} from '@ndtcore/printer';
import { AppSelect } from '../../../components/AppSelect';
import { AppInput } from '../../../components/AppInput';
import type {
  PrinterConfigFormField,
  PrinterConfigFormValues,
} from '../forms/addPrinter/PrinterConfigForm';

const CUT_MODE_OPTIONS: { label: string; value: CutMode }[] = [
  { label: 'Cắt hết', value: CutMode.Full },
  { label: 'Cắt một phần', value: CutMode.Partial },
  { label: 'Không cắt', value: CutMode.None },
];

const DPI_OPTIONS = [PrinterDpi.Dpi203, PrinterDpi.Dpi300].map(dpi => ({
  label: `${dpi} dpi`,
  value: String(dpi),
}));

/** Ô số của tem theo thứ tự hiển thị. */
const LABEL_INPUTS: { name: PrinterConfigFormField; label: string }[] = [
  { name: 'widthMm', label: 'Rộng tem (mm)' },
  { name: 'heightMm', label: 'Cao tem (mm)' },
  { name: 'columns', label: 'Số tem mỗi hàng' },
  { name: 'columnGapMm', label: 'Khe giữa hai tem (mm)' },
  { name: 'rowGapMm', label: 'Khe giữa hai hàng (mm)' },
];

/** Khổ có sẵn, thêm khổ đang nhập nếu là khổ tự nhập để ô chọn vẫn hiện đúng. */
const widthOptionsOf = (current: string) =>
  [...new Set([...RECEIPT_PAPER_WIDTHS_MM.map(String), current])]
    .filter(Boolean)
    .map(width => ({ label: `${width}mm`, value: width }));

/** Thuộc tính phần giấy và khả năng máy. */
export interface PaperSectionProps {
  /** Form cấu hình in. */
  form: UseFormReturn<PrinterConfigFormValues>;

  /** Loại nội dung, quyết định ô giấy hiện ra. */
  kind: PrinterKind;

  /** Khoá khi chưa kết nối. */
  disabled: boolean;
}

/** Hoá đơn: khổ, cắt giấy, đẩy giấy. Tem: cỡ tem, số tem mỗi hàng, khe. Cả hai: dao cắt, độ phân giải. */
export const PaperSection: React.FC<PaperSectionProps> = ({
  form,
  kind,
  disabled,
}) => {
  const { control, formState, setValue } = form;
  const widthMm = useWatch({ control, name: 'widthMm' });
  const hasCutter = useWatch({ control, name: 'hasCutter' });
  const errorOf = (name: PrinterConfigFormField) =>
    formState.errors[name]?.message;

  const numberInput = (name: PrinterConfigFormField, label: string) => (
    <Controller
      key={name}
      control={control}
      name={name}
      render={({ field }) => (
        <AppInput
          label={label}
          keyboardType="decimal-pad"
          value={String(field.value)}
          onChangeText={field.onChange}
          errorMessage={errorOf(name)}
          disabled={disabled}
        />
      )}
    />
  );

  return (
    <View style={styles.block}>
      {kind === PrinterKind.Receipt ? (
        <>
          <Controller
            control={control}
            name="widthMm"
            render={({ field }) => (
              <AppSelect
                label="Khổ giấy"
                value={field.value}
                onSelect={field.onChange}
                options={widthOptionsOf(widthMm)}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={control}
            name="cutMode"
            render={({ field }) => (
              <AppSelect
                label="Cắt giấy sau khi in"
                value={hasCutter ? field.value : CutMode.None}
                onSelect={field.onChange}
                options={
                  hasCutter
                    ? CUT_MODE_OPTIONS
                    : CUT_MODE_OPTIONS.filter(
                        item => item.value === CutMode.None,
                      )
                }
                disabled={disabled}
              />
            )}
          />
          {numberInput('feedLines', 'Số dòng đẩy giấy')}
        </>
      ) : (
        <>
          <AppSelect
            label="Cỡ tem có sẵn"
            value={undefined}
            onSelect={value => {
              const [width, height] = value.split('x');
              setValue('widthMm', width ?? '');
              setValue('heightMm', height ?? '');
            }}
            options={LABEL_SIZE_PRESETS_MM.map(size => ({
              label: `${size.widthMm} × ${size.heightMm} mm`,
              value: `${size.widthMm}x${size.heightMm}`,
            }))}
            disabled={disabled}
          />
          {LABEL_INPUTS.map(({ name, label }) => numberInput(name, label))}
        </>
      )}
      <View style={styles.switchRow}>
        <Text variant="bodyMedium">Máy có dao cắt</Text>
        <Controller
          control={control}
          name="hasCutter"
          render={({ field }) => (
            <Switch
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
      </View>
      <Controller
        control={control}
        name="dpi"
        render={({ field }) => (
          <AppSelect
            label="Độ phân giải"
            value={String(field.value)}
            onSelect={value => field.onChange(Number(value) as PrinterDpi)}
            options={DPI_OPTIONS}
            disabled={disabled}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
