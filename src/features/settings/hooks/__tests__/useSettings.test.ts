import { getSettingsView } from '../useSettings';

describe('getSettingsView', () => {
  describe('phone', () => {
    it('shows the sidebar (no active section) when nothing is selected yet', () => {
      const view = getSettingsView('phone', null);
      expect(view).toEqual({ isTablet: false, activeSection: null, headerTitle: 'Cài đặt' });
    });

    it('shows the selected section with its label as the header title', () => {
      const view = getSettingsView('phone', 'printer');
      expect(view).toEqual({ isTablet: false, activeSection: 'printer', headerTitle: 'Quản lý máy in' });
    });
  });

  describe('tablet', () => {
    it.each(['tablet-portrait', 'tablet-landscape'] as const)(
      'falls back to the default menu key on %s when nothing is selected yet',
      (layoutMode) => {
        const view = getSettingsView(layoutMode, null);
        expect(view).toEqual({ isTablet: true, activeSection: 'printer', headerTitle: 'Cài đặt' });
      },
    );

    it('keeps the selected section but always shows the generic header title', () => {
      const view = getSettingsView('tablet-landscape', 'account');
      expect(view).toEqual({ isTablet: true, activeSection: 'account', headerTitle: 'Cài đặt' });
    });
  });
});
