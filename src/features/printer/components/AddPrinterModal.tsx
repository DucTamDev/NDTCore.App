import React from 'react';
import { StyleSheet } from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import type { Printer, PrinterKind } from '@ndtcore/printer';
import { AddPrinterForm } from './AddPrinterForm';

/** Thuộc tính modal thêm, sửa máy in trên tablet. */
export interface AddPrinterModalProps {
  /** Hiện modal. */
  visible: boolean;

  /** Máy đã lưu khi sửa. */
  initialPrinter?: Printer;

  /** Đóng không lưu. */
  onDismiss: () => void;

  /** Lưu xong. */
  onSaved: () => void;

  /** Loại nội dung cố định. */
  kind: PrinterKind;
}

/** Bọc `AddPrinterForm` trong `Modal`, chỉ dùng trên tablet; điện thoại render form thẳng trong màn danh sách. */
export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({
  visible,
  initialPrinter,
  onDismiss,
  onSaved,
  kind,
}) => (
  <Portal>
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={styles.container}
    >
      {/* Chỉ mount form khi hiện: đóng modal là unmount, luồng thêm máy của package được huỷ. */}
      {visible ? (
        <AddPrinterForm
          initialPrinter={initialPrinter}
          onSaved={onSaved}
          onBack={onDismiss}
          kind={kind}
        />
      ) : null}
    </Modal>
  </Portal>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    margin: 24,
    padding: 16,
    borderRadius: 16,
    maxHeight: '85%',
  },
});
