import React, { useCallback } from 'react';
import { BackHandler, Platform, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { ApplicationSidebar } from '../components/ApplicationSidebar';
import { ApplicationContent } from '../components/ApplicationContent';
import { ApplicationHeader } from '../components/ApplicationHeader';
import { useApplication } from '../hooks/useApplication';

export const ApplicationScreen: React.FC = () => {
  const { isTablet, activeSection, selectSection, clearSection, headerTitle } = useApplication();
  const theme = useTheme();

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web' || isTablet || activeSection === null) {
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
      <ApplicationHeader
        title={headerTitle}
        showBackButton={!isTablet && activeSection !== null}
        onBackPress={clearSection}
      />
      <View style={styles.body}>
        {(isTablet || activeSection === null) && (
          <ApplicationSidebar
            activeSection={activeSection}
            onSelectSection={selectSection}
            isTablet={isTablet}
          />
        )}
        {(isTablet || activeSection !== null) && (
          <ApplicationContent activeSection={activeSection} />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  body: { flex: 1, flexDirection: 'row' },
});
