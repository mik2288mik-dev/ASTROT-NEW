export const PAYMENT_ENTITLEMENT_POLL_DELAYS_MS = [0, 1_000, 2_500] as const;

type PaymentEntitlementPollOptions<T> = {
  load: () => Promise<T | null>;
  isEntitled: (value: T) => boolean;
  delaysMs?: readonly number[];
  wait?: (delayMs: number) => Promise<void>;
};

const defaultWait = (delayMs: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, delayMs);
});

/**
 * Webhooks can commit an entitlement shortly after the checkout callback.
 * Poll a small, explicit number of times so a paid checkout is not reported as
 * failed while still keeping the UI wait strictly bounded.
 */
export async function pollForPaymentEntitlement<T>({
  load,
  isEntitled,
  delaysMs = PAYMENT_ENTITLEMENT_POLL_DELAYS_MS,
  wait = defaultWait,
}: PaymentEntitlementPollOptions<T>): Promise<T | null> {
  for (const delayMs of delaysMs) {
    if (delayMs > 0) await wait(delayMs);
    const value = await load().catch(() => null);
    if (value && isEntitled(value)) return value;
  }
  return null;
}
