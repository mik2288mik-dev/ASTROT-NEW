import { randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 8-char codes without ambiguous 0/O/1/I. */
export function generateReferralCode(): string {
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function normalizeReferralCode(raw: string): string | null {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (s.length < 6 || s.length > 12) return null;
  return s;
}
