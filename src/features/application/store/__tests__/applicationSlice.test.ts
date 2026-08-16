import reducer, { activeMenuKeyChanged, selectActiveMenuKey } from '../applicationSlice';

describe('applicationSlice', () => {
  const initialState = reducer(undefined, { type: '@@INIT' });

  it('starts with no active menu key selected', () => {
    expect(initialState.activeMenuKey).toBeNull();
  });

  it('activeMenuKeyChanged sets the active menu key', () => {
    const state = reducer(initialState, activeMenuKeyChanged('printer'));
    expect(state.activeMenuKey).toBe('printer');
  });

  it('activeMenuKeyChanged clears the active menu key back to null', () => {
    const state = reducer({ activeMenuKey: 'printer' }, activeMenuKeyChanged(null));
    expect(state.activeMenuKey).toBeNull();
  });

  it('selectActiveMenuKey reads the application slice from RootState-shaped object', () => {
    const rootState = { application: { activeMenuKey: 'printer' as const } };
    expect(selectActiveMenuKey(rootState)).toBe('printer');
  });
});
