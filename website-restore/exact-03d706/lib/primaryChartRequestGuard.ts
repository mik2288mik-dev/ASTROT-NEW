export type PrimaryChartRequestToken = Readonly<{
  generation: number;
  accountKey: string;
}>;

export type PrimaryChartRequestGuard = {
  activateAccount: (accountKey: string) => void;
  begin: (accountKey: string) => PrimaryChartRequestToken;
  invalidate: () => void;
  isActiveAccount: (accountKey: string) => boolean;
  isCurrent: (token: PrimaryChartRequestToken) => boolean;
};

const INVALID_GENERATION = -1;

export function createPrimaryChartRequestGuard(): PrimaryChartRequestGuard {
  let generation = 0;
  let activeAccountKey = '';

  return {
    activateAccount(accountKey) {
      const nextAccountKey = String(accountKey || '');
      if (nextAccountKey === activeAccountKey) return;
      generation += 1;
      activeAccountKey = nextAccountKey;
    },

    begin(accountKey) {
      const requestAccountKey = String(accountKey || '');
      if (!requestAccountKey || requestAccountKey !== activeAccountKey) {
        return { generation: INVALID_GENERATION, accountKey: requestAccountKey };
      }
      generation += 1;
      return { generation, accountKey: requestAccountKey };
    },

    invalidate() {
      generation += 1;
      activeAccountKey = '';
    },

    isActiveAccount(accountKey) {
      return !!activeAccountKey && String(accountKey || '') === activeAccountKey;
    },

    isCurrent(token) {
      return token.generation === generation
        && token.accountKey === activeAccountKey;
    },
  };
}
