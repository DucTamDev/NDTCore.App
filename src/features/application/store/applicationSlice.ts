import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ApplicationMenuKey =
  | 'printer'
  | 'printConfiguration'
  | 'scanner'
  | 'orderHistory'
  | 'account'
  | 'language'
  | 'sync'
  | 'info';

interface ApplicationState {
  activeMenuKey: ApplicationMenuKey | null;
}

const initialState: ApplicationState = {
  activeMenuKey: null,
};

const applicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    activeMenuKeyChanged(state, action: PayloadAction<ApplicationMenuKey | null>) {
      state.activeMenuKey = action.payload;
    },
  },
});

export const { activeMenuKeyChanged } = applicationSlice.actions;

interface StateWithApplication {
  application: ApplicationState;
}

export const selectActiveMenuKey = (state: StateWithApplication): ApplicationMenuKey | null =>
  state.application.activeMenuKey;

export default applicationSlice.reducer;
