import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { PRINT_TYPE_LABELS, type PrintType } from '../models/printing/PrintType';

export interface TestPrintPanelProps {
  status: PrinterStatus;
  printType: PrintType;
  testPrintPending: boolean;
  onTestPrint: () => void;
}

export const TestPrintPanel: React.FC<TestPrintPanelProps> = ({ status, printType, testPrintPending, onTestPrint }) => (
  <View style={styles.testPrintRow}>
    <AppButton
      label={`In thử ${PRINT_TYPE_LABELS[printType]}`}
      mode="outlined"
      style={styles.testPrintButton}
      disabled={status !== PrinterStatus.Connected || testPrintPending}
      loading={testPrintPending}
      onPress={onTestPrint}
    />
  </View>
);

const styles = StyleSheet.create({
  testPrintRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  testPrintButton: { flex: 1 },
});
