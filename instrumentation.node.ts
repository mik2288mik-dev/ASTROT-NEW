import { ensureNotificationScheduler } from './lib/notificationScheduler';

// Notifications and owner bots start first and on their own: a failure in any
// other background worker must never silence them.
try {
  ensureNotificationScheduler('instrumentation');
} catch (error) {
  console.warn(
    '[instrumentation] failed to start notification scheduler:',
    error instanceof Error ? error.message : error
  );
}

void import('./lib/natalReading/preparation')
  .then(({ ensureNatalReadingPreparationWorker }) => ensureNatalReadingPreparationWorker())
  .catch((error) => {
    console.warn(
      '[instrumentation] natal reading preparation worker failed to start:',
      error instanceof Error ? error.message : error
    );
  });
