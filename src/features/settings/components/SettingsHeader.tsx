import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';

interface SettingsHeaderProps {
  title: string;
  showBackButton: boolean;
  onBackPress: () => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
  title,
  showBackButton,
  onBackPress,
}) => {
  const theme = useTheme();

  return (
    <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
      {showBackButton && (
        <IconButton
          icon="arrow-left"
          size={20}
          onPress={onBackPress}
          style={styles.backButton}
        />
      )}
      <Text
        variant="titleMedium"
        style={[styles.headerTitle, { color: theme.colors.onSurface }]}
      >
        {title}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 56,
  },
  backButton: {
    margin: 0,
    marginRight: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontWeight: '600',
  },
});
