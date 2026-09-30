import { ensureNotificationScheduler } from './lib/notificationScheduler';
import { ensureNatalReadingPreparationWorker } from './lib/natalReading/preparation';

ensureNatalReadingPreparationWorker();

try {
  ensureNotificationScheduler('instrumentation');
} catch (error) {
  console.warn(
    '[instrumentation] failed to start notification scheduler:',
    error instanceof Error ? error.message : error
  );
}
