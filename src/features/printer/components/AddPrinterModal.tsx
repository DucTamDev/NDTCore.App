import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Modal, Portal, Snackbar, Text } from 'react-native-paper';
import { useAddPrinterFlow } from '../hooks/useAddPrinterFlow';
import { ConnectionSection } from './ConnectionSection';
import { StatusPanel } from './StatusPanel';
import { PrinterInfoCard } from './PrinterInfoCard';
import type { Printer } from '../types/printer.types';

export interface AddPrinterModalProps {
  visible: boolean;
  initialValues?: Printer;
  onDismiss: () => void;
  onSaved: () => void;
}

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved }) => {
  const flow = useAddPrinterFlow({ visible, initialValues, onSaved });

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text variant="titleMedium">{flow.title}</Text>

          <ConnectionSection {...flow.connectionSection} />
          {flow.identityErrorMessage ? <Text style={styles.identityError}>{flow.identityErrorMessage}</Text> : null}

          <StatusPanel {...flow.statusPanel} />

          {flow.showAddDriverHint ? (
            <Text variant="bodySmall" style={styles.addDriverHint}>Máy in này còn hỗ trợ thêm driver khác — bấm "Kết nối" để dò tiếp.</Text>
          ) : null}

          {flow.hasEmptyContentTypeDriver ? (
            <Text variant="bodySmall" style={styles.identityError}>
              Mỗi driver phải nhận in ít nhất 1 loại nội dung (Hoá đơn/Tem) — chọn ở phần bên dưới trước khi lưu.
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
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, maxHeight: '85%' },
  scrollContent: { gap: 12 },
  identityError: { color: '#B91C1C' },
  addDriverHint: { color: '#6B7280' },
});
