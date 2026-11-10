import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import {
  ConnectionState,
  PrinterAction,
  PrinterKind,
  PrinterLang,
  type Printer,
  type UsbRebindCandidate,
} from '@ndtcore/printer';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { AppButton } from '../../../components/AppButton';
import { LoggerService } from '../../../services/LoggerService';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import { UsbRebindDialog } from './UsbRebindDialog';
import type { PrinterListActions } from '../hooks/usePrinterList';

/** Thuộc tính một dòng máy in đã lưu. */
export interface PrinterListItemProps {
  /** Máy in của package. */
  printer: Printer;

  /** Thao tác trên máy in. */
  actions: PrinterListActions;

  /** Mở màn sửa máy in. */
  onEdit: (printer: Printer) => void;
}

const connectionLabel: Record<Printer['connectionConfig']['transportType'], string> = {
  Usb: 'USB',
  BluetoothClassic: 'Bluetooth',
  Lan: 'LAN',
};

const languageLabel: Record<PrinterLang, string> = {
  [PrinterLang.EscPos]: 'ESC/POS',
  [PrinterLang.Tspl]: 'TSPL',
};

/** Khổ hoá đơn hoặc cỡ tem. */
const paperLabelOf = (printer: Printer): string => {
  const { kind, paper } = printer.config;
  return kind === PrinterKind.Receipt ? `Khổ ${paper.widthMm}mm` : `Tem ${paper.widthMm}×${paper.heightMm ?? '?'}mm`;
};

/** Một máy in: tên, trạng thái, thông tin, và nút theo thao tác package cho phép lúc này. */
export const PrinterListItem: React.FC<PrinterListItemProps> = ({ printer, actions, onEdit }) => {
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [rebindCandidates, setRebindCandidates] = useState<UsbRebindCandidate[] | null>(null);
  const { config, status, deviceInfo } = printer;
  const model = [deviceInfo.manufacturer, deviceInfo.model].filter(Boolean).join(' ');
  const subtitle = [
    connectionLabel[printer.connectionConfig.transportType],
    languageLabel[config.lang],
    paperLabelOf(printer),
    model,
  ]
    .filter(Boolean)
    .join(' · ');
  const canReconnect = status.actions.includes(PrinterAction.Reconnect);
  const canRebind = status.actions.includes(PrinterAction.RebindUsb);

  const removeAsync = async (): Promise<void> => {
    try {
      await actions.removeAsync(printer.id);
    } catch (error) {
      LoggerService.warning('Xoá máy in thất bại', { printerId: printer.id, error });
    }
  };

  // Đang kết nối thì hỏi lại, vì xoá sẽ huỷ cả phần in chưa xong của máy.
  const requestDelete = (): void => {
    if (status.state === ConnectionState.Connected) {
      setConfirmDeleteVisible(true);
      return;
    }

    removeAsync();
  };

  const confirmDeleteAsync = async (): Promise<void> => {
    await removeAsync();
    setConfirmDeleteVisible(false);
  };

  const selectUsb = (path: string): void => {
    setRebindCandidates(null);
    actions.rebindUsbAsync(printer.id, path).catch((error: unknown) => {
      LoggerService.warning('Chọn lại máy USB thất bại', { printerId: printer.id, error });
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={1}>
          {config.name}
        </Text>
        <PrinterStatusBadge status={status} />
      </View>
      <Text style={styles.subtitle} numberOfLines={1}>
        {subtitle}
      </Text>

      <View style={styles.actionsRow}>
        {canReconnect ? (
          <AppButton label="Kết nối lại" mode="outlined" compact onPress={() => actions.reconnectAsync(printer.id)} />
        ) : null}
        {canRebind ? (
          <AppButton
            label="Chọn lại máy USB"
            mode="outlined"
            compact
            onPress={() => setRebindCandidates(actions.listUsbDevicesForRebind(printer.id))}
          />
        ) : null}
        <View style={styles.spacer} />
        <AppButton label="Sửa" mode="outlined" compact onPress={() => onEdit(printer)} />
        <IconButton icon="delete-outline" accessibilityLabel="Xoá máy in" onPress={requestDelete} />
      </View>

      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="Xóa máy in"
        message={`Máy in "${config.name}" đang kết nối. Bạn có chắc muốn xóa?`}
        onConfirm={confirmDeleteAsync}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
      <UsbRebindDialog
        visible={rebindCandidates !== null}
        candidates={rebindCandidates ?? []}
        onSelect={selectUsb}
        onDismiss={() => setRebindCandidates(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', gap: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#6B7280' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  spacer: { flex: 1 },
});
