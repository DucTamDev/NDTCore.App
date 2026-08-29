import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, Menu, Switch } from 'react-native-paper';
import { usePrinterConnection } from '../hooks/usePrinterConnection';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import { PrinterDriverType, PrinterStatus } from '../types/printer.types';
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

const protocolLabel: Record<PrinterDriverType, string> = {
  escpos: 'ESC/POS',
  tspl: 'TSPL',
};

export const PrinterListItem: React.FC<PrinterListItemProps> = ({ printer, actions, onEdit }) => {
  const status = usePrinterConnection(printer.id);
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  const closeMenu = (): void => setMenuVisible(false);
  const enabled = printer.enabled ?? true;
  const drivers = printer.drivers.map((d) => protocolLabel[d.type]).join(' + ');
  const model = [printer.vendor, printer.model].filter(Boolean).join(' ');
  const subtitle = [connectionLabel[printer.connectionType], drivers, `Khổ ${printer.paperSize}mm`, model].filter(Boolean).join(' · ');

  // Đang kết nối thì hỏi lại trước khi xoá; ngược lại xoá thẳng — interaction
  // của chính card (dialog xác nhận của nó), không phải business logic.
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
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={1}>{printer.name}</Text>
        <PrinterStatusBadge status={status} />
      </View>
      <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>

      <View style={styles.actionsRow}>
        <View style={styles.enableGroup}>
          <Text style={styles.enableLabel}>{enabled ? 'Đang bật' : 'Đã tắt'}</Text>
          <Switch value={enabled} onValueChange={(value) => actions.setEnabled(printer.id, value)} />
        </View>
        <View style={styles.spacer} />
        <AppButton label="Sửa" mode="outlined" compact onPress={() => onEdit(printer)} />
        <Menu
          visible={menuVisible}
          onDismiss={closeMenu}
          anchor={<IconButton icon="dots-vertical" onPress={() => setMenuVisible(true)} />}
        >
          <Menu.Item title="Kết nối" onPress={() => { closeMenu(); actions.connect(printer.id); }} />
          <Menu.Item title="Ngắt kết nối" onPress={() => { closeMenu(); actions.disconnect(printer.id); }} />
          <Menu.Item title="Kết nối lại" onPress={() => { closeMenu(); actions.reconnect(printer.id); }} />
          <Menu.Item title="Xóa" onPress={() => { closeMenu(); requestDelete(); }} />
        </Menu>
      </View>

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
  card: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', gap: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#6B7280' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  enableGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  enableLabel: { fontSize: 12, color: '#6B7280' },
  spacer: { flex: 1 },
});
