import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { useAddPrinterFlow } from '../hooks/useAddPrinterFlow';
import { ConnectionSection } from './ConnectionSection';
import { StatusPanel } from './StatusPanel';
import { PrinterInfoCard } from './PrinterInfoCard';
import type { PrintType } from '../models/printing/PrintType';
import type { Printer } from '../models/printer/Printer';

/**
 * Nội dung form Thêm/Sửa máy in — không có `Modal`/`Portal`.
 * Trên điện thoại `PrinterManagementPanel` render thẳng component này thay cho danh sách;
 * trên tablet nó được bọc trong `AddPrinterModal`.
 */
export interface AddPrinterFormProps {
  visible: boolean;
  initialValues?: Printer;
  onSaved: () => void;
  onBack: () => void;
  /** Ẩn nút "‹ Quay lại" khi màn cha đã có sẵn nút back riêng. Mặc định hiện — bắt buộc với `AddPrinterModal`. */
  showBackButton?: boolean;
  /** Loại nội dung CỐ ĐỊNH của printer này — tab đang mở lúc Thêm mới, hoặc `initialValues.type` lúc Sửa. */
  printType: PrintType;
}

export const AddPrinterForm: React.FC<AddPrinterFormProps> = ({
  visible,
  initialValues,
  onSaved,
  onBack,
  showBackButton = true,
  printType,
}) => {
  const flow = useAddPrinterFlow({ visible, initialValues, onSaved, printType });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {showBackButton ? <AppButton mode="text" label="‹ Quay lại" onPress={onBack} /> : null}
        <Text variant="titleMedium">{flow.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ConnectionSection {...flow.connectionSection} />
        {flow.identityErrorMessage ? <Text style={styles.identityError}>{flow.identityErrorMessage}</Text> : null}

        <StatusPanel {...flow.statusPanel} />

        {flow.hasDieCutMediaError ? (
          <Text variant="bodySmall" style={styles.identityError}>
            Cấu hình die-cut chưa hợp lệ (khổ giấy/số cột/khoảng cách) — mở "Cài đặt nâng cao" để sửa trước khi lưu.
          </Text>
        ) : null}

        <PrinterInfoCard {...flow.infoCard} />
        {flow.captureNode}
      </ScrollView>

      <Snackbar visible={flow.testPrintErrorMessage !== null} onDismiss={flow.clearTestPrintError} duration={5000}>
        {flow.testPrintErrorMessage}
      </Snackbar>
      <Snackbar visible={flow.saveErrorMessage !== null} onDismiss={flow.clearSaveError} duration={5000}>
        {flow.saveErrorMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scrollContent: { gap: 12, paddingBottom: 24 },
  identityError: { color: '#B91C1C' },
  addDriverHint: { color: '#6B7280' },
});
