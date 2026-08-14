// src/features/printer/components/PrintDestinationPanel.tsx
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, RadioButton } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { AppSwitch } from '../../../components/AppSwitch';
import { DestinationService } from '../services/DestinationService';
import { PrinterService } from '../services/PrinterService';
import { PrintService } from '../services/PrintService';
import { generateId } from '../../../utils/id';
import type { PrintDestination, PrintFanoutMode } from '../types/destination.types';

export const PrintDestinationPanel: React.FC = () => {
  const [destinations, setDestinations] = useState<PrintDestination[]>(() => DestinationService.getDestinations());
  const printers = PrinterService.getPrinters();
  const [name, setName] = useState('');
  const [selectedPrinterIds, setSelectedPrinterIds] = useState<string[]>([]);
  const [fanoutMode, setFanoutMode] = useState<PrintFanoutMode>('failover');

  const refresh = useCallback(() => setDestinations(DestinationService.getDestinations()), []);

  const togglePrinter = (printerId: string): void => {
    setSelectedPrinterIds((prev) =>
      prev.includes(printerId) ? prev.filter((id) => id !== printerId) : [...prev, printerId],
    );
  };

  const addDestination = (): void => {
    if (name.trim() === '' || selectedPrinterIds.length === 0) return;
    DestinationService.addDestination({
      id: generateId(),
      name: name.trim(),
      printerIds: selectedPrinterIds,
      fanoutMode,
      enabled: true,
    });
    setName('');
    setSelectedPrinterIds([]);
    refresh();
  };

  const toggleEnabled = (destination: PrintDestination, enabled: boolean): void => {
    DestinationService.updateDestination({ ...destination, enabled });
    refresh();
  };

  const testPrint = (destination: PrintDestination): void => {
    void PrintService.print({
      id: generateId(),
      destinationId: destination.id,
      document: { elements: [{ type: 'text', content: 'NDTCore POS - In thử điểm in', x: 0, y: 0 }] },
      copies: 1,
    });
  };

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">Điểm in</Text>

      {destinations.map((destination) => (
        <View key={destination.id} style={styles.row}>
          <Text style={styles.name}>{destination.name}</Text>
          <AppSwitch label="" value={destination.enabled} onValueChange={(enabled) => toggleEnabled(destination, enabled)} />
          <AppButton label="In thử" onPress={() => testPrint(destination)} />
        </View>
      ))}

      <View style={styles.form}>
        <AppInput label="Tên điểm in" value={name} onChangeText={setName} />
        {printers.map((p) => (
          <AppSwitch
            key={p.id}
            label={p.printerName}
            value={selectedPrinterIds.includes(p.id)}
            onValueChange={() => togglePrinter(p.id)}
          />
        ))}
        <RadioButton.Group onValueChange={(v) => setFanoutMode(v as PrintFanoutMode)} value={fanoutMode}>
          <RadioButton.Item label="Chuyển máy khác khi lỗi" value="failover" />
          <RadioButton.Item label="In đồng thời tất cả" value="broadcast" />
        </RadioButton.Group>
        <AppButton label="Thêm điểm in" onPress={addDestination} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  name: { flex: 1, fontSize: 13 },
  form: { gap: 8, marginTop: 16 },
});
