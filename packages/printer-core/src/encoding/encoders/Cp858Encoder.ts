import type { CodePage } from '../CodePage';
import { CP437 } from './Cp437Encoder';

/** CP858 — CP437 thêm ký hiệu Euro ở byte 0xD5. */
export const CP858: CodePage = {
  id: 858,
  name: 'CP858',
  chars: {
    ...CP437.chars,
    0xd5: '€', // Euro sign
  },
};
