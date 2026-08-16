// src/features/cart/components/OptionSelectionModal.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { formatCurrency } from '../../../utils/formatCurrency';
import { useOptionSelection, type OptionSelectionState } from '../hooks/useOptionSelection';
import { ProductOptionsForm } from './ProductOptionsForm';
import type { OptionGroupViewModel, ProductViewModel } from '../../catalog/types/catalog.types';
import type { CartItemOption } from '../types/cart.types';

export interface OptionSelectionModalProps {
  product: ProductViewModel | null;
  onDismiss: () => void;
  onConfirm: (options: CartItemOption[], quantity: number, note: string) => void;
}

const defaultSelection = (product: ProductViewModel): OptionSelectionState => {
  const state: OptionSelectionState = {};
  product.optionGroups.forEach((group: OptionGroupViewModel) => {
    state[group.groupId] = group.options.filter((option) => option.isDefault).map((option) => option.id);
  });
  return state;
};

export const OptionSelectionModal: React.FC<OptionSelectionModalProps> = ({ product, onDismiss, onConfirm }) => {
  const { selection, selectedOptions, canConfirm, toggleSingle, toggleMulti } = useOptionSelection(
    product,
    defaultSelection,
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!product) return;
    setQuantity(1);
    setNote('');
  }, [product]);

  const unitPrice = product ? product.price + selectedOptions.reduce((sum, option) => sum + option.price, 0) : 0;

  return (
    <Portal>
      <Modal visible={product !== null} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        {product ? (
          <ProductOptionsForm
            imageUrl={product.imageUrl}
            title={product.name}
            priceLabel={formatCurrency(product.price)}
            optionGroups={product.optionGroups}
            selection={selection}
            onToggleSingle={toggleSingle}
            onToggleMulti={toggleMulti}
            quantity={quantity}
            onQuantityChange={setQuantity}
            note={note}
            onNoteChange={setNote}
            confirmButton={
              <AppButton
                label={`Thêm vào giỏ · ${formatCurrency(unitPrice * quantity)}`}
                disabled={!canConfirm}
                onPress={() => onConfirm(selectedOptions, quantity, note)}
              />
            }
          />
        ) : null}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: { backgroundColor: 'white', margin: 16, borderRadius: 8, maxHeight: '85%' },
});
