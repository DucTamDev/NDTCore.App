// src/features/cart/components/CartItemEditModal.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { formatCurrency } from '../../../utils/formatCurrency';
import { CartService } from '../services/CartService';
import { useOptionSelection, type OptionSelectionState } from '../hooks/useOptionSelection';
import { ProductOptionsForm } from './ProductOptionsForm';
import type { CartItem } from '../types/cart.types';

export interface CartItemEditModalProps {
  item: CartItem | null;
  onDismiss: () => void;
  onConfirm: (updated: CartItem) => void;
}

const selectionFromItem = (item: CartItem): OptionSelectionState => {
  const state: OptionSelectionState = {};
  item.optionGroups.forEach((group) => {
    state[group.groupId] = group.options
      .filter((option) => item.options.some((selected) => selected.optionId === option.id))
      .map((option) => option.id);
  });
  return state;
};

export const CartItemEditModal: React.FC<CartItemEditModalProps> = ({ item, onDismiss, onConfirm }) => {
  const { selection, selectedOptions, canConfirm, toggleSingle, toggleMulti } = useOptionSelection(
    item,
    selectionFromItem,
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!item) return;
    setQuantity(item.quantity);
    setNote(item.note);
  }, [item]);

  const handleConfirm = (): void => {
    if (!item) return;
    const updated = CartService.buildCartItem(
      CartService.cartItemToSourceProduct(item),
      selectedOptions,
      quantity,
      note,
    );
    onConfirm(updated);
  };

  return (
    <Portal>
      <Modal visible={item !== null} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        {item ? (
          <ProductOptionsForm
            imageUrl={item.imageUrl}
            title={item.productName}
            priceLabel={formatCurrency(item.regularPrice)}
            optionGroups={item.optionGroups}
            selection={selection}
            onToggleSingle={toggleSingle}
            onToggleMulti={toggleMulti}
            quantity={quantity}
            onQuantityChange={setQuantity}
            note={note}
            onNoteChange={setNote}
            confirmButton={<AppButton label="Cập nhật" disabled={!canConfirm} onPress={handleConfirm} />}
          />
        ) : null}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: { backgroundColor: 'white', margin: 16, borderRadius: 8, maxHeight: '85%' },
});
