import React, { useState, useEffect } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { useLayoutMode } from '../../../hooks/useLayoutMode';
import { usePrinterList } from '../hooks/usePrinterList';
import { PrinterList } from './PrinterList';
import { AddPrinterModal } from './AddPrinterModal';
import { AddPrinterForm } from './AddPrinterForm';
import { PrintType, PRINT_TYPE_LABELS } from '../models/printing/PrintType';
import type { Printer } from '../models/printer/Printer';

export const PrinterManagementPanel: React.FC = () => {
  const { printers, reload, ...actions } = usePrinterList();
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingPrinter, setEditingPrinter] = useState<Printer | undefined>(undefined);
  const [addSessionId, setAddSessionId] = useState(0);
  const [activeTab, setActiveTab] = useState<PrintType>(PrintType.Receipt);
  const isPhone = useLayoutMode() === 'phone';

  const openAdd = (): void => {
    setAddSessionId((n) => n + 1);
    setEditingPrinter(undefined);
    setMode('form');
  };

  const openEdit = (printer: Printer): void => {
    setEditingPrinter(printer);
    setMode('form');
  };

  const backToList = (): void => setMode('list');

  const onSaved = (): void => {
    setMode('list');
    reload();
  };

  useEffect(() => {
    if (!(isPhone && mode === 'form')) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setMode('list');
      return true;
    });
    return () => sub.remove();
  }, [isPhone, mode]);

  const formKey = editingPrinter?.id ?? `add-${addSessionId}`;
  /** Sửa: giữ nguyên `type` đã lưu (không đổi được). Thêm mới: theo tab đang mở. */
  const printType = editingPrinter ? editingPrinter.type : activeTab;

  if (isPhone && mode === 'form') {
    return (
      <View style={styles.phoneForm}>
        <AddPrinterForm
          key={formKey}
          visible
          initialValues={editingPrinter}
          onSaved={onSaved}
          onBack={backToList}
          showBackButton={false}
          printType={printType}
        />
      </View>
    );
  }

  const printersForTab = printers.filter((p) => p.type === activeTab);

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">Thiết lập máy in</Text>

      <SegmentedButtons
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as PrintType)}
        buttons={[
          { value: PrintType.Receipt, label: PRINT_TYPE_LABELS.Receipt },
          { value: PrintType.Label, label: PRINT_TYPE_LABELS.Label },
        ]}
      />

      <AppButton label={`+ Thêm máy in ${PRINT_TYPE_LABELS[activeTab]}`} onPress={openAdd} />

      <PrinterList printers={printersForTab} actions={actions} onEdit={openEdit} />

      {!isPhone && (
        <AddPrinterModal
          key={formKey}
          visible={mode === 'form'}
          initialValues={editingPrinter}
          onDismiss={backToList}
          onSaved={onSaved}
          printType={printType}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  phoneForm: { flex: 1, padding: 16 },
});
