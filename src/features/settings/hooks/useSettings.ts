import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../../store';
import { useLayoutMode, type LayoutMode } from '../../../hooks/useLayoutMode';
import { selectActiveMenuKey, activeMenuKeyChanged, type SettingsMenuKey } from '../store/settingsSlice';
import { settingsMenuItems, DEFAULT_TABLET_MENU_KEY } from '../config/settingsConfig';

export interface SettingsView {
  isTablet: boolean;
  activeSection: SettingsMenuKey | null;
  headerTitle: string;
}

export function getSettingsView(
  layoutMode: LayoutMode,
  activeMenuKey: SettingsMenuKey | null,
): SettingsView {
  const isTablet = layoutMode !== 'phone';
  const activeSection = isTablet ? (activeMenuKey ?? DEFAULT_TABLET_MENU_KEY) : activeMenuKey;
  const activeItem = settingsMenuItems.find((item) => item.key === activeSection);
  const headerTitle = !isTablet && activeItem ? activeItem.label : 'Ứng dụng';

  return { isTablet, activeSection, headerTitle };
}

export function useSettings() {
  const dispatch = useDispatch<AppDispatch>();
  const layoutMode = useLayoutMode();
  const activeMenuKey = useSelector(selectActiveMenuKey);
  const { isTablet, activeSection, headerTitle } = getSettingsView(layoutMode, activeMenuKey);

  const selectSection = useCallback(
    (section: SettingsMenuKey): void => {
      dispatch(activeMenuKeyChanged(section));
    },
    [dispatch],
  );

  const clearSection = useCallback((): void => {
    dispatch(activeMenuKeyChanged(null));
  }, [dispatch]);

  return {
    isTablet,
    activeSection,
    selectSection,
    clearSection,
    headerTitle,
  };
}
