import {
  PAYMENT_ENTITLEMENT_POLL_DELAYS_MS,
  pollForPaymentEntitlement,
} from '../lib/paymentEntitlementPolling';

describe('payment entitlement polling', () => {
  it('accepts a server entitlement that arrives after the checkout callback', async () => {
    const load = jest.fn()
      .mockResolvedValueOnce({ premium: false })
      .mockResolvedValueOnce({ premium: false })
      .mockResolvedValueOnce({ premium: true });
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(pollForPaymentEntitlement<{ premium: boolean }>({
      load,
      isEntitled: (value) => value.premium,
      wait,
    })).resolves.toEqual({ premium: true });
    expect(load).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('stops after the explicit bounded schedule when confirmation is unavailable', async () => {
    const load = jest.fn().mockRejectedValue(new Error('offline'));
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(pollForPaymentEntitlement<{ premium: boolean }>({
      load,
      isEntitled: () => true,
      wait,
    })).resolves.toBeNull();
    expect(load).toHaveBeenCalledTimes(PAYMENT_ENTITLEMENT_POLL_DELAYS_MS.length);
  });
});
