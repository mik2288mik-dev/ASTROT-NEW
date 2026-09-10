const RAILWAY_RUNTIME_ENV_KEYS = [
  'RAILWAY_PROJECT_ID',
  'RAILWAY_SERVICE_ID',
  'RAILWAY_ENVIRONMENT_ID',
  'RAILWAY_DEPLOYMENT_ID',
  'RAILWAY_REPLICA_ID',
];

function readEnv(name: string): string {
  return String(process.env[name] || '').trim();
}

function getDbHost(dbUrl: string): string {
  const match = String(dbUrl || '').match(/^postgres(?:ql)?:\/\/[^:]+:[^@]+@([^:/?]+)/i);
  return match?.[1] || '';
}

function isRailwayRuntime(): boolean {
  return RAILWAY_RUNTIME_ENV_KEYS.some((key) => readEnv(key).length > 0);
}

export function resolveDatabaseUrl(): string {
  const internalOrPrimaryUrl = readEnv('DATABASE_URL');
  const publicUrl = readEnv('DATABASE_PUBLIC_URL');

  if (!internalOrPrimaryUrl) {
    return publicUrl;
  }

  if (!publicUrl) {
    return internalOrPrimaryUrl;
  }

  const primaryHost = getDbHost(internalOrPrimaryUrl);
  if (primaryHost.includes('railway.internal') && !isRailwayRuntime()) {
    return publicUrl;
  }

  return internalOrPrimaryUrl;
}

export function hasDatabaseUrl(): boolean {
  return resolveDatabaseUrl().length > 0;
}

