import React from 'react';

const TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  active: 'success', published: 'success', answered: 'success', fixed: 'success', resolved: 'success', success: 'success', ok: 'success',
  draft: 'warning', pending: 'warning', investigating: 'warning', refunded: 'warning',
  rejected: 'danger', error: 'danger', blocked: 'danger', new: 'danger',
  scheduled: 'info', approved: 'info', generating: 'info', open: 'info',
  archived: 'neutral', ignored: 'neutral', closed: 'neutral',
};
const RU: Record<string, string> = {
  active: 'активен', published: 'опубликован', draft: 'черновик', scheduled: 'запланирован', archived: 'архив', pending: 'на проверке', approved: 'одобрен', generating: 'генерация', answered: 'отвечен', rejected: 'отклонён', new: 'новый', investigating: 'в работе', fixed: 'исправлен', resolved: 'решён', ignored: 'пропущен', success: 'успешно', error: 'ошибка', refunded: 'возврат', blocked: 'заблокирован', open: 'открыт', closed: 'закрыт', ok: 'OK',
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = (status || '').toLowerCase();
  return <span className="admin-status" data-tone={TONE[normalized] || 'neutral'}>{RU[normalized] || status}</span>;
}
