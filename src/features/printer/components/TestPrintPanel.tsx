import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { PrinterKind } from '@ndtcore/printer';
import { AppButton } from '../../../components/AppButton';
import { PRINT_KIND_LABELS } from '../utils/printKindLabels';

/** Thuộc tính nút in thử. */
export interface TestPrintPanelProps {
  /** Có máy để in thử (đã kết nối khi thêm, hoặc máy đã lưu). */
  enabled: boolean;

  /** Loại nội dung, để ghi nhãn nút. */
  kind: PrinterKind;

  /** Đang gửi bản in thử. */
  pending: boolean;

  /** In thử theo cấu hình đang nhập. */
  onTestPrint: () => void;
}

/** Nút in thử mẫu thật của App. */
export const TestPrintPanel: React.FC<TestPrintPanelProps> = ({
  enabled,
  kind,
  pending,
  onTestPrint,
}) => (
  <View style={styles.testPrintRow}>
    <AppButton
      label={`In thử ${PRINT_KIND_LABELS[kind]}`}
      mode="outlined"
      style={styles.testPrintButton}
      disabled={!enabled || pending}
      loading={pending}
      onPress={onTestPrint}
    />
  </View>
);

const styles = StyleSheet.create({
  testPrintRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  testPrintButton: { flex: 1 },
});
