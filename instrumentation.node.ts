import { installOwnerErrorAlerts } from './lib/ownerErrorAlerts';
import { ensureNotificationScheduler } from './lib/notificationScheduler';

installOwnerErrorAlerts();

try {
  ensureNotificationScheduler('instrumentation');
} catch (error) {
  console.warn(
    '[instrumentation] failed to start notification scheduler:',
    error instanceof Error ? error.message : error
  );
}
