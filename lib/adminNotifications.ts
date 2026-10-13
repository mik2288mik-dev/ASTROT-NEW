import { db } from './db';
import { sendTelegramPhotoMessage, sendTelegramTextMessage } from './telegramBot';
import type { AdminNotificationTargetSegment } from '../types';

type Recipient = {
  id: string;
  name: string;
  language: string;
};

const BROADCAST_CHUNK_SIZE = 20;
const BROADCAST_CHUNK_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBody(value?: string | null): string {
  return String(value || '').trim();
}

function resolveLocalizedBody(language: string | null | undefined, bodyRu?: string | null, bodyEn?: string | null) {
  const ru = normalizeBody(bodyRu);
  const en = normalizeBody(bodyEn);
  if ((language || 'ru') === 'en') {
    return en || ru;
  }
  return ru || en;
}

function buildMessageText(title: string, body: string) {
  const safeTitle = String(title || '').trim();
  const safeBody = String(body || '').trim();
  if (!safeTitle) return safeBody;
  if (!safeBody) return safeTitle;
  return `${safeTitle}\n\n${safeBody}`;
}

async function resolveRecipients(input: {
  mode: 'personal' | 'broadcast';
  targetUserId?: string | null;
  targetSegment?: AdminNotificationTargetSegment | null;
}): Promise<Recipient[]> {
  if (input.mode === 'personal') {
    if (!input.targetUserId) {
      throw new Error('TARGET_USER_REQUIRED');
    }
    const user = await db.users.get(input.targetUserId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return [
      {
        id: String(user.id),
        name: user.name || 'Unnamed user',
        language: user.language || 'ru',
      },
    ];
  }

  const recipients = await db.admin.getNotificationRecipients(input.targetSegment || 'all');
  return recipients.map((recipient: any) => ({
    id: String(recipient.id),
    name: recipient.name || 'Unnamed user',
    language: recipient.language || 'ru',
  }));
}

export async function sendAdminNotification(input: {
  createdBy: string;
  mode: 'personal' | 'broadcast';
  targetUserId?: string | null;
  targetSegment?: AdminNotificationTargetSegment | null;
  templateId?: number | null;
  assetId?: number | null;
  title: string;
  bodyRu?: string | null;
  bodyEn?: string | null;
}) {
  const title = String(input.title || '').trim();
  const bodyRu = normalizeBody(input.bodyRu);
  const bodyEn = normalizeBody(input.bodyEn);

  if (!title) {
    throw new Error('TITLE_REQUIRED');
  }
  if (!bodyRu && !bodyEn) {
    throw new Error('MESSAGE_BODY_REQUIRED');
  }

  const recipients = await resolveRecipients(input);
  const assetId = input.assetId != null ? Number(input.assetId) : null;
  let assetRow: any = null;
  if (Number.isInteger(assetId) && assetId && assetId > 0) {
    assetRow = await db.notification_assets.getById(assetId);
    if (!assetRow?.public_url) {
      throw new Error('ASSET_NOT_FOUND');
    }
  }
  const campaign = await db.notifications.createCampaign({
    createdBy: input.createdBy,
    mode: input.mode,
    targetSegment: input.targetSegment ?? null,
    targetUserId: input.targetUserId ?? null,
    templateId: null,
    assetId: assetRow?.id ? Number(assetRow.id) : null,
    title,
    bodyRu,
    bodyEn,
    totalRecipients: recipients.length,
  });

  let successCount = 0;
  let failedCount = 0;

  for (let index = 0; index < recipients.length; index += BROADCAST_CHUNK_SIZE) {
    const chunk = recipients.slice(index, index + BROADCAST_CHUNK_SIZE);

    await Promise.all(
      chunk.map(async (recipient) => {
        const localizedBody = resolveLocalizedBody(recipient.language, bodyRu, bodyEn);
        const messageText = buildMessageText(title, localizedBody);
        const result = assetRow?.public_url
          ? await sendTelegramPhotoMessage(recipient.id, String(assetRow.public_url), messageText)
          : await sendTelegramTextMessage(recipient.id, messageText);

        if (result.ok) {
          successCount += 1;
          await db.notifications.addDelivery({
            campaignId: Number(campaign.id),
            userId: recipient.id,
            language: recipient.language,
            messageText,
            status: 'sent',
            telegramMessageId: result.messageId ?? null,
          });
          return;
        }

        failedCount += 1;
        await db.notifications.addDelivery({
          campaignId: Number(campaign.id),
          userId: recipient.id,
          language: recipient.language,
          messageText,
          status: 'failed',
          errorText: result.error || 'Telegram sendMessage failed',
        });
      })
    );

    if (index + BROADCAST_CHUNK_SIZE < recipients.length) {
      await sleep(BROADCAST_CHUNK_DELAY_MS);
    }
  }

  await db.notifications.finalizeCampaign(Number(campaign.id), {
    totalRecipients: recipients.length,
    successCount,
    failedCount,
  });

  const recentCampaigns = await db.notifications.getRecentCampaigns({
    page: 1,
    pageSize: 5,
  });
  const createdCampaign = recentCampaigns.history.find((item: any) => Number(item.id) === Number(campaign.id))
    || recentCampaigns.history[0];

  return {
    campaign: createdCampaign,
  };
}
