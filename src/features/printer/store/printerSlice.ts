import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { Printer } from '../models/printer/Printer';

interface PrinterState {
  printers: Printer[];
  statusById: Record<string, PrinterStatus>;
}

const initialState: PrinterState = {
  printers: [],
  statusById: {},
};

const printerSlice = createSlice({
  name: 'printer',
  initialState,
  reducers: {
    printersLoaded(state, action: PayloadAction<Printer[]>) {
      state.printers = action.payload;
    },
    printerUpserted(state, action: PayloadAction<Printer>) {
      const index = state.printers.findIndex((p) => p.id === action.payload.id);
      if (index === -1) state.printers.push(action.payload);
      else state.printers[index] = action.payload;
    },
    printerRemoved(state, action: PayloadAction<string>) {
      state.printers = state.printers.filter((p) => p.id !== action.payload);
    },
    printerStatusChanged(state, action: PayloadAction<{ printerId: string; status: PrinterStatus }>) {
      state.statusById[action.payload.printerId] = action.payload.status;
    },
    printerEnabledChanged(state, action: PayloadAction<{ printerId: string; enabled: boolean }>) {
      const printer = state.printers.find((p) => p.id === action.payload.printerId);
      if (printer) printer.enabled = action.payload.enabled;
    },
  },
});

export const {
  printersLoaded,
  printerUpserted,
  printerRemoved,
  printerStatusChanged,
  printerEnabledChanged,
} = printerSlice.actions;

interface StateWithPrinter {
  printer: PrinterState;
}

export const selectPrinters = (state: StateWithPrinter): Printer[] => state.printer.printers;
export const selectPrinterStatus = (state: StateWithPrinter, printerId: string): PrinterStatus =>
  state.printer.statusById[printerId] ?? PrinterStatus.idle;

export default printerSlice.reducer;
