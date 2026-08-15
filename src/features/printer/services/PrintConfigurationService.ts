import { StorageService } from '../../../services/StorageService';
import type { PrintConfiguration, PrintType } from '../types/printConfiguration.types';

const PRINT_CONFIGURATION_LIST_KEY = 'printConfiguration.list';

export const createPrintConfigurationService = () => {
  const getAll = (): PrintConfiguration[] =>
    StorageService.getItem<PrintConfiguration[]>(PRINT_CONFIGURATION_LIST_KEY) ?? [];

  const saveAll = (configurations: PrintConfiguration[]): void => {
    StorageService.setItem(PRINT_CONFIGURATION_LIST_KEY, configurations);
  };

  const upsert = (configuration: PrintConfiguration): void => {
    const all = getAll();
    const index = all.findIndex((c) => c.id === configuration.id);
    if (index === -1) saveAll([...all, configuration]);
    else saveAll(all.map((c) => (c.id === configuration.id ? configuration : c)));
  };

  const remove = (id: string): void => {
    saveAll(getAll().filter((c) => c.id !== id));
  };

  const getDefaultPrinterIdsForType = (printType: PrintType): string[] =>
    getAll()
      .filter((c) => c.printType === printType && c.isDefault && c.isEnabled)
      .map((c) => c.printerId);

  return { getAll, upsert, remove, getDefaultPrinterIdsForType };
};

export const PrintConfigurationService = createPrintConfigurationService();
