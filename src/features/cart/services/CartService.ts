import type { CartItem, CartItemOption, CreateOrderRequest, ServiceType } from '../types/cart.types';
import type { ProductViewModel } from '../../catalog/types/catalog.types';

type CartSourceProduct = Pick<ProductViewModel, 'id' | 'sku' | 'name' | 'imageUrl' | 'price' | 'optionGroups'>;

const buildCartKey = (productId: number, optionIds: number[], note = ''): string =>
  `${productId}:${[...optionIds].sort((a, b) => a - b).join(',')}:${note.trim()}`;

const buildCartItem = (
  product: CartSourceProduct,
  selectedOptions: CartItemOption[],
  quantity: number,
  note: string,
): CartItem => {
  const optionsTotal = selectedOptions.reduce((sum, option) => sum + option.price, 0);
  const trimmedNote = note.trim();

  return {
    key: buildCartKey(
      product.id,
      selectedOptions.map((option) => option.optionId),
      trimmedNote,
    ),
    productId: product.id,
    productCode: product.sku,
    productName: product.name,
    imageUrl: product.imageUrl,
    regularPrice: product.price,
    unitPrice: product.price + optionsTotal,
    quantity,
    note: trimmedNote,
    optionGroups: product.optionGroups,
    options: selectedOptions,
  };
};

const cartItemToSourceProduct = (item: CartItem): CartSourceProduct => ({
  id: item.productId,
  sku: item.productCode,
  name: item.productName,
  imageUrl: item.imageUrl,
  price: item.regularPrice,
  optionGroups: item.optionGroups,
});

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
  AmountReceived: calculateCartTotal(items),
  ServiceType: serviceType,
  Items: items.map((item) => ({
    ProductId: item.productId,
    ProductCode: item.productCode,
    ProductName: item.productName,
    RegularPrice: item.regularPrice,
    Quantity: item.quantity,
    DiscountAmount: 0,
    Note: item.note.trim() || null,
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
  cartItemToSourceProduct,
  calculateItemTotal,
  calculateCartTotal,
  calculateCartItemCount,
  toCreateOrderRequest,
};
