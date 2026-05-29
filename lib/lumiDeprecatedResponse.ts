import type { NextApiRequest, NextApiResponse } from 'next';

export const LUMI_DEPRECATED_CODE = 'LUMI_DEPRECATED';

export const LUMI_DEPRECATED_MESSAGE_RU =
  'Lumi больше не используется. Доступ открывается через Premium или Telegram Stars.';

export const LUMI_DEPRECATED_MESSAGE_EN =
  'Lumi is no longer used. Access is handled through Premium or Telegram Stars.';

export function resolveLumiDeprecatedLanguage(req: Pick<NextApiRequest, 'query' | 'body'>): 'ru' | 'en' {
  const raw = req.body?.language ?? req.body?.lang ?? req.query?.language ?? req.query?.lang;
  return raw === 'en' ? 'en' : 'ru';
}

export function getLumiDeprecatedMessage(lang: 'ru' | 'en'): string {
  return lang === 'en' ? LUMI_DEPRECATED_MESSAGE_EN : LUMI_DEPRECATED_MESSAGE_RU;
}

export function respondLumiDeprecated(res: NextApiResponse, req: Pick<NextApiRequest, 'query' | 'body'>) {
  const lang = resolveLumiDeprecatedLanguage(req);
  return res.status(410).json({
    code: LUMI_DEPRECATED_CODE,
    error: 'Lumi deprecated',
    message: getLumiDeprecatedMessage(lang),
    messageRu: LUMI_DEPRECATED_MESSAGE_RU,
    messageEn: LUMI_DEPRECATED_MESSAGE_EN,
  });
}
