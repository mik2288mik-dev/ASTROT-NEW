import {
  assertEmailDeliveryConfigured,
  sendEmailAuthCode,
} from '../lib/auth/emailDelivery';

describe('email authentication delivery', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.EMAIL_OTP_DELIVERY_URL;
    delete process.env.EMAIL_OTP_DELIVERY_SECRET;
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_EMAIL_FROM;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('sends registration codes through the fixed Resend API with a server-only key', async () => {
    process.env.RESEND_API_KEY = 're_test_server_only_key_1234567890';
    process.env.AUTH_EMAIL_FROM = 'Твой Гороскоп <noreply@auth.tvoi-goroskop.ru>';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    assertEmailDeliveryConfigured();
    await sendEmailAuthCode({
      email: 'person@example.test',
      code: '123456',
      purpose: 'register',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer re_test_server_only_key_1234567890',
        },
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual({
      from: 'Твой Гороскоп <noreply@auth.tvoi-goroskop.ru>',
      to: ['person@example.test'],
      subject: 'Код регистрации в «Твой Гороскоп»',
      text: 'Ваш код: 123456\n\nОн действует 10 минут. Если вы не запрашивали код, просто проигнорируйте это письмо.',
    });
  });

  it('keeps the existing HTTPS webhook delivery as a backwards-compatible option', async () => {
    process.env.EMAIL_OTP_DELIVERY_URL = 'https://mailer.example.test/auth-code';
    process.env.EMAIL_OTP_DELIVERY_SECRET = 'webhook-secret';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await sendEmailAuthCode({
      email: 'person@example.test',
      code: '654321',
      purpose: 'password_reset',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://mailer.example.test/auth-code',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer webhook-secret' }),
      }),
    );
  });

  it('fails closed for an invalid sender or a rejected provider request', async () => {
    process.env.RESEND_API_KEY = 're_test_server_only_key_1234567890';
    process.env.AUTH_EMAIL_FROM = 'noreply@auth.tvoi-goroskop.ru\r\nBcc: attacker@example.test';
    expect(() => assertEmailDeliveryConfigured()).toThrow('EMAIL_DELIVERY_NOT_CONFIGURED');

    process.env.AUTH_EMAIL_FROM = 'Твой Гороскоп <noreply@auth.tvoi-goroskop.ru>';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });
    await expect(sendEmailAuthCode({
      email: 'person@example.test',
      code: '123456',
      purpose: 'register',
    })).rejects.toThrow('EMAIL_DELIVERY_FAILED');
  });
});
