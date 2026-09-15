import type { CodePage } from '../CodePage';
import { CP437 } from './Cp437Encoder';

/** CP858 — CP437 plus the Euro sign at 0xD5. Ported from portakal/src/encoding.ts CP858_CHARS. */
export const CP858: CodePage = {
  id: 858,
  name: 'CP858',
  chars: {
    ...CP437.chars,
    0xd5: '€', // Euro sign
  },
};
