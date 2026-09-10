export type EmailAuthCodePurpose = 'register' | 'password_reset';
export const EMAIL_AUTH_CODE_DELIVERY_TIMEOUT_MS = 2_000;

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

type EmailDeliveryConfig =
  | { provider: 'resend'; apiKey: string; from: string }
  | { provider: 'webhook'; endpoint: string; secret: string };

function requiredServerValue(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (
    !value
    || value.includes('_REQUIRED')
    || /^(?:replace-with|your[_-])/i.test(value)
  ) throw new Error('EMAIL_DELIVERY_NOT_CONFIGURED');
  return value;
}

function assertValidSender(value: string): string {
  const sender = value.trim();
  const mailbox = '(?:[^<>\\s@]+@[^<>\\s@]+\\.[^<>\\s@]+)';
  const valid = sender.length <= 320
    && !/[\r\n]/.test(sender)
    && new RegExp(`^(?:${mailbox}|[^<>]{1,200}<${mailbox}>)$`).test(sender);
  if (!valid) throw new Error('EMAIL_DELIVERY_NOT_CONFIGURED');
  return sender;
}

function getEmailDeliveryConfig(): EmailDeliveryConfig {
  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
  const resendFrom = String(process.env.AUTH_EMAIL_FROM || '').trim();
  if (resendApiKey || resendFrom) {
    return {
      provider: 'resend',
      apiKey: requiredServerValue('RESEND_API_KEY'),
      from: assertValidSender(requiredServerValue('AUTH_EMAIL_FROM')),
    };
  }

  const endpoint = new URL(requiredServerValue('EMAIL_OTP_DELIVERY_URL'));
  if (endpoint.protocol !== 'https:') throw new Error('EMAIL_DELIVERY_NOT_CONFIGURED');
  return {
    provider: 'webhook',
    endpoint: endpoint.toString(),
    secret: requiredServerValue('EMAIL_OTP_DELIVERY_SECRET'),
  };
}

export function assertEmailDeliveryConfigured(): void {
  getEmailDeliveryConfig();
}

export function isEmailDeliveryConfigured(): boolean {
  try {
    getEmailDeliveryConfig();
    return true;
  } catch {
    return false;
  }
}

export async function sendEmailAuthCode(input: {
  email: string;
  code: string;
  purpose: EmailAuthCodePurpose;
}): Promise<void> {
  const config = getEmailDeliveryConfig();
  try {
    const response = config.provider === 'resend'
      ? await fetch(RESEND_EMAILS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            from: config.from,
            to: [input.email],
            subject: input.purpose === 'register'
              ? 'Код регистрации в NEBO'
              : 'Код восстановления доступа к NEBO',
            text: `Ваш код: ${input.code}\n\nОн действует 10 минут. Если вы не запрашивали код, просто проигнорируйте это письмо.`,
          }),
          redirect: 'error',
          signal: AbortSignal.timeout(EMAIL_AUTH_CODE_DELIVERY_TIMEOUT_MS),
        })
      : await fetch(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.secret}`,
          },
          body: JSON.stringify({
            to: input.email,
            template: input.purpose === 'register' ? 'registration_code' : 'password_reset_code',
            code: input.code,
            expiresInMinutes: 10,
          }),
          signal: AbortSignal.timeout(EMAIL_AUTH_CODE_DELIVERY_TIMEOUT_MS),
        });
    if (!response.ok) throw new Error('EMAIL_DELIVERY_FAILED');
  } catch {
    throw new Error('EMAIL_DELIVERY_FAILED');
  }
}
