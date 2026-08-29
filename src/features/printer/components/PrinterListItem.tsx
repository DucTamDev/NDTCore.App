import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, Menu } from 'react-native-paper';
import { usePrinterConnection } from '../hooks/usePrinterConnection';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { AppSwitch } from '../../../components/AppSwitch';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import { PrinterStatus } from '../types/printer.types';
import type { PrinterListActions } from '../hooks/usePrinterList';
import type { Printer } from '../types/printer.types';

export interface PrinterListItemProps {
  printer: Printer;
  actions: PrinterListActions;
  onEdit: (printer: Printer) => void;
}

const connectionLabel: Record<Printer['connectionType'], string> = {
  usb: 'USB',
  bluetooth: 'Bluetooth',
  lan: 'LAN',
};

export const PrinterListItem: React.FC<PrinterListItemProps> = ({ printer, actions, onEdit }) => {
  const status = usePrinterConnection(printer.id);
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  const closeMenu = (): void => setMenuVisible(false);

  // Đang kết nối thì hỏi lại trước khi xoá; ngược lại xoá thẳng — đây là
  // interaction của chính card (dialog xác nhận của nó), không phải business logic.
  const requestDelete = (): void => {
    if (status === PrinterStatus.connected) {
      setConfirmDeleteVisible(true);
      return;
    }
    actions.remove(printer.id);
  };

  const confirmDelete = async (): Promise<void> => {
    await actions.disconnect(printer.id);
    actions.remove(printer.id);
    setConfirmDeleteVisible(false);
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
        onValueChange={(enabled) => actions.setEnabled(printer.id, enabled)}
      />
      <Menu visible={menuVisible} onDismiss={closeMenu} anchor={<IconButton icon="dots-vertical" onPress={() => setMenuVisible(true)} />}>
        <Menu.Item title="Kết nối" onPress={() => { closeMenu(); actions.connect(printer.id); }} />
        {/* actions.disconnect nuốt lỗi sẵn trong hook — gọi fire-and-forget ở đây là an toàn. */}
        <Menu.Item title="Ngắt kết nối" onPress={() => { closeMenu(); actions.disconnect(printer.id); }} />
        <Menu.Item title="Kết nối lại" onPress={() => { closeMenu(); actions.reconnect(printer.id); }} />
        <Menu.Item title="Chỉnh sửa" onPress={() => { closeMenu(); onEdit(printer); }} />
        <Menu.Item title="Xóa" onPress={() => { closeMenu(); requestDelete(); }} />
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
