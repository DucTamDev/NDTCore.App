import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useOptionSelection, type UseOptionSelectionResult } from '../useOptionSelection';
import type { OptionGroupViewModel } from '../../../catalog/types/catalog.types';

interface Source {
  optionGroups: OptionGroupViewModel[];
}

const singleSelectGroup: OptionGroupViewModel = {
  groupId: 1,
  groupName: 'Kích cỡ',
  uiType: 'SingleSelect',
  isRequired: true,
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 11, name: 'Size M', price: 0, isDefault: true, isAvailable: true },
    { id: 12, name: 'Size L', price: 5000, isDefault: false, isAvailable: true },
  ],
};

const multiSelectGroup: OptionGroupViewModel = {
  groupId: 2,
  groupName: 'Topping',
  uiType: 'MultiSelect',
  isRequired: false,
  minSelect: 0,
  maxSelect: 2,
  options: [
    { id: 21, name: 'Trân châu', price: 5000, isDefault: false, isAvailable: true },
    { id: 22, name: 'Thạch', price: 5000, isDefault: false, isAvailable: true },
    { id: 23, name: 'Pudding', price: 5000, isDefault: false, isAvailable: true },
  ],
};

const source: Source = { optionGroups: [singleSelectGroup, multiSelectGroup] };

let latest: UseOptionSelectionResult;

const Harness: React.FC<{ source: Source | null; seed: (s: Source) => Record<number, number[]> }> = ({
  source: src,
  seed,
}) => {
  latest = useOptionSelection(src, seed);
  return null;
};

const render = (src: Source | null, seed: (s: Source) => Record<number, number[]>) => {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Harness source={src} seed={seed} />);
  });
  return renderer!;
};

describe('useOptionSelection', () => {
  it('seeds selection from the given seed function when source is set', () => {
    render(source, () => ({ 1: [11] }));
    expect(latest.selection).toEqual({ 1: [11] });
    expect(latest.selectedOptions).toEqual([{ optionId: 11, groupName: 'Kích cỡ', optionName: 'Size M', price: 0 }]);
  });

  it('canConfirm is false when a required group has fewer than minSelect selections', () => {
    render(source, () => ({}));
    expect(latest.canConfirm).toBe(false);
  });

  it('canConfirm is true once every required group meets minSelect', () => {
    render(source, () => ({ 1: [11] }));
    expect(latest.canConfirm).toBe(true);
  });

  it('toggleSingle replaces the whole selection for that group with just the new option', () => {
    render(source, () => ({ 1: [11] }));
    act(() => {
      latest.toggleSingle(1, 12);
    });
    expect(latest.selection[1]).toEqual([12]);
  });

  it('toggleMulti adds an option up to maxSelect', () => {
    render(source, () => ({}));
    act(() => {
      latest.toggleMulti(multiSelectGroup, 21);
    });
    act(() => {
      latest.toggleMulti(multiSelectGroup, 22);
    });
    expect(latest.selection[2]).toEqual([21, 22]);
  });

  it('toggleMulti ignores a new option once maxSelect is already reached', () => {
    render(source, () => ({ 2: [21, 22] }));
    act(() => {
      latest.toggleMulti(multiSelectGroup, 23);
    });
    expect(latest.selection[2]).toEqual([21, 22]);
  });

  it('toggleMulti removes an already-selected option', () => {
    render(source, () => ({ 2: [21, 22] }));
    act(() => {
      latest.toggleMulti(multiSelectGroup, 21);
    });
    expect(latest.selection[2]).toEqual([22]);
  });

  it('returns an empty selectedOptions list and canConfirm false when source is null', () => {
    render(null, () => ({}));
    expect(latest.selectedOptions).toEqual([]);
    expect(latest.canConfirm).toBe(false);
  });
});
