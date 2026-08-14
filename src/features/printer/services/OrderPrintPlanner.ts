import { PrintRuleService } from './PrintRuleService';
import { evaluatePrintRules } from './evaluatePrintRules';
import { generateId } from '../../../utils/id';
import type { Order, OrderItem } from '../types/order.types';
import type { PrintPlan } from '../types/printJob.types';
import type { PrintDocument, PrintElement } from '../types/printDocument.types';

interface OrderPrintPlannerDeps {
  getRoutingConfiguration: typeof PrintRuleService.getRoutingConfiguration;
}

const buildDocument = (order: Order, items: OrderItem[]): PrintDocument => {
  const elements: PrintElement[] = [
    { type: 'text', content: `Đơn ${order.orderNumber} · ${order.serviceType}`, x: 0, y: 0 },
    { type: 'line', x: 0, y: 20 },
    {
      type: 'table',
      rows: items.map((item) => [item.productName, String(item.quantity), item.note]),
      x: 0,
      y: 30,
    },
  ];
  return { elements };
};

export const createOrderPrintPlanner = (deps: OrderPrintPlannerDeps) => {
  const createPlans = async (order: Order): Promise<{ plans: PrintPlan[]; unrouted: OrderItem[] }> => {
    const routing = deps.getRoutingConfiguration();
    const itemsByDestination = new Map<string, OrderItem[]>();
    const unrouted: OrderItem[] = [];

    for (const item of order.items) {
      const destinationId = evaluatePrintRules({ categoryId: item.categoryId, serviceType: order.serviceType }, routing);
      if (destinationId === null) {
        unrouted.push(item);
        continue;
      }
      if (!itemsByDestination.has(destinationId)) itemsByDestination.set(destinationId, []);
      itemsByDestination.get(destinationId)?.push(item);
    }

    const plans: PrintPlan[] = Array.from(itemsByDestination.entries()).map(([destinationId, items]) => ({
      id: generateId(),
      destinationId,
      document: buildDocument(order, items),
      copies: 1,
    }));

    return { plans, unrouted };
  };

  return { createPlans };
};

export const OrderPrintPlanner = createOrderPrintPlanner({ getRoutingConfiguration: PrintRuleService.getRoutingConfiguration });
