import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, List } from 'react-native-paper';
import { Controller } from 'react-hook-form';
import {
  PrinterKind,
  PrinterLang,
  TransportType,
  type Printer,
} from '@ndtcore/printer';
import { AppInput } from '../../../components/AppInput';
import { AppSelect } from '../../../components/AppSelect';
import { AppButton } from '../../../components/AppButton';
import { PaperSection } from './PaperSection';
import { TestPrintPanel } from './TestPrintPanel';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import type { UseAddPrinterFlow } from '../hooks/useAddPrinterFlow';

const transportLabel: Record<
  Printer['connectionConfig']['transportType'],
  string
> = {
  Usb: 'USB',
  BluetoothClassic: 'Bluetooth',
  Lan: 'LAN',
};

const LANG_OPTIONS = [
  { label: 'ESC/POS', value: PrinterLang.EscPos },
  { label: 'TSPL', value: PrinterLang.Tspl },
];

/** Thuộc tính khung cấu hình máy in. */
export interface PrinterInfoCardProps {
  /** Luồng thêm, sửa máy in. */
  flow: UseAddPrinterFlow;

  /** Loại nội dung cố định. */
  kind: PrinterKind;
}

/** Tên, ngôn ngữ lệnh in, IP máy LAN đã lưu, giấy và khả năng máy, in thử, lưu. Khoá khi chưa có máy. */
export const PrinterInfoCard: React.FC<PrinterInfoCardProps> = ({
  flow,
  kind,
}) => {
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const { form, basePrinter, lan, testPrint, isEdit } = flow;
  const { control, formState } = form;
  const locked = !basePrinter;
  const editsLan =
    isEdit && basePrinter?.connectionConfig.transportType === TransportType.Lan;

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <AppInput
            label="Tên hiển thị"
            value={field.value}
            onChangeText={field.onChange}
            errorMessage={formState.errors.name?.message}
            disabled={locked}
          />
        )}
      />
      <Controller
        control={control}
        name="lang"
        render={({ field }) => (
          <View>
            <AppSelect
              label="Ngôn ngữ lệnh in"
              value={field.value || undefined}
              onSelect={field.onChange}
              options={LANG_OPTIONS}
              disabled={locked}
            />
            {formState.errors.lang ? (
              <Text style={styles.error}>{formState.errors.lang.message}</Text>
            ) : null}
          </View>
        )}
      />

      {basePrinter ? (
        <View style={styles.row}>
          <Text variant="bodySmall">
            Kết nối:{' '}
            {transportLabel[basePrinter.connectionConfig.transportType]}
          </Text>
          {isEdit ? <PrinterStatusBadge status={basePrinter.status} /> : null}
        </View>
      ) : null}

      {editsLan ? (
        <>
          <AppInput
            label="Địa chỉ IP"
            value={lan.host}
            onChangeText={lan.setHost}
            errorMessage={lan.hostError}
          />
          <AppInput
            label="Cổng"
            value={lan.port}
            onChangeText={lan.setPort}
            keyboardType="numeric"
            errorMessage={lan.portError}
          />
        </>
      ) : null}

      <List.Accordion
        title="Cài đặt nâng cao"
        expanded={advancedExpanded}
        onPress={() => setAdvancedExpanded(value => !value)}
        style={styles.advancedAccordion}
      >
        <PaperSection form={form} kind={kind} disabled={locked} />
        {kind === PrinterKind.Label ? (
          <AppInput
            label="Số hàng in thử"
            keyboardType="numeric"
            value={testPrint.rowsText}
            onChangeText={testPrint.setRowsText}
            disabled={locked}
          />
        ) : null}
      </List.Accordion>

      <TestPrintPanel
        enabled={!locked}
        kind={kind}
        pending={testPrint.pending}
        onTestPrint={flow.testPrintAsync}
      />
      <AppButton
        label="Lưu máy in"
        disabled={locked || flow.saving}
        loading={flow.saving}
        onPress={flow.saveAsync}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  advancedAccordion: { paddingHorizontal: 0 },
  error: { color: '#B91C1C', fontSize: 12 },
});
