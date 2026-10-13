import React from 'react';
import { admin2, type AdminRangeKey, type AdminWaitRow } from '../../../services/admin2Service';
import { Funnel } from '../charts';
import { ago, Card, duration, Empty, ErrorBox, fmt, Loading, share, Tone, useLoad } from '../ui';

function WaitTable({ rows, empty }: { rows: AdminWaitRow[]; empty: string }) {
  if (!rows.length) return <Empty text={empty} />;
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead><tr><th>Что грузится</th><th className="num">Раз</th><th className="num">Обычно</th><th className="num">Долго (1 из 10)</th><th className="num">Не получилось</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.label}</td>
              <td className="num">{fmt(row.count)}</td>
              <td className="num">{duration(row.medianSeconds)}</td>
              <td className="num">{(row.p90Seconds || 0) >= 10 ? <Tone tone="warn">{duration(row.p90Seconds)}</Tone> : duration(row.p90Seconds)}</td>
              <td className="num">{row.failed ? <Tone tone="bad">{row.failed}</Tone> : '0'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JourneySection({ range, source, onOpenPerson }: { range: AdminRangeKey; source: string; onOpenPerson: (id: string) => void }) {
  const { data, error, busy, reload } = useLoad(() => admin2.journey(range), [range, source]);
  if (!data && busy) return <Loading text="Собираю путь людей…" />;
  if (!data) return <ErrorBox error={error} onRetry={reload} />;
  const { funnel, onboarding, waits, reading, stuck } = data;
  const worst = [...onboarding.steps].sort((a, b) => b.leftHere - a.leftHere)[0];
  const noPhoneData = !waits.screens.length && !reading.blocks.length;

  return (
    <div className="adm-stack" aria-busy={busy}>
      {error ? <ErrorBox error={error} onRetry={reload} /> : null}
      <p className="adm-period-note">{data.range.label}. Считаются люди, которые впервые открыли приложение в этот период.</p>

      <Card title="Путь от первого запуска до оплаты" hint="Сколько людей дошли до каждого шага и сколько потерялись по дороге">
        <Funnel steps={funnel} />
      </Card>

      <Card title="Первое знакомство" hint="Экраны, которые человек видит сразу после установки">
        {onboarding.attempts ? (
          <>
            <p className="adm-muted">Начали {onboarding.attempts}, дошли до конца {onboarding.finished} ({share(onboarding.finished, onboarding.attempts)}).
              {worst && worst.leftHere ? ` Чаще всего уходят на шаге «${worst.label}».` : ''}</p>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Шаг</th><th className="num">Дошли</th><th className="num">Ушли на этом шаге</th><th className="num">Сколько смотрят</th></tr></thead>
                <tbody>
                  {onboarding.steps.map((step) => (
                    <tr key={step.step}>
                      <td>{step.label}</td>
                      <td className="num">{step.reached}</td>
                      <td className="num">{step.leftHere ? <Tone tone={step === worst ? 'bad' : 'warn'}>{step.leftHere}</Tone> : '0'}</td>
                      <td className="num">{duration(step.medianSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <Empty text="Подробные шаги знакомства появятся, когда люди поставят новую версию приложения." />}
      </Card>

      <Card title="Сколько ждут" hint="«Обычно» это половина случаев быстрее, половина дольше. «Долго» это самые медленные 10%.">
        <h3 className="adm-subhead">Расчёт и разбор карты</h3>
        <WaitTable rows={waits.server} empty="В этом периоде разборов не было." />
        <h3 className="adm-subhead">Ответы ИИ</h3>
        <WaitTable rows={waits.ai} empty="Запросов к ИИ в этом периоде не было (или сервер ещё не записывает их, обнови сервер)." />
        <h3 className="adm-subhead">Загрузки на телефоне</h3>
        <WaitTable rows={waits.screens} empty="Появится, когда люди поставят новую версию приложения." />
      </Card>

      <Card title="Что читают" hint="Блоки на экранах: сколько людей их видели и сколько секунд обычно на них смотрят">
        {reading.blocks.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Экран</th><th>Блок</th><th className="num">Людей</th><th className="num">Обычно смотрят</th><th className="num">В центре внимания</th></tr></thead>
              <tbody>
                {reading.blocks.map((row) => (
                  <tr key={row.screen + row.block}><td>{row.screen}</td><td>{row.block}</td><td className="num">{row.people}</td>
                    <td className="num">{duration(row.medianSeconds)}</td><td className="num">{duration(row.focusSeconds)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty text={noPhoneData ? 'Появится, когда люди поставят новую версию приложения.' : 'В этом периоде нет данных.'} />}
        {reading.screens.length ? (
          <>
            <h3 className="adm-subhead">Время на экранах</h3>
            <div className="adm-table-wrap"><table className="adm-table">
              <thead><tr><th>Экран</th><th className="num">Людей</th><th className="num">Обычно проводят</th></tr></thead>
              <tbody>{reading.screens.map((row) => <tr key={row.screen}><td>{row.screen}</td><td className="num">{row.people}</td><td className="num">{duration(row.medianSeconds)}</td></tr>)}</tbody>
            </table></div>
          </>
        ) : null}
      </Card>

      <Card title="Не получили карту" hint="Пришли больше двух часов назад, а карты нет. Нажми, чтобы увидеть, где они остановились.">
        {stuck.length ? (
          <ul className="adm-plain-list adm-plain-list--click">
            {stuck.map((person) => (
              <li key={person.id}>
                <button type="button" onClick={() => onOpenPerson(person.id)}>
                  <strong>{person.name || 'Гость'}</strong> · ID {person.id} · пришёл {ago(person.createdAt)}
                  {person.lastStep ? <small>последний шаг: {person.lastStep}</small> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : <Empty text="Таких нет, все новые получили карту." />}
      </Card>
    </div>
  );
}
