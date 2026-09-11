import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatus } from '../models/printer/PrinterStatus';

interface TestPrintPanelProps {
  status: PrinterStatus;
  canPrintReceipt: boolean;
  canPrintLabel: boolean;
  testPrintReceiptPending: boolean;
  testPrintLabelPending: boolean;
  onTestPrintReceipt: () => void;
  onTestPrintLabel: () => void;
}

export const TestPrintPanel: React.FC<TestPrintPanelProps> = ({
  status,
  canPrintReceipt,
  canPrintLabel,
  testPrintReceiptPending,
  testPrintLabelPending,
  onTestPrintReceipt,
  onTestPrintLabel,
}) => (
  <View style={styles.testPrintRow}>
    <AppButton
      label="In bill thử"
      mode="outlined"
      style={styles.testPrintButton}
      disabled={status !== PrinterStatus.Connected || !canPrintReceipt || testPrintReceiptPending}
      loading={testPrintReceiptPending}
      onPress={onTestPrintReceipt}
    />
    <AppButton
      label="In tem thử"
      mode="outlined"
      style={styles.testPrintButton}
      disabled={status !== PrinterStatus.Connected || !canPrintLabel || testPrintLabelPending}
      loading={testPrintLabelPending}
      onPress={onTestPrintLabel}
    />
  </View>
);

const styles = StyleSheet.create({
  testPrintRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  testPrintButton: { flex: 1 },
});
