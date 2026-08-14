import { createOrderPrintPlanner } from './OrderPrintPlanner';
import type { Order } from '../types/order.types';
import type { PrintRoutingConfiguration } from '../types/printRule.types';

const order: Order = {
  id: 1,
  orderNumber: 'ORD-001',
  serviceType: 'DineIn',
  items: [
    { productId: 1, productName: 'Trà sữa', categoryId: 10, quantity: 2, note: 'ít đường' },
    { productId: 2, productName: 'Burger', categoryId: 20, quantity: 1, note: '' },
    { productId: 3, productName: 'Bánh', categoryId: 30, quantity: 1, note: '' },
  ],
};

const routing: PrintRoutingConfiguration = {
  rules: [
    { id: 'r1', conditions: [{ field: 'categoryId', value: 10 }], destinationId: 'bar', priority: 100, enabled: true },
    { id: 'r2', conditions: [{ field: 'categoryId', value: 20 }], destinationId: 'kitchen', priority: 100, enabled: true },
  ],
};

describe('OrderPrintPlanner', () => {
  it('groups items by resolved destination into one plan each', async () => {
    const planner = createOrderPrintPlanner({ getRoutingConfiguration: () => routing });
    const { plans, unrouted } = await planner.createPlans(order);
    expect(plans).toHaveLength(2);
    expect(unrouted).toEqual([order.items[2]]);
    const barPlan = plans.find((p) => p.destinationId === 'bar');
    expect(barPlan?.document.elements.some((el) => el.type === 'table')).toBe(true);
  });

  it('returns empty plans, all items unrouted, when nothing matches and there is no default', async () => {
    const planner = createOrderPrintPlanner({ getRoutingConfiguration: () => ({ rules: [] }) });
    const { plans, unrouted } = await planner.createPlans(order);
    expect(plans).toEqual([]);
    expect(unrouted).toEqual(order.items);
  });

  it('merges multiple items sharing the same resolved destination into one plan', async () => {
    const sameDestinationOrder: Order = {
      id: 2,
      orderNumber: 'ORD-002',
      serviceType: 'DineIn',
      items: [
        { productId: 1, productName: 'Trà sữa', categoryId: 10, quantity: 2, note: 'ít đường' },
        { productId: 4, productName: 'Cà phê', categoryId: 10, quantity: 1, note: 'đá riêng' },
      ],
    };
    const planner = createOrderPrintPlanner({ getRoutingConfiguration: () => routing });
    const { plans, unrouted } = await planner.createPlans(sameDestinationOrder);
    expect(plans).toHaveLength(1);
    expect(unrouted).toEqual([]);
    const barPlan = plans[0];
    expect(barPlan.destinationId).toBe('bar');
    const table = barPlan.document.elements.find((el) => el.type === 'table');
    expect(table?.type === 'table' && table.rows).toHaveLength(2);
  });
});
