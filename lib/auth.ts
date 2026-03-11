import crypto from 'crypto';

function createHmacSha256(key: Buffer, data: string): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

export function verifyTelegramInitData(initData: string): boolean {
  if (!initData || typeof initData !== 'string' || initData.trim().length === 0) {
    return false;
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return false;
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;

    params.delete('hash');
    const sortedKeys = [...params.keys()].sort();
    const dataCheckString = sortedKeys
      .map((k) => `${k}=${params.get(k)}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = createHmacSha256(secretKey, dataCheckString);

    if (hash.length !== calculatedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calculatedHash, 'hex'));
  } catch {
    return false;
  }
}

export function parseTelegramUserFromInitData(initData: string): { id: string; username?: string; first_name?: string } | null {
  if (!initData || typeof initData !== 'string' || initData.trim().length === 0) {
    return null;
  }

  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) return null;

    const user = JSON.parse(userStr);
    if (!user || typeof user.id !== 'number') return null;

    return {
      id: String(user.id),
      username: user.username || undefined,
      first_name: user.first_name || undefined,
    };
  } catch {
    return null;
  }
}
