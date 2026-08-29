import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { usePrinterList } from '../hooks/usePrinterList';
import { PrinterList } from './PrinterList';
import { AddPrinterModal } from './AddPrinterModal';
import type { Printer } from '../types/printer.types';

export const PrinterManagementPanel: React.FC = () => {
  const { printers, reload, ...actions } = usePrinterList();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | undefined>(undefined);
  const [addSessionId, setAddSessionId] = useState(0);

  const openAddModal = (): void => {
    setAddSessionId((n) => n + 1);
    setEditingPrinter(undefined);
    setModalVisible(true);
  };

  const openEditModal = (printer: Printer): void => {
    setEditingPrinter(printer);
    setModalVisible(true);
  };

  const closeModal = (): void => setModalVisible(false);

  const onSaved = (): void => {
    closeModal();
    reload();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleSmall">Quản lý máy in</Text>
        <AppButton label="Thêm máy in" onPress={openAddModal} />
      </View>

      <PrinterList printers={printers} actions={actions} onEdit={openEditModal} />

      <AddPrinterModal
        key={editingPrinter?.id ?? `add-${addSessionId}`}
        visible={modalVisible}
        initialValues={editingPrinter}
        onDismiss={closeModal}
        onSaved={onSaved}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
