import type { PrinterLanguage } from '../core/PrinterLanguage';
import type { PrinterProfile } from './PrinterProfile';
import { PRINTER_PROFILES } from './profiles';

export function getProfile(key: string): PrinterProfile | undefined {
  return PRINTER_PROFILES[key];
}

export function listProfiles(): PrinterProfile[] {
  return Object.values(PRINTER_PROFILES);
}

export function findByVendorId(vendorId: number): PrinterProfile[] {
  return Object.values(PRINTER_PROFILES).filter((p) => p.usbVendorId === vendorId);
}

export function findByLanguage(language: PrinterLanguage): PrinterProfile[] {
  return Object.values(PRINTER_PROFILES).filter((p) => p.language === language);
}
