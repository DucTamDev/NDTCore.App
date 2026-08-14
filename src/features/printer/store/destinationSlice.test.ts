import destinationReducer, {
  destinationsLoaded,
  destinationUpserted,
  destinationRemoved,
  selectDestinations,
} from './destinationSlice';
import type { PrintDestination } from '../types/destination.types';

const dest: PrintDestination = { id: 'd1', name: 'Bar', printerIds: ['p1'], fanoutMode: 'broadcast', enabled: true };

describe('destinationSlice', () => {
  it('destinationsLoaded replaces the list', () => {
    const state = destinationReducer(undefined, destinationsLoaded([dest]));
    expect(selectDestinations({ destination: state })).toEqual([dest]);
  });

  it('destinationUpserted adds a new one, updates an existing one', () => {
    let state = destinationReducer(undefined, destinationUpserted(dest));
    expect(selectDestinations({ destination: state })).toHaveLength(1);
    const renamed = { ...dest, name: 'Bar 2' };
    state = destinationReducer(state, destinationUpserted(renamed));
    expect(selectDestinations({ destination: state })).toEqual([renamed]);
  });

  it('destinationRemoved removes by id', () => {
    let state = destinationReducer(undefined, destinationUpserted(dest));
    state = destinationReducer(state, destinationRemoved(dest.id));
    expect(selectDestinations({ destination: state })).toEqual([]);
  });
});
