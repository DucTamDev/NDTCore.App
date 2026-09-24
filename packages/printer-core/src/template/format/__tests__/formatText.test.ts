import { formatText } from '..';

describe('formatText', () => {
  it('đổi hoa/thường, kể cả chữ có dấu', () => {
    expect(formatText('trà đá', { type: 'text', transform: 'upper' })).toBe(
      'TRÀ ĐÁ'
    );
    expect(formatText('TRÀ ĐÁ', { type: 'text', transform: 'lower' })).toBe(
      'trà đá'
    );
  });

  it('cắt theo số ký tự', () => {
    expect(
      formatText('Trà sữa trân châu', { type: 'text', maxLength: 7 })
    ).toBe('Trà sữa');
  });
});
