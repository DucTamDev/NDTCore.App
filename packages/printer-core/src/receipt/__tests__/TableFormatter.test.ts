import { formatTable } from '../TableFormatter';

describe('formatTable', () => {
  it('renders a header + 1 data row at the given total width', () => {
    const lines = formatTable(
      [{ width: 30, align: 'left' }, { width: 5, align: 'center' }, { width: 13, align: 'right' }],
      [['Item', 'Qty', 'Price'], ['Hamburger', '2', '$25.98']],
      48,
    );
    expect(lines).toHaveLength(2);
    lines.forEach((line) => expect(line).toHaveLength(48));
  });
});
