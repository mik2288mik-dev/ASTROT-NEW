export type EmailAuthCodePurpose = 'register' | 'password_reset';

function requiredServerValue(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value || value.includes('_REQUIRED')) throw new Error('EMAIL_DELIVERY_NOT_CONFIGURED');
  return value;
}

export function assertEmailDeliveryConfigured(): void {
  const endpoint = new URL(requiredServerValue('EMAIL_OTP_DELIVERY_URL'));
  if (endpoint.protocol !== 'https:') throw new Error('EMAIL_DELIVERY_NOT_CONFIGURED');
  requiredServerValue('EMAIL_OTP_DELIVERY_SECRET');
}

export async function sendEmailAuthCode(input: {
  email: string;
  code: string;
  purpose: EmailAuthCodePurpose;
}): Promise<void> {
  assertEmailDeliveryConfigured();
  const endpoint = requiredServerValue('EMAIL_OTP_DELIVERY_URL');
  const secret = requiredServerValue('EMAIL_OTP_DELIVERY_SECRET');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      to: input.email,
      template: input.purpose === 'register' ? 'registration_code' : 'password_reset_code',
      code: input.code,
      expiresInMinutes: 10,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('EMAIL_DELIVERY_FAILED');
}
