import { RuStorePaymentError } from '../lib/rustorePayments';
import { rustoreValidationErrorStatus } from '../pages/api/payments/rustore/validate';

describe('RuStore validation API error taxonomy', () => {
  it.each([
    ['RUSTORE_PURCHASE_ID_REQUIRED', 422],
    ['RUSTORE_PURCHASE_PRODUCT_MISMATCH', 422],
    ['RUSTORE_PURCHASE_USER_MISMATCH', 409],
    ['RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER', 409],
  ])('treats %s as terminal with HTTP %i', (code, status) => {
    expect(rustoreValidationErrorStatus(new RuStorePaymentError(code))).toBe(status);
  });

  it.each([
    'RUSTORE_CONFIGURATION_REQUIRED',
    'RUSTORE_PAY_MODE_REQUIRED',
    'RUSTORE_PRIVATE_KEY_INVALID',
    'RUSTORE_API_AUTH_FAILED',
    'RUSTORE_API_VALIDATION_FAILED',
    'RUSTORE_API_TIMESTAMP_REQUIRED',
    'RUSTORE_PURCHASE_ACCOUNT_REQUIRED',
    'RUSTORE_PRODUCT_NOT_ALLOWED',
    'RUSTORE_PURCHASE_LEDGER_WRITE_FAILED',
  ])('keeps %s retryable with HTTP 503', (code) => {
    expect(rustoreValidationErrorStatus(new RuStorePaymentError(code))).toBe(503);
  });

  it('preserves valid non-RuStore HTTP errors and defaults unknown failures to 500', () => {
    expect(rustoreValidationErrorStatus({ status: 429 })).toBe(429);
    expect(rustoreValidationErrorStatus(new Error('unknown'))).toBe(500);
  });
});
