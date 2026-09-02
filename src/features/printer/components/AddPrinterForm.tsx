import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { useAddPrinterFlow } from '../hooks/useAddPrinterFlow';
import { ConnectionSection } from './ConnectionSection';
import { StatusPanel } from './StatusPanel';
import { PrinterInfoCard } from './PrinterInfoCard';
import { PRINT_TYPE_LABELS, type PrintType } from '../models/printing/PrintType';
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
  /** Ẩn nút "‹ Quay lại" khi màn cha đã có sẵn nút back riêng (điện thoại — header ứng dụng đã có "← Thiết lập máy in"). Mặc định hiện — bắt buộc với `AddPrinterModal` vì đó là cách duy nhất đóng modal. */
  showBackButton?: boolean;
  /** Mục đích khi THÊM MỚI (tab Hoá đơn/Tem đang mở ở màn danh sách) — bỏ qua khi Sửa. */
  purpose?: PrintType;
}

export const AddPrinterForm: React.FC<AddPrinterFormProps> = ({
  visible,
  initialValues,
  onSaved,
  onBack,
  showBackButton = true,
  purpose,
}) => {
  const flow = useAddPrinterFlow({ visible, initialValues, onSaved, purpose });

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

        {flow.showAddDriverHint ? (
          <Text variant="bodySmall" style={styles.addDriverHint}>
            Máy in này còn hỗ trợ thêm driver khác — bấm "Kết nối" để dò tiếp.
          </Text>
        ) : null}

        {flow.hasEmptyContentTypeDriver ? (
          <Text variant="bodySmall" style={styles.identityError}>
            Mỗi driver phải nhận in ít nhất 1 loại nội dung (Hoá đơn/Tem) — chọn ở phần bên dưới trước khi lưu.
          </Text>
        ) : null}

        {flow.hasPurposeMismatchDriver && purpose ? (
          <Text variant="bodySmall" style={styles.addDriverHint}>
            Driver vừa thêm không hỗ trợ in {PRINT_TYPE_LABELS[purpose]} — vẫn dùng được cho loại nội dung khác.
          </Text>
        ) : null}

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
