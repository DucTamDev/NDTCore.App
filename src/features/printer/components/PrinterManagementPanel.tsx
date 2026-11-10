import React, { useState, useEffect } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { useLayoutMode } from '../../../hooks/useLayoutMode';
import { usePrinterList } from '../hooks/usePrinterList';
import { PrinterList } from './PrinterList';
import { AddPrinterModal } from './AddPrinterModal';
import { AddPrinterForm } from './AddPrinterForm';
import { PrintKind } from '../models/printer/PrintKind';
import { PRINT_KIND_LABELS } from '../utils/printKindLabels';
import type { Printer } from '@ndtcore/printer';

export const PrinterManagementPanel: React.FC = () => {
  const { printers, ...actions } = usePrinterList();
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingPrinter, setEditingPrinter] = useState<Printer | undefined>(
    undefined,
  );
  const [addSessionId, setAddSessionId] = useState(0);
  const [activeTab, setActiveTab] = useState<PrintKind>(PrintKind.Receipt);
  const isPhone = useLayoutMode() === 'phone';

  const openAdd = (): void => {
    setAddSessionId(n => n + 1);
    setEditingPrinter(undefined);
    setMode('form');
  };

  const openEdit = (printer: Printer): void => {
    setEditingPrinter(printer);
    setMode('form');
  };

  const backToList = (): void => setMode('list');

  // Danh sách tự cập nhật qua subscribe của package, không cần nạp lại.
  const onSaved = (): void => setMode('list');

  useEffect(() => {
    if (!(isPhone && mode === 'form')) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setMode('list');
      return true;
    });
    return () => sub.remove();
  }, [isPhone, mode]);

  const formKey = editingPrinter?.id ?? `add-${addSessionId}`;
  /** Sửa: giữ nguyên `kind` đã lưu (không đổi được). Thêm mới: theo tab đang mở. */
  const kind = editingPrinter ? editingPrinter.config.kind : activeTab;

  if (isPhone && mode === 'form') {
    return (
      <View style={styles.phoneForm}>
        <AddPrinterForm
          key={formKey}
          initialPrinter={editingPrinter}
          onSaved={onSaved}
          onBack={backToList}
          showBackButton={false}
          kind={kind}
        />
      </View>
    );
  }

  const printersForTab = printers.filter(p => p.config.kind === activeTab);

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">Thiết lập máy in</Text>

      <SegmentedButtons
        value={activeTab}
        onValueChange={value => setActiveTab(value as PrintKind)}
        buttons={[
          { value: PrintKind.Receipt, label: PRINT_KIND_LABELS.Receipt },
          { value: PrintKind.Label, label: PRINT_KIND_LABELS.Label },
        ]}
      />

      <AppButton
        label={`+ Thêm máy in ${PRINT_KIND_LABELS[activeTab]}`}
        onPress={openAdd}
      />

      <PrinterList
        printers={printersForTab}
        actions={actions}
        onEdit={openEdit}
      />

      {!isPhone && (
        <AddPrinterModal
          key={formKey}
          visible={mode === 'form'}
          initialPrinter={editingPrinter}
          onDismiss={backToList}
          onSaved={onSaved}
          kind={kind}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  phoneForm: { flex: 1, padding: 16 },
});
