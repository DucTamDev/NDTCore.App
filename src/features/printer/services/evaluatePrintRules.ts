import type { ServiceType } from '../../cart/types/cart.types';
import type { PrintCondition, PrintRoutingConfiguration } from '../types/printRule.types';

interface RuleSubject {
  categoryId: number | null;
  serviceType: ServiceType;
}

const conditionMatches = (condition: PrintCondition, subject: RuleSubject): boolean => {
  if (condition.field === 'categoryId') return subject.categoryId === condition.value;
  return subject.serviceType === condition.value;
};

export const evaluatePrintRules = (subject: RuleSubject, routing: PrintRoutingConfiguration): string | null => {
  const sortedRules = [...routing.rules]
    .filter((rule) => rule.enabled)
    .sort((a, b) => b.priority - a.priority);

  const matched = sortedRules.find((rule) => rule.conditions.every((condition) => conditionMatches(condition, subject)));
  if (matched) return matched.destinationId;

  return routing.defaultDestinationId ?? null;
};
