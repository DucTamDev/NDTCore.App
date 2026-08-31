import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatus } from '../models/printer/PrinterStatus';

interface TestPrintPanelProps {
  status: PrinterStatus;
  hasTsplDriver: boolean;
  canPrintReceipt: boolean;
  canPrintLabel: boolean;
  testPrintRowsText: string;
  onTestPrintRowsChange: (t: string) => void;
  testPrintReceiptPending: boolean;
  testPrintLabelPending: boolean;
  onTestPrintReceipt: () => void;
  onTestPrintLabel: () => void;
  disabled: boolean;
}

export const TestPrintPanel: React.FC<TestPrintPanelProps> = ({
  status,
  hasTsplDriver,
  canPrintReceipt,
  canPrintLabel,
  testPrintRowsText,
  onTestPrintRowsChange,
  testPrintReceiptPending,
  testPrintLabelPending,
  onTestPrintReceipt,
  onTestPrintLabel,
  disabled,
}) => (
  <>
    {hasTsplDriver ? (
      <AppInput
        label="Số hàng in thử"
        keyboardType="numeric"
        value={testPrintRowsText}
        onChangeText={onTestPrintRowsChange}
        disabled={disabled}
      />
    ) : null}
    <View style={styles.testPrintRow}>
      <AppButton
        label="In bill thử"
        mode="outlined"
        style={styles.testPrintButton}
        disabled={status !== PrinterStatus.connected || !canPrintReceipt || testPrintReceiptPending}
        loading={testPrintReceiptPending}
        onPress={onTestPrintReceipt}
      />
      <AppButton
        label="In tem thử"
        mode="outlined"
        style={styles.testPrintButton}
        disabled={status !== PrinterStatus.connected || !canPrintLabel || testPrintLabelPending}
        loading={testPrintLabelPending}
        onPress={onTestPrintLabel}
      />
    </View>
  </>
);

const styles = StyleSheet.create({
  testPrintRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  testPrintButton: { flex: 1 },
});
