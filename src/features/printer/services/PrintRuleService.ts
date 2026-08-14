import { StorageService } from '../../../services/StorageService';
import type { PrintRoutingConfiguration } from '../types/printRule.types';

const ROUTING_CONFIGURATION_KEY = 'printRule.routingConfiguration';

export const createPrintRuleService = () => {
  const getRoutingConfiguration = (): PrintRoutingConfiguration =>
    StorageService.getItem<PrintRoutingConfiguration>(ROUTING_CONFIGURATION_KEY) ?? { rules: [] };

  const saveRoutingConfiguration = (configuration: PrintRoutingConfiguration): void => {
    StorageService.setItem(ROUTING_CONFIGURATION_KEY, configuration);
  };

  return { getRoutingConfiguration, saveRoutingConfiguration };
};

export const PrintRuleService = createPrintRuleService();
