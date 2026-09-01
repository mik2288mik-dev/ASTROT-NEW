import { createPrimaryChartRequestGuard } from '../lib/primaryChartRequestGuard';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('primary chart account-switch guard', () => {
  it('keeps B in refs, cache, and state when delayed A completes afterward', async () => {
    const guard = createPrimaryChartRequestGuard();
    const delayedA = deferred<string>();
    const committed = { ref: '', cache: '', state: '' };
    const commitWhenCurrent = async (
      token: ReturnType<typeof guard.begin>,
      result: Promise<string>,
    ) => {
      const chart = await result;
      if (!guard.isCurrent(token)) return;
      committed.ref = chart;
      committed.cache = chart;
      committed.state = chart;
    };

    guard.activateAccount('account-a');
    const tokenA = guard.begin('account-a');
    const pendingA = commitWhenCurrent(tokenA, delayedA.promise);

    guard.activateAccount('account-b');
    const tokenB = guard.begin('account-b');
    await commitWhenCurrent(tokenB, Promise.resolve('chart-b'));

    const staleAAfterSwitch = guard.begin('account-a');
    expect(guard.isCurrent(staleAAfterSwitch)).toBe(false);
    expect(guard.isCurrent(tokenB)).toBe(true);

    delayedA.resolve('chart-a');
    await pendingA;

    expect(committed).toEqual({
      ref: 'chart-b',
      cache: 'chart-b',
      state: 'chart-b',
    });
  });
});
