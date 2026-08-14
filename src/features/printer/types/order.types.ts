import type { ServiceType } from '../../cart/types/cart.types';

export interface OrderItem {
  productId: number;
  productName: string;
  categoryId: number | null;
  quantity: number;
  note: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  serviceType: ServiceType;
  items: OrderItem[];
}
