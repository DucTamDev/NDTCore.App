import type { OptionGroupViewModel } from '../../catalog/types/catalog.types';

export interface CartItemOption {
  optionId: number;
  groupName: string;
  optionName: string;
  price: number;
}

export interface CartItem {
  key: string;
  productId: number;
  productCode: string;
  productName: string;
  imageUrl: string | null;
  regularPrice: number;
  unitPrice: number;
  quantity: number;
  note: string;
  optionGroups: OptionGroupViewModel[];
  options: CartItemOption[];
}

export type ServiceType = 'DineIn' | 'TakeAway' | 'Delivery';

export interface CreateOrderItemOptionRequest {
  OptionId: number;
  GroupName: string | null;
  OptionName: string;
  Price: number;
}

export interface CreateOrderItemRequest {
  ProductId: number;
  ProductCode: string;
  ProductName: string;
  RegularPrice: number;
  Quantity: number;
  DiscountAmount: number;
  Note: string | null;
  Options: CreateOrderItemOptionRequest[];
}

export interface CreateOrderRequest {
  StoreId: number;
  Channel: string | null;
  CustomerName: string | null;
  CustomerPhone: string | null;
  Note: string | null;
  DiscountAmount: number;
  TaxAmount: number;
  DeliveryFee: number;
  DeliveryAddress: string | null;
  PaymentMethod: string | null;
  PaymentStatus: string | null;
  AmountReceived: number | null;
  ServiceType: string | null;
  Items: CreateOrderItemRequest[];
}

export interface CreateOrderResponse {
  Id: number;
  OrderNumber: string;
  Status: string;
  TotalAmount: number;
  CreatedAt: string | null;
}
