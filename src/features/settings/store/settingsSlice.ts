import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SettingsMenuKey =
  | 'printer'
  | 'printDestination'
  | 'printRouting'
  | 'scanner'
  | 'account'
  | 'language'
  | 'sync'
  | 'info';

interface SettingsState {
  activeMenuKey: SettingsMenuKey | null;
}

const initialState: SettingsState = {
  activeMenuKey: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    activeMenuKeyChanged(state, action: PayloadAction<SettingsMenuKey | null>) {
      state.activeMenuKey = action.payload;
    },
  },
});

export const { activeMenuKeyChanged } = settingsSlice.actions;

interface StateWithSettings {
  settings: SettingsState;
}

export const selectActiveMenuKey = (state: StateWithSettings): SettingsMenuKey | null => state.settings.activeMenuKey;

export default settingsSlice.reducer;
