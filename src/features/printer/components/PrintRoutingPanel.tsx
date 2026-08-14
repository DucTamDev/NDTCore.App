// src/features/printer/components/PrintRoutingPanel.tsx
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { Text, RadioButton } from 'react-native-paper';
import type { RootState } from '../../../store';
import { AppButton } from '../../../components/AppButton';
import { selectCategories } from '../../catalog/store/catalogSlice';
import type { CategoryViewModel } from '../../catalog/types/catalog.types';
import { PrintRuleService } from '../services/PrintRuleService';
import { DestinationService } from '../services/DestinationService';
import { generateId } from '../../../utils/id';
import type { PrintCondition, PrintRule } from '../types/printRule.types';
import type { ServiceType } from '../../cart/types/cart.types';

const SERVICE_TYPE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: 'DineIn', label: 'Tại quầy' },
  { value: 'TakeAway', label: 'Mang đi' },
  { value: 'Delivery', label: 'Giao hàng' },
];

const describeCondition = (condition: PrintCondition, categories: CategoryViewModel[]): string => {
  if (condition.field === 'categoryId') {
    const category = categories.find((c) => c.id === condition.value);
    return `Danh mục: ${category?.name ?? `#${condition.value}`}`;
  }
  const option = SERVICE_TYPE_OPTIONS.find((o) => o.value === condition.value);
  return `Hình thức phục vụ: ${option?.label ?? condition.value}`;
};

export const PrintRoutingPanel: React.FC = () => {
  const categories = useSelector((state: RootState) => selectCategories(state));
  const destinations = DestinationService.getDestinations();
  const [routing, setRouting] = useState(() => PrintRuleService.getRoutingConfiguration());
  const [conditionType, setConditionType] = useState<'categoryId' | 'serviceType'>('categoryId');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType>('DineIn');
  const [destinationId, setDestinationId] = useState<string | null>(null);

  const refresh = useCallback(() => setRouting(PrintRuleService.getRoutingConfiguration()), []);

  const addRule = (): void => {
    if (destinationId === null) return;
    const condition: PrintCondition =
      conditionType === 'categoryId' && categoryId !== null
        ? { field: 'categoryId', value: categoryId }
        : { field: 'serviceType', value: serviceType };
    const rule: PrintRule = {
      id: generateId(),
      conditions: [condition],
      destinationId,
      priority: routing.rules.length + 1,
      enabled: true,
    };
    const next = { ...routing, rules: [...routing.rules, rule] };
    PrintRuleService.saveRoutingConfiguration(next);
    refresh();
  };

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">Định tuyến in</Text>

      {routing.rules.map((rule) => (
        <Text key={rule.id} style={styles.ruleRow}>
          {rule.conditions.map((c) => describeCondition(c, categories)).join(' & ')}
          {' → '}
          {destinations.find((d) => d.id === rule.destinationId)?.name ?? 'Không xác định'}
        </Text>
      ))}

      <View style={styles.form}>
        <Text variant="labelLarge">Điều kiện áp dụng</Text>
        <RadioButton.Group onValueChange={(v) => setConditionType(v as 'categoryId' | 'serviceType')} value={conditionType}>
          <RadioButton.Item label="Theo danh mục" value="categoryId" />
          <RadioButton.Item label="Theo hình thức phục vụ" value="serviceType" />
        </RadioButton.Group>

        {conditionType === 'categoryId' &&
          categories.map((category) => (
            <RadioButton.Item
              key={category.id}
              label={category.name}
              value={String(category.id)}
              status={categoryId === category.id ? 'checked' : 'unchecked'}
              onPress={() => setCategoryId(category.id)}
            />
          ))}

        {conditionType === 'serviceType' &&
          SERVICE_TYPE_OPTIONS.map((option) => (
            <RadioButton.Item
              key={option.value}
              label={option.label}
              value={option.value}
              status={serviceType === option.value ? 'checked' : 'unchecked'}
              onPress={() => setServiceType(option.value)}
            />
          ))}

        <Text variant="labelLarge">Điểm in đích</Text>
        {destinations.map((destination) => (
          <RadioButton.Item
            key={destination.id}
            label={destination.name}
            value={destination.id}
            status={destinationId === destination.id ? 'checked' : 'unchecked'}
            onPress={() => setDestinationId(destination.id)}
          />
        ))}

        <AppButton label="Thêm quy tắc" onPress={addRule} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  ruleRow: { fontSize: 13, padding: 8 },
  form: { gap: 8, marginTop: 16 },
});
