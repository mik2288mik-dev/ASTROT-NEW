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
import { findStorySeries, STORY_SERIES } from '../../../../../lib/stories/series';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } }, maxDuration: 300 };

/**
 * «Рассказы» moderation: read and edit episodes before release, mark them as
 * checked by a human, hold or release, rewrite the last draft, fill the buffer.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      await requireAdminPermission(req, 'content.view');
      const today = moscowDayKey();
      const series = await Promise.all(STORY_SERIES.map(async (item) => {
        const episodes = await listEpisodes(item.id);
        const released = new Set(releasedEpisodeNumbers(episodes, today));
        return {
          id: item.id,
          title: item.title,
          genre: item.genre,
          episodes: episodes.map((episode) => ({ ...episode, released: released.has(episode.number) })),
        };
      }));
      return res.status(200).json({ today, bufferDays: STORY_BUFFER_DAYS, generationEnabled: storyGenerationEnabled(), series });
    }

    if (req.method === 'PATCH') {
      const { seriesId, number, title, body, hook, action } = (req.body || {}) as Record<string, unknown>;
      const ctx = await requireAdminPermission(req, action === 'save' ? 'content.edit' : 'content.publish');
      if (typeof seriesId !== 'string' || !findStorySeries(seriesId) || !Number.isSafeInteger(Number(number))) {
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
      const { action, seriesId, number } = (req.body || {}) as Record<string, unknown>;
      const targets = typeof seriesId === 'string' && findStorySeries(seriesId) ? [seriesId] : STORY_SERIES.map((item) => item.id);
      if (action === 'rewrite') {
        if (typeof seriesId !== 'string' || !Number.isSafeInteger(Number(number))) throw new AdminAuthError(400, 'BAD_EPISODE', 'seriesId and number are required');
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
      throw new AdminAuthError(400, 'BAD_ACTION', 'action must be generate or rewrite');
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
