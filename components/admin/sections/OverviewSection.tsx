import React, { useState } from 'react';
import { admin2, type AdminDayPoint, type AdminRangeKey } from '../../../services/admin2Service';
import { DailyBars, Funnel, RetentionBars } from '../charts';
import { BarList, Card, Empty, ErrorBox, Loading, rub, Segmented, share, Stat, Tone, useLoad } from '../ui';
import type { AdminSectionKey } from '../AdminShell';

type Measure = 'active' | 'firstLaunches' | 'registrations' | 'payments' | 'revenueRub';
const MEASURES: Array<{ value: Measure; label: string; unit: string }> = [
  { value: 'active', label: 'Заходили', unit: 'человек' },
  { value: 'firstLaunches', label: 'Первые запуски', unit: 'новых' },
  { value: 'registrations', label: 'Регистрации', unit: 'регистраций' },
  { value: 'payments', label: 'Оплаты', unit: 'оплат' },
  { value: 'revenueRub', label: 'Выручка', unit: '' },
];
const RETENTION_CHOICES = [1, 3, 7, 14, 30];

export function OverviewSection({ range, source, onNavigate }: {
  range: AdminRangeKey; source: string; onNavigate: (section: AdminSectionKey) => void;
}) {
  const [retention, setRetention] = useState<number[]>([1, 3, 7, 30]);
  const [measure, setMeasure] = useState<Measure>('active');
  const { data, error, busy, reload } = useLoad(() => admin2.overview(range, retention), [range, retention.join(','), source]);

  if (!data && busy) return <Loading text="Считаю цифры…" />;
  if (!data) return <ErrorBox error={error} onRetry={reload} />;
  const m = data.metrics;
  const p = data.previous;
  const g = data.glossary;
  const current = MEASURES.find((x) => x.value === measure)!;
  const points = data.series.map((point: AdminDayPoint) => ({ day: point.day, value: point[measure] }));

  return (
    <div className="adm-stack" aria-busy={busy}>
      {error ? <ErrorBox error={error} onRetry={reload} /> : null}
      <p className="adm-period-note">{data.range.label}. Стрелки сравнивают с таким же периодом до этого.</p>

      <div className="adm-stats">
        <Stat label="Заходили" value={m.active} previous={p.active} help={g.active} sub={`новых ${m.firstLaunches}, вернулись ${m.returning}`} />
        <Stat label="Первые запуски" value={m.firstLaunches} previous={p.firstLaunches} help={g.firstLaunches} sub={`из приложения ${m.firstLaunchesApp}`} />
        <Stat label="Регистрации" value={m.registrations} previous={p.registrations} help={g.registrations} />
        <Stat label="Оплаты" value={m.payments} previous={p.payments} help={g.payments} sub={`первых ${m.firstPayments}, продлений ${m.renewals}`} />
        <Stat label="Выручка" value={m.revenueRub} previous={p.revenueRub} help={g.revenue} format={rub} />
        <Stat label="Premium сейчас" value={m.premiumActive} sub={`всего аккаунтов ${m.totalUsers}`} />
      </div>

      <Card title="Что улучшить в первую очередь" hint="Подсказки по цифрам этого периода">
        <ul className="adm-hints">
          {data.hints.map((hint) => (
            <li key={hint.title} data-tone={hint.tone}>
              <Tone tone={hint.tone}>{hint.tone === 'good' ? 'Хорошо' : hint.tone === 'bad' ? 'Важно' : 'Стоит посмотреть'}</Tone>
              <div><strong>{hint.title}</strong><p>{hint.text}</p></div>
              {hint.section ? <button type="button" className="adm-btn adm-btn--ghost" onClick={() => onNavigate(hint.section!)}>Открыть</button> : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="По дням" hint="Выбери, что показать"
        action={<Segmented label="Показатель" value={measure} onChange={setMeasure} options={MEASURES.map(({ value, label }) => ({ value, label }))} />}>
        <DailyBars points={points} unit={current.unit} label={current.label} format={measure === 'revenueRub' ? rub : undefined} />
      </Card>

      <div className="adm-grid-2">
        <Card title="Сколько людей заходит" hint="Разные люди за день, неделю и месяц, до этой минуты">
          <div className="adm-stats adm-stats--inline">
            <Stat label="За сегодня" value={data.audience.dau} help={g.dau} />
            <Stat label="За 7 дней" value={data.audience.wau} help={g.wau} />
            <Stat label="За 30 дней" value={data.audience.mau} help={g.mau} />
          </div>
          <p className="adm-muted">Из тех, кто заходил за месяц, сегодня зашли {share(data.audience.dau, data.audience.mau)}.</p>
        </Card>
        <Card title="Возвращаются ли люди" hint={g.retention}
          action={<div className="adm-chips" role="group" aria-label="Дни удержания">
            {RETENTION_CHOICES.map((day) => (
              <button key={day} type="button" aria-pressed={retention.includes(day)}
                onClick={() => setRetention((list) => list.includes(day) ? (list.length > 1 ? list.filter((d) => d !== day) : list) : [...list, day].sort((a, b) => a - b))}>
                {day}
              </button>
            ))}
          </div>}>
          <RetentionBars points={data.retention} />
        </Card>
      </div>

      <div className="adm-grid-2">
        <Card title="От экрана оплаты до покупки" hint={g.paywall} action={<button type="button" className="adm-link" onClick={() => onNavigate('money')}>Деньги</button>}>
          <Funnel steps={[
            { key: 'active', label: 'Заходили', count: m.active },
            { key: 'paywall', label: 'Открыли экран оплаты', count: m.paywallViewers },
            { key: 'checkout', label: 'Начали оплату', count: m.checkoutStarted },
            { key: 'buyers', label: 'Оплатили', count: m.buyers },
          ]} />
          {m.trials || m.cancellations || m.refunds ? (
            <p className="adm-muted">Пробных периодов {m.trials}, отключили автопродление {m.cancellations}, возвратов {m.refunds}.</p>
          ) : null}
          {m.stars.payments ? <p className="adm-muted">Оплат звёздами Telegram: {m.stars.payments} на {m.stars.amount} звёзд.</p> : null}
        </Card>
        <Card title="Активация за первые сутки" hint={g.activation} action={<button type="button" className="adm-link" onClick={() => onNavigate('journey')}>Путь</button>}>
          {m.activation.cohort ? (
            <>
              <div className="adm-big">{share(m.activation.activated, m.activation.cohort)}</div>
              <p className="adm-muted">{m.activation.activated} из {m.activation.cohort} новых получили карту или первый результат за 24 часа. Люди, пришедшие меньше суток назад, ещё не считаются.</p>
            </>
          ) : <Empty text="Нет новых людей старше суток в этом периоде" />}
        </Card>
      </div>

      <div className="adm-grid-2">
        <Card title="Откуда пришли новые" hint="По каждому новому человеку: реклама, ссылка кампании, магазин или сайт">
          <BarList items={m.sources} empty="В этом периоде новых не было" />
        </Card>
        <Card title="Версии приложения" hint="У кого какая версия, по людям из приложения за 30 дней"
          action={<button type="button" className="adm-link" onClick={() => onNavigate('quality')}>Подробнее</button>}>
          <BarList items={data.versions.versions.map((v) => ({ ...v, note: v.label === data.versions.latest ? 'последняя' : undefined }))} empty="Пока нет данных о версиях" />
          {data.versions.outdated ? <p className="adm-muted">На старой версии: {data.versions.outdated} из {data.versions.people}.</p> : null}
        </Card>
      </div>
      {m.registrationsByProvider.length ? (
        <Card title="Как регистрируются" hint="Первый вход за период">
          <BarList items={m.registrationsByProvider} />
        </Card>
      ) : null}
    </div>
  );
}
