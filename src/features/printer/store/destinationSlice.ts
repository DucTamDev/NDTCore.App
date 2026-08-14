import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PrintDestination } from '../types/destination.types';

interface DestinationState {
  destinations: PrintDestination[];
}

const initialState: DestinationState = { destinations: [] };

const destinationSlice = createSlice({
  name: 'destination',
  initialState,
  reducers: {
    destinationsLoaded(state, action: PayloadAction<PrintDestination[]>) {
      state.destinations = action.payload;
    },
    destinationUpserted(state, action: PayloadAction<PrintDestination>) {
      const index = state.destinations.findIndex((d) => d.id === action.payload.id);
      if (index === -1) state.destinations.push(action.payload);
      else state.destinations[index] = action.payload;
    },
    destinationRemoved(state, action: PayloadAction<string>) {
      state.destinations = state.destinations.filter((d) => d.id !== action.payload);
    },
  },
});

export const { destinationsLoaded, destinationUpserted, destinationRemoved } = destinationSlice.actions;

interface StateWithDestination {
  destination: DestinationState;
}

export const selectDestinations = (state: StateWithDestination): PrintDestination[] => state.destination.destinations;

export default destinationSlice.reducer;
