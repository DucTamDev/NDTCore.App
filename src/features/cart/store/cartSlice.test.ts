import reducer, {
  itemAdded,
  itemEdited,
  itemQuantityChanged,
  itemRemoved,
  serviceTypeChanged,
  noteChanged,
  cartCleared,
  selectCartItems,
  selectServiceType,
  selectCartNote,
  selectCartItemCount,
  selectCartTotal,
} from './cartSlice';
import { loggedOut } from '../../auth/store/authSlice';
import { storeCleared } from '../../store/store/storeSlice';
import type { CartItem } from '../types/cart.types';

const itemA: CartItem = {
  key: 'a',
  productId: 1,
  productCode: 'A',
  productName: 'Trà sữa A',
  imageUrl: null,
  regularPrice: 10000,
  unitPrice: 10000,
  quantity: 1,
  note: '',
  optionGroups: [],
  options: [],
};

const itemB: CartItem = {
  key: 'b',
  productId: 2,
  productCode: 'B',
  productName: 'Trà sữa B',
  imageUrl: null,
  regularPrice: 20000,
  unitPrice: 20000,
  quantity: 1,
  note: '',
  optionGroups: [],
  options: [],
};

describe('cartSlice', () => {
  const initialState = reducer(undefined, { type: '@@INIT' });

  it('itemAdded pushes a new item when the key is not present', () => {
    const state = reducer(initialState, itemAdded(itemA));
    expect(state.items).toEqual([itemA]);
  });

  it('itemAdded merges quantity when the key already exists', () => {
    const state = reducer({ ...initialState, items: [itemA] }, itemAdded({ ...itemA, quantity: 2 }));
    expect(state.items).toEqual([{ ...itemA, quantity: 3 }]);
  });

  it('itemQuantityChanged updates the quantity of the matching item', () => {
    const state = reducer({ ...initialState, items: [itemA] }, itemQuantityChanged({ key: 'a', quantity: 5 }));
    expect(state.items).toEqual([{ ...itemA, quantity: 5 }]);
  });

  it('itemQuantityChanged removes the item when quantity drops to 0 or below', () => {
    const state = reducer({ ...initialState, items: [itemA] }, itemQuantityChanged({ key: 'a', quantity: 0 }));
    expect(state.items).toEqual([]);
  });

  it('itemRemoved removes the matching item', () => {
    const state = reducer({ ...initialState, items: [itemA] }, itemRemoved({ key: 'a' }));
    expect(state.items).toEqual([]);
  });

  it('serviceTypeChanged updates serviceType', () => {
    const state = reducer(initialState, serviceTypeChanged('DineIn'));
    expect(state.serviceType).toBe('DineIn');
  });

  it('noteChanged updates note', () => {
    const state = reducer(initialState, noteChanged('Ít đá'));
    expect(state.note).toBe('Ít đá');
  });

  it('cartCleared empties items and note but keeps serviceType', () => {
    const state = reducer(
      { ...initialState, items: [itemA], note: 'Ít đá', serviceType: 'DineIn' },
      cartCleared(),
    );
    expect(state.items).toEqual([]);
    expect(state.note).toBe('');
    expect(state.serviceType).toBe('DineIn');
  });

  it('resets to initialState on loggedOut', () => {
    const state = reducer({ ...initialState, items: [itemA], note: 'x', serviceType: 'DineIn' }, loggedOut());
    expect(state).toEqual(initialState);
  });

  it('resets to initialState on storeCleared', () => {
    const state = reducer({ ...initialState, items: [itemA], note: 'x', serviceType: 'DineIn' }, storeCleared());
    expect(state).toEqual(initialState);
  });

  it('selectors read the cart slice from RootState-shaped object', () => {
    const rootState = { cart: { items: [itemA], serviceType: 'DineIn' as const, note: 'x' } };
    expect(selectCartItems(rootState)).toEqual([itemA]);
    expect(selectServiceType(rootState)).toBe('DineIn');
    expect(selectCartNote(rootState)).toBe('x');
    expect(selectCartItemCount(rootState)).toBe(1);
    expect(selectCartTotal(rootState)).toBe(10000);
  });
});

describe('cartSlice itemEdited', () => {
  const initialState = reducer(undefined, { type: '@@INIT' });

  it('replaces the item at its new key when the new key does not collide with another line', () => {
    const updated: CartItem = { ...itemA, key: 'a-size-l', note: 'Ít đá', unitPrice: 15000 };

    const state = reducer(
      { ...initialState, items: [itemA, itemB] },
      itemEdited({ previousKey: 'a', item: updated }),
    );

    expect(state.items).toEqual([updated, itemB]);
  });

  it('merges quantity into an existing line when the edited key collides with a different line, keeping that line\'s own note/options', () => {
    const editedToMatchB: CartItem = { ...itemA, key: 'b', quantity: 2, note: 'ghi chú không nên xuất hiện' };

    const state = reducer(
      { ...initialState, items: [itemA, itemB] },
      itemEdited({ previousKey: 'a', item: editedToMatchB }),
    );

    expect(state.items).toEqual([{ ...itemB, quantity: 3 }]);
  });

  it('replaces the item in place when only note/quantity changed and the key stayed the same', () => {
    const updated: CartItem = { ...itemA, quantity: 5, note: 'Không đường' };

    const state = reducer(
      { ...initialState, items: [itemA, itemB] },
      itemEdited({ previousKey: 'a', item: updated }),
    );

    expect(state.items).toEqual([updated, itemB]);
  });

  it('keeps the edited item at its original index, not just at index 0, when there is no collision', () => {
    const itemC: CartItem = { ...itemB, key: 'c', productId: 3, productCode: 'C', productName: 'Trà sữa C' };
    const updatedB: CartItem = { ...itemB, key: 'b-edited', note: 'edited' };

    const state = reducer(
      { ...initialState, items: [itemA, itemB, itemC] },
      itemEdited({ previousKey: 'b', item: updatedB }),
    );

    expect(state.items).toEqual([itemA, updatedB, itemC]);
  });
});
