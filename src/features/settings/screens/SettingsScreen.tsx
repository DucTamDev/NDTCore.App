import React, { useCallback } from 'react';
import { BackHandler, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { SettingsSidebar } from '../components/SettingsSidebar';
import { SettingsContent } from '../components/SettingsContent';
import { SettingsHeader } from '../components/SettingsHeader';
import { useSettings } from '../hooks/useSettings';

export const SettingsScreen: React.FC = () => {
  const { isTablet, activeSection, selectSection, clearSection, headerTitle } = useSettings();
  const theme = useTheme();

  useFocusEffect(
    useCallback(() => {
      if (isTablet || activeSection === null) {
        return undefined;
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        clearSection();
        return true;
      });

      return () => subscription.remove();
    }, [isTablet, activeSection, clearSection]),
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <SettingsHeader
        title={headerTitle}
        showBackButton={!isTablet && activeSection !== null}
        onBackPress={clearSection}
      />
      <View style={styles.body}>
        {(isTablet || activeSection === null) && (
          <SettingsSidebar
            activeSection={activeSection}
            onSelectSection={selectSection}
            isTablet={isTablet}
          />
        )}
        {(isTablet || activeSection !== null) && (
          <SettingsContent activeSection={activeSection} />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  body: { flex: 1, flexDirection: 'row' },
});
