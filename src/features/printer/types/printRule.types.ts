import type { ServiceType } from '../../cart/types/cart.types';

export type PrintCondition =
  | { field: 'categoryId'; value: number }
  | { field: 'serviceType'; value: ServiceType };

export interface PrintRule {
  id: string;
  conditions: PrintCondition[];
  destinationId: string;
  priority: number;
  enabled: boolean;
}

export interface PrintRoutingConfiguration {
  rules: PrintRule[];
  defaultDestinationId?: string;
}
