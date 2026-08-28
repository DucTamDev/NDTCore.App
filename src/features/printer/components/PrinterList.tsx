import React from 'react';
import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../../../components/EmptyState';
import { PrinterListItem } from './PrinterListItem';
import type { Printer } from '../types/printer.types';

export interface PrinterListProps {
  printers: Printer[];
  onEdit: (printer: Printer) => void;
  onChanged: () => void;
}

export const PrinterList: React.FC<PrinterListProps> = ({ printers, onEdit, onChanged }) => {
  if (printers.length === 0) return <EmptyState message="Chưa có máy in nào được thêm" />;
  return (
    <View style={styles.container}>
      {printers.map((printer) => (
        <PrinterListItem key={printer.id} printer={printer} onEdit={onEdit} onChanged={onChanged} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
});
