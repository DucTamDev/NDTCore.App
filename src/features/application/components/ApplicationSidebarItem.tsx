import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple, Icon, useTheme } from 'react-native-paper';
import { StatusDot } from '../../../components/StatusDot';
import { type ApplicationMenuItem } from '../config/applicationConfig';

interface ApplicationSidebarItemProps {
  item: ApplicationMenuItem;
  isActive: boolean;
  isTablet: boolean;
  hasConnectedPrinter: boolean;
  onPress: () => void;
}

export const ApplicationSidebarItem: React.FC<ApplicationSidebarItemProps> = ({
  item,
  isActive,
  isTablet,
  hasConnectedPrinter,
  onPress,
}) => {
  const theme = useTheme();

  const color = item.disabled
    ? theme.colors.outline
    : isActive && isTablet
    ? theme.colors.primary
    : theme.colors.onSurface;

  const content = (
    <View style={styles.itemRow}>
      <Icon source={item.icon} size={16} color={color} />
      <Text
        style={[
          styles.itemLabel,
          isActive && isTablet && styles.itemLabelActive,
          { color },
        ]}
      >
        {item.label}
      </Text>
      {!item.disabled && item.key === 'printer' && hasConnectedPrinter && (
        <StatusDot color="#16A34A" />
      )}
      {!item.disabled && !isTablet && (
        <Icon source="chevron-right" size={16} color={theme.colors.outline} />
      )}
    </View>
  );

  if (item.disabled) {
    return <View style={styles.item}>{content}</View>;
  }

  return (
    <TouchableRipple
      style={[
        styles.item,
        isActive && isTablet && { backgroundColor: theme.colors.primaryContainer },
      ]}
      onPress={onPress}
    >
      {content}
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  item: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemLabel: { fontSize: 13, flex: 1 },
  itemLabelActive: { fontWeight: '500' },
});
