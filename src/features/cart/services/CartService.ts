import type { CartItem, CartItemOption, CreateOrderRequest, ServiceType } from '../types/cart.types';
import type { ProductViewModel } from '../../catalog/types/catalog.types';

const buildCartKey = (productId: number, optionIds: number[]): string =>
  `${productId}:${[...optionIds].sort((a, b) => a - b).join(',')}`;

const buildCartItem = (product: ProductViewModel, selectedOptions: CartItemOption[], quantity: number): CartItem => {
  const optionsTotal = selectedOptions.reduce((sum, option) => sum + option.price, 0);

  return {
    key: buildCartKey(
      product.id,
      selectedOptions.map((option) => option.optionId),
    ),
    productId: product.id,
    productCode: product.sku,
    productName: product.name,
    regularPrice: product.price,
    unitPrice: product.price + optionsTotal,
    quantity,
    options: selectedOptions,
  };
};

const calculateItemTotal = (item: CartItem): number => item.unitPrice * item.quantity;

const calculateCartTotal = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

const calculateCartItemCount = (items: CartItem[]): number => items.reduce((sum, item) => sum + item.quantity, 0);

const toCreateOrderRequest = (
  storeId: number,
  items: CartItem[],
  serviceType: ServiceType,
  note: string,
): CreateOrderRequest => ({
  StoreId: storeId,
  Channel: null,
  CustomerName: null,
  CustomerPhone: null,
  Note: note.trim() || null,
  DiscountAmount: 0,
  TaxAmount: 0,
  DeliveryFee: 0,
  DeliveryAddress: null,
  PaymentMethod: null,
  PaymentStatus: 'Paid',
  AmountReceived: null,
  ServiceType: serviceType,
  Items: items.map((item) => ({
    ProductId: item.productId,
    ProductCode: item.productCode,
    ProductName: item.productName,
    RegularPrice: item.regularPrice,
    Quantity: item.quantity,
    DiscountAmount: 0,
    Note: null,
    Options: item.options.map((option) => ({
      OptionId: option.optionId,
      GroupName: option.groupName,
      OptionName: option.optionName,
      Price: option.price,
    })),
  })),
});

export const CartService = {
  buildCartKey,
  buildCartItem,
  calculateItemTotal,
  calculateCartTotal,
  calculateCartItemCount,
  toCreateOrderRequest,
};
