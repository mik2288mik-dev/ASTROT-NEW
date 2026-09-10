import { ensureNotificationScheduler } from './lib/notificationScheduler';

try {
  ensureNotificationScheduler('instrumentation');
} catch (error) {
  console.warn(
    '[instrumentation] failed to start notification scheduler:',
    error instanceof Error ? error.message : error
  );
}
