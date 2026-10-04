import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { releasedEpisodeNumbers } from '../../../../../lib/stories/access';
import {
  deleteLastUnreleasedEpisode,
  ensureEpisodeBuffer,
  listEpisodes,
  moscowDayKey,
  STORY_BUFFER_DAYS,
  storyGenerationEnabled,
  updateEpisode,
} from '../../../../../lib/stories/repository';
import {
  deletePlan,
  findManagedSeries,
  loadStorySeries,
  proposeEpisodeVariants,
  readPlans,
  resetStorySeries,
  sanitizeSeries,
  savePlan,
  saveStorySeries,
} from '../../../../../lib/stories/catalog';
import { STORY_SERIES } from '../../../../../lib/stories/series';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } }, maxDuration: 300 };

/**
 * «Рассказы» in Admin v2: the series bible (world, heroes, lines, rules, style,
 * narrator, pause), new series, the plot of upcoming episodes (AI variants or
 * your own), and moderation of written episodes before release.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      await requireAdminPermission(req, 'content.view');
      const today = moscowDayKey();
      const series = await Promise.all((await loadStorySeries({ includeDisabled: true })).map(async (item) => {
        const [episodes, plans] = await Promise.all([listEpisodes(item.id), readPlans(item.id)]);
        const released = new Set(releasedEpisodeNumbers(episodes, today));
        return {
          ...item,
          builtIn: STORY_SERIES.some((base) => base.id === item.id),
          plans,
          episodes: episodes.map((episode) => ({ ...episode, released: released.has(episode.number) })),
        };
      }));
      return res.status(200).json({ today, bufferDays: STORY_BUFFER_DAYS, generationEnabled: storyGenerationEnabled(), series });
    }

    if (req.method === 'PATCH') {
      const { seriesId, number, title, body, hook, action } = (req.body || {}) as Record<string, unknown>;
      const ctx = await requireAdminPermission(req, action === 'save' ? 'content.edit' : 'content.publish');
      if (typeof seriesId !== 'string' || !(await findManagedSeries(seriesId, { includeDisabled: true })) || !Number.isSafeInteger(Number(number))) {
        throw new AdminAuthError(400, 'BAD_EPISODE', 'seriesId and number are required');
      }
      if (action !== 'save' && action !== 'approve' && action !== 'hold' && action !== 'release') {
        throw new AdminAuthError(400, 'BAD_ACTION', 'action must be save, approve, hold or release');
      }
      const clean = (value: unknown, max: number) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined);
      const updated = await updateEpisode({
        seriesId,
        number: Number(number),
        title: clean(title, 120),
        body: clean(body, 20_000),
        hook: clean(hook, 1_000),
        action,
        reviewer: ctx.userId,
      });
      if (!updated) throw new AdminAuthError(404, 'EPISODE_NOT_FOUND', 'Episode not found');
      await recordAdminAction({
        req, actor: ctx, action: action === 'hold' ? 'content_reverted' : 'content_published',
        entityType: 'story_episode', entityId: `${seriesId}:${number}`,
        after: { action, status: updated.status, edited: Boolean(clean(title, 120) || clean(body, 20_000) || clean(hook, 1_000)) },
      });
      return res.status(200).json({ ok: true, episode: updated });
    }

    if (req.method === 'POST') {
      const ctx = await requireAdminPermission(req, 'content.edit');
      const { action, seriesId, number, direction, hint, series: rawSeries, enabled } = (req.body || {}) as Record<string, unknown>;
      const managed = typeof seriesId === 'string' ? await findManagedSeries(seriesId, { includeDisabled: true }) : null;
      const targets = managed ? [managed.id] : (await loadStorySeries()).map((item) => item.id);
      const episodeNumber = Number(number);
      const cleanDirection = typeof direction === 'string' ? direction.trim().slice(0, 2_000) : '';

      if (action === 'save_series') {
        const series = sanitizeSeries(rawSeries);
        if (!series) throw new AdminAuthError(400, 'BAD_SERIES', 'Нужны id (латиницей), жанр, название, мир, хотя бы один герой и одна линия');
        const existing = await findManagedSeries(series.id, { includeDisabled: true });
        await saveStorySeries(series, enabled !== false, ctx.userId);
        await recordAdminAction({ req, actor: ctx, action: 'settings_changed', entityType: 'story_series', entityId: series.id, after: { created: !existing, enabled: enabled !== false } });
        return res.status(200).json({ ok: true });
      }
      if (action === 'reset_series') {
        if (!managed || !STORY_SERIES.some((base) => base.id === managed.id)) throw new AdminAuthError(400, 'BAD_SERIES', 'Вернуть исходный текст можно только у встроенных сериалов');
        await resetStorySeries(managed.id);
        await recordAdminAction({ req, actor: ctx, action: 'settings_changed', entityType: 'story_series', entityId: managed.id, after: { reset: true } });
        return res.status(200).json({ ok: true });
      }
      if (action === 'propose') {
        if (!managed || !Number.isSafeInteger(episodeNumber) || episodeNumber < 1) throw new AdminAuthError(400, 'BAD_EPISODE', 'seriesId and number are required');
        if (!storyGenerationEnabled()) throw new AdminAuthError(409, 'GENERATION_DISABLED', 'На этом сервере генерация выключена');
        const previous = (await listEpisodes(managed.id))
          .filter((episode) => episode.number < episodeNumber)
          .map((episode) => ({ number: episode.number, title: episode.title, summary: episode.summary, facts: episode.facts }));
        const variants = await proposeEpisodeVariants(managed, episodeNumber, previous, typeof hint === 'string' ? hint.trim().slice(0, 600) : '');
        return res.status(200).json({ ok: true, variants });
      }
      if (action === 'plan') {
        if (!managed || !Number.isSafeInteger(episodeNumber) || episodeNumber < 1 || !cleanDirection) throw new AdminAuthError(400, 'BAD_PLAN', 'seriesId, number and direction are required');
        await savePlan({ seriesId: managed.id, number: episodeNumber, direction: cleanDirection, source: (req.body as Record<string, unknown>).source === 'ai' ? 'ai' : 'own', by: ctx.userId });
        await recordAdminAction({ req, actor: ctx, action: 'content_published', entityType: 'story_plan', entityId: `${managed.id}:${episodeNumber}`, after: { planned: true } });
        return res.status(200).json({ ok: true });
      }
      if (action === 'delete_plan') {
        if (!managed || !Number.isSafeInteger(episodeNumber)) throw new AdminAuthError(400, 'BAD_PLAN', 'seriesId and number are required');
        await deletePlan(managed.id, episodeNumber);
        return res.status(200).json({ ok: true });
      }
      if (action === 'rewrite') {
        if (typeof seriesId !== 'string' || !Number.isSafeInteger(Number(number))) throw new AdminAuthError(400, 'BAD_EPISODE', 'seriesId and number are required');
        if (cleanDirection) await savePlan({ seriesId, number: Number(number), direction: cleanDirection, source: 'own', by: ctx.userId });
        const removed = await deleteLastUnreleasedEpisode(seriesId, Number(number));
        if (!removed) throw new AdminAuthError(409, 'EPISODE_NOT_REWRITABLE', 'Only the last unreleased episode can be rewritten');
        const written = await ensureEpisodeBuffer(seriesId, { maxNew: 1 });
        await recordAdminAction({ req, actor: ctx, action: 'content_published', entityType: 'story_episode', entityId: `${seriesId}:${number}`, after: { action: 'rewrite', written } });
        return res.status(200).json({ ok: true, written });
      }
      if (action === 'generate') {
        void Promise.all(targets.map((id) => ensureEpisodeBuffer(id).catch(() => 0)));
        return res.status(202).json({ ok: true, status: 'in_progress', series: targets });
      }
      throw new AdminAuthError(400, 'BAD_ACTION', 'Unknown action');
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
