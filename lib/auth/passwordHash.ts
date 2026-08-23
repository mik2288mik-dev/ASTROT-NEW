import crypto from 'crypto';
import { MIN_PASSWORD_LENGTH } from './passwordPolicy';

const SCRYPT_VERSION = 1;
const SCRYPT_LOG_N = 15;
const SCRYPT_N = 2 ** SCRYPT_LOG_N;
const SCRYPT_R = 8;
const SCRYPT_P = 3;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_LENGTH = 16;
const SCRYPT_MAX_MEMORY = 256 * 1024 * 1024;
const MAX_PASSWORD_CHARACTERS = 128;
const MAX_PASSWORD_BYTES = 512;
const MAX_CONCURRENT_KDFS = 2;
const MAX_QUEUED_KDFS = 16;

let activeKdfs = 0;
const kdfQueue: Array<{
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
}> = [];

export class PasswordValidationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PasswordValidationError';
    this.code = code;
  }
}

export class PasswordHashBusyError extends Error {
  constructor() {
    super('Password hashing is temporarily busy');
    this.name = 'PasswordHashBusyError';
  }
}

function releaseKdfSlot(): void {
  const next = kdfQueue.shift();
  if (next) {
    next.resolve(releaseKdfSlot);
    return;
  }
  activeKdfs = Math.max(0, activeKdfs - 1);
}

function acquireKdfSlot(): Promise<() => void> {
  if (activeKdfs < MAX_CONCURRENT_KDFS) {
    activeKdfs += 1;
    return Promise.resolve(releaseKdfSlot);
  }
  if (kdfQueue.length >= MAX_QUEUED_KDFS) {
    return Promise.reject(new PasswordHashBusyError());
  }
  return new Promise((resolve, reject) => kdfQueue.push({ resolve, reject }));
}

export function assertValidNewPassword(password: string, confirmation: string): void {
  if (password !== confirmation) {
    throw new PasswordValidationError('PASSWORD_CONFIRMATION_MISMATCH', 'Passwords do not match');
  }
  if (Array.from(password).length < MIN_PASSWORD_LENGTH) {
    throw new PasswordValidationError(
      'PASSWORD_TOO_SHORT',
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  if (
    Array.from(password).length > MAX_PASSWORD_CHARACTERS
    || Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES
  ) {
    throw new PasswordValidationError('PASSWORD_TOO_LONG', 'Password is too long');
  }
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  const release = await acquireKdfSlot();
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY,
      }, (error, key) => {
        if (error) reject(error);
        else resolve(key);
      });
    });
  } finally {
    release();
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SCRYPT_SALT_LENGTH);
  const key = await derive(password, salt);
  return [
    'scrypt',
    `v=${SCRYPT_VERSION}`,
    `ln=${SCRYPT_LOG_N},r=${SCRYPT_R},p=${SCRYPT_P}`,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, version, parameters, saltValue, keyValue, ...extra] = encodedHash.split('$');
  if (
    algorithm !== 'scrypt'
    || version !== `v=${SCRYPT_VERSION}`
    || parameters !== `ln=${SCRYPT_LOG_N},r=${SCRYPT_R},p=${SCRYPT_P}`
    || !saltValue
    || !keyValue
    || extra.length
  ) return false;

  try {
    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(keyValue, 'base64url');
    if (salt.length !== SCRYPT_SALT_LENGTH || expected.length !== SCRYPT_KEY_LENGTH) return false;
    const actual = await derive(password, salt);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
