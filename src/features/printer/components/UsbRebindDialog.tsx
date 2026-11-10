import React from 'react';
import { StyleSheet } from 'react-native';
import { Dialog, List, Portal, Text } from 'react-native-paper';
import type { UsbRebindCandidate } from '@ndtcore/printer';
import { AppButton } from '../../../components/AppButton';

/** Tên máy USB để chọn: tên hãng, sản phẩm kèm path vì nhiều máy cùng model chỉ khác path. */
const deviceLabelOf = (candidate: UsbRebindCandidate): string => {
  const { device } = candidate;
  const name = [device.manufacturerName, device.productName].filter(Boolean).join(' ') || 'Máy in USB';
  return `${name} · ${device.path}`;
};

/** Thuộc tính hộp thoại chọn lại máy USB. */
export interface UsbRebindDialogProps {
  /** Hiện hay ẩn. */
  visible: boolean;

  /** Máy USB đang cắm. */
  candidates: UsbRebindCandidate[];

  /** Chọn một máy chưa thuộc máy in khác. */
  onSelect: (path: string) => void;

  /** Đóng không chọn. */
  onDismiss: () => void;
}

/** Danh sách máy USB đang cắm; máy đang là của máy in khác hiện tên máy in đó và không chọn được. */
export const UsbRebindDialog: React.FC<UsbRebindDialogProps> = ({ visible, candidates, onSelect, onDismiss }) => (
  <Portal>
    <Dialog visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>Chọn lại máy USB</Dialog.Title>
      <Dialog.Content>
        {candidates.length === 0 ? <Text>Không thấy máy USB nào đang cắm</Text> : null}
        {candidates.map((candidate) => (
          <List.Item
            key={candidate.device.path}
            title={deviceLabelOf(candidate)}
            description={candidate.assignedTo ? `Đang dùng cho ${candidate.assignedTo.name}` : undefined}
            disabled={Boolean(candidate.assignedTo)}
            onPress={() => onSelect(candidate.device.path)}
            titleStyle={candidate.assignedTo ? styles.unavailable : undefined}
          />
        ))}
      </Dialog.Content>
      <Dialog.Actions>
        <AppButton label="Đóng" mode="text" onPress={onDismiss} />
      </Dialog.Actions>
    </Dialog>
  </Portal>
);

const styles = StyleSheet.create({
  unavailable: { color: '#9CA3AF' },
});
