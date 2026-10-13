import {
  canonicalizeEvent,
  eventLabel,
} from '../lib/admin/eventTaxonomy';

describe('admin product event taxonomy', () => {
  it.each([
    ['paywall_impression', 'paywall_view'],
    ['paywall_viewed', 'paywall_view'],
    ['checkout_started', 'checkout_start'],
    ['purchase_succeeded', 'purchase_success'],
    ['subscription_started', 'purchase_success'],
    ['restore_succeeded', 'restore_success'],
  ])('canonicalizes %s as %s', (eventType, canonical) => {
    expect(canonicalizeEvent(eventType)).toBe(canonical);
    expect(eventLabel(eventType)).not.toBe(eventType);
  });

  it('keeps Today first value distinct from a generated first result', () => {
    expect(canonicalizeEvent('first_value_viewed')).toBe('first_value_viewed');
    expect(canonicalizeEvent('first_result_ready')).toBe('first_result_ready');
    expect(eventLabel('first_value_viewed')).not.toBe(eventLabel('first_result_ready'));
  });
});
