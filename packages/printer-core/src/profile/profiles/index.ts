export * from './GenericProfile';
export * from './EpsonProfiles';
export * from './StarProfiles';
export * from './BixolonProfiles';
export * from './CitizenProfiles';
export * from './TscProfiles';
export * from './ZebraProfiles';
export * from './SatoProfiles';
export * from './HoneywellProfiles';

import { GENERIC_PROFILES } from './GenericProfile';
import { EPSON_PROFILES } from './EpsonProfiles';
import { STAR_PROFILES } from './StarProfiles';
import { BIXOLON_PROFILES } from './BixolonProfiles';
import { CITIZEN_PROFILES } from './CitizenProfiles';
import { TSC_PROFILES } from './TscProfiles';
import { ZEBRA_PROFILES } from './ZebraProfiles';
import { SATO_PROFILES } from './SatoProfiles';
import { HONEYWELL_PROFILES } from './HoneywellProfiles';
import type { PrinterProfile } from '../PrinterProfile';

export const PRINTER_PROFILES: Record<string, PrinterProfile> = {
  ...GENERIC_PROFILES, ...EPSON_PROFILES, ...STAR_PROFILES, ...BIXOLON_PROFILES,
  ...CITIZEN_PROFILES, ...TSC_PROFILES, ...ZEBRA_PROFILES, ...SATO_PROFILES, ...HONEYWELL_PROFILES,
};
