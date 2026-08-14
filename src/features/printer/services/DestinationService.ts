import { StorageService } from '../../../services/StorageService';
import type { PrintDestination } from '../types/destination.types';

const DESTINATION_LIST_KEY = 'printDestination.list';

export const createDestinationService = () => {
  const getDestinations = (): PrintDestination[] =>
    StorageService.getItem<PrintDestination[]>(DESTINATION_LIST_KEY) ?? [];

  const saveDestinations = (destinations: PrintDestination[]): void => {
    StorageService.setItem(DESTINATION_LIST_KEY, destinations);
  };

  const addDestination = (destination: PrintDestination): void => {
    saveDestinations([...getDestinations(), destination]);
  };

  const updateDestination = (destination: PrintDestination): void => {
    saveDestinations(getDestinations().map((d) => (d.id === destination.id ? destination : d)));
  };

  const removeDestination = (destinationId: string): void => {
    saveDestinations(getDestinations().filter((d) => d.id !== destinationId));
  };

  return { getDestinations, addDestination, updateDestination, removeDestination };
};

export const DestinationService = createDestinationService();
