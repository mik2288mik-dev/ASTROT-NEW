import type { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp';
import { buildNatalProfileCards } from '../../../../lib/natalProfileCards';
import { ensureValidContext, isPremium } from '../../../../lib/natalReading/apiHelper';
import { normalizeNatalStoryShareFormat, renderNatalStoryShareSvg } from '../../../../lib/natalStoryShareRenderer';
import { resolveNatalStoryCardId } from '../../../../lib/natalStory';

export const config = {
  api: {
    responseLimit: '8mb',
  },
};

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  const valid = await ensureValidContext(req, res);
  if (!valid) return;

  const cardId = resolveNatalStoryCardId(readSingle(req.query.cardId));
  if (!cardId) {
    return res.status(400).json({ error: 'CARD_ID_REQUIRED', message: 'cardId is required' });
  }

  try {
    const premium = await isPremium(valid.userId);
    const cards = buildNatalProfileCards({
      profile: { ...valid.ctx.profile, isPremium: premium },
      chartData: valid.ctx.chartData!,
      isPremium: premium,
    });
    const card = cards.find((item) => resolveNatalStoryCardId(item.id) === cardId);
    if (!card) {
      return res.status(404).json({ error: 'CARD_NOT_FOUND', message: 'Profile card not found' });
    }

    const format = normalizeNatalStoryShareFormat(readSingle(req.query.format));
    const { svg } = renderNatalStoryShareSvg(card, format);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `inline; filename="lumia-${cardId}-${format}.png"`);
    return res.status(200).send(png);
  } catch (error: any) {
    console.error('[profile-card-share]', error?.message || error);
    return res.status(500).json({
      error: 'PROFILE_CARD_SHARE_FAILED',
      message: error?.message || 'Failed to render share card',
    });
  }
}
