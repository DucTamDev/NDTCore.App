import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppButton } from '../../../components/AppButton';
import { ConnectionStatus } from '../models/connections/ConnectionStatus';
import { PRINT_KIND_LABELS } from '../utils/printKindLabels';
import { type PrintKind } from '../models/printer/PrintKind';

export interface TestPrintPanelProps {
  status: ConnectionStatus;
  kind: PrintKind;
  testPrintPending: boolean;
  onTestPrint: () => void;
}

export const TestPrintPanel: React.FC<TestPrintPanelProps> = ({ status, kind, testPrintPending, onTestPrint }) => (
  <View style={styles.testPrintRow}>
    <AppButton
      label={`In thử ${PRINT_KIND_LABELS[kind]}`}
      mode="outlined"
      style={styles.testPrintButton}
      disabled={status !== ConnectionStatus.Connected || testPrintPending}
      loading={testPrintPending}
      onPress={onTestPrint}
    />
  </View>
);

const styles = StyleSheet.create({
  testPrintRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  testPrintButton: { flex: 1 },
});
