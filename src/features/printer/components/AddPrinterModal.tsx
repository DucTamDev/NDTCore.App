import React from 'react';
import { StyleSheet } from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import { AddPrinterForm } from './AddPrinterForm';
import type { Printer } from '../types/printer.types';

/**
 * Wrapper mỏng bọc `AddPrinterForm` trong `Modal` — chỉ dùng trên tablet.
 * Điện thoại render thẳng `AddPrinterForm` inline (xem `PrinterManagementPanel`).
 */
export interface AddPrinterModalProps {
  visible: boolean;
  initialValues?: Printer;
  onDismiss: () => void;
  onSaved: () => void;
}

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved }) => (
  <Portal>
    <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
      <AddPrinterForm visible={visible} initialValues={initialValues} onSaved={onSaved} onBack={onDismiss} />
    </Modal>
  </Portal>
);

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, maxHeight: '85%' },
});
