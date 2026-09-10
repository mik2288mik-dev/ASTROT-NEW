import { logger, type LogEvent } from './logger';

export type ContentApiLogContext = Pick<
  LogEvent,
  'scope' | 'userId' | 'chartId' | 'surface' | 'variant'
>;

type ContentApiLogFields = Partial<
  Pick<LogEvent, 'accessTier' | 'status' | 'errorCode' | 'durationMs' | 'metadata'>
>;

export function logContentApi(
  ctx: ContentApiLogContext,
  event: string,
  fields?: ContentApiLogFields
): void {
  logger.info({ ...ctx, event, ...fields });
}

export function warnContentApi(
  ctx: ContentApiLogContext,
  event: string,
  fields?: ContentApiLogFields
): void {
  logger.warn({ ...ctx, event, ...fields });
}
