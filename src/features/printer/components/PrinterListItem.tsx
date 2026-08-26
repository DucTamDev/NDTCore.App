// src/features/printer/components/PrinterListItem.tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, Menu } from 'react-native-paper';
import { usePrinterConnection } from '../hooks/usePrinterConnection';
import { PrinterService } from '../printing/PrinterService';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { AppSwitch } from '../../../components/AppSwitch';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import type { Printer } from '../types/printer.types';

export interface PrinterListItemProps {
  printer: Printer;
  onEdit: (printer: Printer) => void;
  onChanged: () => void;
}

const connectionLabel: Record<Printer['connectionType'], string> = {
  usb: 'USB',
  bluetooth: 'Bluetooth',
  lan: 'LAN',
};

export const PrinterListItem: React.FC<PrinterListItemProps> = ({ printer, onEdit, onChanged }) => {
  const status = usePrinterConnection(printer.id);
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  const closeMenu = (): void => setMenuVisible(false);

  const handleDelete = async (): Promise<void> => {
    if (status === 'connected') {
      setConfirmDeleteVisible(true);
      return;
    }
    PrinterService.removePrinter(printer.id);
    onChanged();
  };

  const confirmDelete = async (): Promise<void> => {
    await PrinterService.disconnect(printer.id).catch(() => undefined);
    PrinterService.removePrinter(printer.id);
    setConfirmDeleteVisible(false);
    onChanged();
  };

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{printer.name}</Text>
        <Text style={styles.subtitle}>
          {connectionLabel[printer.connectionType]} · Khổ {printer.paperSize}mm
        </Text>
      </View>
      <PrinterStatusBadge status={status} />
      <AppSwitch
        label=""
        value={printer.enabled ?? true}
        onValueChange={(enabled) => {
          PrinterService.setEnabled(printer.id, enabled);
          onChanged();
        }}
      />
      <Menu visible={menuVisible} onDismiss={closeMenu} anchor={<IconButton icon="dots-vertical" onPress={() => setMenuVisible(true)} />}>
        <Menu.Item title="Kết nối" onPress={() => { closeMenu(); PrinterService.connect(printer.id).catch(() => undefined); }} />
        <Menu.Item title="Ngắt kết nối" onPress={() => { closeMenu(); PrinterService.disconnect(printer.id).catch(() => undefined); }} />
        <Menu.Item title="Kết nối lại" onPress={() => { closeMenu(); PrinterService.reconnect(printer.id).catch(() => undefined); }} />
        <Menu.Item title="Chỉnh sửa" onPress={() => { closeMenu(); onEdit(printer); }} />
        <Menu.Item title="Xóa" onPress={() => { closeMenu(); handleDelete(); }} />
      </Menu>
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="Xóa máy in"
        message={`Máy in "${printer.name}" đang kết nối. Bạn có chắc muốn ngắt kết nối và xóa?`}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  info: { flex: 1 },
  name: { fontSize: 13 },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
