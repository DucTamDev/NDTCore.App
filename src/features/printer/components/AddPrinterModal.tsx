import React from 'react';
import { StyleSheet } from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import { AddPrinterForm } from './AddPrinterForm';
import type { PrintType } from '../models/printing/PrintType';
import type { Printer } from '../models/printer/Printer';

/**
 * Wrapper mỏng bọc `AddPrinterForm` trong `Modal` — chỉ dùng trên tablet.
 * Điện thoại render thẳng `AddPrinterForm` inline (xem `PrinterManagementPanel`).
 */
export interface AddPrinterModalProps {
  visible: boolean;
  initialValues?: Printer;
  onDismiss: () => void;
  onSaved: () => void;
  printType: PrintType;
}

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved, printType }) => (
  <Portal>
    <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
      <AddPrinterForm visible={visible} initialValues={initialValues} onSaved={onSaved} onBack={onDismiss} printType={printType} />
    </Modal>
  </Portal>
);

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, maxHeight: '85%' },
});
