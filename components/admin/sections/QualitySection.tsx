import React from 'react';
import { admin2 } from '../../../services/admin2Service';
import { BarList, Card, dateTime, Empty, ErrorBox, Loading, useLoad } from '../ui';
import { ErrorsSection } from './ErrorsSection';
import { aiScenarioLabel } from '../../../lib/aiScenarioLabels';

/** «Ошибки и версии»: what breaks, on which version and which phones. */
export function QualitySection({ source }: { source: string }) {
  const { data, error, busy, reload } = useLoad(() => admin2.quality(), [source]);
  return (
    <div className="adm-stack">
      {!data && busy ? <Loading /> : null}
      {error ? <ErrorBox error={error} onRetry={reload} /> : null}
      {data ? (
        <div className="adm-grid-2">
          <Card title="Версии приложения" hint="Последняя версия у каждого, кто открывал приложение за 30 дней">
            <BarList items={data.versions.versions.map((v) => ({ ...v, note: v.label === data.versions.latest ? 'последняя' : 'старая' }))} empty="Пока нет данных о версиях" />
            {data.versions.outdated ? <p className="adm-muted">{data.versions.outdated} человек не обновились до {data.versions.latest}.</p> : null}
          </Card>
          <Card title="Телефоны" hint="На чём сидят люди, по последнему входу за 30 дней">
            <BarList items={data.devices} empty="Пока нет данных о телефонах" />
          </Card>
        </div>
      ) : null}
      {data ? (
        <Card title="Что не получилось у ИИ" hint="Запросы к ИИ, которые закончились ошибкой, за 30 дней">
          {data.aiFailures.length ? (
            <div className="adm-table-wrap"><table className="adm-table">
              <thead><tr><th>Где</th><th>Причина</th><th className="num">Раз</th><th>Последний раз</th></tr></thead>
              <tbody>{data.aiFailures.map((row) => (
                <tr key={row.scenario + row.errorCode}><td>{aiScenarioLabel(row.scenario)}</td><td>{row.errorCode || 'не указана'}</td>
                  <td className="num">{row.count}</td><td>{dateTime(row.lastAt)}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty text="Ошибок ИИ за 30 дней нет." />}
        </Card>
      ) : null}
      <ErrorsSection />
    </div>
  );
}
