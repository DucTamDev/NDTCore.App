import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PrintRoutingConfiguration } from '../types/printRule.types';

const initialState: PrintRoutingConfiguration = { rules: [] };

const printRuleSlice = createSlice({
  name: 'printRule',
  initialState,
  reducers: {
    routingConfigurationLoaded(_state, action: PayloadAction<PrintRoutingConfiguration>) {
      return action.payload;
    },
  },
});

export const { routingConfigurationLoaded } = printRuleSlice.actions;

interface StateWithPrintRule {
  printRule: PrintRoutingConfiguration;
}

export const selectRules = (state: StateWithPrintRule) => state.printRule.rules;
export const selectDefaultDestinationId = (state: StateWithPrintRule) => state.printRule.defaultDestinationId;

export default printRuleSlice.reducer;
