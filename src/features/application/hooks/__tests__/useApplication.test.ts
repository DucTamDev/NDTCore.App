import { getApplicationView } from '../useApplication';

describe('getApplicationView', () => {
  describe('phone', () => {
    it('shows the sidebar (no active section) when nothing is selected yet', () => {
      const view = getApplicationView('phone', null);
      expect(view).toEqual({ isTablet: false, activeSection: null, headerTitle: 'Ứng dụng' });
    });

    it('shows the selected section with its label as the header title', () => {
      const view = getApplicationView('phone', 'printer');
      expect(view).toEqual({ isTablet: false, activeSection: 'printer', headerTitle: 'Thiết lập máy in' });
    });
  });

  describe('tablet', () => {
    it.each(['tablet-portrait', 'tablet-landscape'] as const)(
      'falls back to the default menu key on %s when nothing is selected yet',
      (layoutMode) => {
        const view = getApplicationView(layoutMode, null);
        expect(view).toEqual({ isTablet: true, activeSection: 'printer', headerTitle: 'Ứng dụng' });
      },
    );

    it('keeps the selected section but always shows the generic header title', () => {
      const view = getApplicationView('tablet-landscape', 'account');
      expect(view).toEqual({ isTablet: true, activeSection: 'account', headerTitle: 'Ứng dụng' });
    });
  });
});
