import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../../store';
import { useLayoutMode, type LayoutMode } from '../../../hooks/useLayoutMode';
import { selectActiveMenuKey, activeMenuKeyChanged, type ApplicationMenuKey } from '../store/applicationSlice';
import { applicationMenuItems, DEFAULT_TABLET_MENU_KEY } from '../config/applicationConfig';

export interface ApplicationView {
  isTablet: boolean;
  activeSection: ApplicationMenuKey | null;
  headerTitle: string;
}

export function getApplicationView(
  layoutMode: LayoutMode,
  activeMenuKey: ApplicationMenuKey | null,
): ApplicationView {
  const isTablet = layoutMode !== 'phone';
  const activeSection = isTablet ? (activeMenuKey ?? DEFAULT_TABLET_MENU_KEY) : activeMenuKey;
  const activeItem = applicationMenuItems.find((item) => item.key === activeSection);
  const headerTitle = !isTablet && activeItem ? activeItem.label : 'Ứng dụng';

  return { isTablet, activeSection, headerTitle };
}

export function useApplication() {
  const dispatch = useDispatch<AppDispatch>();
  const layoutMode = useLayoutMode();
  const activeMenuKey = useSelector(selectActiveMenuKey);
  const { isTablet, activeSection, headerTitle } = getApplicationView(layoutMode, activeMenuKey);

  const selectSection = useCallback(
    (section: ApplicationMenuKey): void => {
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
