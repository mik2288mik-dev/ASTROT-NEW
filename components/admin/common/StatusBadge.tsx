import React from 'react';

const MAP: Record<string, string> = {
  active: 'bg-[#56CA00]/12 text-[#56CA00]',
  published: 'bg-[#56CA00]/12 text-[#56CA00]',
  draft: 'bg-[#FFB400]/15 text-[#E6A200]',
  scheduled: 'bg-[#16B1FF]/12 text-[#16B1FF]',
  archived: 'bg-slate-100 text-slate-400',
  pending: 'bg-[#FFB400]/15 text-[#A66F00]',
  approved: 'bg-[#16B1FF]/12 text-[#087EAF]',
  generating: 'bg-[#8C57FF]/12 text-[#7040D1]',
  answered: 'bg-[#56CA00]/12 text-[#3C9200]',
  rejected: 'bg-[#FF4C51]/12 text-[#C52F34]',
  new: 'bg-[#FF4C51]/12 text-[#FF4C51]',
  investigating: 'bg-[#FFB400]/15 text-[#E6A200]',
  fixed: 'bg-[#56CA00]/12 text-[#56CA00]',
  resolved: 'bg-[#56CA00]/12 text-[#56CA00]',
  ignored: 'bg-slate-100 text-slate-400',
  success: 'bg-[#56CA00]/12 text-[#56CA00]',
  error: 'bg-[#FF4C51]/12 text-[#FF4C51]',
  refunded: 'bg-[#FFB400]/15 text-[#E6A200]',
  blocked: 'bg-[#FF4C51]/12 text-[#FF4C51]',
  open: 'bg-[#16B1FF]/12 text-[#16B1FF]',
  closed: 'bg-slate-100 text-slate-400',
  ok: 'bg-[#56CA00]/12 text-[#56CA00]',
};

const RU: Record<string, string> = {
  active: 'активен',
  published: 'опубликован',
  draft: 'черновик',
  scheduled: 'запланирован',
  archived: 'архив',
  pending: 'на проверке',
  approved: 'одобрен',
  generating: 'генерация',
  answered: 'отвечен',
  rejected: 'отклонён',
  new: 'новый',
  investigating: 'в работе',
  fixed: 'исправлен',
  resolved: 'решён',
  ignored: 'пропущен',
  success: 'успешно',
  error: 'ошибка',
  refunded: 'возврат',
  blocked: 'заблокирован',
  open: 'открыт',
  closed: 'закрыт',
  ok: 'OK',
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = (status || '').toLowerCase();
  const cls = MAP[normalized] || 'bg-slate-100 text-slate-500';
  const label = RU[normalized] || status;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}>
      {label}
    </span>
  );
}
