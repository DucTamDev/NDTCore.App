import React from 'react';
import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../../../components/EmptyState';
import { PrinterListItem } from './PrinterListItem';
import type { PrinterListActions } from '../hooks/usePrinterList';
import type { Printer } from '../types/printer.types';

export interface PrinterListProps {
  printers: Printer[];
  actions: PrinterListActions;
  onEdit: (printer: Printer) => void;
}

export const PrinterList: React.FC<PrinterListProps> = ({ printers, actions, onEdit }) => {
  if (printers.length === 0) return <EmptyState message="Chưa có máy in nào được thêm" />;
  return (
    <View style={styles.container}>
      {printers.map((printer) => (
        <PrinterListItem key={printer.id} printer={printer} actions={actions} onEdit={onEdit} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
});
